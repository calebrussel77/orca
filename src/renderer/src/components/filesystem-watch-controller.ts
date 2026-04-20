import type { StoreApi } from 'zustand'
import { useAppStore } from '@/store'
import type { AppState } from '@/store'
import { notifyEditorExternalFileChange } from './editor/editor-autosave'
import type { FsChangedPayload } from '../../../shared/types'

type AppStoreApi = Pick<StoreApi<AppState>, 'getState' | 'subscribe'>

type WatchedWorktree = {
  key: string
  worktreeId: string
  worktreePath: string
  connectionId?: string
}

function normalizeAbsolutePath(path: string): string {
  let normalizedPath = path.replace(/[\\/]+/g, '/')
  if (/^[a-z]:/.test(normalizedPath)) {
    normalizedPath = normalizedPath.charAt(0).toUpperCase() + normalizedPath.slice(1)
  }
  if (normalizedPath === '/') {
    return normalizedPath
  }
  if (/^[A-Za-z]:\/$/.test(normalizedPath)) {
    return normalizedPath
  }
  return normalizedPath.replace(/\/+$/, '')
}

function isPathEqualOrDescendant(candidatePath: string, targetPath: string): boolean {
  const normalizedCandidate = normalizeAbsolutePath(candidatePath)
  const normalizedTarget = normalizeAbsolutePath(targetPath)
  return (
    normalizedCandidate === normalizedTarget ||
    normalizedCandidate.startsWith(`${normalizedTarget}/`)
  )
}

function findWorktreeById(state: AppState, worktreeId: string) {
  for (const worktrees of Object.values(state.worktreesByRepo)) {
    const worktree = worktrees.find((entry) => entry.id === worktreeId)
    if (worktree) {
      return worktree
    }
  }
  return null
}

function getConnectionId(state: AppState, worktreeId: string): string | undefined {
  const worktree = findWorktreeById(state, worktreeId)
  if (!worktree) {
    return undefined
  }
  const repo = state.repos.find((entry) => entry.id === worktree.repoId)
  return repo?.connectionId ?? undefined
}

function buildWatchKey(worktreePath: string, connectionId?: string): string {
  return `${connectionId ?? 'local'}::${normalizeAbsolutePath(worktreePath)}`
}

function collectWatchedWorktrees(state: AppState): WatchedWorktree[] {
  const worktreeIds = new Set<string>()
  if (state.activeWorktreeId) {
    worktreeIds.add(state.activeWorktreeId)
  }
  for (const file of state.openFiles) {
    worktreeIds.add(file.worktreeId)
  }

  const watched: WatchedWorktree[] = []
  for (const worktreeId of worktreeIds) {
    const worktree = findWorktreeById(state, worktreeId)
    if (!worktree) {
      continue
    }
    const connectionId = getConnectionId(state, worktreeId)
    watched.push({
      key: buildWatchKey(worktree.path, connectionId),
      worktreeId,
      worktreePath: worktree.path,
      connectionId
    })
  }

  return watched
}

function getCleanRefreshableFiles(state: AppState, worktreeId: string) {
  return state.openFiles.filter((file) => {
    if (file.worktreeId !== worktreeId || file.isDirty) {
      return false
    }
    return file.mode === 'edit' || (file.mode === 'diff' && file.diffSource === 'unstaged')
  })
}

function handleFsChangedPayload(store: AppStoreApi, payload: FsChangedPayload): void {
  const state = store.getState()
  const worktree = collectWatchedWorktrees(state).find(
    (candidate) =>
      normalizeAbsolutePath(candidate.worktreePath) === normalizeAbsolutePath(payload.worktreePath)
  )
  if (!worktree) {
    return
  }

  const refreshableFiles = getCleanRefreshableFiles(state, worktree.worktreeId)
  if (refreshableFiles.length === 0) {
    return
  }

  const relativePathsToRefresh = new Set<string>()

  for (const event of payload.events) {
    if (event.kind === 'overflow') {
      for (const file of refreshableFiles) {
        relativePathsToRefresh.add(file.relativePath)
      }
      continue
    }

    if (event.kind === 'update' && event.isDirectory === true) {
      continue
    }

    const absolutePath = normalizeAbsolutePath(event.absolutePath)
    for (const file of refreshableFiles) {
      const filePath = normalizeAbsolutePath(file.filePath)
      const matchesPath =
        event.kind === 'delete'
          ? isPathEqualOrDescendant(filePath, absolutePath)
          : filePath === absolutePath

      if (matchesPath) {
        relativePathsToRefresh.add(file.relativePath)
      }
    }
  }

  for (const relativePath of relativePathsToRefresh) {
    notifyEditorExternalFileChange({
      worktreeId: worktree.worktreeId,
      worktreePath: worktree.worktreePath,
      relativePath
    })
  }
}

export function attachFilesystemWatchController(store: AppStoreApi): () => void {
  const watchedRoots = new Map<string, WatchedWorktree>()
  let disposed = false
  let syncGeneration = 0

  const syncWatches = async (): Promise<void> => {
    const generation = ++syncGeneration
    const desiredRoots = new Map(
      collectWatchedWorktrees(store.getState()).map((worktree) => [worktree.key, worktree])
    )

    for (const [key, watched] of watchedRoots) {
      if (desiredRoots.has(key)) {
        continue
      }
      watchedRoots.delete(key)
      await window.api.fs.unwatchWorktree({
        worktreePath: watched.worktreePath,
        connectionId: watched.connectionId
      })
    }

    for (const [key, desired] of desiredRoots) {
      if (watchedRoots.has(key)) {
        continue
      }
      await window.api.fs.watchWorktree({
        worktreePath: desired.worktreePath,
        connectionId: desired.connectionId
      })
      if (disposed || generation !== syncGeneration) {
        await window.api.fs.unwatchWorktree({
          worktreePath: desired.worktreePath,
          connectionId: desired.connectionId
        })
        return
      }
      watchedRoots.set(key, desired)
    }
  }

  const unsubscribeStore = store.subscribe(() => {
    void syncWatches()
  })
  const unsubscribeFsChanged = window.api.fs.onFsChanged((payload) => {
    // Why: VS Code keeps clean editors live with the on-disk version even when
    // the file tree is hidden. Orca owns watchWorktree globally so clean edit
    // and unstaged-diff tabs refresh on file-content changes instead of waiting
    // for Explorer to be visible or for the app to restart.
    handleFsChangedPayload(store, payload)
  })

  void syncWatches()

  return () => {
    disposed = true
    unsubscribeStore()
    unsubscribeFsChanged()
    for (const watched of watchedRoots.values()) {
      void window.api.fs.unwatchWorktree({
        worktreePath: watched.worktreePath,
        connectionId: watched.connectionId
      })
    }
    watchedRoots.clear()
  }
}

export const __test__ = {
  buildWatchKey,
  collectWatchedWorktrees,
  handleFsChangedPayload,
  normalizeAbsolutePath,
  isPathEqualOrDescendant
}

export function attachAppFilesystemWatchController(): () => void {
  return attachFilesystemWatchController(useAppStore)
}

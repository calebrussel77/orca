import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { AppState } from '@/store'
import { createEditorSlice } from '@/store/slices/editor'
import { attachFilesystemWatchController, __test__ } from './filesystem-watch-controller'
import { ORCA_EDITOR_EXTERNAL_FILE_CHANGE_EVENT } from './editor/editor-autosave'
import type { FsChangedPayload, Repo, Worktree } from '../../../shared/types'

type WindowStub = {
  addEventListener: Window['addEventListener']
  removeEventListener: Window['removeEventListener']
  dispatchEvent: Window['dispatchEvent']
  api: {
    fs: {
      watchWorktree: ReturnType<typeof vi.fn>
      unwatchWorktree: ReturnType<typeof vi.fn>
      onFsChanged: (callback: (payload: FsChangedPayload) => void) => () => void
    }
  }
}

function createEditorStore(): StoreApi<AppState> {
  const repo: Repo = {
    id: 'repo-1',
    path: '/repo',
    displayName: 'Repo',
    badgeColor: '#000000',
    addedAt: 0
  }
  const worktree: Worktree = {
    id: 'wt-1',
    repoId: repo.id,
    path: '/repo',
    head: 'abc123',
    branch: 'refs/heads/main',
    isBare: false,
    isMainWorktree: true,
    displayName: 'main',
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    isArchived: false,
    isUnread: false,
    sidebarOrder: 0,
    sortOrder: 0,
    lastActivityAt: 0
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createStore<any>()((...args: any[]) => ({
    activeWorktreeId: worktree.id,
    repos: [repo],
    worktreesByRepo: { [repo.id]: [worktree] },
    tabsByWorktree: {},
    browserTabsByWorktree: {},
    tabBarOrderByWorktree: {},
    ...createEditorSlice(...(args as Parameters<typeof createEditorSlice>))
  })) as unknown as StoreApi<AppState>
}

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('filesystem-watch-controller', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('watches the active worktree and unwatches it on cleanup', async () => {
    const eventTarget = new EventTarget()
    const fsChangedListeners = new Set<(payload: FsChangedPayload) => void>()
    const watchWorktree = vi.fn().mockResolvedValue(undefined)
    const unwatchWorktree = vi.fn().mockResolvedValue(undefined)

    vi.stubGlobal('window', {
      addEventListener: eventTarget.addEventListener.bind(eventTarget),
      removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
      dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
      api: {
        fs: {
          watchWorktree,
          unwatchWorktree,
          onFsChanged: (callback) => {
            fsChangedListeners.add(callback)
            return () => fsChangedListeners.delete(callback)
          }
        }
      }
    } satisfies WindowStub)

    const store = createEditorStore()
    const cleanup = attachFilesystemWatchController(store)
    await flushAsyncWork()

    expect(watchWorktree).toHaveBeenCalledWith({
      worktreePath: '/repo',
      connectionId: undefined
    })
    expect(fsChangedListeners.size).toBe(1)

    cleanup()
    expect(unwatchWorktree).toHaveBeenCalledWith({
      worktreePath: '/repo',
      connectionId: undefined
    })
  })

  it('notifies the editor when a clean open file changes on disk', async () => {
    const eventTarget = new EventTarget()
    const fsChangedListeners = new Set<(payload: FsChangedPayload) => void>()

    vi.stubGlobal('window', {
      addEventListener: eventTarget.addEventListener.bind(eventTarget),
      removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
      dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
      api: {
        fs: {
          watchWorktree: vi.fn().mockResolvedValue(undefined),
          unwatchWorktree: vi.fn().mockResolvedValue(undefined),
          onFsChanged: (callback) => {
            fsChangedListeners.add(callback)
            return () => fsChangedListeners.delete(callback)
          }
        }
      }
    } satisfies WindowStub)

    const store = createEditorStore()
    store.getState().openFile({
      filePath: '/repo/src/file.ts',
      relativePath: 'src/file.ts',
      worktreeId: 'wt-1',
      language: 'typescript',
      mode: 'edit'
    })

    const refreshed: { worktreeId: string; worktreePath: string; relativePath: string }[] = []
    window.addEventListener(ORCA_EDITOR_EXTERNAL_FILE_CHANGE_EVENT, (event) => {
      refreshed.push(
        (event as CustomEvent<{ worktreeId: string; worktreePath: string; relativePath: string }>)
          .detail
      )
    })

    const cleanup = attachFilesystemWatchController(store)
    await flushAsyncWork()

    const listener = Array.from(fsChangedListeners)[0]
    listener?.({
      worktreePath: '/repo',
      events: [{ kind: 'update', absolutePath: '/repo/src/file.ts', isDirectory: false }]
    })

    expect(refreshed).toEqual([
      {
        worktreeId: 'wt-1',
        worktreePath: '/repo',
        relativePath: 'src/file.ts'
      }
    ])

    cleanup()
  })

  it('does not notify the editor for dirty files to avoid clobbering drafts', async () => {
    const eventTarget = new EventTarget()
    const fsChangedListeners = new Set<(payload: FsChangedPayload) => void>()

    vi.stubGlobal('window', {
      addEventListener: eventTarget.addEventListener.bind(eventTarget),
      removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
      dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
      api: {
        fs: {
          watchWorktree: vi.fn().mockResolvedValue(undefined),
          unwatchWorktree: vi.fn().mockResolvedValue(undefined),
          onFsChanged: (callback) => {
            fsChangedListeners.add(callback)
            return () => fsChangedListeners.delete(callback)
          }
        }
      }
    } satisfies WindowStub)

    const store = createEditorStore()
    store.getState().openFile({
      filePath: '/repo/src/file.ts',
      relativePath: 'src/file.ts',
      worktreeId: 'wt-1',
      language: 'typescript',
      mode: 'edit'
    })
    store.getState().setEditorDraft('/repo/src/file.ts', 'local draft')
    store.getState().markFileDirty('/repo/src/file.ts', true)

    const refreshed = vi.fn()
    window.addEventListener(ORCA_EDITOR_EXTERNAL_FILE_CHANGE_EVENT, refreshed as EventListener)

    const cleanup = attachFilesystemWatchController(store)
    await flushAsyncWork()

    const listener = Array.from(fsChangedListeners)[0]
    listener?.({
      worktreePath: '/repo',
      events: [{ kind: 'update', absolutePath: '/repo/src/file.ts', isDirectory: false }]
    })

    expect(refreshed).not.toHaveBeenCalled()
    cleanup()
  })

  it('treats file deletes as matching descendants under a removed directory', () => {
    expect(__test__.isPathEqualOrDescendant('/repo/src/file.ts', '/repo/src')).toBe(true)
    expect(__test__.isPathEqualOrDescendant('/repo/other.ts', '/repo/src')).toBe(false)
  })
})

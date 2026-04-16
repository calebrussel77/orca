import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestStore, makeTabGroup, makeWorktree, seedStore } from './store-test-helpers'

describe('browser slice', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reopens the most recently closed browser tab in the same worktree', () => {
    const store = createTestStore()
    const worktreeId = 'repo1::/tmp/wt-1'
    seedStore(store, {
      activeRepoId: 'repo1',
      activeWorktreeId: worktreeId,
      activeTabType: 'browser',
      worktreesByRepo: {
        repo1: [
          makeWorktree({
            id: worktreeId,
            repoId: 'repo1',
            path: '/tmp/wt-1'
          })
        ]
      },
      groupsByWorktree: {
        [worktreeId]: [
          makeTabGroup({
            id: 'group-1',
            worktreeId,
            activeTabId: null,
            tabOrder: []
          })
        ]
      },
      activeGroupIdByWorktree: {
        [worktreeId]: 'group-1'
      },
      browserTabsByWorktree: {},
      unifiedTabsByWorktree: {}
    })

    const created = store.getState().createBrowserTab(worktreeId, 'https://example.com/docs', {
      title: 'Docs'
    })
    store.getState().closeBrowserTab(created.id)

    expect(store.getState().browserTabsByWorktree[worktreeId]).toBeUndefined()
    expect(store.getState().recentlyClosedBrowserTabsByWorktree[worktreeId]).toHaveLength(1)

    const reopened = store.getState().reopenClosedBrowserTab(worktreeId)

    expect(reopened).not.toBeNull()
    expect(reopened?.id).not.toBe(created.id)
    expect(reopened?.url).toBe('https://example.com/docs')
    expect(reopened?.title).toBe('Docs')
    expect(store.getState().browserTabsByWorktree[worktreeId]).toHaveLength(1)
    expect(store.getState().recentlyClosedBrowserTabsByWorktree[worktreeId]).toHaveLength(0)
  })

  it('assigns a session profile to the current browser workspace', () => {
    const store = createTestStore()
    const worktreeId = 'repo1::/tmp/wt-2'
    seedStore(store, {
      activeRepoId: 'repo1',
      activeWorktreeId: worktreeId,
      worktreesByRepo: {
        repo1: [
          makeWorktree({
            id: worktreeId,
            repoId: 'repo1',
            path: '/tmp/wt-2'
          })
        ]
      },
      groupsByWorktree: {
        [worktreeId]: [
          makeTabGroup({
            id: 'group-1',
            worktreeId,
            activeTabId: null,
            tabOrder: []
          })
        ]
      },
      activeGroupIdByWorktree: {
        [worktreeId]: 'group-1'
      }
    })

    const created = store.getState().createBrowserTab(worktreeId, 'https://example.com')
    store.getState().assignBrowserSessionProfile(created.id, 'profile-1')

    expect(store.getState().browserTabsByWorktree[worktreeId]?.[0]?.sessionProfileId).toBe(
      'profile-1'
    )
  })

  it('clears deleted session profiles from persisted browser workspaces', async () => {
    vi.stubGlobal('window', {
      api: {
        browser: {
          sessionDeleteProfile: vi.fn().mockResolvedValue(true)
        }
      }
    })

    const store = createTestStore()
    const worktreeId = 'repo1::/tmp/wt-3'
    seedStore(store, {
      activeRepoId: 'repo1',
      activeWorktreeId: worktreeId,
      worktreesByRepo: {
        repo1: [
          makeWorktree({
            id: worktreeId,
            repoId: 'repo1',
            path: '/tmp/wt-3'
          })
        ]
      },
      groupsByWorktree: {
        [worktreeId]: [
          makeTabGroup({
            id: 'group-1',
            worktreeId,
            activeTabId: null,
            tabOrder: []
          })
        ]
      },
      activeGroupIdByWorktree: {
        [worktreeId]: 'group-1'
      },
      browserSessionProfiles: [
        {
          id: 'profile-2',
          scope: 'imported',
          partition: 'persist:orca-browser-session-profile-2',
          label: 'Imported Session',
          source: null
        }
      ]
    })

    const created = store.getState().createBrowserTab(worktreeId, 'https://example.com', {
      sessionProfileId: 'profile-2'
    })

    await store.getState().deleteBrowserSessionProfile('profile-2')

    expect(store.getState().browserSessionProfiles).toEqual([])
    expect(
      store.getState().browserTabsByWorktree[worktreeId]?.find((tab) => tab.id === created.id)
        ?.sessionProfileId
    ).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import type { BrowserSessionProfile, BrowserWorkspace } from '../../../shared/types'
import { resolveSettingsCookieImportTarget } from './browser-session-target'

const defaultProfile: BrowserSessionProfile = {
  id: 'default',
  scope: 'default',
  partition: 'persist:orca-browser',
  label: 'Default',
  source: null
}

function makeWorkspace(overrides: Partial<BrowserWorkspace> = {}): BrowserWorkspace {
  return {
    id: 'workspace-1',
    worktreeId: 'wt-1',
    sessionProfileId: null,
    activePageId: 'page-1',
    pageIds: ['page-1'],
    url: 'https://example.com',
    title: 'Example',
    loading: false,
    faviconUrl: null,
    canGoBack: false,
    canGoForward: false,
    loadError: null,
    createdAt: 1,
    ...overrides
  }
}

describe('resolveSettingsCookieImportTarget', () => {
  it('falls back to the default profile when no browser workspace is active', () => {
    const result = resolveSettingsCookieImportTarget({
      activeBrowserTabIdByWorktree: { 'wt-1': 'workspace-1' },
      activeTabType: 'editor',
      activeWorktreeId: 'wt-1',
      browserSessionProfiles: [defaultProfile],
      browserTabsByWorktree: {
        'wt-1': [makeWorkspace()]
      }
    })

    expect(result.profile).toEqual(defaultProfile)
    expect(result.workspace).toBeNull()
  })

  it('uses the active workspace session profile when one is assigned', () => {
    const importedProfile: BrowserSessionProfile = {
      id: 'profile-imported',
      scope: 'imported',
      partition: 'persist:orca-browser-session-profile-imported',
      label: 'Imported Session',
      source: null
    }

    const result = resolveSettingsCookieImportTarget({
      activeBrowserTabIdByWorktree: { 'wt-1': 'workspace-1' },
      activeTabType: 'browser',
      activeWorktreeId: 'wt-1',
      browserSessionProfiles: [defaultProfile, importedProfile],
      browserTabsByWorktree: {
        'wt-1': [makeWorkspace({ sessionProfileId: importedProfile.id })]
      }
    })

    expect(result.profile).toEqual(importedProfile)
    expect(result.workspace?.id).toBe('workspace-1')
  })

  it('keeps the default profile for active workspaces using the shared session', () => {
    const result = resolveSettingsCookieImportTarget({
      activeBrowserTabIdByWorktree: { 'wt-1': 'workspace-1' },
      activeTabType: 'browser',
      activeWorktreeId: 'wt-1',
      browserSessionProfiles: [defaultProfile],
      browserTabsByWorktree: {
        'wt-1': [makeWorkspace()]
      }
    })

    expect(result.profile).toEqual(defaultProfile)
    expect(result.workspace?.id).toBe('workspace-1')
  })
})

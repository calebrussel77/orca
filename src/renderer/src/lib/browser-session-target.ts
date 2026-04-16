import type {
  BrowserSessionProfile,
  BrowserWorkspace,
  WorkspaceVisibleTabType
} from '../../../shared/types'

type ResolveSettingsCookieImportTargetArgs = {
  activeBrowserTabIdByWorktree: Record<string, string | null>
  activeTabType: WorkspaceVisibleTabType
  activeWorktreeId: string | null
  browserSessionProfiles: BrowserSessionProfile[]
  browserTabsByWorktree: Record<string, BrowserWorkspace[]>
}

type ResolveSettingsCookieImportTargetResult = {
  profile: BrowserSessionProfile | null
  workspace: BrowserWorkspace | null
}

export function resolveSettingsCookieImportTarget({
  activeBrowserTabIdByWorktree,
  activeTabType,
  activeWorktreeId,
  browserSessionProfiles,
  browserTabsByWorktree
}: ResolveSettingsCookieImportTargetArgs): ResolveSettingsCookieImportTargetResult {
  const defaultProfile = browserSessionProfiles.find((profile) => profile.id === 'default') ?? null
  if (!activeWorktreeId || activeTabType !== 'browser') {
    return { profile: defaultProfile, workspace: null }
  }

  const activeWorkspaceId = activeBrowserTabIdByWorktree[activeWorktreeId] ?? null
  if (!activeWorkspaceId) {
    return { profile: defaultProfile, workspace: null }
  }

  const workspace =
    (browserTabsByWorktree[activeWorktreeId] ?? []).find(
      (entry) => entry.id === activeWorkspaceId
    ) ?? null
  if (!workspace) {
    return { profile: defaultProfile, workspace: null }
  }

  if (!workspace.sessionProfileId) {
    return { profile: defaultProfile, workspace }
  }

  // Why: Settings-level cookie imports should follow the session currently
  // bound to the active browser workspace. Otherwise the UI can report a
  // successful import into the shared default profile while the embedded
  // browser keeps using an isolated profile with different cookies.
  const profile =
    browserSessionProfiles.find((entry) => entry.id === workspace.sessionProfileId) ??
    defaultProfile
  return { profile, workspace }
}

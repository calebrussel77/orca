export type GitHubReleaseInfo = {
  owner: string
  repo: string
  slug: string
  repositoryUrl: string
  releasesUrl: string
  latestReleaseUrl: string
  latestDownloadUrl: string
  issuesUrl: string
}

export const DEFAULT_GITHUB_RELEASE_SLUG = 'calebrussel77/orca'

export function normalizeGitHubRepoSlug(source: string | null | undefined): string | null {
  if (!source) {
    return null
  }

  const trimmed = source.trim()
  if (!trimmed) {
    return null
  }

  const slugMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/)
  if (slugMatch) {
    return `${slugMatch[1]}/${slugMatch[2]}`
  }

  const githubUrlMatch = trimmed.match(
    /github\.com[:/]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:\/|$)/i
  )
  if (githubUrlMatch) {
    return `${githubUrlMatch[1]}/${githubUrlMatch[2]}`
  }

  return null
}

export function buildGitHubReleaseInfo(slug: string): GitHubReleaseInfo {
  const [owner, repo] = slug.split('/')
  const repositoryUrl = `https://github.com/${owner}/${repo}`
  const releasesUrl = `${repositoryUrl}/releases`

  return {
    owner,
    repo,
    slug,
    repositoryUrl,
    releasesUrl,
    latestReleaseUrl: `${releasesUrl}/latest`,
    latestDownloadUrl: `${releasesUrl}/latest/download`,
    issuesUrl: `${repositoryUrl}/issues`
  }
}

export const DEFAULT_GITHUB_RELEASE_INFO = buildGitHubReleaseInfo(DEFAULT_GITHUB_RELEASE_SLUG)

export function buildReleaseTagUrl(
  version: string | null | undefined,
  releaseInfo: GitHubReleaseInfo = DEFAULT_GITHUB_RELEASE_INFO
): string {
  if (!version) {
    return releaseInfo.latestReleaseUrl
  }

  const normalizedVersion = version.replace(/^v/i, '')
  return `${releaseInfo.releasesUrl}/tag/v${normalizedVersion}`
}

export function buildSkillInstallCommand(
  releaseInfo: GitHubReleaseInfo = DEFAULT_GITHUB_RELEASE_INFO
): string {
  return `npx skills add ${releaseInfo.repositoryUrl} --skill orca-cli`
}

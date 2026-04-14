const packageJson = require('../package.json')

const DEFAULT_GITHUB_RELEASE_SLUG = 'calebrussel77/orca'

function normalizeGitHubRepoSlug(source) {
  if (!source || typeof source !== 'string') {
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

function resolveGitHubReleaseRepo() {
  const repositoryValue =
    typeof packageJson.repository === 'string'
      ? packageJson.repository
      : packageJson.repository?.url

  const slug =
    normalizeGitHubRepoSlug(process.env.ORCA_RELEASE_REPOSITORY) ||
    normalizeGitHubRepoSlug(process.env.GITHUB_REPOSITORY) ||
    normalizeGitHubRepoSlug(repositoryValue) ||
    normalizeGitHubRepoSlug(packageJson.homepage) ||
    DEFAULT_GITHUB_RELEASE_SLUG

  const [owner, repo] = slug.split('/')
  return { owner, repo, slug }
}

module.exports = {
  DEFAULT_GITHUB_RELEASE_SLUG,
  normalizeGitHubRepoSlug,
  resolveGitHubReleaseRepo
}

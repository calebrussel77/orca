import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import {
  buildGitHubReleaseInfo,
  DEFAULT_GITHUB_RELEASE_INFO,
  normalizeGitHubRepoSlug,
  type GitHubReleaseInfo
} from '../shared/github-release'

type PackageMetadata = {
  homepage?: string
  repository?: string | { url?: string }
}

function readPackageMetadata(): PackageMetadata | null {
  try {
    const packageJsonPath = path.join(app.getAppPath(), 'package.json')
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as PackageMetadata
  } catch {
    return null
  }
}

function extractRepoSlugFromPackageMetadata(packageMetadata: PackageMetadata | null): string | null {
  if (!packageMetadata) {
    return null
  }

  const repositoryValue =
    typeof packageMetadata.repository === 'string'
      ? packageMetadata.repository
      : packageMetadata.repository?.url

  return (
    normalizeGitHubRepoSlug(repositoryValue) ??
    normalizeGitHubRepoSlug(packageMetadata.homepage) ??
    null
  )
}

export function resolveGitHubReleaseInfo(options?: {
  env?: NodeJS.ProcessEnv
  packageMetadata?: PackageMetadata | null
}): GitHubReleaseInfo {
  const env = options?.env ?? process.env
  const packageMetadata = options?.packageMetadata ?? readPackageMetadata()

  const slug =
    normalizeGitHubRepoSlug(env.ORCA_RELEASE_REPOSITORY) ??
    normalizeGitHubRepoSlug(env.GITHUB_REPOSITORY) ??
    extractRepoSlugFromPackageMetadata(packageMetadata)

  return slug ? buildGitHubReleaseInfo(slug) : DEFAULT_GITHUB_RELEASE_INFO
}

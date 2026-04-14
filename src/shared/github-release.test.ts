import { describe, expect, it } from 'vitest'
import {
  buildGitHubReleaseInfo,
  buildReleaseTagUrl,
  buildSkillInstallCommand,
  normalizeGitHubRepoSlug
} from './github-release'

describe('github-release helpers', () => {
  it('normalizes owner/repo slugs directly', () => {
    expect(normalizeGitHubRepoSlug('calebrussel77/orca')).toBe('calebrussel77/orca')
  })

  it('normalizes https repository urls', () => {
    expect(normalizeGitHubRepoSlug('https://github.com/calebrussel77/orca')).toBe(
      'calebrussel77/orca'
    )
    expect(normalizeGitHubRepoSlug('git+https://github.com/calebrussel77/orca.git')).toBe(
      'calebrussel77/orca'
    )
  })

  it('normalizes ssh repository urls', () => {
    expect(normalizeGitHubRepoSlug('git@github.com:calebrussel77/orca.git')).toBe(
      'calebrussel77/orca'
    )
  })

  it('builds release urls and CLI command from a slug', () => {
    const releaseInfo = buildGitHubReleaseInfo('calebrussel77/orca')

    expect(releaseInfo.latestDownloadUrl).toBe(
      'https://github.com/calebrussel77/orca/releases/latest/download'
    )
    expect(buildReleaseTagUrl('1.2.3', releaseInfo)).toBe(
      'https://github.com/calebrussel77/orca/releases/tag/v1.2.3'
    )
    expect(buildSkillInstallCommand(releaseInfo)).toBe(
      'npx skills add https://github.com/calebrussel77/orca --skill orca-cli'
    )
  })
})

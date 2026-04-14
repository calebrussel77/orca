import { describe, expect, it } from 'vitest'
import { resolveGitHubReleaseInfo } from './github-release-info'

describe('resolveGitHubReleaseInfo', () => {
  it('prefers ORCA_RELEASE_REPOSITORY from the environment', () => {
    expect(
      resolveGitHubReleaseInfo({
        env: { ORCA_RELEASE_REPOSITORY: 'example/forked-orca' } as NodeJS.ProcessEnv,
        packageMetadata: {
          homepage: 'https://github.com/calebrussel77/orca'
        }
      }).slug
    ).toBe('example/forked-orca')
  })

  it('falls back to package metadata when the environment is unset', () => {
    expect(
      resolveGitHubReleaseInfo({
        env: {} as NodeJS.ProcessEnv,
        packageMetadata: {
          repository: {
            url: 'git+https://github.com/calebrussel77/orca.git'
          }
        }
      }).latestDownloadUrl
    ).toBe('https://github.com/calebrussel77/orca/releases/latest/download')
  })
})

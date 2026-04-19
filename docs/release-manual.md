# Release Manual

This runbook documents the current release flow for the fork `calebrussel77/orca`.

It is written for agents and assumes the goal is:

- push the current `main`
- cut a new version
- publish the GitHub release so it becomes `latest`

## Scope

Use this manual for standard Windows and Linux desktop releases published from the fork's GitHub Releases page.

The repo contains two release workflows:

- `.github/workflows/cut-release.yml`
- `.github/workflows/release.yml`

The standard path is:

1. push `main`
2. run `Cut Release`
3. let `Cut Release` dispatch `Release` with the new tag explicitly
4. let `Release` create the draft, upload assets, and publish the release as `latest`

The workflows were updated after the earlier `v1.1.36` manual recovery. The old retag path is still documented below as a fallback, but it should no longer be the normal path.

## Preconditions

Before starting, verify:

- the worktree is clean enough to release
- you are on `main`
- your commits are already committed locally
- `origin` points to the fork that should publish the release
- `gh` is authenticated with `repo` and `workflow` scopes

Recommended checks:

```bash
git status -sb
git remote -v
gh auth status
Get-Content package.json
```

Confirm the release target repo explicitly:

```bash
gh workflow list --repo calebrussel77/orca
```

Do not rely on the implicit repo selection from `gh`, because it may resolve to `upstream` instead of the fork.

## Standard Release Flow

### 1. Push `main`

```bash
git push origin main
```

### 2. Trigger `Cut Release`

Patch is the safe default for bug fixes and small UX improvements.

```bash
gh workflow run cut-release.yml --repo calebrussel77/orca --ref main -f release_type=patch
```

Other supported release types from `.github/workflows/cut-release.yml` are:

- `patch`
- `minor`
- `major`
- `prerelease`
- `custom`

### 3. Monitor `Cut Release`

```bash
gh run list --repo calebrussel77/orca --workflow "Cut Release" --limit 1
```

A successful run will:

- bump `package.json`
- create a release commit like `chore(release): 1.1.37`
- push `main`
- create and push a tag like `v1.1.37`
- dispatch `.github/workflows/release.yml` with the new tag name

### 4. Verify the version bump landed

```bash
git fetch origin --tags --prune
git status -sb
git log --oneline -1 origin/main
git tag -l "v*"
```

At this point, `origin/main` should contain the new `chore(release): X.Y.Z` commit and the new tag should exist on `origin`.

### 5. Confirm the `Release` workflow started

```bash
gh run list --repo calebrussel77/orca --workflow "Release" --limit 5 --json databaseId,displayTitle,headBranch,status,conclusion,url
```

Expected sign:

- a new run appears for the new version tag
- `displayTitle` matches the release commit, for example `chore(release): 1.1.37`
- the run can be triggered either by `workflow_dispatch` or by `push`, but the explicit dispatch from `Cut Release` is now the authoritative path

## Standard Publish Behavior

When the workflow is healthy:

- `create-release` creates or reuses the draft release for the tag
- the matrix build uploads Linux and Windows artifacts
- `publish-release` publishes the draft automatically
- non-prerelease releases are marked `latest` automatically
- prereleases stay prereleases and are not marked `latest`

## Legacy Gotcha: `Cut Release` May Still Fail To Start `Release`

This happened for `v1.1.36` before the workflows were updated, and the recovery path remains useful if GitHub dispatching or permissions ever regress.

Legacy symptoms:

- `Cut Release` succeeded
- the new tag exists on `origin`
- `origin/main` advanced to the new release commit
- but no new `Release` workflow run appears
- `gh release view vX.Y.Z --repo calebrussel77/orca` returns `release not found`

Useful checks:

```bash
gh run list --repo calebrussel77/orca --workflow "Release" --limit 5
gh release view v1.1.36 --repo calebrussel77/orca
git ls-remote --tags origin "v*"
```

### Why this used to happen

`Cut Release` pushes the tag from GitHub Actions. Depending on GitHub's workflow-trigger rules, that bot-driven tag push may not start the second workflow that listens on `push.tags`.

The current workflow avoids relying on that behavior by dispatching `release.yml` explicitly with the new tag name.

## Recovery Flow If `Release` Still Does Not Start

If `Cut Release` created the commit and tag but `Release` still did not start, use this recovery path.

### 1. Fast-forward local `main` to the release commit

```bash
git pull --ff-only origin main
```

Verify HEAD is the release commit:

```bash
git log --oneline -1
```

Example expected output:

```text
a2bf9fc chore(release): 1.1.37
```

### 2. Delete the remote tag and local tag

Only do this if:

- the release draft does not exist yet, or
- the `Release` workflow did not start for that tag

Commands:

```bash
git push origin :refs/tags/v1.1.37
git tag -d v1.1.37
```

### 3. Recreate the tag locally on the release commit

```bash
git tag v1.1.37 a2bf9fcf55f83c3b54723b05a83d73b6e7b8157d
```

You can also tag `HEAD` directly if you are already on the release commit:

```bash
git tag v1.1.37 HEAD
```

### 4. Push the tag from the local machine

```bash
git push origin v1.1.37
```

This local tag push should trigger `.github/workflows/release.yml` through the `push.tags` path even if the explicit dispatch path failed.

### 5. Confirm the `Release` workflow started

```bash
gh run list --repo calebrussel77/orca --workflow "Release" --limit 5 --json databaseId,displayTitle,headBranch,status,conclusion,url
```

Expected sign:

- a new run appears with `headBranch: "v1.1.37"`

## Monitor the Release Workflow

Recommended commands:

```bash
gh run list --repo calebrussel77/orca --workflow "Release" --limit 1 --json status,conclusion,url,displayTitle
gh api repos/calebrussel77/orca/actions/runs/<run-id>/jobs
gh release view v1.1.37 --repo calebrussel77/orca
```

When the workflow is working correctly, the release usually appears first as a draft, then assets show up progressively.

Typical Linux assets:

- `latest-linux.yml`
- `orca-linux.AppImage`
- `orca_<version>_amd64.deb`

The Windows assets can still be in flight while the release already exists.

## Manual Publish Fallback

The workflow now publishes non-prerelease releases automatically. Only use this section if the draft exists and `publish-release` did not finish the job.

```bash
gh release edit v1.1.37 --repo calebrussel77/orca --draft=false --latest
```

Only do this for a stable release. Do not force a prerelease to `latest`.

Important note:

- publishing early makes the release visible as `latest` immediately
- if the workflow is still uploading assets, users may briefly see a release that does not yet contain every artifact

Use this only when that tradeoff is acceptable.

## Final Verification

Verify the release page:

```bash
gh release view v1.1.37 --repo calebrussel77/orca
```

Expected:

- `draft: false`
- `prerelease: false`
- `published:` has a timestamp
- the URL is `https://github.com/calebrussel77/orca/releases/tag/v1.1.37`

Verify GitHub's `latest` endpoint:

```bash
gh api repos/calebrussel77/orca/releases/latest
```

Expected:

- `tag_name` is `v1.1.37`

If you want a quick human-readable check:

```bash
gh release list --repo calebrussel77/orca --limit 5
```

## Minimal Checklist

Use this condensed checklist when you already know the flow:

1. `git push origin main`
2. `gh workflow run cut-release.yml --repo calebrussel77/orca --ref main -f release_type=patch`
3. confirm the release commit and tag were created
4. confirm `Release` started for the new tag
5. wait for the draft and assets to appear
6. verify `gh api repos/calebrussel77/orca/releases/latest`
7. if `Release` did not start, use the legacy retag recovery path

## Notes for Future Agents

- Always use `--repo calebrussel77/orca` with `gh` commands during release work.
- Do not assume `gh` is targeting the fork automatically.
- Do not publish a prerelease as `latest`.
- If you recreate a tag, make sure it points to the release commit and not to a pre-release commit.
- Prefer `git pull --ff-only origin main` before retagging so the local branch matches the actual release commit.
- The normal path should no longer require deleting and recreating tags manually.

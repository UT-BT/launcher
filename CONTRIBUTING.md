# Contributing to UTBT Launcher

Thanks for contributing to this project.

This repository uses a protected branch workflow to keep integration and
production releases predictable. All work lands on `staging` first; `main` only
moves forward by promoting `staging` at release time.

## Prerequisites
- Node.js (v20 or higher)
- npm

## Installation
Clone the repository and install dependencies:

```bash
git clone https://github.com/ut-bt/launcher.git
cd launcher

npm install
```

## Development
Starting the dev server:

```bash
npm run dev
```

This will start the Electron app with hot-reload enabled.

If `npm run dev` fails with an Electron install/uninstall error after a fresh clone,
reinstall Electron with:

```bash
npx install-electron --no
npm run dev
```

## Building for Production
Windows is the only supported target:

```bash
npm run build:win
```

Distribution files will be located in the `dist` directory.

## Branches

| Branch                          | Purpose                                  | Who updates it                                     |
| ------------------------------- | ---------------------------------------- | -------------------------------------------------- |
| `main`                          | Production-ready releases                | Organizational admins, through a PR from `staging` |
| `staging`                       | Shared integration branch                | Contributors, through PRs only                     |
| `feature/*`, `fix/*`, `chore/*` | Short-lived development branches         | Individual contributors                            |
| `release/*`                     | Short-lived release preparation branches | Organizational admins                              |

Do not push directly to `staging` or `main`. Both branches are protected by GitHub rulesets — changes must be made through pull requests.

## Normal contribution workflow

Start from the latest `staging` branch:

```bash
git fetch origin --prune
git switch staging
git pull --ff-only origin staging
```

Create a branch for your work:

```bash
git switch -c feature/my-feature
```

Use a meaningful prefix:

```text
feature/add-login-screen
fix/handle-invalid-token
chore/update-dependencies
docs/improve-install-guide
```

Make your changes, then commit them:

```bash
git add .
git commit -m "feat: add login screen"
```

Push your branch:

```bash
git push -u origin feature/my-feature
```

Open a pull request with:

```text
Base branch:    staging
Compare branch: feature/my-feature
```

All pull requests into `staging` must use **Squash and merge**.

## Pull request expectations

Before opening a PR:

* Keep the change focused on one concern.
* Run the relevant checks locally.
* Avoid unrelated formatting changes or drive-by refactors.
* Describe what changed and why.
* Resolve merge conflicts before requesting review.

Use clear PR titles. Prefer Conventional Commit-style wording where practical:

```text
feat: add launcher auto-update support
fix: handle expired authentication tokens
chore: upgrade Electron dependencies
docs: document local development setup
```

## Local verification

Run the project checks before opening a pull request. Verification is lint plus a production build:

```bash
npm ci
npm run lint
npm run build:win
```

Use the commands defined by this repository's `package.json`. Do not assume a
successful build is enough if linting also reports problems.

## Using Git worktrees

Git worktrees are recommended when working on multiple branches at once.

Create a new worktree for a feature branch based on the remote `staging` branch:

```bash
git fetch origin --prune

git worktree add \
  -b feature/my-feature \
  ../worktrees/my-feature \
  origin/staging
```

On PowerShell:

```powershell
git fetch origin --prune

git worktree add `
  -b feature/my-feature `
  ..\worktrees\my-feature `
  origin/staging
```

Then work from the new directory:

```bash
cd ../worktrees/my-feature
```

Commit and push normally:

```bash
git add .
git commit -m "feat: add my feature"
git push -u origin feature/my-feature
```

Open a pull request into `staging`.

### Important: do not create a worktree directly on `staging` for development

Avoid this for normal work:

```bash
git worktree add --track -b staging ../worktrees/my-work origin/staging
```

That checks out the actual local `staging` branch. If you commit changes there,
GitHub will reject a direct push because `staging` can only be updated through a
pull request.

Always create a new branch from `origin/staging`:

```bash
git worktree add -b feature/my-feature ../worktrees/my-feature origin/staging
```

When finished and after your PR is merged:

```bash
git worktree remove ../worktrees/my-feature
git branch -d feature/my-feature
```

If Git refuses to delete the branch because it is still checked out in a worktree,
remove the worktree first.

## Integration workflow

The shared integration flow is:

```text
feature/fix/chore branch
        ↓
Pull request into staging
        ↓
Squash and merge
        ↓
Staging deployment and validation
```

`staging` should always represent the current integrated candidate for the next
release.

Do not merge `main` back into `staging` as part of ordinary development.
Production releases are promoted from `staging` to `main`, preserving the release
path.

## Release workflow

Releases are prepared on a dedicated branch created from `staging`. CI is
triggered by Git tags like `v1.7.0`.

Example for version `1.7.0`:

```bash
git fetch origin --prune
git switch staging
git pull --ff-only origin staging

git switch -c release/v1.7.0

npm ci
npm run lint
npm run build:win

npm --no-git-tag-version version 1.7.0

git add package.json package-lock.json
git commit -m "chore(release): v1.7.0"

git push -u origin release/v1.7.0
```

Open a pull request:

```text
Base branch:    staging
Compare branch: release/v1.7.0
```

Merge this PR using **Squash and merge**.

After the release candidate has been validated and approved from `staging`, an
authorized org admin opens:

```text
Base branch:    main
Compare branch: staging
```

This promotion uses a **merge commit**, not squash merge.

The merge commit on `main` is the production release commit and should receive the
release tag:

```bash
git switch main
git pull --ff-only origin main

git tag v1.7.0 -m "Release v1.7.0"
git push origin v1.7.0
```

Pushing the tag triggers the GitHub Actions workflow, which builds the Windows
installer and creates a GitHub Release with the artifacts (`.exe`, `.blockmap`,
`latest.yml`).

### Prereleases

Use a hyphenated prerelease version and tag, e.g.:

```bash
npm --no-git-tag-version version 1.7.0-rc.1
git commit -am "chore(release): v1.7.0-rc.1"

git tag v1.7.0-rc.1 -m "Release v1.7.0-rc.1"
git push origin v1.7.0-rc.1
```

The workflow automatically marks such releases as prereleases and avoids setting
them as "latest".

### Notes

- `npm version` updates both `package.json` and `package-lock.json`.
- Release tags and GitHub Releases are created only through the approved release
  workflow or release automation.
- Artifact names are derived from `electron-builder.yml` and the `package.json`
  version.

## What not to do

Do not push directly to protected branches:

```bash
git push origin HEAD:staging
git push origin HEAD:main
```

These commands are intentionally rejected by repository rules.

Do not run `npm version` directly on `main`. Version changes must be committed on a
release branch, merged into `staging`, validated, and then promoted to `main`.

Do not create release tags from feature branches, local unmerged commits, or
arbitrary `staging` commits. Tags must identify the exact production merge commit
on `main`.

Do not force-push shared branches:

```bash
git push --force origin staging
git push --force origin main
```

## Getting help

For questions about architecture, release process, or branch protection, open a
discussion or ask a maintainer before bypassing the normal workflow.

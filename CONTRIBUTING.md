# Contributing to UTBT Launcher

Thanks for contributing to this project.

This repository uses a protected branch workflow to keep integration and
production releases predictable. All work lands on `staging` first; `main` only
moves forward by promoting `staging` at release time.

## Prerequisites
- Node.js (v22 or higher)
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
| `main`                          | Production-ready releases                | Organizational admins, fast-forwarded from `staging` |
| `staging`                       | Shared integration branch                | Contributors, through PRs only                     |
| `feature/*`, `fix/*`, `chore/*` | Short-lived development branches         | Individual contributors                            |
| `release/*`                     | Short-lived release preparation branches | Organizational admins                              |

`staging` is protected by a GitHub ruleset and can only be updated through
**Squash and merge** pull requests. `main` is protected too: it is never used for
development and only ever moves by an organization admin **fast-forwarding it to
`staging`** at release time (see [Release workflow](#release-workflow)).

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

Never merge `main` back into `staging`, and never squash-merge `staging` into
`main`. Releases only ever flow one way — `main` fast-forwards to `staging` — so
the two branches stay aligned. A back-merge or squash rewrites that shared history
into a divergent commit and is exactly what knocks the ahead/behind counts out of
sync.

## Release workflow

The release path is intentionally simple. Everything integrates on `staging`; a
release is just **fast-forwarding `main` up to `staging`**, which CI turns into a
build and a published GitHub Release.

```text
feature/fix branch ──PR (squash)──▶ staging   (repeat as often as needed)
                                       │
                        bump version via a release PR
                                       │
                       fast-forward main to staging   ◀── triggers the build
                                       │
                          GitHub Release published
```

Because `main` only ever fast-forwards to `staging`, the two branches never
diverge: right after a release they point at the same commit, and between releases
`main` simply trails `staging` by the unreleased commits.

### 1. Land your changes on `staging`

Follow the [normal contribution workflow](#normal-contribution-workflow): open
`feature/*` / `fix/*` PRs into `staging` and **Squash and merge** them. Repeat
until `staging` holds everything you want to ship.

### 2. Cut the release on `staging`

Bump the version with a short-lived release branch, then PR it into `staging`:

```bash
git fetch origin --prune
git switch -c release/v1.7.0 origin/staging

npm ci
npm run lint
npm run build:win

npm --no-git-tag-version version 1.7.0
git commit -am "chore(release): v1.7.0"

git push -u origin release/v1.7.0
```

Open a pull request (Base: `staging`, Compare: `release/v1.7.0`) and **Squash and
merge** it. `staging` now carries the bumped `package.json` version — the single
source of truth the build reads.

### 3. Promote to `main` (this publishes the release)

An organization admin fast-forwards `main` to `staging`:

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git merge --ff-only origin/staging
git push origin main
```

Pushing `main` triggers the **Build and Release Windows Installer** workflow. It
reads the version from `package.json`, tags the commit `vX.Y.Z`, builds the Windows
installer, and publishes a GitHub Release with the artifacts (`.exe`, `.blockmap`,
`latest.yml`). There is no manual tag step — bumping the version in step 2 and
promoting in step 3 is all it takes.

Confirm it started:

```bash
gh run list --workflow "Build and Release Windows Installer" --limit 1
```

The release is done when that run is green and the GitHub Release carries the three
artifacts.

> The fast-forward in step 3 keeps `main` and `staging` identical after a release.
> Never **squash** or **back-merge** `main` into `staging` to "sync" them — that
> rewrites history into a divergent commit and breaks the ahead/behind alignment.

### Notes

- `npm version` updates both `package.json` and `package-lock.json`.
- Releases must use a stable `X.Y.Z` version. Use the `staging` branch for
  pre-release testing.
- The build reads the version from `package.json`; the matching `vX.Y.Z` tag and
  GitHub Release are created automatically by CI. Do not create release tags by
  hand.
- If a push to `main` does not bump the version, its tag already exists and the
  workflow exits without publishing a duplicate release.
- Artifact names are derived from `electron-builder.yml` and the `package.json`
  version.

## What not to do

Do not push development work directly to `staging`:

```bash
git push origin HEAD:staging
```

It is rejected by the ruleset — land changes through a **Squash and merge** PR.
The only writes to `main` are an org admin fast-forwarding it to `staging` during
a release; never push feature work or arbitrary commits to `main`.

Do not run `npm version` directly on `main`. The version is bumped on a
`release/*` branch and merged into `staging`; `main` only inherits it by
fast-forward.

Do not create release tags by hand. CI tags `vX.Y.Z` from `package.json` when
`main` is promoted — a manual tag is never needed and can collide with the
automated one.

Do not force-push shared branches:

```bash
git push --force origin staging
git push --force origin main
```

## Getting help

For questions about architecture, release process, or branch protection, open a
discussion or ask a maintainer before bypassing the normal workflow.

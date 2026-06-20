# UTBT Launcher
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

## Branching Model
All work lands on `staging` first. `main` only ever moves forward by merging
`staging` at release time, and every release is a tag on a `main` merge commit.

```
feature/*       ──squash PR──>  staging
release/vX.Y.Z  ──squash PR──>  staging
staging         ──merge PR───>  main
main merge      ──tag + GitHub Release──>  vX.Y.Z
```

- **`feature/*`** — one branch per change. Open a PR into `staging` and merge it
  with **Squash and merge**.
- **`release/vX.Y.Z`** — short-lived branch holding only the version bump. PR into
  `staging`, merged with **Squash and merge**.
- **`staging`** — integration branch; the default base for every feature/release PR.
- **`main`** — release branch. Updated only by a PR from `staging`, merged with a
  **Merge commit** (not squash) so the tagged commit reflects the real history.

## Release Process
Cut a release by promoting `staging` to `main` and tagging the resulting merge
commit. CI is triggered by Git tags like `v0.4.0`.

1) Bump the version on a `release/*` branch off `staging`

```bash
git fetch origin
git switch staging
git pull --ff-only origin staging

git switch -c release/vX.Y.Z
npm version X.Y.Z --no-git-tag-version

git add package.json package-lock.json
git commit -m "chore: bump version to X.Y.Z"
git push -u origin release/vX.Y.Z
```

Open a PR from `release/vX.Y.Z` into `staging` and **Squash and merge** it.

2) Promote `staging` to `main`

Open a PR from `staging` into `main` and merge it with a **Merge commit**
(do not squash).

3) Tag the merge commit on `main` to trigger the release

```bash
git switch main
git pull --ff-only origin main

git tag vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

This tag triggers the GitHub Actions workflow, which builds the Windows installer
and creates a GitHub Release with the artifacts (`.exe`, `.blockmap`, `latest.yml`).

### Prereleases
Use a hyphenated prerelease version and tag, e.g.:

```bash
npm version 0.4.0-rc.1 --no-git-tag-version
git commit -am "chore: bump version to X.Y.Z-rc.1"

git tag vX.Y.Z-rc.1 -m "Release vX.Y.Z-rc.1"
git push origin vX.Y.Z-rc.1
```

The workflow will automatically mark such releases as prereleases and avoid setting them as "latest".

### Notes

- `npm version` updates both `package.json` and `package-lock.json`.
- Do not push release tags from feature branches; always tag the merge commit on `main`.
- The `staging` → `main` PR uses a **merge commit**; all other PRs use **squash**.
- Artifact names are derived from `electron-builder.yml` and the `package.json` version.

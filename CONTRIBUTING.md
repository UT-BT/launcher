# UTBT Launcher
## Prerequisites
- Node.js (v20 or higher)
- npm, yarn, pnpm, or bun

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
# Can use any package manager (npm, yarn, pnpm, bun)
npm run dev
```

This will start the Electron app with hot-reload enabled.

## Building for Production
Windows is the only supported target:

```bash
npm run build:win
```

Distribution files will be located in the `dist` directory.

## Release Process
Follow this to publish an official release via GitHub Actions. The CI is triggered by Git tags like `v0.4.0`.

1) Prepare a version bump in a PR (no tag yet)

```bash
npm version X.Y.Z --no-git-tag-version

git add package.json package-lock.json
git commit -m "chore: bump version to X.Y.Z"
git push
```

2) Tag the merge commit on main to trigger the release

```bash
git checkout main
git pull

git tag vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

This tag triggers the GitHub Actions workflow, which builds the Windows installer and creates a GitHub Release with the artifacts (`.exe`, `.blockmap`, `latest.yml`).

### Prereleases
Use a hyphenated prerelease version and tag, e.g.:

```bash
npm version 0.4.0-rc.1 --no-git-tag-version
git commit -am "chore: bump version to 0.4.0-rc.1"

git tag v0.4.0-rc.1 -m "Release v0.4.0-rc.1"
git push origin v0.4.0-rc.1
```

The workflow will automatically mark such releases as prereleases and avoid setting them as "latest".

### Notes

- `npm version` updates both `package.json` and `package-lock.json`.
- Do not push release tags from feature branches; always tag the merge on `main`.
- Artifact names are derived from `electron-builder.yml` and the `package.json` version.

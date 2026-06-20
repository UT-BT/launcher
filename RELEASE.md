# Releasing UTBT Launcher
## Get latest
git fetch origin
git switch staging
git pull --ff-only origin staging

git switch -c release/vX.Y.Z

## Create the tag on npm and push
npm --no-git-tag-version version X.Y.Z
git add package.json package-lock.json

git commit -m "chore: bump version to X.Y.Z"
git push -u origin release/vX.Y.Z

Create a merge commit to main
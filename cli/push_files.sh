#!/usr/bin/env bash
set -e

# Usage: push_files.sh <owner> <repo> [source_dir]
OWNER=${1:-$GITHUB_USER}
REPO=${2?Usage: push_files.sh <owner> <repo>}
SRC_DIR=${3:-.}

# Check source directory
if [ ! -d "$SRC_DIR" ]; then
  echo "Source directory $SRC_DIR does not exist."
  exit 1
fi

# Temporary folder for clone
TMP_DIR=$(mktemp -d)
echo "Cloning ${OWNER}/${REPO} into $TMP_DIR ..."

# Clone repo (shallow)
git clone --depth 1 "git@github.com:${OWNER}/${REPO}.git" "$TMP_DIR" || {
  echo "Clone failed; creating repo ${OWNER}/${REPO} first..."
  ./create_repo.sh "$OWNER" "$REPO"
  git clone "git@github.com:${OWNER}/${REPO}.git" "$TMP_DIR"
}

# Copy all files from source to temp repo (overwrite)
cp -r "${SRC_DIR}/." "$TMP_DIR/"

cd "$TMP_DIR"

# Configure git if not already set
git config user.name "${GITHUB_USER:-auto-user}"
git config user.email "${GITHUB_EMAIL:-auto@example.com}"

git add -A

# Commit only if there are changes
if ! git diff --cached --quiet; then
  git commit -m "Add/update generated app files"
  git push origin main
  echo "✅ Pushed files to ${OWNER}/${REPO}"
else
  echo "ℹ️ No changes to commit."
fi

# Cleanup
cd -
rm -rf "$TMP_DIR"

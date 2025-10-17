#!/usr/bin/env bash
set -e

# Usage: create_repo.sh <owner> <repo>
OWNER=${1:-$GITHUB_USER}
REPO=${2?Usage: create_repo.sh <owner> <repo>}

# Directory check
CURRENT_DIR=$(pwd)
echo "Working in directory: $CURRENT_DIR"

# 1️⃣ Create GitHub repo (public)
echo "Creating repo ${OWNER}/${REPO} on GitHub..."
gh repo create "${OWNER}/${REPO}" --public --source=. --confirm || true

# 2️⃣ Add README.md if not exists
if [ ! -f README.md ]; then
  echo "# ${REPO}" > README.md
  echo "README.md created."
fi

# 3️⃣ Add full MIT LICENSE if not exists
if [ ! -f LICENSE ]; then
  YEAR=$(date +"%Y")
  cat <<EOL > LICENSE
MIT License

Copyright (c) $YEAR $OWNER

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOL
  echo "LICENSE created."
fi

# 4️⃣ Commit and push
git init 2>/dev/null || true
git add README.md LICENSE || true
git commit -m "Initial commit with README and LICENSE" || true
git branch -M main
git remote remove origin 2>/dev/null || true
git remote add origin "git@github.com:${OWNER}/${REPO}.git"
git push -u origin main --force

# 5️⃣ Enable GitHub Pages
echo "Enabling GitHub Pages..."
gh api -X POST /repos/${OWNER}/${REPO}/pages -f source='{"branch":"main","path":"/"}' || true

echo "✅ Repository ${OWNER}/${REPO} is ready with README, MIT license, and GitHub Pages enabled."

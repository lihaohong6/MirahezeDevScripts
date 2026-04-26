#!/usr/bin/env bash
DIST_DIR="dist"
TARGET_BRANCH="dist"
GH_PAGE_BRANCH="github-pages"
npm run build && npx grunt json-minify
TEMP_DIR=$(mktemp -d)
cp -r "$DIST_DIR" "$TEMP_DIR/dist"

# Deploy
git switch "$TARGET_BRANCH"
rm -r "$DIST_DIR"
cp -r "$TEMP_DIR/dist" "$DIST_DIR"
git add .
git commit -m "Recompile gadget"
git push

# Push new tag
if [[ -v NEW_TAG ]]; then
  git tag -a "$NEW_TAG" -m "Build & deploy at timestamp: $NEW_TAG"
  git push origin $NEW_TAG
fi

# GitHub Pages
INDEX_HTML="$TEMP_DIR/dist/index.html"
if [ -f "$INDEX_HTML" ]; then
  echo "Deploying index.html to GitHub Pages."
  git switch "$GH_PAGE_BRANCH"
  cp "$INDEX_HTML" .
  git add .
  git commit -m "Update list of gadgets"
  git push
else
  echo "Unable to find file index.html."
fi

git switch master
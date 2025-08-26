#!/usr/bin/env bash
DIST_DIR="dist"
TARGET_BRANCH="dist"
npm run build
TEMP_DIR=$(mktemp -d)
cp -r "$DIST_DIR" "$TEMP_DIR/dist"
git switch "$TARGET_BRANCH"
rm -r "$DIST_DIR"
cp -r "$TEMP_DIR/dist" "$DIST_DIR"
git add .
git commit -m "Recompile gadget"
git push
git switch master


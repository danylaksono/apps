#!/usr/bin/env bash
set -euo pipefail

# This script prepares the `deploy/` directory for GitHub Pages.
#
# It detects root-level subdirectories and:
#  - If a directory contains a package.json and a build script, it runs npm ci + npm run build.
#  - If it then contains a `dist/` directory, it copies that into deploy/<project>.
#  - Otherwise it copies the directory contents as-is.
#
# The script is safe to run repeatedly.

ROOT=$(pwd)
DEPLOY_DIR="$ROOT/deploy"

rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

# Copy top-level landing page
cp -f "$ROOT/index.html" "$DEPLOY_DIR/"

# Determine which directories should be treated as "projects".
# Exclude known meta / infra dirs.
IGNORED=(".git" ".github" "deploy" "scripts" "archive")

for dir in */; do
  # remove trailing slash
  dir=${dir%/}

  # Skip ignored dirs
  skip=false
  for ignore in "${IGNORED[@]}"; do
    if [[ "$dir" == "$ignore" ]]; then
      skip=true
      break
    fi
  done
  $skip && continue

  echo "[deploy] processing $dir..."
  cd "$ROOT/$dir"

  if [[ -f package.json ]]; then
    # Install & build if there is a build script
    if grep -q '"build"' package.json; then
      echo "[deploy]   running npm ci && npm run build"
      npm ci
      npm run build
    fi
  fi

  # Copy output
  mkdir -p "$DEPLOY_DIR/$dir"
  if [[ -d dist ]]; then
    echo "[deploy]   copying dist -> deploy/$dir"
    cp -R dist/* "$DEPLOY_DIR/$dir/"
  else
    echo "[deploy]   copying project files -> deploy/$dir"
    # Copy everything except node_modules, .git, and build artifacts
    rsync -a --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude 'deploy' --exclude 'scripts' ./ "$DEPLOY_DIR/$dir/"
  fi

done

# Always include the archive folder (static copy)
if [[ -d "$ROOT/archive" ]]; then
  echo "[deploy] copying archive/ -> deploy/archive/"
  rm -rf "$DEPLOY_DIR/archive"
  cp -R "$ROOT/archive" "$DEPLOY_DIR/"
fi

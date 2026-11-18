#!/usr/bin/env bash
# deploy/deploy.sh - deploy KUIPER on the VPS (run as the user that owns the app and PM2)
#
#   bash deploy/deploy.sh
#
# What it does:
#   1. pulls origin/main into the repo checkout
#   2. installs backend + frontend dependencies (npm ci, from the lock files)
#   3. builds the frontend into a NEW folder: releases/<timestamp>
#      (the live site keeps serving the previous build the whole time)
#   4. copies the previous build's /assets into the new one, so browser tabs opened
#      before the deploy can still load the lazy page chunks they reference
#   5. switches the "current" symlink atomically -> nginx serves the new build
#   6. pm2 reload (graceful) instead of killing port 5000
#   7. keeps the last 5 builds, so a rollback is just pointing the symlink back
#
# Adjust these to your server:
REPO_DIR="${REPO_DIR:-/var/www/kuiper/app}"        # git checkout (contains backend/ and frontend/)
WEB_DIR="${WEB_DIR:-/var/www/kuiper}"              # nginx root is $WEB_DIR/current
BRANCH="${BRANCH:-main}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"

set -euo pipefail

RELEASES="$WEB_DIR/releases"
CURRENT="$WEB_DIR/current"
STAMP="$(date +%Y%m%d-%H%M%S)"
NEW_RELEASE="$RELEASES/$STAMP"

echo "==> Deploying $BRANCH into $NEW_RELEASE"
mkdir -p "$RELEASES"

# 1. code
cd "$REPO_DIR"
git fetch --prune origin
git reset --hard "origin/$BRANCH"

# 2. backend dependencies (devDependencies are only test/seed tools)
cd "$REPO_DIR/backend"
npm ci --omit=dev

# 3. frontend build into the new release folder (dist is not touched while live)
cd "$REPO_DIR/frontend"
npm ci
npx vite build --outDir "$NEW_RELEASE" --emptyOutDir
# precompressed .gz/.br copies for nginx gzip_static / brotli_static
node scripts/precompress.mjs "$NEW_RELEASE"

# sanity check before switching
test -s "$NEW_RELEASE/index.html" || { echo "build has no index.html - aborting, site unchanged"; exit 1; }

# 4. keep the previous build's hashed chunks available for already-open tabs
if [ -L "$CURRENT" ] && [ -d "$CURRENT/assets" ]; then
  cp -n "$CURRENT"/assets/* "$NEW_RELEASE/assets/" 2>/dev/null || true
fi

# 5. atomic switch: create the new link next to the old one, then rename over it
ln -sfn "$NEW_RELEASE" "$CURRENT.tmp"
mv -Tf "$CURRENT.tmp" "$CURRENT"
echo "==> Frontend now serving $NEW_RELEASE"

# 6. API: graceful reload with the PM2 config (first deploy: start it)
cd "$REPO_DIR"
if pm2 describe kuiper-backend >/dev/null 2>&1; then
  pm2 reload ecosystem.config.js --update-env
else
  pm2 start ecosystem.config.js
fi
pm2 save

# 7. prune old builds (never the one that is live)
LIVE="$(readlink -f "$CURRENT")"
ls -1dt "$RELEASES"/*/ 2>/dev/null | tail -n +"$((KEEP_RELEASES + 1))" | while read -r old; do
  [ "$(readlink -f "$old")" = "$LIVE" ] || rm -rf "$old"
done

echo "==> Done. Rollback: ln -sfn $RELEASES/<older> $CURRENT.tmp && mv -Tf $CURRENT.tmp $CURRENT"

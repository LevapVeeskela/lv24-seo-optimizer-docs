#!/usr/bin/env bash
# Uploads an already-built docs/.vitepress/dist to the production vhost root.
#
# usage: scripts/upload-prod.sh [ssh-host]      (default host: lv24)
#
# Build first (on Windows use the normal npm scripts):
#   DOCS_SITE_URL=https://seo.lv24.by npm run docs:build
#
# This path does not run npm ci, lint, tests, or the CSP hash check. Use
# scripts/deploy-prod.sh for the gated deploy.
#
# The previous directory is kept as root.prev-<ts> for rollback.
set -euo pipefail

HOST="${1:-lv24}"
SITE_URL="${DOCS_SITE_URL:-https://seo.lv24.by}"
SITE_URL="${SITE_URL%/}"
SITE_ROOT=/opt/lv24-sites/lv24-seo-site
ARCHIVE=lv24-seo-docs.tgz

cd "$(dirname "$0")/.."

if [ ! -f docs/.vitepress/dist/index.html ]; then
  echo "docs/.vitepress/dist/index.html is missing; run the build first." >&2
  exit 1
fi

tar -czf "/tmp/$ARCHIVE" -C docs/.vitepress/dist .
scp "/tmp/$ARCHIVE" "$HOST:/tmp/$ARCHIVE"
rm -f "/tmp/$ARCHIVE"

ssh "$HOST" "sudo bash -s" <<EOF
set -euo pipefail
[ -d "$SITE_ROOT" ] || { echo "missing $SITE_ROOT; create it first (deploy/README.md)" >&2; exit 1; }
rm -rf "$SITE_ROOT/root.new"
mkdir -p "$SITE_ROOT/root.new"
tar -C "$SITE_ROOT/root.new" -xzf /tmp/$ARCHIVE
chmod -R a+rX "$SITE_ROOT/root.new"
chmod -R go-w "$SITE_ROOT/root.new"
cd "$SITE_ROOT"
ts=\$(date -u +%Y%m%dT%H%M%SZ)
if [ -d root ]; then mv root "root.prev-\$ts"; fi
if ! mv root.new root; then
  if [ -d "root.prev-\$ts" ]; then mv "root.prev-\$ts" root; fi
  echo "swap failed; restored the previous root" >&2
  exit 1
fi
rm -f /tmp/$ARCHIVE
echo "uploaded -> $SITE_ROOT/root (previous: root.prev-\$ts, if any)"
EOF

curl -fsS -o /dev/null "$SITE_URL/"
curl -fsS -o /dev/null "$SITE_URL/ru/"
curl -fsS -o /dev/null "$SITE_URL/zh/"
curl -fsS -o /dev/null "$SITE_URL/reference/cli/"
echo "verified $SITE_URL/"

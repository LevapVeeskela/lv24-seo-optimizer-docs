#!/usr/bin/env bash
# Deploys the LV24 SEO Optimizer docs to https://seo.lv24.by/ (LV24 edge
# nginx, static).
#
# usage: scripts/deploy-prod.sh [ssh-host]      (default host: lv24)
#
# Builds at the site root, runs the gates, prints the hashes of the stable
# inline scripts and, when deploy/csp-hashes.txt exists, checks that the edge
# CSP still allows every one of them. Uploads dist/ into a staging directory
# and switches the vhost root atomically.
#
# Set DOCS_SITE_URL to build for another origin (default https://seo.lv24.by).
#
# Rollback: restore /opt/lv24-sites/lv24-seo-site/root.prev-<ts>; see
# deploy/README.md.
set -euo pipefail

HOST="${1:-lv24}"
SITE_URL="${DOCS_SITE_URL:-https://seo.lv24.by}"
SITE_URL="${SITE_URL%/}"
SITE_ROOT=/opt/lv24-sites/lv24-seo-site
ARCHIVE=lv24-seo-docs.tgz
HASH_FILE=deploy/csp-hashes.txt

cd "$(dirname "$0")/.."

npm ci
DOCS_SITE_URL="$SITE_URL" npm run docs:build
npm run lint
npm test

echo "inline script hashes for the CSP (unique across the built HTML):"
hashes="$(node -e '
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

const hashes = new Set();
for (const file of walk("docs/.vitepress/dist")) {
  const html = fs.readFileSync(file, "utf8");
  const scripts = [
    ...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g),
  ].map((m) => m[1]);
  for (const js of scripts) {
    hashes.add("sha256-" + crypto.createHash("sha256").update(js).digest("base64"));
  }
}
for (const hash of [...hashes].sort()) console.log(hash);
')"
printf '%s\n' "$hashes"

if [ ! -f "$HASH_FILE" ]; then
  printf '%s\n' "$hashes" > "$HASH_FILE"
  echo "wrote $HASH_FILE with the current inline-script hashes"
fi

if [ -f "$HASH_FILE" ]; then
  # Normalize CRLF so a file created on Windows still compares byte-for-byte.
  expected_file="$(mktemp)"
  trap 'rm -f "$expected_file"' EXIT
  tr -d '\r' < "$HASH_FILE" > "$expected_file"

  for hash in $hashes; do
    if ! grep -Fxq -- "$hash" "$expected_file"; then
      echo "CSP hash is missing from $HASH_FILE: $hash" >&2
      echo "Update $HASH_FILE and the CSP in the nginx vhost first." >&2
      exit 1
    fi
  done
  while IFS= read -r expected || [ -n "$expected" ]; do
    case "$expected" in
      '' | '#'*) continue ;;
    esac
    found=0
    for hash in $hashes; do
      [ "$hash" = "$expected" ] && found=1
    done
    if [ "$found" -ne 1 ]; then
      echo "warning: $HASH_FILE lists a hash this build no longer uses: $expected" >&2
    fi
  done < "$expected_file"
else
  echo "warning: $HASH_FILE is missing; skipping the CSP hash check." >&2
  echo "Copy the hashes above into $HASH_FILE and the nginx CSP, then re-run." >&2
fi

tar -czf "/tmp/$ARCHIVE" -C docs/.vitepress/dist .
scp "/tmp/$ARCHIVE" "$HOST:/tmp/$ARCHIVE"
rm -f "/tmp/$ARCHIVE"

ssh "$HOST" "sudo bash -s" <<EOF
set -euo pipefail
rm -rf "$SITE_ROOT/root.new"
mkdir -p "$SITE_ROOT/root.new"
tar -C "$SITE_ROOT/root.new" -xzf /tmp/$ARCHIVE
chmod -R a+rX "$SITE_ROOT/root.new"
chmod -R go-w "$SITE_ROOT/root.new"
cd "$SITE_ROOT"
ts=\$(date -u +%Y%m%dT%H%M%SZ)
if [ -d root ]; then mv root "root.prev-\$ts"; fi
mv root.new root
rm -f /tmp/$ARCHIVE
echo "deployed root -> $SITE_ROOT/root (previous: root.prev-\$ts, if any)"
EOF

curl -fsS -o /dev/null "$SITE_URL/"
curl -fsS -o /dev/null "$SITE_URL/ru/"
curl -fsS -o /dev/null "$SITE_URL/zh/"
curl -fsS -o /dev/null "$SITE_URL/reference/cli/"
echo "verified $SITE_URL/"

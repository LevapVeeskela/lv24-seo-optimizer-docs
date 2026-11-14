# Uploads an already-built docs/.vitepress/dist to the production vhost root.
# Windows counterpart of scripts/upload-prod.sh.
#
#   $env:DOCS_SITE_URL = 'https://seo.lv24.by'; npm run docs:build
#   powershell -File scripts/upload-prod.ps1
#
# This path does not run npm ci, lint, tests, or the CSP hash check. Use
# scripts/deploy-prod.sh (Git Bash/WSL) for the gated deploy.
param([string]$HostName = 'lv24')

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $repo 'docs\.vitepress\dist'
$siteUrl = if ($env:DOCS_SITE_URL) { $env:DOCS_SITE_URL.TrimEnd('/') } else { 'https://seo.lv24.by' }
if (-not (Test-Path (Join-Path $dist 'index.html'))) {
    throw 'docs/.vitepress/dist/index.html is missing; run npm run docs:build first.'
}

$tar = Join-Path $env:TEMP 'lv24-seo-docs.tgz'
$swap = Join-Path $env:TEMP 'lv24-seo-docs-swap.sh'
if (Test-Path $tar) { Remove-Item $tar -Force }

tar -czf $tar -C $dist .
scp $tar "${HostName}:/tmp/lv24-seo-docs.tgz"

@'
#!/usr/bin/env bash
set -euo pipefail
SITE_ROOT=/opt/lv24-sites/lv24-seo-site
[ -d "$SITE_ROOT" ] || { echo "missing $SITE_ROOT; create it first (deploy/README.md)" >&2; exit 1; }
rm -rf "$SITE_ROOT/root.new"
mkdir -p "$SITE_ROOT/root.new"
tar -C "$SITE_ROOT/root.new" -xzf /tmp/lv24-seo-docs.tgz
chmod -R a+rX "$SITE_ROOT/root.new"
chmod -R go-w "$SITE_ROOT/root.new"
cd "$SITE_ROOT"
ts=$(date -u +%Y%m%dT%H%M%SZ)
if [ -d root ]; then mv root "root.prev-$ts"; fi
if ! mv root.new root; then
  if [ -d "root.prev-$ts" ]; then mv "root.prev-$ts" root; fi
  echo "swap failed; restored the previous root" >&2
  exit 1
fi
rm -f /tmp/lv24-seo-docs.tgz
echo "uploaded -> $SITE_ROOT/root (previous: root.prev-$ts, if any)"
'@ | ForEach-Object { [IO.File]::WriteAllText($swap, $_, (New-Object System.Text.UTF8Encoding($false))) }

scp $swap "${HostName}:/tmp/lv24-seo-docs-swap.sh"
ssh $HostName "sudo bash /tmp/lv24-seo-docs-swap.sh"

Remove-Item $tar, $swap -Force -ErrorAction SilentlyContinue

foreach ($path in @('/', '/ru/', '/zh/', '/reference/cli/')) {
    $url = "$siteUrl$path"
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30
    if ($response.StatusCode -ne 200) { throw "$url returned $($response.StatusCode)" }
}
Write-Host "verified $siteUrl/"

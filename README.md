# LV24 SEO Optimizer docs

Static documentation portal for LV24 SEO Optimizer (engine: Apache-2.0).
VitePress 1.6.4 + TypeScript config, npm, static build, no server runtime, no
external fonts, CDNs, analytics, or paid services.

Deployment target: <https://seo.lv24.by/> (DNS, the certificate and the edge
vhost are provisioned at deploy time; see [`deploy/README.md`](deploy/README.md)).
The site ships English at `/`, Russian at
`/ru/`, and Simplified Chinese at `/zh/`. Every page exists in all three
locales with identical commands and code blocks (`npm test` enforces this), and
the pages carry `hreflang` alternates.

## Coverage

| Section | Routes | What it covers |
|---|---|---|
| Start | `/start/`, `/install/`, `/desktop/` | First run, engine/npm/desktop install, desktop features and update matrix |
| Use | `/providers/`, `/reports/`, `/crawl/`, `/automation/`, `/mcp/` | Provider capabilities, weekly reports/diffs, crawl rules, scheduling/delivery, MCP tools and skills |
| Operate | `/security/`, `/architecture/`, `/troubleshooting/`, `/release/` | Secrets and write gates, engine/desktop architecture, diagnostics, release/update pipeline |
| Reference | `/reference/cli/`, `/reference/config/`, `/faq/` | Filterable CLI table, `seo.toml` keys, 20 common questions |

The documented product surface today:

| Surface | Count |
|---|---|
| CLI | 17 command groups, every command with `--json` |
| MCP | 11 tools, 3 resources, 3 prompts |
| Skills | 3 canonical skills (`seo-weekly`, `seo-indexing-triage`, `seo-technical-audit`) |
| Desktop | Windows NSIS/portable, Linux AppImage/deb/rpm, macOS DMG; signed updates for NSIS, `.app` and AppImage |
| Automation | cron, systemd timer, Windows Task Scheduler, SMTP and Telegram delivery |

## Quick start

Node.js >= 20 (see `engines` in `package.json`); `npm ci` requires the committed
`package-lock.json`.

```sh
npm ci
npm run docs:dev      # local authoring preview
npm run docs:build    # static build to docs/.vitepress/dist
npm run docs:preview  # serve the built site locally
npm run lint          # markdownlint-cli2 over docs/**/*.md
npm run test          # node ./scripts/check.mjs (links, locale parity, frontmatter, CLI data, sidebar, source map)
```

The build runs `scripts/postbuild.mjs` after VitePress: it moves VitePress's
per-build inline data script (when present) into `assets/vp-data.<hash>.js` and
writes `version.json`, which the "documentation updated" prompt polls without
caching.

## Deploy

Production is the containerized `lv24-city-edge-nginx`; the exact vhost and
site bind wiring is in [`deploy/vps-edge.md`](deploy/vps-edge.md). The
bare-metal nginx steps in `deploy/README.md` are the fallback.

Production build and upload (SSH host alias `lv24`, default):

```sh
bash scripts/deploy-prod.sh
```

The script runs `npm ci`, lint and tests, builds at the site root with
`DOCS_SITE_URL=https://seo.lv24.by`, prints the hashes of the stable inline
scripts, checks them against the committed `deploy/csp-hashes.txt`, uploads the
build to `/opt/lv24-sites/lv24-seo-site/root` and switches the vhost root
atomically. The previous directory is kept as `root.prev-<ts>` for rollback. A
hash mismatch aborts before upload; if the file is missing the script writes it
and continues. If the final root swap fails, the previous root is restored.

Build for another origin (canonical URLs, `hreflang` and the sitemap):

```sh
DOCS_SITE_URL=https://staging.example npm run docs:build
```

`deploy-prod.sh` passes `DOCS_SITE_URL` to the build and uses the same value for
its post-deploy checks; it still uploads to the `lv24` host unless you pass a
different SSH alias.

On Windows, build with the normal npm scripts and upload with the PowerShell
counterpart (the POSIX script runs `npm ci` inside its own shell):

```powershell
$env:DOCS_SITE_URL = 'https://seo.lv24.by'; npm run docs:build
powershell -File scripts/upload-prod.ps1
```

`upload-prod.ps1` and `upload-prod.sh` upload an existing build only; they do
not run `npm ci`, lint, tests, or the CSP hash check. Use
`scripts/deploy-prod.sh` (Git Bash/WSL) for the gated path.

`robots.txt` at the origin belongs to this build and points crawlers at
`https://seo.lv24.by/sitemap.xml`. The nginx sample and the first-time VPS
runbook live in `deploy/`; production uses the containerized edge, so follow
`deploy/vps-edge.md` rather than installing a host nginx vhost.

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and every pull request:
`npm ci`, `npm test`, `npm run lint`, `npm run docs:build` on `ubuntu-latest`
with `contents: read`. It uploads no artifacts and uses no paid runner.

## Rollback

List the retained builds on the VPS:

```sh
ssh lv24 'sudo ls -1 /opt/lv24-sites/lv24-seo-site'
```

Restore one atomically, keeping the failed build for inspection:

```sh
ssh lv24 'sudo bash -s' <<'EOF'
set -euo pipefail
cd /opt/lv24-sites/lv24-seo-site
ts=$(date -u +%Y%m%dT%H%M%SZ)
mv root "root.failed-$ts"
mv root.prev-20261114T120000Z root
EOF
```

Replace the timestamp with the directory you want to restore, then re-run the
verification URLs (`/`, `/ru/`, `/zh/`, `/reference/cli/`). The full procedure,
including pruning old `root.prev-*` directories, is in `deploy/README.md`.

## Structure

- `_source/` — immutable snapshot of the public engine and desktop docs plus
  `MAP.md` (snapshot file to site page mapping) and `README.md` (snapshot
  provenance). Never edit files here.
- `docs/` — the English site at `/`. One directory per route
  (`docs/start/`, `docs/reference/cli/`, …), each with an `index.md` carrying
  `title`/`description` frontmatter and a `Source` footer naming the snapshot
  file.
- `docs/ru/`, `docs/zh/` — the same routes translated; every English page has a
  counterpart with identical code fences and locale-prefixed links.
- `docs/.vitepress/config.mts` — locales and language switcher, clean URLs,
  per-locale sidebars (Start, Use, Operate, Reference) and nav, local search,
  sitemap, canonical/hreflang/OG tags.
- `docs/.vitepress/theme/` — identity layer:
  - `custom.css` — design tokens and component overrides (nav, sidebar, prose,
    tables, code blocks, callouts, outline, pager, search).
  - `i18n.ts`, `home.i18n.ts`, `commands.i18n.json` — UI, home and CLI copy per
    locale.
  - `HomePage.vue` — home hero, install strip, value points, path cards.
  - `BrandMark.vue`, `NavBrandSuffix.vue`, `SiteFooter.vue` — brand chrome.
  - `Breadcrumbs.vue`, `ShellTabs.vue` (Windows/macOS/Linux command tabs),
    `CliTables.vue` (filterable CLI tables with copy buttons and a mobile card
    layout), `CliOutline.vue` (command-group rail on the CLI page),
    `LangSwitcher.vue`, `ThemeSwitcher.vue`, `UpdatePrompt.vue`.
  - `commands.json` — typed CLI data behind the CLI reference.
- `scripts/check.mjs` — quality gate, no dependencies.
- `scripts/postbuild.mjs` — externalizes the inline data script and writes
  `version.json`.
- `scripts/deploy-prod.sh`, `scripts/upload-prod.sh`,
  `scripts/upload-prod.ps1` — production deploy and upload paths.
- `deploy/` — nginx vhost sample, CSP hash template and the VPS runbook.

## How to add a page

1. Add `docs/<route>/index.md` with `title` and `description` frontmatter,
   exactly one `#` heading, and a `Source` footer naming the `_source/` file.
2. Add the same page at `docs/ru/<route>/index.md` and
   `docs/zh/<route>/index.md`; translate prose, keep code fences byte-identical,
   and prefix internal links with `/ru` or `/zh`.
3. Use absolute routes for internal links (`/install/`, never `install.md` or
   hash routing). Cross-page anchors must match a heading on the target page.
4. Register the route in the shared `ROUTE_GROUPS` in
   `docs/.vitepress/config.mts` and add labels to every locale
   (`npm run test` enforces sidebar and locale coverage).
5. Commands go in fenced blocks with the right language (`sh`, `powershell`,
   `bash`, `yaml`, `json`); keep placeholders (`<property>`, `./data`) and never
   paste real tokens, passwords, or customer queries.
6. Run `npm run lint`, `node ./scripts/check.mjs`, `npm run docs:build`.

## How to update `_source/`

1. Copy the new public files over `_source/`, preserving names.
2. Update `_source/README.md` with the engine/desktop versions and commit.
3. Update `_source/MAP.md` so every file maps to site pages.
4. Regenerate or hand-edit the affected `docs/` pages, keeping meaning,
   warnings, and command syntax verbatim.
5. Run the full gates: `npm ci`, `npm run docs:build`, `npm run lint`,
   `npm run test`.

## CSP hashes

VitePress emits two stable inline scripts (the theme bootstrap and macOS
detection) on every page. `scripts/deploy-prod.sh` hashes them, prints the
values and, if `deploy/csp-hashes.txt` exists, fails when a computed hash is not
listed there. The committed `deploy/csp-hashes.txt` contains the current values;
put the same values into the nginx CSP and reload nginx. A VitePress upgrade
that changes either script requires updating both the hash file and the vhost.

Containerized edge:

```sh
sudo docker exec lv24-city-edge-nginx nginx -t
sudo docker exec lv24-city-edge-nginx nginx -s reload
```

Bare metal:

```sh
sudo nginx -t && sudo systemctl reload nginx
```

## Zero-spend and security

- The default path uses free tiers only: no paid services, no CDN, no external
  fonts, analytics, or third-party runtime requests.
- The vhost serves same-origin scripts, styles, fonts and images only
  (`connect-src 'self'`), denies framing and non-GET/HEAD methods, and sets
  HSTS, `nosniff`, a referrer policy and a permissions policy.
- `postbuild.mjs` keeps the per-build VitePress data script out of the HTML so
  the CSP can stay hash-pinned.
- No secrets, tokens, `.env` values or personal data belong in this repository,
  the snapshot, fixtures, or docs. Local `.env` files are ignored.
- TLS certificates come from Let's Encrypt via certbot; the deploy path uses
  SSH and `sudo` only on the target host.

## License

The LV24 SEO Optimizer engine and desktop application are Apache-2.0; see
`LICENSE` and `TRADEMARKS.md` in the product repositories. This repository
contains the static documentation site and the `_source/` snapshot; the site
content is © LV24.

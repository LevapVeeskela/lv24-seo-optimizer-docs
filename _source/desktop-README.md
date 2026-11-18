# LV24 SEO Optimizer Desktop

**A local, offline-first desktop control plane for [`lv24-seo`](https://github.com/LevapVeeskela/lv24-seo-optimizer).**
The Python CLI remains the engine of record; the desktop is a Tauri v2 shell, a React UI and a
careful process bridge around it. No cloud account, no telemetry, no local HTTP API, no SERP
scraping.

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Status: pre-release](https://img.shields.io/badge/status-pre--release-orange.svg)](#public-status)
[![Engine: lv24-seo 0.15.1](https://img.shields.io/badge/engine-lv24--seo%200.15.1-informational.svg)](docs/releases/0.9.5.md)

> **0.9.5 released (2026-11-18).** `0.9.5` is the latest published line; `0.9.4`, `0.9.3`, `0.9.2`,
> `0.9.1`, `0.9.0`, `0.8.0`, `0.7.0`, `0.6.0`, `0.5.0`, `0.4.0` and `0.3.0` remain available for
> rollback. Windows NSIS, macOS `.app` and Linux AppImage can auto-update from `0.2.0` onward; deb,
> rpm, MSI and the portable ZIP are manual-only. `0.1.0` has no updater and must be upgraded
> manually once. `0.9.5` bundles `lv24-seo 0.15.1`, adds four crawl rule packs (security headers,
> TLS, Schema.org, accessibility) and raises `MIN_ENGINE_VERSION` to `0.15.1`. The Indexing and
> Connect cards are unchanged. Read [Public status](#public-status) before relying on anything
> here. Release notes: [`docs/releases/0.9.5.md`](docs/releases/0.9.5.md).

## Screenshot

> **Placeholder, not live data.** The image below is a wireframe placeholder. It will be replaced by
> a real screenshot from a local workspace using synthetic data. It is not a claim that the
> numbers are real or that the UI is final.

![Wireframe placeholder for the future dashboard screenshot](docs/assets/dashboard-placeholder.svg)

## What it is

`lv24-seo-optimizer-desktop` turns the `lv24-seo` CLI into a desktop application for people who do
not want to remember flags:

- **Project and provider settings** for Google Search Console, Yandex Webmaster, Yandex Metrika,
  Bing/IndexNow, Chrome UX Report and PageSpeed Insights.
- **Onboarding without the terminal:** a folder → site → review wizard runs `lv24-seo init`, never
  overwrites an existing `seo.toml`, and remembers recent workspaces in the header chip.
- **A stats dashboard** built on the bounded `lv24-seo stats --json` envelope:
  current values, previous-period comparison, coverage, data age, truncation and limitations.
- **A crawl screen** with a URL budget, severity/rule/search filters, bounded rendering and JSON/CSV
  export.
- **Crawl log analysis:** one local nginx JSON access log, a bot filter, parsed/skipped lines, crawl
  waste by bot, a daily bot rollup and JSON/CSV export — read-only and never uploaded.
- **A task lifecycle:** findings move through `open`, `in_progress`, `verified` and `dismissed`, with
  filters, evidence and an idempotent add form.
- **Portable workspace backups:** a `.zip` with a manifest, a redacted `seo.toml` and a consistent
  SQLite copy; tokens are never included. **Restore** is two-phase — review the plan, confirm, then
  apply — and keeps pre-restore copies of the database and config.
- **Bing indexing actions:** a two-phase Bing sitemap submit, an IndexNow batch built from the
  sitemap, and a native Bing URL submission with an optional URL list or sitemap source. Review the
  engine plan, confirm, then apply; success means Bing **accepted** the URLs, not that they are
  indexed. Read-only cards show `GetFeeds` sitemaps (URL, status, last crawl, URL count),
  `GetCrawlIssues` rows (HTTP code, decoded issue bitmask, in-links) and the remaining daily/monthly
  `GetUrlSubmissionQuota`. A missing Bing key is reported as `AUTH_REQUIRED` with a Settings hint.
  **Bing Site Scan** has no public API in the official Webmaster method list, so the desktop only
  opens the official page in your default browser — it never claims to start a scan.
- **Indexing automation (read-only):** a card on the Integrations page reads the quota-aware
  indexing queue (`indexing status`), the newest runs (`indexing history`) and the host job state
  (`schedule status --kind indexing`). It shows submitted/indexed/pending counts per provider, Bing
  daily/monthly remaining, Yandex remaining, the GSC/IndexNow used/limit counter, the documented
  **Daily 04:00** cadence, a **Scheduled** chip when the host job is installed, the newest run with
  up to five error items, a 7/30-day day/provider roll-up and every limitation the engine reports.
  There is no write control, no confirm token and no provider secret on this card.
- **Read-only platform diagnostics:** a Diagnostics screen with five tabs — Google URL Inspection
  and sitemaps, Yandex indexing history/search events/sitemaps/recrawl queue, Bing page, traffic,
  crawl, URL and query/page-join stats, Metrika pages, goals, devices, countries, engagement and
  visits over time, and CWV Lighthouse audits plus CrUX weekly history. Every answer shows
  `total`, truncation, data age, limitations, `organic_only` and sampling fields where relevant; a
  provider-empty answer is labeled `no_rows_for_window`, `provider_returned_no_rows` or
  `low_traffic`, never zero-filled. There is no write action on this page.
- **A report view** for the weekly digest: headline, the sections the engine returns, limitations,
  warnings and the generated local HTML report, which opens in your default browser. It also compares
  the two newest stored snapshots, renders the attributed change digest, shows Core Web Vitals by URL
  template and exports JSON/CSV.
- **A portfolio page:** scan one folder for projects, compare open issues and local activity across
  sites, filter/sort the list and open a site's workspace.
- **Configuration output** that is safe to copy: effective redacted JSON, read-only Source TOML with
  secret-looking values redacted, saved-vs-draft diff, validation errors, doctor diagnostics and
  environment-override names.
- **A recommendations-to-agent workflow**: review findings, search and sort them, copy a bounded
  Markdown prompt, bulk-export or queue the visible set, hand it to a coding agent, then re-run the
  report to verify the fix.
- **Integrations:** OAuth connectors for Google Search Console, Yandex Webmaster and Yandex
  Metrika, MCP snippets for Claude Desktop, OpenCode, VS Code and Cursor, a read-only indexing
  automation card, two-phase Bing sitemap/IndexNow/URL submission actions, a Site Scan opener, plus
  a schedule card that previews a cron/systemd/Windows artifact or installs the host job after
  confirmation.
- **A per-workspace reporting window** (7/28/90 days, 2- or 3-day provider lag) and honest run status:
  elapsed time, last run, truncation and limitations.
- **Cancellable background runs:** crawl, weekly report, log analysis, backup create/restore and host
  schedule install get a window-wide run banner with a **Cancel** button. The shell cancels only the
  exact child process it spawned for that run; a run that already finished answers `false`, and a
  cancelled run is shown as cancelled rather than as a generic error. Cancellation is not rollback
  and there is no job queue.
- **Explicit write gates** for delivery, schedule installation, MCP client installation and any
  provider write action.
- **Signed in-app updates** for the bundle types that can replace themselves, with a manual release
  page for the rest.

### Surfaces and tools

The desktop is one surface over the same engine. These are the tools the engine exposes today:

| Surface | What you get |
|---|---|
| Desktop | Project wizard, dashboard with properties and reporting window, crawl screen, log analysis, task lifecycle, portfolio, weekly report with snapshot comparison, attributed digest and CWV, read-only platform diagnostics (GSC, Yandex, Bing, Metrika, CWV), OAuth provider connectors, read-only indexing automation (queue, quotas, runs, host job), config editor/diff/validation, recommendations with search/bulk, integrations snippets, Bing sitemap/IndexNow/URL submission actions, read-only Bing sitemap/issue/quota views, Site Scan opener, backup create/restore, host schedule install, agent task queue, signed updates |
| CLI | 22 top-level commands (15 groups + 7 commands): `version`, `doctor`, `init`, `properties`, `stats`, `crawl`, `install`, `auth`, `config`, `gsc`, `yandex`, `sitemap`, `indexnow`, `report`, `cwv`, `schedule`, `export`, `logs`, `tasks`, `backup`, `portfolio`, `mcp` |
| MCP | 12 tools, 3 resources, 3 prompts; no provider writes by default |
| Skills | `seo-weekly`, `seo-indexing-triage`, `seo-technical-audit` |
| Automation | cron, systemd timer and Windows Task Scheduler generators; SMTP/Telegram delivery |

MCP tools by access level:

| Tool | Access | What it does |
|---|---|---|
| `seo_properties` | read-only | Configured providers, targets and token presence |
| `gsc_search_analytics` | read-only | GSC query/page/country/device rows |
| `yandex_query_stats` | read-only | Top Yandex queries for the host |
| `yandex_indexing_state` | read-only | Indexing history, events and problems |
| `seo_crawl_site` | read + local state (`readOnlyHint: false`) | Bounded crawl; stores pages and issues |
| `seo_weekly_report` | read + local state (`readOnlyHint: false`) | Weekly digest; stores a report snapshot |
| `seo_report_diff` | read-only | Diff two stored weekly snapshots |
| `seo_indexing_triage` | read-only | Group indexing problems into an action list |
| `seo_opportunities` | read-only | Striking-distance and decay opportunities |
| `seo_log_analysis` | read-only | Bot rollup and crawl waste from one local nginx JSON access log |
| `seo_recrawl_request` | gated write (`destructiveHint: true`) | Yandex recrawl queue; wired in 0.13.1 (quota-capped, one URL per request) |
| `seo_sitemap_submit` | gated write (`destructiveHint: true`) | Bing sitemap submit (works with `allow_write=true`); GSC submit and Bing delete stay `WRITE_DISABLED` in 0.13.1 |

The two local-state tools never touch provider state and are not destructive. The two provider
writes require `allow_write=true`; GSC submit and Bing delete still return `WRITE_DISABLED` in the
pinned engine, and the desktop never turns a disabled path into a success.
The full inputs, outputs and limits are in the engine's
[`docs/mcp.md`](https://github.com/LevapVeeskela/lv24-seo-optimizer/blob/main/docs/mcp.md).

## What it is not

- Not a reimplementation of SEO logic, provider clients, crawling or report builders. Those live in
  `lv24-seo`.
- Not a hosted service, not a multi-tenant dashboard, not a place where provider data is uploaded.
- Not a source of fake precision: missing, capped, delayed or failed provider data is shown as
  missing, capped, delayed or failed.
- Not a way to bypass provider quotas or to scrape Google/Yandex result pages.
- Not signed or notarized by a paid certificate authority. Windows is unsigned, macOS is ad-hoc
  signed and Linux packages are unsigned. See [Unsigned builds](#unsigned-builds).

## Install

Download from [Releases](https://github.com/LevapVeeskela/lv24-seo-optimizer-desktop/releases).
The latest published line is `0.9.5`; full notes, install steps and limitations:
[`docs/releases/0.9.5.md`](docs/releases/0.9.5.md) for the current release,
[`docs/releases/0.9.4.md`](docs/releases/0.9.4.md) for the previous one and
[`docs/releases/0.9.3.md`](docs/releases/0.9.3.md) for the one before that. `0.9.2`, `0.9.1`,
`0.9.0`, `0.8.0`, `0.7.0`, `0.6.0`, `0.5.0` and `0.4.0` remain available for rollback.

| Platform | Assets | Auto-update |
|---|---|---|
| Windows 10/11 x64 | `LV24.SEO.Optimizer_0.9.5_x64-setup.exe` (+ `.exe.sig`), `LV24-SEO-Optimizer_0.9.5_x64-portable.zip` | NSIS only; portable ZIP is manual |
| Linux x64 | `LV24.SEO.Optimizer_0.9.5_amd64.AppImage` (+ `.AppImage.sig`), `LV24.SEO.Optimizer_0.9.5_amd64.deb`, `LV24.SEO.Optimizer-0.9.5-1.x86_64.rpm` | AppImage only; deb/rpm are manual |
| macOS 13+ arm64/x64 | `LV24.SEO.Optimizer_0.9.5_aarch64.dmg`, `LV24.SEO.Optimizer_0.9.5_x64.dmg`, `LV24.SEO.Optimizer_0.9.5_aarch64.app.tar.gz` and `LV24.SEO.Optimizer_0.9.5_x64.app.tar.gz` (+ `.sig`) | `.app` only; DMG is the first install |

The `0.2.x` through `0.9.x` releases also publish `latest.json` and `SHA256SUMS.txt`. Verify the
checksum before running an installer. `SHA256SUMS.txt` covers every other published asset, including
updater signatures and `latest.json`.

### Windows

Requires Windows 10/11 x64 and the Microsoft Edge WebView2 runtime. WebView2 ships with Windows 11
and most updated Windows 10 systems. The NSIS installer can fetch it when missing; the portable ZIP
cannot.

- **NSIS installer:** installs per user, adds a Start menu entry and can auto-update. SmartScreen may
  warn because the build is unsigned; choose **More info → Run anyway** after verifying the checksum.
- **Portable ZIP:** extract the whole `LV24 SEO Optimizer` folder and run `lv24-seo-desktop.exe`.
  Keep the `lv24-seo\` folder next to it. There is no installer and no in-app update; download a new
  ZIP from the release page. "Portable" means no installer; the app still keeps its own
  `settings.json` under `%APPDATA%` for `by.lv24.seo.desktop`.

### Linux

The Linux bundles are built on Ubuntu 22.04 (glibc 2.35 baseline) and are x64 only.

```bash
# AppImage: auto-update capable
chmod +x ./*_amd64.AppImage
./*_amd64.AppImage

# deb: manual-only
sudo apt install ./*_amd64.deb

# rpm: manual-only
sudo dnf install ./*_amd64.rpm
```

Use the exact file names from the release page; `SHA256SUMS.txt` is authoritative. If the AppImage
needs FUSE 2 and your distribution does not ship it, install `libfuse2` or use deb/rpm.

### macOS

Requires macOS 13 or later. Use the `aarch64` DMG on Apple silicon and the `x64` DMG on Intel. Open
the DMG, drag **LV24 SEO Optimizer** to **Applications**, then approve the first launch through
**System Settings → Privacy & Security → Open Anyway** (or right-click → **Open**). The build is
ad-hoc signed, not notarized. Auto-update uses the signed `.app.tar.gz` for the matching
architecture.

### Verify the download

Windows PowerShell:

```powershell
$sums = Get-Content .\SHA256SUMS.txt
foreach ($line in $sums) {
  if (-not $line.Trim()) { continue }
  $expected, $file = $line -split '\s+', 2
  if (-not (Test-Path ".\$file")) { "SKIP $file (not downloaded)"; continue }
  $actual = (Get-FileHash ".\$file" -Algorithm SHA256).Hash
  if ($actual -eq $expected) { "OK   $file" } else { "FAIL $file" }
}
```

macOS and Linux:

```bash
sha256sum -c SHA256SUMS.txt --ignore-missing
# macOS:
shasum -a 256 -c SHA256SUMS.txt
```

**Do not run a file whose hash does not match.** The sidecar checksum policy is rebuild-aware: the
committed pin in `scripts/cli-checksums.json` records the reviewed local build where one exists, and
CI records the actual SHA-256 of the sidecar it built. PyInstaller onedir output is not
byte-reproducible, so a CI rebuild will not equal the reviewed pin. The release gate requires a
valid checksum report for every shipped target, but those reports are CI evidence, not published
assets.

### Upgrading from 0.1.0

`0.1.0` has no updater, endpoint or public key. Install `0.9.5` manually once (NSIS installer or
portable ZIP); auto-update works from `0.2.0` onward when the installed bundle is Windows NSIS, macOS
`.app` or Linux AppImage.

## Auto-update

The updater endpoint is
`https://github.com/LevapVeeskela/lv24-seo-optimizer-desktop/releases/latest/download/latest.json`.
The app checks it once at startup (silently, 30-second timeout) and when you press **Check for
updates** in Settings.

- **User confirms.** The app never downloads or installs an update on its own. The panel shows the
  version and notes; **Download and install** starts the update. An unsaved configuration draft
  disables the button.
- **Install runs in Rust.** The webview only has permission to read the manifest
  (`updater:allow-check`); it cannot call the updater plugin's `downloadAndInstall`. The shell
  re-checks the endpoint and refuses a version that differs from the one you saw
  (`UPDATE_VERSION_MISMATCH`), runs one install at a time (`UPDATE_IN_PROGRESS`) and reports download
  progress. A second window or a stale panel cannot install something else.
- **Cancel is real.** **Cancel** during the download stops it before the installer starts
  (`UPDATE_CANCELLED`). Once installation has begun the app says the update cannot be undone instead
  of pretending the click cancelled it.
- **Signature verified.** Packages are signed with a minisign/Ed25519 key whose public key is
  embedded in the app. `requireSignedVersion` binds the announced version to the signed package. A
  signature failure blocks that artifact and points to the release page; it is not retried.
- **No downgrades.** Only a version greater than the running one is accepted.
- **No auto-install.** Windows runs the signed NSIS setup in passive mode; macOS replaces the
  `.app`; Linux replaces the AppImage. The app restarts after installation; the NSIS installer
  handles the Windows restart.
- **Sidecar cleanup before install.** The engine sidecar lives inside the installed resource
  directory, so a running `lv24-seo` process would keep it locked and break the NSIS update. Before
  the installer starts, the shell stops only the engine PIDs this app instance spawned — never a
  process matched by name. The install command repeats that stop itself, so a skipped preparation
  step cannot leave a locked file. If a sidecar cannot be stopped, the install is blocked with
  `UPDATE_ENGINE_BUSY` and can be retried once that run exits.
- **Manual-only bundles.** deb, rpm, MSI and the portable ZIP cannot replace the running
  installation. The Settings panel disables the in-app installer and links to the release page.
  MSI is not produced by this project.

The updater private key is used only by the release build step. It is never shipped, committed or
given to the release job. See [`docs/security.md`](docs/security.md#8-updates) and
[`docs/release.md`](docs/release.md).

## Requirements

| Tool | Version | Why |
|---|---|---|
| Node.js | 24.x | Vite, TypeScript and the Tauri CLI |
| Rust | 1.90+ (CI and releases pin 1.95.0) | Tauri shell; `rustfmt` and `clippy` |
| Python | 3.12 (3.11+ works) | contract generation and the PyInstaller sidecar |
| [`uv`](https://docs.astral.sh/uv/) | current | reproducible Python environment for the sidecar |
| Tauri prerequisites | current | WebView2 on Windows, WebKitGTK on Linux, Xcode CLT on macOS |

Install the platform prerequisites from the
[Tauri v2 prerequisites guide](https://v2.tauri.app/start/prerequisites/).

## From source

```bash
git clone https://github.com/LevapVeeskela/lv24-seo-optimizer-desktop
cd lv24-seo-optimizer-desktop
npm ci
npm run check              # typecheck + unit tests + web build
```

Run the UI in a browser shell:

```bash
npm run dev                # Vite on http://localhost:1420
```

Build and run the desktop shell with a locally installed engine:

```bash
# Option A: use an engine you already trust
LV24_SEO_BIN=/absolute/path/to/lv24-seo npm run tauri dev

# Windows PowerShell
$env:LV24_SEO_BIN = "C:\path\to\lv24-seo.exe"; npm run tauri dev
```

The shell resolves `LV24_SEO_BIN`, the bundled `engine/lv24-seo/` resource, a flat `lv24-seo/`
resource, or a sibling `lv24-seo/` folder next to the app. An `lv24-seo` found on `PATH` is ignored
unless `LV24_SEO_ALLOW_PATH_ENGINE=1` is set (`$env:LV24_SEO_ALLOW_PATH_ENGINE = "1"` in
PowerShell).

Build the bundled sidecar (PyInstaller **onedir**) and then the platform bundles:

```bash
python scripts/build-sidecar.py --engine-version 0.14.0 --target x86_64-pc-windows-msvc
node scripts/verify-sidecar.mjs --root src-tauri/engine --target x86_64-pc-windows-msvc --write
npm run tauri build -- --bundles nsis
npm run package:portable
```

`scripts/build-sidecar.py` writes `src-tauri/engine/lv24-seo/` (executable plus `_internal/`). The
committed Tauri config maps that tree to the app's `engine/lv24-seo/` resource directory. The build
is host-only: PyInstaller does not cross-compile, so each target must be built on its own runner.
`npm run package:portable` stages the app plus the sibling `lv24-seo/` tree and writes a `.zip` and
its `.sha256` sidecar under `release/`.

For Linux or macOS, use the matching target and bundle set, for example:

```bash
python scripts/build-sidecar.py --engine-version 0.14.0 --target x86_64-unknown-linux-gnu
npm run tauri build -- --target x86_64-unknown-linux-gnu --bundles appimage,deb,rpm

python scripts/build-sidecar.py --engine-version 0.14.0 --target aarch64-apple-darwin
npm run tauri build -- --target aarch64-apple-darwin --bundles dmg
```

Updater artifacts require `TAURI_SIGNING_PRIVATE_KEY` (and, when set, its password). A local build
without the key should use `--no-sign` or a Tauri config override with
`bundle.createUpdaterArtifacts: false`; do not commit a private key. The committed config enables
updater artifacts, while CI enables them only when the key secret exists.

### Checks

```bash
npm run typecheck
npm test
npm run test:release       # release scripts: latest.json schema, allowlist, checksums
npm run build
npm run contract:check     # regenerate contracts and fail on drift
cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
```

CI adds `npm audit --audit-level=high` and `cargo audit`, and builds the Rust matrix on linux-x64,
windows-x64, macos-arm64 and macos-x64 with Rust `1.95.0`. See
[`docs/release.md`](docs/release.md#pull-request-ci-gates).

## Supported providers

Provider support comes from the pinned `lv24-seo` engine, not from the desktop. The desktop adds
settings, health status and presentation; it does not add provider adapters.

| Provider | Free tier | Used for | Write actions |
|---|---|---|---|
| Google Search Console | yes (OAuth token or service-account file) | queries, pages, countries, devices, URL inspection | sitemap submit is disabled in the engine |
| Yandex Webmaster | yes (OAuth) | queries, indexing history, diagnostics, richer indicators | recrawl (quota-capped, one URL per request) |
| Yandex Metrika | yes | sessions and users | none |
| Bing Webmaster + IndexNow | yes | queries, crawl issues, sitemap submit, IndexNow URL ping | Bing sitemap submit and IndexNow from sitemap, both two-phase and explicitly gated. Site Scan has no public API; the desktop only opens the official Bing page |
| Chrome UX Report | yes (API key) | URL + device field Core Web Vitals (`cwv collect`) | none |
| PageSpeed Insights | yes | lab audits per URL | none |
| Your own site | — | crawl, robots, sitemap, JSON-LD, hreflang, links | none |
| nginx access logs | — | Python analysis helpers (no desktop ingest yet) | none |

Yandex Metrika is a separate auth provider from Yandex Webmaster: the desktop stores
`yandex_metrika_token` under the `metrika` provider and `yandex_webmaster_token` under `yandex`.

The desktop never asks for a paid provider key. Optional paid adapters in the engine are
bring-your-own-key and are not part of the default path.

## Provider connectors (OAuth)

The **Integrations** page starts with a **Provider connectors** card for Google Search Console,
Yandex Webmaster and Yandex Metrika. Each row shows **Connected** / **Not connected** from
`lv24-seo auth status --json` (`gsc_oauth`, `yandex_oauth`, `metrika_oauth`); a provider the engine
did not report stays **Not checked** instead of being shown as missing.

With engine `lv24-seo >= 0.14.0` each row also shows an OAuth readiness chip from the same answer's
`data.oauth` (`gsc`, `yandex`, `metrika`). The eight engine states map to a localized short label:
**Ready** (`oauth_ready`); a needs-action label for `oauth_client_missing`,
`oauth_client_secret_missing`, `oauth_token_missing`, `oauth_scope_missing` and
`oauth_redirect_invalid`; and a warning for `oauth_token_expired` (the engine `detail` says whether
a refresh token can renew it) and `oauth_scope_unknown` (unknown scope coverage, not a failure).
The row renders the engine's `detail` and `next_action` verbatim (English, URLs unchanged), the
localized token expiry (`—` when the engine reports none), whether scopes were recorded, and the
engine `limitations[]`. An engine without `data.oauth`, a provider the engine skipped, or an
unrecognised state shows a neutral *Readiness unavailable* notice instead of a false **Ready**;
the presence rows keep working. No token or secret value is read from the payload or rendered.

- **Google Search Console:** **Connect** runs `lv24-seo auth login --provider gsc --json`. The
  engine opens the system browser, listens on a `127.0.0.1` loopback callback and returns a
  token-free summary after consent. The card says *Complete the sign-in in your browser* while the
  call is in flight, then refreshes the status.
- **Yandex Webmaster / Metrika:** **Connect** runs the same command with `--url-only`, which returns
  the consent URL without exchanging anything. **Open Yandex** hands that exact URL to a narrow
  opener, and **Finish** sends the pasted code back with `--code`. The code is single-use and is
  cleared from the window after the exchange.

The connectors require engine `lv24-seo >= 0.13.1`. Client ids live in `[auth.gsc]` / `[auth.yandex]`
in `seo.toml`; the client secret is never entered in the window. Set it once from a terminal:

```bash
lv24-seo auth set --provider gsc_oauth_secret --stdin
lv24-seo auth set --provider yandex_oauth_secret --stdin
```

No token is returned over IPC or rendered in the page. If the client id/secret is missing, the card
shows the engine's `AUTH_REQUIRED` / `CONFIG_INVALID` message with its `next_action` and a link to
the engine auth guide instead of a generic failure. The card has no write or confirm control: the
engine stores the tokens in the OS keychain (or its explicit file fallback).

## Indexing automation (read-only)

The **Indexing automation** card sits between the MCP snippets and the write-capable indexing
actions. It reads three commands from engine `lv24-seo >= 0.13.1`:

```text
lv24-seo indexing status --provider all --limit 50 --live --json
lv24-seo indexing history --limit 30 --json
lv24-seo schedule status --kind indexing --target <cron|systemd|windows> --json
```

- **Header:** a state chip from `schedule status` (`Scheduled` when the host job is `installed`,
  otherwise the reported state) and the documented **Daily 04:00** cadence. The card never installs,
  edits or removes the job; `schedule install` in this release still covers the weekly/daily report
  jobs only.
- **Providers:** Bing, Yandex, GSC and IndexNow rows with submitted, indexed (GSC only), pending and
  quota. Bing shows daily/monthly remaining, Yandex shows remaining, and GSC/IndexNow show the local
  used/limit counter. A provider the engine did not configure is **No data yet**, never a zero row.
  The GSC `indexed_total` is rendered separately with a **deprecated aggregate** note because Google
  deprecates the sitemap `contents[].indexed` field.
- **Last run:** the newest history row with status, provider, start time, submitted/checked/errors
  and at most five `detail.error_items` (`url`, `code`, `message`); the rest are summarized.
- **History:** `--limit 30` is aggregated by day and provider, with 7-day and 30-day totals. There is
  no chart dependency.
- **Honesty:** `meta.limitations` and `meta.data_age_days` are always rendered. If the engine rejects
  the command as unknown, the card says **Indexing status needs engine >= 0.13.1** and hides the
  tables instead of showing empty zeros.
- **Read-only:** no `--allow-write`, no confirm token and no credential is sent or rendered. Refresh
  re-runs the same three reads; it is disabled while a load is in flight.

## Stats dashboard

The dashboard renders the stats envelope; it is not a new metric engine. The contract is
[`contracts/stats-v1.md`](contracts/stats-v1.md) and `lv24-seo 0.13.1` ships the command:

- one card per configured provider with the metrics the provider actually returned;
- current values with deltas against the previous window, including CTR deltas in **percentage
  points**, not percent;
- `status` (`ok`, `no_data`, `missing_token`, `not_configured`, `error`), `rows`, `data_age_days`,
  `truncated` and `limitations` visible on the card;
- a coverage banner that says `complete: false` when any configured service is missing, failed,
  empty or truncated;
- no zero-fill and no cross-engine totals. Unknown is shown as unknown.

The pinned engine provides `lv24-seo stats --days 7 --lag-days 2 --json`. The desktop adds no
metrics of its own. If the installed engine is older than the shell's minimum version, the engine is
marked offline and the affected screens show the standard offline notice; the footer still shows the
detected engine version when one was reported. The desktop does not silently run an older engine or
fake a compatibility dialog.

## Reports

The Reports screen runs `report weekly --days 7 --lag-days 2 --json` with
`--out <app data>/exports/reports`. The engine writes `report.json` and `report.html` into that
directory. The screen reads the HTML path from the envelope (`meta.artifacts.html`) and opens it in
your default browser through the Rust `open_path` command, which requires an absolute path, an
approved root and an allowed extension (`.html` included). The desktop never renders the report HTML
inside its own webview.

## Diagnostics

The Diagnostics screen is read-only and has five tabs over the same active workspace:

| Tab | Commands | What it shows |
|---|---|---|
| Google | `gsc_inspect`, `gsc_sitemaps` | URL verdict, coverage, canonical, crawled-as, last crawl, rich results, referring URLs and the property sitemap list with submitted contents |
| Yandex | `yandex_indexing`, `yandex_sitemaps`, `yandex_queue` | Daily appeared/removed events, HTTP 2xx–5xx buckets, summary counters, sitemap URL/error counts and the recrawl queue with `meta.total` |
| Bing | `bing_pages`, `bing_traffic`, `bing_crawl`, `bing_urlinfo`, `bing_joins` | Page and daily traffic rows, six-month crawl buckets, URL index details and query/page joins |
| Metrika | `metrika_pages`, `metrika_goals`, `metrika_devices`, `metrika_countries`, `metrika_engagement`, `metrika_bytime` | Organic pages, goal reaches/visits/users/conversion, device and country breakdowns, engagement totals and visits over time |
| Core Web Vitals | `cwv_audits`, `cwv_history` | Lighthouse lab audit rows with scores and savings, and weekly CrUX p75 history for a URL or origin |

Every card renders `meta.total`, `meta.truncated`, `meta.data_age_days` and `meta.limitations`.
Metrika cards also show `meta.organic_only` and the sampling fields. A provider-empty answer is an
explicit `no_rows_for_window`, `provider_returned_no_rows` or `low_traffic` state, not a zero row.
The webview cannot pass `--site` to Bing, `--allow-write` to any of these commands, or an unknown
`group`, `strategy`, `device` or `category` value; the Rust shell rejects them before spawning the
engine. Sitemap submission, recrawl requests and URL submission remain on the Indexing screen behind
their own confirmation dialogs.

These reads ship in engine `lv24-seo 0.11.0`. With an older bundled sidecar the screen shows the
standard engine-update hint instead of pretending the provider returned nothing.

## Settings and configuration outputs

Settings are grouped by project, providers, report/delivery, crawl, storage and desktop preferences.
Every field has a label, help text, a visible default and validation. Reserved engine fields
(`crawl.concurrency`, `storage.raw_retention_days`, `report.week_start`,
`report.telegram.severity`, `providers.yandex_metrika.goals`) are labelled **no effect**, never
presented as working controls.

The **Settings** screen is the editable form. The workspace file is chosen with the native dialog
owned by the shell (`pick_config`), which also records the selection as approved; the webview cannot
persist an arbitrary path (`PATH_NOT_APPROVED`). If the saved workspace was moved or deleted, the
dashboard says so and offers **Choose config** instead of failing every stats call. The
**Configuration** screen is the read-only output and diagnostics view with seven tabs:

1. **Overview** — config path, resolved path, data directory, engine version, last load/validation,
   backups and a copyable diagnostics summary.
2. **Effective** — `lv24-seo config show --json`, redacted.
3. **Source TOML** — the file as stored on disk, comments preserved, secret-looking values redacted;
   read-only.
4. **Diff** — saved vs draft, field-level.
5. **Validation** — TOML syntax, schema errors, unknown keys and reserved fields.
6. **Doctor** — the read-only engine environment check.
7. **Environment** — `LV24_SEO_*` variable names and override status; values are never shown.

There is no raw TOML editor. Edits go through the Settings form, which is validated by the engine
before a patch is written.

Saving applies field-level `config_patch` operations, so comments and key order survive. The shell
revalidates with the engine, creates a timestamped backup (last five kept) and atomically replaces
the file. Edits typed while the engine was writing are kept: the returned snapshot never overwrites a
newer draft, and validation is cleared so the diff shows what is still unsaved. Provider blocks have
an explicit enable/disable toggle, so disabling one removes it on save instead of it silently
returning. Token values are never persisted by the webview, logged or shown back; the password field
is sent once over IPC. See [`docs/configuration.md`](docs/configuration.md).

## Recommendations to an agent

The desktop is designed to close the loop between “what changed” and “fix it in the repository”:

1. Run the weekly report or the stats dashboard.
2. Review the bounded findings: striking-distance queries, CTR gaps, decayed pages, indexing
   reasons and technical crawl issues. Read the coverage banner first.
3. Copy the finding as a Markdown agent prompt or export it as `.md`. The packet includes the
   period, provider, query/page, observed values, limitations and the exact source command.
4. Paste it into Claude Code, OpenCode, Codex or another coding agent together with the
   `seo-weekly` / `seo-technical-audit` skill. The agent edits the site repository and runs the
   checks it is allowed to run.
5. Re-run the same report or refresh the dashboard in the desktop to verify the change. Do not trust
   the agent's summary without the new envelope.

Any write action that is exposed must require a confirmation dialog naming the exact target and
action. The desktop does not apply site edits itself.

## Security

- **No secrets in the webview.** Token input is a password field sent once over IPC; the Rust layer
  pipes it to `lv24-seo auth set --stdin`. Values are not stored in MobX, logs or diagnostics. On
  Linux the CLI runner inherits the session-bus/XDG variables Secret Service needs; the value itself
  still travels only over stdin. Every engine `stderr` and every bounded output preview is redacted
  (`token = "…"`, `--token …`, `Bearer …` → `***`) before truncation and before IPC, and a TOML syntax
  error is redacted too, because the parser quotes the offending line.
- **In-memory write secret.** The desktop generates a fresh 32-byte hex `LV24_SEO_WRITE_SECRET` at
  startup with the OS CSPRNG, keeps it only in Rust memory and passes it to every engine child as an
  environment variable after `env_clear()`. It is never written to settings, argv, logs, diagnostics
  or the webview. A new app session gets a new secret, so old plan tokens fail and the UI re-plans.
  The engine requires this secret for the write gate even when only minting a plan; CLI users set
  `LV24_SEO_WRITE_SECRET` themselves.
- **One shared secret store with the CLI.** The desktop runs the same engine under the same OS user,
  so a token stored by `lv24-seo auth set` in a terminal is visible in the desktop's `auth status`
  and vice versa. The OS keychain entry uses service `lv24-seo` and the same secret name on every
  surface; `LV24_SEO_*` environment variables are inherited by the CLI runner and are read-only in
  the UI (the desktop cannot unset your environment). The opt-in `<data-dir>/secrets.json` fallback
  (0600 on POSIX, ACLs on Windows) is shared only when the desktop opens the same workspace/data
  directory; it is never copied into the webview.
- **No local HTTP API.** The desktop talks to the engine through a fixed, allow-listed process
  bridge. There is no loopback server to authenticate, proxy or expose.
- **No telemetry.** Nothing is uploaded automatically except the updater's request for
  `latest.json`; diagnostics copies are user-triggered and redacted.
- **Strict CSP.** Production builds allow only local assets and Tauri IPC; the development CSP is
  limited to the Vite origin.
- **Command and path allow-lists.** No shell strings, no arbitrary executables. A new config path can
  only come from the native `pick_config` dialog; `settings_set` rejects anything else with
  `PATH_NOT_APPROVED`, so a workspace file cannot redirect a config write. `storage.data_dir` rejects
  UNC, verbatim and device paths (`INVALID_PATH`) before they are resolved, which avoids an outbound
  SMB authentication. Open/export paths are restricted to approved roots and `open_path` opens the
  canonical path that passed the check, not the raw request. Windows reserved device names are
  rejected in every path component.
- **One external URL allow-list.** `open_bing_sitescan` can open exactly
  `https://www.bing.com/webmasters/sitescan?siteUrl=<encoded>`; the host and path are hard-coded and
  the webview supplies only an absolute `https://` site URL, percent-encoded into the single query
  parameter. It cannot open an arbitrary URL, and because Bing has no API for starting a Site Scan
  the UI never reports that one was started.
- **Durable, private writes.** Config and settings writes are atomic and fsynced (file and parent
  directory); temp drafts and backups are `0600` on POSIX and get an owner-only DACL on Windows
  before any bytes are written; config reads are bounded at 8 MiB. Backup retention only deletes
  files this app created. Blocking file work runs off the UI thread with a deadline
  (`PATH_TIMEOUT`), so a dead network share cannot freeze the window.
- **Signed updates.** The updater verifies a minisign/Ed25519 signature, binds the version to the
  signed package and refuses downgrades. A signature failure blocks the artifact. The install itself
  runs in Rust with a version re-check and a cancellable download; the webview cannot start an
  install.
- **Exact-process cancellation.** `run_cancel` accepts a bounded run id and signals only the exact
  child PID registered for that run (and, on Unix, its process group). It never matches an image
  name, so another installed copy, a portable build or an unrelated process is never killed. A PID
  that no longer names the engine is left alone, and a run that already finished returns `false`.
- **Sidecar integrity.** Release builds use a PyInstaller onedir tree with a reviewed local pin
  where available and rebuild-aware CI checksum reports. See [`docs/security.md`](docs/security.md).

Read [`docs/security.md`](docs/security.md) and report vulnerabilities through the process in
[`SECURITY.md`](SECURITY.md), not a public issue.

## Unsigned builds

The OS packages are **unsigned**:

- **Windows:** no Authenticode signature. SmartScreen, Smart App Control or antivirus software may
  warn or block the installer. Verify the SHA-256 checksum published with the release.
- **macOS:** ad-hoc signed only. Gatekeeper will warn on first launch. Use **System Settings →
  Privacy & Security → Open Anyway**, or right-click → **Open**. There is no notarization because
  it requires a paid Apple Developer account, which this project does not use.
- **Linux:** AppImage, deb and rpm are unsigned packages; verify checksums and your distribution's
  package policy.

The updater signature is separate from OS code signing. It proves the update came from this
project's release key; it does not make Windows or Linux packages trusted by the OS.

Do not disable Gatekeeper or SmartScreen system-wide. If your environment requires a signed build,
build from source and sign it with your own certificate. See [`docs/release.md`](docs/release.md).

## Public status

| Area | Status |
|---|---|
| Contracts (`config.schema.json`, CLI fixtures incl. `stats`) | generated from `lv24-seo 0.15.1`; drift check in CI |
| CI (web, Rust matrix, contract check) | active on pull requests and `main`; standard runners only |
| Manual desktop build workflow (NSIS, DMG, AppImage, deb, rpm) | available; owner-triggered; publish requires the updater key |
| Tauri command bridge (config read/validate/write/patch, CLI runner incl. `init`, `schedule_print`, `logs_analyze`, `tasks_*`, `backup_create`, `backup_restore`, `portfolio_list`, `schedule_install`, `sitemap_submit`, `indexnow_submit`, `bing_submit`, `bing_sitemaps`, `bing_issues`, `bing_quota`, `indexing_status`, `indexing_history`, `schedule_status`, the 18 read-only diagnostics commands, file and directory pickers, known configs, secrets, diagnostics, `open_bing_sitescan`) | implemented |
| Bing indexing actions (sitemap submit, IndexNow from sitemap, Site Scan opener) | implemented in `0.7.0`; requires engine `0.9.0`; Site Scan only opens the official page |
| Bing URL submission and read-only sitemap/issue/quota views | implemented in `0.8.0`; requires engine `0.10.0`; accepted is not indexed |
| Read-only Diagnostics screen (Google, Yandex, Bing, Metrika, Core Web Vitals) | implemented in `0.9.0`; requires engine `0.11.0`; 18 allow-listed read commands, no writes |
| OAuth Connect card (Google Search Console, Yandex Webmaster, Metrika) | implemented in `0.9.1`; requires engine `0.13.1`; tokens stay in the OS keychain, no token is rendered |
| Read-only Indexing automation card (queue, quotas, last run, day/provider history, host job state) | implemented in `0.9.2`; requires engine `0.13.1`; no write control, no confirm token |
| OAuth readiness in the Connect card (eight states, next action, expiry, recorded scopes) | implemented in `0.9.3`; requires engine `0.14.0`; no token or secret is rendered |
| Hidden Windows scheduled jobs (`.vbs` launcher via `wscript //B`) | implemented in `0.9.4` via engine `0.14.1`; no console window; existing tasks need one reinstall |
| Crawl rule packs (security headers, TLS, Schema.org, accessibility) | implemented in engine `0.15.1`, bundled by `0.9.5`; 34 rules, no UI change |
| Cancellable background runs (`run_cancel`, run banner) | implemented in `0.6.0` |
| React screens (onboarding, dashboard, crawl, logs, tasks, portfolio, settings, configuration, reports, recommendations, integrations, diagnostics, backup) | implemented |
| Bundled onedir sidecar | all four targets built in CI and by the release workflow; the Windows x64 pin records the reviewed `0.15.1` build, Linux/macOS reviewed pins remain `null` and are covered by rebuild-aware CI checksum reports |
| Published installers | `0.9.5`: Windows x64, Linux x64, macOS arm64/x64; `0.9.4`, `0.9.3`, `0.9.2`, `0.9.1`, `0.9.0`, `0.8.0`, `0.7.0`, `0.6.0`, `0.5.0`, `0.4.0` and `0.3.0` remain available for rollback |
| Install checks | `0.2.2`: macOS 27.2 arm64 DMG installed and launched with engine `0.5.2`; deb and AppImage (FUSE mount and extract-and-run fallback) on Ubuntu 24.04 and rpm on Fedora 45 installed and launched with engine `0.5.2`; Linux updater signatures verified against the embedded key |
| Auto-update | Windows NSIS, macOS `.app`, Linux AppImage; `0.2.0 → 0.2.1` through `0.8.0 → 0.9.0` verified end-to-end on Windows NSIS; `0.9.4 → 0.9.5` is the next in-app update; the macOS/Linux `0.9.5` update paths still need a re-run on a machine with the previous release installed; deb/rpm/MSI/portable ZIP are manual |
| `lv24-seo stats --json` engine command | shipped since `lv24-seo 0.5.2`; bundled `0.15.1`; fixture committed |

`0.1.0` remains available as a Windows-only preview. It has no updater; install `0.9.3` manually
once. Follow the [issues](https://github.com/LevapVeeskela/lv24-seo-optimizer-desktop/issues) for
progress, or read the implementation plan in the engine repository:
[`docs/plans/2026-11-14-seo-desktop.md`](https://github.com/LevapVeeskela/lv24-seo-optimizer/blob/main/docs/plans/2026-11-14-seo-desktop.md).

## Zero-spend policy

The default path uses free tiers only: GitHub-hosted standard runners, PyPI, npm, Tauri's free
updater signing keys (minisign), SQLite and the user's own provider credentials. There is no paid CI
runner, no paid code-signing certificate, no notarization, no hosted backend and no telemetry
service. The release workflow is manual and owner-gated. See [`docs/release.md`](docs/release.md).

## Contributing

Bug reports, provider-limit corrections and documentation fixes are welcome. Read
[`CONTRIBUTING.md`](CONTRIBUTING.md) and [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). For security
issues, use [`SECURITY.md`](SECURITY.md).

## License

Apache-2.0. See [`LICENSE`](LICENSE). Provider data belongs to the property owner; this project does
not resell it.

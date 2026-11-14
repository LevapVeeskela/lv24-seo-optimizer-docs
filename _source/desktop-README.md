# LV24 SEO Optimizer Desktop

**A local, offline-first desktop control plane for [`lv24-seo`](https://github.com/LevapVeeskela/lv24-seo-optimizer).**
The Python CLI remains the engine of record; the desktop is a Tauri v2 shell, a React UI and a
careful process bridge around it. No cloud account, no telemetry, no local HTTP API, no SERP
scraping.

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Status: pre-release](https://img.shields.io/badge/status-pre--release-orange.svg)](#public-status)
[![Engine: lv24-seo 0.5.1](https://img.shields.io/badge/engine-lv24--seo%200.5.1-informational.svg)](contracts/README.md)

> **0.2.0 multi-platform preview.** Windows, Linux and macOS installers are published. Windows NSIS,
> macOS `.app` and Linux AppImage can auto-update from `0.2.0` onward; deb, rpm, MSI and the portable
> ZIP are manual-only. `0.1.0` has no updater and must be upgraded manually once. The pinned engine
> is `lv24-seo 0.5.1`, which ships the `stats` command described by
> [`contracts/stats-v1.md`](contracts/stats-v1.md). Read [Public status](#public-status) before
> relying on anything here.

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
- **A stats dashboard** built on the bounded `lv24-seo stats --json` envelope:
  current values, previous-period comparison, coverage, data age, truncation and limitations.
- **A report view** for the weekly digest: headline, the sections the engine returns, limitations,
  warnings and the generated local HTML report, which opens in your default browser.
- **Configuration output** that is safe to copy: effective redacted JSON, read-only Source TOML with
  secret-looking values redacted, saved-vs-draft diff, validation errors, doctor diagnostics and
  environment-override names.
- **A recommendations-to-agent workflow**: review findings, copy a bounded Markdown prompt or export
  it as `.md`, hand it to a coding agent, then re-run the report to verify the fix.
- **Explicit write gates** for delivery, schedule installation, MCP client installation and any
  provider write action.
- **Signed in-app updates** for the bundle types that can replace themselves, with a manual release
  page for the rest.

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
Full notes, install steps and limitations: [`docs/releases/0.2.0.md`](docs/releases/0.2.0.md).

| Platform | Assets | Auto-update |
|---|---|---|
| Windows 10/11 x64 | `LV24.SEO.Optimizer_0.2.0_x64-setup.exe` (+ `.exe.sig`), `LV24-SEO-Optimizer_0.2.0_x64-portable.zip` | NSIS only; portable ZIP is manual |
| Linux x64 | AppImage (+ `.AppImage.sig`), deb, rpm | AppImage only; deb/rpm are manual |
| macOS 13+ arm64/x64 | DMG, `.app.tar.gz` (+ `.sig`) | `.app` only; DMG is the first install |

The `0.2.0` release also publishes `latest.json` and `SHA256SUMS.txt`. Verify the checksum before
running an installer. `SHA256SUMS.txt` covers every published asset, including updater signatures
and `latest.json`.

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

`0.1.0` has no updater, endpoint or public key. Install `0.2.0` manually once (NSIS installer or
portable ZIP). Auto-update works from `0.2.0` onward when the installed bundle is Windows NSIS,
macOS `.app` or Linux AppImage.

## Auto-update

The updater endpoint is
`https://github.com/LevapVeeskela/lv24-seo-optimizer-desktop/releases/latest/download/latest.json`.
The app checks it once at startup (silently, 30-second timeout) and when you press **Check for
updates** in Settings.

- **User confirms.** The app never downloads or installs an update on its own. The panel shows the
  version and notes; **Download and install** starts the update. An unsaved configuration draft
  disables the button.
- **Signature verified.** Packages are signed with a minisign/Ed25519 key whose public key is
  embedded in the app. `requireSignedVersion` binds the announced version to the signed package. A
  signature failure blocks that artifact and points to the release page; it is not retried.
- **No downgrades.** Only a version greater than the running one is accepted.
- **No auto-install.** Windows runs the signed NSIS setup in passive mode; macOS replaces the
  `.app`; Linux replaces the AppImage. The app restarts after installation; the NSIS installer
  handles the Windows restart.
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
| Rust | 1.90+ | Tauri shell; `rustfmt` and `clippy` |
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
python scripts/build-sidecar.py --engine-version 0.5.1 --target x86_64-pc-windows-msvc
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
python scripts/build-sidecar.py --engine-version 0.5.1 --target x86_64-unknown-linux-gnu
npm run tauri build -- --target x86_64-unknown-linux-gnu --bundles appimage,deb,rpm

python scripts/build-sidecar.py --engine-version 0.5.1 --target aarch64-apple-darwin
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
npm run build
npm run contract:check     # regenerate contracts and fail on drift
cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
```

## Supported providers

Provider support comes from the pinned `lv24-seo` engine, not from the desktop. The desktop adds
settings, health status and presentation; it does not add provider adapters.

| Provider | Free tier | Used for | Write actions |
|---|---|---|---|
| Google Search Console | yes (OAuth token today) | queries, pages, countries, devices, URL inspection | sitemap submit is disabled in the engine |
| Yandex Webmaster | yes (OAuth) | queries, indexing history, diagnostics | recrawl is disabled in the engine |
| Yandex Metrika | yes | sessions and users | none |
| Bing Webmaster + IndexNow | yes | queries, crawl issues, instant URL ping | IndexNow submit, explicitly gated |
| Chrome UX Report | yes (API key) | origin-level field Core Web Vitals | none |
| PageSpeed Insights | yes | lab audits per URL | none |
| Your own site | — | crawl, robots, sitemap, JSON-LD, hreflang, links | none |
| nginx access logs | — | Python analysis helpers (no desktop ingest yet) | none |

The desktop never asks for a paid provider key. Optional paid adapters in the engine are
bring-your-own-key and are not part of the default path.

## Stats dashboard

The dashboard renders the stats envelope; it is not a new metric engine. The contract is
[`contracts/stats-v1.md`](contracts/stats-v1.md) and `lv24-seo 0.5.1` ships the command:

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
marked offline and the affected screens show a notice with the desktop and engine versions; the
desktop does not silently run an older engine or fake a compatibility dialog.

## Reports

The Reports screen runs `report weekly --days 7 --lag-days 2 --json` with
`--out <app data>/exports/reports`. The engine writes `report.json` and `report.html` into that
directory. The screen reads the HTML path from the envelope (`meta.artifacts.html`) and opens it in
your default browser through the Rust `open_path` command, which requires an absolute path, an
approved root and an allowed extension (`.html` included). The desktop never renders the report HTML
inside its own webview.

## Settings and configuration outputs

Settings are grouped by project, providers, report/delivery, crawl, storage and desktop preferences.
Every field has a label, help text, a visible default and validation. Reserved engine fields
(`crawl.concurrency`, `storage.raw_retention_days`, `report.week_start`,
`report.telegram.severity`, `providers.yandex_metrika.goals`) are labelled **no effect**, never
presented as working controls.

The **Settings** screen is the editable form. The **Configuration** screen is the read-only output
and diagnostics view with seven tabs:

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
the file. Token values are never persisted by the webview, logged or shown back; the password field
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
  still travels only over stdin.
- **No local HTTP API.** The desktop talks to the engine through a fixed, allow-listed process
  bridge. There is no loopback server to authenticate, proxy or expose.
- **No telemetry.** Nothing is uploaded automatically except the updater's request for
  `latest.json`; diagnostics copies are user-triggered and redacted.
- **Strict CSP.** Production builds allow only local assets and Tauri IPC; the development CSP is
  limited to the Vite origin.
- **Command and path allow-lists.** No shell strings, no arbitrary executables. Config paths are
  absolute and chosen through the native dialog; open/export paths are restricted to approved roots.
- **Signed updates.** The updater verifies a minisign/Ed25519 signature, binds the version to the
  signed package and refuses downgrades. A signature failure blocks the artifact.
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
| Contracts (`config.schema.json`, CLI fixtures incl. `stats`) | generated from `lv24-seo 0.5.1`; drift check in CI |
| CI (web, Rust matrix, contract check) | active on pull requests and `main`; standard runners only |
| Manual desktop build workflow (NSIS, DMG, AppImage, deb, rpm) | available; owner-triggered; publish requires the updater key |
| Tauri command bridge (config read/validate/write/patch, CLI runner, secrets, diagnostics) | implemented |
| React screens (dashboard, settings, configuration, reports, recommendations) | implemented |
| Bundled onedir sidecar | all four targets built in CI; Windows x64 has a reviewed local pin, Linux/macOS pins are pending, CI records rebuild-aware hashes |
| Published installers | `0.2.0`: Windows x64, Linux x64, macOS arm64/x64 |
| Auto-update | Windows NSIS, macOS `.app`, Linux AppImage; deb/rpm/MSI/portable ZIP are manual |
| `lv24-seo stats --json` engine command | shipped in `lv24-seo 0.5.1`; fixture committed |

`0.1.0` remains available as a Windows-only preview. It has no updater; install `0.2.0` manually
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

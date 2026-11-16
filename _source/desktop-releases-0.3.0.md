# LV24 SEO Optimizer Desktop 0.3.0

**Status: released (2026-11-16).** `0.3.0` is published on GitHub Releases for Windows x64, Linux x64
and macOS arm64/x64. The latest published line is `0.3.0`; `0.2.3` remains available for rollback and
as the previous in-app update source. See [`0.2.3.md`](0.2.3.md) for that release's notes.

| | |
|---|---|
| Desktop version | `0.3.0` (released 2026-11-16) |
| Bundled engine | `lv24-seo 0.5.3` (unchanged from `0.2.3`) |
| Minimum engine | `lv24-seo 0.5.2` (`MIN_ENGINE_VERSION`) |
| Contracts | generated from `lv24-seo 0.5.3` |
| Platforms | Windows x64, Linux x64, macOS arm64 and x64 |
| Auto-update | Windows NSIS, macOS `.app`, Linux AppImage (unchanged) |
| Manual-only | deb, rpm, MSI, portable ZIP (unchanged) |
| OS signing | Windows unsigned, macOS ad-hoc, Linux unsigned (unchanged) |

## New

### Onboarding: a project without the terminal

- **New project wizard.** Three steps — project folder, site, review — run `lv24-seo init`
  through the shell. The folder becomes the workspace; `seo.toml` and `data/` are created inside
  it, and the wizard shows the exact config and data paths before creating anything. The site field
  accepts an absolute `http(s)` URL, `http://localhost:3000` or an `sc-domain:` property.
- **Existing configs are not overwritten.** A folder that already contains `seo.toml` offers
  **Open existing seo.toml** instead of creating a second project, and the wizard prints the
  equivalent terminal command for people who prefer the CLI.
- **Persisted known configs.** `knownConfigs` in the desktop `settings.json` records config paths
  the user picked or created (canonical, deduplicated, capped at 20). A config opened in an earlier
  run can be re-activated after a restart without the dialog; it is still validated by the shell, so
  the list is a convenience, not a permission bypass.
- **Recents and the site chip.** The header chip shows the active workspace folder and opens a menu
  with up to 8 recent workspaces, each removable, plus **Clear recents**. A moved or deleted config
  is reported as missing instead of failing every later call.
- **Properties panel.** The dashboard renders `lv24-seo properties`: configured providers, their
  target and token presence (`present`, `missing`, `not required`, `unknown`) with a direct link to
  the matching settings section.

### Crawl screen

- Start URL and a maximum-URL budget are validated in the UI and again by the shell; the run uses the
  same bounded `lv24-seo crawl --json` envelope as the CLI.
- Summary counters (URLs, fetched, errors, blocked, issues, sitemap, requests) plus an explicit
  truncated badge, engine warnings and limitations.
- Issue filters for severity, rule and free-text search over URL and detail, with facets taken from
  the result and a reset action. The table renders at most 500 rows to keep the DOM bounded; the
  export contains every row the engine returned.
- **JSON and CSV export** into the app export folder; the CSV columns are
  `severity,rule_id,url,detail`.
- Switching workspace resets the screen, so another project's crawl never stays on display.

### Reports: comparison and export

- **Compare with previous.** Compares the two newest stored weekly snapshots without calling a
  provider: headline metrics with absolute and percentage deltas, issues added/resolved/unchanged,
  opportunities, and limitations that were added or lifted. Snapshots that cannot be compared
  (different property, different period, a metric missing from one side) are labelled
  **not comparable** instead of being silently diffed.
- **JSON and CSV export.** JSON uses the documented `lv24-seo.report/v1` payload
  (`schema`, `kind`, `property_id`, `period`, `generated_at`, `headline`, `sections`, `limitations`,
  `warnings`, `meta`); CSV is flat with `section,metric,value,delta`. Sections and rows are copied
  from the engine report — the desktop does not re-derive metrics.
- The existing HTML report and **Open HTML** action are unchanged.

### Settings: save workflow and draft protection

- The save bar is **sticky** at the bottom of the settings page and shows dirty/clean state, the
  number of changed fields, validation errors and warnings, and the last backup.
- **Ctrl+S / Cmd+S** saves from anywhere on the page; the handler ignores key repeat, IME
  composition, modified chords and already-handled events.
- **Only changed** filters the form to fields that differ from `seo.toml` (plus fields with a
  validation problem), so a large config does not need to be scrolled end to end.
- **App-wide draft guard.** Leaving Settings, switching workspace, reloading the config or closing
  the window asks before discarding unsaved edits. Window close is intercepted through
  `core:window:allow-destroy` and only proceeds after confirmation; when the shell cannot install the
  guard, the UI says so instead of trapping the window.

### Recommendations

- Search across title, action, query and page; sort by report order or by severity (critical first or
  low first).
- Bulk actions on the visible set: **Queue all visible** into the agent queue and **Export all
  visible** as Markdown tasks. A partial export reports how many tasks were written and how many
  failed; an empty selection or missing export folder is stated, not silently ignored.

### Integrations

- **MCP snippets** for Claude Desktop, OpenCode, VS Code and Cursor, in JSON, plus a TOML form for
  TOML-based hosts such as Codex CLI. The snippet names the bundled engine or the `lv24-seo` command,
  shows the host config path, and contains no tokens — the MCP server reads credentials from the OS
  keychain or `LV24_SEO_*` variables.
- **Scheduled runs are print-only.** The screen renders the `lv24-seo schedule print` artifact for
  cron, systemd user timers or Windows Task Scheduler. It never installs a cron entry, unit or task
  and never edits host client configs; the badge and hint say so.

### Reporting window and run status

- **Per-workspace window.** 7, 28 or 90 days and a provider lag of 2 or 3 days, saved per `seo.toml`
  path, with the resulting active period shown, a reset action and a **window changed; refresh to
  apply** badge. Stats and the weekly report use the same values.
- **Honest run status.** Live elapsed time while a call runs, the last run's duration and timestamp,
  truncation/complete and limitation badges, and an explicit note that `0.3.0` has no cancel button.
  The duration is the engine's `meta.duration_ms` when present; otherwise the app's wall time is
  shown and labelled as measured.

### Shell and security

- New allow-listed CLI commands: `init` (create a project) and `schedule_print` (render a scheduler
  artifact). `schedule_print` must target the active config.
- New `pick_directory` command: a native directory dialog whose result is approved for `init`, so a
  compromised webview cannot create a config in an arbitrary folder.
- `knownConfigs` persistence in `settings.json` (see onboarding), validated on load and on write.
- New `core:window:allow-destroy` capability, used only by the confirmed-discard close path.

### Contracts

- The committed contracts remain those generated from `lv24-seo 0.5.3`
  (`node scripts/check-contracts.mjs --static` passes). The engine pin and the reviewed Windows
  `sha256`/`size` in `scripts/cli-checksums.json` are unchanged from `0.2.3`.

## Verification

- **Published:** 18 assets on the `v0.3.0` GitHub release for Windows x64, Linux x64 and macOS
  arm64/x64, including the Windows portable `.zip.sha256` sidecar; the release gate recomputed it
  against the archive and `SHA256SUMS.txt` covers every published asset.
- **CI:** green for Linux x64, Windows x64 and macOS arm64 + x64 on the release commit.
- **In-app update:** `0.2.3 → 0.3.0` was verified on Windows through the new Rust updater — download,
  signature verification, install and relaunch. The relaunched UI reports Desktop `0.3.0`,
  Engine `0.5.3` and engine ready.
- **Sidecars:** the Linux and macOS sidecars were built by the release workflow and their
  rebuild-aware checksum reports passed the release gate. The Windows x64 sidecar pin from `0.2.3`
  still verifies (`verify-sidecar --require-pinned`); the engine does not change in `0.3.0`.
- **Gates:** `npm run typecheck`, `npm test`, `npm run build`, `npm run test:release`,
  `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test --all-targets`,
  `cargo build --release --locked` and `node scripts/check-contracts.mjs --static` passed on the
  release commit.
- **Tests:** unit tests cover the new screens and stores — onboarding validation and `init`
  arguments, workspace recents and known-config activation, crawl filters/sorting/export, report diff
  and export serializers, settings save shortcut, changed-only filtering and the close guard,
  recommendation search/sort/bulk, MCP snippet generation and schedule print, window persistence and
  run-status duration sources.

## Upgrade and known limitations

- Upgrading is unchanged: Windows NSIS, macOS `.app` and Linux AppImage update in place; deb, rpm,
  MSI and the portable ZIP remain manual. `0.1.0` still needs one manual install.
- **No cancel and no background runs in `0.3.0`.** A crawl, report build or stats refresh runs to
  completion; the UI shows elapsed time but cannot stop it, and leaving the screen does not move the
  run to a background queue.
- **Schedule output is print-only.** No scheduler job is installed, no MCP client config is edited
  and no provider write is performed from the desktop.
- Linux and macOS sidecar pins remain `null` in `scripts/cli-checksums.json`; the release workflow
  builds those sidecars and the release gate requires a rebuild-aware checksum report per target.
- `MIN_ENGINE_VERSION` remains `0.5.2`, so a `0.5.2` engine is still accepted even though the bundle
  ships `0.5.3`.
- OS packages remain unsigned (Windows, Linux) or ad-hoc signed (macOS); SmartScreen, Gatekeeper and
  antivirus warnings are possible. Verify `SHA256SUMS.txt`.
- Config-path approval is per process plus the persisted `knownConfigs` list; a path outside both
  still needs the native dialog.
- The Windows portable ZIP and deb/rpm/MSI cannot update themselves; the UI links to the release page
  for those bundle types.

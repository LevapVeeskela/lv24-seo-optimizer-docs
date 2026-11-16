---
title: Desktop app
description: What the LV24 SEO Optimizer desktop shell adds, how signed updates work, and the 0.6.0 cancellable runs with the 0.5.0 and older history.
---

# Desktop app

LV24 SEO Optimizer Desktop is a local, offline-first Tauri v2 shell around the `lv24-seo` engine. The Python CLI remains the engine of record: it owns provider clients, crawl rules, analysis, report builders and delivery. The desktop adds a React UI and a Rust process bridge, not a second SEO implementation.

The `0.6.0` release bundles `lv24-seo 0.8.0` as a PyInstaller onedir sidecar and adds cancellable background runs. It requires engine `0.8.0` or newer (`MIN_ENGINE_VERSION`). There is no cloud account, no telemetry, no local HTTP API and no SERP scraping. The desktop talks to the engine through a fixed, allow-listed child-process bridge.

## What it adds

- **Workspace picker and onboarding.** Choose the `seo.toml` the engine should use through a native file dialog in Settings, or create a project with the three-step wizard that runs `lv24-seo init` and shows the exact config and data paths first. The selected config path is the workspace identity; a header site chip opens up to 8 recent workspaces, and a moved or deleted config is reported as missing and can be re-selected instead of blocking startup.
- **Stats dashboard.** Renders the bounded `stats` envelope: one card per configured provider, current values, previous-window comparison, coverage, data age, truncation and limitations. CTR changes are shown in percentage points. There is no zero-fill and no cross-engine total; unknown stays unknown. A properties panel renders `lv24-seo properties` with token presence per provider.
- **Settings form and configuration outputs.** The Settings screen is the editable form. The Configuration screen is read-only and has Overview, Effective, Source TOML, Diff, Validation, Doctor and Environment tabs. Source TOML is redacted and read-only; there is no raw TOML editor. Saves use field-level patches, keep comments and key order, validate with the engine, create a timestamped backup (last five kept) and replace the file atomically. In `0.6.0` the temp file and backup are mode `0600` on POSIX and carry an owner-only DACL on Windows, both are fsynced, and the parent directory is fsynced after the rename. Reads are bounded at 8 MiB; settings load per field; Windows reserved device names and trailing dots/spaces are rejected in every path component. GSC service accounts are configured outside the form: set `providers.gsc.service_account_file` or `LV24_SEO_GSC_SERVICE_ACCOUNT_FILE`, and the Configuration screen shows the effective redacted config.
- **Reports.** Runs the weekly report locally, writes `report.json` and `report.html` under the app data directory, and opens the HTML in your default browser. The report HTML is never embedded in the app webview. It compares the two newest stored snapshots, exports JSON (`lv24-seo.report/v1`) or CSV, renders the engine's attributed change digest with cause, confidence, evidence rows and next action, and shows the Core Web Vitals card per URL template and device.
- **Recommendations and an agent queue.** Turns report and stats findings into bounded Markdown prompts. Search and sort them, copy one, export it as `.md`, or queue or export all visible tasks. The queue is stored in the webview's local storage; nothing is submitted automatically.
- **Secrets over stdin.** Token input is a password field sent once over IPC. The Rust layer pipes it to `lv24-seo auth set --provider <p> --stdin`, zeroizes its buffer and never writes the value to a log, MobX store, localStorage, clipboard or diagnostics bundle. After saving, the UI shows only presence and source.
- **Yandex Metrika token.** `0.6.0` keeps the separate `metrika` provider (`yandex_metrika_token`) in the TypeScript and Rust allow-lists, the Settings badge, the secret modal and the en/ru/zh labels. The Metrika counter never borrows the Webmaster token. Engine `0.8.0` fixes the Metrika `stat/v1/data` offset, so the card is no longer configured but empty.
- **One secret store with the CLI.** The desktop runs the same engine under the same OS user, so a token stored by `lv24-seo auth set` in a terminal is visible in the desktop and a token stored in the desktop is visible to the CLI. The OS keychain entry uses service `lv24-seo` and the same secret name. `LV24_SEO_*` environment variables are inherited but shown as read-only in the UI: the desktop cannot remove an environment variable, and it says so instead of offering a delete button that does nothing. The opt-in `<data-dir>/secrets.json` fallback is shared only when both surfaces open the same workspace/data directory.
- **Crawl screen.** A bounded `lv24-seo crawl --json` run with summary counters, a truncated badge, engine warnings and limitations; issue filters for severity, rule and free-text search; a table capped at 500 rendered rows while the JSON and CSV export contains every returned row. Switching workspace resets the screen.
- **Integrations and run status.** MCP snippets for Claude Desktop, OpenCode, VS Code and Cursor in JSON, plus a TOML form for hosts such as Codex CLI; snippets contain no tokens. Scheduled runs can be previewed as a `lv24-seo schedule print` artifact or installed on this host after a confirmation dialog that names the config and job kind; the install appends `--allow-write` only after that confirmation. Runs show live elapsed time, the last duration and timestamp, and truncation or limitation badges.
- **Cancellable background runs.** Crawl, weekly report, log analysis, backup create/restore and schedule install run as background child processes with a stable run id. A window-wide banner shows the kind, elapsed time, status and a **Cancel** button; leaving the route does not clear it. Cancel signals only the exact child PID this app registered for that run (and its process group on Unix), after checking it is still an engine image or a tracked child; it never matches by name. An unknown or finished run returns `false`, and the UI does not claim a cancellation then. A cancelled run returns `RUN_CANCELLED`, shown separately from succeeded and failed runs. Cancellation is not rollback and there is no job queue.
- **Logs page.** A native `pick_log_file` dialog selects one nginx JSON access log (at most 100 MiB); any other path is `PATH_NOT_APPROVED`. The page shows a bot filter, parse summary, crawl waste with the by-bot split, a bot rollup table and JSON/CSV export. Bots are User-Agent only and the page labels the result as triage.
- **Tasks page.** Newest-first findings with property, kind, state, rule, URL, timestamps and stored evidence; filters and a row limit up to 500. State changes follow the allowed transitions, and the add form is idempotent with a 16 KiB evidence cap.
- **Backup page.** `backup create` writes a portable archive into the export folder or a folder chosen in the native dialog; the panel shows the path, size, SHA-256, database inclusion, property and snapshot counts and the member table. The restore section plans from an archive chosen in the native dialog and applies only after confirmation with the plan token; the current database and config are copied to `.pre-restore-<utc>` before replacement.
- **Portfolio page.** Choose a folder through the native directory dialog; the engine scans up to three levels for `seo.toml` and inspects at most 50 sites. Summary counts, sorting and filtering, and opening a row switches the workspace through the normal shell flow. The scan calls no provider, reads no token and writes nothing.
- **Update panel.** Checks a signed `latest.json` at startup and on demand, shows release notes, and installs only after you confirm. Before the installer starts, it stops only the engine sidecar PIDs this app instance registered; if one cannot be stopped, the install is blocked with `UPDATE_ENGINE_BUSY`. The download and install run in Rust, not in the webview, and a download can be cancelled before the installer starts.

The dashboard and Reports screen are built on the same engine commands a terminal uses:

```bash
lv24-seo stats --days 7 --lag-days 2 --json
lv24-seo report weekly --days 7 --lag-days 2 --json
```

## Install types

Download desktop assets from the project's Releases page. The desktop is separate from the Python engine install; the shell can use its bundled sidecar, an explicit `LV24_SEO_BIN`, a sibling portable layout, or the Linux AppImage tree under `$APPDIR/usr/lib/<product>/engine/lv24-seo/`.

| Bundle | How it is installed | In-app update |
|---|---|---|
| Windows NSIS | `LV24.SEO.Optimizer_0.6.0_x64-setup.exe` | Yes |
| Windows portable ZIP | `LV24-SEO-Optimizer_0.6.0_x64-portable.zip`; extract the whole folder and run `lv24-seo-desktop.exe` | No |
| Linux AppImage | `LV24.SEO.Optimizer_0.6.0_amd64.AppImage`; `chmod +x` and run | Yes |
| Linux deb | `LV24.SEO.Optimizer_0.6.0_amd64.deb`; `sudo apt install ./*_amd64.deb` | No |
| Linux rpm | `LV24.SEO.Optimizer-0.6.0-1.x86_64.rpm`; `sudo dnf install ./*_amd64.rpm` | No |
| macOS `.app` from DMG | `LV24.SEO.Optimizer_0.6.0_aarch64.dmg` or `LV24.SEO.Optimizer_0.6.0_x64.dmg`; drag to Applications | Yes |
| MSI | Not produced by this project | No |

Windows requires Windows 10/11 x64 and WebView2. Linux is x64 only and built on Ubuntu 22.04 with a glibc 2.35 baseline. macOS requires 13 or newer; use the arm64 DMG on Apple silicon and the x64 DMG on Intel. The OS packages are unsigned or ad-hoc signed, so SmartScreen and Gatekeeper warnings are expected. Verify `SHA256SUMS.txt` before running an installer.

## How updates work

The updater reads a signed `latest.json` from the project's GitHub Releases endpoint. Packages are signed with a minisign/Ed25519 key whose public key is embedded in the app. `requireSignedVersion` is enabled, so the announced version is bound to the signed package.

- The app checks once at startup, silently, with a 30-second timeout, and when you press **Check for updates**.
- Nothing is downloaded or installed automatically. The panel shows the version and notes; **Download and install** starts the update. An unsaved configuration draft disables the button. From `0.2.3` the panel can cancel a download before the installer starts.
- Only a version greater than the running one is accepted. The updater cannot downgrade the app, and the shell refuses a release whose version differs from the one the panel announced.
- A signature failure blocks that artifact, marks the error as non-retryable and points to the release page. It is not retried and is not downgraded to an offline warning.
- Immediately before the installer starts, `prepare_update` stops only the engine sidecar PIDs this app instance spawned. Nothing is matched by image name, so another installed copy, a portable build or a terminal run is untouched. If cleanup fails, the install is blocked with `UPDATE_ENGINE_BUSY`; close the run that holds the sidecar and retry.
- Windows runs the signed NSIS setup in passive mode; macOS replaces the `.app`; Linux replaces the AppImage. The app restarts after installation; the NSIS installer handles the Windows restart.

### Auto-update matrix

| Bundle | Auto-update | What happens |
|---|---|---|
| Windows NSIS | Yes | Downloads the signed setup `.exe`, stops tracked sidecar PIDs, runs it in passive mode, relaunches |
| macOS `.app` | Yes | Downloads the signed `.app.tar.gz`, replaces the app, relaunches |
| Linux AppImage | Yes | Downloads the signed AppImage, replaces it, relaunches |
| Windows portable ZIP | No | The update panel links to the release page; download and extract a new ZIP |
| Linux deb | No | The update panel links to the release page; upgrade with the package manager |
| Linux rpm | No | The update panel links to the release page; upgrade with the package manager |
| MSI | No | No MSI is produced; an MSI install is treated as manual |
| Unknown bundle | No | The update panel links to the release page |

Manual-only is deliberate. A deb/rpm install is owned by the distribution's package database, an MSI is not produced by this project, and a portable ZIP has no installer to replace. The desktop reports the installed bundle type and disables the in-app installer for those cases; it does not pretend a manual package was updated.

The `0.2.0 → 0.2.1` update was verified end-to-end. The `0.2.1 → 0.2.2` update was verified on Windows:
an installed `0.2.1` build detected `0.2.2`, downloaded and verified the signed package, installed it in
passive mode, relaunched, and reported `0.2.2` with engine `0.5.2` ready. The `0.2.2 → 0.2.3` update was
verified the same way: an installed `0.2.2` build reported **Desktop 0.2.3** with **Engine 0.5.3** and the
engine ready after the in-app update. The `0.2.3 → 0.3.0` update was verified through the Rust
updater: an installed `0.2.3` build reported **Desktop 0.3.0** with **Engine 0.5.3** and the engine ready.
The `0.3.0 → 0.4.0` update was verified the same way: an installed `0.3.0` build reported
**Desktop 0.4.0** with **Engine 0.6.0** and the engine ready. The `0.4.0 → 0.5.0` update was verified
through the Rust updater: an installed `0.4.0` build reported **Desktop 0.5.0** with **Engine 0.7.0**
and the engine ready, and the Portfolio page loads. The `0.5.0 → 0.6.0` update was verified through
the same updater: an installed `0.5.0` build reported **Desktop 0.6.0** with **Engine 0.8.0** and the
engine ready, and the real `lv24.by` workspace loaded. Any `0.2.x` install can jump straight to
`0.6.0`.

For `0.2.2`, installs were also checked on macOS and Linux: the arm64 DMG on macOS 27.2 passed
`codesign --verify --deep --strict`, launched with engine `0.5.2` ready and fetched the `0.2.2`
manifest; the deb on Ubuntu 24.04, the AppImage extract-and-run fallback and the rpm on Fedora 45
installed, launched and reported `Engine ready` with engine `0.5.2`; the direct AppImage FUSE mount
was also verified in WSL2.

The `0.2.1 → 0.2.2` update runs the old `0.2.1` updater, which does not include the new tracked-PID
cleanup. If a sidecar is active during that first update, retry after it exits or install `0.2.2`
manually. `0.2.2 → 0.2.3` uses the tracked-PID cleanup and blocks with `UPDATE_ENGINE_BUSY` if a
tracked sidecar cannot be stopped.

## 0.6.0 cancellable runs

Released on 2026-11-16. It bundles `lv24-seo 0.8.0` and requires `MIN_ENGINE_VERSION` `0.8.0`, so a `0.7.x`
engine is reported as incompatible.

- **Background runs and cancel.** `crawl`, `report_weekly`, `logs_analyze`, `backup_create`, `backup_restore`
  and `schedule_install` accept a stable run id from the webview. The Rust runner registers
  `run id → exact child PID` before the spawn; a run id for any other command is `RUN_NOT_CANCELLABLE`, so
  short reads keep their synchronous path. The run lives in one root `RunStore`: a window-wide banner shows
  kind, elapsed time, status and **Cancel**, leaving the route does not clear it, every active run is listed,
  and the newest cancelled run stays until dismissed. `run_cancel(runId)` signals only the exact registered
  child (and its process group on Unix) after checking it is still an engine image or a tracked child; it
  never matches by name. An unknown or finished run returns `false`, and a cancelled run returns
  `RUN_CANCELLED`, shown separately from succeeded and failed runs.
- **Schedule install opt-in.** Engine `0.8.0` made `schedule install` plan-only by default. The desktop asks
  for confirmation and appends `--allow-write` only after the user confirms the plan it showed; the shell
  still refuses an install without `allowWrite=true` with `CONFIRM_REQUIRED` before spawning the engine. A
  plan-only preview and the print-only artifact remain available, and an install is cancellable like the
  other long jobs.
- **Engine 0.8.0.** The sidecar adds GSC service accounts, the `cwv collect` writer, `backup restore --to`,
  `schedule status`/`uninstall`, richer Yandex indicators, the Metrika 1-based offset fix and the Windows
  JSON output fix. `properties` gains `token_source` and `doctor` gains `gsc_auth`; `MIN_ENGINE_VERSION` is
  `0.8.0` because the mandatory `schedule install --allow-write` opt-in needs it.
- **Shell and contracts.** Contracts were regenerated from `lv24-seo 0.8.0`; the additive changes are the
  `gsc_auth` check, `properties.token_source` and `providers.gsc.service_account_file` in
  `config.schema.json`. The contract generator pins `PYTHON_KEYRING_BACKEND` to the null backend so a
  developer machine with real provider tokens cannot leak token presence into the fixtures.

Known limits in 0.6.0:

- Cancel is not rollback and there is no job queue. A cancelled run may leave a partial report, crawl, backup
  or scheduler artefact; a cancelled in-place restore keeps the pre-restore copy but may have replaced one
  file, so build a fresh plan before retrying.
- Schedule install mutates the host only after confirmation and only on this computer; the desktop does not
  manage, repair or uninstall the job. Use `schedule status`/`schedule uninstall` in the CLI.
- GSC service accounts are configured outside the form, and `cwv collect` and `backup restore --to` are
  CLI-only; the desktop renders stored CWV rows and plans in-place restores.
- `MIN_ENGINE_VERSION` is `0.8.0`, so a `0.7.x` engine is rejected.

## 0.5.0 restore, portfolio and CWV

Released on 2026-11-16. It bundles `lv24-seo 0.7.0` and requires `MIN_ENGINE_VERSION` `0.7.0`, so a `0.6.x`
engine is reported as incompatible.

- **Restore.** The backup panel adds a restore section. `pick_backup_archive` selects the archive; the first
  call only plans, and **Restore now** stays disabled until a token exists. Applying shows a confirmation dialog
  and calls `backup_restore` with `--allow-write` and the plan token. The plan shows the archive and manifest
  hashes, the target config and data directory, the current and archived database hashes, the config action
  (`create`, `replace` or `write_alongside`) and the 300-second token lifetime. A changed archive, a changed
  workspace, an expired token or a replay is `CONFIRM_REQUIRED`.
- **Schedule install.** The Integrations schedule card has **Preview artifact** and **Install on this host**.
  An install writes a cron entry, a systemd user timer or a Windows Task Scheduler task for a weekly or daily
  report after a confirmation dialog that names the config and job kind; it touches only the local host.
- **Portfolio.** The Portfolio page scans up to three levels below a chosen folder for `seo.toml` and inspects
  at most 50 sites per scan. Rows carry config path, name, property, base URL, data directory, database presence,
  crawl runs, report snapshots, issue counts and last activity. Sort by open issues, name, last activity or
  errors first; filter by name, property or path; opening a row switches the workspace through the normal shell
  flow. A broken config or unreadable database becomes that site's error and the rest still scans.
- **CWV card.** The weekly report renders the engine's `cwv` section per normalized URL template and device with
  previous p75, delta and regression flag, plus truncation, the oldest evidence date, skipped rows and the
  engine's limitations. At most five templates are shown, regressed first.
- **Shell and engine.** New allow-listed commands `backup_restore`, `portfolio_list` and `schedule_install`, all
  argument-validated in the shell; `pick_backup_archive` is new, and `pick_directory` also approves the portfolio
  root and the backup output folder. Contracts were regenerated from `lv24-seo 0.7.0`.

## 0.4.0 Logs, tasks and backup

Released on 2026-11-16. It bundles `lv24-seo 0.6.0` and requires `MIN_ENGINE_VERSION` `0.6.0`, so a `0.5.x`
engine is reported as incompatible.

- **Logs.** `pick_log_file` selects one nginx JSON access log (at most 100 MiB); a path that did not come from the
  dialog or the app's own data/export directories is `PATH_NOT_APPROVED`. The page shows a bot filter, parse summary
  (total, parsed, skipped), crawl waste with the by-bot split, a bot rollup table and JSON/CSV export. Bots are
  User-Agent only and the result is labelled triage, not proof of crawl coverage.
- **Tasks.** Newest-first findings with property, kind, state, rule, URL, timestamps and stored evidence; filters and
  a row limit up to 500. State changes follow the allowed transitions, an invalid move is refused with the allowed
  set, and the add form is idempotent with a 16 KiB evidence cap and credential-shaped keys rejected.
- **Backup.** `backup create` writes one portable archive into the export folder or a folder chosen in the native
  directory dialog; the panel shows the path, size, SHA-256, database inclusion, property and snapshot counts, the
  member table and the engine's limitations. Restore is not implemented and the panel says so.
- **Digest card.** The weekly report renders the engine's attributed change digest with cause, confidence, up to
  three evidence rows and the next action, plus `showing N of M`, the oldest evidence date and skipped rows.
- **Shell and engine.** New allow-listed commands `logs_analyze`, `tasks_list`, `tasks_add`, `tasks_update` and
  `backup_create`, all argument-validated in the shell; `pick_directory` now also approves the backup output folder.
  Contracts were regenerated from `lv24-seo 0.6.0`.

## 0.3.0 workflow

Released on 2026-11-16. It bundles `lv24-seo 0.5.3` and keeps `MIN_ENGINE_VERSION` at `0.5.2`.

- **Onboarding.** The three-step wizard runs `lv24-seo init`, shows the config and data paths before creating
  anything, and offers **Open existing seo.toml** instead of overwriting. `knownConfigs` remembers up to 20
  config paths across restarts, still validated by the shell; the header chip opens 8 recent workspaces.
- **Crawl screen.** Bounded run, summary counters, severity/rule/text filters and JSON/CSV export; the table
  renders 500 rows while the export contains every returned row.
- **Reports.** Compare the two newest snapshots and export JSON (`lv24-seo.report/v1`) or CSV; **not comparable**
  is explicit instead of a silent diff.
- **Settings.** Sticky save bar, Ctrl/Cmd+S, **Only changed** filter and an app-wide draft guard that asks before
  discarding edits or closing the window.
- **Recommendations.** Search, severity sort and bulk queue/export.
- **Integrations.** MCP snippets in JSON and TOML plus print-only scheduler artifacts; nothing is installed or
  edited.
- **Reporting window.** 7/28/90 days and lag 2/3 per workspace, shared by stats and the weekly report; runs show
  elapsed time, last duration and truncation badges.

## 0.2.3 hardening

`0.2.3` was released on 2026-11-16. It moves the update download into Rust, makes the
config path a dialog-approved capability, and fixes UI state that could misreport a save or a
workspace. It bundles `lv24-seo 0.5.3` and keeps `MIN_ENGINE_VERSION` at `0.5.2`, so an installed
`0.5.2` engine is still accepted.

### Updater moved into Rust

The webview no longer holds the updater plugin's download-and-install permission; its capability list
contains `updater:allow-check` only. `update_install` in the shell re-checks the endpoint, refuses a
version that differs from the one the panel announced (`UPDATE_VERSION_MISMATCH`), downloads, verifies
the signature and only then starts the installer. Progress arrives as `update://progress`; a failed
progress listener is cosmetic and never blocks the install.

**Cancel** now means something. While downloading, the panel calls `update_cancel`; the shell drops the
download stream and returns `UPDATE_CANCELLED`, which returns the panel to idle without an error. Once
the installer has started, `update_cancel` returns `false` and the panel stays as it is — a
cancellation that did not happen is never claimed. On Windows the process exits when the installer
starts, so the install promise may never resolve; that is expected.

### Dialog-approved config path

`pick_config` owns the native dialog and records the chosen file. `settings_set` accepts a config path
only when it is the already-active path or one the dialog returned; any other `.toml` is rejected with
`PATH_NOT_APPROVED`, so a compromised webview cannot point `config_write` or `config_patch` at an
arbitrary file. The comparison uses the canonical path, so an equivalent spelling of the approved file
still matches.

A `storage.data_dir` that names a UNC share, a `\\?\` device path or a `\\.\` device is rejected with
`INVALID_PATH` and `detail.reason: network_or_device_path` before it is resolved against the config
directory. Joining it first would hide the `\\server\share` prefix and open an SMB connection on the UI
thread.

### Redaction and path timeouts

Engine stderr is redacted before it reaches the webview, a log or a diagnostics bundle, and redaction
runs before the 300-character preview is truncated: a token cut in half would no longer match the
redaction pattern. A TOML parser error can quote the offending line, so it is redacted too. A helper
task that exceeds its budget fails with `PATH_TIMEOUT` instead of hanging the screen.

### Workspace and UI state

- `shell_status` reports `configExists`. When the saved config was moved or deleted, the dashboard shows
  a workspace-missing banner with **Choose config** instead of a generic stats error, and no stats call
  is attempted. An absent field means unknown, not missing, so an older shell is not misread.
- Every provider block has an explicit enable toggle. It is the only writer of `providers.<id>.present`;
  a disabled block is removed from `seo.toml` on save and its fields stay out of reach.
- Validation is tri-state: `valid`, `invalid` or `skipped`. A double click, a workspace switch or typing
  during an engine validation returns `skipped`, and the UI shows no toast instead of claiming the
  draft is invalid.
- The skip link moves focus to the main region without changing the hash route, so it no longer renders
  NotFound. A route-level error boundary contains a render failure, offers a reload and resets when the
  path changes.

### Release pipeline

Pull-request CI now covers the release scripts themselves, the Rust matrix includes the Intel macOS
runner the release uses, and Rust is pinned to `1.95.0` instead of `stable`. `latest.json` is validated
against `contracts/latest.schema.json` before the draft is created. The published-asset allowlist lives
in one tested module, and the Windows portable ZIP ships with a `.sha256` sidecar that the release gate
recomputes and compares.

## Workspace switching and stale state

The active `seo.toml` path is the workspace identity. When you switch to a different config, or the engine goes offline, the desktop clears stats, reports, doctor and secret state before any screen can show data from the previous project. The first load only records the path; a later change is treated as a switch. Unsaved configuration drafts are shared between Settings and Configuration and are session-only, so save before closing the app.

Actions that cannot work are disabled rather than failing on click: no workspace selected, engine offline, or engine below the minimum version. Focus returns to the triggering control when a modal or panel closes. The en/ru/zh message catalogues are at parity; a missing key is a test failure, not a silent English fallback.

## Linux keyring

On Linux the CLI runner inherits the session-bus and XDG runtime variables that Secret Service needs (`DBUS_SESSION_BUS_ADDRESS`, `XDG_RUNTIME_DIR`, `TMPDIR` and related paths) while filtering unrelated host variables. This makes the OS keychain reachable from the desktop process. The secret value still travels only over stdin. If the keychain is unavailable, use `LV24_SEO_*` environment variables or the engine's explicitly opted-in file fallback.

## Crawl in 0.6.0

The desktop has a dedicated Crawl screen: start URL and URL budget, summary counters, severity/rule/text filters, and JSON/CSV export. The table renders at most 500 rows while the export contains every row the engine returned, and switching workspace resets the screen. A crawl runs in the background with a window-wide banner and a **Cancel** button; cancel stops that exact child process, and a cancelled run may leave a partial local artefact. There is no job queue, and leaving the screen does not stop the run.

## Troubleshooting basics

| Symptom | Likely cause | What to do |
|---|---|---|
| No workspace configuration | No `seo.toml` selected, or the saved path was moved/deleted | Run `lv24-seo init`, then choose the file in Settings |
| Engine marked offline | Engine missing or below the shell's minimum version (`0.8.0`) | Use the bundled engine, or point `LV24_SEO_BIN` at a compatible engine |
| SmartScreen or Gatekeeper warning | The OS build is unsigned or ad-hoc signed | Verify `SHA256SUMS.txt`, then use the documented **Run anyway** or **Open Anyway** flow |
| AppImage will not start | FUSE 2 is missing | Install `libfuse2` or use deb/rpm |
| Update check fails | GitHub endpoint is blocked or offline | Stay on the current version; the silent startup check stays quiet |
| Update button is disabled | Unsaved configuration draft or manual-only bundle | Save or discard the draft, or download the package from the release page |
| Update signature failure | Package does not match the embedded key | The artifact is blocked; download again from the release page and verify the checksum |
| Workspace-missing banner | The saved `seo.toml` was moved or deleted | Press **Choose config** and select the file again |
| `PATH_NOT_APPROVED` | A config path was set without the native dialog | Choose the file with **Choose config**; only a dialog-picked path may become active |
| `INVALID_PATH` with `network_or_device_path` | `storage.data_dir` names a UNC share or a device path | Use a local directory; a network share is rejected before it is opened |
| `UPDATE_CANCELLED` | You cancelled the download before the installer started | Expected; press **Download and install** again |
| `UPDATE_VERSION_MISMATCH` | The announced release changed between the check and the install | Press **Check for updates**, then install the newly announced version |
| `UPDATE_ENGINE_BUSY` | A sidecar process this app cannot stop holds the installed engine file | Close the terminal or app run that holds `lv24-seo`, then press **Download and install** again |
| `missing_token` on a card | Provider token is absent | Run `lv24-seo auth set --provider <p> --stdin` |
| `no_data` on a card | Provider reachable, no rows for the window | Widen the window or check the property and data lag |
| Long call seems stuck | The run is still active in the window banner | Press **Cancel** in the banner, or wait; a cancelled run may leave partial files and is not rolled back |

## Known limitations

- `0.1.0` has no updater and must be upgraded manually once. Auto-update works from `0.2.0` onward.
- deb, rpm, MSI and the portable ZIP are manual-only. There is no Windows arm64 or Linux arm64 build.
- macOS 13+ and glibc 2.35+ are required. Older systems may not run the bundles.
- The updater only installs a newer version; rolling back requires a manual install of an older release.
- The updater needs access to the GitHub Releases endpoint. A blocked or offline endpoint leaves the app on its current version.
- The updater can stop only sidecars it started itself. An engine launched from a terminal or another app copy is not killed; if it holds the installed sidecar open, the install is blocked with `UPDATE_ENGINE_BUSY`.
- The `0.2.1 → 0.2.2` update runs the old `0.2.1` updater, which does not include the tracked-PID cleanup. If a sidecar is active during that first update, retry after it exits or install `0.2.2` manually. `0.2.2 → 0.2.3` and later updates use the cleanup.
- Cancel is not rollback and there is no job queue in `0.6.0`: a cancelled crawl, report, log analysis, backup or schedule install may leave a partial artefact, and a cancelled in-place restore keeps the `.pre-restore-<utc>` copy but may have replaced one file, so build a fresh plan before retrying. Closing the window does not move a run into a queue.
- Restore replaces the database and config and never merges; the `.pre-restore-<utc>` copies are the only rollback, and a database held open by another process cannot be replaced on Windows. Tokens are excluded, so re-authenticate afterwards. `backup restore --to` is a CLI-only extraction.
- Schedule install mutates the host: it writes a cron entry, systemd user timer or Windows task only after confirmation, and only on this computer. The desktop does not manage, repair or uninstall the job; use `schedule status`/`schedule uninstall` in the CLI.
- GSC service accounts are configured outside the form: set `providers.gsc.service_account_file` in `seo.toml` or `LV24_SEO_GSC_SERVICE_ACCOUNT_FILE` in the environment. The desktop has no field for it.
- The CWV card is empty without CrUX/PSI field rows that carry a URL and a device; `cwv collect` is a CLI command, PSI lab rows are never stored, and at most five templates are shown.
- Portfolio reports local history only, inspects at most 50 sites per scan and never calls a provider.
- Bot triage is User-Agent only: a spoofed UA is not detected and non-search crawlers are reported as `other`.
- One log file at a time, at most 100 MiB; there is no rotation, glob, remote fetch or persisted log history.
- `MIN_ENGINE_VERSION` is `0.8.0`, so a `0.7.x` engine is rejected; the desktop does not silently downgrade commands to an older engine.
- The digest is evidence-based triage, not causal proof; items without evidence stay `unexplained`.
- Scheduled runs are installed only after confirmation and only on this host; the desktop does not manage or uninstall the job and never edits an MCP client config. Use `schedule status`/`schedule uninstall` in the CLI, and note that the desktop performs no provider write.
- Config-path approval is per process plus the persisted `knownConfigs` list; a path outside both still needs the native dialog.
- Windows ACL hardening is best effort. If `icacls` fails, the save proceeds and the draft keeps the directory's inherited DACL.
- Update cancellation is observed only before the installer starts. Once installation begins there is no rollback.
- An external engine is version-gated rather than bundled. The UI labels it as external and checks the minimum version.
- Recommendation copy is localised in en/ru/zh; tasks queued before `0.2.3` keep the stored English text.
- This is a `0.x` preview: configuration output, updater behavior and UI details may change before 1.0.

Source: `_source/desktop-README.md`, `_source/desktop-releases-0.6.0.md`, `_source/desktop-releases-0.5.0.md`, `_source/desktop-releases-0.4.0.md`, `_source/desktop-releases-0.3.0.md`, `_source/desktop-releases-0.2.3.md`, `_source/desktop-releases-0.2.2.md`, `_source/desktop-releases-0.2.1.md`, `_source/desktop-releases-0.2.0.md`, `_source/desktop-security.md`, `_source/desktop-architecture.md`.

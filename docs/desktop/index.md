---
title: Desktop app
description: What the LV24 SEO Optimizer desktop shell adds, how signed updates work, and the hardening changes in the 0.2.3 release and the 0.2.2 history.
---

# Desktop app

LV24 SEO Optimizer Desktop is a local, offline-first Tauri v2 shell around the `lv24-seo` engine. The Python CLI remains the engine of record: it owns provider clients, crawl rules, analysis, report builders and delivery. The desktop adds a React UI and a Rust process bridge, not a second SEO implementation.

The `0.2.3` hardening patch bundles `lv24-seo 0.5.3` as a PyInstaller onedir sidecar. There is no cloud account, no telemetry, no local HTTP API and no SERP scraping. The desktop talks to the engine through a fixed, allow-listed child-process bridge.

## What it adds

- **Workspace picker.** Choose the `seo.toml` the engine should use through a native file dialog in Settings. The selected config path is the workspace identity. A moved or deleted config is reported as missing and can be re-selected instead of blocking startup.
- **Stats dashboard.** Renders the bounded `stats` envelope: one card per configured provider, current values, previous-window comparison, coverage, data age, truncation and limitations. CTR changes are shown in percentage points. There is no zero-fill and no cross-engine total; unknown stays unknown.
- **Settings form and configuration outputs.** The Settings screen is the editable form. The Configuration screen is read-only and has Overview, Effective, Source TOML, Diff, Validation, Doctor and Environment tabs. Source TOML is redacted and read-only; there is no raw TOML editor. Saves use field-level patches, keep comments and key order, validate with the engine, create a timestamped backup (last five kept) and replace the file atomically. In `0.2.3` the temp file and backup are mode `0600` on POSIX and carry an owner-only DACL on Windows, both are fsynced, and the parent directory is fsynced after the rename. Reads are bounded at 8 MiB; settings load per field; Windows reserved device names and trailing dots/spaces are rejected in every path component.
- **Reports.** Runs the weekly report locally, writes `report.json` and `report.html` under the app data directory, and opens the HTML in your default browser. The report HTML is never embedded in the app webview. A failed report or export explains what failed and what to do.
- **Recommendations and an agent queue.** Turns report and stats findings into bounded Markdown prompts. You can copy a prompt, export it as `.md`, or keep it in a local agent queue with a status. The queue is stored in the webview's local storage; nothing is submitted automatically.
- **Secrets over stdin.** Token input is a password field sent once over IPC. The Rust layer pipes it to `lv24-seo auth set --provider <p> --stdin`, zeroizes its buffer and never writes the value to a log, MobX store, localStorage, clipboard or diagnostics bundle. After saving, the UI shows only presence and source.
- **Yandex Metrika token.** `0.2.3` keeps the separate `metrika` provider (`yandex_metrika_token`) in the TypeScript and Rust allow-lists, the Settings badge, the secret modal and the en/ru/zh labels. The Metrika counter never borrows the Webmaster token.
- **One secret store with the CLI.** The desktop runs the same engine under the same OS user, so a token stored by `lv24-seo auth set` in a terminal is visible in the desktop and a token stored in the desktop is visible to the CLI. The OS keychain entry uses service `lv24-seo` and the same secret name. `LV24_SEO_*` environment variables are inherited but shown as read-only in the UI: the desktop cannot remove an environment variable, and it says so instead of offering a delete button that does nothing. The opt-in `<data-dir>/secrets.json` fallback is shared only when both surfaces open the same workspace/data directory.
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
| Windows NSIS | `LV24.SEO.Optimizer_0.2.3_x64-setup.exe` | Yes |
| Windows portable ZIP | `LV24-SEO-Optimizer_0.2.3_x64-portable.zip`; extract the whole folder and run `lv24-seo-desktop.exe` | No |
| Linux AppImage | `LV24.SEO.Optimizer_0.2.3_amd64.AppImage`; `chmod +x` and run | Yes |
| Linux deb | `LV24.SEO.Optimizer_0.2.3_amd64.deb`; `sudo apt install ./*_amd64.deb` | No |
| Linux rpm | `LV24.SEO.Optimizer-0.2.3-1.x86_64.rpm`; `sudo dnf install ./*_amd64.rpm` | No |
| macOS `.app` from DMG | `LV24.SEO.Optimizer_0.2.3_aarch64.dmg` or `LV24.SEO.Optimizer_0.2.3_x64.dmg`; drag to Applications | Yes |
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
engine ready after the in-app update. Any `0.2.x` install can jump straight to `0.2.3`.

For `0.2.2`, installs were also checked on macOS and Linux: the arm64 DMG on macOS 27.2 passed
`codesign --verify --deep --strict`, launched with engine `0.5.2` ready and fetched the `0.2.2`
manifest; the deb on Ubuntu 24.04, the AppImage extract-and-run fallback and the rpm on Fedora 45
installed, launched and reported `Engine ready` with engine `0.5.2`; the direct AppImage FUSE mount
was also verified in WSL2.

The `0.2.1 → 0.2.2` update runs the old `0.2.1` updater, which does not include the new tracked-PID
cleanup. If a sidecar is active during that first update, retry after it exits or install `0.2.2`
manually. `0.2.2 → 0.2.3` uses the tracked-PID cleanup and blocks with `UPDATE_ENGINE_BUSY` if a
tracked sidecar cannot be stopped.

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

## Crawl in 0.2.3

The desktop exposes crawl settings in the Settings form and surfaces crawl findings in reports and recommendations. The `0.2.3` UI has no separate Crawl screen, and long engine calls have no job progress or cancel button. Run `lv24-seo crawl` in a terminal when you need the full crawl output and sitemap coverage diff.

## Troubleshooting basics

| Symptom | Likely cause | What to do |
|---|---|---|
| No workspace configuration | No `seo.toml` selected, or the saved path was moved/deleted | Run `lv24-seo init`, then choose the file in Settings |
| Engine marked offline | Engine missing or below the shell's minimum version (`0.5.2`) | Use the bundled engine, or point `LV24_SEO_BIN` at a compatible engine |
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
| Long call seems stuck | No progress or cancel in 0.2.3 | Wait for the command timeout; the UI shows an indeterminate busy state |

## Known limitations

- `0.1.0` has no updater and must be upgraded manually once. Auto-update works from `0.2.0` onward.
- deb, rpm, MSI and the portable ZIP are manual-only. There is no Windows arm64 or Linux arm64 build.
- macOS 13+ and glibc 2.35+ are required. Older systems may not run the bundles.
- The updater only installs a newer version; rolling back requires a manual install of an older release.
- The updater needs access to the GitHub Releases endpoint. A blocked or offline endpoint leaves the app on its current version.
- The updater can stop only sidecars it started itself. An engine launched from a terminal or another app copy is not killed; if it holds the installed sidecar open, the install is blocked with `UPDATE_ENGINE_BUSY`.
- The `0.2.1 → 0.2.2` update runs the old `0.2.1` updater, which does not include the tracked-PID cleanup. If a sidecar is active during that first update, retry after it exits or install `0.2.2` manually. `0.2.2 → 0.2.3` uses the cleanup.
- Config-path approval is per process: a path picked in the dialog stays approved until the app exits, and a later process still needs the dialog. It is consent, not a durable allow-list.
- Windows ACL hardening is best effort. If `icacls` fails, the save proceeds and the draft keeps the directory's inherited DACL.
- Update cancellation is observed only before the installer starts. Once installation begins there is no rollback.
- An external engine is version-gated rather than bundled. The UI labels it as external and checks the minimum version.
- Recommendation copy is localised in en/ru/zh; tasks queued before `0.2.3` keep the stored English text.
- This is a `0.x` preview: configuration output, updater behavior and UI details may change before 1.0.

Source: `_source/desktop-README.md`, `_source/desktop-releases-0.2.3.md`, `_source/desktop-releases-0.2.2.md`, `_source/desktop-releases-0.2.1.md`, `_source/desktop-releases-0.2.0.md`, `_source/desktop-security.md`, `_source/desktop-architecture.md`.

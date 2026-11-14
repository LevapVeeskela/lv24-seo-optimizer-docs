---
title: Desktop app
description: What the LV24 SEO Optimizer desktop shell adds, how signed updates work, and the limitations of the 0.2.1 patch release.
---

# Desktop app

LV24 SEO Optimizer Desktop is a local, offline-first Tauri v2 shell around the `lv24-seo` engine. The Python CLI remains the engine of record: it owns provider clients, crawl rules, analysis, report builders and delivery. The desktop adds a React UI and a Rust process bridge, not a second SEO implementation.

The `0.2.1` patch release bundles `lv24-seo 0.5.1` as a PyInstaller onedir sidecar. There is no cloud account, no telemetry, no local HTTP API and no SERP scraping. The desktop talks to the engine through a fixed, allow-listed child-process bridge.

## What it adds

- **Workspace picker.** Choose the `seo.toml` the engine should use through a native file dialog in Settings. The selected config path is the workspace identity.
- **Stats dashboard.** Renders the bounded `stats` envelope: one card per configured provider, current values, previous-window comparison, coverage, data age, truncation and limitations. CTR changes are shown in percentage points. There is no zero-fill and no cross-engine total; unknown stays unknown.
- **Settings form and configuration outputs.** The Settings screen is the editable form. The Configuration screen is read-only and has Overview, Effective, Source TOML, Diff, Validation, Doctor and Environment tabs. Source TOML is redacted and read-only; there is no raw TOML editor. Saves use field-level patches, keep comments and key order, validate with the engine, create a timestamped backup (last five kept) and replace the file atomically.
- **Reports.** Runs the weekly report locally, writes `report.json` and `report.html` under the app data directory, and opens the HTML in your default browser. The report HTML is never embedded in the app webview.
- **Recommendations and an agent queue.** Turns report and stats findings into bounded Markdown prompts. You can copy a prompt, export it as `.md`, or keep it in a local agent queue with a status. The queue is stored in the webview's local storage; nothing is submitted automatically.
- **Secrets over stdin.** Token input is a password field sent once over IPC. The Rust layer pipes it to `lv24-seo auth set --provider <p> --stdin`, zeroizes its buffer and never writes the value to a log, MobX store, localStorage, clipboard or diagnostics bundle. After saving, the UI shows only presence and source.
- **Yandex Metrika token.** `0.2.1` adds `metrika` to the TypeScript and Rust allow-lists, the Settings badge and the secret modal, so the Metrika counter uses its own token instead of the Webmaster token.
- **One secret store with the CLI.** The desktop runs the same engine under the same OS user, so a token stored by `lv24-seo auth set` in a terminal is visible in the desktop and a token stored in the desktop is visible to the CLI. The OS keychain entry uses service `lv24-seo` and the same secret name; `LV24_SEO_*` environment variables are inherited. The opt-in `<data-dir>/secrets.json` fallback is shared only when both surfaces open the same workspace/data directory.
- **Update panel.** Checks a signed `latest.json` at startup and on demand, shows release notes, and installs only after you confirm.

The dashboard and Reports screen are built on the same engine commands a terminal uses:

```bash
lv24-seo stats --days 7 --lag-days 2 --json
lv24-seo report weekly --days 7 --lag-days 2 --json
```

## Install types

Download desktop assets from the project's Releases page. The desktop is separate from the Python engine install; the shell can use its bundled sidecar, an explicit `LV24_SEO_BIN`, or a sibling portable layout.

| Bundle | How it is installed | In-app update |
|---|---|---|
| Windows NSIS | `LV24.SEO.Optimizer_0.2.1_x64-setup.exe` | Yes |
| Windows portable ZIP | Extract the whole folder and run `lv24-seo-desktop.exe` | No |
| Linux AppImage | `chmod +x` and run | Yes |
| Linux deb | `sudo apt install ./*_amd64.deb` | No |
| Linux rpm | `sudo dnf install ./*_amd64.rpm` | No |
| macOS `.app` from DMG | Drag to Applications | Yes |
| MSI | Not produced by this project | No |

Windows requires Windows 10/11 x64 and WebView2. Linux is x64 only and built on Ubuntu 22.04 with a glibc 2.35 baseline. macOS requires 13 or newer; use the arm64 DMG on Apple silicon and the x64 DMG on Intel. The OS packages are unsigned or ad-hoc signed, so SmartScreen and Gatekeeper warnings are expected. Verify `SHA256SUMS.txt` before running an installer.

## How updates work

The updater reads a signed `latest.json` from the project's GitHub Releases endpoint. Packages are signed with a minisign/Ed25519 key whose public key is embedded in the app. `requireSignedVersion` is enabled, so the announced version is bound to the signed package.

- The app checks once at startup, silently, with a 30-second timeout, and when you press **Check for updates**.
- Nothing is downloaded or installed automatically. The panel shows the version and notes; **Download and install** starts the update. An unsaved configuration draft disables the button.
- Only a version greater than the running one is accepted. The updater cannot downgrade the app.
- A signature failure blocks that artifact, marks the error as non-retryable and points to the release page. It is not retried and is not downgraded to an offline warning.
- Windows runs the signed NSIS setup in passive mode; macOS replaces the `.app`; Linux replaces the AppImage. The app restarts after installation; the NSIS installer handles the Windows restart.

### Auto-update matrix

| Bundle | Auto-update | What happens |
|---|---|---|
| Windows NSIS | Yes | Downloads the signed setup `.exe`, runs it in passive mode, relaunches |
| macOS `.app` | Yes | Downloads the signed `.app.tar.gz`, replaces the app, relaunches |
| Linux AppImage | Yes | Downloads the signed AppImage, replaces it, relaunches |
| Windows portable ZIP | No | The update panel links to the release page; download and extract a new ZIP |
| Linux deb | No | The update panel links to the release page; upgrade with the package manager |
| Linux rpm | No | The update panel links to the release page; upgrade with the package manager |
| MSI | No | No MSI is produced; an MSI install is treated as manual |
| Unknown bundle | No | The update panel links to the release page |

Manual-only is deliberate. A deb/rpm install is owned by the distribution's package database, an MSI is not produced by this project, and a portable ZIP has no installer to replace. The desktop reports the installed bundle type and disables the in-app installer for those cases; it does not pretend a manual package was updated.

## Workspace switching

The active `seo.toml` path is the workspace identity. When you switch to a different config, the desktop clears stats, reports and the report HTML path before any screen can show numbers from the previous project. The first load only records the path; a later change is treated as a switch. Unsaved configuration drafts are shared between Settings and Configuration and are session-only, so save before closing the app.

## Linux keyring

On Linux the CLI runner inherits the session-bus and XDG runtime variables that Secret Service needs (`DBUS_SESSION_BUS_ADDRESS`, `XDG_RUNTIME_DIR`, `TMPDIR` and related paths) while filtering unrelated host variables. This makes the OS keychain reachable from the desktop process. The secret value still travels only over stdin. If the keychain is unavailable, use `LV24_SEO_*` environment variables or the engine's explicitly opted-in file fallback.

## Crawl in 0.2.1

The desktop exposes crawl settings in the Settings form and surfaces crawl findings in reports and recommendations. The `0.2.1` UI has no separate Crawl screen, and long engine calls have no job progress or cancel button. Run `lv24-seo crawl` in a terminal when you need the full crawl output and sitemap coverage diff.

## Troubleshooting basics

| Symptom | Likely cause | What to do |
|---|---|---|
| No workspace configuration | No `seo.toml` selected | Run `lv24-seo init`, then choose the file in Settings |
| Engine marked offline | Engine missing or below the shell's minimum version | Use the bundled engine, or point `LV24_SEO_BIN` at a compatible engine |
| SmartScreen or Gatekeeper warning | The OS build is unsigned or ad-hoc signed | Verify `SHA256SUMS.txt`, then use the documented **Run anyway** or **Open Anyway** flow |
| AppImage will not start | FUSE 2 is missing | Install `libfuse2` or use deb/rpm |
| Update check fails | GitHub endpoint is blocked or offline | Stay on the current version; the silent startup check stays quiet |
| Update button is disabled | Unsaved configuration draft or manual-only bundle | Save or discard the draft, or download the package from the release page |
| Update signature failure | Package does not match the embedded key | The artifact is blocked; download again from the release page and verify the checksum |
| `missing_token` on a card | Provider token is absent | Run `lv24-seo auth set --provider <p> --stdin` |
| `no_data` on a card | Provider reachable, no rows for the window | Widen the window or check the property and data lag |
| Long call seems stuck | No progress or cancel in 0.2.1 | Wait for the command timeout; the UI shows an indeterminate busy state |

## Known limitations

- `0.1.0` has no updater and must be upgraded manually once. Auto-update works from `0.2.0` onward.
- deb, rpm, MSI and the portable ZIP are manual-only. There is no Windows arm64 or Linux arm64 build.
- macOS 13+ and glibc 2.35+ are required. Older systems may not run the bundles.
- The updater only installs a newer version; rolling back requires a manual install of an older release.
- The updater needs access to the GitHub Releases endpoint. A blocked or offline endpoint leaves the app on its current version.
- An external engine is version-gated rather than bundled. The UI labels it as external and checks the minimum version.
- Recommendation titles, actions and verification steps come from the engine and stay in English; the surrounding UI is translated (en/ru/zh).
- This is a `0.x` preview: configuration output, updater behavior and UI details may change before 1.0.

Source: `_source/desktop-README.md`, `_source/desktop-releases-0.2.1.md`, `_source/desktop-releases-0.2.0.md`, `_source/desktop-security.md`, `_source/desktop-architecture.md`.

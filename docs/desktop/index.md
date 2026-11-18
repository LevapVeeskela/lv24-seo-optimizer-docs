---
title: Desktop app
description: What the LV24 SEO Optimizer desktop shell adds, how signed updates work, and the 0.9.4 hidden Windows scheduled jobs, the 0.9.3 OAuth readiness, the 0.9.2 Indexing automation card, the 0.9.1 OAuth Connect card, the 0.9.0 Diagnostics screen and older history.
---

# Desktop app

LV24 SEO Optimizer Desktop is a local, offline-first Tauri v2 shell around the `lv24-seo` engine. The Python CLI remains the engine of record: it owns provider clients, crawl rules, analysis, report builders and delivery. The desktop adds a React UI and a Rust process bridge, not a second SEO implementation.

The `0.9.4` release bundles `lv24-seo 0.14.1` as a PyInstaller onedir sidecar and stops Windows scheduled jobs from opening a console window. It keeps the OAuth Connect card for Google Search Console, Yandex Webmaster and Yandex Metrika, the read-only Diagnostics screen, the Bing indexing cards, the sitemap, IndexNow and Site Scan actions and the per-session write secret. It requires engine `0.14.1` or newer (`MIN_ENGINE_VERSION`), so an installed `0.14.0` engine is reported as incompatible. OAuth tokens are stored by the engine in the OS keychain; the desktop never receives, renders or logs one. The Indexing automation card renders `indexing status`, `indexing history` and `schedule status`; it has no write, confirm or `--allow-write` control. The Connect card renders the engine's OAuth readiness states; only `oauth_ready` is shown as success, and a missing or unknown report is shown as unavailable, never Ready. There is no cloud account, no telemetry, no local HTTP API and no SERP scraping. The desktop talks to the engine through a fixed, allow-listed child-process bridge.

## What it adds

- **Workspace picker and onboarding.** Choose the `seo.toml` the engine should use through a native file dialog in Settings, or create a project with the three-step wizard that runs `lv24-seo init` and shows the exact config and data paths first. The selected config path is the workspace identity; a header site chip opens up to 8 recent workspaces, and a moved or deleted config is reported as missing and can be re-selected instead of blocking startup.
- **Stats dashboard.** Renders the bounded `stats` envelope: one card per configured provider, current values, previous-window comparison, coverage, data age, truncation and limitations. CTR changes are shown in percentage points. There is no zero-fill and no cross-engine total; unknown stays unknown. A properties panel renders `lv24-seo properties` with token presence per provider.
- **Settings form and configuration outputs.** The Settings screen is the editable form. The Configuration screen is read-only and has Overview, Effective, Source TOML, Diff, Validation, Doctor and Environment tabs. Source TOML is redacted and read-only; there is no raw TOML editor. Saves use field-level patches, keep comments and key order, validate with the engine, create a timestamped backup (last five kept) and replace the file atomically. In `0.9.2` the temp file and backup are mode `0600` on POSIX and carry an owner-only DACL on Windows, both are fsynced, and the parent directory is fsynced after the rename. Reads are bounded at 8 MiB; settings load per field; Windows reserved device names and trailing dots/spaces are rejected in every path component. GSC service accounts are configured outside the form: set `providers.gsc.service_account_file` or `LV24_SEO_GSC_SERVICE_ACCOUNT_FILE`, and the Configuration screen shows the effective redacted config.
- **Reports.** Runs the weekly report locally, writes `report.json` and `report.html` under the app data directory, and opens the HTML in your default browser. The report HTML is never embedded in the app webview. It compares the two newest stored snapshots, exports JSON (`lv24-seo.report/v1`) or CSV, renders the engine's attributed change digest with cause, confidence, evidence rows and next action, and shows the Core Web Vitals card per URL template and device.
- **Recommendations and an agent queue.** Turns report and stats findings into bounded Markdown prompts. Search and sort them, copy one, export it as `.md`, or queue or export all visible tasks. The queue is stored in the webview's local storage; nothing is submitted automatically.
- **Secrets over stdin.** Token input is a password field sent once over IPC. The Rust layer pipes it to `lv24-seo auth set --provider <p> --stdin`, zeroizes its buffer and never writes the value to a log, MobX store, localStorage, clipboard or diagnostics bundle. After saving, the UI shows only presence and source. OAuth client secrets are configured once in a terminal with `auth set --provider gsc_oauth_secret|yandex_oauth_secret --stdin`; the Connect card has no secret field.
- **Indexing automation card.** Integrations renders the engine's `indexing status`, `indexing history` and `schedule status`: the daily 04:00 `lv24-seo-indexing` job, per-provider submitted/indexed/pending counts and quotas for Bing, Yandex, GSC and IndexNow, the newest run with up to five error items, and a compact 7/30-day day/provider history. A provider with no state shows "No data yet", never zero; `data_age_days` and `limitations` are always shown, and GSC's deprecated `indexed_total` is labelled separately. The card is read-only and has no write or confirm control.
- **OAuth Connect card.** Integrations gains a **Connectors** card for GSC, Yandex Webmaster and Metrika. **Connect** runs the engine's `auth login`; GSC uses the system browser with a `127.0.0.1` loopback callback and S256 PKCE, while Yandex uses `--url-only`, shows the authorization URL, then accepts the verification code and calls `auth login --code`. The card reads `auth status` (`gsc_oauth`, `yandex_oauth`, `metrika_oauth`) and shows `Connected`, `Not connected` or `Not checked`; it has no write controls and never renders a token. While readiness is `oauth_client_missing`, `oauth_client_secret_missing` or `oauth_redirect_invalid`, **Connect** is disabled, and a second **Open** click is ignored while the first is in flight. On engine `0.15.1` it renders the OAuth readiness state, the engine `detail` and `next_action`, localized expiry, recorded scopes and limitations; only `oauth_ready` is shown as success, and a missing or unknown report is shown as a neutral "Readiness unavailable" notice, never Ready.
- **Yandex Metrika token.** `0.9.2` keeps the separate `metrika` provider (`yandex_metrika_token`) in the TypeScript and Rust allow-lists, the Settings badge, the secret modal and the en/ru/zh labels. The Metrika counter never borrows the Webmaster token. Engine `0.11.0` adds the read-only `metrika` command group and makes every Metrika read organic-only, so the Diagnostics tab shows organic pages, goals and dimensions with the sampling fields.
- **One secret store with the CLI.** The desktop runs the same engine under the same OS user, so a token stored by `lv24-seo auth set` in a terminal is visible in the desktop and a token stored in the desktop is visible to the CLI. The OS keychain entry uses service `lv24-seo` and the same secret name. `LV24_SEO_*` environment variables are inherited but shown as read-only in the UI: the desktop cannot remove an environment variable, and it says so instead of offering a delete button that does nothing. The opt-in `<data-dir>/secrets.json` fallback is shared only when both surfaces open the same workspace/data directory.
- **Crawl screen.** A bounded `lv24-seo crawl --json` run with summary counters, a truncated badge, engine warnings and limitations; issue filters for severity, rule and free-text search; a table capped at 500 rendered rows while the JSON and CSV export contains every returned row. Switching workspace resets the screen.
- **Integrations and run status.** MCP snippets for Claude Desktop, OpenCode, VS Code and Cursor in JSON, plus a TOML form for hosts such as Codex CLI; snippets contain no tokens. The Bing indexing panel plans and applies a Bing sitemap submission, submits URLs through `bing submit`, reads the remaining quota, sitemap feeds and crawl issues, sends the sitemap's URLs to IndexNow and opens the official Bing Site Scan page; all writes are two-phase and review the engine plan first. Scheduled runs can be previewed as a `lv24-seo schedule print` artifact or installed on this host after a confirmation dialog that names the config and job kind; the install appends `--allow-write` only after that confirmation. Runs show live elapsed time, the last duration and timestamp, and truncation or limitation badges.
- **Read-only Diagnostics.** A sidebar screen with five tabs — Google (URL Inspection and sitemap reads), Yandex (indexing events, sitemaps and recrawl queue), Bing (pages, daily traffic, six-month crawl buckets, URL details and query/page joins), Metrika (organic pages, goals, devices, countries, engagement and bytime) and Core Web Vitals (Lighthouse audits and weekly CrUX history). All 18 commands are read-only and allow-listed; every answer renders `total`, truncation, data age and limitations, and a provider-empty answer is an explicit `no_rows_for_window`, `provider_returned_no_rows` or `low_traffic` state instead of a zero row.
- **Per-session write secret.** At startup the shell draws 32 bytes from the OS CSPRNG and keeps the 64-character hex `LV24_SEO_WRITE_SECRET` only in Rust memory, zeroized on drop. It is set on every engine child after `env_clear()` and never written to settings, argv, logs, diagnostics or the webview. Plan and apply in one app session use the same secret, so a plan token from an earlier session is rejected and the UI re-plans.
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
| Windows NSIS | `LV24.SEO.Optimizer_0.9.4_x64-setup.exe` | Yes |
| Windows portable ZIP | `LV24-SEO-Optimizer_0.9.4_x64-portable.zip`; extract the whole folder and run `lv24-seo-desktop.exe` | No |
| Linux AppImage | `LV24.SEO.Optimizer_0.9.4_amd64.AppImage`; `chmod +x` and run | Yes |
| Linux deb | `LV24.SEO.Optimizer_0.9.4_amd64.deb`; `sudo apt install ./*_amd64.deb` | No |
| Linux rpm | `LV24.SEO.Optimizer-0.9.4-1.x86_64.rpm`; `sudo dnf install ./*_amd64.rpm` | No |
| macOS `.app` from DMG | `LV24.SEO.Optimizer_0.9.4_aarch64.dmg` or `LV24.SEO.Optimizer_0.9.4_x64.dmg`; drag to Applications | Yes |
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
engine ready, and a configured workspace loaded. The `0.6.0 → 0.7.0` update was verified through the
same updater: an installed `0.6.0` build reported **Desktop 0.7.0** with **Engine 0.9.0** and the
engine ready, and the Integrations screen shows the Bing indexing panel. The `0.7.0 → 0.8.0` update was
verified through the same updater: an installed `0.7.0` build reported **Desktop 0.8.0** with
**Engine 0.10.0** and the engine ready, and the new Bing URL submission, sitemap, crawl-issue and quota
cards loaded. `0.9.3 → 0.9.4` is the next in-app update source. Any `0.2.x` install can jump straight to `0.9.4`.

For `0.2.2`, installs were also checked on macOS and Linux: the arm64 DMG on macOS 27.2 passed
`codesign --verify --deep --strict`, launched with engine `0.5.2` ready and fetched the `0.2.2`
manifest; the deb on Ubuntu 24.04, the AppImage extract-and-run fallback and the rpm on Fedora 45
installed, launched and reported `Engine ready` with engine `0.5.2`; the direct AppImage FUSE mount
was also verified in WSL2.

The `0.2.1 → 0.2.2` update runs the old `0.2.1` updater, which does not include the new tracked-PID
cleanup. If a sidecar is active during that first update, retry after it exits or install `0.2.2`
manually. `0.2.2 → 0.2.3` uses the tracked-PID cleanup and blocks with `UPDATE_ENGINE_BUSY` if a
tracked sidecar cannot be stopped.

## 0.9.4 hidden scheduled jobs

Released on 2026-11-18. It bundles `lv24-seo 0.14.1` and raises `MIN_ENGINE_VERSION` to `0.14.1`.
The 04:00 indexing job no longer opens a console window; the Indexing automation and Connect cards
are unchanged.

- **Hidden Windows job.** A task installed from the desktop registers a generated `<name>.vbs` launcher through `wscript.exe //B //Nologo`; the launcher runs the engine hidden, waits for it and forwards the exit code. `schedule status` lists the task, XML and launcher; `schedule uninstall` removes both files.
- **One-time reinstall.** A task installed by `0.9.3` or older keeps the console action until it is reinstalled once; the engine reports it as `outdated`.
- **Engine and contracts.** The sidecar is `lv24-seo 0.14.1`; contracts are regenerated from `0.14.1`. The Windows x64 pin is `2bdf0077…0503` (14,582,464 bytes).
- **Cards unchanged.** The read-only Indexing automation card, the Connect readiness states, the two-phase write gates, MCP at 12 tools and SQLite schema v5 are unchanged.

Verification recorded for this release: full Vitest and Rust suites passed, contracts are at engine `0.14.1`, and the release workflow run `44334023386` published the `v0.9.4` assets with `engine_version=0.14.1`.

Known limits in 0.9.4:

- Existing Windows scheduled tasks need one reinstall to replace the console action.
- The launcher relies on Windows Script Host (`wscript.exe`), present on supported Windows versions.
- The Indexing card stays read-only; installing or changing the job remains a separate gated action.
- An engine older than `0.14.1` is reported as incompatible.

## 0.9.3 OAuth readiness

Released on 2026-11-18. It shows the engine's OAuth readiness report in the Connect card and keeps
the bundled `lv24-seo 0.14.0`, `MIN_ENGINE_VERSION` `0.14.0`, contracts and Windows sidecar pin
unchanged. `0.9.2` is the previous release.

- **Readiness.** For GSC, Yandex Webmaster and Metrika the card shows a state chip, the engine `detail`, the exact `next_action`, the token expiry in the local language, whether scopes were recorded and any limitations.
- **State tones.** `oauth_ready` is the only state rendered as success. Missing client id, missing client secret, sign-in required, missing scopes and an invalid redirect use the action tone. An expired token (with the refresh hint) and unknown scopes are warnings.
- **Neutral fallback.** A missing `oauth` object, a skipped provider or an unknown state shows a neutral "Readiness unavailable" notice with the engine `>= 0.14.0` hint; it is never shown as Ready. The existing connection rows keep working.
- **No secrets.** The card parses presence booleans and timestamps only; no token or secret value is read, stored or rendered.
- **Engine unchanged.** The sidecar is the same `lv24-seo 0.14.0` build as `0.9.2`; contracts and the Windows x64 pin (`33d2611c…02d0`, 14,580,661 bytes) are unchanged.

Verification recorded for this release: 804 Vitest tests and 169 Rust tests passed, contracts are at engine `0.14.0`, and the release workflow run `44209259452` published 18 assets on `v0.9.3` with `latest.json` at `0.9.3` and a 17-line `SHA256SUMS.txt`.

Known limits in 0.9.3:

- The card displays the engine's English `detail`/`next_action` text verbatim; only labels, expiry and layout are localized.
- Readiness proves the local prerequisites are consistent, not that a provider accepted a consent screen. Live OAuth consent still requires a registered Google Desktop client and a Yandex OAuth app.
- An engine older than `0.14.0` is reported as incompatible.

## 0.9.2 Indexing automation

Released on 2026-11-18. It bundles `lv24-seo 0.14.0` and requires `MIN_ENGINE_VERSION` `0.14.0`, so a `0.13.x`
engine is reported as incompatible. It adds a read-only card and no new write surface.

- **Indexing automation card.** Integrations renders `indexing status`, `indexing history` and `schedule status`; there are no write, confirm or `--allow-write` controls.
- **Schedule and providers.** Shows `Scheduled`/host state and the **Daily 04:00** `lv24-seo-indexing` cadence; Bing, Yandex, GSC and IndexNow rows carry `submitted`, `indexed` (GSC only), `pending` and quotas (Bing daily/monthly remaining, Yandex remaining, GSC/IndexNow used/limit). Missing state is "No data yet", never zero.
- **Last run and history.** Newest `indexing history` row with status, submitted/checked counts and up to five `error_items`, plus a 7/30-day day/provider table from `indexing history --limit 30`.
- **Honesty.** `data_age_days` and `limitations` are always rendered; the deprecated GSC `indexed_total` aggregate is separate from the per-URL verdict. Bing/Yandex/IndexNow show no per-URL indexed count instead of inventing one.
- **Compatibility and bridge.** An `INVALID_COMMAND` answer shows "Indexing status needs engine >= 0.13.1" and hides the tables. `indexing_status` (`provider`, `limit`, `live`), `indexing_history` (`limit`) and `schedule_status` (`kind`, `target`) are allow-listed; the Rust layer validates every value, rejects write flags and cross-command arguments and uses a 120 s timeout. `--live` is the only provider call; a missing credential is a limitation, not a failure.
- **Engine and contracts.** The sidecar is `lv24-seo 0.14.0`; contracts are regenerated from `0.14.0`. The Windows x64 reviewed pin is `33d2611c…02d0` (14,580,661 bytes); Linux and macOS pins remain `null` and are covered by rebuild-aware reports.

Verification recorded for this release: 784 Vitest tests and 169 Rust tests passed, contracts are up to date at engine `0.14.0`, and the release workflow publishes the `v0.9.2` assets with `engine_version=0.14.0`.

Known limits in 0.9.2:

- The card is read-only: it shows the schedule state but cannot install, edit or run the job.
- `--live` reads Bing and Yandex quotas; a missing credential is shown as a limitation.
- Bing, Yandex and IndexNow do not expose a per-URL indexed count; the card shows no value with `no_per_url_index_count`.
- The GSC `contents[].indexed` aggregate is deprecated and can be zero.
- An engine older than `0.14.0` is reported as incompatible.

## 0.9.1 OAuth Connect

Released on 2026-11-18. It bundles `lv24-seo 0.13.1` and requires `MIN_ENGINE_VERSION` `0.13.1`, so a `0.12.x`
engine is reported as incompatible. It adds no provider write and no new write surface.

- **Connectors card.** The Integrations screen gains a card for Google Search Console, Yandex Webmaster and
  Yandex Metrika. Tokens are stored by the engine in the OS keychain; the desktop never receives, renders or
  logs one.
- **Google Search Console.** **Connect** runs `auth login --provider gsc`. The engine opens the system browser,
  starts a `127.0.0.1` loopback callback with S256 PKCE and waits for consent. The card shows a "complete the
  sign-in in your browser" hint and refreshes `auth status` on success. A missing client id or secret shows the
  engine's `next_action` and the auth guide instead of a generic failure.
- **Yandex Webmaster and Metrika.** **Connect** calls `auth login --provider yandex|metrika --url-only` and shows
  the authorization URL with an **Open Yandex** button. After approving access, the user pastes the code from
  `https://oauth.yandex.ru/verification_code` and clicks **Finish**; the code is cleared from state after the
  exchange. The two engines use separate token slots.
- **Status.** The card reads `auth status` (`gsc_oauth`, `yandex_oauth`, `metrika_oauth`) and shows `Connected`,
  `Not connected` or `Not checked`. The client secret is configured once with
  `auth set --provider gsc_oauth_secret|yandex_oauth_secret --stdin`; the UI has no secret field.
- **Bridge hardening.** `auth_login` is allow-listed with `provider`, `noBrowser`, `port`, `code` and `urlOnly`.
  The Rust layer rejects write flags, cross-provider combinations and invalid ports or codes before spawning the
  engine. `open_oauth_url` accepts only `https://oauth.yandex.ru/authorize?...`; it is not a generic URL opener.
- **Engine and contracts.** The bundled onedir sidecar is `lv24-seo 0.13.1`; contracts (`config.schema.json`, CLI
  fixtures including `stats`) are regenerated from `0.13.1`. The Windows x64 reviewed pin records the built
  `0.13.1` executable (`0b02b8a0…`, 14,567,729 bytes); Linux and macOS pins remain `null` and are covered by
  rebuild-aware CI checksum reports.

Verification recorded for this release: 763 Vitest tests and 167 Rust tests passed, contracts are up to date at
engine `0.13.1`, and the release workflow published 18 assets on `v0.9.1` with `latest.json` at `0.9.1` and a
17-line `SHA256SUMS.txt`.

Known limits in 0.9.1:

- **Live OAuth consent is not yet verified**: no Google Cloud Desktop client or Yandex OAuth app was registered
  at release time. The card shows the engine's setup error until a real client id/secret is configured.
- Google OAuth apps in **Testing** issue refresh tokens that expire after 7 days; the service account remains the
  unattended GSC path. A public app needs Google verification for `webmasters.readonly`.
- The Yandex `verification_code` flow cannot verify `state` across the separate URL-only and code steps; the code
  is short-lived and the client secret is still required.
- Bing Webmaster, IndexNow, CrUX and PSI remain key-based; the card does not offer OAuth for them.
- `MIN_ENGINE_VERSION` is `0.13.1`, so a `0.12.x` engine is rejected. The card has no `--allow-write`, confirm
  token or provider write path.

## 0.9.0 read-only Diagnostics

Released on 2026-11-17. It bundles `lv24-seo 0.11.0` and requires `MIN_ENGINE_VERSION` `0.11.0`, so a `0.10.x`
engine is reported as incompatible. It adds no provider write.

- **Diagnostics screen.** The sidebar gains **Diagnostics** (`/diagnostics`) with five tabs over the active
  workspace. Every command is read-only and runs through the fixed `cli_run` allow-list; the screen has no
  write buttons, no confirm tokens and no `--allow-write` path.
- **Google.** `gsc_inspect` inspects exactly one absolute URL and shows verdict, coverage state,
  robots/indexing state, last crawl, fetch state, Google/user canonical, `crawledAs`, referring URLs,
  rich-result issues and the inspection link. `gsc_sitemaps` lists submitted sitemaps with type, index flag,
  errors, warnings and per-content submitted counts. GSC's deprecated `indexed` count is labelled as such;
  child sitemap URLs of an index are not exposed.
- **Yandex.** `yandex_indexing` shows appeared/removed events and indexing HTTP buckets for a date window.
  `yandex_sitemaps` lists sitemap ids, URL/error counts and last access. `yandex_queue` lists recrawl tasks
  with the provider total. A provider reset or an empty answer is shown as `client_side_date_filter` /
  `provider_returned_no_rows`, not as zero data.
- **Bing.** `bing_pages`, `bing_traffic`, `bing_crawl`, `bing_urlinfo` and `bing_joins` expose page stats,
  daily clicks/impressions, six-month crawl buckets, URL index/crawl details and the query/page joins.
  Empty stats render `no_rows_for_window`; lookups render `provider_returned_no_rows`. The
  `Date(-62135596800000)` sentinel is shown as “never”, not 0001.
- **Metrika.** `metrika_pages`, `metrika_goals`, `metrika_devices`, `metrika_countries`,
  `metrika_engagement` and `metrika_bytime` are organic-only (`ym:s:lastTrafficSource=='organic'`). The tab
  shows `meta.organic_only`, the sampling fields (`sample_share`, `sample_size`, `sample_space`, `data_lag`,
  `contains_sensitive_data`, `total_rows_rounded`) and every limitation.
- **Core Web Vitals.** `cwv_audits` lists bounded Lighthouse audits with score, display value and savings;
  `cwv_history` lists weekly CrUX p75 rows with collection periods. A low-traffic URL shows the explicit
  `low_traffic` empty state instead of a blank table.
- **Honest report chrome.** Every tab renders the engine's `total`, `truncated`, `data_age_days` and
  `limitations` (or states that no limitations were reported). Provider empties are explicit states, never
  zeros. The panels do not auto-retry reads.
- **Bridge hardening.** The Rust bridge adds 18 allow-listed command ids and rejects, before spawning the
  engine: write flags (`allowWrite`, `confirm`) and tokens on every diagnostics command; unknown `group`,
  `strategy`, `device` or `category` values; arguments that belong to a different command; and a `--site`
  override for Bing reads (the target stays `providers.bing.site`). The webview cannot pass an executable,
  a shell string or an arbitrary flag. Diagnostics commands are config-required and non-cancellable.
- **Engine 0.11.0 and contracts.** `MIN_ENGINE_VERSION` is `0.11.0`; an installed `0.10.x` sidecar is
  reported as incompatible instead of failing with `CLI_INVALID_JSON`. The bundled onedir sidecar is
  `lv24-seo 0.11.0`. Contracts (`config.schema.json`, CLI fixtures including `stats`) are regenerated from
  engine `0.11.0`. Bing URL submission, Bing sitemap submit and IndexNow keep their existing two-phase
  gates; GSC sitemap submit and Bing sitemap delete remain `WRITE_DISABLED`.

Verification recorded for this release: 742 Vitest tests and 163 Rust tests passed, contracts are up to date
at engine `0.11.0`, and the Windows x64 sidecar was verified against the pinned SHA-256 (`db02d1b3…`,
14,478,498 bytes). Linux and macOS are covered by rebuild-aware checksum reports.

Known limits in 0.9.0:

- Metrika goals are shown as totals only; the desktop does not expose the engine's optional
  `--dimension page|source` selector.
- CWV history “all devices” omits the device filter instead of inventing a combined row.
- Bing reads use `providers.bing.site`; the desktop has no `--site` override.
- Bing Site Scan still has no public API: the Integrations card only opens the official page and cannot
  import a scan report.
- An engine older than `0.11.0` is reported as incompatible. Update the engine or install the bundled sidecar.
- The Diagnostics panels do not auto-retry; a failed read shows the engine error and a manual retry.
- The screen is read-only by design: it adds no recrawl, sitemap or URL submission action.

## 0.8.0 Bing URL submission

Released on 2026-11-17. It bundles `lv24-seo 0.10.0` and requires `MIN_ENGINE_VERSION` `0.10.0`, so a `0.9.x`
engine is reported as incompatible.

- **Bing URL submission card.** Integrations builds
  `bing submit --config <path> [--url <abs> ...] [--from-sitemap] [--sitemap-url <abs>] --allow-write [--confirm <token>] --json`.
  Planning sends the write opt-in but no token, reads the current quota and contacts no write endpoint. The card
  shows the URL count, the 500-URL batch count, the remaining quota and the engine's limitations, and **Apply**
  sends the reviewed token. A cancelled or failed apply drops the plan and requires a fresh review.
- **URL list, sitemap or both.** URLs are entered one per line and/or read from the project sitemap. The shell
  merges both sources, requires at least one, accepts at most 10,000 URLs, and rejects a relative URL, a duplicate
  write flag or a token without the opt-in before the engine starts. The engine reads a `<urlset>` directly and
  bounds a `<sitemapindex>` to the root plus five child sitemaps and 10,000 URLs; off-site URLs are skipped and
  every cap is reported. Apply re-fetches the sitemap and invalidates the token with `CONFIRM_REQUIRED` if the URL
  set changed.
- **Accepted, not indexed.** `SubmitUrlbatch` runs in explicit 500-URL batches after a daily and monthly quota
  pre-check. A batch success has no per-URL status, so the result says **accepted**, never indexed, and reports
  batches and quota after the write. A duplicate URL may consume quota because Bing does not document submit
  idempotency; the write ledger still rejects a replayed token as `skipped`/`duplicate`.
- **Read-only sitemap, issues and quota cards.** `bing_sitemaps` lists URL, provider status, last crawl and URL
  count, and states that Bing has no per-URL sitemap errors or paging. `bing_issues` shows URL, HTTP code,
  in-links and the decoded bitmask labels (`1=301`, `2=302`, `4=4xx`, `8=5xx`, `16=robots`, `32=malware`,
  `64=important_robots`, `128=dns`, `256=timeout`); unknown bits stay visible and no severity or date is invented.
  `bing_quota` shows daily and monthly remaining submissions, states that the monthly window can bind first and
  that the reset schedule is undocumented, and never computes used or total values. A failed read shows the
  engine error and a manual retry; nothing is polled.
- **Existing Bing surface.** The sitemap submit card, IndexNow from the sitemap and the official Bing Site Scan
  opener remain. The target site comes from `providers.bing.site`; the desktop accepts no per-run `--site`
  override. A missing site is `CONFIG_INVALID`, a missing `bing_api_key` is `AUTH_REQUIRED` with a Settings hint,
  and the key never appears in an error or result.
- **Engine 0.10.0 and contracts.** The sidecar adds `bing submit`, `bing quota`, `bing sitemaps` and `bing issues`.
  Contracts were regenerated from `lv24-seo 0.10.0`; only the fixture version strings change and no command surface
  is added to the fixtures. `MIN_ENGINE_VERSION` is `0.10.0` because an older engine would answer the new commands
  with `CLI_INVALID_JSON`. The per-session write secret and the reviewed-plan flow are unchanged.

Known limits in 0.8.0:

- The desktop has no `--site` override; the target comes from `providers.bing.site` in the active `seo.toml`.
- The read-only quota, sitemap and issue cards do not auto-retry; a failed load needs a manual retry.
- Bing URL submission is a provider network write: it is not cancellable, is not retried automatically and has no rollback.
- Accepted is not indexed; Bing returns no per-URL status for `SubmitUrlbatch`.
- Quota counts are remaining, not used or total; the monthly window can bind first and the reset is undocumented.
- `GetFeedDetails` is a note in the panel, not a screen; index children are expanded only on the engine side.
- `MIN_ENGINE_VERSION` is `0.10.0`, so a `0.9.x` engine is rejected.

## 0.7.0 Bing indexing

Released on 2026-11-17. It bundles `lv24-seo 0.9.0` and requires `MIN_ENGINE_VERSION` `0.9.0`, so an `0.8.x`
engine is reported as incompatible.

- **Bing sitemap panel.** The Integrations screen adds a sitemap submit card for
  `sitemap submit --provider bing --config <path> [--url <abs>] --allow-write [--confirm <token>] --json`.
  Planning sends the write opt-in but no token and only mints the plan; it does not call Bing. The card shows the
  action, target, summary, plan hash, TTL, payload details and limitations, and **Apply** sends the reviewed
  token. A missing `bing_api_key` is shown as `AUTH_REQUIRED` with a Settings hint. An empty URL field uses
  `{project.base_url}/sitemap.xml`; a supplied URL must be absolute `http(s)://`.
- **IndexNow from the sitemap.** `indexnow_submit` builds
  `indexnow submit --from-sitemap --config <path> [--sitemap-url <abs>] --allow-write [--confirm <token>] --json`.
  The plan fetches and parses the sitemap read-only, deduplicates URLs, skips URLs outside the IndexNow host and
  reports `truncated`, `total` and `limitations`. The result card shows the engine status and submitted URL count
  plus skipped or duplicate rows. Host, key and key location come from `providers.bing.site`,
  `providers.bing.indexnow_key` and `providers.bing.indexnow_key_location`; a changed sitemap invalidates the plan.
- **Bing Site Scan opener.** Bing has no public API for starting a Site Scan, so `open_bing_sitescan` only opens
  the hard-coded official page `https://www.bing.com/webmasters/sitescan?siteUrl=<percent-encoded>` in the default
  browser. The desktop does not start, poll or import a scan, and never reports that one started.
- **Per-session write secret.** The shell draws 32 bytes from the OS CSPRNG at startup, keeps the 64-character hex
  `LV24_SEO_WRITE_SECRET` only in Rust memory (zeroized on drop) and sets it on every engine child after
  `env_clear()`. It is never written to settings, argv, logs, diagnostics or the webview. The same secret serves
  the plan and the apply in one session, so an old plan token is rejected and the UI re-plans.
- **Engine 0.9.0 and contracts.** The sidecar adds Bing `SubmitFeed` with the idempotency ledger, one-click
  IndexNow from a bounded sitemap and the new Bing config keys. Contracts were regenerated from `lv24-seo 0.9.0`;
  the `seo_sitemap_submit` input schema gains the optional `provider`. `MIN_ENGINE_VERSION` is `0.9.0` because a
  pre-`0.9.0` engine would answer the new commands with `CLI_INVALID_JSON`.

Known limits in 0.7.0:

- The Bing Site Scan starts on the Bing page; the desktop only opens it and does not monitor, cancel or import a scan.
- IndexNow needs a hosted key file at `https://<host>/<key>.txt` or the configured location; a missing or mismatched file submits nothing.
- Sitemap submit and IndexNow are provider network writes: they are not cancellable background runs, are not retried automatically and have no rollback.
- Plan tokens are bound to the reviewed plan and the app session; a changed sitemap, a new session or an expired TTL needs a fresh plan.
- GSC sitemap submit/delete, Bing sitemap delete and Yandex recrawl remain `WRITE_DISABLED`.
- `MIN_ENGINE_VERSION` is `0.9.0`, so an `0.8.x` engine is rejected.

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
| Engine marked offline | Engine missing or below the shell's minimum version (`0.14.1`) | Use the bundled engine, or point `LV24_SEO_BIN` at a compatible engine |
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
- Cancel is not rollback and there is no job queue in `0.9.4`: a cancelled crawl, report, log analysis, backup or schedule install may leave a partial artefact, and a cancelled in-place restore keeps the `.pre-restore-<utc>` copy but may have replaced one file, so build a fresh plan before retrying. Closing the window does not move a run into a queue.
- Restore replaces the database and config and never merges; the `.pre-restore-<utc>` copies are the only rollback, and a database held open by another process cannot be replaced on Windows. Tokens are excluded, so re-authenticate afterwards. `backup restore --to` is a CLI-only extraction.
- Schedule install mutates the host: it writes a cron entry, systemd user timer or Windows task only after confirmation, and only on this computer. The desktop does not manage, repair or uninstall the job; use `schedule status`/`schedule uninstall` in the CLI.
- GSC service accounts are configured outside the form: set `providers.gsc.service_account_file` in `seo.toml` or `LV24_SEO_GSC_SERVICE_ACCOUNT_FILE` in the environment. The desktop has no field for it.
- The CWV card is empty without CrUX/PSI field rows that carry a URL and a device; `cwv collect` is a CLI command, PSI lab rows are never stored, and at most five templates are shown.
- Portfolio reports local history only, inspects at most 50 sites per scan and never calls a provider.
- Bot triage is User-Agent only: a spoofed UA is not detected and non-search crawlers are reported as `other`.
- One log file at a time, at most 100 MiB; there is no rotation, glob, remote fetch or persisted log history.
- `MIN_ENGINE_VERSION` is `0.14.1`, so a `0.14.0` engine is rejected; the desktop does not silently downgrade commands to an older engine.
- The Diagnostics screen is read-only and covers 18 allow-listed commands; it has no recrawl, sitemap or URL submission action, and the panels do not poll or auto-retry.
- The Indexing automation card is read-only: `indexing status|run|history` still run through the CLI and scheduler, and the card cannot install, edit or run the job.
- OAuth consent is not live-verified; a Google Testing app expires refresh tokens after 7 days, and the Yandex URL-only and code steps cannot verify `state` across separate calls. Bing, IndexNow, CrUX and PSI stay key-based.
- Only GSC exposes a per-URL index verdict. The desktop renders the engine's `no_per_url_index_count` and `gsc_indexed_count_deprecated` limitations instead of inventing an indexed total.
- Metrika goals are shown as totals only, and CWV history “all devices” omits the device filter instead of inventing a combined row.
- Bing sitemap submit needs a Bing Webmaster API key, and IndexNow needs `providers.bing.indexnow_key` plus a hosted key file. A missing key is reported as `AUTH_REQUIRED`, not as a generic failure.
- Bing URL submission uses `providers.bing.site`; the desktop has no per-run `--site` override. Accepted means Bing received the batch, not that a URL was indexed, and a duplicate URL may consume quota.
- Quota cards show remaining daily and monthly submissions, not used or total values; the monthly window can bind first and the reset schedule is undocumented.
- The read-only quota, sitemap and issue cards do not poll or auto-retry; a failed load shows the engine error and a manual retry.
- `GetFeedDetails` is explained as a note, not a screen; index children are expanded only on the engine side.
- The Bing Site Scan opener only launches the official page; the scan is started and managed in the Bing UI. The desktop never claims that a scan started.
- Sitemap submit and IndexNow write to a provider: they are not cancellable, are not retried automatically and have no rollback; plan tokens expire with the app session.
- Bing URL submission is a provider network write: it is not cancellable, is not retried automatically and has no rollback; review a fresh plan before retrying.
- The digest is evidence-based triage, not causal proof; items without evidence stay `unexplained`.
- Scheduled runs are installed only after confirmation and only on this host; the desktop does not manage or uninstall the job and never edits an MCP client config. Use `schedule status`/`schedule uninstall` in the CLI. Scheduled runs never write to a provider; the Bing indexing panel is the only provider write surface and is gated by the reviewed plan.
- Config-path approval is per process plus the persisted `knownConfigs` list; a path outside both still needs the native dialog.
- Windows ACL hardening is best effort. If `icacls` fails, the save proceeds and the draft keeps the directory's inherited DACL.
- Update cancellation is observed only before the installer starts. Once installation begins there is no rollback.
- An external engine is version-gated rather than bundled. The UI labels it as external and checks the minimum version.
- Recommendation copy is localised in en/ru/zh; tasks queued before `0.2.3` keep the stored English text.
- This is a `0.x` preview: configuration output, updater behavior and UI details may change before 1.0.

Source: `_source/desktop-README.md`, `_source/desktop-releases-0.9.5.md`, `_source/desktop-releases-0.9.4.md`, `_source/desktop-releases-0.9.4-update.md`, `_source/desktop-releases-0.9.3.md`, `_source/desktop-releases-0.9.3-update.md`, `_source/desktop-releases-0.9.2.md`, `_source/desktop-releases-0.9.1.md`, `_source/desktop-releases-0.9.0.md`, `_source/engine-releases-0.15.1.md`, `_source/engine-releases-0.15.0.md`, `_source/engine-releases-0.14.1.md`, `_source/engine-releases-0.14.0.md`, `_source/engine-releases-0.13.1.md`, `_source/engine-releases-0.13.0.md`, `_source/desktop-releases-0.8.0.md`, `_source/desktop-releases-0.7.0.md`, `_source/desktop-releases-0.6.0.md`, `_source/desktop-releases-0.5.0.md`, `_source/desktop-releases-0.4.0.md`, `_source/desktop-releases-0.3.0.md`, `_source/desktop-releases-0.2.3.md`, `_source/desktop-releases-0.2.2.md`, `_source/desktop-releases-0.2.1.md`, `_source/desktop-releases-0.2.0.md`, `_source/desktop-security.md`, `_source/desktop-architecture.md`, `_source/engine-releases-0.12.2.md`, `_source/engine-releases-0.11.0.md`.

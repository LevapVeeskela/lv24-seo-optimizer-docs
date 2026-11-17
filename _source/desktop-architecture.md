# Architecture

Status: **implementation contract for `0.9.0` (current release, 2026-11-17; `0.8.0` is the previous
published line).** The Rust command bridge and product screens are implemented in this repository.
Where this document describes a control, it is the requirement that implementation must satisfy. The
pinned engine is `lv24-seo 0.11.0`. `0.9.0` adds the read-only diagnostics commands (Google, Yandex,
Bing, Metrika and Core Web Vitals) and raises `MIN_ENGINE_VERSION` to `0.11.0`. It keeps the `0.8.0`
gated `bing_submit` and read-only `bing_sitemaps`/`bing_issues`/`bing_quota`, the `0.7.0` gated
`sitemap_submit`/`indexnow_submit` and the `open_bing_sitescan` opener, the `0.6.0` cancellable
background runs (`run_cancel`), window-wide run banner and the schedule-install `--allow-write`
opt-in that engine `0.8.0` requires.

The read-only diagnostics commands listed in section 4 are implemented in `0.9.0` and require engine
`lv24-seo 0.11.0`.

## 1. Shape

```
┌──────────────────────────────────────────────────────────────┐
│ Webview: React 19 + TypeScript + Vite + MobX                 │
│  app / pages / features / entities / shared                  │
│  settings forms · configuration outputs · reports · updates  │
│  invoke("config_read") · invoke("cli_run") · events          │
└───────────────────────────┬──────────────────────────────────┘
                            │ Tauri IPC, allow-listed commands
┌───────────────────────────▼──────────────────────────────────┐
│ Rust shell                                                   │
│  config read / validate / write (toml_edit)                  │
│  CLI runner: argv array, stdin, timeout, bounded output      │
│  path allow-list · secret stdin bridge · Rust updater        │
└───────────────────────────┬──────────────────────────────────┘
                            │ child process, one workspace at a time
┌───────────────────────────▼──────────────────────────────────┐
│ lv24-seo Python CLI (PyInstaller onedir sidecar)             │
│  --json envelopes · reports · crawl · SQLite · MCP server    │
│  keychain / env / opt-in file secrets                        │
└──────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│ GitHub Releases                                              │
│  latest.json + signed NSIS / .app.tar.gz / AppImage          │
└──────────────────────────────────────────────────────────────┘
```

The desktop is a **UI + local process shell**. It does not reimplement provider clients, crawl
rules, analysis, report builders or delivery. Those remain in `lv24-seo`, which is the engine of
record and the only component that talks to provider APIs.

## 2. Trust boundaries

| Boundary | What crosses it | Control |
|---|---|---|
| Webview → Rust | command name, validated arguments, one-time secret input | fixed command table, argument schemas, no executable or shell string |
| Rust → engine | argv array, optional stdin, config path, cwd | absolute `--config`, `--json`, path allow-list, per-command timeout |
| Engine → provider | user credentials, queries, site URLs | engine-owned HTTP clients, rate limits, read-only defaults |
| Engine → local disk | SQLite, reports, snapshots | configured data directory; desktop does not invent paths |
| Desktop → GitHub | `latest.json`, signed update package | HTTPS, embedded minisign public key, `requireSignedVersion`, no downgrades |

The webview is untrusted input. It can request a known operation with validated arguments; it cannot
choose an executable, construct a shell command, read arbitrary files, or write outside the approved
roots. The Rust layer is the authorization boundary. The engine is trusted to enforce provider
semantics and its own write gates.

## 3. No local HTTP API

There is **no local HTTP API** in v0.2. The CLI already returns stable `--json` envelopes, and a
loopback server would add authentication, CSRF/proxy handling and another lifecycle to secure for
little gain. The desktop uses a direct child-process bridge.

A future local API is allowed only as an explicit, opt-in design with its own authentication and
loopback binding. It is not a dependency of the current architecture.

## 4. Command bridge

All engine calls use:

- an **argument array**, never a shell string;
- an absolute `--config` path (or an explicit workspace selected in Settings);
- `--json` and one parsed envelope;
- a bounded timeout and an exact child handle;
- `cwd = config parent` so a relative `storage.data_dir` resolves like a terminal run.

The envelope is:

```ts
type Envelope<T> =
  | { ok: true; data: T; meta: Record<string, unknown>; warnings: string[] }
  | { ok: false; error: { code: string; message: string; next_action?: string; retryable?: boolean };
      meta: Record<string, unknown>; warnings: string[] };
```

Rules:

- `ok=false` is a typed UI error, not a crash and not a reason to guess.
- Branch on `error.code`, not the exit code. `WRITE_DISABLED`, `CONFIRM_REQUIRED` and configuration
  errors can all exit `2`.
- Preserve unknown `meta` keys for diagnostics; tolerate additive fields.
- `stdout` is JSON only. `stderr` is bounded; the configuration-validation path redacts it before
  display (see section 7).
- The exit code is shown in diagnostics but the envelope is authoritative.
- Set `PYTHONUTF8=1` and `PYTHONIOENCODING=utf-8` so non-ASCII paths and text survive Windows code
  pages.
- On Windows, launch with `CREATE_NO_WINDOW`; capture stdout/stderr as UTF-8 with a bounded buffer.

The command surface is fixed. The generic `cli_run` allow-list is:

| Desktop command | Engine call | Class |
|---|---|---|
| `version` | `version --json` | read |
| `stats` | `stats --days <n> --lag-days <n> --json` | read |
| `config_show` | `config show --config <path> --json` | read |
| `doctor` | `doctor --json` | read |
| `properties` | `properties --json` | read |
| `auth_status` | `auth status --json` | read |
| `report_weekly` | `report weekly --out <app data>/exports/reports --json` | local write |
| `report_diff` | `report diff ... --json` | read |
| `crawl` | `crawl ... --json` | local write |
| `init` | `init <property> --config <path> --data-dir <path> --json` | local write |
| `schedule_print` | `schedule print --cron <expr> --target <cron\|systemd\|windows> --config <path> --json` | read |
| `logs_analyze` | `logs analyze --file <path> [--bot <class>] --json` | read |
| `tasks_list` | `tasks list [--property <id>] [--kind <kind>] [--state <state>] [--limit <n>] --json` | read |
| `tasks_add` | `tasks add --kind <kind> --url <url> --rule <rule> [--property <id>] [--payload <json>] --json` | local write |
| `tasks_update` | `tasks update <id> --state <state> --json` | local write |
| `backup_create` | `backup create --out <dir> [--force] --json` | local write |
| `backup_restore` | `backup restore --file <zip> --config <path> [--allow-write --confirm <token>] --json` | local write (gated) |
| `portfolio_list` | `portfolio list --root <dir> [--limit <n>] --json` | read |
| `schedule_install` | `schedule install --kind weekly\|daily [--cron <expr>] --config <path> --allow-write --json` | host write (gated) |
| `sitemap_submit` | `sitemap submit --provider bing --config <path> [--url <abs>] --allow-write [--confirm <token>] --json` | provider write (gated) |
| `indexnow_submit` | `indexnow submit --from-sitemap --config <path> [--sitemap-url <abs>] --allow-write [--confirm <token>] --json` | provider write (gated) |
| `bing_submit` | `bing submit --config <path> [--url <abs> ...] [--from-sitemap] [--sitemap-url <abs>] --allow-write [--confirm <token>] --json` | provider write (gated) |
| `bing_sitemaps` | `bing sitemaps --config <path> --json` | read |
| `bing_issues` | `bing issues --config <path> --json` | read |
| `bing_quota` | `bing quota --config <path> --json` | read |
| `gsc_inspect` | `gsc inspect --url <abs> [--language <tag>] --json` | read |
| `gsc_sitemaps` | `gsc sitemaps [--sitemap-index <abs>] --json` | read |
| `yandex_indexing` | `yandex indexing [--date-from <d>] [--date-to <d>] --json` | read |
| `yandex_sitemaps` | `yandex sitemaps [--id <id>] [--parent-id <id>] [--limit <n>] --json` | read |
| `yandex_queue` | `yandex queue [--id <id>] [--limit <n>] [--offset <n>] [--date-from <d>] [--date-to <d>] --json` | read |
| `bing_pages` | `bing pages --json` | read |
| `bing_traffic` | `bing traffic --json` | read |
| `bing_crawl` | `bing crawl --json` | read |
| `bing_urlinfo` | `bing urlinfo --url <abs\|domain:host> --json` | read |
| `bing_joins` | `bing joins [--query <text>] [--page <abs\|domain:host>] --json` | read |
| `metrika_pages` | `metrika pages --days <n> --lag-days <n> [--limit <n>] --json` | read |
| `metrika_goals` | `metrika goals --days <n> --lag-days <n> [--limit <n>] --json` | read |
| `metrika_devices` | `metrika devices --days <n> --lag-days <n> [--limit <n>] --json` | read |
| `metrika_countries` | `metrika countries --days <n> --lag-days <n> [--limit <n>] --json` | read |
| `metrika_engagement` | `metrika engagement --days <n> --lag-days <n> --json` | read |
| `metrika_bytime` | `metrika bytime --days <n> --lag-days <n> [--group day\|week\|month] --json` | read |
| `cwv_audits` | `cwv audits --url <abs> [--strategy mobile\|desktop] [--category <c> ...] --json` | read |
| `cwv_history` | `cwv history (--url <abs>\|--origin <abs>) [--device phone\|desktop\|tablet] [--weeks <n>] --json` | read |

Dedicated Tauri commands cover the rest: `shell_status`, `config_read`, `config_validate`,
`config_write`, `config_patch`, `auth_set` (secret over stdin), `auth_delete`, `write_text_file`,
`settings_get`, `settings_set`, `pick_config`, `pick_directory`, `pick_log_file`,
`pick_backup_archive`, `open_path`, `open_bing_sitescan`, `prepare_update`, `update_install`,
`update_cancel` and `run_cancel`. The webview cannot add a command at runtime.

`cli_run` accepts an optional `runId` only for the six long local jobs listed in
`CliCommandId::cancellable` (`crawl`, `report_weekly`, `logs_analyze`, `backup_create`,
`backup_restore`, `schedule_install`). A run id for any other command is rejected with
`RUN_NOT_CANCELLABLE`, so a short read keeps its plain synchronous path. The id is a bounded ASCII
key supplied by the webview before the call; it is a cancellation handle, never a process, path or
command.

`pick_config` is the only way to introduce a new workspace path: it opens the native dialog, records
the canonical path as approved for this process and returns it. `settings_set` accepts a changed
`configPath` only when it matches that approval or a path in the persisted `knownConfigs` list,
otherwise it fails with `PATH_NOT_APPROVED`. `knownConfigs` is written by `pick_config` and by a
successful `init` (canonical, deduplicated, capped at 20), so a workspace opened in an earlier run can
be re-activated after a restart without the dialog; it is a convenience, not a bypass. The webview no
longer calls `@tauri-apps/plugin-dialog` for this, so it cannot name a file the dialog did not produce.

`pick_directory` is the matching approval for `init`: the folder chosen in the native dialog is the
only place `init` may create `seo.toml` and `data/` (or the parent of the active config). The same
approval covers `backup_create`: its output must be the app export directory (or a child of it) or a
folder picked in the dialog, so an arbitrary existing folder is not enough. `init` and
`schedule_print` validate their arguments in the shell before the engine sees them; `schedule_print`
must target the active config and only renders text.

`pick_log_file` is the approval for `logs_analyze`: the chosen file is the only arbitrary log path
the shell will read, and a path under the app data/export directories is also accepted. Everything
else is `PATH_NOT_APPROVED` before the engine is spawned. The engine opens the file read-only; the
shell never writes to it.

`pick_backup_archive` is the approval for `backup_restore`: the chosen `.zip` is the only arbitrary
archive the shell will read, and a path under the app export directory is also accepted. The restore
is two-phase: the plan call carries neither `allowWrite` nor `confirm`, the apply call carries both
and the token must come from the plan. `pick_directory` also approves the portfolio root, so
`portfolio_list` can only scan a folder the user picked. `schedule_install` requires the active
config and a confirmed `allowWrite=true`; the UI asks for confirmation first, and the shell appends
`--allow-write` only then. Without that opt-in the call is refused with `CONFIRM_REQUIRED` before
the engine is spawned, so a plan-only engine default cannot be bypassed by the webview.

`sitemap_submit` and `indexnow_submit` are provider writes with the same two-shape gate. The engine's
write gate requires the explicit opt-in even for the plan, so both the plan and the apply call send
`--allow-write`; only the apply adds `--confirm <token>`. The plan does not write to the provider, it
mints the reviewed token. `--url` / `--sitemap-url` are optional, so the engine defaults to
`{project.base_url}/sitemap.xml`; when supplied they must be absolute http(s) URLs. The shell pins
`--config` to the active workspace because the engine opens its write ledger next to that config.
`sitemap_submit` accepts only `--provider bing`; `indexnow_submit` takes no provider and no per-URL
list.

`bing_submit` is the native Bing URL submission command with the same plan/apply gate. It accepts a
repeated `--url` list, `--from-sitemap`, and an optional `--sitemap-url`; `--sitemap-url` is rejected
without `--from-sitemap`, and at least one URL or the sitemap source is required. The optional
`provider` field is accepted only as `bing` and is never emitted because the command group already
names Bing. Plan counts and the apply result are shown honestly: the URL count and batches come from
the engine, and success means Bing **accepted** the URLs, not that they were indexed. The engine
reports no per-URL status, so the UI never invents one.

`bing_sitemaps`, `bing_issues` and `bing_quota` are read-only. They take only `--config` and `--json`;
the shell rejects `--allow-write`, a confirm token, a sitemap URL or any per-URL argument. The panel
shows `GetFeeds` rows (URL, free-form status, last crawl, URL count), `GetCrawlIssues` rows (URL, HTTP
code, decoded issue bitmask, in-links) and `GetUrlSubmissionQuota` remaining daily/monthly values. The
quota is always labeled as remaining, never as used or total. `GetFeedDetails` is not a separate
screen: it only expands sitemap-index children, and the panel states that Bing does not return a
per-URL error reason or crawl status.

The read-only diagnostics commands (`gsc_inspect`, `gsc_sitemaps`, the three `yandex_*` reads, the
five `bing_*` reads, the six `metrika_*` reads and the two `cwv_*` reads) share one contract. Each
has a short argument allow-list; the shell rejects a field that belongs to another command, an
unknown `group`/`strategy`/`device`/`category` value, `allowWrite`, a confirm token or a raw
provider option before the engine is spawned. They all require the active project config and are
never cancellable, because each is a bounded read. The Diagnostics screen renders `meta.total`,
`meta.truncated`, `meta.data_age_days` and `meta.limitations` for every answer, plus
`meta.organic_only` and the sampling fields for Metrika. An empty provider answer is shown as
`no_rows_for_window`, `provider_returned_no_rows` or `low_traffic` — never as a zero row. Bing
statistics take the site from `providers.bing.site`; the webview cannot pass `--site`.

The engine also requires a non-empty `LV24_SEO_WRITE_SECRET`. The desktop generates 32 random bytes
from the OS CSPRNG once at startup, stores the 64-character hex value in `AppState` in memory only and
sets it on every engine child after `env_clear()`; it is never an argv element, a settings value, a log
line or part of a result envelope. The same value is used for the plan and the apply in one session; a
new session gets a new secret, so a token from an older session is rejected and the UI reviews a fresh
plan. A CLI user who runs the engine directly sets `LV24_SEO_WRITE_SECRET` in their own environment.

`open_bing_sitescan` is not an engine command. It accepts only an absolute `https://` site URL,
percent-encodes it with the RFC 3986 unreserved set and opens exactly
`https://www.bing.com/webmasters/sitescan?siteUrl=<encoded>` in the OS default browser. The host and
path are hard-coded; the webview cannot supply a destination. The official Bing Webmaster API method
list has no Site Scan method, so the command returns the opened URL and the UI states that the user
starts the scan on the Bing page.

`update_install` and `update_cancel` exist because the webview holds only `updater:allow-check`. The
Rust side re-checks the endpoint, refuses a version that differs from the announced one, serializes
one install at a time, emits `update://progress` and stops tracked sidecars before handing the bytes
to the installer. See section 10.

## 5. Engine discovery and version gate

Resolution order:

1. `LV24_SEO_BIN` (absolute path; development or an explicitly chosen system engine);
2. the bundled resource `engine/lv24-seo/lv24-seo[.exe]`;
3. a flat resource `lv24-seo/lv24-seo[.exe]` (portable layout);
4. a Linux AppImage tree under `$APPDIR/usr/lib/<product>/engine/lv24-seo/` (the mounted AppImage
   layout; the scan is one level deep so it does not depend on the bundle's product name);
5. a sibling `lv24-seo/` directory next to the app (portable layout);
6. `PATH`, only when `LV24_SEO_ALLOW_PATH_ENGINE=1` is set (opt-in; only the value `1` enables it,
   and a stray `lv24-seo` on `PATH` is otherwise ignored).

The AppImage step is the fallback that keeps an AppImage build from silently dropping to `PATH` when
`resource_dir()` points somewhere other than the mounted engine tree.

Nothing is downloaded automatically. The shell runs `lv24-seo version --json`, records the path,
source and version, and compares the version with `MIN_ENGINE_VERSION` (`0.11.0`). An older engine is
marked `compatible: false`; the UI treats the engine as offline and shows the standard offline
notice. It does not silently downgrade or run the command. A newer engine passes the gate but is not
the release-tested pin.

The `source` labels are `env`, `bundled`, `bundled-flat`, `appimage`, `sibling` and `PATH`. The
portable ZIP uses a sibling or flat resource layout, which is how the updater recognizes that the
build cannot replace itself.

## 6. Configuration write model

Structured Settings forms edit a draft model. The save flow is:

1. build a TOML patch with `toml_edit` so comments and key order survive;
2. write a temporary file next to the target (owner-only ACL, see below) and fsync it;
3. validate it with `lv24-seo config show --config <temp> --json`;
4. create a timestamped owner-only backup, fsynced, keeping the last five;
5. atomically replace the target and fsync the parent directory;
6. re-read and show the effective redacted config.

The save runs on a blocking task with a deadline rather than on the UI thread, so a 64 MiB export or
a dead network share cannot freeze the window; exceeding the deadline returns `PATH_TIMEOUT`. The
blocking task itself cannot be aborted, so its thread survives a timeout.

Reads are bounded (`8 MiB`) and reject a non-regular or oversized file. Settings load per field, so
one malformed value does not discard the rest. A stale saved config path is tolerated: the shell
reports `configExists: false`, the dashboard shows a **workspace configuration not found** notice
with a **Choose config** action, and stats/report calls are blocked instead of failing generically.
Windows reserved device names and trailing dots or spaces are rejected in every path component.

A workspace path is consent-gated. `pick_config` approves the canonical path for the process;
`settings_set` rejects any other new value with `PATH_NOT_APPROVED`. The engine cannot be pointed at
an arbitrary file by a config the webview merely read.

`storage.data_dir` is rejected with `INVALID_PATH` (`reason: network_or_device_path`) when it names
`\\server\share`, `\\?\C:\…`, `\\.\device`, `\??\…` or `//host/share`. The check is string-based and
runs before the value is joined to the config directory, because joining would hide the prefix.
Otherwise resolving it would authenticate to an SMB share and could block for the SMB timeout. The
same filter applies to a data directory reported by the engine.

On Windows, a temp draft inherits its directory's DACL, which on a share or under `C:\Users\Public`
can grant other users read access to a file that holds the same tokens as the config. The shell
removes inheritance and grants full control to `OWNER RIGHTS` (`S-1-3-4`) before any bytes are
written; `icacls` receives arguments through `Command::arg`, never a shell string. A rejected ACL is
logged and tolerated so it cannot block saving. Backup retention matches only names this app writes
(`<config>.bak-YYYYMMDDTHHMMSSZ` or `…-<n>`), so a hand-made `seo.toml.bak-before-experiment` is never
deleted by housekeeping.

Form saves are field-level patches, so comments, key order and unrelated external edits survive. If
another process changed the file, reload before saving so the form reflects the current file; the
Diff tab shows saved-vs-draft fields. Windows file locks produce a retry message, not a partial write.
The draft carries a revision counter: if the user typed while the engine was writing, the returned
snapshot is **not** copied over the newer draft. The edits stay, the diff shows them and validation is
cleared, instead of the silent data loss that replacing the draft would cause.

Source TOML is shown read-only in the Configuration screen, with secret-looking values redacted.
There is no raw editor. Edits go through the Settings form, which is validated by the engine before a
patch is written. A parse error blocks the form and names the line and column. Environment overrides
are read-only badges: the UI shows the variable name and explains that the environment wins over the
file. Values are never displayed.

## 7. Long-running calls and failure model

Engine calls are synchronous from the UI's perspective. Each command has a fixed timeout: `crawl`
600 seconds; `stats`, `report weekly`, `report diff`, `sitemap_submit`, `indexnow_submit`,
`bing_submit` and `cwv_audits` 120 seconds; `bing_sitemaps`, `bing_issues`, `bing_quota` and the other
read-only diagnostics commands 60 seconds; `version`, `config show`, `doctor`, `properties` and
`auth status` 30 seconds; `auth set`/`auth delete` 120 seconds. A timeout kills the exact child
process and returns a typed error.

- **Cancellable long jobs.** `crawl`, `report weekly`, `logs analyze`, `backup create`,
  `backup restore` and `schedule install` may carry a stable run id. The Rust runner registers
  `run id -> exact child PID` before the spawn. `run_cancel(runId)` marks that run cancelled and
  signals only the recorded PID (and, on Unix, its process group), after confirming the PID is still
  an engine image or one of the exact children this process tracks (a development engine may be a
  Python interpreter). It never matches a process by name, so another installed copy or an unrelated
  process is not touched. `false` means the run already finished, the id is unknown, or the PID is no
  longer ours; the UI must not claim a cancellation then.
- **Distinct cancelled result.** A cancelled run returns `RUN_CANCELLED`, not `CLI_TIMEOUT` and not a
  stdout parse error. The supervisor marks the run finished before deciding its result, so a cancel
  that loses the race returns `false` and the real envelope stands.
- **No job queue.** Runs are concurrent child processes with no scheduler; each run is independent.
  The update download remains the only operation with progress events (`update://progress`) and its
  own `update_cancel`.
- **Cancellation is not rollback.** `taskkill /T /F` (Windows) and `SIGKILL` to the exact PID and
  group (Unix) stop the process, but files it already wrote stay on disk. A cancelled crawl or report
  may leave a partial local artefact; a cancelled restore may have replaced one of the database or
  config files. The engine keeps its pre-restore copy, and the UI tells the user to review a fresh
  plan before retrying.
- `stdout` is capped at 4 MiB and `stderr` at 128 KiB; an oversized response is an error, not a
  truncated success.
- Every engine `stderr` and every bounded preview is redacted (`redact_secrets`) before it reaches the
  webview or the log, not only the configuration-validation path. Redaction runs before truncation: a
  300-character preview could split `token = "…"` so the pattern no longer matches. TOML syntax
  errors are redacted the same way, because the parser quotes the offending line.
- Partial failure (`ok=true` with incomplete meta, or exit `5`) is “completed with warnings”, never
  a clean success.
- A missing token is configuration, not an outage. A no-data report is neutral, not an error.
- Provider failures are isolated and named in `sources_failed`; they do not cancel the whole report.

## 8. Frontend architecture

Feature-Sliced Design, dependencies pointing downward:

```
app/        root store, providers, router, layout, styles
pages/      dashboard, reports, settings, configuration, recommendations, not-found
features/   save-config, secret-set, update, agent-task, backup, schedule, indexing
entities/   config, engine, report, stats, recommendation, update, crawl, logs, workspace
shared/     CLI transport, desktop settings/files, i18n, UI primitives, formatting, run registry
```

There is no `widgets/` layer today. The header, navigation and update badge live in `app/layout` and
`features/update`; a widget layer is added only when a slice is genuinely reused across pages.

- One public API per slice; no imports of another slice's internals.
- The envelope parser and error mapping live in `shared`; screens never parse raw process output.
- UI locale (`en`, `ru`, `zh`) is independent from `report.locale`. Machine codes are never
  translated; unknown codes are shown raw.
- Accessibility is a requirement: WCAG 2.2 AA, visible focus, skip link, focus restoration after
  dialogs, keyboard tables, no color-only meaning, reduced motion and 200% zoom. The skip link moves
  focus to `#main-content` through a handler that calls `preventDefault`; a bare hash href would be
  read by the hash router as a route and render NotFound.
- State is scoped to the current workspace: changing the workspace or losing the engine clears
  report, stats, doctor and secret state instead of showing the previous project's data.
- Long engine calls live in one root `RunStore` (`shared/run`), not on a page. The app layout renders
  a persistent banner with the run kind, elapsed time, status and a Cancel button; leaving the route
  does not clear the run, and returning to the page reads the same store. Only commands in
  `CliCommandId::cancellable` are tracked, so a short read never gets a banner. The banner shows
  every active run and keeps the newest cancelled run until it is dismissed; succeeded and failed
  runs stay on the page that started them, where the result or error is explained.
- Actions that cannot succeed are disabled, not left to fail on click: no workspace selected, engine
  offline, engine below `MIN_ENGINE_VERSION`, or a saved config path that no longer exists.
- Validation is tri-state: `valid`, `invalid` and `skipped`. A call that returns no answer for the
  current draft (one is already running, the workspace switched, or the user kept typing) is
  `skipped` and produces no toast, instead of being reported as invalid.
- Saving keeps a revision counter. A response for an older revision never overwrites a newer draft;
  the draft stays, validation is cleared and the diff shows the unsaved edits.
- A provider block has one explicit enable/disable toggle that writes `providers.<id>.present`.
  Editing a field no longer implies `present = true`, so a disabled block cannot silently return on
  the next save; its fields are hidden while disabled.
- A route-level error boundary contains a render failure: the screen shows a reload action and the
  error message instead of an empty window, and navigating to another route resets the boundary.
- The en/ru/zh catalogues are at parity; a missing key is a test failure, not a silent English
  fallback. Recommendation titles, actions and verification text are localised through an `i18n`
  block on the recommendation, with the provider/source label translated per locale; older queued
  tasks without that block fall back to the stored English text.

## 9. Contracts

- `contracts/config.schema.json` is generated from the pinned engine's `SeoConfig` JSON schema.
- `contracts/cli-v1/*.json` are normalized envelopes recorded from the pinned engine.
- `contracts/stats-v1.md` documents the shipped `stats` contract; `contracts/cli-v1/stats.json` is
  generated from the pinned engine's `stats` command. It is a shipped contract, not a draft.
- `scripts/gen-contracts.py` regenerates; `scripts/check-contracts.mjs` fails on drift.
- The desktop pins the engine version and refuses an engine below its minimum rather than guessing at
  field semantics.

See [`contracts/README.md`](../contracts/README.md).

## 10. Packaging and updates

The release sidecar is a **PyInstaller onedir** tree, not onefile:

- onedir starts quickly, keeps `_internal/` adjacent and is less AV-prone;
- onefile extracts to a temp directory on every call, starts slowly and is unsuitable for macOS
  signing;
- the tree is placed under `src-tauri/engine/lv24-seo/` and mapped into Tauri resources as
  `engine/lv24-seo/`;
- the shell resolves `<resource_dir>/engine/lv24-seo/lv24-seo[.exe]` (with flat and sibling
  fallbacks);
- `scripts/build-sidecar.py` builds it with `uv` and explicit collect flags;
- `scripts/verify-sidecar.mjs` checks the executable version and records the rebuild-aware SHA-256;
  `scripts/cli-checksums.json` holds the reviewed local pin where one exists.

Auto-update is enabled for Windows NSIS, macOS `.app` and Linux AppImage. The updater reads a signed
`latest.json` from GitHub Releases, verifies the package with an embedded minisign key, refuses
downgrades and never installs without user confirmation.

The install path is owned by Rust. The webview holds only `updater:allow-check`, so it can read the
manifest but cannot call `downloadAndInstall`. Pressing **Download and install** calls
`update_install(expectedVersion)`; the shell re-checks the endpoint, rejects a version that differs
from the one the user saw (`UPDATE_VERSION_MISMATCH`), allows one install at a time
(`UPDATE_IN_PROGRESS`), stops tracked sidecars (also inside the command, not only in
`prepare_update`), emits `update://progress` and installs. A cleanup failure blocks the install with
`UPDATE_ENGINE_BUSY`. `update_cancel` stops a download before the installer starts and returns
`UPDATE_CANCELLED`; after installation begins it returns `false` and the UI does not claim a
cancellation. deb, rpm, MSI and the portable ZIP are manual-only. The updater private key is scoped to
the release build step and is never shipped.

The release side also ships a portable `.zip` **and** its `.zip.sha256` sidecar, validated against the
archive in the release gate; `latest.json` is validated against `contracts/latest.schema.json` before
the draft is created.

See [`docs/release.md`](release.md) and [`docs/security.md`](security.md).

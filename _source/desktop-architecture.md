# Architecture

Status: **implementation contract for `0.2.2`.** The Rust command bridge and product screens are
implemented in this repository. Where this document describes a control, it is the requirement that
implementation must satisfy. The pinned engine is `lv24-seo 0.5.2`.

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
│  path allow-list · secret stdin bridge · updater plugin      │
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

Dedicated Tauri commands cover the rest: `shell_status`, `config_read`, `config_validate`,
`config_write`, `config_patch`, `auth_set` (secret over stdin), `auth_delete`, `write_text_file`,
`settings_get`, `settings_set`, `prepare_update` and `open_path`. The webview cannot add a command at
runtime.

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
source and version, and compares the version with `MIN_ENGINE_VERSION` (`0.5.2`). An older engine is
marked `compatible: false`; the UI treats the engine as offline and shows the standard offline
notice. It does not silently downgrade or run the command. A newer engine passes the gate but is not
the release-tested pin.

The `source` labels are `env`, `bundled`, `bundled-flat`, `appimage`, `sibling` and `PATH`. The
portable ZIP uses a sibling or flat resource layout, which is how the updater recognizes that the
build cannot replace itself.

## 6. Configuration write model

Structured Settings forms edit a draft model. The save flow is:

1. build a TOML patch with `toml_edit` so comments and key order survive;
2. write a temporary `0600` file next to the target and fsync it;
3. validate it with `lv24-seo config show --config <temp> --json`;
4. create a timestamped `0600` backup, fsynced, keeping the last five;
5. atomically replace the target and fsync the parent directory;
6. re-read and show the effective redacted config.

Reads are bounded (`8 MiB`) and reject a non-regular or oversized file. Settings load per field, so
one malformed value does not discard the rest. A stale saved config path is tolerated and reported
as missing instead of blocking startup. Windows reserved device names and trailing dots or spaces
are rejected in every path component.

Form saves are field-level patches, so comments, key order and unrelated external edits survive. If
another process changed the file, reload before saving so the form reflects the current file; the
Diff tab shows saved-vs-draft fields. Windows file locks produce a retry message, not a partial write.

Source TOML is shown read-only in the Configuration screen, with secret-looking values redacted.
There is no raw editor. Edits go through the Settings form, which is validated by the engine before a
patch is written. A parse error blocks the form and names the line and column. Environment overrides
are read-only badges: the UI shows the variable name and explains that the environment wins over the
file. Values are never displayed.

## 7. Long-running calls and failure model

Engine calls are synchronous from the UI's perspective. Each command has a fixed timeout: `crawl`
600 seconds; `stats`, `report weekly` and `report diff` 120 seconds; `version`, `config show`,
`doctor`, `properties` and `auth status` 30 seconds; `auth set`/`auth delete` 120 seconds. A timeout
kills the exact child process and returns a typed error.

- There is no job queue, no percentage progress and no user-facing cancel button yet. The UI shows
  an indeterminate busy state and waits for the call to finish.
- `stdout` is capped at 4 MiB and `stderr` at 128 KiB; an oversized response is an error, not a
  truncated success.
- Configuration validation `stderr` is redacted (`redact_secrets`) before it reaches the webview or
  the log, because the engine can quote a config line or an argv in a traceback while validating a
  staged draft.
- Partial failure (`ok=true` with incomplete meta, or exit `5`) is “completed with warnings”, never
  a clean success.
- A missing token is configuration, not an outage. A no-data report is neutral, not an error.
- Provider failures are isolated and named in `sources_failed`; they do not cancel the whole report.

## 8. Frontend architecture

Feature-Sliced Design, dependencies pointing downward:

```
app/        root store, providers, router, layout, styles
pages/      dashboard, reports, settings, configuration, recommendations, not-found
features/   save-config, secret-set, update, agent-task
entities/   config, engine, report, stats, recommendation, update
shared/     CLI transport, desktop settings/files, i18n, UI primitives, formatting
```

There is no `widgets/` layer today. The header, navigation and update badge live in `app/layout` and
`features/update`; a widget layer is added only when a slice is genuinely reused across pages.

- One public API per slice; no imports of another slice's internals.
- The envelope parser and error mapping live in `shared`; screens never parse raw process output.
- UI locale (`en`, `ru`, `zh`) is independent from `report.locale`. Machine codes are never
  translated; unknown codes are shown raw.
- Accessibility is a requirement: WCAG 2.2 AA, visible focus, skip link, focus restoration after
  dialogs, keyboard tables, no color-only meaning, reduced motion and 200% zoom.
- State is scoped to the current workspace: changing the workspace or losing the engine clears
  report, stats, doctor and secret state instead of showing the previous project's data.
- Actions that cannot succeed are disabled, not left to fail on click: no workspace selected, engine
  offline, engine below `MIN_ENGINE_VERSION`.
- The en/ru/zh catalogues are at parity; a missing key is a test failure, not a silent English
  fallback.

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
downgrades and never installs without user confirmation. Immediately before the installer starts,
`prepare_update` stops only the engine sidecar PIDs this app instance registered — the sidecar lives
inside the installed resource directory and a live process would keep it locked — and a cleanup
failure blocks the install with `UPDATE_ENGINE_BUSY`. deb, rpm, MSI and the portable ZIP are
manual-only. The updater private key is scoped to the release build step and is never shipped.

See [`docs/release.md`](release.md) and [`docs/security.md`](security.md).

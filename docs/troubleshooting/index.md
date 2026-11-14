---
title: Troubleshooting
description: Diagnose authentication, storage, crawl, report, MCP, npm launcher and desktop update failures with stable error codes.
---

# Troubleshooting

Start with `error.code`, not the exit code: several failures share an exit status, and `PROPERTY_NOT_FOUND` has no dedicated one. Every CLI command accepts
`--json`:

```json
{"ok": false, "error": {"code": "AUTH_REQUIRED", "message": "Google Search Console token is missing", "retryable": false, "next_action": "lv24-seo auth login --provider gsc"}, "meta": {"version": "0.5.1"}, "warnings": ["gsc: token missing"]}
```

MCP tools return the same envelope as `structuredContent` and set `isError: true` on failure. The desktop maps `ok=false` to a typed UI error.

## First checks

```bash
lv24-seo doctor --json
lv24-seo auth status --json
lv24-seo config show --json
# repeat the failing command with --json added
```

`doctor` checks Python, platform, config path, current-directory writability, the data directory and token presence, with no network calls. Its top-level `ok`
is fatal-only: Python and current-directory writability. Read `checks[]` for the rest.

Common exits: `AUTH_REQUIRED` and `AUTH_INVALID` (3), `PROPERTY_NOT_FOUND` (1), `QUOTA_EXCEEDED` and `UPSTREAM_UNAVAILABLE` (4), `WRITE_DISABLED` (2),
`CONFIRM_REQUIRED` (1), `INVALID_INPUT` and `CONFIG_INVALID` (2), `INTERNAL` (1). `TRUNCATED` is reserved and not emitted: truncation is `meta.truncated` or
`limitations`, and the command exits `0`.

## Missing tokens and provider authentication

`AUTH_REQUIRED` is local: no secret was found for that engine. Single-engine commands fail; aggregated surfaces continue with a warning such as
`gsc: token missing`.

```bash
lv24-seo auth status
lv24-seo auth set --provider gsc
printf '%s' "$TOKEN" | lv24-seo auth set --provider gsc --stdin
```

`auth set` accepts `gsc`, `yandex`, `metrika`, `bing`, `crux`, `psi`, `smtp` and `telegram`. Store the Webmaster token with `auth set --provider yandex` and the
Metrika token with `auth set --provider metrika` or `LV24_SEO_YANDEX_METRIKA_TOKEN`. `auth login --provider gsc|yandex` opens no browser and writes nothing; it
prints manual steps.

A 401 means the token is expired, revoked, malformed or from the wrong account — replace it. A 403 means the credential is valid but lacks permission: fix
property or host access instead of re-authenticating. For Yandex, compare `providers.yandex_webmaster.host_id` with the exact id (`https:example.com:443`, not a
URL); an unverified host looks like a 403.

The current engine has no OAuth refresh flow and no service-account auth. `auth set --provider gsc` stores one string sent as `Authorization: Bearer`; that is a
Google access token, which normally lives about an hour. Store a fresh one per run. `auth status` reports `present` and the source (`env`, `keyring`, `file`)
but never a value. An environment token is read-only: `auth set` and `auth logout` return `WRITE_DISABLED` while it is set.

## `data_dir` and relative paths

`storage.data_dir` defaults to `data`, and the engine resolves it relative to the process's current working directory, not relative to `seo.toml`. Running from
another directory opens a different database, or none. `init` writes `data_dir = "data"` and creates it next to the config file.

The desktop launches the engine with `cwd = config parent`. A terminal run must do the same, or use an absolute path:

```toml
[storage]
data_dir = "/absolute/path/to/project/data"
```

`LV24_SEO_DATA_DIR` overrides the file value. Verify with `doctor --json` and `config show --json`. The desktop must not silently override `LV24_SEO_DATA_DIR`.

## Sitemap `too_large`

Sitemap discovery uses a 50 MB per-document body budget, including the decompressed size of a gzip body. Ordinary pages keep the 5 MB cap. A document over
budget is reported as `too_large`, not as an empty sitemap. The protocol cap is 50,000 URLs per sitemap; an index walk is limited to 20 documents and depth 2.

The budget is a body-size limit, not a time limit: a slow server can still hit the request timeout first. Split a large sitemap into several documents and
reference them from an index. Raising the crawler URL budget does not raise the body budget.

## Crawl memory and URL budget

`crawl.max_urls` defaults to 500. The CLI `--max-urls` accepts a positive integer; MCP `seo_crawl_site` clamps above 5,000 with a warning. The crawl is serial
with robots `Crawl-delay` pacing; `concurrency` is reserved and has no effect.

Memory is bounded: page bodies are capped at 5 MB, retained page text at 20,000 characters, and the request budget is `1 + max_urls * (max_redirects + 1)`.
`word_count` still uses the full visible text. If a crawl is too large or slow, lower `--max-urls` and crawl a section at a time. There is no resume or job
queue in `0.5.1`; the desktop has a 600-second crawl timeout and no cancel button.

## `--days` limits

`stats` and `report weekly` reject `--days` above 3,660 with `INVALID_INPUT` and exit 2. Ten years is beyond any provider's retention. Lower `--days`, or query
a longer history with explicit dates:

```bash
lv24-seo gsc query --start 2026-01-01 --end 2026-06-30 --json
```

GSC search analytics lags 2–3 days, Yandex queries about 4 days, CrUX is a 28-day rolling p75 and PSI is a current lab run. `--lag-days 2` is the report
default.

## Report diff has no snapshots

`report diff` needs two stored weekly snapshots for the same property. The default base is the second newest period and the default head is the newest. Typical
errors:

| Message | Cause |
|---|---|
| `report diff needs stored snapshots, but no store is configured` | No `init`, or a different data directory |
| `need two stored weekly snapshots for <property>; found N` | Fewer than two periods |
| `no stored weekly snapshot for <label> period <period>` | An explicit `--base` or `--head` does not exist |

Run `init` once, then `report weekly` twice for different periods. `report diff` is read-only and makes no provider calls. Metrics present in only one snapshot
are unknown, not zero; `comparable: false` means the periods or GSC windows cannot be compared.

## MCP client install

```bash
lv24-seo install --client claude
lv24-seo install --client opencode
lv24-seo install --client vscode
lv24-seo install --client cursor
lv24-seo install --client vscode --print
```

The command merges the host configuration and prints what it changed.

| Symptom | Fix |
|---|---|
| “not valid JSON” but the file looks valid | UTF-8 BOM, often from PowerShell 5.1; rewrite without BOM or delete and rerun |
| `No such command 'mcp'` | Old build without `mcp serve`; upgrade to 0.5.1 |
| GUI client cannot start the server | Put the absolute `uvx` path in `command`; the app does not inherit the shell `PATH` |
| VS Code lists nothing | `install` writes `mcpServers`; VS Code uses `servers`; rename the key |

OpenCode keeps old tools until `opencode reload` or a session restart; VS Code may need **MCP: Reset Cached Tools** after an upgrade.

The desktop does not retain MCP client entries; `lv24-seo install` is a CLI operation. If a merged host document is displayed, extract only the entry you own,
because the document can contain other servers' tokens.

## npm `.cmd` launcher on Windows

The npm package is a thin launcher. It forwards arguments to an installed `lv24-seo` binary or to `uvx --from lv24-seo==<version> lv24-seo`. On Windows, Node
cannot spawn a `.cmd` shim with `shell: false`; it fails with `EINVAL`.

Version 0.5.1 ignores `lv24-seo.cmd` and `.bat` shims and prefers `lv24-seo.exe` or an extensionless binary before falling back to `uvx`. If the launcher still
picks the wrong binary, set an absolute override:

```bash
LV24_SEO_BIN=/absolute/path/to/lv24-seo npx @lv24/seo version --json
```

On PowerShell, set `$env:LV24_SEO_BIN` before running the launcher. `LV24_SEO_PIN=0` opts back into the unpinned `latest` lookup. The launcher refuses to exec
its own shim, so a PATH shadow cannot recurse.

## Desktop engine is offline or version-gated

The shell resolves the engine in this order: `LV24_SEO_BIN` (absolute only), bundled `engine/lv24-seo/`, flat `lv24-seo/`, sibling `lv24-seo/`, then `PATH` only
when `LV24_SEO_ALLOW_PATH_ENGINE=1`. It runs `lv24-seo version --json` and compares the result with `MIN_ENGINE_VERSION`, which is `0.5.1` in the current
source.

An older engine is marked `compatible: false`; the UI treats it as offline and does not run the command. Nothing is downloaded automatically.

| Symptom | Fix |
|---|---|
| Engine not found | Reinstall, or set `LV24_SEO_BIN` to an absolute executable |
| Engine too old | Install engine 0.5.1 or newer |
| External engine label | Expected when `LV24_SEO_BIN` is set |

A stray `lv24-seo` on `PATH` is ignored unless `LV24_SEO_ALLOW_PATH_ENGINE=1`.

## Portable, deb and rpm cannot auto-update

Auto-update is enabled only for Windows NSIS, macOS `.app` and Linux AppImage. deb, rpm, MSI and the portable ZIP are manual-only: they cannot safely replace
the running installation. The Settings panel disables the in-app installer and links to the release page.

| Bundle | Update path |
|---|---|
| Windows NSIS | In-app signed update |
| Windows portable ZIP | Download and extract a new ZIP |
| Linux AppImage | In-app signed update |
| Linux deb or rpm | Upgrade with the package manager |

The portable build is detected from the `sibling` or `bundled-flat` engine source, so keeping `lv24-seo/` next to the executable also keeps the updater in
manual mode.

## Updater signature failure

A signature failure is a security block, not a transient network error. The updater marks it non-retryable, blocks that artifact and points to the release page.
Do not disable `requireSignedVersion` or retry the same artifact.

Download the release manually, verify it against `SHA256SUMS.txt`, and install it. The updater signature authenticates updates; it does not make the first
manual download trusted. A bad signature can mean a corrupted download, a manifest/package mismatch or a key rotation. Report it rather than bypassing it.

## Linux keyring and DBus

The engine uses the OS keychain only when the `secrets` extra is installed. The desktop sidecar bundles the keyring backends. On Linux, Secret Service needs a
session bus; the desktop CLI runner inherits `DBUS_SESSION_BUS_ADDRESS`, `XDG_RUNTIME_DIR`, the XDG directories and `TMPDIR`, while filtering unrelated host
variables.

| Symptom | Fix |
|---|---|
| Keyring rejected the write | Unlock it, or set `LV24_SEO_ALLOW_FILE_SECRETS=1` for the 0600 file fallback |
| No writable secret backend | Install `lv24-seo[secrets]` or enable the file fallback |
| Headless host, no session bus | Use `LV24_SEO_*` environment tokens |

The fallback file is `data/secrets.json`, mode `0600` on POSIX. Windows uses ACLs. The desktop shows which source is active and that removing a file secret does
not remove an environment variable.

## macOS Gatekeeper and Windows SmartScreen

macOS builds are ad-hoc signed, not notarized. Gatekeeper warns on first launch. Use **System Settings → Privacy & Security → Open Anyway**, or right-click the
app and choose **Open**. Do not disable Gatekeeper globally.

Windows builds have no Authenticode signature. SmartScreen, Smart App Control or antivirus software may warn or block the installer or the portable executable.
Choose **More info → Run anyway** only after verifying the SHA-256 against `SHA256SUMS.txt`. Do not disable those protections system-wide. If you need a signed
build, build from source and sign it with your own certificate.

## Logs and diagnostics

The engine does not install a log handler in `0.5.1`, and `LV24_SEO_LOG_LEVEL` is ignored by the config layer. The stable diagnostic interface is the `--json`
envelope, not a log file.

The desktop has a log directory, a data directory and an export directory. Their exact paths are reported by `shell_status` and shown in the Configuration
screen; do not guess them from the bundle identifier. The diagnostics bundle is user-triggered and contains versions, paths, doctor checks, redacted effective
config, environment variable names and recent non-secret job errors. It is never uploaded automatically.

Before posting an envelope, remove tokens, cookies, `Authorization` headers, `LV24_SEO_WRITE_SECRET`, `.env` contents, `data/secrets.json`, service-account JSON
and customer queries. CLI input validation can echo the value you passed, and a URL query may contain `key=`, `token=` or `signature=`.

```text
lv24-seo version:
OS / Python:
command:
expected:
actual (redacted --json envelope):
```

Report security problems through the private advisory described in `SECURITY.md`, not a public issue.

See [Security and privacy](/security/) for the write gates and [Releases and updates](/release/) for updater behaviour.

Source: `_source/engine-troubleshooting.md`, `_source/engine-releases-0.5.1.md`, `_source/desktop-releases-0.2.1.md`, `_source/desktop-releases-0.2.0.md`, `_source/desktop-security.md`,
`_source/desktop-architecture.md`.

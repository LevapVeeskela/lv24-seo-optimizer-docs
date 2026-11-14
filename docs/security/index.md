---
title: Security and privacy
description: Threat model, secret handling, write gates, SSRF defenses, desktop shell boundary and updater trust for LV24 SEO Optimizer.
---

# Security and privacy

LV24 SEO Optimizer is local-first. The engine (`lv24-seo 0.5.1`) does the provider, crawl, storage and report work. The desktop app
(`0.2.0`) is a UI and process shell around that engine; it does not reimplement provider clients and does not proxy provider traffic.

This page separates the two products and the two kinds of signing:

- the **engine** is read-only by default and gates every provider write;
- the **desktop shell** enforces an argv, path and environment boundary;
- **OS packages** are, by default, unsigned (Windows, Linux) or ad-hoc signed (macOS);
- **updater packages** are minisign-signed, which is a different trust anchor.

## Trust model at a glance

| Component | Trust level | Boundary it enforces |
|---|---|---|
| Engine | Trusted to enforce provider semantics and write gates | Runs as the user; writes only to configured paths |
| Desktop webview | Untrusted input | Fixed Tauri command table, validated arguments |
| Desktop Rust shell | Authorization boundary | Argv arrays, path allow-lists, filtered environment |
| Provider response | Untrusted data | Parsed, bounded, escaped before display |
| Update channel | Authenticated by an embedded key | HTTPS plus a minisign signature |

Local data stays local: queries, URLs, traffic, snapshots and reports live in the configured storage. Network traffic happens only for
requested provider calls, site crawling, opt-in SMTP/Telegram delivery and, in the desktop, the updater's `latest.json` request and the
package the user chooses to download. There is no LV24 telemetry endpoint.

Out of scope: a compromised operating system or keychain, a user who deliberately runs a malicious engine through `LV24_SEO_BIN`, and a
provider-side breach.

## Secrets

The engine resolves each secret in this order:

1. `LV24_SEO_*` environment variables;
2. the optional OS keyring;
3. `data/secrets.json`, only when `LV24_SEO_ALLOW_FILE_SECRETS=1` is set.

Install `lv24-seo[secrets]` for OS keychain support. On POSIX the file fallback is created with mode `0600`; Windows relies on directory and
file ACLs, because POSIX mode bits cannot enforce permissions there.

There are no token command-line flags. `auth set` reads a hidden prompt or stdin:

```bash
lv24-seo auth status --json
printf '%s' "$TOKEN" | lv24-seo auth set --provider gsc --stdin
```

`auth status` reports `present`, the source (`env`, `keyring`, `file`, `missing`) and an expiry when known. It never prints a value. An
environment token is read-only: `auth set` and `auth logout` return `WRITE_DISABLED` while it is set. The desktop shows the same source and
explains that removing a file secret does not remove an environment variable.

Secrets never belong in `seo.toml`, source control, reports or test fixtures. Logging redacts at the formatter level, not at each call site:
sensitive keys, known token prefixes and opaque 32+ character runs are masked. Redaction is defence in depth; callers must still avoid
logging raw credentials. `config show` masks secret-looking keys as `***`, and the desktop must not “unredact” it.

The desktop does not retain secrets in the webview. Token input is a password field, sent once over IPC and immediately piped to
`lv24-seo auth set --provider <p> --stdin`. The Rust layer zeroizes its buffer after the child exits. The value is not written to a log, a MobX store,
localStorage, the clipboard, a crash report or a support bundle. On Linux the CLI runner inherits the session-bus and XDG variables that
Secret Service needs, while unrelated host variables stay filtered; the value itself still travels only over stdin.

## Read-only by default

Provider reads are safe to run without a write flag. Provider mutations pass through `core/write_gate.py`:

1. **Plan** — a dry run renders the target, the action and a full plan hash, then
   returns a short-lived `confirm_token`.
2. **Confirm** — the caller reviews the plan and reruns with `--allow-write` and that
   token.
3. **Claim** — the store claims an idempotency slot as `pending`.
4. **Apply** — the provider call runs; success promotes the claim to `sent`, a provider
   exception releases it.

The token is an HMAC over the action, target, full plan hash and expiry, and lives for 300 seconds. Changing the URLs, host, key, property
or summary invalidates it. Write calls are never retried automatically.

| Action | State in this build |
|---|---|
| IndexNow submit | Wired; requires `--allow-write`, a confirm token and `LV24_SEO_WRITE_SECRET` |
| GSC sitemap submit | `WRITE_DISABLED` — adapter not wired |
| Yandex recrawl | `WRITE_DISABLED` — adapter not wired |
| MCP write tools | `WRITE_DISABLED` even with `allow_write=true`; no confirm-token path yet |

Only the CLI can perform a provider write in this build, and only IndexNow reaches a provider. The MCP write tools (`seo_recrawl_request`,
`seo_sitemap_submit`) carry `destructiveHint: true` but still return `WRITE_DISABLED`.

Local-state tools are different. `seo_crawl_site` and `seo_weekly_report` persist crawl and weekly snapshots, so they are marked
`writes_local_state: true` and `readOnlyHint: false`. They never mutate provider state and need no confirm token.

## MCP annotations

Annotations describe intent; they are not an authorization mechanism. The registry derives them from the tool contract:

| Tool | Kind | `writes_local_state` | `readOnlyHint` | `destructiveHint` |
|---|---|---|---|---|
| `seo_crawl_site` | read | `true` | `false` | `false` |
| `seo_weekly_report` | read | `true` | `false` | `false` |
| `seo_recrawl_request` | write | `false` | `false` | `true` |
| `seo_sitemap_submit` | write | `false` | `false` | `true` |
| Other seven tools | read | `false` | `true` | `false` |

A client that branches on `readOnlyHint` may ask for confirmation before a crawl or a weekly report. That is intentional: both write local
state. A client must not treat a read annotation as permission to skip its own confirmation for a gated write.

## Network and SSRF defenses

The default crawler resolves every requested URL — the seed and each redirect hop — and refuses private, loopback, link-local, multicast,
reserved and unspecified addresses, including the cloud metadata address `169.254.169.254`. A refusal is a typed `blocked_private` result,
not an exception. Local-site audits can opt in to private destinations only from an embedding that sets `allow_private`; there is no CLI
flag for it.

The default transport connects to the validated IP while preserving the original HTTP `Host` and TLS SNI, so connection setup cannot
re-resolve the hostname to a different address. Custom injected transports are trusted test/embedding boundaries and must enforce their own
policy. Redirects are followed manually, so every hop is validated, and an HTTPS-to-HTTP downgrade is recorded as a coverage note.

Crawl orchestration checks robots and origin scope before following a destination. Robots network and 5xx errors defer crawling; robots is a
politeness signal, not access control. Provider HTTP errors contain only host and path: query strings can carry keys and headers can carry
bearer tokens, so neither reaches an error message.

SMTP STARTTLS validates certificates before login. Telegram sends plain text and treats HTTP/Bot API errors as failures. Delivery is
at-least-once, not exactly-once: a crash after remote acceptance but before the ledger write can duplicate a message on retry. HTTP rate
limiting is process-local and cannot guarantee account-wide daily quotas across separate CLI or MCP processes.

## Data handling and injection

SQLite is local and git-ignored. Schema changes ship as numbered migrations recorded in `schema_migrations`; an upgrade does not delete user
rows. Back up the database before upgrading. Legacy rows of unknown temporal granularity are retained and labelled, not silently converted.

Repository SQL uses bound parameters, never string interpolation. Multi-dimension metric keys are JSON-encoded, so values containing `|`
cannot collide. Report HTML escapes every dynamic value and uses no external images, stylesheets, scripts or tracking pixels. The desktop
does not embed report HTML in its webview: `open_path` validates an absolute path, requires it under an approved root and enforces an
extension allow-list before handing the file to the OS handler.

## Desktop shell boundary

The webview can invoke only a fixed command table with validated arguments. It cannot pass an executable, a shell string, a raw environment
map or a path outside the approved roots. All engine calls use an argv array, an absolute canonical `--config`, `--json`, a bounded timeout
and `cwd = config parent`. A timeout kills the exact child handle or PID; there is no wildcard process cleanup, because several LV24
applications can run at once.

The child environment is filtered. Inherited names include the platform basics (`PATH`, `SYSTEMROOT`, `HOME`, `APPDATA`, proxy and CA
variables), the Linux Secret Service variables (`DBUS_SESSION_BUS_ADDRESS`, `XDG_RUNTIME_DIR`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME`,
`XDG_CACHE_HOME`, `TMPDIR`) and every `LV24_SEO_*` name. Unrelated host variables are dropped.

Configuration writes are atomic: build a `toml_edit` patch, write a temporary file next to the target, validate it with
`lv24-seo config show`, create a timestamped backup (keeping the last five), rename, then re-read the redacted effective config. A failed validation leaves
the original contents and mtime unchanged. There is no raw editor; edits go through validated Settings forms and field-level patches.

The production webview CSP has no remote scripts, styles, fonts, images or connect targets; it allows self-hosted assets, inline styles, app-asset/data images and IPC. `withGlobalTauri` is false, and the UI uses typed API imports. There is no local HTTP API in `0.2.0`; a future one would need its own authentication and loopback binding.

## Updater trust

Updater payloads use a free Ed25519/minisign key, separate from OS code signing. The updater endpoint is an HTTPS GitHub Releases URL configured in `src-tauri/tauri.conf.json`; the public key is embedded there too.
The private key is a repository secret passed only to the build step. `requireSignedVersion` is enabled, so the announced version is bound
to the signed package. HTTPS protects transport; the signature is the trust anchor.

The updater accepts only a version greater than the running one, so it cannot downgrade. It never downloads or installs on its own: the user
presses **Download and install**, and an unsaved configuration draft disables the button. A signature failure blocks that artifact, marks
the error as non-retryable and points to the release page; it is never downgraded to an offline warning or retried automatically.

Auto-update works only for Windows NSIS, macOS `.app` and Linux AppImage. deb, rpm, MSI and the portable ZIP are manual-only: the UI
disables the in-app installer and links to the release page. `0.1.0` has no updater, endpoint or public key, so its users install `0.2.0`
manually once.

OS package signing is separate. By default, Windows builds have no Authenticode signature, macOS builds are ad-hoc signed only, and Linux packages are
unsigned. The updater signature does not make an OS package trusted to SmartScreen, Gatekeeper or a distribution policy.

## Supply chain

Dependencies are pinned by `package-lock.json`, `Cargo.lock` and the engine/PyInstaller pin in `scripts/cli-checksums.json`. Engine CI actions are
SHA-pinned; desktop workflow actions are version-tagged. Downloaded release tools have checksums, and secret scanning runs in review. Release artifacts are checksummed before
publication; `SHA256SUMS.txt` covers every published asset, including updater signatures and `latest.json`.

The sidecar is a PyInstaller **onedir** tree, not onefile. `scripts/verify-sidecar.mjs` checks the executable and the exact engine version.
The checksum policy is rebuild-aware: a reviewed local build has a strict SHA-256 pin, while CI records the actual hash of its
non-reproducible rebuild in `sidecar-checksums-<target>.json`. Those reports are CI evidence, not release assets. A `null` pin means “not
reviewed yet”, not “verified”.

The release workflow is manual and owner-gated, with no push, pull-request or tag triggers. It uses standard GitHub-hosted runners and free
minutes only. The project does not buy code-signing certificates, notarization or paid runners.

## Reporting a vulnerability

Use a private GitHub security advisory on the affected repository. Do not open a public issue with credentials, customer queries or exploit
details. The canonical contact and the supported-version policy live in `SECURITY.md` in each repository.

Include the product (engine or desktop), the exact version, the operating system, the install method and a minimal reproduction. Remove
tokens, cookies, `Authorization` headers, `LV24_SEO_WRITE_SECRET`, `.env` contents, `data/secrets.json` and service-account JSON before
sending. A secret that was exposed should be rotated, not merely deleted from the latest commit.

See [Architecture](/architecture/) for the trust boundaries and [Releases and updates](/release/) for the signed updater matrix.

Source: `_source/engine-security.md`, `_source/desktop-security.md`, `_source/engine-architecture.md`, `_source/desktop-architecture.md`.

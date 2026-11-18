---
title: Releases and updates
description: Engine 0.14.0 and desktop 0.9.3 releases, OAuth readiness diagnostics and the Connect-card readiness states, the indexing card, the 0.13.0 OAuth connectors, 0.12.0 indexing automation, older history, signed auto-update matrix, release pipeline, version pinning and rollback.
---

# Releases and updates

The current releases are:

| Product | Version | Released | Notes |
|---|---|---|---|
| Engine | `lv24-seo 0.15.2` | 2026-11-18 | Adds `access` per provider to `auth status` (`service_account`, `token`, `oauth`, `none`), separate from the optional OAuth object; 25 CLI commands, 12 MCP tools and schema v5 |
| Desktop | `0.9.8` | 2026-11-18 | Connected badge uses the engine data-access summary; saved tokens and the GSC service account show Connected, OAuth stays optional; engine 0.15.2 and `MIN_ENGINE_VERSION` 0.15.2 |

The desktop version and the engine version are independent, but the desktop pins an exact engine and refuses one below its minimum. `0.9.8` bundles `0.15.2` and requires at least `0.15.2`, so an installed `0.15.1` engine is reported as incompatible. `0.9.7` is the previous release; `0.9.8` completes the Connected badge fix using the engine data-access summary. OAuth tokens are stored by the engine in the OS keychain; the desktop never receives or renders one. The Indexing automation card is read-only: it renders `indexing status`, `indexing history` and `schedule status` and has no write, confirm or `--allow-write` control.

## Engine 0.15.2

Released on 2026-11-18. A patch release: `auth status` now says how each provider is actually
authenticated for data access, so a saved token or service account is not mistaken for "not
connected" just because no OAuth app is configured. The CLI stays at 25 top-level commands, MCP at
12 tools and SQLite at schema v5.

### Data-access status per provider

What changed:

- **`access` in `auth status --json`.** Each provider (`gsc`, `yandex`, `metrika`, `bing`, `crux`, `psi`) gets an `access` object with `mode` and `ready`.
- **Modes.** `service_account` when the GSC `service_account_file` is configured; `token` for a stored static Webmaster/Metrika/Bing/CrUX/PSI token or API key; `oauth` for a stored OAuth refresh token; `none` when no data-access credential is configured.
- **Separate from OAuth.** `access` describes data access, while `oauth` describes whether the optional OAuth app can be used. The existing `providers`, `present`, `missing` and `oauth` fields are unchanged.
- **Value-free.** `auth status` reports modes and presence, never a secret. No provider call is made.

Verification recorded for this release:

| Check | Result |
|---|---|
| PyPI / npm / MCP Registry | `lv24-seo 0.15.2` published; GitHub Release is Latest |
| Release workflow | run `44403810604` |
| Local gate | `ruff check`, `ruff format --check`, `mypy src`, MCP registry `--check` and full offline `pytest -q` green on the release commit |
| Tests | every mode, the GSC service-account precedence, the shared Yandex refresh token for Metrika and the blank service-account path |

Known limits in 0.15.2:

- `access` reports configuration/presence, not a live provider call; an expired or revoked token is still discovered on the next read.
- A syntactically valid but unregistered OAuth client id cannot be detected locally.

## Engine 0.15.1

Released on 2026-11-18. A patch release: a client id copied from the documentation is rejected before
a consent URL is built, instead of opening a provider page that answers HTTP 400. The CLI stays at
25 top-level commands, MCP at 12 tools and SQLite at schema v5.

### Placeholder OAuth client ids

What changed:

- **Documented examples are rejected.** The placeholder list includes `0123456789abcdef0123456789abcdef` (Yandex), `1234567890-abc.apps.googleusercontent.com` (Google) and `your-google-client-id` / `your-yandex-client-id`. They return `CONFIG_INVALID` with the registration link and the exact config key before a consent URL is built.
- **Guard in the connector.** `yandex_oauth.authorization_url()` checks the value itself, not only the CLI wrapper, so every caller is protected. Real client ids are unaffected.
- **Readiness agrees.** `auth status` and `doctor` already report a placeholder as `oauth_client_missing`.
- **Desktop guard.** Desktop `0.9.5` disables **Connect** while readiness is `oauth_client_missing`, `oauth_client_secret_missing` or `oauth_redirect_invalid`, and ignores a second **Open** click while the first is in flight, so a misconfigured setup cannot spawn repeated consent tabs.
- **Not changed.** No new dependency, no provider call, no write-gate change. The OAuth token/refresh flows and real client ids are unchanged.

Verification recorded for this release:

| Check | Result |
|---|---|
| PyPI / npm / MCP Registry | `lv24-seo 0.15.1` published; GitHub Release is Latest |
| Release workflow | run `44385097574` |
| Local gate | `ruff check`, `ruff format --check`, `mypy src`, MCP registry `--check` and full offline `pytest -q` green on the release commit |
| Tests | documented placeholders, the `authorization_url()` guard and the unchanged real client-id path; full offline suite green |

Known limits in 0.15.1:

- A syntactically valid but unregistered 32-hex Yandex client id cannot be detected locally; the provider still answers 400. Register the app and use the ClientID it shows.
- `oauth_client_secret_missing` still requires `auth set --provider yandex_oauth_secret --stdin` (or the Google equivalent) before Connect can work.

## Engine 0.15.0

Released on 2026-11-18. The crawler gains four rule packs that close audit gaps from the
`siteaudit-mcp` review. No new dependency, no provider call and no write-gate change.

### Four crawl rule packs

- **`security-headers` (medium).** Status-200 HTML pages are checked for HSTS (`max-age` at least 180 days on HTTPS), CSP (missing or `unsafe-inline`/`unsafe-eval`), X-Frame-Options (unless CSP has `frame-ancestors`), X-Content-Type-Options (`nosniff`), Referrer-Policy (not `unsafe-url`), Permissions-Policy, and cookie flags from every `Set-Cookie`: `Secure` on HTTPS, `HttpOnly`, and `SameSite=None` without `Secure`. Cookie values never appear in a finding.
- **`tls-certificate` (high).** The fetcher records protocol, cipher, certificate expiry, issuer, subject and SAN in `PageData.tls`. The rule reports an unreadable certificate as `unknown`, expiry (expired, within 14 days, within 30 days), TLS 1.0/1.1, a SAN/CN hostname mismatch (single-label wildcard supported) and RC4/3DES/NULL/EXPORT ciphers. Expiry uses the page `fetched_at`, so results are deterministic.
- **`schema-required` (medium).** Required properties for Product, Offer, BreadcrumbList, FAQPage (including nested Question name/acceptedAnswer), Recipe, JobPosting, VideoObject, LocalBusiness, Course and SoftwareApplication. `@graph` containers and `@type` lists are flattened; blank values count as missing; findings are capped per page. It does not overlap `jsonld-required`, `jsonld-event` or `jsonld-organization`.
- **`a11y-basics` (medium).** Inputs without a label, `aria-label`, `aria-labelledby` or `title`; buttons without visible text or an accessible name; links with no text, accessible name or image alt; a missing `<main>` or skip link; heading-level jumps greater than one.

`FetchResult`/`PageData` now carry `tls`, `set_cookie` (every value) and `fetched_at`; `PageData` also carries `link_details`, `inputs`, `buttons`, `headings`, `has_main` and `has_skip_link`. The rule set grows from 30 to **34** and discovery stays automatic.

Verification recorded for this release:

| Check | Result |
|---|---|
| PyPI / npm / MCP Registry | `lv24-seo 0.15.0` published |
| Release workflow | run `44383306623` |
| Local gate | `ruff check`, `ruff format --check`, `mypy src`, MCP registry `--check` and full offline `pytest -q` green on the release commit |
| Tests | focused positive/negative/boundary, malformed input, JSON-safe details and discovery tests per rule; TLS and Set-Cookie fetcher tests |

Known limits in 0.15.0:

- `security-headers` checks presence and a few weak values, not full CSP policy quality.
- `tls-certificate` needs fetcher-captured TLS facts; a page without them is `unknown`, not a silent pass.
- `schema-required` checks the listed types only; nested `Product.offers` nodes are not separate items.
- `a11y-basics` is a heuristic subset, not a WCAG conformance audit; duplicate hrefs keep the first anchor's accessible-name data.

## Engine 0.14.1

Released on 2026-11-18. A patch release: Windows Task Scheduler jobs no longer open a console window
in the signed-in session. The CLI stays at 25 top-level commands, MCP at 12 tools and SQLite at
schema v5.

### Hidden Windows scheduled jobs

What changed:

- **Generated WScript launcher.** `schedule install --target windows` now writes `<name>.xml` plus `<name>.vbs` in `~/.config/lv24-seo/schedule/` and registers `C:\Windows\System32\wscript.exe //B //Nologo "<name>.vbs"`. The launcher is UTF-16 with a BOM so Windows Script Host reads non-ASCII paths.
- **Hidden run and exit code.** The launcher runs the real command with `WScript.Shell.Run(command, 0, True)`: no window is created, the engine still gets the task working directory, and the process is awaited. `WScript.Quit code` forwards the engine exit code to Task Scheduler.
- **Three status artefacts.** `schedule status --target windows` lists the registered `task`, the `xml` and the `vbs` launcher. A missing or changed launcher makes the job `outdated` (or `partial` when the task is not registered); `schedule uninstall` removes the launcher together with the XML and the task. Cron and systemd are unchanged.
- **One-time reinstall.** A task installed by engine `0.14.0` or older keeps the console action until it is reinstalled once: `lv24-seo schedule install --kind indexing --target windows --allow-write`. `schedule status` reports the old task as `outdated` until then.
- **Not changed.** No new required dependency, no provider call, no change to the write gate or write secret. MCP, schema and the CLI count are unchanged.

Verification recorded for this release:

| Check | Result |
|---|---|
| PyPI / npm / MCP Registry | `lv24-seo 0.14.1` published |
| GitHub Release | `v0.14.1`; release workflow run `44330203996` |
| Local gate | `ruff check`, `ruff format --check`, `mypy src`, MCP registry `--check` and full offline `pytest -q` green on the release commit |
| Scheduler tests | generated launcher (hidden `Run`, awaited exit code, quoted paths), XML action, three status artefacts, install/uninstall of both files, changed-command and changed-cadence cases |
| Windows host | the task was reinstalled and run on Windows 11 without a console window |

Known limits in 0.14.1:

- The launcher relies on Windows Script Host (`wscript.exe`), present on supported Windows versions. It is a generated file; reinstall the schedule instead of editing it.
- A task installed by an older engine is reported as `outdated` and must be reinstalled once.
- Task Scheduler's own "Last Run Result" now reflects the engine exit code; provider-level failures are still recorded in `indexing history`, not in the task result.

## Engine 0.14.0

Released on 2026-11-18. It makes OAuth failures self-diagnosable: `auth status` and `doctor` can
say exactly which prerequisite is missing instead of returning a generic error. The CLI stays at
25 top-level commands (18 groups + 7 commands), MCP at 12 tools and SQLite at schema v5.

### OAuth readiness diagnostics

What changed:

- **`auth status --json`.** Adds an `oauth` object for `gsc`, `yandex` and `metrika`. Each entry carries `state`, `detail`, `client_id_present`, `client_secret_present`, `access_token_present`, `refresh_token_present`, `expires_at`, `scopes_recorded`, `next_action` and `limitations`. The existing `providers`/`present`/`missing` fields are unchanged.
- **`doctor --json`.** Adds `gsc_oauth`, `yandex_oauth` and `metrika_oauth` checks with `id`, `ok`, `detail`, `code` and `next_action`. A missing app is a warning with the registration link, never a crash. The checks are non-fatal: `healthy` and the exit code still depend only on the existing fatal checks. A provider that is not configured is labelled optional.
- **Stable states.** The checks are offline: they read the config and the secret store, never the provider.
- **Precedence.** Redirect, then client id, then client secret, then token, then scope. The first actionable fix is the one shown.
- **Recorded scopes.** `gsc_token_scopes`, `yandex_token_scopes` and `yandex_metrika_token_scopes` store the granted scopes space-separated and live in `OAUTH_SECRET_NAMES`; the public `SECRET_NAMES` tuple stays stable. Login and refresh record the provider's list (or the requested list when the response omits it); `auth logout` deletes it.
- **Not changed.** No new required dependency, no provider call in the readiness checks, no change to the existing token/secret names or the login/logout behavior.

The eight stable codes:

| Code | Meaning | Fix |
|---|---|---|
| `oauth_client_missing` | `[auth.<provider>].client_id` is empty or a documented placeholder | Register an app and set the client id (Google Desktop app, or Yandex OAuth app) |
| `oauth_client_secret_missing` | Client id is set but the client secret is absent | `auth set --provider gsc_oauth_secret\|yandex_oauth_secret --stdin` |
| `oauth_token_missing` | Client id and secret are present, but no access or refresh token exists | `auth login --provider gsc\|yandex\|metrika` |
| `oauth_token_expired` | The stored expiry is in the past; says whether a refresh is available | Run any read command, or log in again when no refresh token exists |
| `oauth_scope_missing` | Recorded token scopes do not include the configured scopes | Log in again and grant the scope, or remove it from `[auth.*].scopes` |
| `oauth_scope_unknown` | No scope was recorded (a grant stored before scope recording); a warning, never a false pass | Run a login or refresh once to record the scopes |
| `oauth_redirect_invalid` | Google redirect is not loopback, or Yandex is not `verification_code` | Clear `[auth.*].redirect_uri` or set a valid value |
| `oauth_ready` | Client id, secret, token, scopes and redirect all check out | Nothing to do |

Verification recorded for this release:

| Check | Result |
|---|---|
| PyPI / npm / MCP Registry | `lv24-seo 0.14.0` published |
| GitHub Release | `v0.14.0`; release workflow run `44203408208` |
| Local gate | `ruff check`, `ruff format --check`, `mypy src`, MCP registry `--check` and full offline `pytest -q` green on the release commit |
| Tests | `tests/unit/test_oauth_status.py` covers all states for the three providers, scope round-trip/delete, the redirect matrix, `auth status` backward compatibility, `doctor` codes and the no-token-in-output/repr/log rule |
| Provider calls | none: the readiness checks are offline |

Known limits in 0.14.0:

- Redirect configuration is checked before the token state, so a wrong redirect must be fixed before the login advice is shown.
- `oauth_scope_unknown` is a warning: a token created before scope recording cannot prove its permissions.
- A provider that is not configured still appears as an `ok:false` OAuth check in `doctor`, with an "optional" note; it does not change `healthy` or the exit code.
- Live OAuth consent remains untested until a real Google Desktop client and Yandex OAuth app are registered.

## Engine 0.13.1

Released on 2026-11-18. Two releases on the same day add OAuth connectors for Google Search Console,
Yandex Webmaster and Yandex Metrika, then add the URL-only Yandex mode the desktop Connect card
needs. The CLI stays at 25 top-level commands (18 groups + 7 commands), MCP at 12 tools and SQLite
at schema v5.

### 0.13.0 - OAuth connectors for Google and Yandex

What changed:

- **Google Search Console.** `auth login --provider gsc [--no-browser] [--port N] [--code CODE] [--json]` uses a Google Cloud **Desktop app** client, a loopback callback on `127.0.0.1:<port>/callback`, S256 PKCE and a random `state`; `access_type=offline` plus `prompt=consent` obtain a refresh token. Access token, refresh token and expiry live in the OS keychain; the client secret is set once with `auth set --provider gsc_oauth_secret --stdin`. `OAuthTokenProvider` refreshes within 60 seconds of expiry under a lock and reads the store on every call, so a running MCP process sees a CLI login. `--no-browser` prints the URL to stderr so stdout stays one JSON document, and `--code` reuses the stored PKCE verifier with `--port` or `[auth.gsc].redirect_uri` to repeat the redirect exactly. Credential precedence is OAuth grant, then service-account file, then the static `gsc_token`; `doctor` recognises an OAuth grant.
- **Yandex Webmaster and Metrika.** `auth login --provider yandex|metrika [--no-browser] [--code CODE] [--json]` uses one Yandex OAuth app that can carry `webmaster:hostinfo` and `metrika:read`, with separate token slots so either engine can be revoked independently. API-access apps use the `https://oauth.yandex.ru/verification_code` redirect: the user approves access, Yandex shows a short code, and the CLI exchanges it, which works on a desktop, over SSH and on a VPS without a loopback server. The exchange is form-encoded, refresh uses `grant_type=refresh_token`, and a failed refresh maps to `AUTH_INVALID` with the exact `auth login` next action. `auth logout --provider yandex|metrika` removes the matching OAuth tokens.
- **Configuration and secrets.** `[auth.gsc]` and `[auth.yandex]` carry `client_id`, `scopes` and `redirect_uri`; `LV24_SEO_GSC_CLIENT_ID`, `LV24_SEO_GSC_REDIRECT_URI`, `LV24_SEO_YANDEX_CLIENT_ID` and `LV24_SEO_YANDEX_REDIRECT_URI` override them. Client secrets are never part of the config: `OAUTH_SECRET_NAMES` keeps the public `SECRET_NAMES` tuple stable while `auth set --provider gsc_oauth_secret|yandex_oauth_secret --stdin` stores the companion secret. `auth login` text output says `OAuth login for ...` and shows scopes/expiry; JSON carries no tokens.
- **Not changed.** No new required dependency (the existing `httpx` client and the OS keychain are used), no CLI count, MCP, schema or config-version change. Bing Webmaster, IndexNow, CrUX and PSI stay key-based because those providers have no OAuth flow; existing service-account, static-token and API-key paths keep working.

Verification recorded for this release:

| Check | Result |
|---|---|
| PyPI / npm / MCP Registry | `lv24-seo 0.13.0` published |
| Release workflow | run `44194701424` green |
| Local gate | `ruff check`, `ruff format --check`, `mypy src`, MCP registry `--check` and full offline `pytest -q` green on the release commit |
| OAuth suites | 34 Google OAuth tests and 32 Yandex OAuth tests: PKCE/state/URL, a real `127.0.0.1` loopback callback, code exchange and refresh against `httpx.MockTransport`, expiry margins, store/delete, service precedence, CLI `--code`/`--no-browser`, missing secrets, error mapping and token-free envelopes/reprs |
| Live consent | not exercised: no Google Cloud Desktop client or Yandex OAuth app was registered at release time |

Known limits in 0.13.0:

- Google OAuth apps in **Testing** issue refresh tokens that expire after 7 days; unattended GSC automation should keep the service account. A public app needs Google verification for the sensitive `webmasters.readonly` scope.
- The Yandex `verification_code` flow cannot verify `state` across separate `--no-browser` and `--code` commands; the code is short-lived (10 minutes) and the client secret is still required. A single interactive command is the recommended path.
- A long-running MCP process caches its provider client; a token that expires mid-process is refreshed on the next client build.
- Bing, IndexNow, CrUX and PSI have no OAuth connector by design.
- Live consent was not exercised at release time; registration steps are in the Google and Yandex auth guides.

### 0.13.1 - Yandex connector URL-only mode

What changed:

- `auth login --provider yandex|metrika --url-only --json` returns `{provider, flow, authorization_url, scopes, target}` and does not open a browser, print to stderr, exchange a code or write a token. The desktop shows the URL, the user approves access, and a second call with `--code <code>` completes the grant.
- `--url-only` is Yandex-only; `--provider gsc` keeps the loopback flow. The interactive flow and `--code` are unchanged.
- A placeholder client id (for example `your-client-id`) is rejected with the setup action instead of starting a doomed authorization.

Verification recorded for this release:

| Check | Result |
|---|---|
| PyPI / npm / MCP Registry | `lv24-seo 0.13.1` published |
| Release workflow | run `44195481192` green |
| Unit test | `login_yandex(..., url_only=True)` returns the authorization URL and stores no token |
| Local gate | `ruff check`, `ruff format --check`, `mypy src`, MCP registry `--check` and full `pytest -q` green |
| Live consent | still pending a registered Yandex OAuth app/client ID |

Known limits in 0.13.1:

- `--url-only` does not verify `state` across the separate URL and code steps; the verification code is short-lived and the client secret is still required.
- Live consent remains unverified until a real Google Cloud Desktop client and Yandex OAuth app are configured.
- No API, CLI count, MCP, schema or config change from 0.13.0.

## Desktop 0.9.8

Released on 2026-11-18. It completes the Connected badge fix and bundles the same `lv24-seo 0.15.2`
build, `MIN_ENGINE_VERSION` `0.15.2` and contracts as `0.9.7`. `0.9.7` is the previous release.

What changed:

- **Connected uses data access.** `0.9.7` bundled engine `0.15.2` but its frontend still derived Connected/Not connected from the OAuth refresh-token entry. `0.9.8` reads the `access` summary from `auth status --json`, so saved Yandex/Metrika tokens, the GSC service account and Bing/CrUX/PSI keys show **Connected**.
- **OAuth stays separate.** The OAuth badge says **"OAuth not configured (optional)"** when the provider already works without an OAuth app; Connect stays disabled until a real OAuth client is configured.
- **Fallback.** An older engine without `access` keeps the previous OAuth-based fallback.
- **No engine change.** The sidecar is the same `lv24-seo 0.15.2` build as `0.9.7`; the four crawl rule packs, Indexing automation card, hidden Windows scheduled-job launcher and two-phase write gates are unchanged.

Verification recorded for this release:

| Check | Result |
|---|---|
| GitHub Release | [`v0.9.8`](https://github.com/LevapVeeskela/lv24-seo-optimizer-desktop/releases/tag/v0.9.8); 18 assets |
| Release workflow | run `44412281938` green |
| Local gate | `npm run typecheck`, `npm test`, `npm run build`, `npm run contract:check`, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` and `cargo test` green on the release commit |
| Tests | 808 Vitest tests and the full Rust suite passed |
| Contracts and pin | engine `0.15.2`; Windows x64 SHA-256 `e72d38efc11fb6613a0fa557ade373f6eb5b59059fe49455095924b448d47a18`, 14,608,556 bytes |

Known limits in 0.9.8:

- `access` reports configuration/presence, not a live provider call; an expired or revoked token is still discovered on the next read.
- A syntactically valid but unregistered OAuth client id cannot be detected locally.
- OAuth remains optional and still requires a real registered app for automatic token refresh.

## Desktop 0.9.7

Released on 2026-11-18. It bundles `lv24-seo 0.15.2` and raises `MIN_ENGINE_VERSION` to `0.15.2`.
The engine adds the `access` data-access summary and the Connected badge is intended to use it, but
the frontend patch was missing: saved Yandex/Metrika tokens and the GSC service account still showed
as "Not connected". `0.9.8` completes that fix. `0.9.6` is the previous release.

Verification recorded for this release: 18 assets, contracts at engine `0.15.2`, and the Windows
sidecar verified against the pinned SHA-256. `0.9.8` is the recommended update for the badge fix.

Known limits in 0.9.7:

- The Connected badge still derives from OAuth only; use `0.9.8` for data-access-aware status.
- OAuth remains optional and requires a real registered app.

## Desktop 0.9.6

Released on 2026-11-18. It keeps the bundled `lv24-seo 0.15.1`, `MIN_ENGINE_VERSION` `0.15.1`, the
contracts and the four crawl rule packs unchanged. `0.9.5` is the previous release.

What changed:

- **OAuth is labelled optional when a token already works.** If a provider has a saved token or service account and only the optional OAuth app is missing, the Connect card shows **"OAuth not configured (optional)"** instead of a "Not ready" badge, with a hint that the saved token/service account is already used and OAuth is only needed for automatic token refresh.
- **Connect stays disabled.** The button remains disabled until a real OAuth client is configured, so the documented example client ids cannot open a consent tab.
- **No engine change.** The sidecar is the same `lv24-seo 0.15.1` build as `0.9.5`; the four crawl rule packs, Indexing automation card, hidden Windows scheduled-job launcher and two-phase write gates are unchanged.

Verification recorded for this release:

| Check | Result |
|---|---|
| GitHub Release | [`v0.9.6`](https://github.com/LevapVeeskela/lv24-seo-optimizer-desktop/releases/tag/v0.9.6); 18 assets |
| Release workflow | run `44397172779` green |
| Local gate | `npm run typecheck`, `npm test`, `npm run build`, `npm run contract:check`, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` and `cargo test` green on the release commit |
| Tests | 806 Vitest tests and the full Rust suite passed |
| Contracts | engine `0.15.1` |

Known limits in 0.9.6:

- OAuth remains optional; a real Google Desktop client or Yandex OAuth app is still required for automatic token refresh instead of a stored token or service account.
- A syntactically valid but unregistered OAuth client id cannot be detected locally; the provider still answers 400.

## Desktop 0.9.5

Released on 2026-11-18. It bundles `lv24-seo 0.15.1` and raises `MIN_ENGINE_VERSION` to `0.15.1`, so
an installed `0.15.0` engine is reported as incompatible. `0.9.4` is the previous release.

What changed:

- **Four crawl rule packs.** The bundled engine adds `security-headers`, `tls-certificate`, `schema-required` and `a11y-basics`; the rule set grows from 30 to 34. The report and Diagnostics screens render the new issue IDs without a UI change.
- **Placeholder client ids.** Documented examples such as `0123456789abcdef0123456789abcdef`, `1234567890-abc.apps.googleusercontent.com` and `your-*-client-id` return `CONFIG_INVALID` before a consent URL is built.
- **Connect guard.** The Connect card disables **Connect** while readiness is `oauth_client_missing`, `oauth_client_secret_missing` or `oauth_redirect_invalid`, and ignores a second **Open** click while the first is in flight, so a misconfigured setup cannot spawn repeated consent tabs.
- **Engine and contracts.** The sidecar is `lv24-seo 0.15.1`; contracts are regenerated from `0.15.1`. The Windows x64 reviewed pin is `cd70636a…1922` (14,607,761 bytes); Linux and macOS pins remain `null` and are covered by rebuild-aware reports.
- **Not changed.** The read-only Indexing automation card, the Connect readiness states, the hidden Windows scheduled-job launcher, the two-phase write gates, MCP at 12 tools and SQLite schema v5.

Verification recorded for this release:

| Check | Result |
|---|---|
| GitHub Release | [`v0.9.5`](https://github.com/LevapVeeskela/lv24-seo-optimizer-desktop/releases/tag/v0.9.5); 18 assets |
| Release workflow | run `44388939536` green |
| Local gate | `npm run typecheck`, `npm test`, `npm run build`, `npm run contract:check`, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` and `cargo test` green on the release commit |
| Tests | full Vitest and Rust suites passed |
| Contracts and pin | engine `0.15.1`; Windows x64 SHA-256 `cd70636a4f490c3ab592fb3b16ac2456d9cf9e57f08c676e05b84110ff361922`, 14,607,761 bytes |

Known limits in 0.9.5:

- The new rules are heuristics, not a full security or WCAG conformance audit; see the engine notes for the exact bounds.
- Existing scheduled tasks from `0.9.3` or older still need one reinstall to pick up the hidden launcher.
- An engine older than `0.15.1` is reported as incompatible.

## Desktop 0.9.4

Released on 2026-11-18. It bundles `lv24-seo 0.14.1` and raises `MIN_ENGINE_VERSION` to `0.14.1`, so
an installed `0.14.0` engine is reported as incompatible. The Indexing automation and Connect cards
are unchanged; the 04:00 indexing job no longer opens a console window.

What changed:

- **Hidden Windows scheduled jobs.** A task installed from the desktop (`schedule install --kind indexing --target windows --allow-write`) now registers a generated `<name>.vbs` launcher through `wscript.exe //B //Nologo`; the launcher runs the engine hidden, waits for it and forwards its exit code. `schedule status` lists the task, XML and launcher; `schedule uninstall` removes both files.
- **One-time reinstall.** A task installed by desktop `0.9.3` or older keeps the old console action until it is reinstalled once; the desktop reports the task as outdated through the engine status.
- **Engine and contracts.** The bundled onedir sidecar is `lv24-seo 0.14.1`; contracts (`config.schema.json`, CLI fixtures) are regenerated from `0.14.1`. The Windows x64 reviewed pin is `2bdf0077…0503` (14,582,464 bytes); Linux and macOS pins remain `null` and are covered by rebuild-aware CI checksum reports.
- **Not changed.** The read-only Indexing automation card, the Connect card readiness states, the two-phase write gates, MCP at 12 tools and SQLite schema v5.

Verification recorded for this release:

| Check | Result |
|---|---|
| GitHub Release | [`v0.9.4`](https://github.com/LevapVeeskela/lv24-seo-optimizer-desktop/releases/tag/v0.9.4); assets are produced by the manual **Desktop build** workflow with `engine_version=0.14.1` (verify the tag's `latest.json` and `SHA256SUMS.txt`) |
| Release workflow | run `44334023386` green |
| Local gate | `npm run typecheck`, `npm test`, `npm run build`, `npm run contract:check`, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` and `cargo test` green on the release commit |
| Tests | full Vitest and Rust suites passed |
| Contracts and pin | engine `0.14.1`; Windows x64 SHA-256 `2bdf0077887f3d0da29b9dce217ace6964d942469be5f3a03deaf336db3e0503`, 14,582,464 bytes |

Known limits in 0.9.4:

- Existing Windows scheduled tasks need one reinstall to replace the console action.
- The launcher relies on Windows Script Host (`wscript.exe`), present on supported Windows versions.
- The Indexing card stays read-only; installing or changing the job remains a separate gated action.
- An engine older than `0.14.1` is reported as incompatible.

## Desktop 0.9.3

Released on 2026-11-18. It shows the engine's OAuth readiness report in the Connect card and keeps
the bundled `lv24-seo 0.14.0`, `MIN_ENGINE_VERSION` `0.14.0`, the contracts and the Windows sidecar
pin unchanged. `0.9.2` is the previous release.

What changed:

- **Readiness in the Connect card.** For Google Search Console, Yandex Webmaster and Metrika the card renders a state chip, the engine `detail`, the exact `next_action`, the token expiry in the local language, whether scopes were recorded and any limitations.
- **State tones.** `oauth_ready` is the only state rendered as success. Missing client id, missing client secret, sign-in required, missing scopes and an invalid redirect use the action tone. An expired token (with the refresh hint) and unknown scopes are warnings, not failures.
- **Neutral fallback.** A missing `oauth` object, a skipped provider or an unknown state shows a neutral "Readiness unavailable" notice with the engine `>= 0.14.0` hint; it is never shown as Ready. The existing connection rows keep working.
- **Secrets.** The card parses presence booleans and timestamps only; no token or secret value is read, stored or rendered.
- **No engine change.** The sidecar is the same `lv24-seo 0.14.0` build as `0.9.2`; contracts and the Windows x64 pin (`33d2611c…02d0`, 14,580,661 bytes) are unchanged.

Verification recorded for this release:

| Check | Result |
|---|---|
| GitHub Release | [`v0.9.3`](https://github.com/LevapVeeskela/lv24-seo-optimizer-desktop/releases/tag/v0.9.3); 18 assets, `latest.json` reports `0.9.3`, `SHA256SUMS.txt` has 17 lines |
| Release workflow | run `44209259452` green |
| Local gate | `npm run typecheck`, `npm test`, `npm run build`, `npm run contract:check`, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` and `cargo test` green on the release commit |
| Tests | 804 Vitest tests and 169 Rust tests passed |
| Contracts and pin | engine `0.14.0`; Windows x64 SHA-256 `33d2611c0766c2b1160c80c35cfd51b86f6fbb7e26a9bb508aec0a32053b02d0`, 14,580,661 bytes |

Known limits in 0.9.3:

- The card displays the engine's English `detail`/`next_action` text verbatim; only labels, expiry and layout are localized.
- Readiness proves the local prerequisites are consistent, not that a provider accepted a consent screen. Live OAuth consent still requires a registered Google Desktop client and a Yandex OAuth app.
- An engine older than `0.14.0` is reported as incompatible.

## Desktop 0.9.2

Released on 2026-11-18. It adds the read-only **Indexing automation** card to Integrations, bundles
`lv24-seo 0.14.0` and raises `MIN_ENGINE_VERSION` to `0.14.0`, so an installed `0.13.x` engine is
reported as incompatible. It adds no write surface.

What changed:

- **Indexing automation card.** The Integrations screen renders `indexing status`, `indexing history` and `schedule status`; it has no write, confirm or `--allow-write` control.
- **Schedule.** Shows `Scheduled`/the host state and the documented **Daily 04:00** cadence for the `lv24-seo-indexing` job.
- **Per provider.** Bing, Yandex, GSC and IndexNow rows with `submitted`, `indexed` (GSC only), `pending`, and quota: Bing daily/monthly remaining, Yandex remaining, GSC/IndexNow used/limit. A provider with no state shows "No data yet", never a zero.
- **Last run and history.** The newest `indexing history` row with status, submitted/checked counts and up to five `error_items` (URL, code, message); a compact 7/30-day day/provider table from `indexing history --limit 30`.
- **Honesty.** Every render includes `data_age_days` and `limitations`; the GSC `indexed_total` aggregate is labelled deprecated and kept separate from the per-URL verdict. Bing/Yandex/IndexNow show no per-URL indexed count instead of inventing one.
- **Compatibility and bridge.** If the engine answers `INVALID_COMMAND`, the card shows "Indexing status needs engine >= 0.13.1" and hides the tables. `indexing_status` (`provider`, `limit`, `live`), `indexing_history` (`limit`) and `schedule_status` (`kind`, `target`) are allow-listed; the Rust layer validates every value, rejects write flags and cross-command arguments and uses a 120 s timeout. `--live` is the only provider call; a missing credential becomes a limitation, not a failure.
- **Engine and contracts.** The bundled onedir sidecar is `lv24-seo 0.14.0`; contracts (`config.schema.json`, CLI fixtures including `stats`) are regenerated from `0.14.0`. The Windows x64 reviewed pin records the built `0.14.0` executable (`33d2611c…02d0`, 14,580,661 bytes); Linux and macOS pins remain `null` and are covered by rebuild-aware CI checksum reports.

Verification recorded for this release:

| Check | Result |
|---|---|
| GitHub Release | [`v0.9.2`](https://github.com/LevapVeeskela/lv24-seo-optimizer-desktop/releases/tag/v0.9.2); assets are produced by the manual **Desktop build** workflow with `engine_version=0.14.0` (verify the tag's `latest.json` and `SHA256SUMS.txt`) |
| Local gate | `npm run typecheck`, `npm test`, `npm run build`, `npm run contract:check`, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` and `cargo test` green on the release commit |
| Tests | 784 Vitest tests and 169 Rust tests passed |
| Contracts | up to date at engine `0.14.0` |
| Sidecar pin | Windows x64 verified against the pinned SHA-256 (`33d2611c0766c2b1160c80c35cfd51b86f6fbb7e26a9bb508aec0a32053b02d0`, 14,580,661 bytes); Linux and macOS covered by rebuild-aware reports |

Known limits in 0.9.2:

- The card is read-only: it shows the schedule state but cannot install, edit or run the job.
- `--live` reads Bing and Yandex quotas on refresh; a missing credential is shown as a limitation.
- Bing, Yandex and IndexNow do not expose a per-URL indexed count; the card shows no value with `no_per_url_index_count` instead of inventing one.
- The GSC `contents[].indexed` aggregate is deprecated and can be zero.
- An engine older than `0.14.0` is reported as incompatible.

## Desktop 0.9.1

Released on 2026-11-18. It adds the OAuth Connect card to Integrations, bundles `lv24-seo 0.13.1` and raises `MIN_ENGINE_VERSION` to `0.13.1`, so an installed `0.12.x` engine is reported as incompatible. It adds no new write surface.

What changed:

- **Connect card.** Integrations gains a **Connectors** card for Google Search Console, Yandex Webmaster and Yandex Metrika. Tokens are stored by the engine in the OS keychain; the desktop never receives, renders or logs one.
- **Google Search Console.** **Connect** runs `auth login --provider gsc`. The engine opens the system browser, starts a `127.0.0.1` loopback callback with S256 PKCE and waits for consent; the card shows a "complete the sign-in in your browser" hint and refreshes `auth status` on success. A missing client id or secret shows the engine's `next_action` and the auth guide instead of a generic failure.
- **Yandex Webmaster and Metrika.** **Connect** calls `auth login --provider yandex|metrika --url-only` and shows the authorization URL with an **Open Yandex** button. After approving access, the user pastes the code from `https://oauth.yandex.ru/verification_code` and clicks **Finish**; the code is cleared from state after the exchange. The two engines use separate token slots.
- **Status and bridge.** The card reads `auth status` (`gsc_oauth`, `yandex_oauth`, `metrika_oauth`) and shows `Connected`, `Not connected` or `Not checked`. The client secret is configured once with `auth set --provider gsc_oauth_secret|yandex_oauth_secret --stdin`; the UI has no secret field. `auth_login` is allow-listed with `provider`, `noBrowser`, `port`, `code` and `urlOnly`; the Rust layer rejects write flags, cross-provider combinations and invalid ports or codes before spawning the engine, and `open_oauth_url` accepts only `https://oauth.yandex.ru/authorize?...`.
- **Engine and contracts.** The bundled onedir sidecar is `lv24-seo 0.13.1`; contracts (`config.schema.json`, CLI fixtures including `stats`) are regenerated from `0.13.1`. The Windows x64 reviewed pin records the built `0.13.1` executable; Linux and macOS pins remain `null` and are covered by rebuild-aware CI checksum reports.

Verification recorded for this release:

| Check | Result |
|---|---|
| Published assets | 18 assets on `v0.9.1`; `latest.json` reports `0.9.1` and `SHA256SUMS.txt` has 17 lines |
| Release workflow | run `44199591548` green |
| Local gate | `npm run typecheck`, `npm test`, `npm run build`, `npm run contract:check`, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` and `cargo test` green on the release commit |
| Tests | 763 Vitest tests and 167 Rust tests passed |
| Contracts | up to date at engine `0.13.1` |
| Sidecar pin | Windows x64 verified against the pinned SHA-256 (`0b02b8a0…`, 14,567,729 bytes); Linux and macOS covered by rebuild-aware reports |

Known limits in 0.9.1:

- **Live OAuth consent is not yet verified**: no Google Cloud Desktop client or Yandex OAuth app was registered at release time. The card shows the engine's setup error until a real client id/secret is configured.
- Google OAuth apps in **Testing** issue refresh tokens that expire after 7 days; the service account remains the unattended GSC path. A public app needs Google verification for `webmasters.readonly`.
- The Yandex `verification_code` flow cannot verify `state` across the separate URL-only and code steps; the code is short-lived and the client secret is still required.
- Bing Webmaster, IndexNow, CrUX and PSI remain key-based; the card does not offer OAuth for them.
- `MIN_ENGINE_VERSION` is `0.13.1`, so a `0.12.x` engine is rejected. The Connect card has no write controls: no `--allow-write`, confirm token or provider write path.
- No indexing status card: `indexing status|run|history` remain CLI and scheduler only.

## Engine 0.12.2

Released on 2026-11-17. Three releases on the same day add quota-aware indexing automation and fix
two indexing defects. The CLI now has 25 top-level commands (18 groups + 7 commands), the MCP surface
stays at 12 tools, and the SQLite schema moves to version 5.

### 0.12.0 - quota-aware indexing automation

What changed:

- **`indexing` group.** `indexing status [--provider all|bing|yandex|gsc|indexnow] [--limit 50] [--live] [--json]`, `indexing run [--provider ...] [--from-sitemap|--sitemap-url ABS|--url ABS ...] [--max-submit N] [--max-inspect N] [--force] [--allow-write] [--json]` and `indexing history [--limit 20] [--json]`. The queue is read from the project sitemap by default (root plus five child documents, 10,000 URLs) and merged with explicit `--url` values; off-host URLs are skipped and every cap is reported (`queue_cap`, `sitemap_truncated`, `sitemap_off_host`).
- **Priority and idempotency.** Never-submitted URLs first, then URLs whose sitemap `lastmod` is newer than `last_submitted_at`, then URLs whose `last_checked_at` is older than `check_interval_days`. A URL whose `last_submitted_at` is newer than its `lastmod` is skipped unless `--force` is set. Without `--allow-write` the run only checks and plans; with it the engine re-reads quotas, rebuilds the plan, verifies the plan hash, mints and consumes an internal confirm token through `WriteGate`, and records one `indexing_runs` row per provider.
- **Quota-aware planning.** Bing reads `GetUrlSubmissionQuota` (remaining daily/monthly; 500 URLs per batch; the monthly reset is undocumented). Yandex reads `recrawl/quota` `quota_remainder` and sends one request per URL. GSC URL Inspection is capped by a local `quota_usage` counter (default 2,000/day/site) because Google exposes no remaining count. IndexNow has a local daily cap (default 1,000) and a 10,000-URL POST bound.
- **Honest index counts.** GSC URL Inspection is the only per-URL verdict (`PASS`/`Submitted and indexed` → `indexed`; `NEUTRAL`/`FAIL` → `not_indexed`; anything else `unknown`). The GSC sitemap `contents[].indexed` aggregate is reported separately as `indexed_total` and always tagged `gsc_indexed_count_deprecated`. Bing `GetUrlInfo` yields `http_status` and `last_crawled_at`, so a crawled URL is `crawled`, not `indexed` (`bing_no_per_url_index_status`). Yandex and IndexNow have no per-URL status; their `indexed_total` is `null` with `no_per_url_index_count`. Bing Site Scan has no public API, so every Bing entry carries `site_scan_no_api`.
- **Status.** `indexing status` reports per provider `urls`, `submitted`, `crawled`, `queued`, `indexed` (sample), `indexed_total` (GSC aggregate), `pending`, `quota` and `limitations`. `write_secret_present` reports only whether `LV24_SEO_WRITE_SECRET` is set; the value is never read into the envelope. `--live` reads Bing and Yandex quotas now.
- **Scheduler and store.** `schedule install --kind indexing` renders a daily `lv24-seo-indexing` job at `04:00` running `indexing run --allow-write --config <abs> --json` for cron, systemd and Windows Task Scheduler. Schema v5 adds `indexing_state`, `indexing_runs` and `quota_usage`; existing databases migrate in place, idempotently and append-only. `[indexing]` config: `enabled=false`, `providers=["bing","yandex","indexnow","gsc"]`, `max_submit_per_run=500`, `max_inspect_per_run=20`, `stale_days=7`, `check_interval_days=7`, `gsc_inspect_daily_limit=2000`, `indexnow_daily_limit=1000`.

### 0.12.1 - indexing client lifecycle

`indexing run` reported `internal_error` for Bing and Yandex because the indexing engine closed a provider client between the quota read and the checks/submit phase, while `SeoService` kept that closed client in its cache. `SeoService` no longer hands the engine a `close_client` callback; it owns and caches provider clients for the whole run, so the engine drops its local reference instead of closing a shared client. A regression test uses a closable fake Yandex client. `indexing status --live` was unaffected, and there is no API, CLI, schema or config change.

### 0.12.2 - Yandex recrawl 5xx mapping

`yandex recrawl` and `indexing run --provider yandex` reported `UPSTREAM_UNAVAILABLE: invalid JSON response from recrawl/queue` when Yandex returned a 5xx gateway timeout with an empty body. `YandexWebmasterClient.recrawl_enqueue` now checks `status >= 500` first and raises `UPSTREAM_UNAVAILABLE` with the HTTP status and `retryable: true`; `202`, `409 URL_ALREADY_ADDED` and `429 QUOTA_EXCEEDED` behaviour is unchanged. An offline 504-with-empty-body test asserts the message never says "invalid JSON".

Verification recorded for this release:

| Check | Result |
|---|---|
| PyPI / npm / MCP Registry | `lv24-seo 0.12.0`, `0.12.1` and `0.12.2` published |
| Release workflow | run `44155371533` (0.12.0), `44157740063` (0.12.1) and `44160332890` (0.12.2) green |
| `indexing status --live` (lv24.by) | Bing 99 daily / 1399 monthly remaining, Yandex 150, GSC 0/2000 used, IndexNow 0/1000, `write_secret_present: true` |
| First `indexing run` (lv24.by) | 5 Bing + 5 IndexNow submissions; 15 GSC URLs checked, 3 indexed; the Yandex POST returned HTTP 504 provider-side and is retried by the daily job |
| `schedule install --kind indexing` | installed `lv24-seo-indexing` at 04:00 |
| Local gate | `ruff check`, `ruff format --check`, `mypy src`, registry `--check` and offline `pytest` green on each tagged commit |

Known limits in 0.12.2:

- Only GSC exposes a per-URL index verdict. Bing, Yandex and IndexNow report `indexed_total: null` with `no_per_url_index_count`; GSC's sitemap aggregate is deprecated and kept separate.
- Bing Site Scan has no public API; the desktop only opens the official page.
- IndexNow has no status API and no published quota; the local daily cap is a conservative guard.
- A scheduled apply needs `[indexing] enabled=true` **and** `LV24_SEO_WRITE_SECRET` in the host scheduler environment; the generated command never contains the secret.
- `indexing run` checks at most `max_inspect_per_run` URLs per run (default 20); a large site is sampled over several runs and `meta.truncated` says so.
- Yandex recrawl can return a provider-side 5xx. `0.12.2` reports it honestly as `UPSTREAM_UNAVAILABLE`; there is no client-side retry, so the daily job retries on its next run.

## Engine 0.11.0

Released on 2026-11-17. Every supported platform gains the read APIs that were previously adapter-only,
partial or missing. The CLI now has 24 top-level commands; the MCP surface stays at 12 tools and the
SQLite schema stays at version 4.

What changed:

- **GSC URL Inspection.** `gsc inspect --url ABS [--language en-US] [--config ABS] [--json]` wires URL Inspection end-to-end. The result maps the full `indexStatusResult` (`verdict`, `coverageState`, `robotsTxtState`, `indexingState`, `lastCrawlTime`, `pageFetchState`, `googleCanonical`, `userCanonical`, `crawledAs`, `sitemap[]`, `referringUrls[]`), `richResultsResult` (`verdict`, `detectedItems[].items[].issues[]`) and `inspectionResultLink`. `--language` localizes human-readable states. Limitations are `one_url_per_call`, `url_inspection_quota_2000_per_day` and `inspection_reflects_last_crawl`: it is a report about the last crawl, not a live test.
- **GSC sitemaps.** `gsc sitemaps [--sitemap-index URL]` and `gsc sitemap --path URL` map `path`, `lastSubmitted`, `lastDownloaded`, `isPending`, `isSitemapsIndex`, `type`, `errors`, `warnings` and `contents[{type,submitted,indexed}]`. GSC's `indexed` count is marked deprecated (`indexed_deprecated`, `sitemap_indexed_count_deprecated`), and child sitemap URLs of an index are reported as not exposed (`sitemap_index_children_not_exposed`) rather than guessed. Submit/delete stay `WRITE_DISABLED` because the engine signs `webmasters.readonly`.
- **GSC query filters.** `gsc query` gains `--type`, repeatable `--filter dimension:operator:expression`, repeatable `--filter-list dimension:expr1,expr2`, `--data-state`, `--aggregation`, `--search-appearance` and `--branded`. Responses add `responseAggregationType` and the incomplete-data `metadata` (`firstIncompleteDate`/`firstIncompleteHour`) when Google returns it. Existing defaults and the 25k rows/page, 50k rows/call caps are unchanged. The richer selectors are CLI-only.
- **Yandex events fix.** `search-urls/events/history` read an `events` list, but the API returns `indicators{APPEARED_IN_SEARCH,REMOVED_FROM_SEARCH}[{date,value}]`, so every call reported `empty_history` and dropped real data. The client now merges the appeared/removed series per date. A live window on 2026-10-02 returned 57 appeared / 0 removed. When the events endpoint resets the connection on a date window, the client retries unfiltered, filters locally and warns `client_side_date_filter`.
- **Yandex read depth.** `yandex indexing` accepts `--date-from/--date-to` and merges the event series with the indexing HTTP series. `yandex samples --kind indexing|events [--limit] [--offset]` pages the provider sample endpoints with honest `total`/`truncated` (100 per page). `yandex sitemaps [--id] [--parent-id] [--limit] [--from]` reads sitemap lists and details (`sitemap_id`, `sitemap_url`, `last_access_date`, `errors_count`, `urls_count`, `children_count`, `sources[]`, `sitemap_type`); add/delete is not implemented. `yandex history --kind sqi|in-search|queries|query [--query-id]` reads SQI, pages-in-search, all-query and per-query series. `yandex queue [--id]` reads recrawl tasks with the provider `count`.
- **Yandex recrawl is wired.** `yandex recrawl` plans with `--allow-write` and applies with `--confirm TOKEN`: one `POST` per URL, capped to `quota_remainder`, handling `202` (`task_id`, `quota_remainder`), `409 URL_ALREADY_ADDED` as `already_queued` and `429 QUOTA_EXCEEDED` with the remaining URLs in `not_attempted`. There is no batch endpoint.
- **Bing read depth.** `bing pages` (`GetPageStats`), `bing traffic` (`GetRankAndTrafficStats`, daily), `bing crawl` (`GetCrawlStats`, six-month daily buckets), `bing urlinfo --url URL|domain:HOST` (`GetUrlInfo`), `bing children --url ... [--page] [--pages]` (`GetChildrenUrlInfo`, read POST, bounded to 10 pages), `bing users` (`GetSiteRoles`, read-only), `bing sites` (`GetUserSites`) and `bing joins --query|--page` (`GetQueryPageStats`, `GetPageQueryStats`, `GetQueryPageDetailStats`). The `Date(-62135596800000)` sentinel maps to `null` and is flagged `never_crawled`; `TotalChildUrlCount` is kept as a separate field.
- **Honest empty answers.** Stats and joins add `no_rows_for_window`, `crawl` always adds `crawl_stats_six_month_window`, and lookups/lists add `provider_returned_no_rows`. A zero row count is no longer presented as "zero impressions".
- **Organic Metrika.** New read-only `metrika` group: `pages`, `goals`, `queries`, `devices`, `countries`, `engagement` and `bytime`. The SEO collector applies `filters=ym:s:lastTrafficSource=='organic'`; `stats` and `report weekly` expose `organic_visits`/`organic_users` and keep all traffic explicit as `all_visits`/`all_users`. `metrika pages` returns organic landing pages with visits/users, bounce rate, average duration, page depth and pageviews. `metrika goals` queries the configured goal ids, optionally by `page` or `source`; an empty list is an honest warning, and more than five goals are truncated at Metrika's 20-metric cap. Sampling fields (`sample_share`, `sample_size`, `sample_space`, `data_lag`, `contains_sensitive_data`, `total_rows_rounded`) are carried into meta and limitations; only `sampled=false` is exact.
- **CrUX and PSI depth.** `cwv audits --url ABS [--strategy mobile|desktop] [--category ...]` returns up to 100 bounded Lighthouse audits (`id`, `title`, `score`, `display_value`, description with HTML stripped, `details_type`, savings, `items_count`). `runtimeError`, CAPTCHA and redirects become warnings/limitations instead of a clean run. `cwv collect` gains repeatable `--category`. `cwv history (--url ABS | --origin ABS) [--device] [--weeks 1..40]` reads weekly CrUX p75 rows with honest gaps and truncation. `collectionPeriod.firstDate/lastDate` now drives `data_age_days`; the two-day heuristic is only a fallback with `crux_period_missing`, and `urlNormalizationDetails` produces `crux_url_normalized`.
- **IndexNow rules.** The key must match `[A-Za-z0-9-]{8,128}` and is validated before planning. A same-host `keyLocation` directory prefix is enforced. Responses map `200 accepted`, `202 accepted_pending`, `400` format, `403 AUTH_INVALID` with the exact expected key URL, `422` host/key mismatch and `429` quota/spam. The key is never echoed.
- **Surface and schema.** 24 top-level CLI commands (17 groups and 7 commands, adding `metrika`), 12 MCP tools (10 read-class: 7 pure read-only plus 3 local-state writers; 2 gated writes), 3 resources and 3 prompts unchanged, schema version 4 and no migration. `seo_indexing_triage` gains an optional `url` input and returns one GSC inspection; `schemas/tools.json` is regenerated for that input. GSC sitemap reads and the richer search selectors are CLI-only, so no thirteenth tool is added.

Verification recorded for this release:

| Check | Result |
|---|---|
| PyPI | `lv24-seo 0.11.0` published |
| npm | `@lv24/seo 0.11.0` published |
| MCP Registry | `io.github.LevapVeeskela/lv24-seo 0.11.0` published |
| Release workflow | run `44126291380` green (build, verify, PyPI, npm, MCP Registry) |
| Desktop | `0.9.0` published with engine `0.11.0` |
| `gsc inspect` `/` | `PASS`, "Submitted and indexed", canonical match, `crawledAs: MOBILE` |
| `gsc sitemaps` | 3 sitemaps; 3179 and 1551 submitted; one index |
| `gsc query --filter country:equals:BLR --data-state all` | filtered rows; `metadata.firstIncompleteDate` present |
| `yandex indexing` date window | 427 event rows; 2026-10-02 = 57 appeared / 0 removed |
| `yandex sitemaps` / `history` / `queue` | 1 sitemap with 6532 URLs; 898 SQI points; 28 tasks |
| `bing sites` / `users` / `urlinfo` | 1 site; 1 `Administrator`; 8380 children with sentinel dates `null` |
| `bing pages` / `traffic` / `crawl` / `joins` | 0 rows with `no_rows_for_window`, not zero impressions |
| `metrika pages` / `goals` / `devices` / `countries` | 4 organic landing pages; 5 goals; 3 Smartphones + 1 PC; Belarus 4 |
| `cwv audits` / `cwv history` | 58 audits; 0 history rows with `low_traffic` + `crux_period_missing` |
| Local gate | `ruff check`, `ruff format --check`, `mypy src`, registry `--check` and offline `pytest` green on the tagged commit |

Known limits in 0.11.0:

- Bing stats and joins return 0 rows for `lv24.by`, so their field semantics are covered by fixtures, not by a live non-empty response. `GetSiteMoves` is retired (live 404) and is not wired.
- Bing `GetChildrenUrlInfo` returns 0 rows for this host even though `GetUrlInfo` reports 8380 children; the engine reports the provider answer instead of synthesising rows.
- Yandex `indexing/samples` resets the connection provider-side for this host; it surfaces as `UPSTREAM_UNAVAILABLE`, not as empty data.
- Yandex sitemap add/delete is not implemented; recrawl `202/409/429` handling is covered offline only (no live POST was made).
- Metrika hides search phrases with fewer than 10 users and Google withholds keywords; goal names are not resolved (ids only).
- CrUX has no field data for `lv24.by`, and the history API is bounded to 40 weekly periods.
- IndexNow has no key file configured for `lv24.by`; native Bing URL submission remains the working write path. Google does not participate in IndexNow.
- Bing Site Scan has no public API: the desktop opens the official page and the engine cannot import its report.

## Desktop 0.9.0

Released on 2026-11-17. It adds a read-only Diagnostics screen over engine `0.11.0`, bundles `lv24-seo 0.11.0` and raises `MIN_ENGINE_VERSION` to `0.11.0`, so an installed `0.10.x` engine is reported as incompatible. There is no new write surface.

What changed:

- **Read-only Diagnostics screen.** The sidebar gains **Diagnostics** (`/diagnostics`) with five tabs: Google (`gsc_inspect`, `gsc_sitemaps`), Yandex (`yandex_indexing`, `yandex_sitemaps`, `yandex_queue`), Bing (`bing_pages`, `bing_traffic`, `bing_crawl`, `bing_urlinfo`, `bing_joins`), Metrika (`metrika_pages`, `metrika_goals`, `metrika_devices`, `metrika_countries`, `metrika_engagement`, `metrika_bytime`) and Core Web Vitals (`cwv_audits`, `cwv_history`). Every command runs through the fixed `cli_run` allow-list; the screen has no write buttons, no confirm tokens and no `--allow-write` path.
- **Google tab.** `gsc_inspect` inspects exactly one absolute URL and shows verdict, coverage state, robots/indexing state, last crawl, fetch state, Google/user canonical, `crawledAs`, referring URLs, rich-result issues and the inspection link. `gsc_sitemaps` lists submitted sitemaps with type, index flag, errors, warnings and per-content submitted counts. GSC's deprecated `indexed` count is labelled as such; child sitemap URLs of an index are not exposed.
- **Yandex tab.** `yandex_indexing` shows appeared/removed events and indexing HTTP buckets for a date window. `yandex_sitemaps` lists sitemap ids, URL/error counts and last access. `yandex_queue` lists recrawl tasks with the provider total. A provider reset or an empty answer is shown as `client_side_date_filter` / `provider_returned_no_rows`, not as zero data.
- **Bing tab.** `bing_pages`, `bing_traffic`, `bing_crawl`, `bing_urlinfo` and `bing_joins` expose page stats, daily clicks/impressions, six-month crawl buckets, URL index/crawl details and query/page joins. Empty stats render `no_rows_for_window`; lookups render `provider_returned_no_rows`. The `Date(-62135596800000)` sentinel is shown as "never", not 0001.
- **Metrika tab.** `metrika_pages`, `metrika_goals`, `metrika_devices`, `metrika_countries`, `metrika_engagement` and `metrika_bytime` are organic-only. The tab shows `meta.organic_only`, the sampling fields and every limitation.
- **Core Web Vitals tab.** `cwv_audits` lists bounded Lighthouse audits with score, display value and savings; `cwv_history` lists weekly CrUX p75 rows with collection periods. A low-traffic URL shows the explicit `low_traffic` empty state instead of a blank table.
- **Honest report chrome.** Every tab renders the engine's `total`, `truncated`, `data_age_days` and `limitations` (or states that no limitations were reported). Provider empties are explicit states, never zeros. The panels do not auto-retry reads.
- **Bridge hardening.** The Rust bridge adds 18 allow-listed command ids and rejects, before spawning the engine: write flags (`allowWrite`, `confirm`) and tokens on every diagnostics command; unknown `group`, `strategy`, `device` or `category` values; arguments that belong to a different command; and a `--site` override for Bing reads (the target stays `providers.bing.site`). The webview cannot pass an executable, a shell string or an arbitrary flag. Diagnostics commands are config-required and non-cancellable, like the other short reads.
- **Engine 0.11.0 and contracts.** `MIN_ENGINE_VERSION` is `0.11.0`; an installed `0.10.x` sidecar is reported as incompatible instead of failing with `CLI_INVALID_JSON`. The bundled onedir sidecar is `lv24-seo 0.11.0`. Contracts (`config.schema.json`, CLI fixtures including `stats`) are regenerated from engine `0.11.0`. Bing URL submission, Bing sitemap submit and IndexNow keep their existing two-phase gates; GSC sitemap submit and Bing sitemap delete remain `WRITE_DISABLED`.

Verification recorded for this release:

| Check | Result |
|---|---|
| Published assets | `v0.9.0` for Windows x64, Linux x64 and macOS arm64/x64; `latest.json` and `SHA256SUMS.txt` published by the manual release workflow |
| Local gate | `npm run typecheck`, `npm test`, `npm run build`, `npm run contract:check`, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test` green on the release commit |
| Tests | 742 Vitest tests and 163 Rust tests passed |
| Contracts | up to date at engine `0.11.0` |
| Sidecar pin | Windows x64 verified against the pinned SHA-256 (`db02d1b3…`, 14,478,498 bytes); Linux and macOS covered by rebuild-aware reports |
| Release workflow | run `44138417407` green; 18 assets on `v0.9.0`; `latest.json` reports `0.9.0`; a sidecar checksum report is required per shipped target |

Known limits in 0.9.0:

- Metrika goals are shown as totals only; the desktop does not expose the engine's optional `--dimension page|source` selector.
- CWV history "all devices" omits the device filter instead of inventing a combined row.
- Bing reads use `providers.bing.site`; the desktop has no `--site` override.
- Bing Site Scan still has no public API: the Integrations card only opens the official page and cannot import a scan report.
- An engine older than `0.11.0` is reported as incompatible. Update the engine or install the bundled sidecar.
- The Diagnostics panels do not auto-retry; a failed read shows the engine error and a manual retry.
- The screen is read-only by design: it adds no recrawl, sitemap or URL submission action.

## Engine 0.10.0

Released on 2026-11-17. It turns Bing URL submission into a real gated write and adds read-only
Bing quota, sitemap-feed and crawl-issue views. The CLI now has 23 top-level commands; the MCP
surface stays at 12 tools and the SQLite schema stays at version 4.

What changed:

- **Bing URL submission.** `bing submit [--url ABS …] [--from-sitemap] [--sitemap-url ABS] [--site URL] [--allow-write] [--confirm TOKEN]` sends URLs through Bing Webmaster `SubmitUrlbatch`. `--url` may be repeated and is merged with `--from-sitemap`; a `<urlset>` is read directly, a `<sitemapindex>` is bounded to the root plus five child sitemaps and 10,000 URLs, explicit URLs are deduplicated first, off-site URLs are skipped, and `meta.truncated`, `meta.total` and `meta.limitations` report every cap or skip. The plan reports the URL count, the 500-URL batch count and the current remaining quota in `meta.quota`; it contacts no write endpoint. Apply re-fetches the sitemap and invalidates the token with `CONFIRM_REQUIRED` if its URL set changed.
- **500-URL batches and honest status.** `SubmitUrlbatch` is called in explicit 500-URL batches after a client-side quota pre-check against both the daily and monthly windows. A batch success is `200 {"d": null}` with no per-URL status, so the result says `status: accepted` and `accepted`, never "indexed"; `duplicates_removed`, `batches`, `batch_size` and `quota_after` are reported. Bing does not document submit idempotency and a duplicate URL may consume quota (`submit_idempotency_undocumented`), while the SQLite write-gate ledger still makes a replayed confirm token return `status: skipped` with `reason: duplicate`. A missing `providers.bing.site` is `CONFIG_INVALID`, a missing `bing_api_key` is `AUTH_REQUIRED`, and the key never appears in an error.
- **Bing quota.** `bing quota` reads `GetUrlSubmissionQuota`. `DailyQuota` and `MonthlyQuota` are **remaining** submissions, not totals: rows expose `daily_remaining` and `monthly_remaining` plus the provider object in `raw`, and used/total values are never computed. The limitations `quota_monthly_can_bind_first` and `quota_monthly_reset_undocumented` state that the monthly window can bind before the daily one and that Bing does not publish a monthly reset schedule.
- **Bing sitemap feeds.** `bing sitemaps [--details FEED_URL]` reads `GetFeeds` and maps URL, type, status, submitted, last crawled, URL count, file size and compression. `LastCrawled` (falling back to `Submitted`) bounds `data_age_days`; `Status` is a free provider string such as `Success`, not a crawl or index status. Bing exposes no per-URL sitemap errors and no paging, so the result carries `no_per_url_sitemap_errors` and `sitemap_status_is_not_crawl_status`. `--details` reads `GetFeedDetails` for the children of a sitemap index; it is an option, not a separate command.
- **Bing crawl issues.** `bing issues` reads `GetCrawlIssues` and returns URL, HTTP code, in-links and the `Issues` bitmask decoded into labels (`1=301`, `2=302`, `4=4xx`, `8=5xx`, `16=robots`, `32=malware`, `64=important_robots`, `128=dns`, `256=timeout`). Unknown bits are reported with `unknown_crawl_issue_bits` instead of being guessed. The feed has no date, so `data_age_days` is `0`, and it has no severity.
- **Bing error mapping.** Bing returns auth failures as HTTP 400 with a numeric `ErrorCode`, not 401/403. The adapter maps `3` to `AUTH_INVALID`, `14` to `PROPERTY_NOT_FOUND`, `7` to `INVALID_INPUT` and `4/5` to `QUOTA_EXCEEDED`, keeps 401/403/404/429/5xx as fallbacks, and never echoes the provider message or the API key.
- **Surface and schema.** 23 top-level CLI commands (16 groups and 7 commands, adding `bing`), 12 MCP tools (10 read-class: 7 pure read-only plus 3 local-state writers; 2 gated writes), 3 resources and 3 prompts unchanged, schema version 4 and no migration. `schemas/tools.json` is unchanged. Bing URL submission, quota, sitemaps and issues are CLI/desktop-only: no thirteenth MCP tool is added, and `seo_sitemap_submit` still submits a sitemap, not a URL batch.

Verification recorded for this release:

| Check | Result |
|---|---|
| PyPI | `lv24-seo 0.10.0` published |
| npm | `@lv24/seo 0.10.0` published |
| MCP Registry | `io.github.LevapVeeskela/lv24-seo 0.10.0` published with `isLatest: true` |
| CI | run `44068127891` green |
| Release workflow | run `44068457680` green |
| Desktop | `0.8.0` published with engine `0.10.0`; assets named `0.8.0` / `-0.8.0-` |
| `bing quota`, configured workspace | 100 daily and 1400 monthly remaining |
| `bing sitemaps`, configured workspace | 1 feed with `Status: Success` |
| `bing issues`, configured workspace | 0 rows |
| `bing submit --url`, configured workspace | 1 URL, 1 batch, `accepted`; quota after the write 99 |
| `bing submit --from-sitemap` plan | capped to 99 of 3366 URLs with `truncated: true` and `bing_quota_cap` |

Known limits in 0.10.0:

- `DailyQuota` and `MonthlyQuota` are remaining submissions, not totals; used/total values are never computed.
- The monthly window can bind before the daily one, and Bing does not document the monthly reset schedule.
- `SubmitUrlbatch` returns no per-URL status: results say `accepted`, never "indexed". Idempotency is undocumented and a duplicate URL may consume quota.
- `GetFeedDetails` is documented-only in this release and was not verified against a live response; treat `bing sitemaps --details` as unconfirmed until the next live check.
- `GetFeeds` exposes no per-URL sitemap errors and no crawl or index status; `Status` is a free provider string.
- `GetCrawlIssues` has no date (`data_age_days` is `0`) and no severity; unknown bitmask bits are reported, not guessed.
- Bing URL submission is a provider network write: it is not cancellable, is not retried automatically and has no rollback. Review a fresh plan before retrying.

## Desktop 0.8.0

Released on 2026-11-17. It adds Bing URL submission and read-only sitemap, crawl-issue and quota
cards to Integrations, keeps the existing sitemap, IndexNow and Site Scan cards and the
per-session write secret, bundles `lv24-seo 0.10.0` and raises `MIN_ENGINE_VERSION` to `0.10.0`,
so an installed `0.9.x` engine is reported as incompatible.

What changed:

- **Bing URL submission card.** The Integrations screen builds `bing submit --config <path> [--url <abs> ...] [--from-sitemap] [--sitemap-url <abs>] --allow-write [--confirm <token>] --json`. Planning runs with the write opt-in but no token, reads the current quota and contacts no write endpoint. The card shows the URL count, the 500-URL batch count, the remaining quota and the engine's limitations, and **Apply** sends the reviewed token. A cancelled or failed apply drops the plan and requires a fresh review.
- **URL list, sitemap or both.** URLs are entered one per line and/or read from the project sitemap. The shell merges both sources, requires at least one, accepts at most 10,000 URLs, and rejects a relative URL, a duplicate write flag or a token without the opt-in before the engine starts. The plan is bound to the sitemap: apply re-fetches it and invalidates the token with `CONFIRM_REQUIRED` if its URL set changed.
- **Read-only sitemap, issues and quota cards.** `bing_sitemaps` lists URL, provider status, last crawl and URL count and states that Bing has no per-URL sitemap errors or paging. `bing_issues` shows URL, HTTP code, in-links and decoded issue labels, with unknown bits visible and no invented severity or date. `bing_quota` shows daily and monthly remaining submissions and states that the monthly window can bind first and that the reset is undocumented. A failed read shows the engine error and a manual retry; nothing is polled in the background.
- **Existing Bing surface.** The sitemap submit card, IndexNow from the sitemap and the official Bing Site Scan opener remain. The target site comes from `providers.bing.site`; the desktop accepts no per-run `--site` override. A missing site is `CONFIG_INVALID`, a missing `bing_api_key` is `AUTH_REQUIRED` with a Settings hint, and the key never appears in an error or result.
- **Engine 0.10.0 and contracts.** The sidecar adds `bing submit`, `bing quota`, `bing sitemaps` and `bing issues`. Contracts were regenerated from `lv24-seo 0.10.0`; only the fixture version strings change and no command surface is added to the fixtures. `MIN_ENGINE_VERSION` is `0.10.0` because an older engine would answer the new commands with `CLI_INVALID_JSON`. The per-session write secret and the reviewed-plan flow are unchanged.

Verification recorded for this release:

| Check | Result |
|---|---|
| Published assets | 18 on `v0.8.0` for Windows x64, Linux x64 and macOS arm64/x64, including the Windows portable `.zip.sha256` |
| Updater manifest | `latest.json` reports `0.8.0` |
| CI | run `44070978027` green |
| Release workflow | run `44074365838` green |
| In-app update | `0.7.0 → 0.8.0` verified through the Rust updater on Windows NSIS: **Desktop 0.8.0**, **Engine 0.10.0** and engine ready |
| Workspace smoke test | a configured workspace loaded on the relaunched build without exposing query data |
| Bing URL submission | a plan with 1 URL produced 1 batch; the apply reported `accepted`, not indexed |
| Sitemaps card | 1 feed with `Status: Success` |
| Crawl issues card | 0 issues returned |
| Quota card | 99 daily and 1399 monthly submissions remaining |
| Bing Site Scan opener | the official Bing page opened in the default browser; no scan was reported as started |
| Bundled engine | sidecar `lv24-seo 0.10.0`; `MIN_ENGINE_VERSION` is `0.10.0` |

Known limits in 0.8.0:

- The desktop has no `--site` override; the target comes from `providers.bing.site` in the active `seo.toml`.
- The read-only quota, sitemap and issue cards do not auto-retry; a failed load needs a manual retry.
- Bing URL submission is a provider network write: it is not a cancellable background run, is not retried automatically and has no rollback. A replayed token is `skipped`/`duplicate` through the ledger, but Bing does not document submit idempotency and a duplicate URL may consume quota.
- Accepted is not indexed: Bing returns no per-URL status for `SubmitUrlbatch`, so the result only confirms that Bing accepted the batch.
- Quota counts are remaining, not used or total; the monthly window can bind first and the reset schedule is undocumented.
- `GetFeedDetails` is a note in the panel, not a screen; index children are expanded only on the engine side.
- `MIN_ENGINE_VERSION` is `0.10.0`, so a `0.9.x` engine is rejected.
- Linux and macOS sidecar pins remain `null`; the release gate relies on rebuild-aware reports.

## Engine 0.9.0

Released on 2026-11-17. It turns Bing sitemap submission into a real gated write and lets IndexNow
read its URL list from the project sitemap and its host and key from `seo.toml`. The CLI still has
22 top-level commands; the MCP surface stays at 12 tools and the SQLite schema stays at version 4.

What changed:

- **Bing sitemap submit.** `sitemap submit --provider bing [--property SITE] [--url ABS] [--allow-write] [--confirm TOKEN]` sends the site's sitemap through the current Bing Webmaster JSON endpoint `POST .../SubmitFeed` with `{"siteUrl": …, "feedUrl": …}`. The site comes from `providers.bing.site` or `--property`, the sitemap from `--url` or `<project.base_url>/sitemap.xml`, and the key from the `bing_api_key` secret; a missing site, base URL or key fails before any network call. HTTP 401/403 map to `AUTH_INVALID`, 404 to `PROPERTY_NOT_FOUND`, 429 to `QUOTA_EXCEEDED`, 5xx to `UPSTREAM_UNAVAILABLE` and other 4xx to `INVALID_INPUT`, and the key never appears in an error. `--provider` defaults to `gsc`, so existing scripts keep the GSC plan.
- **Two-phase Bing write.** Plan and apply both need `--allow-write` and `LV24_SEO_WRITE_SECRET`; the plan contacts no provider and creates no database. Apply adds `--confirm TOKEN`, the SQLite idempotency ledger records the claim under the selected workspace, and a replay returns `status: skipped` with `reason: duplicate`. A provider failure releases the claim. Bing sitemap delete stays `WRITE_DISABLED`.
- **IndexNow from the sitemap.** `indexnow submit --from-sitemap [--sitemap-url ABS] [--url ABS …]` fetches and parses the sitemap read-only during the plan and resolves the host from `providers.bing.site`, the key from `providers.bing.indexnow_key` and the key location from `providers.bing.indexnow_key_location` or `https://<host>/<key>.txt`. A `<urlset>` is read directly; a `<sitemapindex>` is bounded to the root plus five child sitemaps and 10,000 URLs. URLs are deduplicated, explicit `--url` values are merged first, and off-host URLs are skipped. `meta.truncated`, `meta.total` and `meta.limitations` describe what was capped instead of claiming a complete inventory.
- **Sitemap-bound plan token.** Apply re-fetches the sitemap; if its URL set changed, the token is invalidated with `CONFIRM_REQUIRED` and nothing is submitted. A stable sitemap submits the refreshed merged list, capped at 10,000 URLs. A missing or mismatched key file is `INVALID_INPUT` with the exact key-file location, and a missing `providers.bing.indexnow_key` is `AUTH_REQUIRED` at plan time. IndexNow remains CLI/desktop-only: no thirteenth MCP tool is added.
- **MCP `seo_sitemap_submit`.** The tool keeps its name and the 12-tool surface. Inputs gain an optional `provider` (`gsc|bing`, default `gsc`), optional `property` and optional `sitemap_url`; for Bing the URL defaults to `<project.base_url>/sitemap.xml`. Bing apply calls the same `SeoService.submit_sitemap` path as the CLI. GSC submit and Bing delete still return `WRITE_DISABLED`.
- **Configuration and surface.** `[providers.bing]` gains the public `indexnow_key` and optional `indexnow_key_location`; the Bing Webmaster API key stays a secret and is never read from `seo.toml`. 22 top-level CLI commands (15 groups and 7 commands, no command added or removed), 12 MCP tools (10 read-class: 7 pure read-only plus 3 local-state writers; 2 gated writes), 3 resources and 3 prompts unchanged, schema version 4 and no migration. `schemas/tools.json` is regenerated because the `seo_sitemap_submit` inputs changed.

Verification recorded for this release:

| Check | Result |
|---|---|
| PyPI | `lv24-seo 0.9.0` published |
| npm | `@lv24/seo 0.9.0` published |
| MCP Registry | `io.github.LevapVeeskela/lv24-seo 0.9.0` published |
| CI | run `44038720401` green |
| Release workflow | run `44039013284` green |
| Desktop | `0.7.0` published with engine `0.9.0`; assets named `0.7.0` / `-0.7.0-` |
| Bing sitemap, configured workspace | plan → apply → `submitted` through the JSON `SubmitFeed` endpoint |
| IndexNow, configured workspace | plan returns `AUTH_REQUIRED` until the key and the hosted key file exist; nothing is submitted |

Known limits in 0.9.0:

- Bing sitemap submit needs a Bing Webmaster API key; without one the plan is `AUTH_REQUIRED` before any network call. Bing sitemap delete remains `WRITE_DISABLED`.
- IndexNow needs the public key and a live key file at `https://<host>/<key>.txt` or the configured location; a missing or mismatched key file fails with `INVALID_INPUT` and nothing is submitted.
- Sitemap discovery is bounded to the root plus five child sitemaps and 10,000 URLs; off-host URLs are skipped and the caps are reported through truncation and limitations.
- A plan token is bound to the sitemap URL set and expires after five minutes; a changed sitemap needs a fresh plan.
- GSC sitemap submit, Bing sitemap delete and Yandex recrawl remain `WRITE_DISABLED`; IndexNow has no MCP tool.
- The Bing Webmaster UI remains the authority for crawl issues and sitemap status; the API result says what Bing accepted, not how fast it recrawls.

## Desktop 0.7.0

Released on 2026-11-17. It adds the Bing indexing panel, opens the official Bing Site Scan page without
claiming a scan started, generates a per-session write secret, bundles `lv24-seo 0.9.0` and raises
`MIN_ENGINE_VERSION` to `0.9.0`, so an installed `0.8.x` engine is reported as incompatible.

What changed:

- **Bing sitemap submit.** The Integrations screen adds a sitemap submit card that builds `sitemap submit --provider bing --config <path> [--url <abs>] --allow-write [--confirm <token>] --json`. Planning sends the write opt-in but no token and only mints the plan; it does not call Bing. The card shows the action, target, summary, plan hash, TTL, payload details and limitations, and **Apply** sends the reviewed token. A missing key is `AUTH_REQUIRED` with a Settings hint.
- **IndexNow from the sitemap.** `indexnow_submit` builds `indexnow submit --from-sitemap --config <path> [--sitemap-url <abs>] --allow-write [--confirm <token>] --json`. The card reports the engine status and submitted URL count plus skipped or duplicate rows and the truncated flag. Host, key and key location come from `providers.bing.site`, `providers.bing.indexnow_key` and `providers.bing.indexnow_key_location`; a changed sitemap invalidates the plan token.
- **Bing Site Scan opener.** Bing has no public API for starting a Site Scan, so `open_bing_sitescan` only opens the hard-coded official page `https://www.bing.com/webmasters/sitescan?siteUrl=<percent-encoded>` in the default browser. The desktop does not start, poll or import a scan, and never reports that one started.
- **Per-session write secret.** At startup the shell draws 32 bytes from the OS CSPRNG, keeps the 64-character hex `LV24_SEO_WRITE_SECRET` only in Rust memory (zeroized on drop) and sets it on every engine child after `env_clear()`. It is never written to settings, argv, logs, diagnostics or the webview. Plan tokens are session-bound; a new session rejects an old token and the UI re-plans.
- **Engine 0.9.0 and contracts.** The sidecar adds Bing `SubmitFeed` with the idempotency ledger, one-click IndexNow from a bounded sitemap and the new Bing config keys. Contracts were regenerated from `lv24-seo 0.9.0`; the fixture envelopes change the version string and the `seo_sitemap_submit` input schema gains the optional `provider`. `MIN_ENGINE_VERSION` is `0.9.0` because a pre-`0.9.0` engine would answer the new commands with `CLI_INVALID_JSON`.

Verification recorded for this release:

| Check | Result |
|---|---|
| Published assets | 18 on `v0.7.0` for Windows x64, Linux x64 and macOS arm64/x64, including the Windows portable `.zip.sha256` |
| Updater manifest | `latest.json` reports `0.7.0` |
| CI | run `44041103066` green |
| Release workflow | run `44043493145` green |
| In-app update | `0.6.0 → 0.7.0` verified through the Rust updater on Windows NSIS: **Desktop 0.7.0**, **Engine 0.9.0** and engine ready |
| Workspace smoke test | a configured workspace loaded on the relaunched build without exposing query data |
| Bing sitemap submit | plan and apply from the Integrations card; the apply returned `duplicate` because the same sitemap had already been submitted from the CLI, so the ledger prevented a second provider call |
| IndexNow plan | `AUTH_REQUIRED` until `providers.bing.indexnow_key` and the hosted key file exist; no URL was submitted |
| Bing Site Scan opener | the official Bing page opened in the default browser; no API call was made and no scan was reported as started |
| Write secret | the shell generated `LV24_SEO_WRITE_SECRET` per session and passed it to every engine child; plan calls sent `allowWrite: true` |

Known limits in 0.7.0:

- The Bing Site Scan starts on the Bing page; the desktop only opens it and does not start, monitor, cancel or import a scan.
- IndexNow still needs a hosted key file, and a missing or mismatched file means nothing is submitted.
- Sitemap submit and IndexNow are provider network writes: they are not cancellable background runs, are not retried automatically and have no rollback. Review a fresh plan before retrying.
- Plan tokens are bound to the reviewed plan and the app session; a changed sitemap, a new session or an expired TTL requires a fresh plan.
- GSC sitemap submit/delete, Bing sitemap delete and Yandex recrawl remain `WRITE_DISABLED`.
- `MIN_ENGINE_VERSION` is `0.9.0`, so an `0.8.x` engine is rejected.
- Linux and macOS sidecar pins remain `null`; the release gate relies on rebuild-aware reports.

## Engine 0.8.0

Released on 2026-11-16. It adds the Core Web Vitals writer, Google Search Console service-account
authentication, richer Yandex Webmaster indicators, a non-destructive `backup restore --to`, a
scheduler lifecycle, and two provider fixes. The CLI now has 22 top-level commands; the MCP surface
stays at 12 tools and the SQLite schema stays at version 4.

What changed:

- **CWV writer.** `cwv collect --url ABS [--url ABS …] [--device phone|desktop|tablet|all] [--source crux|psi|both] [--limit 1..50]` is the writer behind the weekly `cwv` section. CrUX is queried per URL and device (`mobile` is an alias for `phone`) and every returned p75 becomes one `metric_daily` field row (`source=crux`, `scope`, `key=<absolute URL>`, `metric`, `value`, the fetch date in `report.timezone`, `accuracy=crux_field_28d`). PSI rows stay in `data.lab` and are never persisted, so a lab score cannot pollute the field series; every run with PSI reports `cwv_lab_ignored`, and PSI has no `tablet`, so `tablet` is skipped as `psi_tablet_unsupported`. CrUX is a 28-day rolling window, so `meta.data_age_days` is at least 2; a low-traffic URL is `low_traffic` and writes no row, never a zero. `--limit` caps URLs at 50 (default 10); `meta.total`, `meta.processed`, `meta.pairs_total`, `meta.pairs_processed` and `meta.calls` make the cap explicit, and a capped run sets `meta.truncated: true` with `cwv_url_cap`. CrUX needs a key (`AUTH_REQUIRED` before any call) and persistence needs a store (`CONFIG_INVALID`). `report weekly` and `seo_weekly_report` read stored CWV rows through today, so a collection appears in the same run.
- **GSC service accounts.** `providers.gsc.service_account_file` (absolute path) and `LV24_SEO_GSC_SERVICE_ACCOUNT_FILE` are read; the file wins over a stored `gsc_token`, and the environment wins over the file. A `gsc_token` that is a service-account JSON object (`type: service_account` plus `private_key`) is also accepted. The adapter signs an RS256 JWT (`iss`, `scope=webmasters.readonly`, `aud`, `iat`, `exp`), exchanges it at the key's `token_uri` with the JWT-bearer grant and refreshes it 60 seconds before expiry; a plain token keeps the historical `Authorization: Bearer` behaviour and is not refreshed. `properties` reports `token_source: service_account_file|secret|missing` and marks GSC ready; `doctor` adds a non-fatal `gsc_auth` check. Neither prints the JSON or the private key, and `auth status` still inspects only keychain, environment and file secrets. A relative, missing, unreadable or invalid file is `CONFIG_INVALID`; a rejected exchange is `AUTH_INVALID` and never echoes the body. `cryptography>=43` (Apache-2.0 OR BSD-3-Clause) is now required.
- **Richer Yandex indicators.** `yandex queries` and `yandex_query_performance` expose `avg_click_position` next to shows, clicks and position, return `query_id` when the provider sends it, and keep an unmapped indicator under `extra_indicators` instead of dropping the row; the legacy list form of `indicators` is still accepted. `yandex indexing` and `yandex_indexing_state` merge the `indexing/history` series (`HTTP_2XX` … `OTHER`, either case) into one row per date (`http_2xx` … `other`); an omitted series stays absent and unknown series are kept in `extra_indicators`. `summary.site_problems` carries severity → count next to the existing counters, and an omitted counter stays absent rather than becoming `0`.
- **Non-destructive restore.** `backup restore --file ABS --to ABS_DIR` unpacks an archive into a new directory and never touches the current workspace. The archive is re-validated exactly like the in-place plan (manifest, member set and names, sizes, every SHA-256). The target must be an absolute path that does not exist with an existing parent; an existing, non-empty or symlinked target is `INVALID_INPUT` and is never merged or overwritten. Absolute paths, `..`, backslashes and symlinks inside the archive are refused before extraction, the database passes `PRAGMA quick_check` before and after it is moved into place, and the staging directory is removed. An archive without a database yields a config-only directory with `database.in_archive: false` and an explicit warning; no empty database is invented. No `--allow-write` and no token are involved; passing either with `--to`, or `--to` with `--config`, is `INVALID_INPUT`. The two-phase in-place restore is unchanged.
- **Scheduler lifecycle.** `schedule install` is plan-only by default: it prints the cron block, the systemd user units or the Task Scheduler XML plus the command it would run, with `dry_run: true` and `installed: false`. Nothing is written until `--allow-write`; `--print` remains an alias for the default and wins over `--allow-write`. Generated jobs embed the absolute `--config` path and run from the config directory. `schedule status` is read-only and reports `installed|outdated|partial|missing|unknown` plus the expected paths and per-artefact `exists`/`matches`; `unknown` means the host scheduler could not be inspected and `matches` is then `null`. `schedule uninstall` is plan-only by default and with `--allow-write` removes exactly its own managed cron block, the two `<job>.service`/`<job>.timer` units or the named task; a second run is a no-op (`removed: false`, `state: missing`) and unrelated lines and tasks are never touched. A cron block that lost its end marker is repaired conservatively and the envelope warns.
- **Fixes.** Yandex Metrika `stat/v1/data` now sends the documented 1-based `offset`; the previous `0` was rejected with HTTP 400 on every call, which made the Metrika card look configured but empty. Pagination advances by the rows already returned. CLI `--json` output is ASCII-escaped, and human output degrades unencodable glyphs instead of aborting, so a completed report redirected on a legacy Windows code page (cp1251/cp866) no longer fails with `UnicodeEncodeError` while printing a warning.
- **Surface and schema.** 22 top-level CLI commands (15 groups and 7 commands, adding `cwv`), 12 MCP tools (10 read-class: 7 pure read-only plus 3 local-state writers; 2 gated writes still return `WRITE_DISABLED`), 3 resources and 3 prompts unchanged. The schema stays at version 4 and no migration is applied; `schemas/tools.json` is unchanged. Portfolio and restore remain CLI-only, and `schedule status`/`uninstall` have no desktop screen yet.

Verification recorded for this release:

| Check | Result |
|---|---|
| PyPI | `lv24-seo 0.8.0` published |
| npm | `@lv24/seo 0.8.0` published |
| MCP Registry | `io.github.LevapVeeskela/lv24-seo 0.8.0` published |
| CI matrix | run `43962847574` green on Ubuntu, Windows and macOS |
| Release workflow | run `43964671274` green |
| Desktop | `0.6.0` published with engine `0.8.0`; assets named `0.6.0` / `-0.6.0-` |

Known limits in 0.8.0:

- `cwv collect` needs a CrUX API key and a local store; without the key it is `AUTH_REQUIRED` before any network call, and PSI alone cannot populate the weekly `cwv` section.
- PSI is lab data and is never stored; `tablet` is skipped because PSI has no such form factor.
- The CWV fetch date uses `report.timezone`, not UTC, so a collection near midnight can land on a different date than a UTC-based consumer expects.
- `schedule status` is file-level: it compares the generated artefacts with the current spec and does not ask the host scheduler whether a job is enabled, last ran or succeeded. On Windows a task edited outside `schedule install` may still show as `outdated`.
- `backup restore --to` extracts files and never merges rows or settings; tokens are not in the archive, so re-authenticate afterwards.
- Yandex indicator coverage follows what the provider returns; a missing indicator stays absent (`null`), and `extra_indicators` is not a stable schema across API versions.

## Desktop 0.6.0

Released on 2026-11-16. It adds cancellable background runs, sends the scheduler write opt-in only
after confirmation, bundles `lv24-seo 0.8.0` and raises `MIN_ENGINE_VERSION` to `0.8.0`, so an
installed `0.7.x` engine is reported as incompatible.

What changed:

- **Cancellable background runs.** `crawl`, `report_weekly`, `logs_analyze`, `backup_create`, `backup_restore` and `schedule_install` accept a stable run id from the webview. The Rust runner registers `run id → exact child PID` before the spawn; a run id for any other command is `RUN_NOT_CANCELLABLE`, so short reads keep their synchronous path. The run lives in one root `RunStore`, not on a page: the app layout shows a persistent banner with kind, elapsed time, status and **Cancel**, leaving the route does not clear it, every active run is listed, and the newest cancelled run stays until dismissed. `run_cancel(runId)` signals only the exact registered child (and its process group on Unix) after checking it is still an engine image or a tracked child; it never matches by name. An unknown or finished run returns `false`, and the UI does not claim a cancellation then. A cancelled run returns `RUN_CANCELLED`, shown separately from succeeded and failed runs.
- **Schedule install sends the opt-in.** Engine `0.8.0` made `schedule install` plan-only by default; the desktop asks for confirmation and appends `--allow-write` only after the user confirms the plan it showed. The shell still refuses an install without `allowWrite=true` with `CONFIRM_REQUIRED` before spawning the engine, so the webview cannot bypass the new default. A plan-only preview and the print-only artifact remain available, and an install is cancellable like the other long jobs.
- **Engine 0.8.0.** The sidecar adds GSC service accounts, the `cwv collect` writer, `backup restore --to`, `schedule status`/`uninstall`, richer Yandex indicators, the Metrika 1-based offset fix and the Windows JSON output fix. `properties` gains `token_source` and `doctor` gains `gsc_auth`. `MIN_ENGINE_VERSION` is `0.8.0` because the mandatory `schedule install --allow-write` opt-in needs it; restore, portfolio and CWV already required `0.7.0`.
- **Shell and contracts.** Contracts were regenerated from `lv24-seo 0.8.0`; the additive changes are the `gsc_auth` check, `properties.token_source` and `providers.gsc.service_account_file` in `config.schema.json`. The contract generator pins `PYTHON_KEYRING_BACKEND` to the null backend so a developer machine with real provider tokens cannot leak token presence into the fixtures. The desktop adds no screens for `schedule status`/`uninstall` or `cwv collect` yet.

Verification recorded for this release:

| Check | Result |
|---|---|
| Published assets | 18 on `v0.6.0` for Windows x64, Linux x64 and macOS arm64/x64, including the Windows portable `.zip.sha256` |
| Updater manifest | `latest.json` reports `0.6.0` |
| CI | run `43966588931` green |
| Release workflow | run `43969832204` green |
| In-app update | `0.5.0 → 0.6.0` verified through the Rust updater on Windows NSIS: **Desktop 0.6.0**, **Engine 0.8.0** and engine ready |
| Workspace smoke test | a real workspace loaded with the bundled engine; provider readiness and coverage were checked without exposing query data |
| Sidecars | Windows x64 pinned from PyPI `0.8.0` (`sha256 5fb932c8…`, 14,365,502 bytes); Linux and macOS rebuilt with passing rebuild-aware reports |

Known limits in 0.6.0:

- Cancel is not rollback and there is no job queue. A cancelled run may leave a partial report, crawl, backup or scheduler artefact; a cancelled in-place restore keeps the pre-restore copy but may have replaced one file, so build a fresh plan before retrying.
- Schedule install mutates the host only after confirmation and only on this computer. The desktop does not manage, repair or uninstall the job; use `schedule status`/`schedule uninstall` in the CLI.
- Restore replaces the database and config and never merges; tokens are excluded, so re-authenticate. `backup restore --to` is CLI-only.
- GSC service accounts are configured outside the form: the desktop has no `service_account_file` field; set it in `seo.toml` or the environment.
- The CWV card is empty without stored field rows; `cwv collect` is a CLI command and at most five templates are shown.
- `MIN_ENGINE_VERSION` is `0.8.0`, so a `0.7.x` engine is rejected.
- Linux and macOS sidecar pins remain `null`; the release gate relies on rebuild-aware reports.

## Engine 0.7.0

Released on 2026-11-16. It adds a two-phase project restore, a read-only multi-site portfolio, Core Web Vitals
grouped by URL template and device, and schema v4 with persisted indexing events. The CLI now has 21 top-level
commands, and the MCP surface stays at 12 tools.

What changed:

- **Two-phase restore.** `backup restore --file ABS --config ABS` validates the archive and returns a plan with the
  archive and manifest hashes, the target config and data directory, the current and archived database hashes, the
  config action (`create`, `replace` or `write_alongside`) and a `confirm_token` valid for 300 seconds. Applying
  needs `--allow-write` and the token; `--allow-write` alone only plans, a token without it is `WRITE_DISABLED`, and
  a changed archive, changed workspace, expired token or replay is `CONFIRM_REQUIRED`. Before replacement the
  current database is copied to `<db>.pre-restore-<utc>` (and the config to `seo.toml.pre-restore-<utc>` when it is
  replaced), every member hash is re-verified, the restored database passes `PRAGMA quick_check` and files are
  replaced atomically. A config that does not validate is written alongside as `seo.toml.restored-<utc>`.
- **Multi-site portfolio.** `portfolio list --root ABS [--limit 1..50]` scans up to three levels below an absolute
  directory for `seo.toml`, skipping hidden, `node_modules`, `__pycache__`, `venv` and symlinked directories, and
  returns one row per site: config path, name, property, base URL, data directory, database presence, crawl runs,
  report snapshots, issue counts and last activity. It opens no provider, reads no token and writes nothing. A
  broken config or unreadable database becomes that site's `error` while the rest still scans; the scan is capped
  at 50 sites and reports the real total with `truncated: true`.
- **Schema v4 and indexing events.** Migration v4 adds `indexing_events`, keyed by
  `(provider, property_id, url, event, event_date)`. `yandex indexing` and the MCP `yandex_indexing_state` call
  persist per-URL events whenever a store exists: a replay updates `last_seen` without duplicating, `first_seen` is
  immutable, `meta.indexing_events` reports `new`, `existing`, `skipped` and `truncated`, and storage failures
  become warnings rather than a failed provider read. The weekly digest now reads these events, so `indexing_event`
  evidence no longer depends on a caller supplying rows.
- **Core Web Vitals by template.** When the store holds CrUX/PSI field rows for the compared windows,
  `report weekly` and `seo_weekly_report` add a `cwv` section grouped by normalized URL template (`/blog/{id}`) and
  device (`phone`, `desktop`, `tablet`). It shows at most five templates, regressed first, with per-metric p75,
  previous p75, delta, a regression flag and `poor_metrics`. A regression is a p75 increase of at least 5% (above
  0.01 for CLS), and a template p75 is the worst page p75 in the group, not a site-wide average. Origin aggregates,
  lab/PSI scores and rows without a URL or known device are never merged; they are reported through
  `cwv_template_missing`, `cwv_device_missing`, `cwv_lab_ignored` and `cwv_values_ignored`.
- **Surface and schema.** 21 top-level CLI commands (14 groups and 7 commands, adding `portfolio` and
  `backup restore`), 12 MCP tools (10 read-class: 7 pure read-only plus 3 local-state writers; 2 gated writes still return
  `WRITE_DISABLED`; 3 tools persist local state), 3 resources and 3 prompts unchanged. Schema version is 4; the
  migration is additive and runs on the next open. `yandex_indexing_state` now carries `writes_local_state: true`
  and `readOnlyHint: false`. Portfolio and restore are CLI-only.

Verification recorded for this release:

| Check | Result |
|---|---|
| PyPI | `lv24-seo 0.7.0` published |
| npm | `@lv24/seo 0.7.0` published |
| MCP Registry | `io.github.LevapVeeskela/lv24-seo 0.7.0` published |
| CI | Green on Linux, Windows and macOS on the release commit |

Known limits in 0.7.0:

- `portfolio list` reports local history only; it never calls a provider, so remote index status and traffic are
  absent for a site whose local store is empty.
- The portfolio scan is capped at 50 sites per run; larger agencies must scan narrower roots.
- `backup restore` replaces files and never merges rows or settings. Tokens are excluded, so re-authenticate
  afterwards; a database held open by another CLI or desktop process cannot be replaced on Windows.
- The restore token prevents accidental or stale applies; it is not access control.
- Indexing events come only from Yandex Webmaster indexing calls; rows without a URL, event name or event date are
  skipped, and each call considers at most 500 provider rows.
- The CWV section needs stored CrUX/PSI field rows and shows at most five templates. CWV and portfolio data are not
  attributed in the change digest.

## Desktop 0.5.0

Released on 2026-11-16. It adds a restore flow to the Backup page, a confirmed schedule install, a Portfolio page
and the CWV card, bundles `lv24-seo 0.7.0` and raises `MIN_ENGINE_VERSION` to `0.7.0`, so a `0.6.x` engine is
reported as incompatible.

What changed:

- **Restore UI.** The backup panel adds a restore section. The archive is chosen through the native
  `pick_backup_archive` dialog; the first call only builds a plan, and **Restore now** stays disabled until a token
  exists. Applying shows a confirmation dialog and calls the engine with `--allow-write` and the plan token. The
  plan shows the archive and manifest hashes, the target config and data directory, the current and archived
  database hashes, the config action and the token lifetime.
- **Schedule install.** The Integrations schedule card has **Preview artifact** and **Install on this host**. An
  install writes a cron entry, systemd user timer or Windows Task Scheduler task for a weekly or daily report after
  a confirmation dialog that names the config and the job kind; it touches only the local host.
- **Portfolio page.** Choose a folder through the native directory dialog; the engine scans up to three levels for
  `seo.toml` and inspects at most 50 sites. Summary counts, sorting by open issues, name, last activity or errors
  first, and filtering by name, property or path. Opening a row switches the workspace through the normal shell
  flow. The scan is read-only: no provider call, no token read, no write.
- **CWV card.** The weekly report renders the engine's `cwv` section per template and device with previous p75,
  delta and regression flag, plus truncation, the oldest evidence date, skipped rows and the engine's limitations.
- **Shell and engine.** New allow-listed commands `backup_restore`, `portfolio_list` and `schedule_install`, all
  argument-validated in the shell; `pick_backup_archive` is new, and `pick_directory` also approves the portfolio
  root and the backup output folder. Contracts were regenerated from `lv24-seo 0.7.0`.

Verification recorded for this release:

| Check | Result |
|---|---|
| Published assets | 18 on `v0.5.0`, including the Windows portable `.zip.sha256` |
| CI | Green for Linux x64, Windows x64 and macOS arm64 + x64 on the release commit |
| In-app update | `0.4.0 → 0.5.0` verified through the Rust updater on Windows NSIS: **Desktop 0.5.0**, **Engine 0.7.0** and engine ready |
| Sidecars | Windows x64 pinned from PyPI `0.7.0`; Linux and macOS rebuilt with passing rebuild-aware reports |

Known limits in 0.5.0:

- Restore replaces the database and config; it never merges, and the pre-restore copies are the only rollback.
- Schedule install mutates the host; removing or repairing the job is manual.
- The CWV card is empty without CrUX/PSI field rows that carry a URL and a device.
- Portfolio reports local history only and inspects at most 50 sites per scan.
- No cancel and no background runs: a restore, schedule install, portfolio scan or report build runs to completion.
- `MIN_ENGINE_VERSION` is `0.7.0`, so a `0.6.x` engine is rejected.

## Engine 0.6.0

Released on 2026-11-16. It adds local nginx log analysis, an attributed change digest in the weekly report, a finding/task
lifecycle with schema v3, a portable project backup and the twelfth MCP tool. The CLI now has 20 top-level commands.

What changed:

- **Log analysis.** `logs analyze --file ABS [--bot …]` reads exactly one local nginx JSON access log of at most 100 MiB
  and returns `bot_daily` rows (hits, bytes, p95 request time per date, bot and status class) plus a `crawl_waste`
  summary with the by-bot split. Redirects, errors, assets, `/api/` calls and tracking-parameter requests count as waste,
  each request once. The path must be absolute and a regular file; globs, UNC/device paths and larger files fail with
  `INVALID_INPUT` before anything is read. The file is opened read-only once and nothing is uploaded or stored.
- **12th MCP tool.** `seo_log_analysis(file, bot="")` is read-only (`readOnlyHint: true`, `writes_local_state: false`),
  needs no service, store or workspace, and returns the same `data`, `meta` and `warnings` as the CLI.
- **Attributed change digest.** When the two GSC windows are comparable and the store holds crawl issues or pages, the
  weekly report adds an `Attributed change digest` section: each material change gets a candidate cause
  (`new_crawl_issue`, `resolved_crawl_issue`, `indexing_event`, `page_state`, `unexplained`), a confidence, up to three
  evidence rows and a `next_action`. With no matching evidence the item stays `unexplained` with a limitation; items are
  capped at 8 and evidence at 3 per item.
- **Task lifecycle (schema v3).** `tasks list`, `tasks add` and `tasks update` manage findings keyed by
  `(kind, property_id, url, rule_id)` with states `open`, `in_progress`, `verified` and `dismissed`. `add` is idempotent
  and reports `created`, `existing` or `reopened`; a verified finding observed again reopens, a dismissed one stays
  dismissed. Only the documented transitions are accepted, `list` is newest-first and bounded (1–1000, default 200), and
  `--payload` rejects credential-shaped keys. The migration is additive.
- **Portable backup.** `backup create --out ABS [--force]` writes `lv24-seo-backup-YYYYMMDDTHHMMSSZ.zip` with
  `manifest.json` (sizes and SHA-256 per member), a redacted `seo.toml` with `storage.data_dir` reset to `./data`, and a
  consistent `data/seo.sqlite3` copy made through the SQLite backup API. Secrets, tokens, logs and caches are never
  included; the source is read-only and the archive is written atomically. Restore is not implemented.
- **Surface and schema.** 20 top-level CLI commands (13 groups and 7 commands), 12 MCP tools (10 read-class, including
  `seo_log_analysis`, plus 2 gated writes that still return `WRITE_DISABLED`), 3 resources and 3 prompts unchanged.
  Schema version is 3; `ReportSection` gained optional `total`, `truncated` and `data_age` fields, and a concurrent first
  open retries the WAL switch instead of failing on `SQLITE_BUSY`.

Verification recorded for this release:

| Check | Result |
|---|---|
| PyPI | `lv24-seo 0.6.0` published |
| npm | `@lv24/seo 0.6.0` published |
| MCP Registry | `io.github.LevapVeeskela/lv24-seo 0.6.0` published |
| CI | Green on Linux, Windows and macOS |

Known limits in 0.6.0:

- Bot detection is User-Agent only: a spoofed UA is not a verified crawler and non-search crawlers are `other`.
- Log analysis accepts one file of at most 100 MiB; there is no rotation, glob, remote fetch or persisted log history.
- `backup create` has no restore command; the manifest is the contract for a manual restore, and tokens are excluded.
- Tasks are CLI-only; no MCP tool or report section consumes them yet.
- The digest explains GSC headline deltas only; Yandex, Metrika, Bing, CrUX and PSI are not attributed, and indexing
  events appear only when a caller supplies them.

## Desktop 0.4.0

Released on 2026-11-16. It adds Logs, Tasks and Backup pages and the report digest card, bundles `lv24-seo 0.6.0` and
raises `MIN_ENGINE_VERSION` to `0.6.0`, so a `0.5.x` engine is reported as incompatible.

What changed:

- **Logs page.** A native `pick_log_file` dialog selects one nginx JSON access log (at most 100 MiB); the shell rejects a
  path that did not come from the dialog or the app's own data/export directories with `PATH_NOT_APPROVED`. The page shows
  a bot filter, parse summary (total, parsed, skipped), crawl waste with the by-bot split, a bot rollup table and JSON/CSV
  export. Bots are User-Agent only and the page labels the result as triage.
- **Tasks page.** Newest-first tasks with property, kind, state, rule, URL, timestamps and stored evidence; filters and a
  row limit up to 500. State changes follow the allowed transitions, an invalid move is refused with the allowed set, and
  the add form is idempotent with a 16 KiB evidence cap and credential-shaped keys rejected.
- **Backup page.** `backup create` writes the archive into the app export folder or a folder chosen in the native
  directory dialog; the panel shows the path, size, SHA-256, database inclusion, property and snapshot counts, the member
  table and the engine's limitations. Restore is not implemented and the panel says so.
- **Digest card.** The weekly report renders the engine's attributed change digest with cause, confidence, up to three
  evidence rows and the next action, plus `showing N of M`, the oldest evidence date and skipped rows.
- **Shell and engine.** New allow-listed commands `logs_analyze`, `tasks_list`, `tasks_add`, `tasks_update` and
  `backup_create`, all argument-validated in the shell; `pick_directory` now also approves the backup output folder.
  Contracts were regenerated from `lv24-seo 0.6.0`.

Verification recorded for this release:

| Check | Result |
|---|---|
| Published assets | 18 on `v0.4.0`, including the Windows portable `.zip.sha256` |
| CI | Green for Linux x64, Windows x64 and macOS arm64 + x64 on the release commit |
| In-app update | `0.3.0 → 0.4.0` verified through the Rust updater on Windows NSIS: **Desktop 0.4.0**, **Engine 0.6.0** and engine ready |

Known limits in 0.4.0:

- Backup restore is not implemented; unpack the archive manually and keep the source workspace until verified.
- Bot triage is User-Agent only; there is no reverse-DNS or published-IP check.
- No cancel and no background runs: a crawl, log analysis, report build, task refresh or backup runs to completion.
- One log file at a time, at most 100 MiB; no rotation or persisted log history.
- The digest is evidence-based triage, not causal proof.

## Engine 0.5.3

Released on 2026-11-16. It makes agent writes two-phase, moves the crawl off the MCP event loop, adds a CI-facing
`--strict` exit code, and replaces generic storage failures with typed codes. No schema migration and no new CLI command
or MCP tool: the surface stays at eleven tools, and the changes are inputs, exit codes and error codes.

What changed:

- **Two-phase MCP writes.** `seo_recrawl_request` and `seo_sitemap_submit` take `allow_write` (default `false`), `plan_hash` and
  `confirm_token`. A call without a token is a dry run that returns the plan, its hash and a 300-second token; an apply must echo
  the hash and token. A mismatched hash fails with `CONFIRM_REQUIRED`, a replay returns `status: skipped` with
  `reason: duplicate`, and a provider failure releases the claim so a retry is allowed. `LV24_SEO_WRITE_SECRET` is required;
  an empty secret is `WRITE_DISABLED`. The shipped `SeoService` still has no recrawl or sitemap write adapter, so both tools
  return `WRITE_DISABLED` even with `allow_write=true` — the contract is in place, the provider call is not.
- **Crawl off the event loop.** `seo_crawl_site` runs on a worker thread with its own short-lived store and a hard 600-second
  budget. After the budget the client gets a retryable `UPSTREAM_UNAVAILABLE` naming a smaller `max_urls`; the worker finishes in
  the background and the server keeps answering other tools. Every other tool stays serialized on the owner loop.
- **`--strict` and exit 5.** `stats`, `gsc query`, `yandex queries`, `yandex indexing`, `crawl`, `report weekly` and `report diff`
  accept `--strict`. `meta.strict` is always set; a truncated response stays `ok: true` but exits `5`, and `meta.limitations`
  explains what is missing. Without the flag, truncation still exits `0`. `report diff --markdown` honours the same code.
- **The write ledger follows `--config`.** A write apply opens the idempotency ledger from the selected workspace data directory,
  so `--config /srv/site/seo.toml` records the claim under `/srv/site/data` even when the shell is elsewhere. Previously the ledger
  was resolved from the working directory, which silently disabled replay protection.
- **Typed storage errors.** `STORE_LOCKED` (retryable), `STORE_CORRUPT` (with `detail.backup_path`) and `STORE_UNAVAILABLE`
  replace the generic `INTERNAL` envelope. A corrupt file is copied next to itself before anything else happens; the original is
  never moved or deleted. The three codes exit `1`, like `INTERNAL`.
- **Honest provider data.** A capped GSC result omits `total` instead of pairing an exact count with `truncated: true`, and
  `data_age_days` is floored at the documented 3-day lag. Metrika `limit` is a page size: the client walks `offset` up to 10,000
  rows and 100 pages, marks a full page with no `total_rows` as truncated, and never pages an aggregate call. Bing derives
  `data_age_days` from the newest row date instead of a hardcoded zero. A loaded Yandex host with an empty history returns
  `total: 0` with `empty_history` instead of `degraded_host`, and a bare Webmaster `count` is no longer mistaken for a grand total.
- **Sitemap scope.** A `<loc>` outside the sitemap's own origins (seed origin plus the final origin of each document read) is
  dropped and reported once as `off_origin_loc`, so an index can never walk a reader to another site.
- **`doctor` treats a declared data directory as fatal.** When the config file or `LV24_SEO_DATA_DIR` names a directory, a missing
  or unusable one fails the check; `meta.data_dir_declared` reports which case applies.
- **Smaller fixes.** A crontab with an unterminated managed block is repaired conservatively: only lines that look like lv24-seo
  entries are removed, and a warning asks the operator to review `crontab -l`. A crawl honours one `429` `Retry-After` instead of
  treating a throttle as a page answer.

Verification recorded for this release:

| Check | Result |
|---|---|
| PyPI | `lv24-seo 0.5.3` wheel and sdist published |
| npm | `@lv24/seo 0.5.3` published with the `latest` tag |
| MCP Registry | `io.github.LevapVeeskela/lv24-seo 0.5.3` published |
| Release workflow | Green on the tagged commit: verify, build, PyPI, npm and MCP Registry jobs |
| Tests | 1,205 offline tests passed, including the installed-wheel CLI envelope contract; Ubuntu, Windows and macOS CI passed |

Known limits in 0.5.3:

- The engine service still exposes no recrawl or sitemap write handler: CLI applies and every MCP write call return
  `WRITE_DISABLED` and nothing is sent. Only IndexNow reaches a provider.
- Metrika walks stop at 10,000 rows and 100 pages per call; a larger table is truncated and says so.
- Bing reports `data_age_days: 0` for an empty or undated feed; that is not evidence of freshness.
- `STORE_LOCKED`, `STORE_CORRUPT` and `STORE_UNAVAILABLE` have no dedicated CLI exit code; they exit `1` and must be read
  from `error.code`.
- `--strict` is not available on write commands; a dry run exits `0` when the plan is valid.
- `doctor` treats an unusable declared data directory as fatal, so a deliberately absent directory now fails the check
  instead of warning.

## Desktop 0.3.0

Released on 2026-11-16. It turns the shell into a working surface for the whole workflow: onboarding without a
terminal, a crawl screen, report comparison and export, a safer settings save flow, integration snippets and an
honest run status. It bundles `lv24-seo 0.5.3` (unchanged from `0.2.3`) and keeps `MIN_ENGINE_VERSION` at `0.5.2`.

What changed:

- **Onboarding without the terminal.** A three-step project wizard (folder, site, review) runs `lv24-seo init`
  through the shell, shows the exact config and data paths before creating anything, and offers **Open existing
  seo.toml** instead of overwriting a folder that already has one. `knownConfigs` in `settings.json` remembers up to
  20 canonical config paths so a previous workspace can be re-activated after a restart; the shell still validates
  them, so the list is a convenience, not a permission bypass. A header site chip opens up to 8 recent workspaces
  and marks a moved or deleted config as missing.
- **Properties panel.** The dashboard renders `lv24-seo properties`: configured providers, their target and token
  presence (`present`, `missing`, `not required`, `unknown`) with a link to the matching settings section.
- **Crawl screen.** A bounded `lv24-seo crawl --json` run with summary counters, a truncated badge, engine warnings
  and limitations; issue filters for severity, rule and free-text search with facets from the result; a table capped
  at 500 rendered rows while the JSON and CSV export contains every returned row. Switching workspace resets the
  screen.
- **Report comparison and export.** Compares the two newest stored weekly snapshots without calling a provider:
  headline deltas, issues added/resolved/unchanged, opportunities and limitations added or lifted, with a
  **not comparable** label instead of a silent diff. JSON uses the documented `lv24-seo.report/v1` payload; CSV is
  flat (`section,metric,value,delta`). The HTML report is unchanged.
- **Settings save workflow.** A sticky save bar with dirty state, changed-field count, validation errors and
  warnings, and the last backup; **Ctrl+S / Cmd+S** saves from anywhere; **Only changed** filters the form to fields
  that differ from `seo.toml`. An app-wide draft guard asks before discarding unsaved edits when leaving Settings,
  switching workspace, reloading or closing the window, and says so if it cannot install the close guard.
- **Recommendations.** Search across title, action, query and page; sort by report order or severity; bulk **Queue
  all visible** and **Export all visible**, with partial-export counts stated instead of silently ignored.
- **Integrations.** MCP snippets for Claude Desktop, OpenCode, VS Code and Cursor in JSON, plus a TOML form for
  TOML-based hosts such as Codex CLI; snippets contain no tokens. Scheduled runs are **print-only**: the screen
  renders the `lv24-seo schedule print` artifact and never installs a cron entry, unit or task.
- **Reporting window and run status.** A per-workspace window of 7, 28 or 90 days and a provider lag of 2 or 3 days,
  saved per `seo.toml` path, shared by stats and the weekly report. Runs show live elapsed time, the last duration and
  timestamp, truncation and limitation badges, and an explicit note that `0.3.0` has no cancel button.
- **Shell and security.** New allow-listed commands `init`, `schedule_print` (active config only) and
  `pick_directory` (a native dialog whose result is approved for `init`), persisted and validated `knownConfigs`,
  and a `core:window:allow-destroy` capability used only by the confirmed-discard close path.

Verification recorded for this release:

| Check | Result |
|---|---|
| Published assets | 18 on `v0.3.0`, including the Windows portable `.zip.sha256` |
| CI | Green for Linux x64, Windows x64 and macOS arm64 + x64 on the release commit |
| In-app update | `0.2.3 → 0.3.0` verified through the new Rust updater on Windows NSIS: **Desktop 0.3.0**, **Engine 0.5.3** and engine ready |
| Engine | `lv24-seo 0.5.3` unchanged; the contracts and the reviewed Windows sidecar pin are the same as `0.2.3` |

Known limits in 0.3.0:

- No cancel and no background runs: a crawl, report build or stats refresh runs to completion, and leaving the screen
  does not move it to a queue.
- Scheduled runs are print-only; no scheduler job is installed and no MCP client config is edited.
- The desktop performs no provider write.
- Config-path approval is per process plus the persisted `knownConfigs` list; a path outside both still needs the
  native dialog.
- Windows ACL hardening is best effort, and OS packages remain unsigned or ad-hoc signed.

## Desktop 0.2.3

Released on 2026-11-16. It moves the update download into Rust, makes the config path a dialog-approved capability, rejects
network paths before they are opened, and fixes UI state that could misreport a save or a workspace. It bundles
`lv24-seo 0.5.3` and keeps `MIN_ENGINE_VERSION` at `0.5.2`, so an installed `0.5.2` engine is still accepted.

What changed:

- **Updater moved into Rust.** The webview capability list contains `updater:allow-check` only. `update_install` re-checks the
  endpoint, refuses a version that differs from the one the panel announced (`UPDATE_VERSION_MISMATCH`), downloads, verifies the
  signature and starts the installer; progress arrives as `update://progress`. `update_cancel` drops the download before the
  installer starts and returns `UPDATE_CANCELLED`; once installation has begun the panel stays as it is instead of claiming a
  cancellation that did not happen.
- **Dialog-approved config path.** `pick_config` records the file the native dialog returned; `settings_set` accepts only the active
  path or an approved one and rejects anything else with `PATH_NOT_APPROVED`. A UNC share, `\\?\` device or `\\.\` device in
  `storage.data_dir` is rejected with `INVALID_PATH` and `detail.reason: network_or_device_path` before it is resolved.
- **Redaction and timeouts.** Engine stderr is redacted before it reaches the webview, a log or a diagnostics bundle, and redaction
  runs before the 300-character preview is truncated. A TOML parser error is redacted too. A helper task over its budget fails with
  `PATH_TIMEOUT` instead of hanging the screen.
- **Workspace and UI state.** `shell_status` reports `configExists`; a moved or deleted config shows a workspace-missing banner with
  **Choose config** instead of a generic stats error. Provider blocks have an explicit enable toggle that is the only writer of
  `providers.<id>.present`. Validation is tri-state (`valid`, `invalid`, `skipped`), so a double click or a workspace switch no
  longer reports a valid draft as invalid. The skip link keeps the hash route intact, and a route-level error boundary contains a
  render failure and offers a reload.
- **Release pipeline.** Pull-request CI runs the release-script tests; the Rust matrix includes the Intel macOS runner the release
  uses; Rust is pinned to `1.95.0`. `latest.json` is validated against `contracts/latest.schema.json` before the draft is created.
  One tested allowlist drives the checksum file and the upload list, and the Windows portable ZIP ships with a `.sha256` sidecar that
  the release gate recomputes and compares.

### Desktop 0.2.3 assets

`0.2.3` publishes 18 assets: the installers, the signed updater packages, the Windows portable ZIP and its `.sha256`
sidecar, `latest.json` and `SHA256SUMS.txt`.

| Asset | Platform | Purpose |
|---|---|---|
| `LV24.SEO.Optimizer_0.2.3_x64-setup.exe` + `.exe.sig` | Windows x64 | NSIS per-user installer; signed updater package |
| `LV24-SEO-Optimizer_0.2.3_x64-portable.zip` + `.zip.sha256` | Windows x64 | Portable build; manual-only, checksum verified by the release gate |
| `LV24.SEO.Optimizer_0.2.3_aarch64.dmg` | macOS Apple silicon | First install |
| `LV24.SEO.Optimizer_0.2.3_x64.dmg` | macOS Intel | First install |
| `LV24.SEO.Optimizer_0.2.3_aarch64.app.tar.gz` + `.sig` | macOS Apple silicon | Signed updater package |
| `LV24.SEO.Optimizer_0.2.3_x64.app.tar.gz` + `.sig` | macOS Intel | Signed updater package |
| `LV24.SEO.Optimizer_0.2.3_amd64.AppImage` + `.AppImage.sig` | Linux x64 | AppImage; signed updater package |
| `LV24.SEO.Optimizer_0.2.3_amd64.deb`, `LV24.SEO.Optimizer-0.2.3-1.x86_64.rpm` | Linux x64 | Package-manager installs; manual-only |
| `latest.json` | All | Signed updater manifest |
| `SHA256SUMS.txt` | All | SHA-256 for every published asset |

### Desktop 0.2.3 verification

| Check | Result |
|---|---|
| Published assets | 18 on `v0.2.3`, including the Windows portable `.zip.sha256` recomputed against the archive; `SHA256SUMS.txt` covers every published asset |
| CI | Green for Linux x64, Windows x64 and macOS arm64 + x64 on the release commit |
| In-app update | `0.2.2 → 0.2.3` verified end-to-end on Windows NSIS: download, signature verification, passive install and relaunch; the UI reports **Desktop 0.2.3**, **Engine 0.5.3** and engine ready |
| Sidecars | Linux and macOS sidecars rebuilt by the release workflow with passing rebuild-aware checksum reports; Windows x64 pinned from PyPI `0.5.3` (`sha256 24b51f43…`, 14,175,608 bytes) |

## Engine 0.5.2

This is a bugfix release for the 0.5.x line. It closes blockers found after 0.5.1: a relative
`storage.data_dir` in `seo.toml` followed the shell's working directory, the CLI built its write
gate without the idempotency ledger, sitemap fetch errors echoed URLs that can carry query tokens,
and GSC claimed complete data when the final page exactly filled the row cap.

No schema migration and no new CLI command or MCP tool. The JSON envelope keeps its existing keys;
`doctor` adds the additive `meta.data_dir` / `meta.data_dir_source` fields and may carry a warning.
Existing stores open unchanged, and configs that already use an absolute `data_dir` behave exactly
as before.

What changed:

- **Data-dir anchoring.** A relative `storage.data_dir` written in `seo.toml` now resolves against
  that file's parent, so `lv24-seo --config /srv/site/seo.toml` uses `/srv/site/data` from any
  working directory. `init` creates `<config dir>/data` and writes `data_dir = "./data"`. The
  built-in default (no `[storage]` block) and `LV24_SEO_DATA_DIR` stay process-scoped on purpose.
  `doctor --json` reports `meta.data_dir` and `meta.data_dir_source` (`config` or
  `working directory`), and `config show --json` reports the effective path.
- **Absolute scheduler paths.** `resolve_config_path` always returns an absolute, normalised path.
  `schedule install` and `schedule print` embed that absolute `--config` argument and use the
  config's parent as the working directory, so a job runs the same config from any scheduler
  working directory.
- **Replay-safe CLI writes.** A write command with `--confirm` opens the workspace SQLite ledger
  and passes it to `WriteGate`. A replayed token returns `status: skipped` with
  `reason: duplicate` and the provider is called exactly once. A dry run opens no ledger and
  creates no database. Without an initialised workspace the command still works, but the envelope
  warns that replay protection is off for the token's five-minute lifetime.
- **Sitemap warning redaction.** A failed sitemap fetch reports only the exception type
  (`HTTPError`, `TimeoutError`, …), never the URL or query string. The failure stays visible and
  machine-readable without leaking `?key=…` into warnings, `limitations[]` or MCP payloads.
- **GSC exact-cap honesty.** A final GSC page that exactly fills the 50,000-row cap is reported as
  `truncated: true` with `rows_cap_50000`; a smaller caller cap produces a warning that names the
  caller's row limit. A zero cap is reported as a cap, not as an empty result. A full page is not
  proof that no further row exists.
- **Opt-in redacting logging.** `LV24_SEO_LOG_LEVEL` installs the redacting handler at exactly two
  process entry points: the CLI callback and `lv24-seo mcp serve`. An unset variable leaves the
  caller's logging configuration untouched. Output is one JSON line per record when stderr is not
  a terminal (pipe, scheduler log, MCP host) and a plain line otherwise. The MCP transport logs to
  stderr only; stdout stays the protocol.
- **Smaller fixes.** A pending write claim left by a crash still has no TTL; deleting
  `data/seo.sqlite3` resets the ledger; `doctor` does not fail on a relative data directory.

Verification recorded for this release:

| Check | Result |
|---|---|
| Offline test suite | 1141 passed, 1 skipped |
| `ruff check` | Clean |
| `ruff format --check` | Clean |
| `mypy src` | Clean |
| MCP registry `--check` | Clean (no surface change) |

Known limits in 0.5.2:

- A config reached through a symlink anchors its data directory next to the link, not the target,
  because symlinks are deliberately kept. `LV24_SEO_DATA_DIR` remains a process-scoped override.
- A `pending` write claim left by a crash has no TTL; it is treated as in-flight until an operator
  releases it. This is deliberate: a false retry can duplicate a provider write.
- Without a data directory there is no replay protection; the token remains valid for its full
  five-minute window.
- A site with exactly 50,000 GSC rows and nothing behind the cap is also reported truncated. That
  is deliberate: a full page is not proof that no further row exists.
- Logging remains opt-in. The redaction rules cover sensitive keys, known token prefixes and opaque
  long values, not every provider-specific secret shape.

## Desktop 0.2.2 assets

`0.2.2` is a hardening patch on the `0.2.x` preview. It fixes the updater failure caused by a locked
engine sidecar, makes the Rust bridge write configuration and settings durably and privately,
clears stale UI state, and bundles `lv24-seo 0.5.2`.

| Asset | Platform | Purpose |
|---|---|---|
| `LV24.SEO.Optimizer_0.2.2_x64-setup.exe` + `.exe.sig` | Windows x64 | NSIS per-user installer; signed updater package |
| `LV24-SEO-Optimizer_0.2.2_x64-portable.zip` | Windows x64 | Portable build; manual-only |
| `LV24.SEO.Optimizer_0.2.2_aarch64.dmg` | macOS Apple silicon | First install |
| `LV24.SEO.Optimizer_0.2.2_x64.dmg` | macOS Intel | First install |
| `LV24.SEO.Optimizer_0.2.2_aarch64.app.tar.gz` + `.sig` | macOS Apple silicon | Signed updater package |
| `LV24.SEO.Optimizer_0.2.2_x64.app.tar.gz` + `.sig` | macOS Intel | Signed updater package |
| `LV24.SEO.Optimizer_0.2.2_amd64.AppImage` + `.AppImage.sig` | Linux x64 | AppImage; signed updater package |
| `LV24.SEO.Optimizer_0.2.2_amd64.deb`, `LV24.SEO.Optimizer-0.2.2-1.x86_64.rpm` | Linux x64 | Package-manager installs; manual-only |
| `latest.json` | All | Signed updater manifest |
| `SHA256SUMS.txt` | All | SHA-256 for every published asset |

The Windows installer requires Windows 10/11 x64 and the WebView2 runtime; the NSIS installer can fetch it, the portable ZIP cannot. Linux bundles are built on
Ubuntu 22.04 with a glibc 2.35 baseline and are x64 only. macOS requires macOS 13 or later; use the `aarch64` DMG on Apple silicon and the `x64` DMG on Intel.

### Updater sidecar cleanup

The engine sidecar lives inside the installed resource directory, so a running `lv24-seo` process
keeps the file locked and the NSIS installer cannot replace it. Before the installer starts, the
shell calls `prepare_update`, which stops **only the engine PIDs this app instance registered** when
it spawned them. Nothing is matched by image name, so another installed copy, a portable build, a
terminal `lv24-seo` run or an unrelated process is untouched. A short wait (2 s) confirms the
processes are gone.

If cleanup fails, the install is blocked with `UPDATE_ENGINE_BUSY` instead of starting an installer
that will fail halfway. The error is retryable: close the run that holds the sidecar and press the
button again.

### Secrets and configuration

- Yandex Metrika keeps its own auth provider (`metrika`, `yandex_metrika_token`) in the provider
  list, the Settings badge, the secret modal and the en/ru/zh labels. It never borrows the
  Webmaster token.
- The desktop and the CLI share **one OS keychain entry per provider** (service `lv24-seo`). A token
  entered with `lv24-seo auth set --provider <p> --stdin` in a terminal appears in the desktop's
  `auth status` without re-entry, and a token entered in the desktop is visible to the CLI.
- A token supplied through `LV24_SEO_*` is shown as **read-only** in the UI: the desktop cannot
  remove an environment variable, and it says so instead of offering a delete button that does
  nothing. `auth logout` reporting `deleted: false` is surfaced honestly.
- Workspace, report, doctor and secret state is cleared when the workspace changes or the engine
  goes offline. Actions that cannot work are disabled rather than failing on click. The en/ru/zh
  message catalogues are at parity; a missing key is a test failure.
- Configuration and settings writes are atomic **and fsynced** (file and parent directory). Temp
  drafts and backups are mode `0600`; config reads are bounded at 8 MiB; settings load per field;
  Windows reserved device names and trailing dots/spaces are rejected in every path component.
  Configuration-validation stderr is redacted before it reaches the UI or a log.

## Auto-update matrix

| Bundle | In-app update | What happens |
|---|---|---|
| Windows NSIS | Yes | Downloads the signed setup `.exe`, stops tracked sidecar PIDs, runs the installer in passive mode, relaunches |
| macOS `.app` | Yes | Downloads the signed `.app.tar.gz`, replaces the app, relaunches |
| Linux AppImage | Yes | Downloads the signed AppImage, replaces it, relaunches |
| Windows portable ZIP | No | Settings points to the release page; download and extract a new ZIP |
| Linux deb | No | Settings points to the release page; upgrade with the package manager |
| Linux rpm | No | Settings points to the release page; upgrade with the package manager |
| MSI | No | No MSI is produced; an MSI install is treated as manual |
| Unknown bundle | No | Settings points to the release page |

Manual-only is deliberate. A deb or rpm install is owned by the package database; an MSI is not produced by this project, and the NSIS updater package cannot
replace it; a portable ZIP has no installer to replace and may live on removable media. The desktop reports the installed bundle type and disables the in-app
installer for those cases. It does not pretend that a manual package was updated.

The Windows NSIS path has now been verified end-to-end nine times: `0.2.0 → 0.2.1`, `0.2.1 → 0.2.2`,
`0.2.2 → 0.2.3`, `0.2.3 → 0.3.0`, `0.3.0 → 0.4.0`, `0.4.0 → 0.5.0`, `0.5.0 → 0.6.0`, `0.6.0 → 0.7.0`
and `0.7.0 → 0.8.0`. For the ninth run, an installed `0.7.0` build updated through the Rust updater,
downloaded and verified the signed package, installed it, relaunched, and reported **Desktop 0.8.0**
with **Engine 0.10.0** and the engine ready; the Bing URL submission, sitemap, crawl-issue and quota
cards loaded. `0.9.7 → 0.9.8` is the next in-app update source. Any `0.2.x` install with the in-app updater can jump straight to
`0.9.8`; `0.1.0` has no updater and needs one manual install.

The `0.2.1 → 0.2.2` update runs the old `0.2.1` updater, which does not include the new tracked-PID
cleanup. If a sidecar is active during that first update, retry after it exits or install `0.2.2`
manually. `0.2.2 → 0.2.3` and later updates use the tracked-PID cleanup and block with
`UPDATE_ENGINE_BUSY` if a tracked sidecar cannot be stopped.

## Release pipeline

The desktop workflow is manual and owner-gated. It has no push, pull-request or tag triggers. The owner starts **Actions → Desktop build → Run workflow** and
approves the `desktop-release` environment; a non-owner run is skipped.

| Input | Default | Meaning |
|---|---|---|
| `engine_version` | `0.15.2` | Exact engine bundled in the sidecar |
| `signed` | `false` | Request OS signing/notarization; not configured in this zero-spend repository |
| `publish` | `false` | Create a GitHub release after every matrix build passes |
| `tag` | Empty | `vX.Y.Z` release tag; required when `publish=true` |

The default matches the `0.9.8` pin. The release gate rejects a manifest mismatch if a different version is passed.

| Runner | Target | Bundles |
|---|---|---|
| `windows-latest` | `x86_64-pc-windows-msvc` | NSIS |
| `ubuntu-22.04` | `x86_64-unknown-linux-gnu` | AppImage, deb, rpm |
| `macos-15` | `aarch64-apple-darwin` | DMG + app |
| `macos-15-intel` | `x86_64-apple-darwin` | DMG + app |

All runners are standard GitHub-hosted runners. No larger runner, paid minute, paid storage or paid signing service is used. Build artifacts are retained for 7
days; the GitHub release is the durable distribution channel.

## Sidecar pin and checksums

The release sidecar is a PyInstaller **onedir** tree, built on the matching host; PyInstaller does not cross-compile. The engine, Python, Pydantic, Typer and
PyInstaller versions are pinned in `scripts/cli-checksums.json`. `0.9.8` keeps engine `0.15.2` (unchanged from `0.9.7`), Python `3.12`, Pydantic `2.14.3`, Typer `0.29.0` and PyInstaller
`6.22.3`.

PyInstaller onedir output is not byte-reproducible. The checksum policy is therefore split:

- **Local release build — strict.** `scripts/verify-sidecar.mjs` must match the committed
  SHA-256 and size; `--write` updates the pin after review. A `null` pin means “not
  reviewed yet”, not “verified”.
- **CI rebuild — rebuild-aware.** The build job runs the verifier with `--no-hash` and
  records the actual SHA-256 in `release/sidecar-checksums-<target>.json`.
- **Release gate — report-based.** The release job requires a valid report for every
  shipped target: matching target name, `hashPolicy: "rebuild"`, `ok: true`, a 64-hex
  hash, a positive size and the exact engine version.

For `0.9.5`, Windows x64 has a reviewed local pin (`cd70636a…1922`, 14,607,761 bytes); Linux and macOS were rebuilt by the release workflow
with passing rebuild-aware checksum reports, and their reviewed pins remain `null` until a local build is
reviewed on those hosts. The `0.9.6` Windows pin did not carry over because the executable changes with
the engine.
The checksum reports are CI evidence, not release assets. `SHA256SUMS.txt` covers the installers,
updater packages, signatures and `latest.json`; the sidecar executable is inside those packages and
is not listed separately. Users who install manually verify the downloaded asset against
`SHA256SUMS.txt`.

```bash
node scripts/verify-sidecar.mjs \
  --root src-tauri/engine \
  --target x86_64-pc-windows-msvc \
  --engine-version 0.15.1
```

## `latest.json`, signing and publishing

Updater signatures use a free Ed25519/minisign key, separate from OS code signing. The public key is embedded in the app; the private key is a repository secret
passed only to the build step. `requireSignedVersion` is enabled, so the announced version is bound to the signed package. The updater accepts only a version
greater than the running one, so it cannot downgrade.

`scripts/stage-release-assets.mjs` flattens and normalizes bundle names and writes per-platform `updater-<platform>.json` metadata.
`scripts/merge-latest-json.mjs` merges them into `latest.json`:

- required generic keys: `windows-x86_64`, `linux-x86_64`, `darwin-aarch64`,
  `darwin-x86_64`;
- bundle aliases the updater probes: `windows-x86_64-nsis`, `linux-x86_64-appimage`,
  `darwin-aarch64-app`, `darwin-x86_64-app`;
- optional `linux-x86_64-deb` and `linux-x86_64-rpm` only when Tauri produced those
  signatures;
- every URL points under `releases/download/<tag>/`;
- every signature is checked against the `.sig` file on disk;
- every referenced asset must exist;
- notes come from `docs/releases/<version>.md` when present.

The release is created as a **draft** first. Assets are uploaded while it is a draft, with `latest.json` last, then the job publishes with
`gh release edit --draft=false` and verifies the remote asset names. `releases/latest/download/latest.json` only resolves to a published release, so users never see a partially
uploaded manifest. A rerun reuses an existing draft, clears its assets and refuses to overwrite a published release.

## Version pinning

The desktop version must agree in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, the Git tag and the release title. The engine pin lives
in `scripts/cli-checksums.json`; the workflow passes `engine_version` explicitly and the release gate requires it to match the manifest.

`MIN_ENGINE_VERSION` in `src-tauri/src/commands.rs` is `0.15.1` in the current source. The `0.9.5` bundle ships engine `0.15.1`,
so the minimum matches the bundled engine and a `0.13.x` engine is reported as incompatible. The shell accepts an engine at least that new and marks an older one
offline with a notice. A newer engine passes the gate but is not the release-tested pin. A development build may use `LV24_SEO_BIN` with another version; the UI
labels it external and still checks the minimum. A `PATH` engine is used only when `LV24_SEO_ALLOW_PATH_ENGINE=1`.

## One-time 0.1.0 upgrade

`0.1.0` has no updater, endpoint or public key. It cannot discover or install `0.9.8`. Download and install `0.9.8` manually once (NSIS installer or portable
ZIP on Windows). After that, the `0.9.8` installation can auto-update to later releases when it uses an auto-update-capable bundle.

## Earlier releases

- **Engine 0.15.2** added `access` per provider to `auth status` (`service_account`, `token`, `oauth`, `none`), describing data access separately from the optional OAuth object.
- **Desktop 0.9.7** bundled engine `0.15.2` but still derived Connected from OAuth; **Desktop 0.9.8** completes the badge fix using the data-access summary.
- **Desktop 0.9.6** labels OAuth as optional when a saved token or service account already connects the provider; Connect stays disabled until a real OAuth client is configured.
- **Engine 0.15.1** rejects documented placeholder OAuth client ids with `CONFIG_INVALID` before a consent URL; real ids and token flows are unchanged.
- **Engine 0.15.0** added four crawl rule packs (`security-headers`, `tls-certificate`, `schema-required`, `a11y-basics`) and grew the rule set from 30 to 34.
- **Desktop 0.9.5** bundled engine `0.15.1` and `MIN_ENGINE_VERSION` `0.15.1`, added the four rule packs and disabled Connect while the OAuth client is missing or misconfigured.
- **Engine 0.14.1** hid Windows scheduled jobs behind a generated `.vbs` launcher and `wscript.exe //B //Nologo`, with three status artefacts and a one-time reinstall.
- **Desktop 0.9.4** bundled engine `0.14.1` and `MIN_ENGINE_VERSION` `0.14.1`; the 04:00 job no longer opens a console window, and the cards are unchanged.
- **Desktop 0.9.3** added OAuth readiness states to the Connect card, with a neutral unavailable fallback and no token or secret rendered; engine `0.14.0` and the sidecar pin are unchanged.
- **Engine 0.14.0** added OAuth readiness diagnostics: the `auth status` `oauth` object, `doctor` OAuth checks and eight stable codes, with recorded scopes and no provider call.
- **Desktop 0.9.2** added the read-only Indexing automation card, bundled engine `0.14.0` and raised `MIN_ENGINE_VERSION` to `0.14.0`.
- **Engine 0.13.0** added OAuth connectors for Google Search Console and Yandex Webmaster/Metrika,
  keychain tokens, `[auth.gsc]`/`[auth.yandex]` and the `auth set --provider *_oauth_secret` path,
  without changing the CLI count, MCP tools or schema.
- **Desktop 0.9.1** added the OAuth Connect card, bundled engine `0.13.1` and raised
  `MIN_ENGINE_VERSION` to `0.13.1`; it added no write surface.
- **Engine 0.11.0** added full-platform read depth: GSC URL Inspection, sitemaps and filtered search
  analytics; Yandex events/sitemaps/history/queue and gated recrawl; Bing page/traffic/crawl/URL/joins;
  organic Metrika; CrUX history and PSI audits; 24 CLI commands and 12 tools.
- **Engine 0.10.0** turned Bing URL submission into a gated `SubmitUrlbatch` write and added read-only
  quota, sitemap-feed and crawl-issue views, 23 CLI commands and 12 tools.
- **Desktop 0.8.0** added Bing URL submission and read-only sitemap, crawl-issue and quota cards,
  bundled engine `0.10.0` and raised `MIN_ENGINE_VERSION` to `0.10.0`.
- **Desktop 0.7.0** added the Bing indexing panel (sitemap plan/apply, IndexNow from the sitemap, Site Scan opener)
  and the per-session write secret, bundled engine `0.9.0` and raised `MIN_ENGINE_VERSION` to `0.9.0`.
- **Engine 0.9.0** made Bing sitemap submit a gated `SubmitFeed` write, added one-click IndexNow from a bounded
  sitemap and the optional MCP `provider` input, and kept 22 CLI commands and 12 tools.
- **Desktop 0.5.0** added the restore flow, a confirmed schedule install, the Portfolio page and the CWV card,
  bundled engine `0.7.0` and raised `MIN_ENGINE_VERSION` to `0.7.0`.
- **Engine 0.7.0** added two-phase restore, the read-only portfolio, CWV by URL template and device, schema v4
  with `indexing_events`, and 21 CLI commands.
- **Desktop 0.4.0** added the Logs, Tasks and Backup pages and the report digest card, bundled engine `0.6.0`
  and raised `MIN_ENGINE_VERSION` to `0.6.0`.
- **Engine 0.6.0** added local nginx log analysis and the twelfth MCP tool, the attributed change digest,
  the task lifecycle with schema v3, a portable backup and 20 CLI commands.
- **Desktop 0.3.0** added the project wizard, crawl screen, report comparison and export, settings save workflow,
  integrations, per-workspace reporting window and run status.
- **Engine 0.5.3** made MCP writes two-phase, moved the crawl off the event loop, added `--strict` exit `5`, typed
  store errors and honest GSC/Metrika/Bing/Yandex data.
- **Desktop 0.2.3** moved the update install into Rust with real cancellation, made the config path a
  dialog-approved capability, rejected network and device paths and redacted engine output before the webview.
- **Desktop 0.2.2** fixed the locked-sidecar updater failure, made configuration writes durable and private, cleared stale
  UI state and bundled engine `0.5.2`.
- **Engine 0.5.2** anchored a relative `storage.data_dir` to the config file, attached the write ledger to CLI applies,
  redacted sitemap fetch errors and reported an exact-cap GSC page as truncated.
- **Desktop 0.2.1** fixed the Yandex Metrika token surface and made the shared CLI/desktop keychain
  explicit. It was the first release delivered through the in-app updater from `0.2.0`.
- **Desktop 0.2.0** was the first multi-platform release: Windows NSIS and portable ZIP, Linux
  AppImage/deb/rpm, macOS DMG and signed updater packages.
- **Engine 0.5.1** fixed write-gate retries, bounded crawl text, MCP annotations and reachable
  limits. It treated an exact-cap final GSC page as complete; `0.5.2` reverses that decision and
  treats a full final page as potentially truncated.

## Rollback

There is no automatic downgrade. A rollback is a manual install of an older release.

| Failure | Response |
|---|---|
| Bad installer but valid app | Publish a fixed patch; do not overwrite assets under the same tag |
| Bad `latest.json` | Publish a fixed patch; the draft gate prevents a partial manifest from being visible |
| Compromised updater key | Rotate the key, ship a manual release with the new public key; auto-update cannot bridge the rotation |
| Engine regression | Pin the previous engine version, rebuild and publish a patch |
| Need an older desktop build | Install it manually; the updater refuses downgrades |

Do not move or reuse a published tag. Keep the previous release assets available for rollback. If the endpoint must be disabled, ship a manual release and
document it.

## Verifying a download

`SHA256SUMS.txt` covers every published asset. Verify the files you intend to install:

```bash
sha256sum -c SHA256SUMS.txt --ignore-missing
```

On macOS, `shasum -a 256 -c SHA256SUMS.txt` is available in the base system. On Windows, compare `Get-FileHash <file> -Algorithm SHA256` with the matching line.
Do not run a file whose hash does not match.

By default, OS packages are unsigned (Windows, Linux) or ad-hoc signed (macOS). The updater signature authenticates updates, not the first manual download.
SmartScreen and Gatekeeper warnings are expected; verify the checksum and use the documented **More info → Run anyway** or **Open Anyway** flow. Do not disable
those protections system-wide.

See [Security and privacy](/security/) for updater trust and [Architecture](/architecture/) for the sidecar layout.

Source: `_source/engine-releases-0.15.2.md`, `_source/engine-releases-0.15.1.md`, `_source/engine-releases-0.15.0.md`, `_source/engine-releases-0.14.1.md`, `_source/engine-releases-0.14.0.md`, `_source/engine-CHANGELOG.md`, `_source/engine-releases-0.13.1.md`, `_source/engine-releases-0.13.0.md`, `_source/engine-releases-0.12.2.md`, `_source/engine-releases-0.12.1.md`, `_source/engine-releases-0.12.0.md`, `_source/engine-releases-0.11.0.md`, `_source/engine-releases-0.10.0.md`, `_source/engine-releases-0.9.0.md`, `_source/engine-releases-0.8.0.md`, `_source/engine-releases-0.7.0.md`, `_source/engine-releases-0.6.0.md`, `_source/engine-releases-0.5.3.md`, `_source/engine-releases-0.5.2.md`, `_source/desktop-releases-0.9.8.md`, `_source/desktop-releases-0.9.8-update.md`, `_source/desktop-releases-0.9.7.md`, `_source/desktop-releases-0.9.7-update.md`, `_source/desktop-releases-0.9.6.md`, `_source/desktop-releases-0.9.6-update.md`, `_source/desktop-releases-0.9.5.md`, `_source/desktop-releases-0.9.5-update.md`, `_source/desktop-releases-0.9.4.md`, `_source/desktop-releases-0.9.4-update.md`, `_source/desktop-releases-0.9.3.md`, `_source/desktop-releases-0.9.3-update.md`, `_source/desktop-releases-0.9.2.md`, `_source/desktop-releases-0.9.1.md`, `_source/desktop-releases-0.9.0.md`, `_source/desktop-releases-0.8.0.md`, `_source/desktop-releases-0.7.0.md`, `_source/desktop-releases-0.6.0.md`, `_source/desktop-releases-0.5.0.md`, `_source/desktop-releases-0.4.0.md`, `_source/desktop-releases-0.3.0.md`, `_source/desktop-releases-0.2.3.md`, `_source/desktop-releases-0.2.2.md`, `_source/desktop-releases-0.2.1.md`, `_source/desktop-releases-0.2.0.md`, `_source/desktop-release.md`, `_source/desktop-security.md`.

# Source map: `_source/` files to site pages

Every file in this snapshot is represented below. Pages keep the source
wording, warnings, and command syntax; relative Markdown links were rewritten
to site routes.

| Snapshot file | Site pages | Notes |
|---|---|---|
| `engine-README.md` | `/`, `/start/`, `/install/` | Product summary, install paths, feature matrix. |
| `engine-architecture.md` | `/architecture/` | Package layout, surfaces, dependency rules, storage. |
| `engine-security.md` | `/security/` | Threat model, secrets, write gates, reporting. |
| `engine-cli.md` | `/reference/cli/`, `/start/` | Command groups, exit codes, envelopes. |
| `engine-config.md` | `/reference/config/` | Config file keys, defaults, precedence, `[auth.*]` blocks. |
| `engine-auth.md` | `/reference/cli/`, `/reference/config/`, `/providers/`, `/troubleshooting/` | OAuth connector overview, quick start, fallbacks, readiness codes and recorded scopes. |
| `engine-auth-google.md` | `/reference/cli/`, `/reference/config/`, `/troubleshooting/` | GSC Desktop-app OAuth, loopback + PKCE, Testing-mode caveat, service-account fallback. |
| `engine-auth-yandex.md` | `/reference/cli/`, `/reference/config/`, `/troubleshooting/` | Yandex Webmaster/Metrika OAuth, `verification_code`, refresh, token slots. |
| `engine-data-sources.md` | `/providers/` | Provider capabilities, quotas, limits. |
| `engine-mcp.md` | `/mcp/` | Tools, resources, prompts, annotations. |
| `engine-skills.md` | `/mcp/` | Canonical skills and export. |
| `engine-scheduling.md` | `/automation/` | cron/systemd/Task Scheduler generators. |
| `engine-troubleshooting.md` | `/troubleshooting/` | Common failures and diagnostics. |
| `engine-releases-0.5.1.md` | `/release/` | Engine 0.5.1 notes, kept for the previous bugfix release. |
| `engine-releases-0.5.2.md` | `/release/` | Engine 0.5.2 notes: data-dir anchoring, replay-safe writes, sitemap redaction, GSC cap honesty, opt-in logging. |
| `engine-releases-0.5.3.md` | `/release/` | Engine 0.5.3 notes: two-phase MCP writes, crawl off-loop, `--strict`, typed store errors, provider honesty. |
| `engine-releases-0.6.0.md` | `/release/` | Engine 0.6.0 notes: log analysis and the 12th MCP tool, attributed digest, task lifecycle (schema v3), portable backup, 20 CLI commands. |
| `engine-releases-0.7.0.md` | `/release/` | Engine 0.7.0 notes: multi-site portfolio, two-phase restore, schema v4 `indexing_events`, CWV by template, 21 CLI commands, 10 read-class MCP tools. |
| `engine-releases-0.8.0.md` | `/release/` | Engine 0.8.0 notes: `cwv collect` writer, GSC service-account auth, richer Yandex indicators, `backup restore --to`, scheduler lifecycle, Metrika and Windows JSON fixes, 22 CLI commands. |
| `engine-releases-0.9.0.md` | `/release/`, `/reference/cli/`, `/mcp/` | Engine 0.9.0 notes: Bing `sitemap submit` via `SubmitFeed`, IndexNow `--from-sitemap` with config defaults and a 10,000-URL cap, optional MCP `provider`, 22 CLI commands and 12 tools. |
| `engine-releases-0.10.0.md` | `/release/`, `/reference/cli/`, `/mcp/` | Engine 0.10.0 notes: Bing `bing submit` via `SubmitUrlbatch` in 500-URL batches, quota pre-check, accepted-not-indexed, read-only `bing quota`/`sitemaps`/`issues`, 23 CLI commands and 12 tools. |
| `engine-releases-0.11.0.md` | `/release/`, `/reference/cli/`, `/providers/`, `/mcp/` | Engine 0.11.0 notes: GSC URL Inspection, sitemap reads and filtered search analytics; Yandex events/sitemaps/history/queue reads and gated recrawl; Bing page/traffic/crawl/URL/joins reads with `no_rows_for_window`; organic Metrika pages/goals/dimensions; CrUX history/collection period and PSI audits; IndexNow key and status rules; 24 CLI commands and 12 tools. |
| `engine-releases-0.12.0.md` | `/release/`, `/reference/cli/`, `/providers/`, `/automation/` | Engine 0.12.0 notes: quota-aware `indexing status`/`run`/`history` across Bing, Yandex, IndexNow and GSC, priority/idempotency, honest index counts, the daily `lv24-seo-indexing` job, `[indexing]` config, schema v5 and 25 CLI commands. |
| `engine-releases-0.12.1.md` | `/release/` | Engine 0.12.1 notes: the indexing client-lifecycle fix (`SeoService` keeps provider clients open for the whole run); no API, CLI, schema or config change. |
| `engine-releases-0.12.2.md` | `/release/`, `/providers/` | Engine 0.12.2 notes: Yandex `recrawl/queue` 5xx mapped to `UPSTREAM_UNAVAILABLE` with the HTTP status instead of "invalid JSON"; no API, CLI, schema or config change. |
| `engine-releases-0.13.0.md` | `/release/`, `/reference/cli/`, `/reference/config/`, `/providers/`, `/troubleshooting/` | Engine 0.13.0 notes: OAuth connectors for GSC (loopback + PKCE) and Yandex Webmaster/Metrika (`verification_code` + refresh), keychain tokens, `[auth.gsc]`/`[auth.yandex]`, `auth login`, `auth set --provider *_oauth_secret`; 25 CLI commands, 12 tools and schema v5 unchanged. |
| `engine-releases-0.13.1.md` | `/release/`, `/reference/cli/`, `/desktop/` | Engine 0.13.1 notes: Yandex-only `auth login --url-only` returns the authorization URL without a browser, prompt or token write, so the desktop Connect card can complete the code in a second call; no API, CLI count, MCP, schema or config change. |
| `engine-releases-0.14.0.md` | `/release/`, `/reference/cli/`, `/reference/config/`, `/providers/`, `/troubleshooting/` | Engine 0.14.0 notes: `auth status` OAuth object, `doctor` readiness checks, the eight stable codes, precedence and recorded scopes; 25 CLI commands, 12 tools and schema v5 unchanged. Previous engine line. |
| `engine-releases-0.14.1.md` | `/release/`, `/automation/`, `/reference/cli/` | Engine 0.14.1 notes: hidden Windows scheduled jobs via a generated UTF-16 `.vbs` launcher and `wscript.exe //B //Nologo`, three status artefacts and a one-time reinstall; no MCP, schema or CLI count change. Previous engine line. |
| `engine-releases-0.15.0.md` | `/release/`, `/crawl/` | Engine 0.15.0 notes: four crawl rule packs (`security-headers`, `tls-certificate`, `schema-required`, `a11y-basics`), 30 to 34 rules, TLS/Set-Cookie/fetched-at capture and the new parser fields. |
| `engine-releases-0.15.1.md` | `/release/`, `/reference/cli/`, `/reference/config/`, `/troubleshooting/` | Engine 0.15.1 notes: documented placeholder OAuth client ids rejected with `CONFIG_INVALID` before a consent URL; real ids and token flows unchanged. |
| `engine-CHANGELOG.md` | `/release/` | Changelog index for the 0.14.0 release line and earlier entries. |
| `desktop-README.md` | `/desktop/`, `/install/` | Desktop install matrix, update, troubleshooting. |
| `desktop-release.md` | `/release/` | Release pipeline, signing, assets, rollback. |
| `desktop-security.md` | `/security/`, `/desktop/` | Shell boundary, secrets, updater trust. |
| `desktop-architecture.md` | `/architecture/`, `/desktop/` | FSD layout, commands, stores, resources. |
| `desktop-releases-0.2.2.md` | `/release/` | Desktop 0.2.2 hardening notes: sidecar cleanup, `UPDATE_ENGINE_BUSY`, secrets, durable writes, engine 0.5.2. |
| `desktop-releases-0.3.0.md` | `/release/` | Desktop 0.3.0 notes: project wizard, crawl screen, report comparison and export, settings save workflow, integrations, reporting window and run status. |
| `desktop-releases-0.4.0.md` | `/release/` | Desktop 0.4.0 notes: Logs, Tasks and Backup pages, digest card, bundled engine 0.6.0 and `MIN_ENGINE_VERSION` 0.6.0. |
| `desktop-releases-0.5.0.md` | `/release/` | Desktop 0.5.0 notes: restore UI, confirmed schedule install, portfolio page, CWV card, bundled engine 0.7.0 and `MIN_ENGINE_VERSION` 0.7.0. |
| `desktop-releases-0.6.0.md` | `/release/` | Desktop 0.6.0 notes: cancellable background runs, schedule install `--allow-write`, bundled engine 0.8.0 and `MIN_ENGINE_VERSION` 0.8.0. |
| `desktop-releases-0.7.0.md` | `/release/`, `/desktop/` | Desktop 0.7.0 notes: Bing sitemap plan/apply, IndexNow from sitemap, Bing Site Scan opener, per-session write secret, bundled engine 0.9.0 and `MIN_ENGINE_VERSION` 0.9.0. |
| `desktop-releases-0.8.0.md` | `/release/`, `/desktop/`, `/install/` | Desktop 0.8.0 notes: Bing URL submission, read-only sitemap, crawl-issue and quota cards, bundled engine 0.10.0 and `MIN_ENGINE_VERSION` 0.10.0. |
| `desktop-releases-0.9.0.md` | `/release/`, `/desktop/`, `/install/` | Desktop 0.9.0 notes: read-only Diagnostics screen with five tabs and 18 allow-listed commands, bundled engine 0.11.0 and `MIN_ENGINE_VERSION` 0.11.0. |
| `desktop-releases-0.9.1.md` | `/release/`, `/desktop/`, `/install/` | Desktop 0.9.1 notes: OAuth Connect card for GSC, Yandex Webmaster and Metrika, bundled engine 0.13.1 and `MIN_ENGINE_VERSION` 0.13.1, contracts 0.13.1, no new write surface. |
| `desktop-releases-0.9.2.md` | `/release/`, `/desktop/`, `/install/`, `/indexing/` | Desktop 0.9.2 notes: read-only Indexing automation card, bundled engine 0.14.0 and `MIN_ENGINE_VERSION` 0.14.0, contracts 0.14.0, no write controls. Previous desktop line. |
| `desktop-releases-0.9.2-update.md` | `/release/`, `/desktop/` | Desktop 0.9.2 short update note: daily 04:00 job, per-provider quotas and honest counts, no write controls. |
| `desktop-releases-0.9.3.md` | `/release/`, `/desktop/` | Desktop 0.9.3 notes: OAuth readiness in the Connect card, eight states, neutral unavailable fallback, no token or secret rendered; same engine 0.14.0 and sidecar pin. Previous desktop line. |
| `desktop-releases-0.9.3-update.md` | `/release/`, `/desktop/` | Desktop 0.9.3 short update note: readiness states, Ready only for `oauth_ready`, unavailable never shown as success. |
| `desktop-releases-0.9.4.md` | `/release/`, `/desktop/`, `/automation/`, `/indexing/` | Desktop 0.9.4 notes: bundled engine 0.14.1 and `MIN_ENGINE_VERSION` 0.14.1, hidden Windows scheduled jobs, contracts and sidecar pin updated; cards unchanged. Previous desktop line. |
| `desktop-releases-0.9.4-update.md` | `/release/`, `/desktop/`, `/automation/` | Desktop 0.9.4 short update note: the 04:00 job no longer flashes a terminal, one-time reinstall for older tasks, cards unchanged. |
| `desktop-releases-0.9.5.md` | `/release/`, `/desktop/`, `/crawl/`, `/reference/cli/` | Desktop 0.9.5 notes: bundled engine 0.15.1 and `MIN_ENGINE_VERSION` 0.15.1, four crawl rule packs, placeholder client-id guard, Connect disabled while readiness is missing/misconfigured. |
| `desktop-releases-0.9.5-update.md` | `/release/`, `/desktop/`, `/crawl/` | Desktop 0.9.5 short update note: 34 rules, placeholder client ids rejected, Connect disabled until configured, cards unchanged. |
| `desktop-releases-0.2.3.md` | `/release/` | Desktop 0.2.3 notes: Rust updater and cancel, dialog-approved config path, path rejection, redaction, UI state, release CI. |
| `desktop-releases-0.2.1.md` | `/release/` | Desktop 0.2.1 patch notes: Metrika token and shared CLI keychain. |
| `desktop-releases-0.2.0.md` | `/release/` | Desktop 0.2.0 release notes, kept for the first multi-platform release. |

## Known source tensions

- The engine `SECURITY.md` supported-versions line still says 0.2.x; the
  portal security page states the current 0.13.1 line and the release notes are
  authoritative.
- OAuth live consent was not exercised at release time for either product; both
  release pages say so instead of implying a verified provider login.

- The desktop is distributed unsigned at the OS level (Windows/Linux) or
  ad-hoc signed (macOS), while updater payloads are minisign-signed. Pages keep
  both facts separate.
- Auto-update works for Windows NSIS, macOS `.app` and Linux AppImage only.
  deb/rpm/MSI/portable ZIP are manual-only and the UI says so.
- Engine `0.5.2` keeps the `writes_local_state` MCP annotation from `0.5.1`;
  clients may ask for confirmation before `seo_crawl_site` and
  `seo_weekly_report`.
- A GSC final page that exactly fills the 50,000-row cap is reported as
  `truncated: true`. A full page is not proof that no further row exists.
- CLI write replay protection needs an initialised workspace. Without a data
  directory the apply still runs, but the envelope warns that the five-minute
  token has no ledger behind it.
- The desktop updater stops only sidecar PIDs it registered. A sidecar started
  elsewhere is not killed; if it keeps the installed file locked, the update is
  blocked with `UPDATE_ENGINE_BUSY` and can be retried after it exits.

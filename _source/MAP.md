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
| `engine-config.md` | `/reference/config/` | Config file keys, defaults, precedence. |
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
| `desktop-releases-0.2.3.md` | `/release/` | Desktop 0.2.3 notes: Rust updater and cancel, dialog-approved config path, path rejection, redaction, UI state, release CI. |
| `desktop-releases-0.2.1.md` | `/release/` | Desktop 0.2.1 patch notes: Metrika token and shared CLI keychain. |
| `desktop-releases-0.2.0.md` | `/release/` | Desktop 0.2.0 release notes, kept for the first multi-platform release. |

## Known source tensions

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

LV24 SEO Optimizer Desktop 0.9.2 adds a read-only Indexing automation card on engine 0.14.0.

The Integrations screen now shows the daily 04:00 indexing job, per-provider submitted/indexed/pending counts and quotas for Bing, Yandex, GSC and IndexNow, the newest run with up to five errors, and a compact 7/30-day history. It renders only indexing status, indexing history and schedule status; there are no write or confirm controls. Missing state is shown as "No data yet", never as zero, and GSC's deprecated indexed aggregate is labelled separately.

The bundled engine is lv24-seo 0.14.0 with OAuth readiness diagnostics, 25 CLI commands, 12 MCP tools and SQLite schema 5. MIN_ENGINE_VERSION is now 0.14.0. An older engine shows a compatibility notice instead of empty data.

Auto-update works from 0.2.0 for Windows NSIS, macOS .app and Linux AppImage; deb, rpm, MSI and the portable ZIP are manual-only. 0.9.1 to 0.9.2 is the next in-app update. OS packages remain unsigned (Windows/Linux) or ad-hoc signed (macOS); verify SHA256SUMS.txt.

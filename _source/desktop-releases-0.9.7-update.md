LV24 SEO Optimizer Desktop 0.9.7 fixes the Connected badge in the Connect card.

The badge now reflects actual data access instead of only the OAuth refresh token. A saved Yandex Webmaster or Metrika token, a GSC service account and Bing/CrUX/PSI keys show as Connected; the OAuth badge stays separate and says "OAuth not configured (optional)" when the provider already works without it. This removes the false "Not connected" state for workspaces that use static credentials.

The bundled engine is lv24-seo 0.15.2 with an `access` summary in `auth status --json`; MIN_ENGINE_VERSION is 0.15.2. The four crawl rule packs, Indexing card, hidden Windows scheduled jobs and write gates are unchanged.

Auto-update works from 0.2.0 for Windows NSIS, macOS .app and Linux AppImage; deb, rpm, MSI and the portable ZIP are manual-only. 0.9.6 to 0.9.7 is the next in-app update. OS packages remain unsigned (Windows/Linux) or ad-hoc signed (macOS); verify SHA256SUMS.txt.

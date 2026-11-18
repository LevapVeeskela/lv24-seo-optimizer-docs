LV24 SEO Optimizer Desktop 0.9.8 completes the Connected badge fix.

0.9.7 bundled engine 0.15.2 but its frontend still checked only the OAuth refresh token, so saved Yandex/Metrika tokens and the GSC service account still showed as not connected. 0.9.8 includes the missing frontend patch: the badge reads the engine's data-access summary, so all providers with saved tokens or a service account show Connected, while OAuth remains a separate optional badge.

The bundled engine stays lv24-seo 0.15.2, MIN_ENGINE_VERSION stays 0.15.2, and the crawl rules, Indexing card, hidden Windows scheduled jobs and write gates are unchanged.

Auto-update works from 0.2.0 for Windows NSIS, macOS .app and Linux AppImage; deb, rpm, MSI and the portable ZIP are manual-only. 0.9.7 to 0.9.8 is the next in-app update. OS packages remain unsigned (Windows/Linux) or ad-hoc signed (macOS); verify SHA256SUMS.txt.

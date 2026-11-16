---
title: MCP и навыки агентов
description: Двенадцать инструментов MCP, три ресурса, три промпта, транспорты, регистрация клиентов и поставляемые навыки агентов.
---

# MCP и навыки агентов

MCP-сервер предоставляет небольшую, продуманную поверхность: 12 инструментов, 3 ресурса и 3 промпта. Реестр инструментов — единственный источник истины; JSON-схемы, справка CLI и `schemas/tools.json` генерируются из него и никогда не редактируются вручную.

См. также: [Отчёты и диффы](/ru/reports/), [Источники данных и квоты](/ru/providers/), [Обход и аудит](/ru/crawl/), [Автоматизация и доставка](/ru/automation/).

## Только чтение по умолчанию

Ответы чтения, которые оборачивают строки провайдера, несут `truncated`, `total` (когда провайдер его сообщает), `data_age_days` и `limitations[]`. Последняя страница GSC, точно заполнившая лимит 50 000 строк, помечается `truncated: true` с `rows_cap_50000`; полная страница не доказывает полное покрытие. Инструменты чтения не принимают параметр `format`. Ответы доступны текстом и, если установленный MCP SDK это поддерживает, как `structuredContent`; текстовый блок — запасной вариант для старых клиентов.

Три инструмента сохраняют локальное состояние и не рекламируются как read-only:

| Инструмент | `kind` | `writes_local_state` | `readOnlyHint` | `destructiveHint` | `idempotentHint` |
|---|---|---|---|---|---|
| `yandex_indexing_state` | read | `true` | `false` | `false` | `false` |
| `seo_crawl_site` | read | `true` | `false` | `false` | `false` |
| `seo_weekly_report` | read | `true` | `false` | `false` | `false` |

Они сохраняют события индексирования, снимки обхода или недельного отчёта, но никогда не меняют состояние провайдера и не требуют токен подтверждения. MCP-клиенты, которые смотрят на `readOnlyHint`, могут запросить подтверждение перед их вызовом; это намеренно. Двенадцать инструментов делятся на 10 класса чтения (7 чистых read-only плюс эти 3 писателя локального состояния) и 2 записи с воротами, которые всё ещё возвращают `WRITE_DISABLED` в этой сборке.

Два инструмента записи несут `destructiveHint: true` и включаются явно: `allow_write` по умолчанию `false`, и любой вызов без него возвращает `WRITE_DISABLED` до построения плана. Они следуют тому же двухфазному контракту, что и CLI, — он описан ниже.

## Двухфазная запись

Запись — это план и затем применение, а не один вызов, который угадывает.

1. **План.** Вызовите инструмент с `allow_write=true` и без `confirm_token`. Ничего не уходит провайдеру. Ответ — `ok: true` с `meta.dry_run: true` и `data.plan`, `data.plan_hash`, `data.confirm_token`, `data.ttl_seconds`.
2. **Применение.** Вызовите тот же инструмент с теми же аргументами плюс `allow_write=true`, полученные `plan_hash` и `confirm_token`. `plan_hash`, не совпадающий с текущим планом, даёт `CONFIRM_REQUIRED` до того, как что-либо будет заявлено.

Объект `data` пробного прогона:

```json
{
  "status": "dry_run",
  "plan": {"action": "recrawl", "target": "https:example.com:443", "summary": "queue 2 URL(s) for recrawl on https:example.com:443"},
  "plan_hash": "6f1c…",
  "confirm_token": "1794…:9ab3…",
  "ttl_seconds": 300
}
```

Токен — это HMAC по действию, цели, полному хешу плана и сроку действия; он живёт 300 секунд. Изменение URL, хоста, свойства или действия делает его недействительным. `LV24_SEO_WRITE_SECRET` должен быть задан в окружении сервера; пустой секрет — это `WRITE_DISABLED`, а не слабое значение по умолчанию.

Сервер передаёт в ворота записи хранилище рабочей области, поэтому повторный токен возвращает `status: skipped` с `reason: duplicate`, и провайдер вызывается один раз. Без хранилища применение всё равно выполняется, но ответ предупреждает, что защита от повторов выключена на время жизни токена. Ошибка провайдера освобождает заявку, поэтому честный повтор разрешён, а неудачная запись никогда не помечается отправленной.

Контракт реализован в сервере, но в поставляемом `SeoService` пока нет адаптера записи для переобхода Yandex или карты сайта GSC: оба инструмента возвращают `WRITE_DISABLED` даже с `allow_write=true` и секретом. Путь IndexNow в CLI — единственная запись, доходящая до провайдера. Ничего не имитируется.

## Инструменты

| Инструмент | Входы | Возвращает |
|---|---|---|
| `seo_properties` | Нет | Настроенные провайдеры, их цель, наличие токена и `token_source` (`service_account_file`, `secret` или `missing`) |
| `gsc_search_analytics` | `property`, `start_date`, `end_date`, `dimensions`, `limit` 1–500 (по умолчанию 50) | Строки по запросу, странице, стране или устройству с кликами, показами, CTR и позицией |
| `yandex_query_stats` | `host_id`, `limit` 1–500, `order_by` `TOTAL_SHOWS` или `TOTAL_CLICKS` | Топ-запросы с показами, кликами, позицией, `avg_click_position`, `query_id` и `extra_indicators` |
| `yandex_indexing_state` | Нет, кроме настроенного хоста | История индексирования, количество страниц в поиске, диагностика, объединённая серия `http_2xx` … `other` и `site_problems`; сохраняет события по URL в `indexing_events` (схема v4), когда есть хранилище рабочей области |
| `seo_crawl_site` | `start_url`, `max_urls` 0 или 1–5000, `include_rules` | Сводка обхода, проблемы, граф ссылок и покрытие карты сайта |
| `seo_weekly_report` | `days` 1–90, `lag_days` 0–14 | Разделы недельного отчёта, включая сохранённые строки CWV по сегодняшний день, плюс meta конверта |
| `seo_report_diff` | `base`, `head` в формате `START..END` | Изменения заголовка, количество проблем, движение возможностей, ограничения, Markdown |
| `seo_indexing_triage` | Нет | Корзины с причиной, количеством, примерами и `next_action` |
| `seo_opportunities` | `days` 1–90 (по умолчанию 28), `limit` 1–500, `min_impressions` | Ранжированные возможности с доказательствами и `expected_gain` |
| `seo_log_analysis` | `file` (абсолютный путь), `bot` (`googlebot`, `yandexbot`, `bingbot`, `other` или пусто) | Сводка по ботам и crawl waste для одного локального JSON-лога nginx |
| `seo_recrawl_request` | `host_id` (по умолчанию настроенный хост), `urls`, `allow_write` (по умолчанию `false`), `plan_hash`, `confirm_token` | Двухфазная запись с воротами; `WRITE_DISABLED`, пока адаптер провайдера не подключён |
| `seo_sitemap_submit` | `property`, `sitemap_url`, `action`, `allow_write` (по умолчанию `false`), `plan_hash`, `confirm_token` | Двухфазная запись с воротами; `WRITE_DISABLED`, пока адаптер провайдера не подключён |

`gsc_search_analytics` по умолчанию берёт последние семь полных дней в `report.timezone`. `seo_weekly_report` не принимает свойство: свойство, часовой пояс и задержка по умолчанию берутся из конфигурации. `seo_opportunities` возвращает `expected_gain` — оценку приоритета, а не обещание трафика.

MCP-инструмент недельного отчёта ограничивает `days` сверху 90, а `lag_days` — 14, с предупреждением; значения ниже минимума отклоняются. CLI принимает `--days` до 3660. Если нужен более длинный период, используйте CLI.

`seo_crawl_site` фильтрует по реальным id правил, например `robots-blocked`, `broken-internal-link` или `canonical-mismatch`. Параметра `rules` и флага `--ignore-robots` не существует. Возвращаемый список проблем ограничен 500 с `meta.issues_shown`, `meta.issues_truncated` и `meta.issues_filtered_by`. Карта сайта, которая не загрузилась, сообщает только тип исключения, но не URL и не query-строку.

`seo_log_analysis` — двенадцатый инструмент и единственный, которому не нужны сервис, хранилище или рабочая область. Он читает один локальный JSON access-лог nginx не более 100 MiB, возвращает те же `data`, `meta` и `warnings`, что и `lv24-seo logs analyze`, и работает только на чтение: файл открывается один раз и никуда не отправляется и не сохраняется. Классы ботов определяются только по User-Agent, поэтому результат — триаж, а не доказательство идентичности краулера.

`yandex_indexing_state` сохраняет сообщённые провайдером события по URL в таблице `indexing_events`, когда есть хранилище. Повтор обновляет `last_seen` без дублирования, `first_seen` неизменяем, `meta.indexing_events` сообщает `new`, `existing`, `skipped` и `truncated`, а за один вызов рассматривается не более 500 строк провайдера. Сбои хранилища становятся предупреждениями, а не неудачным чтением провайдера. Недельный отчёт читает эти события как доказательства для дайджеста. Тот же вызов объединяет документированную серию `indexing/history` (`http_2xx` … `other`) в одну строку на дату, сохраняет неизвестную серию в `extra_indicators` и сообщает `summary.site_problems`; пропущенный счётчик остаётся отсутствующим, а не становится `0`.

`cwv collect` — писатель CLI, а не тринадцатый инструмент: поверхность MCP остаётся в 12. `seo_weekly_report` читает полевые строки, сохранённые CLI, и добавляет раздел `cwv` с группировкой по шаблону URL и устройству, не более пяти шаблонов. Лабораторные строки PSI никогда не сохраняются, поэтому один `--source psi` не может заполнить этот раздел.

GSC может аутентифицироваться сервисным аккаунтом вместо вставленного OAuth-токена. Задайте `providers.gsc.service_account_file` (абсолютный путь) или `LV24_SEO_GSC_SERVICE_ACCOUNT_FILE`; файл важнее сохранённого `gsc_token`, а окружение важнее файла. Адаптер подписывает RS256 JWT, обменивает его в `token_uri` ключа и обновляет до истечения, поэтому долгоживущий процесс MCP переживает истечение токена. `seo_properties` сообщает `token_source`, а `doctor` добавляет некритичную проверку `gsc_auth`; ни один не печатает JSON или приватный ключ.

## Ресурсы

| URI | Содержимое |
|---|---|
| `seo://config` | Эффективная конфигурация с вырезанными секретами |
| `seo://report/latest` | Последний успешный недельный отчёт в этой сессии сервера, в Markdown |
| `seo://docs/tools` | Сгенерированная JSON-справка по двенадцати инструментам |

Существуют ровно три ресурса. Ресурса базовой линии по свойству нет.

## Промпты

| Имя | Назначение |
|---|---|
| `weekly_seo_review` | Полный конвейер: отчёт, триаж индексирования, возможности, пять главных действий |
| `indexing_triage` | Только триаж, вывод в виде плана исправлений с проверкой |
| `content_opportunities` | Возможности, превращённые в приоритизированный контент-бэклог |

Промпты используют только числа, возвращённые инструментами, называют недоступные источники вместо оценки и просят перечислить ограничения, влияющие на вывод.

## Транспорты

```bash
lv24-seo mcp serve
lv24-seo mcp serve --transport http --port 8765
```

`stdio` — по умолчанию: локальный процесс с учётными данными на машине пользователя. `http` означает streamable HTTP для VPS или многоклиентской схемы; устаревший транспорт HTTP+SSE намеренно отклоняется. Порт должен быть 1–65535, по умолчанию 8765.

Синхронное ядро выполняется последовательно в потоке event loop. MCP 2 запускает синхронные обработчики в рабочих потоках, поэтому инструменты зарегистрированы как async-адаптеры owner-loop, а параллельные запросы `tools/call` сериализуются, а не соревнуются в SQLite. Соединение намеренно сохраняет `check_same_thread=True`.

`seo_crawl_site` — единственное исключение: обход тысяч URL раньше блокировал всех остальных клиентов на минуты. Теперь он идёт в рабочем потоке с собственным короткоживущим хранилищем (соединение `sqlite3` принадлежит потоку, который его открыл) и жёстким бюджетом 600 секунд. Когда бюджет исчерпан, клиент получает повторяемый конверт `UPSTREAM_UNAVAILABLE`, чей `next_action` предлагает меньший `max_urls`; поток нельзя убить, поэтому обход завершается в фоне и закрывает своё соединение, пока сервер продолжает обслуживать другие инструменты. Все остальные инструменты остаются на owner loop.

## Регистрация клиента

```bash
lv24-seo install --client claude --print
lv24-seo install --client opencode
lv24-seo install --client vscode
lv24-seo install --client cursor
```

`install` вливает запись сервера в конфигурацию хоста, а не заменяет файл; `--print` показывает точный JSON и ничего не пишет.

| Клиент | Путь конфигурации |
|---|---|
| Claude | `%APPDATA%\Claude\claude_desktop_config.json` в Windows, `~/Library/Application Support/Claude/claude_desktop_config.json` в macOS, `~/.config/Claude/claude_desktop_config.json` в Linux |
| OpenCode | `~/.config/opencode/opencode.json` |
| Cursor | `~/.cursor/mcp.json` |
| VS Code | `%APPDATA%\Code\User\mcp.json` в Windows, `~/Library/Application Support/Code/User/mcp.json` в macOS, `~/.config/Code/User/mcp.json` в Linux |

Фрагмент для Claude и Cursor использует `mcpServers`; OpenCode использует `mcp` с `type: local` и массивом команды; VS Code использует `servers` с `type: stdio`. Канонический stdio-фрагмент:

```json
{
  "mcpServers": {
    "lv24-seo": {
      "command": "uvx",
      "args": ["--from", "lv24-seo", "lv24-seo", "mcp", "serve"]
    }
  }
}
```

## Экспорт контрактов и навыков

```bash
lv24-seo export tools --out schemas/tools.json
lv24-seo export skills --out ./skills
lv24-seo export skills --out ~/.claude/skills
lv24-seo export skills --out .opencode/skills
```

`export tools` записывает сгенерированный реестр для агентов, которые не говорят на MCP и вызывают CLI с `--json`. `export skills` копирует упакованные навыки и `manifest.json`; это работает из wheel, а не только из checkout.

Поставляемые навыки:

| Навык | Триггер | Инструменты |
|---|---|---|
| `seo-weekly` | «Как SEO?», «Почему упал трафик?», запрос недельного отчёта | `seo_weekly_report`, `gsc_search_analytics`, `yandex_query_stats`, `seo_opportunities`, `seo_indexing_triage` |
| `seo-indexing-triage` | Страницы пропали из Google или Yandex, ошибки карты сайта, внезапные исключения | `seo_indexing_triage`, `gsc_search_analytics`, `seo_crawl_site`, `yandex_indexing_state`, `seo_recrawl_request` |
| `seo-technical-audit` | Перед релизом, после деплоя, после миграции | `seo_crawl_site`, `gsc_search_analytics`, `yandex_indexing_state`, `seo_sitemap_submit` |

Навык — это папка с `SKILL.md` и опциональными references, scripts и assets. Тело следует фиксированной структуре: когда использовать и когда нет, какие входы нужны, рецепт упорядоченных вызовов, дерево решений, контракт вывода и жёсткие правила. Описание — это триггер; в нём должны быть слова, которые использует пользователь или модель-маршрутизатор.

Зеркала вроде `.claude/skills/<name>` и `.opencode/skills/<name>` запланированы, но не поставляются. Для установки канонического набора используйте `export skills`.

`manifest.json` хранит хеш схемы `schemas/tools.json`. CI падает, когда инструмент переименован или его входы изменены без обновления навыка.

## Контракт ошибок

```json
{
  "isError": true,
  "code": "QUOTA_EXCEEDED",
  "message": "Yandex recrawl quota is 12/day, 40 requested",
  "next_action": "split the batch or wait until 00:00 MSK",
  "retryable": false
}
```

Коды: `AUTH_REQUIRED`, `AUTH_INVALID`, `PROPERTY_NOT_FOUND`, `QUOTA_EXCEEDED`, `UPSTREAM_UNAVAILABLE`, `TRUNCATED`, `WRITE_DISABLED`, `CONFIRM_REQUIRED`, `INVALID_INPUT`, `CONFIG_INVALID`, `INTERNAL`, `STORE_LOCKED`, `STORE_CORRUPT`, `STORE_UNAVAILABLE`. Ошибки несут код и `next_action`, никогда — traceback или токен. Ошибка `STORE_LOCKED` повторяема; `STORE_CORRUPT` называет сохранённую резервную копию в `detail.backup_path`.

## Примеры промптов для агента

- **Недельный обзор.** Используй `seo_weekly_report` для настроенного свойства за последние 7 дней, затем `seo_indexing_triage` и `seo_opportunities`. Дай пять главных действий по влиянию и перечисли все ограничения, влияющие на вывод.
- **Триаж индексирования.** Запусти `seo_indexing_triage`. Для каждой непустой корзины укажи причину, точное количество, два примера URL и предложенный `next_action`, затем скажи, как будет проверено исправление.
- **Технический аудит.** Обойди до 500 URL через `seo_crawl_site` и суммируй критические и высокие проблемы по id правила. Не называй необойдённый URL битым.
- **Запрос записи.** Подготовь план переобхода для этих URL и сначала покажи квоту. Ничего не записывай, пока я не утвержу план.

Source: `_source/engine-mcp.md`, `_source/engine-skills.md`, `_source/engine-cli.md`, `_source/engine-releases-0.5.2.md`, `_source/engine-releases-0.5.3.md`, `_source/engine-releases-0.6.0.md`, `_source/engine-releases-0.7.0.md`, `_source/engine-releases-0.8.0.md`.

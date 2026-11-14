---
title: MCP и навыки агентов
description: Одиннадцать инструментов MCP, три ресурса, три промпта, транспорты, регистрация клиентов и поставляемые навыки агентов.
---

# MCP и навыки агентов

MCP-сервер предоставляет небольшую, продуманную поверхность: 11 инструментов, 3 ресурса и 3 промпта. Реестр инструментов — единственный источник истины; JSON-схемы, справка CLI и `schemas/tools.json` генерируются из него и никогда не редактируются вручную.

См. также: [Отчёты и диффы](/ru/reports/), [Источники данных и квоты](/ru/providers/), [Обход и аудит](/ru/crawl/), [Автоматизация и доставка](/ru/automation/).

## Только чтение по умолчанию

Ответы чтения, которые оборачивают строки провайдера, несут `truncated`, `total` (когда провайдер его сообщает), `data_age_days` и `limitations[]`. Инструменты чтения не принимают параметр `format`. Ответы доступны текстом и, если установленный MCP SDK это поддерживает, как `structuredContent`; текстовый блок — запасной вариант для старых клиентов.

Два инструмента сохраняют локальное состояние и больше не рекламируются как read-only:

| Инструмент | `kind` | `writes_local_state` | `readOnlyHint` | `destructiveHint` | `idempotentHint` |
|---|---|---|---|---|---|
| `seo_crawl_site` | read | `true` | `false` | `false` | `false` |
| `seo_weekly_report` | read | `true` | `false` | `false` | `false` |

Они сохраняют снимки обхода или недельного отчёта, но никогда не меняют состояние провайдера и не требуют токен подтверждения. MCP-клиенты, которые смотрят на `readOnlyHint`, могут запросить подтверждение перед их вызовом; это намеренно.

Два инструмента записи несут `destructiveHint: true` и требуют `allow_write=true`. В 0.5.1 их обработчики провайдеров не подключены, поэтому они возвращают `WRITE_DISABLED`, а не делают вид, что запись произошла. Путь записи CLI имеет дополнительный сухой прогон и HMAC-токен подтверждения, описанные в [Автоматизации и доставке](/ru/automation/).

## Инструменты

| Инструмент | Входы | Возвращает |
|---|---|---|
| `seo_properties` | Нет | Настроенные провайдеры, их цель и наличие токена |
| `gsc_search_analytics` | `property`, `start_date`, `end_date`, `dimensions`, `limit` 1–500 (по умолчанию 50) | Строки по запросу, странице, стране или устройству с кликами, показами, CTR и позицией |
| `yandex_query_stats` | `host_id`, `limit` 1–500, `order_by` `TOTAL_SHOWS` или `TOTAL_CLICKS` | Топ-запросы с показами, кликами и позицией |
| `yandex_indexing_state` | Нет, кроме настроенного хоста | История индексирования, количество страниц в поиске и диагностика |
| `seo_crawl_site` | `start_url`, `max_urls` 0 или 1–5000, `include_rules` | Сводка обхода, проблемы, граф ссылок и покрытие карты сайта |
| `seo_weekly_report` | `days` 1–90, `lag_days` 0–14 | Разделы недельного отчёта плюс meta конверта |
| `seo_report_diff` | `base`, `head` в формате `START..END` | Изменения заголовка, количество проблем, движение возможностей, ограничения, Markdown |
| `seo_indexing_triage` | Нет | Корзины с причиной, количеством, примерами и `next_action` |
| `seo_opportunities` | `days` 1–90 (по умолчанию 28), `limit` 1–500, `min_impressions` | Ранжированные возможности с доказательствами и `expected_gain` |
| `seo_recrawl_request` | `host_id`, `urls`, `allow_write` | С подтверждением; в 0.5.1 возвращает `WRITE_DISABLED` |
| `seo_sitemap_submit` | `property`, `sitemap_url`, `action`, `allow_write` | С подтверждением; в 0.5.1 возвращает `WRITE_DISABLED` |

`gsc_search_analytics` по умолчанию берёт последние семь полных дней в `report.timezone`. `seo_weekly_report` не принимает свойство: свойство, часовой пояс и задержка по умолчанию берутся из конфигурации. `seo_opportunities` возвращает `expected_gain` — оценку приоритета, а не обещание трафика.

MCP-инструмент недельного отчёта ограничивает `days` диапазоном 1–90, а `lag_days` — 0–14 с предупреждением; CLI принимает `--days` до 3660. Если нужен более длинный период, используйте CLI.

`seo_crawl_site` фильтрует по реальным id правил, например `robots-blocked`, `broken-internal-link` или `canonical-mismatch`. Параметра `rules` и флага `--ignore-robots` не существует. Возвращаемый список проблем ограничен 500 с `meta.issues_shown`, `meta.issues_truncated` и `meta.issues_filtered_by`.

## Ресурсы

| URI | Содержимое |
|---|---|
| `seo://config` | Эффективная конфигурация с вырезанными секретами |
| `seo://report/latest` | Последний успешный недельный отчёт в этой сессии сервера, в Markdown |
| `seo://docs/tools` | Сгенерированная JSON-справка по одиннадцати инструментам |

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

Коды: `AUTH_REQUIRED`, `AUTH_INVALID`, `PROPERTY_NOT_FOUND`, `QUOTA_EXCEEDED`, `UPSTREAM_UNAVAILABLE`, `TRUNCATED`, `WRITE_DISABLED`, `CONFIRM_REQUIRED`, `INVALID_INPUT`. Ошибки несут код и `next_action`, никогда — traceback или токен.

## Примеры промптов для агента

- **Недельный обзор.** Используй `seo_weekly_report` для настроенного свойства за последние 7 дней, затем `seo_indexing_triage` и `seo_opportunities`. Дай пять главных действий по влиянию и перечисли все ограничения, влияющие на вывод.
- **Триаж индексирования.** Запусти `seo_indexing_triage`. Для каждой непустой корзины укажи причину, точное количество, два примера URL и предложенный `next_action`, затем скажи, как будет проверено исправление.
- **Технический аудит.** Обойди до 500 URL через `seo_crawl_site` и суммируй критические и высокие проблемы по id правила. Не называй необойдённый URL битым.
- **Запрос записи.** Подготовь план переобхода для этих URL и сначала покажи квоту. Ничего не записывай, пока я не утвержу план.

Source: `_source/engine-mcp.md`, `_source/engine-skills.md`, `_source/engine-cli.md`, `_source/engine-releases-0.5.1.md`.

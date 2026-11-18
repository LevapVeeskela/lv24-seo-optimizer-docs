---
title: Справочник CLI
description: Команды, глобальные флаги, JSON-конверт, коды выхода и примеры для командной строки lv24-seo.
---

# Справочник CLI

`lv24-seo` — командная строка движка. По умолчанию она только читает данные провайдеров, с флагом
`--json` печатает один машиночитаемый конверт, а состояние провайдеров меняет только через три
явно защищённые команды записи. Один и тот же исполняемый файл работает в Windows, macOS и Linux.

## Таблица команд

Таблицу можно фильтровать по команде, группе или описанию. Имена команд и флаги одинаковы во всех
локалях; переводится только документация вокруг них.

<CliTables />

Любая команда также принимает `--help` — он печатает актуальный список флагов установленной версии.

## Общие соглашения

### Конверт ответа

С флагом `--json` команда печатает ровно один JSON-документ и ничего больше:

```json
{ "ok": true, "data": {}, "meta": { "version": "0.14.0", "duration_ms": 812 }, "warnings": [] }
```

Неудачная команда использует ту же форму с `ok: false` и объектом `error` вместо `data`:

```json
{ "ok": false, "error": { "code": "AUTH_REQUIRED", "message": "Google Search Console token is missing", "retryable": false, "next_action": "lv24-seo auth login --provider gsc" }, "meta": { "version": "0.14.0" }, "warnings": ["gsc: token missing"] }
```

- `data` зависит от команды. В `meta` всегда есть `version`, часто добавляются `duration_ms`,
  `truncated`, `data_age_days`, `limitations`, `locale` или `complete`.
- `warnings` — короткие строки для человека. Агрегирующие команды вроде `stats` остаются
  `ok: true`, если один провайдер упал: сбой учитывается в `coverage` и попадает в `warnings`.
- Без `--json` выводится компактная текстовая сводка в stdout, затем предупреждения и строка
  ошибки. Ни один режим не печатает ANSI-цвета.
- `config show` добавляет `meta.redacted: true`; ключи, похожие на секреты, маскируются как `***`.

### Коды выхода

| Код | Значение | Коды ошибок |
|---|---|---|
| `0` | Успех. Конверт `ok: true`. | — |
| `1` | Непредвиденный внутренний сбой. | `INTERNAL` |
| `2` | Ошибка использования или конфигурации. | `INVALID_INPUT`, `CONFIG_INVALID`, `CONFIRM_REQUIRED`, `WRITE_DISABLED` |
| `3` | Ошибка аутентификации. | `AUTH_REQUIRED`, `AUTH_INVALID` |
| `4` | Квота или сбой вышестоящего сервиса. | `QUOTA_EXCEEDED`, `UPSTREAM_UNAVAILABLE` |
| `5` | Частичный результат: усечённый вывод в строгом режиме. | `TRUNCATED` или любой конверт `ok: true` с `meta.truncated` и `meta.strict` |

`WRITE_DISABLED` даёт код `2`, а не `4`: запись отклонена до обращения к провайдеру. Код `5` — это
частичный результат, а не жёсткая ошибка: данные настоящие, покрытие неполное. Ориентируйтесь на
код выхода и `error.code`, а не на текст для человека.

### `--strict` и код выхода 5

`--strict` превращает усечение в ворота CI. Флаг доступен в `stats`, `gsc query`, `yandex queries`,
`yandex indexing`, `yandex samples`, `yandex sitemaps`, `yandex history`, `yandex queue`, семи
чтениях `metrika`, `bing pages`, `bing traffic`, `bing crawl`, `bing urlinfo`, `bing children`,
`bing users`, `bing sites`, `bing joins`, `bing quota`, `bing sitemaps`, `bing issues`, `crawl`,
`report weekly` и `report diff`:

```bash
lv24-seo gsc query --start 2026-11-01 --end 2026-11-07 --strict --json
lv24-seo report weekly --days 7 --strict --json
```

- `meta.strict` выставляется всегда, когда передан флаг, поэтому потребитель отличает строгий запуск от обычного.
- Полный ответ по-прежнему даёт код `0`.
- Усечённый ответ остаётся `ok: true` — данные настоящие — но даёт код `5`, а `meta.limitations` объясняет, чего не хватает. Если провайдер выставил `truncated` без примечания об ограничении, CLI добавляет его.
- Без `--strict` усечённый ответ даёт код `0` и не несёт `meta.strict`.

`report diff --markdown` соблюдает тот же код: Markdown по-прежнему печатается в stdout, а процесс
даёт код `5`, когда дифф усечён в строгом режиме.

### Сбои хранилища

Проблемы SQLite больше не выглядят как общий `INTERNAL`. Их заменяют три стабильных кода:

| Код | Значение | Повторяемо | Что делать |
|---|---|---|---|
| `STORE_LOCKED` | Другой процесс держит блокировку записи дольше busy timeout | Да | Дождитесь завершения другого запуска `lv24-seo` и повторите; ничего не записано |
| `STORE_CORRUPT` | Файл не является пригодной базой SQLite | Нет | Изучите `detail.backup_path`, затем переместите или удалите базу и повторите |
| `STORE_UNAVAILABLE` | Права, отсутствующий родительский каталог, заполненный диск | Нет | Исправьте каталог данных и запустите `lv24-seo doctor` |

Повреждённый файл копируется рядом с собой как `seo.sqlite3.corrupt-20260101T101010Z` до любых
других действий; оригинал никогда не перемещается и не удаляется, а неудачная копия не скрывает
ошибку. Все три кода дают код выхода `1`, как `INTERNAL`; ориентируйтесь на `error.code`.

### Конфигурация и флаги

- `--config PATH` выбирает конкретный `seo.toml`. Путь должен существовать; отсутствующий файл —
  это `CONFIG_INVALID`, а не тихий откат к умолчаниям. Разрешённый путь абсолютный и
  нормализованный, поэтому артефакты планировщика и относительные настройки не зависят от
  рабочего каталога процесса. Тот же путь выбирает рабочую область, чей каталог данных хранит
  журнал записи, поэтому применение записывает заявку там, где указывает конфиг, а не в рабочем
  каталоге оболочки.
- Без `--config` движок ищет `./seo.toml`, затем пользовательский конфиг платформы
  (`%APPDATA%\lv24-seo\config.toml` в Windows, `~/.config/lv24-seo/config.toml` в Linux).
- Переменные `LV24_SEO_*` перекрывают значения из файла. Файлы `.env` не загружаются
  автоматически; экспортируйте переменные в оболочке или в unit-файле сервиса.
- `mcp serve` — долгоживущий сервер, он не принимает ни `--json`, ни `--config`.

`doctor --json` сообщает `meta.data_dir`, `meta.data_dir_source` (`config`, когда эффективный
каталог абсолютный, `working directory`, когда относительный) и `meta.data_dir_declared` — true,
когда конфиг или `LV24_SEO_DATA_DIR` задаёт каталог. Объявленный каталог данных критичен:
отсутствующий или непригодный валит проверку. Относительный каталог сам по себе не ошибка, но рядом
с конфигом добавляет предупреждение с папкой конфига.

Полный список ключей, умолчания и работа с секретами — в
[справочнике конфигурации](/ru/reference/config/).

### Только чтение по умолчанию и шлюз записи

Менять состояние провайдера могут только `sitemap submit`, `bing submit`, `yandex recrawl`, `indexnow submit` и `indexing run --allow-write`.
Они работают в два шага:

1. Задайте длинный случайный `LV24_SEO_WRITE_SECRET`, затем запустите команду с `--allow-write` и без
   `--confirm`. Она вернёт план с `data.plan`, `data.plan_hash`, `data.confirm_token` и
   `meta.dry_run: true` и не обратится к провайдеру.
2. Повторите запуск с `--allow-write --confirm TOKEN` в течение пяти минут.

Токен — это HMAC от действия, цели, полного хеша плана и срока действия, поэтому изменение любого
входа его аннулирует. При инициализированной рабочей области CLI подключает SQLite-журнал
идемпотентности: повторный токен возвращает `status: skipped` с `reason: duplicate`, и провайдер
вызывается один раз. Журнал открывается из каталога данных выбранной рабочей области:
`--config /srv/site/seo.toml` записывает заявку в `/srv/site/data`, даже если оболочка находится в
другом месте. Без каталога данных применение всё равно выполняется, но конверт предупреждает, что
защита от повтора отключена на пять минут жизни токена; dry run не открывает журнал и не создаёт
базу.

IndexNow, отправка sitemap в Bing и отправка URL в Bing действительно пишут. Отправка URL в Bing сообщает
`accepted`, а не «проиндексировано», потому что у `SubmitUrlbatch` нет статуса по каждому URL. Отправка
sitemap в GSC, удаление sitemap в Bing и переобход в Яндексе возвращают `WRITE_DISABLED`, а не делают вид,
что вызов провайдера состоялся.

### Логирование

Логирование опционально. `LV24_SEO_LOG_LEVEL=INFO` (или `DEBUG`, `WARNING`, …) устанавливает
redacting-handler в CLI и `lv24-seo mcp serve`; если переменная не задана, конфигурация
логирования вызывающего не меняется. Вывод — одна JSON-строка на запись, когда stderr не
терминал, и обычная строка иначе. MCP-транспорт пишет только в stderr; stdout остаётся
протоколом. Конверт `--json` остаётся стабильным интерфейсом диагностики.

### Детерминизм и честность данных

- Даты — ISO-8601 (`2026-11-10`); отметки времени — ISO-8601 UTC (`2026-11-14T12:00:00+00:00`).
- Порядок полей в CLI стабилен, сохранённые снимки сериализуются с сортировкой ключей, а в видимом
  выводе нет случайных идентификаторов. Отчёты и диффы рассчитаны на сравнение между запусками.
- Ограниченные ответы несут `truncated`, `total`, `data_age_days` и `limitations[]`, где это
  применимо. Метрика, присутствующая только в одном окне, помечается как неизвестная, а не как ноль.
- `--days` принимает `1..3660`; большее значение падает с `INVALID_INPUT` и кодом `2`.
- Ни одна команда не печатает токен, cookie или полный заголовок `Authorization`.

## Группы команд

| Группа | Команды | Что затрагивает |
|---|---|---|
| Start | `version`, `doctor`, `init`, `properties`, `stats` | Локальные файлы и окружение; `stats` читает KPI провайдеров без записи. |
| Authentication | `auth status`, `auth set`, `auth login`, `auth logout` | Локальное хранилище секретов; `login` только печатает инструкции. |
| Configuration | `config show` | Действующая конфигурация с замаскированными учётными данными. |
| Google Search Console | `gsc query`, `gsc inspect`, `gsc sitemaps`, `gsc sitemap` | Аналитика поиска с фильтрами, URL Inspection и чтение карт сайта только для чтения. |
| Sitemap | `sitemap submit` | Защищённая запись; Bing `SubmitFeed` подключён, отправка GSC всё ещё возвращает `WRITE_DISABLED`. |
| Yandex Webmaster | `yandex queries`, `yandex indexing`, `yandex samples`, `yandex sitemaps`, `yandex history`, `yandex queue`, `yandex recrawl` | Запросы, события, примеры, карты, история и очередь только для чтения; recrawl — защищённая запись с ограничением по остатку квоты. |
| Yandex Metrika | `metrika pages`, `metrika goals`, `metrika queries`, `metrika devices`, `metrika countries`, `metrika engagement`, `metrika bytime` | Органические представления только для чтения; каждый вызов применяет `ym:s:lastTrafficSource=='organic'`. |
| IndexNow | `indexnow submit` | Защищённая запись, которая отправляет явные URL или URL, прочитанные из sitemap проекта. |
| Bing | `bing submit`, `bing pages`, `bing traffic`, `bing crawl`, `bing urlinfo`, `bing children`, `bing users`, `bing sites`, `bing joins`, `bing sitemaps`, `bing issues`, `bing quota` | `submit` — защищённая запись `SubmitUrlbatch`; остальные читают страницы, трафик, обход, URL, связки, карты, проблемы и квоту. |
| Crawl and audit | `crawl` | Не зависит от провайдеров; сохраняет локальные страницы и проблемы, если настроено хранилище. |
| Indexing | `indexing status`, `indexing run`, `indexing history` | `status` и `history` только читают; `run` по умолчанию планирует и отправляет в пределах свежих квот только с `--allow-write`. |
| CWV | `cwv collect`, `cwv audits`, `cwv history` | `collect` сохраняет полевые строки p75 CrUX; `audits` и `history` — чтение PSI/CrUX. |
| Reports | `report weekly`, `report diff` | `weekly` сохраняет локальный снимок; `diff` только читает. |
| Scheduling | `schedule print`, `schedule install`, `schedule status`, `schedule uninstall` | `print` только рендерит; `install` и `uninstall` по умолчанию планируют и пишут только с `--allow-write`; `status` только читает. |
| Logs | `logs analyze` | Читает один локальный JSON access-лог nginx; не сохраняет и не отправляет его. |
| Tasks | `tasks list`, `tasks add`, `tasks update` | Журнал задач рабочей области; `add` идемпотентен, `update` соблюдает разрешённые переходы. |
| Backup | `backup create`, `backup restore` | `create` пишет один переносимый архив рабочей области; `restore` планирует замену на месте или распаковывает в новый каталог с `--to`. |
| Portfolio | `portfolio list` | Сводка локальных проектов ниже одного каталога только для чтения; без вызова провайдера, чтения токена и записи. |
| Agents and MCP | `mcp serve`, `install`, `export tools`, `export skills` | Конфиг хоста, сгенерированные файлы или локальный сервер. |

В CLI 25 команд верхнего уровня: 18 групп и 7 команд (`version`, `doctor`, `init`, `properties`, `stats`, `crawl`, `install`).

## Примеры

### Снимок для дашборда

```bash
lv24-seo stats --days 7 --lag-days 2 --json
```

Только чтение, хранилище не нужно. Сервисы всегда идут в порядке `gsc`, `yandex_webmaster`,
`yandex_metrika`, `bing`, `crux`, `psi`; в `metrics` только реально полученные значения, без
заполнения нулями и без сумм между движками. Сбой одного провайдера изолирован и увеличивает
`coverage.failed`.

### Search Console

```bash
lv24-seo gsc query --start 2026-11-01 --end 2026-11-07 --dimensions query,page --limit 100 --json
lv24-seo gsc query --start 2026-11-01 --end 2026-11-07 --type image --data-state all --filter country:equals:BLR --json
lv24-seo gsc inspect --url https://example.com/ --language en-US --json
lv24-seo gsc sitemaps --sitemap-index https://example.com/sitemap-seo.xml --json
lv24-seo gsc sitemap --path https://example.com/sitemap.xml --json
```

`--start` и `--end` обязательны. Сокращения `--days` и переопределения `--property` нет: ресурс
берётся из `[providers.gsc]` в `seo.toml`. Измерения перечисляются через запятую и ограничены
`query`, `page`, `country`, `device` и `date`.

`--type` принимает `web`, `image`, `video`, `news`, `discover`, `googleNews` и `webMultimodal`.
`--filter` принимает `dimension:operator:expression` и может повторяться (одна группа AND);
`--filter-list` принимает `dimension:expr1,expr2` и может повторяться. `--data-state` принимает
`all`, `final` и `hourly_all`; `--aggregation` — `auto`, `byPage`, `byProperty` и
`byNewsShowcasePanel`; `--search-appearance` добавляет фильтр `searchAppearance equals`;
`--branded` принимает `branded` или `non_branded` и отклоняется вместе с фильтром `query`.

`gsc inspect` обрабатывает ровно один абсолютный URL. Он отображает полный `indexStatusResult`,
расширенные результаты и `inspectionResultLink`, а также сообщает `one_url_per_call`,
`url_inspection_quota_2000_per_day` и `inspection_reflects_last_crawl`: это описание последнего
обхода Google, а не живой тест. `gsc sitemaps` и `gsc sitemap --path` отображают тип, признак
индекса, ошибки, предупреждения и `contents[]`; устаревший счётчик `indexed` помечается, а
дочерние URL индекса не раскрываются. Отправка/удаление карты остаются `WRITE_DISABLED`.

### Яндекс

```bash
lv24-seo yandex queries --limit 100 --json
lv24-seo yandex indexing --date-from 2026-10-01 --date-to 2026-10-31 --json
lv24-seo yandex samples --kind events --limit 100 --json
lv24-seo yandex sitemaps --json
lv24-seo yandex history --kind sqi --json
lv24-seo yandex queue --json
```

`yandex queries` возвращает верхние строки, а не полную связку запрос-страница: Яндекс отдаёт не
более 3 000 запросов за период. Он сохраняет `avg_click_position`, возвращает `query_id`, когда
провайдер его присылает, и сохраняет неизвестный индикатор в `extra_indicators` вместо отбрасывания
строки. `yandex indexing` показывает историю индексирования, число страниц в поиске, диагностику,
`site_problems` и события поисковых URL для настроенного `host_id`, а также объединяет серию
`indexing/history` (`http_2xx` … `other`) и серию appeared/removed в одну строку на дату. Окно дат,
которое провайдер сбрасывает, повторяется без фильтра и сообщается как `client_side_date_filter`.

`yandex samples` листает endpoint примеров по 100 строк с честными итогами. `yandex sitemaps`
перечисляет id, URL, число ошибок/URL, детей и источники; добавление/удаление не реализовано.
`yandex history --kind sqi|in-search|queries|query` читает SQI, страницы в поиске, все запросы и
ряды одного запроса. `yandex queue` читает задачи переобхода и общее число провайдера.

`yandex recrawl --url https://example.com/page --allow-write` планирует запись; `--confirm TOKEN`
применяет один POST на URL с ограничением по остатку дневной квоты. Строка `202` несёт `task_id` и
`quota_remainder`, `409` — `already_queued`, а `429` останавливает цикл и оставляет остаток в
`not_attempted`.

### Bing и IndexNow

```bash
lv24-seo sitemap submit --provider bing --allow-write --json
lv24-seo sitemap submit --provider bing --allow-write --confirm TOKEN --json
lv24-seo bing submit --url https://example.com/page --allow-write --json
lv24-seo bing submit --url https://example.com/page --allow-write --confirm TOKEN --json
lv24-seo bing pages --json
lv24-seo bing traffic --json
lv24-seo bing crawl --json
lv24-seo bing urlinfo --url domain:example.com --json
lv24-seo bing children --url domain:example.com --page 0 --pages 2 --json
lv24-seo bing users --json
lv24-seo bing sites --json
lv24-seo bing joins --query "seo tools" --json
lv24-seo bing quota --json
lv24-seo bing sitemaps --json
lv24-seo bing issues --json
lv24-seo indexnow submit --from-sitemap --allow-write --json
lv24-seo indexnow submit --from-sitemap --allow-write --confirm TOKEN --json
```

`--provider` у `sitemap submit` по умолчанию `gsc`; `bing` берёт сайт из `providers.bing.site` или
`--property`, sitemap — из `--url` или `<project.base_url>/sitemap.xml`, а ключ — из секрета
`bing_api_key`. Плану нужны `--allow-write` и `LV24_SEO_WRITE_SECRET`; он выпускает токен, не вызывая Bing.
Применение отправляет проверенный токен и фиксирует заявку в журнале идемпотентности. `bing submit` —
нативная отправка URL: URL берутся из повторяемого `--url` и/или `--from-sitemap`, план сообщает число
URL, число пакетов по 500 URL и остаток квоты, а применение вызывает `SubmitUrlbatch` после дневной и
месячной проверки квоты. Успех пакета не содержит статуса по URL, поэтому результат говорит `accepted`,
а не «проиндексировано», и повторный URL может израсходовать квоту. `bing quota` сообщает
`daily_remaining` и `monthly_remaining`, а не всего; месячное окно может закончиться раньше, а расписание
сброса не документировано. `bing sitemaps` показывает URL фида, статус провайдера, последний обход и
число URL, но не ошибки по отдельным URL, а `bing issues` декодирует битовую маску проблем и не имеет
серьёзности или даты.

`bing pages`, `bing traffic`, `bing crawl` и `bing joins` — представления статистики только для чтения.
Пустой ответ статистики несёт `no_rows_for_window` и не является нулём показов; `bing crawl` всегда
несёт `crawl_stats_six_month_window`. `bing urlinfo --url URL|domain:HOST` читает данные индексации и
обхода URL; сентинел WCF `Date(-62135596800000)` отображается в `null`, а строка никогда не обходившегося
URL несёт `never_crawled`. `bing children` листает не более 10 страниц и помечает полную последнюю
страницу `truncated` с `children_page_cap`. `bing users` читает роли сайта без вывода делегированных
кодов; `bing sites` читает подтверждённые сайты аккаунта. `bing joins --query|--page` выбирает одну из
трёх связок запрос/страница и возвращает одинаковую компактную строку.

`indexnow submit --from-sitemap` читает sitemap во время плана и берёт хост, ключ и
расположение ключа из `providers.bing.site`, `providers.bing.indexnow_key` и
`providers.bing.indexnow_key_location`. Ключ должен состоять из 8–128 символов `A-Z`, `a-z`, `0-9` и
`-`; каталог `keyLocation` на том же хосте обязателен. `<sitemapindex>` ограничен корнем плюс пятью
дочерними sitemap и 10 000 URL; явные `--url` объединяются первыми, URL вне хоста пропускаются.
Применение заново загружает sitemap и аннулирует токен с `CONFIRM_REQUIRED`, если набор URL изменился.
Отсутствующий ключ — `AUTH_REQUIRED` на этапе плана. Статусы провайдера: `200` accepted, `202`
accepted-pending, `400` формат, `403` отсутствующий/несовпадающий файл ключа, `422` несоответствие
хоста/ключа и `429` квота/спам; ключ никогда не выводится.

### Автоматизация индексации

```bash
lv24-seo indexing status --live --json
lv24-seo indexing status --provider bing --limit 50 --json
lv24-seo indexing run --from-sitemap --max-submit 20 --max-inspect 5 --json
lv24-seo indexing run --from-sitemap --allow-write --json
lv24-seo indexing history --limit 20 --json
```

`indexing status` только читает. `--live` читает квоты Bing `GetUrlSubmissionQuota` и Яндекса
`recrawl/quota`; без него показывается последняя записанная квота с `quota_not_live`. GSC и IndexNow
используют локальные счётчики UTC-дня, потому что ни один провайдер не отдаёт остаток. Каждая запись
провайдера несёт `urls`, `submitted`, `inspected`, `indexed`, `not_indexed`, `crawled`, `queued`,
`pending`, `stale`, `quota` и `limitations`, плюс `write_secret_present`.

| Движок | Источник остатка квоты | Лимит за запуск |
|---|---|---|
| Bing | `GetUrlSubmissionQuota`, дневной и месячный остаток | 500 URL на `SubmitUrlbatch`; план ограничен меньшим остатком |
| Яндекс | `recrawl/quota` `quota_remainder` | Один POST на URL; пакетного endpoint нет |
| GSC | API остатка нет; локальный счётчик `quota_usage` за UTC-день | 2 000 проверок/день/сайт по умолчанию, `max_inspect_per_run` 20 |
| IndexNow | API статуса и квоты нет; локальный счётчик за UTC-день | 1 000 отправок/день по умолчанию, 10 000 URL на POST |

`indexing run` собирает очередь того же хоста из `<project.base_url>/sitemap.xml` (10 000 URL и шесть
документов sitemap) и/или повторяемых `--url`, затем планирует по приоритету: ещё не отправленные,
`lastmod` новее `last_submitted_at`, проверка старше `check_interval_days`, затем остальные. Проверки
только читают и выполняются в обоих режимах: GSC URL Inspection (`PASS`/`Submitted and indexed` →
`indexed`; `NEUTRAL`/`FAIL` → `not_indexed`) и Bing `GetUrlInfo` (`crawled`, если есть дата обхода,
иначе `unknown`). Без `--allow-write` ничего не отправляется. С ним движок заново читает квоты,
проверяет хеш плана, выпускает и расходует внутренний confirm-токен и пишет одну строку
`indexing_runs` на провайдера.

Лимиты применяются до вызова провайдера: `max_submit_per_run` (по умолчанию 500), остаток
дневной/месячной квоты Bing, `quota_remainder` Яндекса, `max_inspect_per_run` (по умолчанию 20),
локальный `gsc_inspect_daily_limit` (2 000) и `indexnow_daily_limit` (1 000). Исчерпанная квота —
`quota_exhausted` с `submitted: 0` и `not_attempted`; ноль никогда не означает «всё проиндексировано».
`--allow-write` требует `[indexing] enabled = true` и `LV24_SEO_WRITE_SECRET`, иначе команда падает
с `WRITE_DISABLED`.

Агрегат GSC `contents[].indexed` из sitemap отдаётся отдельно как `indexed_total` с
`gsc_indexed_count_deprecated`. Bing, Яндекс и IndexNow не дают счётчик по URL, поэтому их
`indexed_total` равен `null` с `no_per_url_index_count`; Bing также несёт `site_scan_no_api`,
Яндекс — `yandex_no_per_url_index_status`, IndexNow — `indexnow_no_status_api`.

### Core Web Vitals

```bash
lv24-seo cwv collect --url https://example.com/ --url https://example.com/blog/post --device phone --source crux --category performance --json
lv24-seo cwv audits --url https://example.com/ --strategy mobile --category performance --json
lv24-seo cwv history --origin https://example.com --device phone --weeks 12 --json
```

`cwv collect` — писатель, стоящий за недельным разделом `cwv`. CrUX опрашивается по каждому URL и
устройству (`mobile` — псевдоним `phone`), и каждый полученный p75 становится полевой строкой
`metric_daily` с `source=crux`, `scope`, абсолютным URL, метрикой и датой получения в
`report.timezone`. Строки PSI остаются в `data.lab` и никогда не сохраняются, а у PSI нет `tablet`,
поэтому `tablet` пропускается как `psi_tablet_unsupported`. `--limit` ограничивает URL 50 (по
умолчанию 10); URL с низким трафиком не пишет строку, а не ноль, а усечённый запуск ставит
`meta.truncated: true` с `cwv_url_cap`. `--category` повторяем и выбирает категории Lighthouse для
пути PSI. `data_age_days` берётся из `collectionPeriod.lastDate`; двухдневная эвристика — только
запасной вариант с `crux_period_missing`, а нормализованный URL добавляет `crux_url_normalized`.
Команде нужен ключ CrUX (`AUTH_REQUIRED` до любого вызова) и инициализированное хранилище
(`CONFIG_INVALID`).

`cwv audits` возвращает не более 100 строк аудитов Lighthouse (`psi_audits_cap`) с оценкой,
отображаемым значением, описанием без HTML и экономией; массивы элементов никогда не включаются.
`runtimeError`, CAPTCHA или другой `finalUrl` становятся предупреждением/ограничением, а не чистым
запуском. Ничего не сохраняется.

`cwv history` читает недельные периоды p75 CrUX, новые последними, с `first_date`/`last_date`,
необязательным каноническим устройством и доступными метриками. `--weeks` — 1..40. Пропущенные
ячейки p75 становятся `crux_history_gaps` и никогда не заполняются; меньше периодов, чем запрошено,
добавляет `crux_history_short`. История только для чтения и не сохраняется.

### Yandex Metrika

```bash
lv24-seo metrika pages --days 7 --lag-days 2 --limit 100 --json
lv24-seo metrika goals --days 7 --dimension page --json
lv24-seo metrika queries --days 7 --json
lv24-seo metrika devices --days 7 --json
lv24-seo metrika countries --days 7 --json
lv24-seo metrika engagement --days 7 --json
lv24-seo metrika bytime --days 7 --group day --json
```

Все семь команд только для чтения и используют `providers.yandex_metrika.counter`. Каждый вызов
применяет `filters=ym:s:lastTrafficSource=='organic'`; `meta.organic_only` равен `true`, а
`meta.filters` повторяет выражение. `pages` возвращает органические страницы входа с визитами и
пользователями, отказами, средней длительностью, глубиной и просмотрами. `goals` читает id целей из
`providers.yandex_metrika.goals` и запрашивает достижения, визиты, пользователей и конверсию, при
желании по `page` или `source`; пустой список предупреждает без вызова провайдера, а больше пяти
целей обрезаются по лимиту Метрики в 20 метрик. `queries` всегда сообщает, что Google скрывает
поисковые фразы, а Метрика скрывает фразы с менее чем 10 пользователями. Поля сэмплирования
(`sampled`, `sample_share`, `sample_size`, `sample_space`, `data_lag`, `contains_sensitive_data`,
`total_rows_rounded`) переносятся в meta и limitations; точным считается только `sampled=false`.

### Обход

```bash
lv24-seo crawl --start https://example.com --max-urls 500 --json
```

Обходчик соблюдает `robots.txt`, идёт по ссылкам того же хоста в ширину, запускает все правила и
сохраняет страницы и проблемы, если настроено хранилище. `data.sitemap_coverage` сравнивает карту
сайта с тем, что увидел обход, в шести корзинах. Если возвращается `complete: false`, затронутые
корзины — кандидаты, а не подтверждённые находки; `limitations[]` называет усечённый вход.

### Логи, задачи и backup

```bash
lv24-seo logs analyze --file /var/log/nginx/access.log --json
lv24-seo tasks list --state open --limit 200 --json
lv24-seo tasks add --kind issue --url https://example.com/page --rule broken-internal-link --json
lv24-seo tasks update TASK_ID --state verified --json
lv24-seo backup create --out /srv/backups --json
lv24-seo backup restore --file /srv/backups/lv24-seo-backup-20261116T120000Z.zip --config /srv/site/seo.toml --json
lv24-seo backup restore --file /srv/backups/lv24-seo-backup-20261116T120000Z.zip --to /srv/restored --json
lv24-seo portfolio list --root /srv/sites --limit 50 --json
```

`logs analyze` читает ровно один абсолютный JSON access-лог nginx не более 100 MiB и возвращает строки
`bot_daily` и сводку `crawl_waste`; файл открывается только для чтения и ничего не сохраняется.
`tasks add` идемпотентен по `(kind, property_id, url, rule_id)` и сообщает `created`, `existing` или
`reopened`; `tasks update` принимает только документированные переходы, а `tasks list` ограничен.
`backup create` пишет `lv24-seo-backup-YYYYMMDDTHHMMSSZ.zip` с манифестом, отредактированным `seo.toml`
и согласованной копией базы; токены, логи и кэши исключены. `backup restore` сначала проверяет архив и
возвращает план с `confirm_token` на 300 секунд; для применения нужны `--allow-write` и токен, а текущая
база копируется в `<db>.pre-restore-<utc>` до замены. `backup restore --to DIR` вместо этого
перепроверяет архив и распаковывает его в новый каталог: токен и `--allow-write` не нужны, цель должна
быть абсолютным несуществующим путём, а zip-slip и побег через ссылки отклоняются до распаковки.
`portfolio list` сканирует до трёх уровней ниже
абсолютного каталога в поисках `seo.toml`, проверяет не более 50 сайтов и сообщает локальные счётчики
обхода, отчётов и проблем, сначала самые активные.

### Отчёты

```bash
lv24-seo report weekly --days 7 --lag-days 2 --out reports/ --json
lv24-seo report diff --markdown
```

`report weekly` собирает и сохраняет снимок; добавьте `--send`, чтобы доставить его через каналы,
включённые в `seo.toml`. `--out` пишет канонический английский `report.json` и `report.html` на
языке `report.locale`. Когда есть два сопоставимых окна GSC и сохранённые доказательства обхода,
отчёт добавляет раздел `Attributed change digest`, который сопоставляет каждое значимое изменение
с предполагаемой причиной, уверенностью и до тремя строками доказательств; без доказательств пункт
остаётся `unexplained` с ограничением. `report diff` сравнивает два сохранённых недельных снимка, не обращается к
провайдерам и требует двух запусков за разные периоды. `--markdown` печатает в stdout только
Markdown; предупреждения идут в stderr.

### Расписание

```bash
lv24-seo schedule print --kind weekly --cron "0 6 * * 1" --target systemd --json
lv24-seo schedule install --kind weekly --json
lv24-seo schedule install --kind weekly --allow-write --json
lv24-seo schedule install --kind indexing --json
lv24-seo schedule install --kind indexing --allow-write --json
lv24-seo schedule status --kind indexing --json
lv24-seo schedule uninstall --kind weekly --allow-write --json
```

`print` рендерит артефакт, не трогая хост. `install` по умолчанию только планирует: печатает блок cron,
пользовательские unit-файлы systemd или XML Планировщика заданий плюс команду, которую он запустит, с
`dry_run: true` и `installed: false`, и пишет только с `--allow-write` (`--print` остаётся синонимом
плана и важнее `--allow-write`). `status` только читает и сообщает `installed`, `outdated`, `partial`,
`missing` или `unknown` с `exists`/`matches` по артефактам. `uninstall` по умолчанию только планирует,
а с `--allow-write` удаляет ровно сгенерированные артефакты; чужие строки cron и задачи никогда не
трогаются. `--kind` принимает `weekly`, `daily` и `indexing`. Задачи отчётов запускают
`report weekly --send --json`; задача `indexing` называется `lv24-seo-indexing`, идёт ежедневно в
`04:00` и вызывает `indexing run --allow-write --config <absolute path> --json`. Ей по-прежнему нужны
`[indexing] enabled = true` и `LV24_SEO_WRITE_SECRET` в окружении планировщика; сгенерированная
команда никогда не содержит секрет. В systemd и Windows конвертируются только простые выражения
cron (`M H * * *` и `M H * * DOW`).

### MCP и клиенты агентов

```bash
lv24-seo install --client cursor --print
lv24-seo mcp serve --transport http --port 8765
```

`install` добавляет запись сервера `lv24-seo` в конфиг хоста, а не заменяет файл; `--print`
показывает точный JSON. `mcp serve` по умолчанию использует stdio и принимает streamable HTTP с
`--transport http`.

### Аутентификация

```bash
lv24-seo auth status --json
lv24-seo auth set --provider gsc --stdin
lv24-seo auth set --provider gsc_oauth_secret --stdin
lv24-seo auth login --provider gsc
lv24-seo auth login --provider yandex --no-browser
lv24-seo auth login --provider yandex --code <code>
lv24-seo auth login --provider yandex --url-only --json
```

`auth set` читает секрет из stdin или скрытого запроса и кладёт его в связку ключей ОС либо в явно включённый файловый резерв с правами `0600`. Печатается только `{provider, stored, source}`. `auth status` показывает наличие и источник (`env`, `keyring`, `file`, `missing`), но никогда — значение.

### OAuth-коннекторы

`auth login` авторизует Google Search Console, Yandex Webmaster или Yandex Metrika через OAuth вместо вставленного токена. Нужен client id в `[auth.gsc]` или `[auth.yandex]` (либо `LV24_SEO_GSC_CLIENT_ID` / `LV24_SEO_YANDEX_CLIENT_ID`) и client secret, сохранённый через `auth set --provider gsc_oauth_secret|yandex_oauth_secret --stdin`. Client secret никогда не хранится в `seo.toml`.

- **Google Search Console.** `auth login --provider gsc` использует клиент типа Desktop app, слушает `127.0.0.1` на свободном порту, открывает страницу согласия и обменивает код с S256 PKCE и случайным `state`. `--no-browser` печатает URL и ждёт; `--port 8123` фиксирует callback; `--code` переиспользует сохранённый PKCE verifier и требует `--port` или `[auth.gsc].redirect_uri`, чтобы точно повторить redirect. Access token, refresh token и срок хранятся в связке ключей и обновляются за 60 секунд до истечения.
- **Yandex Webmaster и Metrika.** `auth login --provider yandex|metrika` использует redirect `https://oauth.yandex.ru/verification_code`: подтвердите доступ, скопируйте короткий код и передайте его в `--code` либо введите в интерактивном запросе. Одно приложение может нести `webmaster:hostinfo` и `metrika:read`, но движки хранят отдельные слоты токенов. `--url-only` работает только для Яндекса и возвращает `{provider, flow, authorization_url, scopes, target}`, не открывая браузер, не запрашивая код, не обменивая его и не записывая токен; приложение показывает URL и завершает грант вторым вызовом с `--code`.
- **Приоритет и резервы.** GSC выбирает OAuth-грант, затем файл сервисного аккаунта, затем статический `gsc_token`. Яндекс сохраняет путь статических `yandex_webmaster_token` / `yandex_metrika_token` и обновляет токен, когда сохранены refresh token и срок. У Bing, IndexNow, CrUX и PSI нет OAuth-коннектора по дизайну.
- **Ограничение режима Testing.** Google-приложение в статусе **Testing** выдаёт refresh token, истекающий через 7 дней, поэтому ежедневное задание через неделю падает с `invalid_grant`. Опубликуйте приложение, повторяйте вход раз в неделю или используйте сервисный аккаунт для автономных запусков.

### Placeholder client id

Примеры из этого руководства (`0123456789abcdef0123456789abcdef`, `1234567890-abc.apps.googleusercontent.com`, `your-*-client-id`) не являются зарегистрированными приложениями. Движок `0.15.1` отклоняет их с `CONFIG_INVALID` до построения URL согласия, и `yandex_oauth.authorization_url()` применяет ту же проверку для всех вызывающих. Зарегистрируйте реальный Google Desktop client или приложение Яндекс OAuth и используйте его id; `auth status` и `doctor` сообщают placeholder как `oauth_client_missing`. Desktop `0.9.5` отключает **Connect**, пока готовность — `oauth_client_missing`, `oauth_client_secret_missing` или `oauth_redirect_invalid`.

### Диагностика готовности OAuth

`auth status --json` добавляет объект `oauth` для `gsc`, `yandex` и `metrika` с `state`, `detail`,
`client_id_present`, `client_secret_present`, `access_token_present`, `refresh_token_present`,
`expires_at`, `scopes_recorded`, `next_action` и `limitations`. `doctor --json` добавляет проверки
`gsc_oauth`, `yandex_oauth` и `metrika_oauth` с `id`, `ok`, `detail`, `code` и `next_action`; они
некритичны и никогда не печатают токен. Обе поверхности работают офлайн.

| Код | Значение | Исправление |
|---|---|---|
| `oauth_client_missing` | Client id пуст или является placeholder | Зарегистрируйте приложение и задайте `[auth.gsc].client_id` или `[auth.yandex].client_id` |
| `oauth_client_secret_missing` | Client id задан, но secret отсутствует | `auth set --provider gsc_oauth_secret\|yandex_oauth_secret --stdin` |
| `oauth_token_missing` | Client id и secret есть, но access/refresh token отсутствует | `auth login --provider gsc\|yandex\|metrika` |
| `oauth_token_expired` | Сохранённый срок в прошлом; указывается, доступен ли refresh | Выполните команду чтения или войдите заново, если refresh token нет |
| `oauth_scope_missing` | Записанные scope не включают настроенные | Войдите заново и выдайте scope либо уберите его из `[auth.*].scopes` |
| `oauth_scope_unknown` | Scope не записывались; предупреждение, а не ложный успех | Выполните вход или refresh один раз |
| `oauth_redirect_invalid` | Redirect Google не loopback или у Яндекса не `verification_code` | Очистите `[auth.*].redirect_uri` или задайте корректное значение |
| `oauth_ready` | Client id, secret, token, scope и redirect в порядке | Ничего делать не нужно |

Приоритет: redirect, client id, client secret, token, затем scope. Выданные scope хранятся в
`gsc_token_scopes`, `yandex_token_scopes` и `yandex_metrika_token_scopes` (в `OAUTH_SECRET_NAMES`, не
в стабильном `SECRET_NAMES`); `auth logout` удаляет их.

`--json` содержит `provider`, `flow`, `scopes`, `expires_at`, `target` и `next`; токенов в нём нет. Неудачное обновление возвращает `AUTH_INVALID` с точной командой `auth login`.

GSC также может использовать сервисный аккаунт. Задайте `providers.gsc.service_account_file` с абсолютным путём или экспортируйте `LV24_SEO_GSC_SERVICE_ACCOUNT_FILE`; OAuth-грант важнее файла, файл важнее сохранённого `gsc_token`, а окружение важнее файла. `gsc_token`, являющийся JSON-объектом сервисного аккаунта, тоже принимается. Движок подписывает RS256 JWT, обменивает его в `token_uri` ключа и обновляет до истечения. `properties` сообщает `token_source: oauth_refresh_token|service_account_file|secret|missing`, а `doctor` добавляет некритичную проверку `gsc_auth`; ни один не печатает JSON или приватный ключ.

### Экспорт

```bash
lv24-seo export tools --out schemas/tools.json
lv24-seo export skills --out skills/
```

`export tools` пишет сгенерированный реестр MCP для агентов, не использующих MCP; `export skills`
копирует упакованные файлы `SKILL.md` и их манифест. Обе команды пишут только локальные файлы.

## См. также

- [Справочник конфигурации](/ru/reference/config/)
- [Источники данных и квоты](/ru/providers/)
- [MCP и навыки агентов](/ru/mcp/)
- [Устранение неполадок](/ru/troubleshooting/)

Source: `_source/engine-cli.md`, `_source/engine-mcp.md`, `_source/engine-releases-0.13.1.md`, `_source/engine-releases-0.12.0.md`, `_source/engine-releases-0.11.0.md`, `_source/engine-releases-0.10.0.md`, `_source/engine-releases-0.9.0.md`, `_source/engine-releases-0.8.0.md`, `_source/engine-releases-0.7.0.md`, `_source/engine-releases-0.6.0.md`, `_source/engine-releases-0.5.3.md`; вывод `--help` версии 0.14.0 в репозитории движка.

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
{ "ok": true, "data": {}, "meta": { "version": "0.8.0", "duration_ms": 812 }, "warnings": [] }
```

Неудачная команда использует ту же форму с `ok: false` и объектом `error` вместо `data`:

```json
{ "ok": false, "error": { "code": "AUTH_REQUIRED", "message": "Google Search Console token is missing", "retryable": false, "next_action": "lv24-seo auth login --provider gsc" }, "meta": { "version": "0.8.0" }, "warnings": ["gsc: token missing"] }
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
`yandex indexing`, `crawl`, `report weekly` и `report diff`:

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

Менять состояние провайдера могут только `sitemap submit`, `yandex recrawl` и `indexnow submit`.
Они работают в два шага:

1. Запустите команду без `--confirm`. Она вернёт пробный прогон с `data.plan`, `data.plan_hash`,
   `data.confirm_token` и `meta.dry_run: true`.
2. Задайте длинный случайный `LV24_SEO_WRITE_SECRET` в той же оболочке и повторите запуск с
   `--allow-write --confirm TOKEN` в течение пяти минут.

Токен — это HMAC от действия, цели, полного хеша плана и срока действия, поэтому изменение любого
входа его аннулирует. При инициализированной рабочей области CLI подключает SQLite-журнал
идемпотентности: повторный токен возвращает `status: skipped` с `reason: duplicate`, и провайдер
вызывается один раз. Журнал открывается из каталога данных выбранной рабочей области:
`--config /srv/site/seo.toml` записывает заявку в `/srv/site/data`, даже если оболочка находится в
другом месте. Без каталога данных применение всё равно выполняется, но конверт предупреждает, что
защита от повтора отключена на пять минут жизни токена; dry run не открывает журнал и не создаёт
базу.

IndexNow действительно отправляет URL. GSC sitemap submit и Yandex
recrawl сейчас возвращают `WRITE_DISABLED`, а не делают вид, что вызов провайдера состоялся.

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
| Google Search Console | `gsc query`, `sitemap submit` | Запросы только на чтение; sitemap submit — защищённая запись. |
| Yandex Webmaster | `yandex queries`, `yandex indexing`, `yandex recrawl` | Запросы только на чтение; recrawl — защищённая запись. `queries` сохраняет `avg_click_position`, `query_id` и `extra_indicators`; `indexing` объединяет серию истории и сообщает `site_problems`. |
| IndexNow | `indexnow submit` | Защищённая запись, которая действительно отправляет URL. |
| Crawl and audit | `crawl` | Не зависит от провайдеров; сохраняет локальные страницы и проблемы, если настроено хранилище. |
| CWV | `cwv collect` | Опрашивает CrUX по URL и устройству и сохраняет полевые строки p75; лабораторные строки PSI возвращаются, но не сохраняются. |
| Reports | `report weekly`, `report diff` | `weekly` сохраняет локальный снимок; `diff` только читает. |
| Scheduling | `schedule print`, `schedule install`, `schedule status`, `schedule uninstall` | `print` только рендерит; `install` и `uninstall` по умолчанию планируют и пишут только с `--allow-write`; `status` только читает. |
| Logs | `logs analyze` | Читает один локальный JSON access-лог nginx; не сохраняет и не отправляет его. |
| Tasks | `tasks list`, `tasks add`, `tasks update` | Журнал задач рабочей области; `add` идемпотентен, `update` соблюдает разрешённые переходы. |
| Backup | `backup create`, `backup restore` | `create` пишет один переносимый архив рабочей области; `restore` планирует замену на месте или распаковывает в новый каталог с `--to`. |
| Portfolio | `portfolio list` | Сводка локальных проектов ниже одного каталога только для чтения; без вызова провайдера, чтения токена и записи. |
| Agents and MCP | `mcp serve`, `install`, `export tools`, `export skills` | Конфиг хоста, сгенерированные файлы или локальный сервер. |

В CLI 22 команды верхнего уровня: 15 групп и 7 команд (`version`, `doctor`, `init`, `properties`, `stats`, `crawl`, `install`).

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
```

`--start` и `--end` обязательны. Сокращения `--days` и переопределения `--property` нет: ресурс
берётся из `[providers.gsc]` в `seo.toml`. Измерения перечисляются через запятую и ограничены
`query`, `page`, `country`, `device` и `date`.

### Яндекс

```bash
lv24-seo yandex queries --limit 100 --json
lv24-seo yandex indexing --json
```

`yandex queries` возвращает верхние строки, а не полную связку запрос-страница: Яндекс отдаёт не
более 3 000 запросов за период. Он сохраняет `avg_click_position`, возвращает `query_id`, когда
провайдер его присылает, и сохраняет неизвестный индикатор в `extra_indicators` вместо отбрасывания
строки. `yandex indexing` показывает историю индексирования, число страниц в поиске, диагностику,
`site_problems` и события поисковых URL для настроенного `host_id`, а также объединяет серию
`indexing/history` (`http_2xx` … `other`) в одну строку на дату.

### Core Web Vitals

```bash
lv24-seo cwv collect --url https://example.com/ --url https://example.com/blog/post --device phone --source crux --json
```

`cwv collect` — писатель, стоящий за недельным разделом `cwv`. CrUX опрашивается по каждому URL и
устройству (`mobile` — псевдоним `phone`), и каждый полученный p75 становится полевой строкой
`metric_daily` с `source=crux`, `scope`, абсолютным URL, метрикой и датой получения в
`report.timezone`. Строки PSI остаются в `data.lab` и никогда не сохраняются, а у PSI нет `tablet`,
поэтому `tablet` пропускается как `psi_tablet_unsupported`. `--limit` ограничивает URL 50 (по
умолчанию 10); URL с низким трафиком не пишет строку, а не ноль, а усечённый запуск ставит
`meta.truncated: true` с `cwv_url_cap`. Команде нужен ключ CrUX (`AUTH_REQUIRED` до любого вызова) и
инициализированное хранилище (`CONFIG_INVALID`).

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
lv24-seo schedule print --cron "0 6 * * 1" --target systemd --json
lv24-seo schedule install --kind weekly --json
lv24-seo schedule install --kind weekly --allow-write --json
lv24-seo schedule status --json
lv24-seo schedule uninstall --kind weekly --allow-write --json
```

`print` рендерит артефакт, не трогая хост. `install` по умолчанию только планирует: печатает блок cron,
пользовательские unit-файлы systemd или XML Планировщика заданий плюс команду, которую он запустит, с
`dry_run: true` и `installed: false`, и пишет только с `--allow-write` (`--print` остаётся синонимом
плана и важнее `--allow-write`). `status` только читает и сообщает `installed`, `outdated`, `partial`,
`missing` или `unknown` с `exists`/`matches` по артефактам. `uninstall` по умолчанию только планирует,
а с `--allow-write` удаляет ровно сгенерированные артефакты; чужие строки cron и задачи никогда не
трогаются. Сгенерированная задача запускает `report weekly --send --json`. В systemd и Windows
конвертируются только простые выражения cron (`M H * * *` и `M H * * DOW`).

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
```

`auth set` читает секрет из stdin или скрытого запроса и кладёт его в связку ключей ОС либо в
явно включённый файловый резерв с правами `0600`. Печатается только `{provider, stored, source}`.
`auth status` показывает наличие и источник (`env`, `keyring`, `file`, `missing`), но никогда —
значение.

GSC также может использовать сервисный аккаунт. Задайте `providers.gsc.service_account_file` с
абсолютным путём или экспортируйте `LV24_SEO_GSC_SERVICE_ACCOUNT_FILE`; файл важнее сохранённого
`gsc_token`, а окружение важнее файла. `gsc_token`, являющийся JSON-объектом сервисного аккаунта,
тоже принимается. Движок подписывает RS256 JWT, обменивает его в `token_uri` ключа и обновляет до
истечения. `properties` сообщает `token_source: service_account_file|secret|missing`, а `doctor`
добавляет некритичную проверку `gsc_auth`; ни один не печатает JSON или приватный ключ.

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

Source: `_source/engine-cli.md`, `_source/engine-mcp.md`, `_source/engine-releases-0.5.2.md`, `_source/engine-releases-0.5.3.md`, `_source/engine-releases-0.6.0.md`, `_source/engine-releases-0.7.0.md`, `_source/engine-releases-0.8.0.md`; вывод `--help` версии 0.8.0 в репозитории движка.

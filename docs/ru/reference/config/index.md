---
title: Справочник конфигурации
description: Где лежит seo.toml, как работает приоритет, все ключи с умолчаниями и обработка секретов, часового пояса и локали.
---

# Справочник конфигурации

Один `seo.toml` описывает один проект: идентичность сайта, целевые ресурсы провайдеров, лимиты
обхода, настройки отчётов и локальное хранилище. Схема строгая, поэтому опечатка в ключе приводит к
ошибке валидации, а не к тихому отключению настройки. Отсутствие файла конфигурации не считается
ошибкой: умолчания описывают рабочий инструмент только для чтения.

## Расположение и приоритет

Приоритет значений, от низшего к высшему: встроенные умолчания, выбранный `seo.toml`, затем
переменные окружения `LV24_SEO_*`. `--config PATH` только выбирает файл; движок сначала берёт явный
путь (он должен существовать, иначе `CONFIG_INVALID`), затем `./seo.toml`, затем пользовательский
конфиг платформы: `%APPDATA%\lv24-seo\config.toml` в Windows, `~/.config/lv24-seo/config.toml` в
Linux и соответствующее расположение platformdirs в macOS.

Файлы `.env` не загружаются автоматически. Экспортируйте переменные в оболочке, unit-файле сервиса
или окружении планировщика, который запускает команду.

### Переменные окружения

| Переменная | Ключ |
|---|---|
| `LV24_SEO_DATA_DIR` | `storage.data_dir` |
| `LV24_SEO_GSC_PROPERTY` | `providers.gsc.property` |
| `LV24_SEO_YANDEX_HOST_ID` | `providers.yandex_webmaster.host_id` |
| `LV24_SEO_YANDEX_METRIKA_COUNTER` | `providers.yandex_metrika.counter` |
| `LV24_SEO_REPORT_LOCALE` | `report.locale` |
| `LV24_SEO_REPORT_TIMEZONE` | `report.timezone` |
| `LV24_SEO_SMTP_HOST` | `report.email.smtp_host` |
| `LV24_SEO_SMTP_PORT` | `report.email.smtp_port` |
| `LV24_SEO_SMTP_USER` | `report.email.smtp_user` |
| `LV24_SEO_SMTP_FROM` | `report.email.from` |
| `LV24_SEO_MAIL_TO` | `report.email.to` (список через запятую) |
| `LV24_SEO_TELEGRAM_CHAT_ID` | `report.telegram.chat_id` |

Неподдерживаемые переменные `LV24_SEO_*` игнорируются для совместимости с будущими версиями.
Переменные для секретов перечислены в разделе [Секреты](#секреты); их разрешает хранилище
секретов, а не эта модель конфигурации.

`LV24_SEO_LOG_LEVEL` не является ключом конфигурации. Задайте `DEBUG`, `INFO`, `WARNING`, …,
чтобы включить редактирующее логирование. CLI и `lv24-seo mcp serve` устанавливают обработчик;
если переменная не задана, конфигурация логирования вызывающего не меняется. Вывод — одна
JSON-строка на запись, когда stderr не терминал (pipe, лог планировщика, MCP-хост), и обычная
строка иначе.

## Справочник ключей

Все ключи ниже необязательны. Отсутствующий блок провайдера означает «не настроен», а не ошибку.

### `[project]`

| Ключ | Тип | Умолчание | Примечания |
|---|---|---|---|
| `name` | string | `""` | Понятное имя рабочего пространства. |
| `base_url` | string | `""` | Стартовый URL по умолчанию для `crawl`, если `--start` не указан. |
| `default_property` | string | `""` | Ресурс GSC, который предлагает `init` и показывает `properties`. Запросы GSC используют `providers.gsc.property`. |

### `[providers.gsc]`

| Ключ | Тип | Умолчание | Примечания |
|---|---|---|---|
| `property` | string | `""` | `sc-domain:example.com` или `https://example.com/`. |
| `auth` | string | `"keychain"` | Зарезервированная метка. Принимается, но игнорируется: учётные данные берутся из окружения, затем из связки ключей ОС, затем из явно включённого файлового резерва. |

### `[providers.yandex_webmaster]`

| Ключ | Тип | Умолчание | Примечания |
|---|---|---|---|
| `host_id` | string | `""` | Точный идентификатор хоста Яндекса, например `https:example.com:443`. Не угадывайте его; берите из API или интерфейса Вебмастера. |

### `[providers.yandex_metrika]`

| Ключ | Тип | Умолчание | Примечания |
|---|---|---|---|
| `counter` | string | `""` | Идентификатор счётчика Метрики. Целое число без кавычек в TOML нормализуется в строку. |
| `goals` | список целых | `[]` | Идентификаторы целей, которые считаются конверсиями. |

### `[providers.bing]`

| Ключ | Тип | Умолчание | Примечания |
|---|---|---|---|
| `site` | string | `""` | URL сайта, зарегистрированный в Bing Webmaster Tools. |

### `[providers.crux]`

| Ключ | Тип | Умолчание | Примечания |
|---|---|---|---|
| `origin` | string | `""` | Origin для полевых данных, например `https://example.com`. |

### `[providers.psi]`

| Ключ | Тип | Умолчание | Примечания |
|---|---|---|---|
| `strategy` | `mobile` или `desktop` | `"mobile"` | Стратегия Lighthouse. |
| `urls` | список строк | `[]` | Страницы для PageSpeed Insights. Проверяется не более пяти; лабораторные оценки берутся с первого URL. |

В текущей строгой схеме нет блока `providers.ga4`. Его добавление приводит к ошибке валидации;
GA4 описан как необязательный будущий источник, а не настраиваемый провайдер.

### `[crawl]`

| Ключ | Тип | Умолчание | Примечания |
|---|---|---|---|
| `max_urls` | целое ≥ 1 | `500` | Бюджет URL на один обход. |
| `concurrency` | целое ≥ 1 | `4` | Зарезервировано. Сегодня обходчик последовательный, поэтому ключ ни на что не влияет. |
| `respect_robots` | boolean | `true` | Соблюдать `robots.txt` и `Crawl-delay`. |
| `user_agent` | string | `"lv24-seo/0.1"` | User-Agent обходчика. |

### `[report]`

| Ключ | Тип | Умолчание | Примечания |
|---|---|---|---|
| `locale` | `ru`, `en` или `zh` | `"ru"` | Язык отрендеренного вывода для человека. Только представление. |
| `timezone` | имя зоны IANA | `"Europe/Minsk"` | Зона для окон отчётов и `stats`, окон по умолчанию в MCP и локальных границ суток. |
| `week_start` | `monday` или `sunday` | `"monday"` | Зарезервировано. Недельные окна считаются в днях, поэтому сейчас ключ не влияет. |
| `thresholds` | inline-таблица | см. ниже | Пороги изменений для отчётов и проверки `only_on_change`. |

`thresholds` принимает `clicks_pct` (умолчание `10.0`), `impressions_pct` (умолчание `15.0`) и
`position_abs` (умолчание `1.5`).

### `[report.email]` и `[report.telegram]` (доставка)

Отдельной таблицы `[delivery]` нет. Доставка настраивается в двух блоках каналов, и оба по
умолчанию выключены.

| Ключ | Тип | Умолчание | Примечания |
|---|---|---|---|
| `email.enabled` | boolean | `false` | Доставлять недельный отчёт по почте. |
| `email.to` | список строк | `[]` | Получатели. |
| `email.from` | string | `""` | Отправитель конверта. |
| `email.only_on_change` | boolean | `true` | Пропускать отправку, если за период нет существенных изменений. |
| `email.smtp_host` | string | `""` | SMTP-хост. |
| `email.smtp_port` | целое 1–65535 | `587` | SMTP-порт. |
| `email.smtp_user` | string | `""` | SMTP-пользователь. Пароль берётся из хранилища секретов. |
| `telegram.enabled` | boolean | `false` | Доставлять недельный отчёт в Telegram. |
| `telegram.chat_id` | string | `""` | Идентификатор целевого чата. |
| `telegram.severity` | `critical` или `all` | `"critical"` | Какие находки вызывают сообщение в Telegram. |

Ключей `report.email.locale` и `report.telegram.locale` нет. Задайте `report.locale` один раз; это
единственный источник истины для всех отрендеренных поверхностей.

### `[storage]`

| Ключ | Тип | Умолчание | Примечания |
|---|---|---|---|
| `data_dir` | путь | `"data"` | Локальный каталог для `seo.sqlite3` и состояния движка. Относительное значение из файла разрешается относительно каталога конфига; встроенное значение по умолчанию — относительно рабочего каталога. `LV24_SEO_DATA_DIR` перекрывает файл и остаётся process-scoped. |
| `raw_retention_days` | целое ≥ 0 | `90` | Зарезервировано. Сырые архивы не пишутся, поэтому очистка — это запись в лог без действий. |

## Каталог данных

`storage.data_dir` имеет три области:

| Значение | Относительно чего разрешается |
|---|---|
| Относительное значение в `seo.toml` (`data_dir = "./data"`) | каталога файла конфигурации |
| Встроенное значение по умолчанию (без блока `[storage]`) | рабочего каталога процесса |
| `LV24_SEO_DATA_DIR` | используется как задано; относительное значение разрешается относительно рабочего каталога. Окружение всегда побеждает файл |

Конфиг с относительным каталогом самодостаточен: `--config /srv/site/seo.toml` использует
`/srv/site/data` из любого рабочего каталога. `lv24-seo init` создаёт `<config dir>/data` и
пишет `data_dir = "./data"`. Пути делаются абсолютными через `os.path.abspath` (`~`
раскрывается, `..` нормализуется); symlinks намеренно не разрешаются, поэтому конфиг,
открытый через ссылку, привязывает data-dir рядом со ссылкой. SQLite-хранилище —
`<data_dir>/seo.sqlite3`.

`lv24-seo doctor --json` делает область видимой: `meta.data_dir` — эффективный каталог,
`meta.data_dir_source` равен `config`, когда путь абсолютный (задан файлом или абсолютным
`LV24_SEO_DATA_DIR`), и `working directory`, когда он относительный. Относительный каталог при
наличии конфига добавляет предупреждение с каталогом конфига. `config show --json` сообщает тот
же эффективный путь. Абсолютный путь закрепляет базу.

Резервный `<data_dir>/secrets.json` следует тому же каталогу; приложение и CLI делят его только
при одинаковом разрешённом data-dir.

## Секреты

Секретам не место в `seo.toml`, логах, отчётах и тестовых фикстурах. Порядок разрешения:
окружение, затем связка ключей ОС, затем явно включённый файловый резерв.

| Источник | Как использовать |
|---|---|
| Связка ключей ОС | `lv24-seo auth set --provider <name> --stdin`. Нужен необязательный extra `secrets` (`pip install "lv24-seo[secrets]"`). |
| Окружение | Экспортируйте переменную провайдера из таблицы ниже. Значения из окружения доступны только для чтения и всегда побеждают. |
| Файловый резерв | Задайте `LV24_SEO_ALLOW_FILE_SECRETS=1` и храните `data/secrets.json` с правами `0600`. В Windows права обеспечиваются ACL каталога и файла. Каждый запуск печатает предупреждение. |

| Провайдер | `auth set --provider` | Переменная окружения |
|---|---|---|
| Google Search Console | `gsc` | `LV24_SEO_GSC_TOKEN` |
| Yandex Webmaster | `yandex` | `LV24_SEO_YANDEX_WEBMASTER_TOKEN` |
| Yandex Metrika | `metrika` | `LV24_SEO_YANDEX_METRIKA_TOKEN` |
| Bing Webmaster | `bing` | `LV24_SEO_BING_API_KEY` |
| Chrome UX Report | `crux` | `LV24_SEO_CRUX_API_KEY` |
| PageSpeed Insights | `psi` | `LV24_SEO_PSI_API_KEY` |
| SMTP | `smtp` | `LV24_SEO_SMTP_PASSWORD` |
| Telegram | `telegram` | `LV24_SEO_TELEGRAM_BOT_TOKEN` |

Для защищённых записей также нужен `LV24_SEO_WRITE_SECRET` — длинное случайное значение в той же
оболочке, где выполняется применение. `auth status` показывает наличие и источник, но не значение,
и не проверяет права или сеть. `auth login` только печатает инструкции.

## Часовой пояс и локаль

`report.timezone` должен быть корректной зоной IANA. Она используется для окон отчётов и `stats`,
окон по умолчанию в MCP (`gsc_search_analytics`, `seo_opportunities`, `seo_weekly_report`) и
локальных границ суток. Неизвестная зона падает с `CONFIG_INVALID`; тихого отката к UTC нет. Данные
провайдеров остаются в датах и не конвертируются между зонами.

`report.locale` принимает `ru`, `en` и `zh`; умолчание — `ru`. Он выбирает язык и форматирование
чисел, процентов, позиций, дат и множественного числа для недельной почты, сообщений Telegram,
текстовой сводки CLI и HTML из `report weekly --out`. JSON-конверты, полезная нагрузка MCP,
сохранённые снимки, `report.json` и `report diff` остаются на каноническом английском, а машинные
коды никогда не переводятся. Неподдерживаемая локаль падает при валидации, а не подменяется молча.

## Валидация и маскирование

- Неизвестные ключи, невалидный TOML, отсутствующий явный путь `--config`, неверная зона или
  локаль и SMTP-порт вне диапазона дают `CONFIG_INVALID` и код выхода `2`.
- `lv24-seo config show --json` печатает действующую конфигурацию с `meta.redacted: true`. Любой
  ключ, чьё имя похоже на учётные данные (`token`, `secret`, `password`, `api_key`,
  `authorization`), маскируется как `***`.
- `lv24-seo doctor` проверяет Python, платформу, читаемость конфига, запись в рабочий каталог,
  эффективный каталог данных и его область, а также наличие токенов. Сетевых вызовов нет.
  Относительный каталог показывается с `meta.data_dir_source: "working directory"` и
  предупреждением; это не ошибка.

## Минимальный пример

```toml
[project]
name = "example.com"
base_url = "https://example.com"

[providers.gsc]
property = "sc-domain:example.com"
```

Этого достаточно для `doctor`, `properties`, `gsc query` и `report weekly`, если токен GSC доступен
хранилищу секретов.

## Полный пример

На основе шаблона с комментариями, который пишет `lv24-seo init`, с примерными значениями:

```toml
# lv24-seo workspace configuration (generated by `lv24-seo init`).
# Secrets never belong here: use `lv24-seo auth set` or the matching LV24_SEO_* variable.

[project]
name = "example.com"
base_url = "https://example.com"
default_property = "sc-domain:example.com"

[providers.gsc]
property = "sc-domain:example.com"
auth = "keychain"

[providers.yandex_webmaster]
host_id = "https:example.com:443"

[providers.yandex_metrika]
counter = "123456"
goals = [1, 2]

[providers.bing]
site = "https://example.com"

[providers.crux]
origin = "https://example.com"

[providers.psi]
strategy = "mobile"
urls = ["https://example.com/", "https://example.com/pricing"]

[report]
locale = "ru"
timezone = "Europe/Minsk"
week_start = "monday"
thresholds = { clicks_pct = 10, impressions_pct = 15, position_abs = 1.5 }

[report.email]
enabled = false
to = ["owner@example.com"]
from = "seo@example.com"
only_on_change = true
smtp_host = "smtp.example.com"
smtp_port = 587
smtp_user = "seo@example.com"

[report.telegram]
enabled = false
chat_id = "123456789"
severity = "critical"

[crawl]
max_urls = 500
concurrency = 4
respect_robots = true
user_agent = "lv24-seo/0.1"

[storage]
data_dir = "./data"      # relative to this file; absolute values and LV24_SEO_DATA_DIR are used as-is
raw_retention_days = 90
```

Доставка остаётся выключенной, пока на канале не задано `enabled = true`. Пароль SMTP и токен
Telegram-бота держите в хранилище секретов, а не в этом файле.

## См. также

- [Справочник CLI](/ru/reference/cli/)
- [Безопасность и приватность](/ru/security/)
- [Автоматизация и доставка](/ru/automation/)
- [Устранение неполадок](/ru/troubleshooting/)

Source: `_source/engine-config.md`, `_source/engine-data-sources.md`, `_source/engine-releases-0.5.2.md`; модель конфигурации 0.5.2 в репозитории движка.

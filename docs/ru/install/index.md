---
title: Установка
description: Установка движка lv24-seo через uv, pipx, pip или npx, настройка токенов, установка приложения и чистое удаление.
---

# Установка

Есть два пути установки: Python-движок (`lv24-seo`) и необязательная настольная оболочка. Пакет npm — лаунчер того же движка, а не вторая реализация.

| Путь | Кому подходит | Команда |
|---|---|---|
| uv | Большинству пользователей; изолированная установка инструмента | `uv tool install "lv24-seo[secrets]"` |
| pipx | Если уже используется pipx | `pipx install "lv24-seo[secrets]"` |
| pip | Виртуальное окружение проекта | `pip install "lv24-seo[secrets]"` |
| npx | Пользователям Node без глобальной установки | `npx @lv24/seo doctor --json` |
| Приложение | Графический интерфейс к тому же движку | См. [Настольное приложение](/ru/desktop/) |

## Движок

Движку нужен Python 3.11 или новее. `uv` может скачать интерпретатор, поэтому системный Python не обязателен. Extra `[secrets]` включает хранение в системном keychain; без него `auth set` не сможет использовать keychain, и придётся применять переменные окружения или явно включённый файловый fallback.

Выберите один установщик. Через uv:

```bash
uv tool install "lv24-seo[secrets]"
```

Через pipx:

```bash
pipx install "lv24-seo[secrets]"
```

Через pip в виртуальном окружении:

```bash
pip install "lv24-seo[secrets]"
```

Через npm-лаунчер, который ничего не устанавливает глобально:

```bash
npx @lv24/seo doctor --json
```

Если поддержка keychain не нужна, установите `lv24-seo` без extra. npm-лаунчеру нужны Node.js 18 или новее и либо `uv`, либо установленный бинарник `lv24-seo`. Он передаёт все аргументы закреплённому пакету Python; SEO-логики в нём нет. Первый запуск `npx` может занять несколько секунд, пока uv разрешает и кэширует пакет.

Если после `uv tool install` команда `lv24-seo` не найдена, откройте новый терминал, чтобы каталог bin инструмента попал в `PATH`.

## Проверка

```bash
lv24-seo version --json
lv24-seo doctor
```

`version --json` возвращает имя пакета и версию в стандартном конверте. `doctor` проверяет Python, файл конфигурации, эффективный каталог данных и его область (`meta.data_dir`, `meta.data_dir_source`), запись в текущий каталог и наличие токенов. Он не делает сетевых вызовов, поэтому успешный `doctor` не доказывает, что токен провайдера действителен.

## Создание рабочей области

```bash
lv24-seo init --property https://example.com
```

`init` записывает прокомментированный `seo.toml`, создаёт `<config dir>/data` и пишет `data_dir = "./data"`, поэтому рабочая область самодостаточна. Он отказывается перезаписывать существующий `seo.toml`, если не передан `--force`. Один `seo.toml` описывает один проект и один набор целей провайдеров. Для нескольких сайтов держите несколько файлов конфигурации и передавайте `--config path/to/seo.toml`.

Отредактируйте `seo.toml`, чтобы задать ресурс GSC, host id Яндекс.Вебмастера, счётчик Метрики, сайт Bing, origin CrUX и URL для PSI. `lv24-seo config show --json` печатает действующую конфигурацию со скрытыми значениями, похожими на секреты.

## Токены

```bash
lv24-seo auth login --provider gsc
lv24-seo auth set --provider gsc --stdin
lv24-seo auth status --json
```

`auth login` запускает OAuth-коннектор провайдера, когда настроен client id: GSC использует Desktop-app loopback-callback с S256 PKCE, а Yandex Webmaster/Metrika — redirect `verification_code`. `--no-browser` печатает URL, `--code` завершает внешний поток, а `--url-only` (только Яндекс) возвращает URL авторизации без записи токена — приложение использует его для карточки Connect. Без client id `auth login` печатает ручные шаги. `auth set` читает секрет из stdin или скрытого приглашения и сохраняет его в системном keychain либо в файловом fallback с правами `0600`, если он явно разрешён; OAuth client secret использует `gsc_oauth_secret` или `yandex_oauth_secret`. Никогда не передавайте токен в argv, историю команд, файл репозитория или скриншот. `auth status` сообщает только наличие и источник; он не печатает значение и не проверяет права.

Поддерживаемые имена провайдеров: `gsc`, `yandex`, `metrika`, `bing`, `crux`, `psi`, `smtp`, `telegram`, `gsc_oauth_secret` и `yandex_oauth_secret`. Без extra `secrets` используйте переменные окружения `LV24_SEO_*` для нужного провайдера, например `LV24_SEO_YANDEX_WEBMASTER_TOKEN`. Резервный вариант для headless — `LV24_SEO_ALLOW_FILE_SECRETS=1` плюс `data/secrets.json` с правами `0600`; в этом режиме движок предупреждает при каждом запуске.

GSC также принимает сервисный аккаунт. Задайте `providers.gsc.service_account_file` с абсолютным путём или экспортируйте `LV24_SEO_GSC_SERVICE_ACCOUNT_FILE`; полный OAuth-грант важнее файла, файл важнее сохранённого `gsc_token`, а окружение важнее файла. Движок подписывает RS256 JWT, обменивает его в `token_uri` ключа и обновляет до истечения, поэтому долгоживущий процесс `mcp serve` переживает истечение токена. `properties` сообщает `token_source: oauth_refresh_token|service_account_file|secret`, а `doctor` добавляет некритичную проверку `gsc_auth`; ни один не печатает ключ. Обычный статический токен продолжает работать. Google-приложение в **Testing** истекает refresh token через 7 дней, поэтому для автономных запусков лучше сервисный аккаунт.

## Матрица установки приложения

Настольное приложение `0.9.2` — текущий релиз с движком `lv24-seo 0.14.0`; оно требует движок `0.14.0` или новее, поэтому установленный движок `0.13.x` несовместим. Скачивайте файлы со страницы релизов проекта; `SHA256SUMS.txt` покрывает все опубликованные файлы.

| Платформа | Файлы | Автообновление |
|---|---|---|
| Windows 10/11 x64 | NSIS `LV24.SEO.Optimizer_0.9.2_x64-setup.exe` (+ `.sig`), portable `LV24-SEO-Optimizer_0.9.2_x64-portable.zip` (+ `.zip.sha256`) | Только NSIS; portable вручную |
| Linux x64 | `LV24.SEO.Optimizer_0.9.2_amd64.AppImage` (+ `.AppImage.sig`), `LV24.SEO.Optimizer_0.9.2_amd64.deb`, `LV24.SEO.Optimizer-0.9.2-1.x86_64.rpm` | Только AppImage; deb/rpm вручную |
| macOS 13+ arm64/x64 | `LV24.SEO.Optimizer_0.9.2_aarch64.dmg` / `LV24.SEO.Optimizer_0.9.2_x64.dmg` для первой установки, `LV24.SEO.Optimizer_0.9.2_aarch64.app.tar.gz` / `LV24.SEO.Optimizer_0.9.2_x64.app.tar.gz` (+ `.sig`) для обновлений | Только `.app`; DMG — первая установка |

Движок `0.14.0` добавляет диагностику готовности OAuth: объект `oauth` в `auth status`, проверки `gsc_oauth`/`yandex_oauth`/`metrika_oauth` в `doctor` и восемь стабильных кодов с записанными scope. Он сохраняет автоматизацию индексации 0.12.0, глубину чтения 0.11.0, 25 команд CLI, 12 инструментов MCP и схему v5. Приложение `0.9.2` добавляет карточку Indexing automation только для чтения, включает движок `0.14.0` и поднимает `MIN_ENGINE_VERSION` до `0.14.0`. Ограничения перечислены в [заметках к релизу](/ru/release/).

### Windows

Установщик NSIS устанавливается для текущего пользователя, добавляет запись в меню «Пуск» и умеет обновляться автоматически. SmartScreen может предупредить, потому что сборка не подписана; проверьте контрольную сумму и выберите **Подробнее → Выполнить в любом случае**. Перед обновлением в приложении оболочка останавливает только запущенные ею PID sidecar движка; если остановить не удалось, установка блокируется с `UPDATE_ENGINE_BUSY` и повторяется после завершения того запуска. В portable ZIP нет установщика и встроенного обновления: распакуйте целиком папку `LV24 SEO Optimizer`, оставьте папку `lv24-seo\` рядом с `lv24-seo-desktop.exe` и запустите исполняемый файл. Чтобы удалить portable-сборку, удалите распакованную папку.

### Linux

Сборки Linux предназначены только для x64 и собраны на Ubuntu 22.04 с базовой glibc 2.35. Более новые дистрибутивы обычно работают; более старые могут не работать. Используйте команду для того пакета, который скачали.

```bash
chmod +x ./*_amd64.AppImage
./*_amd64.AppImage
sudo apt install ./*_amd64.deb
sudo dnf install ./*_amd64.rpm
```

Если AppImage не запускается из-за отсутствия FUSE 2, установите `libfuse2` через пакетный менеджер дистрибутива или используйте пакет deb/rpm.

### macOS

Используйте DMG `aarch64` на Apple silicon и DMG `x64` на Intel. Откройте DMG, перетащите **LV24 SEO Optimizer** в **Applications**, затем разрешите первый запуск через **System Settings → Privacy & Security → Open Anyway** или щёлкните приложение правой кнопкой и выберите **Open**. Сборка подписана ad-hoc, но не нотаризована. Автообновление использует подписанный `.app.tar.gz` для соответствующей архитектуры.

### Обновление с версии 0.1.0

`0.1.0` была превью только для Windows без обновлятора, endpoint и публичного ключа. Установите `0.9.2` вручную один раз (установщик NSIS или portable ZIP). Автообновление работает с `0.2.0` и далее только для Windows NSIS, macOS `.app` и Linux AppImage.

## Неподписанные сборки

Пакеты ОС не подписаны платным удостоверяющим центром. У Windows нет подписи Authenticode; macOS подписан ad-hoc; AppImage, deb и rpm для Linux не подписаны. SmartScreen, Gatekeeper или антивирус могут предупредить или заблокировать запуск. Перед запуском сверьте загрузку с `SHA256SUMS.txt`:

```bash
sha256sum -c SHA256SUMS.txt --ignore-missing
```

В Windows сравните вывод `Get-FileHash <file> -Algorithm SHA256` с соответствующей строкой в `SHA256SUMS.txt`. Подпись обновлятора отделена от подписи кода ОС: она доказывает, что обновление пришло с ключом релиза этого проекта, но не делает пакет доверенным для ОС. Не отключайте Gatekeeper или SmartScreen глобально.

## Удаление

```bash
uv tool uninstall lv24-seo
pipx uninstall lv24-seo
pip uninstall lv24-seo
```

Используйте команду, соответствующую вашему установщику. `npx` не устанавливает глобальный пакет, поэтому удалять там нечего. В Windows удалите NSIS-установку через **Settings → Apps → LV24 SEO Optimizer → Uninstall**; portable-папку удалите вручную. В Linux удалите deb/rpm через пакетный менеджер дистрибутива. В macOS удалите приложение из **Applications**.

Удаление инструмента не удаляет проект. `seo.toml`, `data/`, история SQLite, отчёты и резервные копии остаются на месте, пока вы не удалите их сами.

## Далее

- [Быстрый старт](/ru/start/) — путь за пять минут.
- [Настольное приложение](/ru/desktop/) — возможности, обновления и ограничения.
- [Справочник конфигурации](/ru/reference/config/) — все ключи `seo.toml`.
- [Безопасность и приватность](/ru/security/) — хранение токенов и защита записи.

Source: `_source/engine-README.md`, `_source/engine-cli.md`, `_source/engine-config.md`, `_source/engine-auth.md`, `_source/engine-releases-0.14.0.md`, `_source/engine-releases-0.13.1.md`, `_source/engine-releases-0.13.0.md`, `_source/desktop-README.md`, `_source/desktop-releases-0.9.2.md`, `_source/desktop-releases-0.9.1.md`, `_source/desktop-releases-0.8.0.md`, `_source/desktop-releases-0.7.0.md`, `_source/desktop-releases-0.6.0.md`, `_source/desktop-releases-0.5.0.md`, `_source/desktop-releases-0.4.0.md`, `_source/desktop-releases-0.3.0.md`, `_source/desktop-releases-0.2.3.md`, `_source/desktop-releases-0.2.2.md`, `_source/desktop-releases-0.2.0.md`.

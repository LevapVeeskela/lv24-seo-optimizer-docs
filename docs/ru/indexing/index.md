---
title: Автоматизация индексации
description: Очередь индексации с учётом квот, статус, запуски и история в CLI и карточка Indexing automation только для чтения, ежедневное задание 04:00, секрет записи и честные счётчики.
---

# Автоматизация индексации

Автоматизация индексации ведёт локальную очередь URL из sitemap, отправляет то, что разрешено
свежими квотами провайдеров, и записывает результат. Это функция CLI и планировщика; карточка в
приложении `0.9.6` показывает те же данные только для чтения.

## Что она делает

- **Очередь.** `indexing run` читает sitemap проекта (`<project.base_url>/sitemap.xml`, корень плюс пять дочерних документов, 10 000 URL) и объединяет явные `--url`. Чужие хосты пропускаются, каждый лимит отражается.
- **Приоритет.** Сначала никогда не отправленные URL, затем URL, у которых sitemap `lastmod` новее `last_submitted_at`, затем URL, у которых `last_checked_at` старше `check_interval_days`. URL, отправленный позже своего `lastmod`, пропускается без `--force`.
- **Проверки и записи.** Проверки только читают: GSC URL Inspection даёт вердикт по URL, а Bing `GetUrlInfo` — `crawled`, если есть дата обхода. Без `--allow-write` запуск только проверяет и планирует. С ним движок заново читает квоты, проверяет хеш плана, выпускает и расходует внутренний confirm-токен через write gate и пишет одну строку `indexing_runs` на провайдера.
- **Ежедневное задание.** `schedule install --kind indexing` создаёт ежедневное задание `lv24-seo-indexing` в **04:00** с командой `indexing run --allow-write --config <abs> --json` для cron, systemd и Планировщика задач Windows. Сгенерированная команда никогда не содержит секрет.

```bash
lv24-seo indexing status --live --json
lv24-seo indexing status --provider bing --limit 50 --json
lv24-seo indexing run --from-sitemap --max-submit 20 --max-inspect 5 --json
lv24-seo indexing run --from-sitemap --allow-write --json
lv24-seo indexing history --limit 20 --json
lv24-seo schedule install --kind indexing --allow-write --json
```

## Квоты и лимиты

Лимиты проверяются до вызова провайдера. Исчерпанная квота — это `quota_exhausted` с `submitted: 0`
и `not_attempted`; ноль никогда не означает «всё проиндексировано».

| Движок | Источник остатка квоты | Лимит за запуск |
|---|---|---|
| Bing | `GetUrlSubmissionQuota`, дневной и месячный остаток | 500 URL на `SubmitUrlbatch`; план ограничен меньшим остатком |
| Яндекс | `recrawl/quota` `quota_remainder` | Один POST на URL; пакетного endpoint нет |
| GSC | API остатка нет; локальный счётчик `quota_usage` за UTC-день | 2 000 проверок/день/сайт по умолчанию, `max_inspect_per_run` 20 |
| IndexNow | API статуса и квоты нет; локальный счётчик за UTC-день | 1 000 отправок/день по умолчанию, 10 000 URL на POST |

`indexing status` показывает по провайдеру `urls`, `submitted`, `crawled`, `queued`, `indexed`
(выборка), `indexed_total` (агрегат GSC), `pending`, `quota` и `limitations`. `--live` читает квоты
Bing и Яндекса сейчас; без него показывается последняя записанная квота с `quota_not_live`.

## Секрет записи и ворота

`indexing run --allow-write` требует `[indexing] enabled = true` и `LV24_SEO_WRITE_SECRET` в том же
окружении. Плановой отправке нужен секрет в окружении планировщика (systemd drop-in, пользовательское
окружение или экспорт в cron), но не в командной строке. `indexing status` сообщает только факт
наличия секрета как `write_secret_present`; значение никогда не попадает в конверт. Повторный токен —
`skipped`/`duplicate`; сбой провайдера освобождает claim.

## Честные счётчики индексации

Только GSC даёт вердикт по каждому URL (`PASS`/`Submitted and indexed` → `indexed`; `NEUTRAL`/`FAIL` →
`not_indexed`; остальное — `unknown`). Агрегат GSC `contents[].indexed` отдаётся отдельно как
`indexed_total` и всегда помечается `gsc_indexed_count_deprecated`. Bing `GetUrlInfo` даёт
`http_status` и `last_crawled_at`, поэтому обойдённый URL — `crawled`, а не `indexed`
(`bing_no_per_url_index_status`). У Яндекса и IndexNow нет статуса по URL; их `indexed_total` равен
`null` с `no_per_url_index_count`.

**У Bing Site Scan нет публичного API.** Каждая запись Bing несёт `site_scan_no_api`; приложение
только открывает официальную страницу и никогда не заявляет, что запустило, отслеживает или
импортирует сканирование.

## Карточка Indexing automation в приложении

Приложение `0.9.2` добавило карточку только для чтения в Integrations; `0.9.6` её сохраняет. Она рендерит
`indexing status`, `indexing history` и `schedule status`; в ней нет записи, подтверждения или
`--allow-write`.

- **Расписание.** `Scheduled`/состояние хоста и документированный ритм **Daily 04:00** для `lv24-seo-indexing`.
- **По провайдерам.** Строки Bing, Yandex, GSC и IndexNow с `submitted`, `indexed` (только GSC), `pending` и квотой: остаток Bing за день/месяц, остаток Яндекса, использовано/лимит GSC/IndexNow. Провайдер без состояния показывает «No data yet», а не ноль.
- **Последний запуск и история.** Новейшая строка `indexing history` со статусом, числом отправленных/проверенных и до пяти `error_items` (URL, код, сообщение), плюс компактная таблица 7/30 дней по дням и провайдерам из `indexing history --limit 30`.
- **Честность.** Каждый рендер содержит `data_age_days` и `limitations`; устаревший агрегат GSC помечен и отделён. Bing/Yandex/IndexNow показывают отсутствие счётчика по URL, а не выдуманное число.
- **Совместимость.** Если движок отвечает `INVALID_COMMAND`, карточка показывает «Indexing status needs engine >= 0.13.1» и скрывает таблицы. Движок старше `0.15.1` оболочка считает несовместимым.
- **Мост.** `indexing_status` (`provider`, `limit`, `live`), `indexing_history` (`limit`) и `schedule_status` (`kind`, `target`) в белом списке; Rust проверяет каждое значение, отклоняет write-флаги и аргументы другой команды и использует таймаут 120 с. `--live` — единственный вызов провайдера; отсутствующий ключ становится ограничением, а не сбоем.

## Конфигурация

`[indexing]` по умолчанию выключена. `enabled = true` нужен перед применением; без него запуск —
только план. `providers` выбирает движки, а `max_submit_per_run` (500), `max_inspect_per_run` (20),
`stale_days` (7), `check_interval_days` (7), `gsc_inspect_daily_limit` (2 000) и
`indexnow_daily_limit` (1 000) ограничивают работу.

## Ограничения

- Карточка в приложении только для чтения: она не устанавливает, не редактирует и не запускает задание.
- `--live` читает квоты Bing и Яндекса; отсутствующий ключ — это ограничение.
- Большой сайт проверяется за несколько запусков; `meta.truncated` сообщает об этом.
- Переобход Яндекса может вернуть 5xx на стороне провайдера; ежедневное задание повторит попытку.
- У IndexNow нет API статуса и опубликованной квоты; локальный дневной лимит — консервативная защита.
- Отправка sitemap в GSC и удаление sitemap в Bing остаются `WRITE_DISABLED`.

## См. также

- [Справочник CLI](/ru/reference/cli/)
- [Справочник конфигурации](/ru/reference/config/)
- [Автоматизация и доставка](/ru/automation/)
- [Настольное приложение](/ru/desktop/)

Source: `_source/engine-releases-0.12.0.md`, `_source/engine-releases-0.13.1.md`, `_source/engine-releases-0.15.1.md`, `_source/engine-releases-0.15.0.md`, `_source/engine-releases-0.14.1.md`, `_source/engine-releases-0.14.0.md`, `_source/desktop-releases-0.9.6.md`, `_source/desktop-releases-0.9.5.md`, `_source/desktop-releases-0.9.4.md`, `_source/desktop-releases-0.9.2.md`, `_source/desktop-releases-0.9.2-update.md`, `_source/engine-cli.md`, `_source/engine-config.md`.

---
title: 索引自动化
description: 配额感知的索引队列、状态、运行和历史，CLI 与只读 Indexing automation 卡片，每日 04:00 任务、写入密钥和诚实的索引计数。
---

# 索引自动化

索引自动化维护站点地图 URL 的本地队列，在最新数据源配额内提交允许的内容，并记录结果。它是
CLI 和调度器功能；桌面 `0.9.2` 卡片以只读方式展示相同数据。

## 功能

- **队列。** `indexing run` 读取项目站点地图（`<project.base_url>/sitemap.xml`，根加五个子文档，10,000 个 URL），并合并显式 `--url`。站外 URL 跳过，每个上限都会报告。
- **优先级。** 先处理从未提交的 URL，再处理 sitemap `lastmod` 晚于 `last_submitted_at` 的 URL，然后处理 `last_checked_at` 早于 `check_interval_days` 的 URL。`last_submitted_at` 晚于 `lastmod` 的 URL 会被跳过，除非使用 `--force`。
- **检查与写入。** 检查为只读：GSC URL Inspection 提供逐 URL 判定，Bing `GetUrlInfo` 在有抓取日期时给出 `crawled`。不带 `--allow-write` 时只检查和规划。带上后引擎重新读取配额、校验计划哈希、通过写入门控生成并消费内部确认令牌，并为每个数据源写入一行 `indexing_runs`。
- **每日任务。** `schedule install --kind indexing` 为 cron、systemd 和 Windows 任务计划程序渲染每日 **04:00** 的 `lv24-seo-indexing` 任务，命令为 `indexing run --allow-write --config <abs> --json`。生成的命令永远不包含密钥。

```bash
lv24-seo indexing status --live --json
lv24-seo indexing status --provider bing --limit 50 --json
lv24-seo indexing run --from-sitemap --max-submit 20 --max-inspect 5 --json
lv24-seo indexing run --from-sitemap --allow-write --json
lv24-seo indexing history --limit 20 --json
lv24-seo schedule install --kind indexing --allow-write --json
```

## 配额与上限

上限在调用数据源之前执行。配额耗尽为 `quota_exhausted`，带 `submitted: 0` 和 `not_attempted`；
零绝不表示“全部已索引”。

| 引擎 | 剩余配额来源 | 每次运行上限 |
|---|---|---|
| Bing | `GetUrlSubmissionQuota` 的每日和每月剩余值 | 每个 `SubmitUrlbatch` 500 个 URL；计划受较小剩余窗口限制 |
| Yandex | `recrawl/quota` 的 `quota_remainder` | 每个 URL 一个 POST；没有批量端点 |
| GSC | 没有剩余量 API；本地 UTC 日 `quota_usage` 计数器 | 默认每站每天 2,000 次检查，`max_inspect_per_run` 20 |
| IndexNow | 没有状态或配额 API；本地 UTC 日计数器 | 默认每天 1,000 次提交，每次 POST 10,000 个 URL |

`indexing status` 按数据源显示 `urls`、`submitted`、`crawled`、`queued`、`indexed`（样本）、
`indexed_total`（GSC 聚合）、`pending`、`quota` 和 `limitations`。`--live` 现在读取 Bing 和 Yandex
配额；不带时显示上次记录的配额并带 `quota_not_live`。

## 写入密钥与门控

`indexing run --allow-write` 需要 `[indexing] enabled = true` 和同一环境中的
`LV24_SEO_WRITE_SECRET`。计划提交需要调度器环境中的密钥（systemd drop-in、用户环境或 cron 导出），
绝不能放在命令行。`indexing status` 只以 `write_secret_present` 报告是否存在密钥；值从不进入信封。
重放令牌为 `skipped`/`duplicate`；数据源失败会释放 claim。

## 诚实的索引计数

只有 GSC 提供逐 URL 判定（`PASS`/`Submitted and indexed` → `indexed`；`NEUTRAL`/`FAIL` →
`not_indexed`；其他为 `unknown`）。GSC 站点地图 `contents[].indexed` 聚合单独作为 `indexed_total`
报告，并始终标记 `gsc_indexed_count_deprecated`。Bing `GetUrlInfo` 给出 `http_status` 和
`last_crawled_at`，因此已抓取的 URL 是 `crawled`，不是 `indexed`（`bing_no_per_url_index_status`）。
Yandex 和 IndexNow 没有逐 URL 状态；其 `indexed_total` 为 `null` 并带 `no_per_url_index_count`。

**Bing Site Scan 没有公开 API。** 每个 Bing 条目都带 `site_scan_no_api`；桌面只打开官方页面，
绝不声称启动、监控或导入扫描。

## 桌面 Indexing automation 卡片

桌面 `0.9.2` 在 Integrations 新增只读卡片。它渲染 `indexing status`、`indexing history` 和
`schedule status`；没有写入、确认或 `--allow-write` 控件。

- **计划。** `Scheduled`/主机状态和文档化的 **Daily 04:00** 节奏（`lv24-seo-indexing`）。
- **按数据源。** Bing、Yandex、GSC 和 IndexNow 行，包含 `submitted`、`indexed`（仅 GSC）、`pending` 和配额：Bing 每日/每月剩余、Yandex 剩余、GSC/IndexNow 已用/上限。没有状态的数据源显示“No data yet”，绝不是零。
- **最近运行与历史。** 最新 `indexing history` 行，含状态、提交/检查数和最多五个 `error_items`（URL、代码、消息），以及来自 `indexing history --limit 30` 的紧凑 7/30 天按日/数据源表格。
- **诚实性。** 每次渲染都包含 `data_age_days` 和 `limitations`；已弃用的 GSC 聚合会标注并分开。Bing/Yandex/IndexNow 显示没有逐 URL 计数，而不是编造数字。
- **兼容性。** 如果引擎返回 `INVALID_COMMAND`，卡片显示“Indexing status needs engine >= 0.13.1”并隐藏表格。低于 `0.14.0` 的引擎会被外壳报告为不兼容。
- **桥接。** `indexing_status`（`provider`、`limit`、`live`）、`indexing_history`（`limit`）和 `schedule_status`（`kind`、`target`）进入白名单；Rust 校验每个值，拒绝写入标志和跨命令参数，并使用 120 秒超时。`--live` 是唯一的数据源调用；缺少凭据会成为限制，而不是失败。

## 配置

`[indexing]` 默认关闭。应用前需要 `enabled = true`；否则运行只是只读计划。`providers` 选择引擎，
`max_submit_per_run`（500）、`max_inspect_per_run`（20）、`stale_days`（7）、`check_interval_days`（7）、
`gsc_inspect_daily_limit`（2,000）和 `indexnow_daily_limit`（1,000）限制工作量。

## 限制

- 桌面卡片只读：不能安装、编辑或运行任务。
- `--live` 读取 Bing 和 Yandex 配额；缺少凭据是限制。
- 大站点需要多次运行采样；`meta.truncated` 会说明。
- Yandex 重新抓取可能返回数据源侧 5xx；每日任务会在下次运行重试。
- IndexNow 没有状态 API，也没有公开配额；本地每日上限是保守保护。
- GSC sitemap 提交和 Bing 站点地图删除仍为 `WRITE_DISABLED`。

## 相关页面

- [CLI 参考](/zh/reference/cli/)
- [配置参考](/zh/reference/config/)
- [自动化与投递](/zh/automation/)
- [桌面应用](/zh/desktop/)

Source: `_source/engine-releases-0.12.0.md`, `_source/engine-releases-0.13.1.md`, `_source/engine-releases-0.14.0.md`, `_source/desktop-releases-0.9.2.md`, `_source/desktop-releases-0.9.2-update.md`, `_source/engine-cli.md`, `_source/engine-config.md`.

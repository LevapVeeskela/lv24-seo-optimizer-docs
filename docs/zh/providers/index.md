---
title: 数据源与配额
description: LV24 SEO Optimizer 的提供商能力矩阵、认证、配额、数据延迟、截断与限制。
---

# 数据源与配额

工具输出的每个数字都来自提供商 API 或内置抓取。每个来源都有硬性限制，工具会如实报告这些限制，而不是假装数据完整。默认路径只使用免费额度，不需要任何付费提供商。

相关页面：[报告与差异](/zh/reports/)、[抓取与审计](/zh/crawl/)、[自动化与投递](/zh/automation/)、[MCP 与智能体技能](/zh/mcp/)。

## 能力矩阵

| 来源 | 读取 | 写入（需确认） | 认证 | 免费配额 | 数据延迟 |
|---|---|---|---|---|---|
| Google Search Console | 带类型/过滤/data-state 的搜索分析、站点、站点地图、URL Inspection | 提交站点地图；已禁用（`WRITE_DISABLED`，需要完整 `webmasters` scope） | Bearer 访问令牌（读取用 `webmasters.readonly`）或服务账号 JSON 密钥 | 每个站点和每个用户 1,200 次/分钟；每天每站点每类型 50,000 行；URL Inspection 每天 2,000 次、每分钟 600 次 | 2–3 天；`data_age_days` 下限为 3 |
| Yandex Webmaster | 摘要、SQI 历史、索引、搜索中的 URL 与事件、样本、站点地图、查询历史、重新抓取队列、查询、诊断、失效链接 | 重新抓取队列（受限；每个 URL 一次 POST，受每日剩余配额限制） | OAuth 令牌，scope `webmaster:hostinfo` | 免费；未公布全局 RPD/RPS；查询分析在约每小时 1 万次请求以上不稳定 | 约 4 天 |
| Yandex Metrika | 自然搜索与全部访问/用户；自然搜索页面、搜索词、设备、国家、互动、目标和 bytime | 无 | OAuth 令牌，scope `metrika:read` | 每天每用户 5,000 次请求；30 rps/IP；3 个并发；`/stat/v1/data` 每 5 分钟 200 次；每次请求最多 10 万行、20 个指标、10 个维度 | Reporting API；会报告抽样 |
| Bing Webmaster | 查询/页面统计、每日流量、六个月抓取、查询/页面关联、URL 与子 URL 详情、站点角色、账户站点、抓取问题、配额、站点地图源 | 站点地图提交、URL 提交和 IndexNow（均受限） | 每个用户一个 API 密钥 | 免费；`GetUrlSubmissionQuota` 报告每日/每月剩余配额；每批 500 个 URL | 年龄取最新有日期的行；空统计为 `no_rows_for_window` |
| Chrome UX Report (CrUX) | 字段 p75 LCP、INP、CLS 及其他指标；每周 p75 历史；收集周期 | 无 | API 密钥 | 每个项目每分钟 150 次，无法提高 | 28 天滚动窗口；`data_age_days` 来自 `collectionPeriod.lastDate` |
| PageSpeed Insights (PSI) | Lighthouse 实验室评分和每个 URL 最多 100 条有界审计 | 无 | API 密钥可选；无密钥也能用，但配额较低 | 每天约 2.5 万次请求 | 实时实验室运行 |
| GA4（可选） | 自然搜索落地页、会话、关键事件 | 无 | Google Analytics Data API 凭据 | 适用提供商配额 | 方向性；阈值处理可能隐藏行 |
| 自有抓取 | 页面、问题、链接图、站点地图覆盖 | 无 | 无 | 本地 | 当前运行 |
| 日志 | 对 nginx JSON 访问日志按 User-Agent 做机器人分诊；不能证明是已验证的爬虫 | 无 | 本地文件 | 本地 | 日志窗口 |

GA4 是可选的集成点，不在默认路径中。随版本提供的提供商是 GSC、Yandex Webmaster、Yandex Metrika、Bing、CrUX 和 PSI。付费 SERP 或外链适配器（DataForSEO、SerpApi 等）仅处于计划或文档阶段；0.12.2 不随版本提供任何此类适配器。

## 认证

```bash
lv24-seo auth status --json
lv24-seo auth set --provider gsc --stdin
lv24-seo auth login --provider gsc
lv24-seo auth logout --provider gsc
```

`auth set` 接受 `gsc`、`yandex`、`metrika`、`bing`、`crux`、`psi`、`smtp` 和 `telegram`。它从 stdin 或隐藏提示读取密钥，存入操作系统钥匙串，并且只打印 `{provider, stored, source}`。密钥值不会被回显、写入日志或写进 `seo.toml`。如果钥匙串和文件回退都不可用，命令会以 `WRITE_DISABLED` 失败。

| 提供商 | 环境变量 |
|---|---|
| GSC | `LV24_SEO_GSC_TOKEN` |
| Yandex Webmaster | `LV24_SEO_YANDEX_WEBMASTER_TOKEN` |
| Yandex Metrika | `LV24_SEO_YANDEX_METRIKA_TOKEN` |
| Bing | `LV24_SEO_BING_API_KEY` |
| CrUX | `LV24_SEO_CRUX_API_KEY` |
| PSI | `LV24_SEO_PSI_API_KEY` |
| SMTP | `LV24_SEO_SMTP_PASSWORD` |
| Telegram | `LV24_SEO_TELEGRAM_BOT_TOKEN` |

解析顺序是环境变量、可选的钥匙串、最后是显式启用的文件回退。环境变量始终优先且只读：只要对应变量已设置，`auth set` 和 `auth logout` 就会拒绝。请先在 shell 中取消该变量。

钥匙串支持来自可选的 extra：

```bash
pip install "lv24-seo[secrets]"
```

没有钥匙串时，无头回退是权限为 `0600` 的 `data/secrets.json`，只有设置 `LV24_SEO_ALLOW_FILE_SECRETS=1` 才启用。回退生效期间每次运行都会警告；在 Windows 上文件系统不会强制该权限模式。

凭据是手动提供的访问令牌和 API 密钥。工具不执行 OAuth 握手、不刷新令牌，也不把服务账号密钥换成访问令牌。`auth status` 只报告是否存在以及存储来源；它不调用 API，因此存在并不证明有效或有权限。

## 配额、延迟与截断

提供商配额在发送请求前由保守的客户端令牌桶限制。429 或耗尽的配额会变成类型化错误，而不是部分成功。需要提前规划的主要限制：

- GSC 搜索分析每天、每站点、每搜索类型上限为 50,000 行。恰好填满上限的最后一页会报告 `truncated: true` 和 `rows_cap_50000`；调用方设置更小上限时会产生指名该行数限制的警告。完整一页不能证明上限后没有更多行。
- 被截断的 GSC 结果完全省略 `total`。精确行数配上 `truncated: true` 会被读成完整答案，因此只有以短页结束的遍历才报告总数。
- GSC 数据比当前日期滞后 2–3 天，因此 `data_age_days` 下限为 3。结束于今天的窗口绝不会被呈现为最新数据。
- GSC 分组会丢行。不要把按 `page` 分组的总和与按 `query` 分组的总和相比较，也不要同时请求两个维度再与未分组总数比较。
- Yandex Webmaster 每个周期只提供前 3,000 个查询，每页最多 500 条，并且不支持查询与页面的关联。缺失的行是未知，不是零。
- Webmaster 响应中的普通 `count` 是当前页的大小，不是总计，因此它不再提前终止分页而隐藏行。
- 已加载的 Yandex 主机若索引历史或搜索 URL 事件为空，就是空答案：`total: 0` 加 `empty_history` 限制，而不是 `degraded_host`。只有 `404` 或显式的 `HOST_NOT_LOADED` 负载才算降级。
- Yandex Metrika 默认抽样（`accuracy=medium`）。抽样响应会带上 `sampled` 限制和警告；请把准确度标志与数值一起保存。
- Metrika 的 `limit` 是页大小，不是结果大小。客户端用 `offset` 遍历 `stat/v1/data`，直到 `total_rows`、短页或上限；单次调用上限为 10,000 行和 100 页，即使调用方页大小很小也仍在该 5 分钟 200 次请求的配额内。没有 `total_rows` 的完整页会标记为 `truncated`，而不是看起来完整；无维度的聚合调用只有一行，绝不翻页。
- CrUX 在 URL 流量不足时返回 404；这会变成 `low_traffic`，而不是零分。
- PSI 是实验室数据。不要平均实验室运行结果，也不要与 CrUX 字段数据合并。
- Bing 统计 API 没有日期窗口，因此报告不会为 Bing 显示上一周期对比。`data_age_days` 取最新有日期的行：查询/页面/流量/抓取/关联统计用 `Date`，站点地图源用 `LastCrawled`（回退 `Submitted`），URL 详情用 `LastCrawledDate`。`GetCrawlIssues` 和 `GetUserSites` 没有日期，报告 `0`，这不能证明数据新鲜。0 行的统计或关联响应携带 `no_rows_for_window`；查找或列表没有行时携带 `provider_returned_no_rows`。两者都不是“零展示”。

每个有界响应都带有相同的诚实性字段：`truncated`、`total`、以天为单位的数据年龄（`data_age_days`）以及 `limitations[]`。`rows` 是返回的行数，不是总数。只有提供商或存储能够报告时才会出现 `total`。

稳定的限制代码：

| 代码 | 含义 |
|---|---|
| `rows_cap_50000` | GSC 达到 50,000 行上限；完整最后一页可能被截断 |
| `no_query_page_join` | 提供商无法在同一数据集中关联查询与页面 |
| `top_3000_queries` | Yandex 查询数据仅限前 3,000 个 |
| `sampled` | Metrika 返回了抽样数据 |
| `low_traffic` | CrUX 对某个 URL 或 origin 的流量不足 |
| `degraded_host` | Yandex 报告主机未完全加载 |
| `empty_history` | 已加载的 Yandex 主机在该窗口没有索引或搜索 URL 历史 |
| `one_url_per_call` | URL Inspection 每次调用只处理一个 URL，不能批量 |
| `inspection_reflects_last_crawl` | URL Inspection 描述 Google 的最后一次抓取，不是实时测试 |
| `no_per_url_sitemap_errors` | Yandex 或 Bing 不暴露按 URL 的站点地图错误详情 |
| `sitemap_index_children_not_exposed` | GSC 不暴露索引中的子站点地图 URL |
| `sitemap_indexed_count_deprecated` | GSC 的 `indexed` 计数已弃用 |
| `no_rows_for_window` | Bing 在该窗口没有统计行；这是缺失数据，不是零展示 |
| `provider_returned_no_rows` | 查找或列表没有返回对象或行 |
| `crawl_stats_six_month_window` | Bing 抓取统计始终覆盖六个月每日窗口 |
| `never_crawled` | Bing 的 `Date(-62135596800000)` 哨兵表示从未抓取 |
| `client_side_date_filter` | Yandex 重置了带窗口的事件请求；完整序列在本地过滤 |
| `crux_period_missing` | CrUX 未返回 `collectionPeriod`；使用了两天启发式 |
| `crux_history_gaps` | CrUX 返回了没有合格 p75 值的周期 |
| `crux_url_normalized` | CrUX 在查询前规范化了请求的 URL |
| `psi_audits_cap` | Lighthouse 审计列表被限制为 100 行 |
| `indexnow_accepted_pending` | IndexNow 返回 `202`；引擎仍需验证密钥 |
| `recrawl_quota_exceeded` | Yandex 重新抓取遇到 `429`；剩余 URL 在 `not_attempted` 中 |
| `no_per_url_index_count` | 提供商不提供逐 URL 索引计数；`indexed_total` 为 `null` |
| `bing_no_per_url_index_status` | Bing `GetUrlInfo` 只报告抓取状态，不是索引判定 |
| `yandex_no_per_url_index_status` | Yandex 不提供逐 URL 索引判定 |
| `indexnow_no_status_api` | IndexNow 没有状态 API；`200` 表示已接受 |
| `site_scan_no_api` | Bing Site Scan 没有公开 API；引擎不自动化它 |
| `gsc_indexed_count_deprecated` | GSC 站点地图 `contents[].indexed` 聚合已弃用 |
| `bing_quota_reset_undocumented` | Bing 未公开每月提交配额的重置时间 |
| `quota_exhausted` | 运行没有剩余的数据源或本地配额；没有提交任何内容 |
| `write_secret_missing` | 缺少 `LV24_SEO_WRITE_SECRET`，应用会被拒绝 |
| `token_expiring` | 凭据即将过期 |
| `paid_provider` | 该行来自付费适配器 |
| `partial_response` | 提供商返回了不完整的响应 |

## 0.11.0 的读取深度

**GSC。** `gsc inspect --url ABS [--language en-US]` 映射完整 `indexStatusResult`（`verdict`、`coverageState`、`robotsTxtState`、`indexingState`、`lastCrawlTime`、`pageFetchState`、`googleCanonical`、`userCanonical`、`crawledAs`、`sitemap[]`、`referringUrls[]`）、`richResultsResult` 和 `inspectionResultLink`。这是最后一次抓取的报告，不是实时测试：每次一个 URL，每天 2,000 次/站点，每分钟 600 次。`gsc sitemaps` 和 `gsc sitemap --path` 映射类型、索引标志、错误、警告和 `contents[]`；已弃用的 `indexed` 会标注，索引的子站点地图 URL 不暴露，提交/删除仍为 `WRITE_DISABLED`。`gsc query` 接受 `--type`、可重复 `--filter`/`--filter-list`、`--data-state`、`--aggregation`、`--search-appearance` 和 `--branded`；响应增加 `responseAggregationType` 和不完整数据 `metadata`。每页 25k 行和每天 50k 行的上限不变。

**Yandex。** `yandex indexing --date-from/--date-to` 把 appeared/removed 事件与索引 HTTP 序列合并；日期窗口上连接重置时不带窗口重试并报告 `client_side_date_filter`。`yandex samples --kind indexing|events` 每页 100 行，诚实报告 `total`/`truncated`。`yandex sitemaps` 读取 id、URL、错误、子项和来源；添加/删除未实现。`yandex history --kind sqi|in-search|queries|query` 读取 SQI、搜索中页面、全部查询和单查询序列。`yandex queue` 读取重新抓取任务。`yandex recrawl` 每个 URL 一次 POST，受剩余配额限制；`202` 给出 `task_id`/`quota_remainder`，`409` 为 `already_queued`，`429` 把剩余放在 `not_attempted`。

**Bing。** `bing pages`、`bing traffic`、`bing crawl` 和 `bing joins` 只读；空窗口为 `no_rows_for_window`，`bing crawl` 始终带 `crawl_stats_six_month_window`。`bing urlinfo` 读取 `GetUrlInfo`；`Date(-62135596800000)` 哨兵映射为 `null` 和 `never_crawled`。`bing children` 最多 10 页，完整最后一页标记 `truncated` 和 `children_page_cap`。`bing users` 读取角色且不回显委托码；`bing sites` 读取账户站点。`bing joins --query|--page` 选择三种关联之一并返回紧凑行。

**Metrika。** `metrika` 组（`pages`、`goals`、`queries`、`devices`、`countries`、`engagement`、`bytime`）只读且始终为自然搜索（`ym:s:lastTrafficSource=='organic'`，`meta.organic_only: true`）。`stats` 和 `report weekly` 分别显示 `organic_visits`/`organic_users` 与 `all_visits`/`all_users`。`metrika goals` 从 `providers.yandex_metrika.goals` 读取 id，可按 `page` 或 `source` 分组；空列表只警告不调用，超过五个目标按 Metrika 20 指标上限截断。抽样字段（`sample_share`、`sample_size`、`sample_space`、`data_lag`、`contains_sensitive_data`、`total_rows_rounded`）带入 meta 和 limitations；只有 `sampled=false` 才精确。`data_age_days` 只描述当前窗口。

**CrUX 与 PSI。** `cwv history (--url | --origin) [--device] [--weeks 1..40]` 读取每周 p75 周期，含 `first_date`/`last_date`；缺口为 `crux_history_gaps`，短历史为 `crux_history_short`。`cwv audits` 返回最多 100 条 Lighthouse 审计，含评分、显示值、去 HTML 描述和可节省量；`runtimeError`、CAPTCHA 和不同 `finalUrl` 是警告/限制，不是干净运行。`collectionPeriod` 决定 `data_age_days`；两天启发式仅作为 `crux_period_missing` 回退，URL 规范化产生 `crux_url_normalized`。

**IndexNow。** 密钥 `[A-Za-z0-9-]{8,128}` 在规划前验证；同主机 `keyLocation` 限制目录。`200` 为 accepted，`202` 为 accepted-pending，`400` 为格式，`403` 为缺失/不匹配的密钥文件并带精确 URL，`422` 为主机/密钥不匹配，`429` 为配额/垃圾提交。密钥绝不回显。

## 索引自动化

`indexing status|run|history` 为每个数据源和 URL 维护一个本地队列（`indexing_state`，模式 v5），并在最新配额内规划提交和检查。`indexing run` 默认读取项目 sitemap（根加五个子文档，10,000 个 URL），并合并显式 `--url`；站外 URL 跳过，每个上限都会报告。

| 数据源 | 提交路径 | 配额来源 | 逐 URL 索引检查 | 诚实限制 |
|---|---|---|---|---|
| Bing | `SubmitUrlbatch`，每次 500 个 URL | `GetUrlSubmissionQuota`：`daily_remaining` / `monthly_remaining`（剩余量，不是总量） | `GetUrlInfo` 只给 `http_status` 和 `last_crawled_date` | `bing_no_per_url_index_status`、`no_per_url_index_count`、`site_scan_no_api`、`bing_quota_reset_undocumented` |
| Yandex | `recrawl/queue`，每个请求一个 URL | `recrawl/quota`：`daily_quota` / `quota_remainder` | 无 | `yandex_no_per_url_index_status`、`no_per_url_index_count`、`one_url_per_call` |
| IndexNow | 一次 POST，最多 10,000 个 URL | 本地 UTC 日计数器，受 `[indexing].indexnow_daily_limit` 限制（默认 1,000） | 无 | `indexnow_no_status_api`、`no_per_url_index_count`；`200` 是已接受，不是已索引 |
| GSC | 不用于提交 | 本地 UTC 日计数器，受 `[indexing].gsc_inspect_daily_limit` 限制（默认 2,000） | URL Inspection：`PASS` / `Submitted and indexed` → `indexed`；`NEUTRAL` / `FAIL` → `not_indexed`；其他为 `unknown` | 单独的站点地图聚合带 `gsc_indexed_count_deprecated` |

优先级：先从未提交的 URL，再是 sitemap `lastmod` 晚于 `last_submitted_at` 的 URL，然后是 `last_checked_at` 早于 `check_interval_days` 的 URL。`last_submitted_at` 晚于 `lastmod` 的 URL 会被跳过，除非使用 `--force`。不带 `--allow-write` 时只检查和规划；带上后引擎重新读取配额、校验计划哈希、消费内部确认令牌，并为每个数据源写入一行 `indexing_runs`。重放同一个确认令牌会返回 `skipped`/`duplicate`，不会新增队列条目或 `indexing_runs` 行。

索引计数保持诚实：只有 GSC URL Inspection 提供逐 URL 判定。GSC 站点地图 `contents[].indexed` 聚合单独作为 `indexed_total` 报告，并始终标记 `gsc_indexed_count_deprecated`。Bing、Yandex 和 IndexNow 返回 `indexed_total: null` 并带 `no_per_url_index_count`；零永远不会被渲染成“全部已索引”。Bing Site Scan 没有公开 API（`site_scan_no_api`）。

计划提交需要 `[indexing] enabled = true` **以及** 调度器启动任务时的环境中的 `LV24_SEO_WRITE_SECRET`。生成的 `lv24-seo-indexing` 命令包含 `--allow-write`，但永远不包含密钥；`indexing status` 会在下一次应用以 `WRITE_DISABLED` 失败前报告 `write_secret_present` 和 `write_secret_missing`。参见[自动化与投递](/zh/automation/)。

2026-11-17 对 `lv24.by` 运行 `indexing status --live`：Bing 每日剩余 99 / 每月 1399，Yandex 150，GSC 0/2000，IndexNow 0/1000，`write_secret_present: true`。首次运行提交了 5 个 Bing 和 5 个 IndexNow URL，检查了 15 个 GSC URL（3 个已索引）；Yandex POST 在数据源侧返回 HTTP 504，由每日任务重试。

## 站点地图范围

站点地图的 `<loc>` 只有在其 origin 处于范围内时才会被抓取：起始站点地图的 origin，加上每个实际读取文档的最终 origin。因此重定向到 CDN 镜像仍在范围内，而指向无关主机的 loc 则不在。被拒绝的 loc 会被丢弃并一次性报告为 `off_origin_loc`，所以没有外部受限抓取器的读取器也绝不会沿着站点地图走到另一个站点。索引中的子站点地图也应用同样的 origin 检查。

## 不抓取 SERP

工具从不抓取 Google 或 Yandex 的结果页，不绕过 CAPTCHA，也不通过浏览器会话自动化 Yandex Business 卡片或评价回复。排名和查询数据来自 GSC 与 Yandex Webmaster API。提供商不暴露的指标就保持未知。

可选的付费适配器使用自带密钥，默认关闭。它们必须使用相同的结果信封，并用 `paid_provider` 标记行；默认路径从不依赖它们。提供商数据不会被转售或重新发布：报告在本地为站点所有者生成。

## 时区感知的窗口

`report.timezone` 是 IANA 时区（默认 `Europe/Minsk`），用于报告和 `stats` 窗口、MCP 默认窗口以及本地日期边界。提供商数据仍按日期存储，不做转换。无效时区会在配置校验时以 `CONFIG_INVALID` 失败；不支持的值绝不会静默回退。

调度器生成器在后端支持时应用同一时区。Cron 依赖 `CRON_TZ`，systemd 把时区写入 `OnCalendar`，Task Scheduler XML 携带固定偏移并给出 DST 警告。参见[自动化与投递](/zh/automation/)。

Source: `_source/engine-data-sources.md`, `_source/engine-cli.md`, `_source/engine-config.md`, `_source/engine-releases-0.12.2.md`, `_source/engine-releases-0.12.0.md`, `_source/engine-releases-0.11.0.md`, `_source/engine-releases-0.10.0.md`, `_source/engine-releases-0.5.3.md`.

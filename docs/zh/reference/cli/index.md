---
title: CLI 参考
description: lv24-seo 命令行的命令、全局参数、JSON 信封、退出码和示例。
---

# CLI 参考

`lv24-seo` 是引擎的命令行入口。它默认只读取提供方数据，使用 `--json` 时只输出一个机器可读信封，
并且只通过三个显式受控的写入命令改变提供方状态。同一个可执行文件可在 Windows、macOS 和 Linux
上运行。

## 命令表

该表可按命令、分组或描述筛选。命令名和参数在所有语言中完全一致，只有周围的文档被翻译。

<CliTables />

每个命令还接受 `--help`，它会输出当前安装版本的权威参数列表。

## 全局约定

### 响应信封

使用 `--json` 时，命令只输出一个 JSON 文档，不会输出其他内容：

```json
{ "ok": true, "data": {}, "meta": { "version": "0.14.0", "duration_ms": 812 }, "warnings": [] }
```

失败的命令使用相同结构，但 `ok: false`，并用 `error` 对象代替 `data`：

```json
{ "ok": false, "error": { "code": "AUTH_REQUIRED", "message": "Google Search Console token is missing", "retryable": false, "next_action": "lv24-seo auth login --provider gsc" }, "meta": { "version": "0.14.0" }, "warnings": ["gsc: token missing"] }
```

- `data` 因命令而异。`meta` 始终包含 `version`，通常还会加入 `duration_ms`、`truncated`、
  `data_age_days`、`limitations`、`locale` 或 `complete`。
- `warnings` 是简短的面向人的字符串。像 `stats` 这样的聚合命令在某个提供方失败时仍保持
  `ok: true`：失败会计入 `coverage` 并写入 `warnings`。
- 不带 `--json` 时，stdout 输出简洁的文本摘要，随后是警告和错误行。两种模式都不输出 ANSI 颜色。
- `config show` 会添加 `meta.redacted: true`；看起来像凭据的键会以 `***` 掩码。

### 退出码

| 退出码 | 含义 | 对应错误码 |
|---|---|---|
| `0` | 成功。信封为 `ok: true`。 | — |
| `1` | 未预期的内部故障。 | `INTERNAL` |
| `2` | 用法或配置问题。 | `INVALID_INPUT`, `CONFIG_INVALID`, `CONFIRM_REQUIRED`, `WRITE_DISABLED` |
| `3` | 认证问题。 | `AUTH_REQUIRED`, `AUTH_INVALID` |
| `4` | 配额或上游服务故障。 | `QUOTA_EXCEEDED`, `UPSTREAM_UNAVAILABLE` |
| `5` | 部分结果：严格模式下输出被截断。 | `TRUNCATED`，或任何带 `meta.truncated` 和 `meta.strict` 的 `ok: true` 信封 |

`WRITE_DISABLED` 的退出码是 `2` 而不是 `4`：写入在调用提供方之前就被拒绝。退出码 `5` 是部分结果，
不是硬失败：数据真实，但覆盖不完整。请依据退出码和 `error.code` 判断，不要解析面向人的文本。

### `--strict` 与退出码 5

`--strict` 把截断变成 CI 闸门。它适用于 `stats`、`gsc query`、`yandex queries`、`yandex indexing`、
`yandex samples`、`yandex sitemaps`、`yandex history`、`yandex queue`、七个 `metrika` 读取、
`bing pages`、`bing traffic`、`bing crawl`、`bing urlinfo`、`bing children`、`bing users`、
`bing sites`、`bing joins`、`bing quota`、`bing sitemaps`、`bing issues`、`crawl`、`report weekly`
和 `report diff`：

```bash
lv24-seo gsc query --start 2026-11-01 --end 2026-11-07 --strict --json
lv24-seo report weekly --days 7 --strict --json
```

- 传入该参数时总会设置 `meta.strict`，因此消费者能区分严格运行与普通运行。
- 完整响应仍返回 `0`。
- 截断的响应保持 `ok: true`（数据是真实的），但返回 `5`，并由 `meta.limitations` 说明缺失了什么。如果提供方设置了 `truncated` 却没有限制说明，CLI 会补上。
- 不带 `--strict` 时，截断的响应返回 `0`，且不包含 `meta.strict`。

`report diff --markdown` 遵循同一退出码：Markdown 仍打印到 stdout，严格模式下 diff 被截断时进程返回 `5`。

### 存储故障

SQLite 问题不再表现为通用的 `INTERNAL`，而是三个稳定代码：

| 代码 | 含义 | 可重试 | 处理方式 |
|---|---|---|---|
| `STORE_LOCKED` | 另一个进程持有写锁超过 busy timeout | 是 | 等待另一个 `lv24-seo` 运行结束再重试；没有写入任何内容 |
| `STORE_CORRUPT` | 文件不是可用的 SQLite 数据库 | 否 | 查看 `detail.backup_path`，然后移动或删除数据库并重跑 |
| `STORE_UNAVAILABLE` | 权限、父目录缺失或磁盘已满 | 否 | 修复数据目录，然后运行 `lv24-seo doctor` |

损坏文件会先被复制到自身旁边，名为 `seo.sqlite3.corrupt-20260101T101010Z`；原文件绝不会被移动或删除，
复制失败也不会掩盖错误。三个代码的退出码都是 `1`，与 `INTERNAL` 相同；请依据 `error.code` 判断。

### 配置与参数

- `--config PATH` 选择特定的 `seo.toml`。路径必须存在；文件缺失会返回 `CONFIG_INVALID`，不会
  静默回退。解析后的路径是绝对且规范化的，因此调度器产物和相对设置不依赖进程工作目录。同一路径
  也决定哪个工作区的数据目录保存写入账本，因此写入会把声明记录在配置指定的位置，而不是 shell 的
  工作目录。
- 不带 `--config` 时，引擎先查找 `./seo.toml`，再查找平台用户配置
  （Windows 为 `%APPDATA%\lv24-seo\config.toml`，Linux 为 `~/.config/lv24-seo/config.toml`）。
- `LV24_SEO_*` 环境变量覆盖文件中的值。`.env` 文件不会自动加载；请在 shell 或运行命令的服务
  单元中导出变量。
- `mcp serve` 是长期运行的服务器，不接受 `--json` 和 `--config`。

`doctor --json` 报告 `meta.data_dir`、`meta.data_dir_source`（有效目录为绝对时是 `config`，
为相对时是 `working directory`）和 `meta.data_dir_declared`（配置文件或 `LV24_SEO_DATA_DIR`
指定目录时为 true）。已声明的数据目录是硬性要求：缺失或不可用会导致检查失败。相对目录本身不是
错误，但与配置文件并存时会添加一条指明配置文件夹的警告。

完整的键列表、默认值和密钥处理见[配置参考](/zh/reference/config/)。

### 默认只读与写入闸门

只有 `sitemap submit`、`bing submit`、`yandex recrawl`、`indexnow submit` 和 `indexing run --allow-write` 可以改变提供方状态。它们分两步执行：

1. 设置足够长的随机 `LV24_SEO_WRITE_SECRET`，然后带 `--allow-write` 且不带 `--confirm` 运行命令。
   它会返回计划，包含 `data.plan`、`data.plan_hash`、`data.confirm_token` 和 `meta.dry_run: true`，
   且不联系提供商。
2. 在五分钟内使用 `--allow-write --confirm TOKEN` 重新运行。

令牌是对操作、目标、完整计划哈希和有效期的 HMAC，因此任何输入变化都会使其失效。工作区初始化
后，CLI 会附加 SQLite 幂等账本：重放同一令牌返回 `status: skipped` 和 `reason: duplicate`，
提供商只被调用一次。账本从所选工作区的数据目录打开：`--config /srv/site/seo.toml` 会把声明记录在
`/srv/site/data`，即使 shell 在别处。没有数据目录时仍会应用，但信封会警告：在令牌五分钟有效期内
没有重放保护；试运行不打开账本，也不创建数据库。

Bing 站点地图提交、Bing URL 提交和 IndexNow 会真正写入。Bing URL 提交报告 `accepted`，而不是已索引，
因为 `SubmitUrlbatch` 没有按 URL 的状态。GSC sitemap submit、Bing 站点地图删除和 Yandex recrawl 返回
`WRITE_DISABLED`，不会假装提供方调用已经发生。

### 日志

日志是可选项。`LV24_SEO_LOG_LEVEL=INFO`（或 `DEBUG`、`WARNING` 等）会在 CLI 和
`lv24-seo mcp serve` 中安装脱敏处理器；未设置变量时不会改变调用方的日志配置。当 stderr
不是终端时，每条记录输出一行 JSON；否则输出普通行。MCP 传输只写 stderr；stdout 保持协议
输出。`--json` 信封仍是稳定的诊断接口。

### 确定性与数据诚实

- 日期为 ISO-8601（`2026-11-10`）；时间戳为 ISO-8601 UTC（`2026-11-14T12:00:00+00:00`）。
- CLI 字段顺序稳定，保存的快照载荷按键排序，可见输出中没有随机标识符。报告和差异适合在多次
  运行之间直接比较。
- 有界响应在适用时携带 `truncated`、`total`、`data_age_days` 和 `limitations[]`。只出现在一个
  窗口中的指标会标记为未知，而不是零。
- `--days` 接受 `1..3660`；更大的值会以 `INVALID_INPUT` 失败并返回退出码 `2`。
- 任何命令都不会输出令牌、cookie 或完整的 `Authorization` 头。

## 命令分组

| 分组 | 命令 | 影响范围 |
|---|---|---|
| Start | `version`, `doctor`, `init`, `properties`, `stats` | 本地文件和环境；`stats` 只读取提供方 KPI，不写入。 |
| Authentication | `auth status`, `auth set`, `auth login`, `auth logout` | 本地密钥存储；`login` 只打印说明。 |
| Configuration | `config show` | 有效配置，凭据已掩码。 |
| Google Search Console | `gsc query`, `gsc inspect`, `gsc sitemaps`, `gsc sitemap` | 带过滤的搜索分析、URL Inspection 和站点地图读取，均只读。 |
| Sitemap | `sitemap submit` | 受控写入；Bing `SubmitFeed` 已接通，GSC 提交仍返回 `WRITE_DISABLED`。 |
| Yandex Webmaster | `yandex queries`, `yandex indexing`, `yandex samples`, `yandex sitemaps`, `yandex history`, `yandex queue`, `yandex recrawl` | 查询、事件、样本、站点地图、历史和队列只读；recrawl 是受控写入，受剩余配额限制。 |
| Yandex Metrika | `metrika pages`, `metrika goals`, `metrika queries`, `metrika devices`, `metrika countries`, `metrika engagement`, `metrika bytime` | 只读自然搜索视图；每个调用都应用 `ym:s:lastTrafficSource=='organic'`。 |
| IndexNow | `indexnow submit` | 受控写入，提交显式 URL 或从项目站点地图读取的 URL。 |
| Bing | `bing submit`, `bing pages`, `bing traffic`, `bing crawl`, `bing urlinfo`, `bing children`, `bing users`, `bing sites`, `bing joins`, `bing sitemaps`, `bing issues`, `bing quota` | `submit` 是受控的 `SubmitUrlbatch` 写入；其余读取页面、流量、抓取、URL、关联、站点地图、问题和配额。 |
| Crawl and audit | `crawl` | 与提供方无关；配置了存储时保存本地页面和问题。 |
| Indexing | `indexing status`, `indexing run`, `indexing history` | `status` 和 `history` 只读；`run` 默认只规划，只有带 `--allow-write` 才在最新配额内提交。 |
| CWV | `cwv collect`, `cwv audits`, `cwv history` | `collect` 持久化 CrUX 字段 p75 行；`audits` 和 `history` 是只读 PSI/CrUX 读取。 |
| Reports | `report weekly`, `report diff` | `weekly` 保存本地快照；`diff` 只读。 |
| Scheduling | `schedule print`, `schedule install`, `schedule status`, `schedule uninstall` | `print` 只渲染；`install` 和 `uninstall` 默认只生成计划，只有 `--allow-write` 才写入；`status` 只读。 |
| Logs | `logs analyze` | 只读分析一个本地 nginx JSON 访问日志；不会存储或上传。 |
| Tasks | `tasks list`, `tasks add`, `tasks update` | 工作区任务账本；`add` 幂等，`update` 遵循允许的状态转换。 |
| Backup | `backup create`, `backup restore` | `create` 写入一个可移植工作区归档；`restore` 规划就地替换或用 `--to` 解压到新目录。 |
| Portfolio | `portfolio list` | 只读汇总一个目录下的本地项目；不调用提供方、不读取令牌、不写入。 |
| Agents and MCP | `mcp serve`, `install`, `export tools`, `export skills` | 主机配置、生成文件或本地服务器。 |

CLI 有 25 个顶层命令：18 个组和 7 个命令（`version`、`doctor`、`init`、`properties`、`stats`、`crawl`、`install`）。

## 示例

### 仪表盘快照

```bash
lv24-seo stats --days 7 --lag-days 2 --json
```

只读，不需要存储。服务始终按 `gsc`、`yandex_webmaster`、`yandex_metrika`、`bing`、`crux`、
`psi` 的顺序出现；`metrics` 只包含实际返回的值，不补零，也不跨引擎求和。单个提供方失败会被
隔离，并增加 `coverage.failed`。

### Search Console

```bash
lv24-seo gsc query --start 2026-11-01 --end 2026-11-07 --dimensions query,page --limit 100 --json
lv24-seo gsc query --start 2026-11-01 --end 2026-11-07 --type image --data-state all --filter country:equals:BLR --json
lv24-seo gsc inspect --url https://example.com/ --language en-US --json
lv24-seo gsc sitemaps --sitemap-index https://example.com/sitemap-seo.xml --json
lv24-seo gsc sitemap --path https://example.com/sitemap.xml --json
```

`--start` 和 `--end` 是必填项。没有 `--days` 简写，也没有 `--property` 覆盖：资源来自
`seo.toml` 中的 `[providers.gsc]`。维度用逗号分隔，仅限 `query`、`page`、`country`、`device`
和 `date`。

`--type` 接受 `web`、`image`、`video`、`news`、`discover`、`googleNews` 和 `webMultimodal`。
`--filter` 接受 `dimension:operator:expression` 且可重复（一个 AND 组）；`--filter-list` 接受
`dimension:expr1,expr2` 且可重复。`--data-state` 接受 `all`、`final` 和 `hourly_all`；
`--aggregation` 接受 `auto`、`byPage`、`byProperty` 和 `byNewsShowcasePanel`；`--search-appearance`
添加 `searchAppearance equals` 过滤；`--branded` 接受 `branded` 或 `non_branded`，并且不能与
`query` 过滤同时使用。

`gsc inspect` 只处理一个绝对 URL。它映射完整 `indexStatusResult`、富媒体结果和
`inspectionResultLink`，并报告 `one_url_per_call`、`url_inspection_quota_2000_per_day` 和
`inspection_reflects_last_crawl`：它描述 Google 的最后一次抓取，不是实时测试。`gsc sitemaps` 和
`gsc sitemap --path` 映射类型、索引标志、错误、警告和 `contents[]`；已弃用的 `indexed` 计数会标注，
索引的子站点地图 URL 不暴露。站点地图提交/删除仍为 `WRITE_DISABLED`。

### Yandex

```bash
lv24-seo yandex queries --limit 100 --json
lv24-seo yandex indexing --date-from 2026-10-01 --date-to 2026-10-31 --json
lv24-seo yandex samples --kind events --limit 100 --json
lv24-seo yandex sitemaps --json
lv24-seo yandex history --kind sqi --json
lv24-seo yandex queue --json
```

`yandex queries` 返回顶部行，而不是完整的查询与页面关联：Yandex 每个周期最多提供 3,000 个查询。它保留
`avg_click_position`，在提供商发送时返回 `query_id`，并把未映射指标保留在 `extra_indicators` 中而不是
丢弃整行。`yandex indexing` 显示配置的 `host_id` 的索引历史、搜索中页面数、诊断、`site_problems` 和
搜索 URL 事件，并把 `indexing/history` 系列（`http_2xx` … `other`）与 appeared/removed 事件系列合并为
每个日期一行。提供商重置日期窗口时，会不带窗口重试并报告 `client_side_date_filter`。

`yandex samples` 每页 100 行分页读取样本端点，诚实报告总数。`yandex sitemaps` 列出 id、URL、错误/URL
数、子项和来源；添加/删除未实现。`yandex history --kind sqi|in-search|queries|query` 读取 SQI、搜索中
页面、全部查询和单查询序列。`yandex queue` 读取重新抓取任务及提供商总数。

`yandex recrawl --url https://example.com/page --allow-write` 规划写入；`--confirm TOKEN` 应用时每个
URL 一次 POST，受每日剩余配额限制。`202` 行携带 `task_id` 和 `quota_remainder`，`409` 为
`already_queued`，`429` 停止循环并把剩余放在 `not_attempted`。

### Bing 与 IndexNow

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

`sitemap submit` 的 `--provider` 默认为 `gsc`；`bing` 从 `providers.bing.site` 或 `--property` 取站点，
从 `--url` 或 `<project.base_url>/sitemap.xml` 取站点地图，从 `bing_api_key` 秘密取密钥。计划需要
`--allow-write` 和 `LV24_SEO_WRITE_SECRET`，在不调用 Bing 的情况下生成令牌；应用发送审核后的令牌，
并把声明记入幂等账本。`bing submit` 是原生 URL 写入：URL 来自可重复的 `--url` 和/或 `--from-sitemap`，
计划报告 URL 数、500 URL 批次数和剩余配额，应用在每日和每月配额预检后调用 `SubmitUrlbatch`。批次成功
没有按 URL 的状态，因此结果说 `accepted`，而不是已索引，重复 URL 可能消耗配额。`bing quota` 报告
`daily_remaining` 和 `monthly_remaining`，不是总量；月度窗口可能先耗尽，重置时间表未记录。
`bing sitemaps` 显示源 URL、提供商状态、最后抓取和 URL 数，但没有按 URL 的错误；`bing issues` 解码
抓取问题位掩码，没有严重性或日期。

`bing pages`、`bing traffic`、`bing crawl` 和 `bing joins` 是只读统计视图。空统计响应携带
`no_rows_for_window`，不是零展示；`bing crawl` 始终携带 `crawl_stats_six_month_window`。
`bing urlinfo --url URL|domain:HOST` 读取 URL 索引/抓取详情；WCF `Date(-62135596800000)` 哨兵映射为
`null`，从未抓取的行携带 `never_crawled`。`bing children` 最多 10 页，完整最后一页标记 `truncated`
和 `children_page_cap`。`bing users` 读取站点角色且不回显委托码；`bing sites` 读取账户的已验证站点。
`bing joins --query|--page` 选择三种查询/页面关联之一，并返回相同的紧凑行结构。

`indexnow submit --from-sitemap` 在计划阶段读取站点地图，并从 `providers.bing.site`、
`providers.bing.indexnow_key` 和 `providers.bing.indexnow_key_location` 解析主机、密钥和密钥位置。
密钥必须是 8–128 个 `A-Z`、`a-z`、`0-9` 和 `-` 字符；同主机 `keyLocation` 目录前缀会被强制执行。
`<sitemapindex>` 限制为根加五个子站点地图和 10,000 个 URL；显式 `--url` 先合并，主机外 URL 被跳过。
应用会重新获取站点地图，如果 URL 集合变化，则以 `CONFIRM_REQUIRED` 使令牌失效。缺少密钥时计划返回
`AUTH_REQUIRED`。提供商状态映射 `200` accepted、`202` accepted-pending、`400` 格式、`403` 缺失/不匹配
的密钥文件、`422` 主机/密钥不匹配和 `429` 配额/垃圾提交；密钥绝不回显。

### 索引自动化

```bash
lv24-seo indexing status --live --json
lv24-seo indexing status --provider bing --limit 50 --json
lv24-seo indexing run --from-sitemap --max-submit 20 --max-inspect 5 --json
lv24-seo indexing run --from-sitemap --allow-write --json
lv24-seo indexing history --limit 20 --json
```

`indexing status` 只读。`--live` 读取 Bing `GetUrlSubmissionQuota` 和 Yandex `recrawl/quota`；不带时
显示上次记录的配额并带 `quota_not_live`。GSC 和 IndexNow 使用本地 UTC 日计数器，因为两者都不提供
剩余量接口。每个数据源条目包含 `urls`、`submitted`、`inspected`、`indexed`、`not_indexed`、
`crawled`、`queued`、`pending`、`stale`、`quota` 和 `limitations`，以及 `write_secret_present`。

| 引擎 | 剩余配额来源 | 每次运行上限 |
|---|---|---|
| Bing | `GetUrlSubmissionQuota` 的每日和每月剩余值 | 每个 `SubmitUrlbatch` 500 个 URL；计划受较小剩余窗口限制 |
| Yandex | `recrawl/quota` 的 `quota_remainder` | 每个 URL 一个 POST；没有批量端点 |
| GSC | 没有剩余量 API；本地 UTC 日 `quota_usage` 计数器 | 默认每站每天 2,000 次检查，`max_inspect_per_run` 20 |
| IndexNow | 没有状态或配额 API；本地 UTC 日计数器 | 默认每天 1,000 次提交，每次 POST 10,000 个 URL |

`indexing run` 从 `<project.base_url>/sitemap.xml`（10,000 个 URL 和六个 sitemap 文档）和/或可重复的
`--url` 构建同主机队列，然后按优先级规划：从未提交、`lastmod` 晚于 `last_submitted_at`、检查早于
`check_interval_days`，最后是其余。检查在两种模式下都只读：GSC URL Inspection
（`PASS`/`Submitted and indexed` → `indexed`；`NEUTRAL`/`FAIL` → `not_indexed`）和 Bing
`GetUrlInfo`（有抓取日期时为 `crawled`，否则 `unknown`）。不带 `--allow-write` 时不提交任何内容。
带上后引擎重新读取配额、校验计划哈希、生成并消费内部确认令牌，并为每个数据源写入一行
`indexing_runs`。

上限在调用数据源前执行：`max_submit_per_run`（默认 500）、Bing 每日/每月剩余配额、Yandex
`quota_remainder`、`max_inspect_per_run`（默认 20）、GSC 本地 `gsc_inspect_daily_limit`（2,000）和
IndexNow 本地 `indexnow_daily_limit`（1,000）。配额耗尽为 `quota_exhausted`，带 `submitted: 0` 和
`not_attempted`；零绝不表示“全部已索引”。`--allow-write` 需要 `[indexing] enabled = true` 和
`LV24_SEO_WRITE_SECRET`，否则命令以 `WRITE_DISABLED` 失败。

GSC 站点地图 `contents[].indexed` 聚合单独作为 `indexed_total` 报告，并带
`gsc_indexed_count_deprecated`。Bing、Yandex 和 IndexNow 不提供逐 URL 索引计数，其 `indexed_total`
保持 `null` 并带 `no_per_url_index_count`；Bing 还带 `site_scan_no_api`，Yandex 带
`yandex_no_per_url_index_status`，IndexNow 带 `indexnow_no_status_api`。

### Core Web Vitals

```bash
lv24-seo cwv collect --url https://example.com/ --url https://example.com/blog/post --device phone --source crux --category performance --json
lv24-seo cwv audits --url https://example.com/ --strategy mobile --category performance --json
lv24-seo cwv history --origin https://example.com --device phone --weeks 12 --json
```

`cwv collect` 是周报 `cwv` 分区背后的写入器。CrUX 按 URL 和设备查询（`mobile` 是 `phone` 的别名），
每个返回的 p75 成为一行 `metric_daily` 字段行，包含 `source=crux`、`scope`、绝对 URL、指标和
`report.timezone` 中的获取日期。PSI 行保留在 `data.lab` 中且绝不持久化，而 PSI 没有 `tablet`，所以
`tablet` 会以 `psi_tablet_unsupported` 跳过。`--limit` 将 URL 限制为 50（默认 10）；低流量 URL 不写行，
绝不写零，达到上限的运行设置 `meta.truncated: true` 和 `cwv_url_cap`。`--category` 可重复，选择 PSI
路径的 Lighthouse 类别。`data_age_days` 来自 `collectionPeriod.lastDate`；两天启发式仅作为
`crux_period_missing` 回退，规范化 URL 添加 `crux_url_normalized`。该命令需要 CrUX 密钥
（任何调用前 `AUTH_REQUIRED`）和已初始化存储（`CONFIG_INVALID`）。

`cwv audits` 返回最多 100 条 Lighthouse 审计行（`psi_audits_cap`），含评分、显示值、去 HTML 描述和
可节省量；绝不包含元素数组。`runtimeError`、CAPTCHA 或不同的 `finalUrl` 变成警告/限制，而不是干净运行。
不会持久化任何内容。

`cwv history` 读取每周 CrUX p75 周期，最新在最后，含 `first_date`/`last_date`、可选规范设备和可用指标。
`--weeks` 为 1..40。缺失的 p75 单元格成为 `crux_history_gaps`，绝不填充；少于请求的周期添加
`crux_history_short`。历史只读且不持久化。

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

全部七个命令都是只读的，并使用 `providers.yandex_metrika.counter`。每个调用应用
`filters=ym:s:lastTrafficSource=='organic'`；`meta.organic_only` 为 `true`，`meta.filters` 重复该表达式。
`pages` 返回自然搜索落地页及访问/用户、跳出率、平均访问时长、页面深度和浏览量。`goals` 从
`providers.yandex_metrika.goals` 读取目标 id，并查询达成、访问、用户和转化率，可按 `page` 或 `source`
分组；空列表只警告不调用提供商，超过五个目标会按 Metrika 的 20 指标上限截断。`queries` 总是说明
Google 保留搜索词、Metrika 隐藏少于 10 个用户的搜索词。抽样字段（`sampled`、`sample_share`、
`sample_size`、`sample_space`、`data_lag`、`contains_sensitive_data`、`total_rows_rounded`）带入 meta
和 limitations；只有 `sampled=false` 才精确。

### 抓取

```bash
lv24-seo crawl --start https://example.com --max-urls 500 --json
```

抓取器遵守 `robots.txt`，按广度优先跟随同主机链接，运行全部规则，并在配置了存储时保存页面和
问题。`data.sitemap_coverage` 用六个分组比较站点地图与抓取结果。当返回 `complete: false` 时，
受影响的分组只是候选，不是已确认的发现；`limitations[]` 会指出被截断的输入。

### 日志、任务与备份

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

`logs analyze` 只读取一个不超过 100 MiB 的绝对路径 nginx JSON 访问日志，返回按日期、bot 和状态分组的 `bot_daily` 以及 `crawl_waste` 汇总；文件不会上传或写入 SQLite。`tasks list` 按最新优先返回有界任务，`tasks add` 幂等，`tasks update` 只接受允许的状态转换。`backup create` 写入一个带 manifest、脱敏 `seo.toml` 和一致 SQLite 副本的归档。`backup restore` 先校验并返回带 300 秒 `confirm_token` 的计划；应用需要 `--allow-write` 和令牌，替换前当前数据库会复制到 `<db>.pre-restore-<utc>`。`backup restore --to DIR` 则重新校验归档并解压到新目录：不涉及令牌和 `--allow-write`，目标必须是绝对且不存在的路径，zip-slip 或链接逃逸会在解压前被拒绝。`portfolio list` 在绝对目录下最多三层扫描 `seo.toml`，最多检查 50 个站点，按最新活动优先报告本地抓取、报告和问题计数。

### 报告

```bash
lv24-seo report weekly --days 7 --lag-days 2 --out reports/ --json
lv24-seo report diff --markdown
```

`report weekly` 构建并保存快照；加上 `--send` 会通过 `seo.toml` 中启用的渠道投递。`--out` 写入
规范英文的 `report.json` 和按 `report.locale` 渲染的 `report.html`。`report diff` 比较两个已保存
的周报快照，不调用提供方，并且需要两个不同周期的运行。`--markdown` 只在 stdout 输出 Markdown；
警告写入 stderr。

### 计划任务

```bash
lv24-seo schedule print --kind weekly --cron "0 6 * * 1" --target systemd --json
lv24-seo schedule install --kind weekly --json
lv24-seo schedule install --kind weekly --allow-write --json
lv24-seo schedule install --kind indexing --json
lv24-seo schedule install --kind indexing --allow-write --json
lv24-seo schedule status --kind indexing --json
lv24-seo schedule uninstall --kind weekly --allow-write --json
```

`print` 只渲染产物，不修改主机。`install` 默认只生成计划：打印 cron 块、systemd 用户单元或任务计划
程序 XML 以及它将运行的命令，带 `dry_run: true` 和 `installed: false`，只有 `--allow-write` 才写入
（`--print` 仍是计划的别名，并优先于 `--allow-write`）。`status` 只读，报告 `installed`、`outdated`、
`partial`、`missing` 或 `unknown` 以及每个产物的 `exists`/`matches`。`uninstall` 默认只生成计划，带
`--allow-write` 时只删除生成的产物；无关 cron 行和任务绝不被触碰。`--kind` 接受 `weekly`、`daily`
和 `indexing`。报告任务运行 `report weekly --send --json`；`indexing` 任务名为
`lv24-seo-indexing`，每天 `04:00` 运行，并调用
`indexing run --allow-write --config <absolute path> --json`。它仍需要 `[indexing] enabled = true`
和调度器环境中的 `LV24_SEO_WRITE_SECRET`；生成的命令永远不包含密钥。只有简单的 cron 表达式
（`M H * * *` 和 `M H * * DOW`）能转换为 systemd 或 Windows 计划。

### MCP 与智能体客户端

```bash
lv24-seo install --client cursor --print
lv24-seo mcp serve --transport http --port 8765
```

`install` 会把 `lv24-seo` 服务器条目合并进主机配置，而不是替换文件；`--print` 显示确切的 JSON。
`mcp serve` 默认使用 stdio，并可通过 `--transport http` 使用可流式 HTTP。

### 认证

```bash
lv24-seo auth status --json
lv24-seo auth set --provider gsc --stdin
lv24-seo auth set --provider gsc_oauth_secret --stdin
lv24-seo auth login --provider gsc
lv24-seo auth login --provider yandex --no-browser
lv24-seo auth login --provider yandex --code <code>
lv24-seo auth login --provider yandex --url-only --json
```

`auth set` 从 stdin 或隐藏提示读取密钥，存入系统钥匙串，或存入显式启用的 `0600` 文件后备存储。它只输出 `{provider, stored, source}`。`auth status` 报告存在性和来源（`env`、`keyring`、`file`、`missing`），从不输出值。

### OAuth 连接器

`auth login` 使用 OAuth 授权 Google Search Console、Yandex Webmaster 或 Yandex Metrika，无需粘贴令牌。需要在 `[auth.gsc]` 或 `[auth.yandex]` 中配置 client id（或 `LV24_SEO_GSC_CLIENT_ID` / `LV24_SEO_YANDEX_CLIENT_ID`），并用 `auth set --provider gsc_oauth_secret|yandex_oauth_secret --stdin` 保存 client secret。client secret 绝不写入 `seo.toml`。

- **Google Search Console。** `auth login --provider gsc` 使用 Desktop app 客户端，在临时端口监听 `127.0.0.1`，打开同意页面，并用 S256 PKCE 和随机 `state` 交换代码。`--no-browser` 打印 URL 并等待；`--port 8123` 固定 callback；`--code` 复用已保存的 PKCE verifier，并需要 `--port` 或 `[auth.gsc].redirect_uri` 精确重复 redirect。访问令牌、刷新令牌和到期时间存入钥匙串，并在到期前 60 秒刷新。
- **Yandex Webmaster 与 Metrika。** `auth login --provider yandex|metrika` 使用 `https://oauth.yandex.ru/verification_code` redirect：批准访问后复制短代码，用 `--code` 传入，或在交互提示中输入。一个应用可同时携带 `webmaster:hostinfo` 和 `metrika:read`，但两个引擎使用独立的令牌槽。`--url-only` 仅适用于 Yandex，返回 `{provider, flow, authorization_url, scopes, target}`，不打开浏览器、不提示、不交换代码、不写令牌；桌面显示 URL，并用第二次 `--code` 调用完成授权。
- **优先级与后备。** GSC 依次选择 OAuth 授权、服务账号文件、静态 `gsc_token`。Yandex 保留静态 `yandex_webmaster_token` / `yandex_metrika_token` 路径，并在存有 refresh token 和到期时间时刷新。Bing、IndexNow、CrUX 和 PSI 按设计没有 OAuth 连接器。
- **Testing 模式限制。** Google OAuth 应用处于 **Testing** 时，refresh token 在 7 天后过期，每日任务一周后会以 `invalid_grant` 失败。发布应用、每周重新登录，或为无人值守运行使用服务账号。

### OAuth 就绪诊断

`auth status --json` 为 `gsc`、`yandex` 和 `metrika` 增加 `oauth` 对象，包含 `state`、`detail`、
`client_id_present`、`client_secret_present`、`access_token_present`、`refresh_token_present`、
`expires_at`、`scopes_recorded`、`next_action` 和 `limitations`。`doctor --json` 增加 `gsc_oauth`、
`yandex_oauth` 和 `metrika_oauth` 检查，包含 `id`、`ok`、`detail`、`code` 和 `next_action`；它们
为非致命，且从不打印令牌。两个界面均为离线。

| 代码 | 含义 | 修复 |
|---|---|---|
| `oauth_client_missing` | client id 为空或为占位符 | 注册应用并设置 `[auth.gsc].client_id` 或 `[auth.yandex].client_id` |
| `oauth_client_secret_missing` | 已设置 client id，但缺少 secret | `auth set --provider gsc_oauth_secret\|yandex_oauth_secret --stdin` |
| `oauth_token_missing` | client id 和 secret 存在，但没有 access/refresh token | `auth login --provider gsc\|yandex\|metrika` |
| `oauth_token_expired` | 存储的到期时间已过；会说明是否可刷新 | 运行读取命令；没有 refresh token 时重新登录 |
| `oauth_scope_missing` | 记录的作用域不包含配置的作用域 | 重新登录并授予作用域，或从 `[auth.*].scopes` 移除 |
| `oauth_scope_unknown` | 未记录作用域；是警告，不是误判通过 | 执行一次登录或刷新 |
| `oauth_redirect_invalid` | Google redirect 不是回环，或 Yandex 不是 `verification_code` | 清除 `[auth.*].redirect_uri` 或设置有效值 |
| `oauth_ready` | client id、secret、token、作用域和 redirect 全部就绪 | 无需操作 |

优先级为 redirect、client id、client secret、token、scope。授予的作用域保存在
`gsc_token_scopes`、`yandex_token_scopes` 和 `yandex_metrika_token_scopes`（位于 `OAUTH_SECRET_NAMES`，
不是稳定的 `SECRET_NAMES`）；`auth logout` 会删除它们。

`--json` 输出包含 `provider`、`flow`、`scopes`、`expires_at`、`target` 和 `next`，从不包含令牌。刷新失败返回 `AUTH_INVALID`，并给出确切的 `auth login` 命令。

GSC 也可以使用服务账号。把 `providers.gsc.service_account_file` 设为绝对路径，或导出 `LV24_SEO_GSC_SERVICE_ACCOUNT_FILE`；完整的 OAuth 授权优先于文件，文件优先于已存储的 `gsc_token`，环境变量优先于文件。`gsc_token` 若是服务账号 JSON 对象也会被接受。引擎签署 RS256 JWT，在密钥的 `token_uri` 交换并在过期前刷新。`properties` 报告 `token_source: oauth_refresh_token|service_account_file|secret|missing`，`doctor` 增加非致命 `gsc_auth` 检查；两者都不打印 JSON 或私钥。

### 导出

```bash
lv24-seo export tools --out schemas/tools.json
lv24-seo export skills --out skills/
```

`export tools` 为不使用 MCP 的智能体写入生成的 MCP 注册表；`export skills` 复制打包的
`SKILL.md` 文件及其清单。两者都只写本地文件。

## 相关页面

- [配置参考](/zh/reference/config/)
- [数据源与配额](/zh/providers/)
- [MCP 与智能体技能](/zh/mcp/)
- [故障排查](/zh/troubleshooting/)

Source: `_source/engine-cli.md`, `_source/engine-mcp.md`, `_source/engine-releases-0.13.1.md`, `_source/engine-releases-0.12.0.md`, `_source/engine-releases-0.11.0.md`, `_source/engine-releases-0.10.0.md`, `_source/engine-releases-0.9.0.md`, `_source/engine-releases-0.8.0.md`, `_source/engine-releases-0.7.0.md`, `_source/engine-releases-0.6.0.md`, `_source/engine-releases-0.5.3.md`; 引擎仓库中 0.14.0 的 `--help` 输出。

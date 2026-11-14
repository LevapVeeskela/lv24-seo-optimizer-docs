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
| Google Search Console | 搜索分析、站点、站点地图、URL Inspection | 提交站点地图；0.5.1 中返回 `WRITE_DISABLED` | Bearer 访问令牌（读取用 `webmasters.readonly`，站点地图用 `webmasters`） | 每个站点和每个用户 1,200 次/分钟；每天每站点每类型 50,000 行；URL Inspection 每天 2,000 次、每分钟 600 次 | 2–3 天 |
| Yandex Webmaster | 摘要、SQI 历史、索引、搜索中的 URL 与事件、查询、诊断、失效链接、站点地图 | 重新抓取队列；0.5.1 中返回 `WRITE_DISABLED` | OAuth 令牌，scope `webmaster:hostinfo` | 免费；未公布全局 RPD/RPS；查询分析在约每小时 1 万次请求以上不稳定 | 约 4 天 |
| Yandex Metrika | 会话、流量来源、搜索词、落地页、目标 | 无 | OAuth 令牌，scope `metrika:read` | 每天每用户 5,000 次请求；30 rps/IP；3 个并发；`/stat/v1/data` 每 5 分钟 200 次；每次请求最多 10 万行、20 个指标、10 个维度 | Reporting API；会报告抽样 |
| Bing Webmaster | 查询统计、排名与流量、抓取问题 | IndexNow 提交（可用）；站点地图提交路径未接通 | 每个用户一个 API 密钥 | 免费；每域名每天约 1 万次 URL 提交，每批 500 条 | API 中没有按时间窗口的统计 |
| Chrome UX Report (CrUX) | 字段 p75 LCP、INP 和 CLS | 无 | API 密钥 | 每个项目每分钟 150 次，无法提高 | 28 天滚动窗口 |
| PageSpeed Insights (PSI) | Lighthouse 实验室诊断、已弃用的字段数据块 | 无 | API 密钥可选；无密钥也能用，但配额较低 | 每天约 2.5 万次请求 | 实时实验室运行 |
| GA4（可选） | 自然搜索落地页、会话、关键事件 | 无 | Google Analytics Data API 凭据 | 适用提供商配额 | 方向性；阈值处理可能隐藏行 |
| 自有抓取 | 页面、问题、链接图、站点地图覆盖 | 无 | 无 | 本地 | 当前运行 |
| 日志 | 对 nginx JSON 访问日志按 User-Agent 做机器人分诊；不能证明是已验证的爬虫 | 无 | 本地文件 | 本地 | 日志窗口 |

GA4 是可选的集成点，不在默认路径中。随版本提供的提供商是 GSC、Yandex Webmaster、Yandex Metrika、Bing、CrUX 和 PSI。付费 SERP 或外链适配器（DataForSEO、SerpApi 等）仅处于计划或文档阶段；0.5.1 不随版本提供任何此类适配器。

## 认证

```bash
lv24-seo auth status --json
lv24-seo auth set --provider gsc --stdin
lv24-seo auth login --provider gsc
lv24-seo auth logout --provider gsc
```

`auth set` 接受 `gsc`、`yandex`、`metrika`、`bing`、`crux`、`psi`、`smtp` 和 `telegram`。它从 stdin 或隐藏提示读取密钥，存入操作系统钥匙串，并且只打印 `{provider, stored, source}`。密钥值不会被回显、写入日志或写进 `seo.toml`。

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

- GSC 搜索分析每天、每站点、每搜索类型上限为 50,000 行。分页持续到短页；只有当上限之后确实还有一行时 `truncated` 才为 `true`。恰好填满上限的最后一页视为完整。
- GSC 分组会丢行。不要把按 `page` 分组的总和与按 `query` 分组的总和相比较，也不要同时请求两个维度再与未分组总数比较。
- Yandex Webmaster 每个周期只提供前 3,000 个查询，每页最多 500 条，并且不支持查询与页面的关联。缺失的行是未知，不是零。
- Yandex Metrika 默认抽样（`accuracy=medium`）。抽样响应会带上 `sampled` 限制和警告；请把准确度标志与数值一起保存。
- CrUX 在 URL 流量不足时返回 404；这会变成 `low_traffic`，而不是零分。
- PSI 是实验室数据。不要平均实验室运行结果，也不要与 CrUX 字段数据合并。
- Bing 统计 API 没有日期窗口，因此报告不会为 Bing 显示上一周期对比。

每个有界响应都带有相同的诚实性字段：`truncated`、`total`、以天为单位的数据年龄（`data_age_days`）以及 `limitations[]`。`rows` 是返回的行数，不是总数。只有提供商或存储能够报告时才会出现 `total`。

稳定的限制代码：

| 代码 | 含义 |
|---|---|
| `rows_cap_50000` | GSC 停在 50,000 行上限，且后面还有一行 |
| `no_query_page_join` | 提供商无法在同一数据集中关联查询与页面 |
| `top_3000_queries` | Yandex 查询数据仅限前 3,000 个 |
| `sampled` | Metrika 返回了抽样数据 |
| `low_traffic` | CrUX 对某个 URL 或 origin 的流量不足 |
| `degraded_host` | Yandex 报告主机未完全加载 |
| `one_url_per_call` | URL Inspection 每次调用只处理一个 URL，不能批量 |
| `no_per_url_sitemap_errors` | Yandex 不暴露按 URL 的站点地图错误详情 |
| `token_expiring` | 凭据即将过期 |
| `paid_provider` | 该行来自付费适配器 |
| `partial_response` | 提供商返回了不完整的响应 |

## 不抓取 SERP

工具从不抓取 Google 或 Yandex 的结果页，不绕过 CAPTCHA，也不通过浏览器会话自动化 Yandex Business 卡片或评价回复。排名和查询数据来自 GSC 与 Yandex Webmaster API。提供商不暴露的指标就保持未知。

可选的付费适配器使用自带密钥，默认关闭。它们必须使用相同的结果信封，并用 `paid_provider` 标记行；默认路径从不依赖它们。提供商数据不会被转售或重新发布：报告在本地为站点所有者生成。

## 时区感知的窗口

`report.timezone` 是 IANA 时区（默认 `Europe/Minsk`），用于报告和 `stats` 窗口、MCP 默认窗口以及本地日期边界。提供商数据仍按日期存储，不做转换。无效时区会在配置校验时以 `CONFIG_INVALID` 失败；不支持的值绝不会静默回退。

调度器生成器在后端支持时应用同一时区。Cron 依赖 `CRON_TZ`，systemd 把时区写入 `OnCalendar`，Task Scheduler XML 携带固定偏移并给出 DST 警告。参见[自动化与投递](/zh/automation/)。

Source: `_source/engine-data-sources.md`, `_source/engine-cli.md`, `_source/engine-config.md`.

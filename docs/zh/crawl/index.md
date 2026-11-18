---
title: 抓取与审计
description: 遵守 robots.txt 的抓取、站点地图发现、链接图与规则违规，并如实说明覆盖范围。
---

# 抓取与审计

抓取是工具自己的证据来源。它使用串行 `httpx` 抓取器和标准库 HTML 解析器，遵守 `robots.txt`，按广度优先跟随同源链接，运行全部规则，并在配置了存储时把页面和问题写入 SQLite。

相关页面：[数据源与配额](/zh/providers/)、[报告与差异](/zh/reports/)、[自动化与投递](/zh/automation/)、[MCP 与智能体技能](/zh/mcp/)。

## 运行抓取

```bash
lv24-seo crawl --start https://example.com/ --max-urls 500 --json
```

`--start` 默认取 `project.base_url`。`--max-urls` 默认取 `[crawl] max_urls`（500），且至少为 1。CLI 没有单独的上限；MCP `seo_crawl_site` 会把超过 5,000 的请求截到 5,000，并在警告中说明。

抓取是串行且礼貌的。`seo.toml` 中的 `concurrency` 为未来的工作池保留，当前没有效果。`robots.txt` 的 `Crawl-delay` 决定请求之间的间隔。

种子 URL 和每个重定向跳转都会在发送请求前检查起始 origin（协议、主机和端口）以及 `robots.txt`。越界或不被允许的跳转绝不会被请求，并会作为 `robots_blocked` 报告，附带覆盖说明。唯一例外是 `robots.txt` 本身：它的重定向按 RFC 9309 处理，但仍受 SSRF 策略和重定向上限约束。

## 限制与预算

| 限制 | 值 |
|---|---|
| 普通页面正文 | 每页 5 MB |
| 站点地图文档正文 | 每文档 50 MB |
| 每个站点地图的 URL | 协议上限 50,000 |
| 站点地图文档数 | 每次抓取 20 个 |
| 站点地图索引深度 | 2 |
| 每次请求的重定向 | 5 |
| 请求预算 | `1 + max_urls × (max_redirects + 1)` |
| 保留的页面文本 | 20,000 个字符 |
| MCP 问题列表 | 每个响应 500 条 |

请求预算报告为 `summary.request_count` 和 `summary.request_budget`。预算耗尽时抓取会停止并给出说明，而不是静默继续消耗请求。500 个 URL 和 5 次重定向对应 3,001 次请求。

保留的页面文本上限为 20,000 个字符，但 `word_count` 按完整可见文本计算，保持精确。这个上限是保留边界，不是解析边界：链接提取、JSON-LD、hreflang 和词数统计仍使用完整文档。当前没有规则读取保留文本。

## robots.txt 与 SSRF

`robots.txt` 遵循 RFC 9309 的最长匹配语义：最具体的规则胜出，平局时 `Allow` 胜出。5xx 或网络失败会推迟抓取，而不是 fail-open。缺少 `robots.txt` 不是错误。

默认拒绝 loopback、私有和 link-local 地址，并且每个重定向跳转都会重新解析 DNS，防止主机重绑定到私有网络。本地审计必须在抓取器中显式启用 `allow_private`；不存在默认放行私有目标的设置。

## 站点地图发现

发现从 `robots.txt` 中的 `Sitemap:` 行加上标准 `/sitemap.xml` 开始。标准站点地图缺失是正常的，不会报告为错误。每个候选、索引子项和站点地图重定向都必须留在起始 origin；越界目标会被跳过并记录。

站点地图文档获得 50 MB 正文预算和 50,000 URL 协议上限。站点地图索引最多读取 20 个文档，深度为 2。仅出现在站点地图中的 URL 会加入抓取前沿，因此即使首页几乎没有链接，抓取也可以从站点地图开始。加载失败的站点地图只报告异常类型（`HTTPError`、`TimeoutError` 等），绝不报告 URL 或查询字符串；携带 `?key=…` 的 URL 不得泄漏到警告或 `limitations[]`。

## 站点地图覆盖

`crawl` 返回 `data.sitemap_coverage`：站点声明的内容与抓取实际看到的内容之间的对比。共六个桶：

| 桶 | 含义 |
|---|---|
| `unlinked` | 在站点地图中、抓取成功，但没有任何已抓取页面链接到它 |
| `missing_from_sitemap` | 已抓取、200、可索引 HTML，但站点地图未列出 |
| `not_ok` | 在站点地图中，但响应非 200 或发生重定向 |
| `noindex` | 在站点地图中，但标记为 `noindex` |
| `blocked` | 在站点地图中，但在抓取范围之外（robots 或其他 origin） |
| `unvisited` | 在站点地图中，但从未抓取；状态未知，不是失效 |

`counts` 精确。每个 `buckets` 列表最多 50 个 URL。当抓取或站点地图清单被截断、站点地图加载失败或有 URL 未抓取时，`complete` 为 false，`limitations[]` 会指出哪些桶只是候选。完全没有站点地图时，差异为空并说明“空，不代表干净”，而不是把每个页面都标成缺失。

抓取期间的网络失败会进入 `unvisited`，而不是 `blocked` 或 `not_ok`：没有观察到状态，因此 URL 的状态未知。

## 链接图

`data.graph` 是内部链接图的确定性摘要：

- `nodes` — 成功抓取且状态为 200 的页面。
- `edges` — 去重后的规范化内部源到目标对，不含自链接。
- `orphans` — 没有入链且从起始 URL 不可达的节点。
- `broken` — 已抓取并返回 4xx/5xx 的内部目标。
- `failed` — 已请求但没有产生状态的内部目标。
- `unvisited` — 从未抓取的内部目标，例如 URL 预算耗尽。

`unvisited` 是未知，绝不是失效。落到健康页面的重定向是节点，不是发现。`/a` 与 `/a/` 在抓取证明之前保持不同，因此链接图不会在 HTTP 检查前合并它们。

## 规则

规则是抓取上下文的纯函数：没有网络、时钟或文件系统。每个模块位于 `crawl/rules/rule_<slug>.py` 并暴露 `RULE` 对象；发现是自动的。运行器会写入规则 id 和严重程度，因此有缺陷的规则无法给自己的发现贴错标签。

| 严重程度 | 规则 id |
|---|---|
| `critical` | `noindex-on-200`, `robots-blocked`, `server-error`, `sitemap-url-noindex` |
| `high` | `broken-internal-link`, `canonical-mismatch`, `client-error`, `hreflang-not-reciprocal`, `hreflang-target-not-ok`, `jsonld-event-required`, `jsonld-required`, `mixed-content`, `redirect-chain`, `sitemap-url-not-ok`, `soft-404`, `title-duplicate`, `title-missing`, `tls-certificate` |
| `medium` | `a11y-basics`, `canonical-missing`, `h1-missing`, `hreflang-missing-x-default`, `html-lang-missing`, `html-lang-mismatch`, `image-alt-missing`, `meta-description-duplicate`, `meta-description-missing`, `schema-required`, `security-headers`, `thin-content` |
| `low` | `jsonld-organization-duplicate`, `h1-multiple`, `jsonld-organization`, `title-length` |

两个启发式值得了解：

- `thin-content` 标记看起来像文章、少于 200 词的 URL，除非页面有超过 20 个内部链接且看起来像列表页。
- `soft-404` 标记标题包含 “not found”、“404” 或俄语 “не найдена” 的 200 页面，或者少于 30 词的非根 HTML 页面。

规则报告抓取观察到的事实。它们不会把未抓取的 URL 说成失效，也不能替代对业务意图的人工判断。

### 安全、TLS、Schema.org 与可访问性（0.15.0）

规则集现在为 **34** 条（此前 30 条），发现仍自动。四个新规则包：

- **`security-headers`（medium）。** 对状态 200 的 HTML 页面检查 HSTS（HTTPS 上 `max-age` 至少 180 天）、CSP（缺失或含 `unsafe-inline`/`unsafe-eval`）、X-Frame-Options（除非 CSP 声明 `frame-ancestors`）、X-Content-Type-Options（`nosniff`）、Referrer-Policy（非 `unsafe-url`）、Permissions-Policy，以及每个 `Set-Cookie` 的 cookie 标志：HTTPS 上的 `Secure`、`HttpOnly`、`SameSite=None` 且无 `Secure`。cookie 值绝不进入发现。
- **`tls-certificate`（high）。** 使用 fetcher 捕获的 `PageData.tls` 和 `PageData.fetched_at`：不可读证书（`unknown`）、已过期/14 天内/30 天内到期、TLS 1.0/1.1、SAN/CN 主机名不匹配（支持单层通配符）以及 RC4/3DES/NULL/EXPORT 套件。到期时间与页面抓取时间比较，而不是报告时间。
- **`schema-required`（medium）。** 检查 Product、Offer、BreadcrumbList、FAQPage（含嵌套 Question name/acceptedAnswer）、Recipe、JobPosting、VideoObject、LocalBusiness、Course 和 SoftwareApplication 的必需属性。展开 `@graph` 容器和 `@type` 列表；空值视为缺失；每页发现数量有上限。不与 `jsonld-required`、`jsonld-event` 或 `jsonld-organization` 重叠。
- **`a11y-basics`（medium）。** 输入缺少 label、`aria-label`、`aria-labelledby` 或 `title`；按钮缺少可见文本或可访问名称；链接缺少文本、可访问名称或图片 alt；缺少 `<main>` 或跳过链接；标题层级跳跃大于一。

这些是启发式，不是完整的安全或 WCAG 符合性审计。`tls-certificate` 在 fetcher 未捕获 TLS 事实时报告 `unknown`，而不是静默通过；`schema-required` 只检查列出的类型，不把嵌套 `Product.offers` 当作独立项；`a11y-basics` 是子集，重复 href 保留第一个锚点的可访问名称数据；`security-headers` 只检查存在性和少数弱值，不检查完整 CSP 策略质量。

## 已保存的页面与问题

`lv24-seo init` 创建 `<config dir>/data` 并写入锚定到配置的相对 `data_dir`。目录存在时，`crawl` 打开 `data/seo.sqlite3`，并按抓取属性 id 保存页面和问题。周报读取最近的已保存问题用于问题部分；没有存储的抓取仍返回完整 JSON，但不持久化任何内容。

不带 `--json` 时，CLI 打印简短的人类可读摘要。带 `--json` 时，信封包含 `summary`、`issues`、`graph`、`errors`、`blocked` 和 `sitemap_coverage`。MCP `seo_crawl_site` 按 `include_rules` 过滤问题，返回列表最多 500 条，并在 `meta` 中报告 `issues_shown`、`issues_truncated` 和 `issues_filtered_by`。

Source: `_source/engine-data-sources.md`, `_source/engine-cli.md`, `_source/engine-releases-0.15.0.md`, `_source/engine-releases-0.5.2.md`.

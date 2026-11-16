---
title: MCP 与智能体技能
description: 十二个 MCP 工具、三个资源、三个提示、传输方式、客户端注册以及随版本提供的智能体技能。
---

# MCP 与智能体技能

MCP 服务器提供一个小而明确的能力面：12 个工具、3 个资源和 3 个提示。工具注册表是单一事实来源；JSON 模式、CLI 帮助和 `schemas/tools.json` 都由它生成，绝不能手工编辑。

相关页面：[报告与差异](/zh/reports/)、[数据源与配额](/zh/providers/)、[抓取与审计](/zh/crawl/)、[自动化与投递](/zh/automation/)。

## 默认只读

返回提供商数据行的读取响应带有 `truncated`、`total`（当提供商报告时）、`data_age_days` 和 `limitations[]`。恰好填满 50,000 行上限的 GSC 最后一页会报告 `truncated: true` 和 `rows_cap_50000`；完整一页不能证明完整覆盖。读取工具不接受 `format` 参数。响应以文本提供，并在已安装的 MCP SDK 支持时提供 `structuredContent`；文本块是旧客户端的回退。

有三个工具会持久化本地状态，因此不声明为只读：

| 工具 | `kind` | `writes_local_state` | `readOnlyHint` | `destructiveHint` | `idempotentHint` |
|---|---|---|---|---|---|
| `yandex_indexing_state` | read | `true` | `false` | `false` | `false` |
| `seo_crawl_site` | read | `true` | `false` | `false` | `false` |
| `seo_weekly_report` | read | `true` | `false` | `false` | `false` |

它们保存索引事件、抓取或周报快照，但从不改变提供商状态，也不需要确认令牌。依据 `readOnlyHint` 分支的 MCP 客户端可能会在调用前请求确认；这是有意为之。其余九个工具是七个纯只读工具加上两个在此构建中仍返回 `WRITE_DISABLED` 的受限写入。

两个写入工具带有 `destructiveHint: true`，并且需要显式开启：`allow_write` 默认为 `false`，任何不带它的调用都会在构建计划之前返回 `WRITE_DISABLED`。它们遵循与 CLI 相同的两阶段契约，见下文。

## 两阶段写入

写入是先计划、再应用，而不是一次猜测式调用。

1. **计划。** 以 `allow_write=true` 且不带 `confirm_token` 调用工具。不会向提供商发送任何内容。响应为 `ok: true`，带 `meta.dry_run: true` 以及 `data.plan`、`data.plan_hash`、`data.confirm_token`、`data.ttl_seconds`。
2. **应用。** 用相同参数加上 `allow_write=true`、返回的 `plan_hash` 和 `confirm_token` 再次调用同一工具。与当前计划不匹配的 `plan_hash` 会在任何声明之前以 `CONFIRM_REQUIRED` 失败。

dry run 的 `data` 对象：

```json
{
  "status": "dry_run",
  "plan": {"action": "recrawl", "target": "https:example.com:443", "summary": "queue 2 URL(s) for recrawl on https:example.com:443"},
  "plan_hash": "6f1c…",
  "confirm_token": "1794…:9ab3…",
  "ttl_seconds": 300
}
```

令牌是对动作、目标、完整计划哈希和过期时间的 HMAC，有效期为 300 秒。更改 URL、主机、属性或动作都会使其失效。必须在服务器环境中设置 `LV24_SEO_WRITE_SECRET`；空密钥会得到 `WRITE_DISABLED`，绝不会使用弱默认值。

服务器把工作区存储交给写入闸门，因此重放的令牌返回 `status: skipped` 和 `reason: duplicate`，提供商只被调用一次。没有存储时应用仍会运行，但响应会警告：在令牌有效期内没有重放保护。提供商失败会释放声明，因此真正的重试被允许，失败的写入绝不会被记录为已发送。

契约已在服务器中实现，但随附的 `SeoService` 还没有 Yandex 重新抓取或 GSC 站点地图写入适配器：即使 `allow_write=true` 且有密钥，两个工具仍返回 `WRITE_DISABLED`。CLI 的 IndexNow 路径是唯一到达提供商的写入。不会模拟任何结果。

## 工具

| 工具 | 输入 | 返回 |
|---|---|---|
| `seo_properties` | 无 | 已配置的提供商、目标和令牌是否存在 |
| `gsc_search_analytics` | `property`、`start_date`、`end_date`、`dimensions`、`limit` 1–500（默认 50） | 按查询、页面、国家或设备分组的点击、展示、CTR 和排名行 |
| `yandex_query_stats` | `host_id`、`limit` 1–500、`order_by` `TOTAL_SHOWS` 或 `TOTAL_CLICKS` | 热门查询的展示、点击和排名 |
| `yandex_indexing_state` | 除已配置主机外无输入 | 索引历史、搜索中页面数和诊断；存在工作区存储时把按 URL 事件保存到 `indexing_events`（模式 v4） |
| `seo_crawl_site` | `start_url`、`max_urls` 0 或 1–5000、`include_rules` | 抓取摘要、问题、链接图和站点地图覆盖 |
| `seo_weekly_report` | `days` 1–90、`lag_days` 0–14 | 周报各部分以及信封 meta |
| `seo_report_diff` | `base`、`head`，格式 `START..END` | 标题变化、问题数量、机会变动、限制、Markdown |
| `seo_indexing_triage` | 无 | 带原因、数量、示例和 `next_action` 的桶 |
| `seo_opportunities` | `days` 1–90（默认 28）、`limit` 1–500、`min_impressions` | 带证据和 `expected_gain` 的排序机会 |
| `seo_log_analysis` | `file`（绝对路径）、`bot`（`googlebot`、`yandexbot`、`bingbot`、`other` 或空） | 一个本地 nginx JSON 访问日志的机器人汇总和抓取浪费摘要 |
| `seo_recrawl_request` | `host_id`（默认：已配置主机）、`urls`、`allow_write`（默认 `false`）、`plan_hash`、`confirm_token` | 两阶段受限写入；未接通提供商适配器时返回 `WRITE_DISABLED` |
| `seo_sitemap_submit` | `property`、`sitemap_url`、`action`、`allow_write`（默认 `false`）、`plan_hash`、`confirm_token` | 两阶段受限写入；未接通提供商适配器时返回 `WRITE_DISABLED` |

`gsc_search_analytics` 默认使用 `report.timezone` 中最近七个完整天。`seo_weekly_report` 不接受属性参数：属性、时区和默认延迟来自配置。`seo_opportunities` 返回 `expected_gain`，这是优先级估计，不是流量承诺。

MCP 周报工具会把 `days` 上限设为 90、`lag_days` 上限设为 14，并给出警告；低于最小值的值会被拒绝。CLI 接受最多 3660 的 `--days`。需要更长回看时请使用 CLI。

`seo_crawl_site` 按真实规则 id 过滤，例如 `robots-blocked`、`broken-internal-link` 或 `canonical-mismatch`。不存在 `rules` 参数，也不存在 `--ignore-robots` 标志。返回的问题列表最多 500 条，并带有 `meta.issues_shown`、`meta.issues_truncated` 和 `meta.issues_filtered_by`。加载失败的站点地图只报告异常类型，绝不报告 URL 或查询字符串。

`seo_log_analysis` 是第十二个工具，也是唯一不需要服务、存储或工作区的工具。它读取一个不超过 100 MiB 的本地 nginx JSON 访问日志，返回与 `lv24-seo logs analyze` 相同的 `data`、`meta` 和 `warnings`，并且只读：文件只打开一次，不会上传或存储。机器人分类仅基于 User-Agent，因此结果是分诊，不是抓取身份的证明。

`yandex_indexing_state` 在存在存储时把提供商报告的按 URL 事件保存到 `indexing_events` 表。重放会更新 `last_seen` 而不重复，`first_seen` 不可变，`meta.indexing_events` 报告 `new`、`existing`、`skipped` 和 `truncated`，每次调用最多考虑 500 行提供商数据。存储失败变成警告，而不是提供商读取失败。周报会把这些事件作为摘要证据读取。

## 资源

| URI | 内容 |
|---|---|
| `seo://config` | 已脱敏的有效配置 |
| `seo://report/latest` | 本服务器会话中最后一次成功的周报，Markdown 格式 |
| `seo://docs/tools` | 生成的十二个工具 JSON 参考 |

资源恰好三个。没有按属性的基线资源。

## 提示

| 名称 | 用途 |
|---|---|
| `weekly_seo_review` | 完整流水线：报告、索引分诊、机会、前五项行动 |
| `indexing_triage` | 仅分诊，输出为验证优先的修复计划 |
| `content_opportunities` | 把机会转成按优先级排序的内容待办 |

提示只使用工具返回的数字，指出不可用的来源而不是估算，并要求列出影响结论的限制。

## 传输

```bash
lv24-seo mcp serve
lv24-seo mcp serve --transport http --port 8765
```

`stdio` 是默认值：本地进程，凭据在用户机器上。`http` 表示用于 VPS 或多客户端场景的流式 HTTP；已弃用的 HTTP+SSE 传输会被有意拒绝。端口必须为 1–65535，默认 8765。

同步核心在事件循环线程上串行运行。MCP 2 在工作线程中派发同步处理器，因此工具注册为异步 owner-loop 适配器，并发 `tools/call` 请求会被串行化，而不是在 SQLite 中竞争。连接有意保留 `check_same_thread=True`。

`seo_crawl_site` 是唯一的例外：抓取数千个 URL 过去会让其他所有客户端阻塞数分钟。现在它在工作线程上运行，使用自己的短生命周期存储（`sqlite3` 连接属于打开它的线程），并有 600 秒硬预算。预算耗尽后，客户端会收到可重试的 `UPSTREAM_UNAVAILABLE` 信封，其 `next_action` 建议减小 `max_urls`；线程无法被杀死，因此抓取会在后台完成并关闭自己的连接，同时服务器继续服务其他工具。其余所有工具仍留在 owner loop 上。

## 客户端注册

```bash
lv24-seo install --client claude --print
lv24-seo install --client opencode
lv24-seo install --client vscode
lv24-seo install --client cursor
```

`install` 把服务器条目合并进宿主配置，而不是替换文件；`--print` 显示精确 JSON 且不写入。

| 客户端 | 配置路径 |
|---|---|
| Claude | Windows 为 `%APPDATA%\Claude\claude_desktop_config.json`，macOS 为 `~/Library/Application Support/Claude/claude_desktop_config.json`，Linux 为 `~/.config/Claude/claude_desktop_config.json` |
| OpenCode | `~/.config/opencode/opencode.json` |
| Cursor | `~/.cursor/mcp.json` |
| VS Code | Windows 为 `%APPDATA%\Code\User\mcp.json`，macOS 为 `~/Library/Application Support/Code/User/mcp.json`，Linux 为 `~/.config/Code/User/mcp.json` |

Claude 和 Cursor 的片段使用 `mcpServers`；OpenCode 使用 `mcp` 加 `type: local` 和命令数组；VS Code 使用 `servers` 加 `type: stdio`。规范的 stdio 片段是：

```json
{
  "mcpServers": {
    "lv24-seo": {
      "command": "uvx",
      "args": ["--from", "lv24-seo", "lv24-seo", "mcp", "serve"]
    }
  }
}
```

## 导出契约与技能

```bash
lv24-seo export tools --out schemas/tools.json
lv24-seo export skills --out ./skills
lv24-seo export skills --out ~/.claude/skills
lv24-seo export skills --out .opencode/skills
```

`export tools` 为不使用 MCP、而是用 `--json` 调用 CLI 的智能体写出生成的注册表。`export skills` 复制打包的技能和 `manifest.json`；它可以从 wheel 运行，不只限于 checkout。

随版本提供的技能：

| 技能 | 触发场景 | 工具 |
|---|---|---|
| `seo-weekly` | “SEO 怎么样？”、“流量为什么下降？”、周报请求 | `seo_weekly_report`、`gsc_search_analytics`、`yandex_query_stats`、`seo_opportunities`、`seo_indexing_triage` |
| `seo-indexing-triage` | 页面未出现在 Google 或 Yandex、站点地图错误、突然被排除 | `seo_indexing_triage`、`gsc_search_analytics`、`seo_crawl_site`、`yandex_indexing_state`、`seo_recrawl_request` |
| `seo-technical-audit` | 发布前、部署后、迁移后 | `seo_crawl_site`、`gsc_search_analytics`、`yandex_indexing_state`、`seo_sitemap_submit` |

技能是一个包含 `SKILL.md` 以及可选 references、scripts 和 assets 的文件夹。正文遵循固定结构：何时使用与何时不用、需要的输入、有序工具调用配方、决策树、输出契约和硬性规则。描述就是触发器；它必须包含用户或路由模型会使用的词。

`.claude/skills/<name>` 和 `.opencode/skills/<name>` 等镜像已计划但未随版本提供。使用 `export skills` 安装规范集合。

`manifest.json` 保存 `schemas/tools.json` 的模式哈希。工具重命名或输入变化而没有更新技能时，CI 会失败。

## 错误契约

```json
{
  "isError": true,
  "code": "QUOTA_EXCEEDED",
  "message": "Yandex recrawl quota is 12/day, 40 requested",
  "next_action": "split the batch or wait until 00:00 MSK",
  "retryable": false
}
```

代码：`AUTH_REQUIRED`、`AUTH_INVALID`、`PROPERTY_NOT_FOUND`、`QUOTA_EXCEEDED`、`UPSTREAM_UNAVAILABLE`、`TRUNCATED`、`WRITE_DISABLED`、`CONFIRM_REQUIRED`、`INVALID_INPUT`、`CONFIG_INVALID`、`INTERNAL`、`STORE_LOCKED`、`STORE_CORRUPT`、`STORE_UNAVAILABLE`。错误携带代码和 `next_action`，绝不包含 traceback 或令牌。`STORE_LOCKED` 可重试；`STORE_CORRUPT` 会在 `detail.backup_path` 中给出保留的备份副本。

## 智能体提示示例

- **每周回顾。** 对已配置属性使用 `seo_weekly_report` 查看最近 7 天，然后调用 `seo_indexing_triage` 和 `seo_opportunities`。按影响列出前五项行动，并列出所有影响结论的限制。
- **索引分诊。** 运行 `seo_indexing_triage`。对每个非空桶报告原因、准确数量、两个示例 URL 和建议的 `next_action`，然后说明如何验证修复。
- **技术审计。** 用 `seo_crawl_site` 抓取最多 500 个 URL，按规则 id 汇总 critical 和 high 问题。不要把未抓取的 URL 说成失效。
- **写入请求。** 为这些 URL 准备重新抓取计划，先显示配额。在我批准计划前不要写入任何内容。

Source: `_source/engine-mcp.md`, `_source/engine-skills.md`, `_source/engine-cli.md`, `_source/engine-releases-0.5.2.md`, `_source/engine-releases-0.5.3.md`, `_source/engine-releases-0.6.0.md`, `_source/engine-releases-0.7.0.md`.

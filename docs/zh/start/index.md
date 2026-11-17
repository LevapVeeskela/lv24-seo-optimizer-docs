---
title: 快速开始
description: LV24 SEO Optimizer 是什么，以及从安装到首次统计快照的五分钟路径。
---

# 快速开始

LV24 SEO Optimizer 是面向人和 AI 智能体的免费优先 SEO 控制平面。它把 Google Search Console、Yandex Webmaster、Yandex Metrika、Bing/IndexNow、Chrome UX Report 和 PageSpeed Insights 汇总到一份统一规范化的历史中，并对你自己的站点做有边界的技术抓取，最终生成周报、CLI 命令、MCP 工具和智能体技能。

Python 包 `lv24-seo` 是核心引擎。桌面应用是围绕同一引擎的 Tauri 外壳；它不重新实现 SEO 逻辑或提供商客户端。默认路径中没有付费平台、搜索结果页抓取或厂商账号。

## 五分钟上手

安装引擎：

```bash
uv tool install lv24-seo
```

创建工作区、检查机器并读取第一份快照：

```bash
lv24-seo init --property https://example.com
lv24-seo doctor
lv24-seo stats --days 7 --json
```

`init` 在当前目录写入 `seo.toml` 并创建 `<config dir>/data`；相对 `data_dir` 锚定到配置文件。`doctor` 离线运行：检查 Python、配置文件、有效数据目录及其作用域、当前目录可写性和 token 是否存在，不发起网络调用。`stats` 只读，返回一个用于仪表板的有边界信封：当前和上一窗口、每个提供商的状态、覆盖情况、数据时效、截断和限制。

`stats` 信封包含 `period`、`previous_period`、`generated_at`、`services` 数组和 `coverage` 汇总。每个服务卡片包含 `provider`、`label`、`configured`、`ready`、`status`、`metrics`、`previous`、`rows`、`data_age_days`、`truncated`、`limitations`、`warnings` 和 `error`。`status` 取值为 `ok`、`no_data`、`missing_token`、`not_configured` 或 `error`。

`coverage.complete` 只有在每个已配置服务都为 `ok`、有数据行、未被截断，且没有缺失或失败时才为 true。`previous` 仅对可比较的当前/上一窗口存在（GSC、Yandex Webmaster 和 Metrika）；Bing、CrUX 和 PSI 返回 `null`。指标只包含实际返回的值：不补零，也不做跨引擎汇总。

准备好后，添加提供商 token：

```bash
lv24-seo auth login --provider gsc
lv24-seo auth set --provider gsc --stdin
```

`auth set` 从 stdin 或隐藏提示读取密钥，绝不从 argv 读取。操作系统钥匙串存储需要可选的 `secrets` extra；请安装 `uv tool install "lv24-seo[secrets]"`，或改用环境变量。token 存在并不证明它有效或权限正确。

## 前置条件

- Python 3.11 或更高版本。`uv` 可以提供解释器，因此不要求系统安装 Python。
- 所需来源的提供商凭据：GSC OAuth 访问令牌、Yandex Webmaster OAuth、Yandex Metrika、Bing Webmaster API 密钥和 CrUX API 密钥。PageSpeed Insights 无需密钥即可使用，但配额较低。所有默认来源都有免费额度。
- Node.js 18 或更高版本，仅用于 `npx @lv24/seo` 启动器。Python CLI 不需要 Node。
- 能访问提供商 API。工具没有遥测，不会自行发送任何内容。
- 桌面应用：Windows 10/11 x64 与 WebView2，Linux x64 与 glibc 2.35 或更高版本，或 macOS 13 或更高版本。

GSC 接受手动提供的 OAuth 访问令牌或服务账号（`providers.gsc.service_account_file` / `LV24_SEO_GSC_SERVICE_ACCOUNT_FILE`，`0.8.0` 起提供）；普通令牌仍然可用。Yandex、Bing 和其他适配器使用手动提供的令牌或密钥。

## 默认只读

默认情况下，工具不会更改提供商状态。`stats`、`doctor`、`config show`、`properties`、`gsc query`、`yandex queries`、`yandex indexing`、`bing quota`、`bing sitemaps`、`bing issues` 和 `report diff` 完全不写入。`report weekly` 不带 `--send` 时只构建并保存本地快照；`crawl` 只写入本地 SQLite 存储；`init` 写入 `seo.toml` 并创建 `<config dir>/data`。

提供商写操作受门控。计划需要 `--allow-write` 和 `LV24_SEO_WRITE_SECRET`，返回计划与 `confirm_token`，且不联系提供商；应用需要五分钟内的新 `--confirm <token>`。工作区初始化后，应用会使用 SQLite 幂等账本：重放同一令牌返回 `skipped` / `duplicate`，提供商只被调用一次。没有数据目录时仍会应用，但信封会警告：在令牌五分钟有效期内没有重放保护。Bing 站点地图提交、Bing URL 提交、IndexNow 和 Yandex 重新抓取会真正写入；GSC sitemap 提交和 Bing 站点地图删除返回 `WRITE_DISABLED`，而不是假装提供商路径已接通。

MCP 服务器默认只读；其写工具带注解并受门控，部分提供商路径仍返回 `WRITE_DISABLED`。桌面端在发送报告、安装计划任务、安装 MCP 客户端条目或执行提供商写操作前，会要求一个指明确切目标的确认对话框。

## 使用界面

| 使用界面 | 提供什么 |
|---|---|
| CLI | 每条命令都支持 `--json`、稳定信封和文档化的退出码。 |
| MCP | 面向 Claude、OpenCode、Cursor 和其他客户端的 stdio 服务器，包含 12 个工具、3 个资源和 3 个提示词。 |
| 桌面端 | Tauri 2 + React 外壳，包含工作区选择器、统计仪表板、设置表单、配置输出、报告、建议和签名更新。 |
| 自动化 | cron、systemd timer 和 Windows 任务计划程序生成器，以及 SMTP 和 Telegram 投递。 |

CLI 信封为 `{ok, data, meta, warnings}`。当输入缺失、被截断或采样时，`meta.complete` 为 `false`，`meta.limitations` 说明在信任数字之前需要阅读什么。MCP 载荷和报告遵循同样的诚实规则。

## 可选桌面端

桌面端是 `0.9.0`，内置 `lv24-seo 0.11.0`；它要求引擎 `0.11.0` 或更新，因此引擎 `0.12.2` 通过门槛。当你不想记参数时它很有用：在应用内创建或选择 `seo.toml`，查看仪表板，通过带校验的表单编辑配置，运行有边界的抓取，分析 nginx 日志，分诊任务，创建或恢复可移植备份，扫描组合文件夹，比较并导出带归因摘要和 CWV 卡片的周报，在只读 Diagnostics 屏幕中读取 GSC 检查/站点地图、Yandex 事件/站点地图/队列、Bing 页面/流量/抓取/URL/关联、自然搜索 Metrika 页面/目标/维度和 CWV 审计/历史，向 Bing 提交 URL 或站点地图，读取 Bing 配额、站点地图源和抓取问题，运行 IndexNow，打开官方 Bing Site Scan 页面，并把有边界的建议复制为给智能体的 Markdown 提示词。索引自动化在 `0.9.0` 中仅限 CLI 和调度器。长时间引擎任务在后台运行，带窗口级横幅和 **Cancel** 按钮；提供商写入不可取消。Windows NSIS、macOS `.app` 和 Linux AppImage 可以自动更新；便携 ZIP、deb 和 rpm 仅手动更新。更新器只停止它启动的 sidecar，如果无法停止会以 `UPDATE_ENGINE_BUSY` 阻止安装。

## 状态与限制

引擎为 `0.12.2`；桌面端为 `0.9.0`。1.0 之前的已知缺口：

- GSC 支持手动提供的 OAuth 访问令牌或服务账号；普通令牌不会刷新。
- GSC sitemap 提交和 Bing 站点地图删除返回 `WRITE_DISABLED`；Bing 站点地图提交、Bing URL 提交、IndexNow 和 Yandex 重新抓取会真正写入，并需要各自的提供商密钥或配额。
- Bing URL 提交报告 `accepted`，不是已索引；配额值是剩余量，不是总量，月度窗口可能先耗尽。`bing sitemaps` 没有按 URL 的错误，`bing issues` 没有严重性或日期。
- Bing 统计和关联返回 `no_rows_for_window`，而不是零展示；URL Inspection 每次调用一个 URL，且不是实时测试。
- 桌面端会打开官方 Bing Site Scan 页面，但不启动、监控或导入扫描。
- `storage.raw_retention_days` 已保留；目前不会写入原始归档。
- 桌面端 `0.9.0` 有抓取、日志、任务、备份、恢复、计划任务安装、组合、Bing 索引和只读 Diagnostics 屏幕。长时间引擎调用在后台运行，带窗口级横幅和 **Cancel** 按钮，但取消不是回滚，也没有任务队列；提供商写入不可取消。
- `cwv collect`、`backup restore --to` 和 `schedule status`/`uninstall` 仅限 CLI；桌面端渲染已存储的 CWV 行、规划就地恢复并在确认后安装调度器任务。
- `report indexing`、`report opportunities` 和 `report history` 已计划，尚未发布。
- 日志是可选项：设置 `LV24_SEO_LOG_LEVEL` 才会在 CLI 和 `mcp serve` 中安装脱敏处理器。稳定的诊断接口仍是 `--json` 信封。

未知值保持未知，而不会被填充。这是刻意设计：带有明确限制的有边界答案，比没有覆盖情况却看起来很干净的数字更有用。

## 接下来

- [安装](/zh/install/) — 引擎、npm 启动器、桌面安装包、token 和卸载。
- [桌面应用](/zh/desktop/) — 外壳增加了什么、更新行为和故障排查。
- [CLI 参考](/zh/reference/cli/) — 命令、信封和退出码。
- [配置参考](/zh/reference/config/) — `seo.toml`、优先级、语言和密钥。
- [数据源](/zh/providers/) — 每个提供商能返回什么、不能返回什么。
- [报告与差异](/zh/reports/) — 周报、投递和快照差异。
- [安全与隐私](/zh/security/) — token 处理、写操作门控和桌面信任边界。

Source: `_source/engine-README.md`, `_source/engine-cli.md`, `_source/engine-releases-0.12.2.md`, `_source/engine-releases-0.12.0.md`, `_source/engine-releases-0.11.0.md`, `_source/desktop-README.md`, `_source/desktop-releases-0.9.0.md`.

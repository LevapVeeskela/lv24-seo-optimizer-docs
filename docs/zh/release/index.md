---
title: 发行与更新
description: 引擎 0.7.0 与桌面 0.5.0 发行说明、0.6.0、0.5.3、0.3.0 及更早版本历史、签名自动更新矩阵、发布流水线、版本固定与回滚。
---

# 发行与更新

当前发行版本：

| 产品 | 版本 | 发布日期 | 说明 |
|---|---|---|---|
| 引擎 | `lv24-seo 0.7.0` | 2026-11-16 | 两阶段恢复、多站点组合、按模板和设备的 CWV、带索引事件模式 v4、21 个 CLI 命令和 10 个读取类 MCP 工具 |
| 桌面 | `0.5.0` | 2026-11-16 | 恢复界面、经确认的计划任务安装、Portfolio 页面、CWV 卡片、捆绑引擎 0.7.0 和 `MIN_ENGINE_VERSION` 0.7.0 |

桌面版本与引擎版本相互独立，但桌面固定精确引擎，并拒绝低于最低版本的引擎。`0.5.0` 捆绑 `0.7.0` 并要求至少 `0.7.0`，因此已安装的 `0.6.x` 引擎会被报告为不兼容。

## 引擎 0.7.0

2026-11-16 发布。它增加两阶段项目恢复、只读的多站点组合、按 URL 模板和设备分组的 Core Web Vitals，以及带持久索引事件的模式 v4。CLI 现在有 21 个顶层命令，MCP 接口仍为 12 个工具。

变更内容：

- **两阶段恢复。** `backup restore --file ABS --config ABS` 验证归档并返回计划，包含归档与清单哈希、目标配置和数据目录、当前与归档数据库哈希、配置动作（`create`、`replace` 或 `write_alongside`）以及有效期 300 秒的 `confirm_token`。应用需要 `--allow-write` 和令牌；只有 `--allow-write` 时仅生成计划，只有令牌时返回 `WRITE_DISABLED`，归档变化、工作区变化、令牌过期或重放都会得到 `CONFIRM_REQUIRED`。替换前当前数据库会复制到 `<db>.pre-restore-<utc>`（配置被替换时复制到 `seo.toml.pre-restore-<utc>`），每个成员哈希都会重新校验，恢复后的数据库通过 `PRAGMA quick_check`，文件原子替换。未通过校验的配置会并排写为 `seo.toml.restored-<utc>`。
- **多站点组合。** `portfolio list --root ABS [--limit 1..50]` 在绝对目录下最多三层扫描 `seo.toml`，跳过隐藏目录、`node_modules`、`__pycache__`、`venv` 和符号链接目录，并为每个站点返回一行：配置路径、名称、属性、基础 URL、数据目录、数据库是否存在、抓取次数、报告快照、问题计数和最后活动时间。它不调用提供商、不读取令牌、不写磁盘。损坏的配置或不可读的数据库成为该站点的 `error`，其余站点仍会扫描；扫描上限为 50 个站点，并报告真实 `total` 和 `truncated: true`。
- **模式 v4 与索引事件。** 迁移 v4 增加 `indexing_events`，以 `(provider, property_id, url, event, event_date)` 为键。只要存在存储，`yandex indexing` 和 MCP `yandex_indexing_state` 就会保存提供商报告的按 URL 事件：重放更新 `last_seen` 而不重复，`first_seen` 不可变，`meta.indexing_events` 报告 `new`、`existing`、`skipped` 和 `truncated`，存储失败变成警告而不是提供商读取失败。周报摘要现在读取这些事件，因此 `indexing_event` 证据不再依赖调用方提供行。
- **按模板的 Core Web Vitals。** 当存储中有比较窗口的 CrUX/PSI 字段行时，`report weekly` 和 `seo_weekly_report` 增加 `cwv` 分区，按规范化 URL 模板（`/blog/{id}`）和设备（`phone`、`desktop`、`tablet`）分组。最多显示五个模板，先显示回归项，包含各指标 p75、上一 p75、差值、回归标记和 `poor_metrics`。回归是 p75 上升至少 5%（CLS 高于 0.01），模板 p75 是该组中最差页面的 p75，而不是全站平均。来源聚合、实验室/PSI 分数以及没有 URL 或已知设备的行绝不会并入模板；它们通过 `cwv_template_missing`、`cwv_device_missing`、`cwv_lab_ignored` 和 `cwv_values_ignored` 报告。
- **接口与模式。** 21 个顶层 CLI 命令（14 个组和 7 个命令，新增 `portfolio` 和 `backup restore`）、12 个 MCP 工具（10 个读取类：7 个纯只读和 3 个持久化本地状态的工具；2 个受限写入仍返回 `WRITE_DISABLED`）、3 个资源和 3 个提示不变。模式版本为 4；迁移是增量的，并在下次打开时应用。`yandex_indexing_state` 现在带有 `writes_local_state: true` 和 `readOnlyHint: false`。组合和恢复仅限 CLI。

本次发行记录的验证：

| 检查 | 结果 |
|---|---|
| PyPI | `lv24-seo 0.7.0` 已发布 |
| npm | `@lv24/seo 0.7.0` 已发布 |
| MCP Registry | `io.github.LevapVeeskela/lv24-seo 0.7.0` 已发布 |
| CI | 发布提交上 Linux、Windows 和 macOS 全绿 |

0.7.0 的已知限制：

- `portfolio list` 只报告本地历史；它从不调用提供商，因此本地存储为空的站点没有远程索引状态和流量。
- 组合扫描每次运行上限为 50 个站点；更大的机构需要扫描更窄的根目录。
- `backup restore` 替换文件，绝不合并行或设置。令牌被排除，因此恢复后需要重新认证；被其他 CLI 或桌面进程打开的数据库在 Windows 上无法替换。
- 恢复令牌防止意外或过期应用；它不是访问控制。
- 索引事件仅来自 Yandex Webmaster 索引调用；没有 URL、事件名称或事件日期的行会被跳过，每次调用最多考虑 500 行提供商数据。
- CWV 分区需要存储的 CrUX/PSI 字段行，且最多显示五个模板。CWV 和组合数据不会在变更摘要中归因。

## 桌面 0.5.0

2026-11-16 发布。它在 Backup 页面增加恢复流程、经确认的计划任务安装、Portfolio 页面和 CWV 卡片，捆绑 `lv24-seo 0.7.0`，并把 `MIN_ENGINE_VERSION` 提高到 `0.7.0`，因此 `0.6.x` 引擎被报告为不兼容。

变更内容：

- **恢复。** 备份面板增加恢复区。`pick_backup_archive` 选择归档；第一次调用只生成计划，**Restore now** 在有令牌前保持禁用。应用时显示确认对话框，并用 `--allow-write` 和计划令牌调用 `backup_restore`。计划显示归档与清单哈希、目标配置和数据目录、当前与归档数据库哈希、配置动作以及 300 秒令牌有效期。归档变化、工作区变化、令牌过期或重放都会得到 `CONFIRM_REQUIRED`。
- **计划任务安装。** Integrations 的计划卡片有 **Preview artifact** 和 **Install on this host** 两种模式。安装会在确认对话框（显示配置和任务类型）后为每周或每日报告写入 cron 条目、systemd 用户定时器或 Windows 任务计划程序任务；它只影响本机。
- **组合。** Portfolio 页面在所选目录下最多三层扫描 `seo.toml`，每次扫描最多检查 50 个站点。行包含配置路径、名称、属性、基础 URL、数据目录、数据库是否存在、抓取次数、报告快照、问题计数和最后活动时间。可按未解决问题、名称、最后活动或错误优先排序，按名称、属性或路径过滤；打开一行会通过常规 shell 流程切换工作区。损坏的配置或不可读数据库成为该站点的错误，其余站点仍会扫描。
- **CWV 卡片。** 周报渲染引擎的 `cwv` 分区，按规范化 URL 模板和设备显示上一 p75、差值和回归标记，并显示截断、最早证据日期、跳过行和引擎限制。最多显示五个模板，先显示回归项。
- **外壳与引擎。** 新增白名单命令 `backup_restore`、`portfolio_list` 和 `schedule_install`，都在外壳中做参数校验；`pick_backup_archive` 是新增命令，`pick_directory` 也会批准组合根目录和备份输出目录。契约从 `lv24-seo 0.7.0` 重新生成。

本次发行记录的验证：

| 检查 | 结果 |
|---|---|
| 已发布资产 | `v0.5.0` 上 18 个，包括 Windows portable `.zip.sha256` |
| CI | 发布提交上 Linux x64、Windows x64 和 macOS arm64 + x64 全绿 |
| 应用内更新 | 在 Windows NSIS 上通过 Rust 更新器验证 `0.4.0 → 0.5.0`：**Desktop 0.5.0**、**Engine 0.7.0** 和引擎就绪 |
| Sidecar | Windows x64 固定自 PyPI `0.7.0`；Linux 和 macOS 重新构建并通过 rebuild-aware 报告 |

0.5.0 的已知限制：

- 恢复会替换数据库和配置，绝不合并；`.pre-restore-<utc>` 副本是唯一回滚手段。
- 计划任务安装会修改主机；删除或修复任务需要手动完成。
- 没有 CrUX/PSI 字段行（带 URL 和设备）时 CWV 卡片为空。
- 组合只报告本地历史，每次扫描最多检查 50 个站点。
- 没有取消和后台运行：恢复、计划任务安装、组合扫描或报告构建都会运行到完成。
- `MIN_ENGINE_VERSION` 为 `0.7.0`，因此 `0.6.x` 引擎会被拒绝。

## 引擎 0.6.0

2026-11-16 发布。它增加本地 nginx 日志分析、周报中的归因变更摘要、带模式 v3 的发现/任务生命周期、可移植项目备份和第 12 个 MCP 工具。CLI 现在有 20 个顶层命令。

变更内容：

- **日志分析。** `logs analyze --file ABS [--bot …]` 只读取一个不超过 100 MiB 的本地 nginx JSON 访问日志，返回 `bot_daily` 行（按日期、机器人和状态类的命中、字节和 p95 请求时间）以及带按机器人拆分的 `crawl_waste` 汇总。重定向、错误、资源、`/api/` 调用和带跟踪参数的请求都算浪费，每个请求只计一次。路径必须是绝对路径和普通文件；glob、UNC/设备路径和更大的文件会在读取前以 `INVALID_INPUT` 失败。文件只以只读方式打开一次，不会上传或存储。
- **第 12 个 MCP 工具。** `seo_log_analysis(file, bot="")` 只读（`readOnlyHint: true`、`writes_local_state: false`），不需要服务、存储或工作区，返回与 CLI 相同的 `data`、`meta` 和 `warnings`。
- **归因变更摘要。** 当两个 GSC 窗口可比较且存储中有抓取问题或页面时，周报增加 `Attributed change digest` 分区：每个重要变化都配上候选原因（`new_crawl_issue`、`resolved_crawl_issue`、`indexing_event`、`page_state`、`unexplained`）、置信度、最多三行证据和 `next_action`。没有匹配证据时保持 `unexplained` 并带限制；条目最多 8 个，每个条目证据最多 3 行。
- **任务生命周期（模式 v3）。** `tasks list`、`tasks add` 和 `tasks update` 管理以 `(kind, property_id, url, rule_id)` 为键的发现，状态为 `open`、`in_progress`、`verified`、`dismissed`。`add` 幂等并报告 `created`、`existing` 或 `reopened`；再次发现的已验证项会重新打开，已忽略项保持忽略。只接受文档化的转换，`list` 最新优先且有界（1–1000，默认 200），`--payload` 拒绝形似凭据的键。迁移是增量的。
- **可移植备份。** `backup create --out ABS [--force]` 写入 `lv24-seo-backup-YYYYMMDDTHHMMSSZ.zip`，包含 `manifest.json`（每个成员的大小和 SHA-256）、脱敏的 `seo.toml`（`storage.data_dir` 重置为 `./data`）以及通过 SQLite 备份 API 生成的一致 `data/seo.sqlite3` 副本。密钥、令牌、日志和缓存绝不包含；源为只读，归档原子写入。未实现恢复。
- **接口与模式。** 20 个顶层 CLI 命令（13 个组和 7 个命令）、12 个 MCP 工具（10 个读取类，包括 `seo_log_analysis`，加 2 个仍返回 `WRITE_DISABLED` 的受限写入）、3 个资源和 3 个提示不变。模式版本为 3；`ReportSection` 增加可选的 `total`、`truncated` 和 `data_age` 字段，并发首次打开会重试 WAL 切换而不是在 `SQLITE_BUSY` 上失败。

本次发行记录的验证：

| 检查 | 结果 |
|---|---|
| PyPI | `lv24-seo 0.6.0` 已发布 |
| npm | `@lv24/seo 0.6.0` 已发布 |
| MCP Registry | `io.github.LevapVeeskela/lv24-seo 0.6.0` 已发布 |
| CI | Linux、Windows 和 macOS 全绿 |

0.6.0 的已知限制：

- 机器人识别仅基于 User-Agent：伪造的 UA 不是已验证爬虫，非搜索爬虫归为 `other`。
- 日志分析一次只接受一个不超过 100 MiB 的文件；没有轮转、glob、远程获取或持久日志历史。
- `backup create` 没有恢复命令；清单是手动恢复的契约，令牌被排除。
- 任务仅限 CLI；目前没有 MCP 工具或报告分区使用它们。
- 摘要只解释 GSC 标题变化；Yandex、Metrika、Bing、CrUX 和 PSI 不归因，索引事件仅在调用方提供时出现。

## 桌面 0.4.0

2026-11-16 发布。它增加 Logs、Tasks 和 Backup 页面以及报告摘要卡片，捆绑 `lv24-seo 0.6.0`，并把 `MIN_ENGINE_VERSION` 提高到 `0.6.0`，因此 `0.5.x` 引擎被报告为不兼容。

变更内容：

- **Logs 页面。** 原生 `pick_log_file` 选择一个 nginx JSON 访问日志（不超过 100 MiB）；不是来自对话框或应用自身数据/导出目录的路径会以 `PATH_NOT_APPROVED` 拒绝。页面显示机器人过滤、解析摘要（总数、已解析、已跳过）、带按机器人拆分的抓取浪费、机器人汇总表和 JSON/CSV 导出。机器人仅按 User-Agent，结果标记为分诊。
- **Tasks 页面。** 最新优先的发现，包含属性、类型、状态、规则、URL、时间和存储的证据；支持过滤和最多 500 行的限制。状态变化遵循允许的转换，非法转换会带允许集合被拒绝，添加表单幂等，证据上限 16 KiB 并拒绝形似凭据的键。
- **Backup 页面。** `backup create` 把归档写入导出目录或原生对话框选择的目录；面板显示路径、大小、SHA-256、是否包含数据库、属性和快照数量、成员表以及引擎限制。未实现恢复，面板会说明。
- **摘要卡片。** 周报渲染引擎的归因变更摘要，包含原因、置信度、最多三行证据和下一步操作，以及 `showing N of M`、最早证据日期和跳过行数。
- **外壳与引擎。** 新增允许列表命令 `logs_analyze`、`tasks_list`、`tasks_add`、`tasks_update` 和 `backup_create`，都在外壳中校验参数；`pick_directory` 现在也批准备份输出目录。契约从 `lv24-seo 0.6.0` 重新生成。

本次发行记录的验证：

| 检查 | 结果 |
|---|---|
| 已发布产物 | `v0.4.0` 上共 18 个，包括 Windows 便携 `.zip.sha256` |
| CI | 发布提交上 Linux x64、Windows x64 和 macOS arm64 + x64 全绿 |
| 应用内更新 | `0.3.0 → 0.4.0` 通过 Rust 更新器在 Windows NSIS 上验证：**Desktop 0.4.0**、**Engine 0.6.0** 和 engine ready |

0.4.0 的已知限制：

- 未实现备份恢复；请手动解压归档，并在验证前保留源工作区。
- 机器人分诊仅基于 User-Agent；没有反向 DNS 或已发布 IP 检查。
- 没有取消和后台运行：抓取、日志分析、报告构建、任务刷新或备份都会运行到完成。
- 一次一个日志文件，最多 100 MiB；没有轮转或持久日志历史。
- 摘要是基于证据的分诊，不是因果证明。

## 引擎 0.5.3

2026-11-16 发布。它让代理写入变成两阶段，把抓取移出 MCP 事件循环，为 CI 增加 `--strict`
退出码，并用类型化代码替换通用存储故障。没有模式迁移，也没有新的 CLI 命令或 MCP 工具：接口仍为
十一个工具，变化在于输入、退出码和错误码。

变更内容：

- **两阶段 MCP 写入。** `seo_recrawl_request` 和 `seo_sitemap_submit` 接受 `allow_write`（默认 `false`）、`plan_hash` 和 `confirm_token`。不带令牌的调用是 dry run，返回计划、计划哈希和 300 秒令牌；应用必须回传哈希和令牌。哈希不匹配返回 `CONFIRM_REQUIRED`，重放返回 `status: skipped` 和 `reason: duplicate`，数据源失败会释放声明以便重试。`LV24_SEO_WRITE_SECRET` 必需；空密钥返回 `WRITE_DISABLED`。随附的 `SeoService` 仍没有重新抓取或站点地图写入适配器，因此即使 `allow_write=true`，两个工具仍返回 `WRITE_DISABLED`：契约已就位，数据源调用尚未接通。
- **抓取移出事件循环。** `seo_crawl_site` 在工作线程上运行，使用自己的短生命周期存储，并有 600 秒硬预算。预算耗尽后，客户端收到可重试的 `UPSTREAM_UNAVAILABLE`，建议减小 `max_urls`；工作线程在后台结束，服务器继续响应其他工具。其余工具仍在 owner loop 上串行。
- **`--strict` 与退出码 5。** `stats`、`gsc query`、`yandex queries`、`yandex indexing`、`crawl`、`report weekly` 和 `report diff` 接受 `--strict`。总会设置 `meta.strict`；截断响应保持 `ok: true` 但退出 `5`，并由 `meta.limitations` 说明缺失内容。不带该标志时截断仍退出 `0`。`report diff --markdown` 遵循同一退出码。
- **写入账本跟随 `--config`。** 写入应用从所选工作区的数据目录打开幂等账本，因此 `--config /srv/site/seo.toml` 会把声明记录在 `/srv/site/data`，即使 shell 在别处。此前账本从工作目录解析，会静默关闭重放保护。
- **类型化存储错误。** `STORE_LOCKED`（可重试）、`STORE_CORRUPT`（带 `detail.backup_path`）和 `STORE_UNAVAILABLE` 取代通用 `INTERNAL` 信封。损坏文件会在任何其他操作之前复制到自身旁边；原文件绝不会被移动或删除。三个代码都像 `INTERNAL` 一样退出 `1`。
- **诚实的数据源数据。** 被截断的 GSC 结果完全省略 `total`，而不是把精确计数与 `truncated: true` 并列；`data_age_days` 不低于文档所述 3 天延迟。Metrika 的 `limit` 是页大小：客户端用 `offset` 遍历到 10,000 行和 100 页，把没有 `total_rows` 的完整页标记为截断，并且绝不翻页聚合调用。Bing 从最新行日期推导 `data_age_days`，而不是硬编码 0。已加载的 Yandex 主机若历史为空，返回 `total: 0` 和 `empty_history`，而不是 `degraded_host`；Webmaster 的普通 `count` 不再被当作总计。
- **站点地图范围。** 站点地图自身 origin 之外的 `<loc>`（起始地图 origin 加上每个已读文档的最终 origin）会被丢弃并一次性报告为 `off_origin_loc`，因此索引绝不会把读取器带到另一个站点。
- **`doctor` 把已声明数据目录视为致命项。** 当配置或 `LV24_SEO_DATA_DIR` 指定目录时，缺失或不可用的目录会导致检查失败；`meta.data_dir_declared` 说明属于哪种情况。
- **较小修复。** 含未终止托管块的 crontab 会被保守修复：只删除看起来像 lv24-seo 条目的行，并警告操作员检查 `crontab -l`。抓取会遵守一次 `429` `Retry-After`，而不是把限流当成页面答案。

本次发行记录的验证：

| 检查 | 结果 |
|---|---|
| PyPI | `lv24-seo 0.5.3` wheel 和 sdist 已发布 |
| npm | `@lv24/seo 0.5.3` 已发布并带 `latest` 标签 |
| MCP Registry | `io.github.LevapVeeskela/lv24-seo 0.5.3` 已发布 |
| 发布 workflow | 在打标签的提交上全绿：verify、build、PyPI、npm 和 MCP Registry 任务 |
| 测试 | 1,205 个离线测试通过，包括已安装 wheel 的 CLI 信封契约；Ubuntu、Windows 和 macOS CI 通过 |

0.5.3 的已知限制：

- 引擎服务仍未提供重新抓取或站点地图写入处理器：CLI 应用和每次 MCP 写入调用都返回 `WRITE_DISABLED`，不会发送任何内容。只有 IndexNow 会到达数据源。
- Metrika 遍历每次调用停在 10,000 行和 100 页；更大的表会被截断并说明。
- Bing 对空或没有日期的数据源报告 `data_age_days: 0`；这不是新鲜的证据。
- `STORE_LOCKED`、`STORE_CORRUPT` 和 `STORE_UNAVAILABLE` 没有专用 CLI 退出码；它们退出 `1`，必须从 `error.code` 读取。
- `--strict` 不适用于写入命令；计划有效时 dry run 退出 `0`。
- `doctor` 把不可用的已声明数据目录视为致命项，因此故意缺失的目录现在会导致检查失败而不是警告。

## 桌面 0.3.0

2026-11-16 发布。它把外壳变成覆盖整个工作流的界面：无需终端的入门、抓取屏幕、报告比较与导出、更安全的
设置保存流程、集成片段和诚实的运行状态。它捆绑 `lv24-seo 0.5.3`（与 `0.2.3` 相同），并让
`MIN_ENGINE_VERSION` 保持 `0.5.2`。

变更内容：

- **无需终端的入门。** 三步项目向导（文件夹、站点、检查）通过外壳运行 `lv24-seo init`，在创建任何内容之前显示确切的配置和数据路径，并在文件夹已有配置时提供 **Open existing seo.toml** 而不是覆盖。`settings.json` 中的 `knownConfigs` 记住最多 20 个规范化配置路径，因此重启后可重新激活以前的工作区；外壳仍会校验它们，所以该列表只是便利，不是权限绕过。标题栏的站点芯片打开最多 8 个最近工作区，并把被移动或删除的配置报告为缺失。
- **属性面板。** 仪表板渲染 `lv24-seo properties`：已配置的数据源、目标以及令牌状态（`present`、`missing`、`not required`、`unknown`），并链接到对应设置区。
- **抓取屏幕。** 有边界的 `lv24-seo crawl --json` 运行，带汇总计数、截断徽章、引擎警告和限制；按严重性、规则和文本过滤问题，并使用结果中的分面；表格最多渲染 500 行，而 JSON 和 CSV 导出包含引擎返回的每一行。切换工作区会重置屏幕。
- **报告比较与导出。** 不调用数据源即可比较两个最新存储的周报快照：标题变化、新增/解决/未变问题、机会以及新增或解除的限制，并明确标注 **not comparable** 而不是静默比较。JSON 使用文档化的 `lv24-seo.report/v1` 负载；CSV 为扁平结构（`section,metric,value,delta`）。HTML 报告不变。
- **设置保存流程。** 底部粘性保存栏显示脏状态、变更字段数、校验错误和警告以及上次备份；**Ctrl+S / Cmd+S** 可从页面任意位置保存；**Only changed** 只显示与 `seo.toml` 不同的字段。应用级草稿保护在离开 Settings、切换工作区、重新加载或关闭窗口前询问是否丢弃未保存编辑，并在无法安装关闭保护时明确说明。
- **建议。** 跨标题、操作、查询和页面搜索；按报告顺序或严重性排序；批量 **Queue all visible** 和 **Export all visible**，并说明写入和失败的任务数。
- **集成。** 为 Claude Desktop、OpenCode、VS Code 和 Cursor 生成 JSON 格式的 MCP 片段，并为 Codex CLI 等基于 TOML 的宿主提供 TOML 形式；片段不含令牌。计划运行**仅打印**：屏幕渲染 `lv24-seo schedule print` 产物，绝不安装 cron 条目、unit 或任务。
- **报告窗口与运行状态。** 每个工作区可选择 7、28 或 90 天窗口和 2 或 3 天数据源延迟，按 `seo.toml` 路径保存，统计和周报共用。运行显示实时耗时、上次运行时长和时间戳、截断与限制徽章，并明确说明 `0.3.0` 没有取消按钮。
- **外壳与安全。** 新增允许列表命令 `init`、`schedule_print`（仅活动配置）和 `pick_directory`（原生目录对话框，其结果被批准用于 `init`），持久化并校验的 `knownConfigs`，以及仅用于确认丢弃关闭路径的 `core:window:allow-destroy` 能力。

本次发行记录的验证：

| 检查 | 结果 |
|---|---|
| 已发布产物 | `v0.3.0` 上共 18 个，包括 Windows 便携 `.zip.sha256` |
| CI | 发布提交上 Linux x64、Windows x64 和 macOS arm64 + x64 全绿 |
| 应用内更新 | `0.2.3 → 0.3.0` 通过新的 Rust 更新器在 Windows NSIS 上验证：**Desktop 0.3.0**、**Engine 0.5.3** 和 engine ready |
| 引擎 | `lv24-seo 0.5.3` 不变；契约和已审查的 Windows sidecar 固定值与 `0.2.3` 相同 |

0.3.0 的已知限制：

- 没有取消，也没有后台运行：抓取、报告构建或统计刷新会运行到完成，离开屏幕不会把运行移入队列。
- 计划运行仅打印；不会安装计划任务，也不会编辑 MCP 客户端配置。
- 桌面端不执行数据源写入。
- 配置路径批准按进程生效，外加持久化的 `knownConfigs` 列表；两者之外的路径仍需要原生对话框。
- Windows ACL 加固是尽力而为，操作系统包仍未签名或仅 ad-hoc 签名。

## 桌面 0.2.3

2026-11-16 发布。它把更新下载移入 Rust，让配置路径成为由对话框批准的权限，在打开之前拒绝网络路径，
并修复可能误报保存或工作区状态的 UI。它捆绑 `lv24-seo 0.5.3`，并让 `MIN_ENGINE_VERSION` 保持 `0.5.2`，
因此已安装的 `0.5.2` 引擎仍被接受。

变更内容：

- **更新器移入 Rust。** webview 能力列表只保留 `updater:allow-check`。`update_install` 重新检查端点，拒绝与面板公告不同的版本（`UPDATE_VERSION_MISMATCH`），下载、验证签名并启动安装器；进度以 `update://progress` 到达。`update_cancel` 在安装器启动前丢弃下载并返回 `UPDATE_CANCELLED`；安装开始后面板保持原状，不会声称发生了并未发生的取消。
- **由对话框批准的配置路径。** `pick_config` 记录原生对话框返回的文件；`settings_set` 只接受活动路径或已批准路径，其他一律以 `PATH_NOT_APPROVED` 拒绝。`storage.data_dir` 中的 UNC 共享、`\\?\` 或 `\\.\` 设备会在解析前以 `INVALID_PATH` 和 `detail.reason: network_or_device_path` 拒绝。
- **脱敏与超时。** 引擎 stderr 在到达 webview、日志或诊断包之前会被脱敏，且发生在 300 字符预览截断之前。TOML 解析器错误也会脱敏。超过预算的辅助任务以 `PATH_TIMEOUT` 失败，而不是让屏幕挂起。
- **工作区与 UI 状态。** `shell_status` 报告 `configExists`；被移动或删除的配置显示带 **Choose config** 的工作区缺失横幅，而不是通用统计错误。提供商区块有显式启用开关，它是 `providers.<id>.present` 的唯一写入者。校验是三态的（`valid`、`invalid`、`skipped`），因此双击或切换工作区不再把有效草稿报为无效。跳过链接保持 hash 路由不变，路由级错误边界隔离渲染失败并提供重新加载。
- **发布流水线。** 拉取请求 CI 运行发布脚本测试；Rust 矩阵包含发布所用的 Intel macOS runner；Rust 固定为 `1.95.0`。`latest.json` 在创建草稿之前按 `contracts/latest.schema.json` 校验。一个经过测试的允许列表同时驱动校验和文件与上传列表，Windows 便携 ZIP 附带 `.sha256` sidecar，由发布闸门重新计算并比较。

### 桌面 0.2.3 产物

`0.2.3` 发布 18 个产物：安装器、已签名更新包、Windows 便携 ZIP 及其 `.sha256` sidecar、`latest.json` 和
`SHA256SUMS.txt`。

| 产物 | 平台 | 用途 |
|---|---|---|
| `LV24.SEO.Optimizer_0.2.3_x64-setup.exe` + `.exe.sig` | Windows x64 | NSIS 用户安装器；已签名更新包 |
| `LV24-SEO-Optimizer_0.2.3_x64-portable.zip` + `.zip.sha256` | Windows x64 | 便携构建；仅手动，校验和由发布闸门重新计算 |
| `LV24.SEO.Optimizer_0.2.3_aarch64.dmg` | macOS Apple silicon | 首次安装 |
| `LV24.SEO.Optimizer_0.2.3_x64.dmg` | macOS Intel | 首次安装 |
| `LV24.SEO.Optimizer_0.2.3_aarch64.app.tar.gz` + `.sig` | macOS Apple silicon | 已签名更新包 |
| `LV24.SEO.Optimizer_0.2.3_x64.app.tar.gz` + `.sig` | macOS Intel | 已签名更新包 |
| `LV24.SEO.Optimizer_0.2.3_amd64.AppImage` + `.AppImage.sig` | Linux x64 | AppImage；已签名更新包 |
| `LV24.SEO.Optimizer_0.2.3_amd64.deb`, `LV24.SEO.Optimizer-0.2.3-1.x86_64.rpm` | Linux x64 | 包管理器安装；仅手动 |
| `latest.json` | 全部 | 已签名更新清单 |
| `SHA256SUMS.txt` | 全部 | 每个已发布产物的 SHA-256 |

### 桌面 0.2.3 验证

| 检查 | 结果 |
|---|---|
| 已发布产物 | `v0.2.3` 上共 18 个，包括按归档重新计算的 Windows 便携 `.zip.sha256`；`SHA256SUMS.txt` 覆盖每个已发布产物 |
| CI | 发布提交上 Linux x64、Windows x64 和 macOS arm64 + x64 全绿 |
| 应用内更新 | `0.2.2 → 0.2.3` 在 Windows NSIS 上完成端到端验证：下载、签名验证、passive 安装和重启；界面报告 **Desktop 0.2.3**、**Engine 0.5.3** 和 engine ready |
| Sidecar | Linux 和 macOS sidecar 由发布 workflow 重新构建，rebuild-aware 校验和报告通过；Windows x64 从 PyPI `0.5.3` 固定（`sha256 24b51f43…`，14,175,608 字节） |

## 引擎 0.5.2

这是 0.5.x 系列的缺陷修复版本。它关闭了 0.5.1 之后发现的发布阻塞项：`seo.toml` 中的相对
`storage.data_dir` 会跟随 shell 的工作目录，CLI 构建写入门控时没有带上幂等账本，sitemap 抓取
错误会回显可能携带查询令牌的 URL，并且 GSC 在最后一页恰好填满行数上限时声称数据完整。

无模式迁移、无新 CLI 命令或 MCP 工具。JSON 信封保留现有键；`doctor` 增加附加字段
`meta.data_dir` / `meta.data_dir_source`，并可能携带警告。现有存储无需更改即可打开，已经使用
绝对 `data_dir` 的配置行为完全不变。

变更内容：

- **data-dir 锚定。** `seo.toml` 中写入的相对 `storage.data_dir` 现在相对于该文件所在目录解析，
  因此 `lv24-seo --config /srv/site/seo.toml` 从任何工作目录都会使用 `/srv/site/data`。
  `init` 创建 `<config dir>/data` 并写入 `data_dir = "./data"`。内置默认值（没有 `[storage]`
  块）和 `LV24_SEO_DATA_DIR` 仍有意保持进程作用域。`doctor --json` 报告 `meta.data_dir` 和
  `meta.data_dir_source`（`config` 或 `working directory`），`config show --json` 报告有效路径。
- **绝对调度器路径。** `resolve_config_path` 始终返回绝对、规范化路径。`schedule install` 和
  `schedule print` 嵌入该绝对 `--config` 参数，并使用配置的父目录作为工作目录，因此任务从任何
  调度器工作目录运行都会读取同一配置。
- **可安全重放的 CLI 写入。** 带 `--confirm` 的写命令打开工作区 SQLite 账本并传给
  `WriteGate`。重放同一令牌会返回 `status: skipped` 和 `reason: duplicate`，提供方只被调用一次。
  试运行不打开账本，也不创建数据库。没有初始化工作区时命令仍可运行，但信封会警告：在令牌五分钟
  有效期内没有重放保护。
- **sitemap 警告脱敏。** sitemap 抓取失败只报告异常类型（`HTTPError`、`TimeoutError` 等），
  绝不报告 URL 或查询字符串。失败仍然可见且机器可读，但 `?key=…` 不会泄漏到警告、
  `limitations[]` 或 MCP 负载中。
- **GSC 精确上限的诚实报告。** 恰好填满 50,000 行上限的 GSC 最后一页会报告
  `truncated: true` 和 `rows_cap_50000`；调用方设置更小上限时会产生指名该行数限制的警告。零上限
  也会被报告为上限，而不是空结果。完整的一页不能证明后面没有更多行。
- **可选的脱敏日志。** `LV24_SEO_LOG_LEVEL` 只在两个进程入口安装脱敏处理器：CLI 回调和
  `lv24-seo mcp serve`。未设置变量时不会改变调用方的日志配置。当 stderr 不是终端（管道、
  调度器日志、MCP 宿主）时，每条记录输出一行 JSON；否则输出普通行。MCP 传输只写 stderr；
  stdout 保持协议输出。
- **小型修复。** 崩溃留下的 pending 写声明仍没有 TTL；删除 `data/seo.sqlite3` 会重置账本；
  `doctor` 不会因相对 data-dir 而失败。

本版本记录的验证：

| 检查 | 结果 |
|---|---|
| 离线测试套件 | 1141 passed, 1 skipped |
| `ruff check` | 干净 |
| `ruff format --check` | 干净 |
| `mypy src` | 干净 |
| MCP registry `--check` | 干净（接口面未变） |

0.5.2 的已知限制：

- 通过符号链接访问的配置会把 data-dir 锚定在链接旁，而不是目标旁，因为符号链接被有意保留。
  `LV24_SEO_DATA_DIR` 仍是进程作用域覆盖。
- 崩溃留下的 pending 写声明没有 TTL，会被视为进行中，直到操作员释放。这是有意为之：错误的
  重试可能重复提供方写入。
- 没有 data-dir 就没有重放保护；令牌在完整五分钟窗口内仍然有效。
- 恰好有 50,000 行 GSC 数据且上限后没有更多行的站点也会被报告为截断。这是有意为之：完整一页
  不能证明不存在下一行。
- 日志仍是可选项。脱敏规则覆盖敏感键、已知令牌前缀和不透明长值，但不保证识别每种提供方特有的
  密钥形态。

## 桌面 0.2.2 产物

`0.2.2` 是 `0.2.x` 预览的加固补丁。它修复了引擎 sidecar 被占用导致的更新失败，使 Rust 桥以
持久且私密的方式写入配置和设置，清除过期的 UI 状态，并捆绑 `lv24-seo 0.5.2`。

| 产物 | 平台 | 用途 |
|---|---|---|
| `LV24.SEO.Optimizer_0.2.2_x64-setup.exe` + `.exe.sig` | Windows x64 | 当前用户 NSIS 安装器；已签名更新包 |
| `LV24-SEO-Optimizer_0.2.2_x64-portable.zip` | Windows x64 | 便携构建；仅手动 |
| `LV24.SEO.Optimizer_0.2.2_aarch64.dmg` | macOS Apple silicon | 首次安装 |
| `LV24.SEO.Optimizer_0.2.2_x64.dmg` | macOS Intel | 首次安装 |
| `LV24.SEO.Optimizer_0.2.2_aarch64.app.tar.gz` + `.sig` | macOS Apple silicon | 已签名更新包 |
| `LV24.SEO.Optimizer_0.2.2_x64.app.tar.gz` + `.sig` | macOS Intel | 已签名更新包 |
| `LV24.SEO.Optimizer_0.2.2_amd64.AppImage` + `.AppImage.sig` | Linux x64 | AppImage；已签名更新包 |
| `LV24.SEO.Optimizer_0.2.2_amd64.deb`, `LV24.SEO.Optimizer-0.2.2-1.x86_64.rpm` | Linux x64 | 包管理器安装；仅手动 |
| `latest.json` | 全部 | 已签名更新清单 |
| `SHA256SUMS.txt` | 全部 | 每个已发布产物的 SHA-256 |

Windows 安装器需要 Windows 10/11 x64 和 WebView2 运行时；NSIS 安装器可以获取它，
portable ZIP 不能。Linux 包在 Ubuntu 22.04 上构建，glibc 2.35 基线，仅 x64。macOS
需要 macOS 13 或更高；Apple silicon 使用 `aarch64` DMG，Intel 使用 `x64` DMG。

### 更新前清理 sidecar

引擎 sidecar 位于已安装的资源目录中，因此正在运行的 `lv24-seo` 进程会锁定该文件，NSIS 安装器
无法替换它。安装器启动前，外壳调用 `prepare_update`，只停止**本应用实例在启动时登记的引擎
PID**。不会按映像名称匹配，因此另一个已安装副本、便携构建、终端中的 `lv24-seo` 或无关进程都
不会被触碰。短暂等待（2 秒）确认进程已退出。

如果清理失败，安装会被 `UPDATE_ENGINE_BUSY` 阻止，而不是启动一个会在中途失败的安装器。该错误
可重试：关闭占用 sidecar 的运行，然后再次点击按钮。

### 密钥与配置

- Yandex Metrika 在提供方列表、Settings 徽章、密钥对话框和 en/ru/zh 标签中保留自己的 auth
  提供方（`metrika`、`yandex_metrika_token`）。它绝不借用 Webmaster 令牌。
- 桌面端和 CLI 每个提供方共享**同一个操作系统钥匙串条目**（服务 `lv24-seo`）。在终端通过
  `lv24-seo auth set --provider <p> --stdin` 输入的令牌会出现在桌面的 `auth status` 中，无需
  重新输入；桌面端输入的令牌对 CLI 可见。
- 通过 `LV24_SEO_*` 提供的令牌在 UI 中显示为**只读**：桌面端无法删除环境变量，因此会明确说明，
  而不是提供一个无效的删除按钮。`auth logout` 返回 `deleted: false` 时会如实展示。
- 工作区、报告、doctor 和密钥状态会在工作区变化或引擎离线时清除。无法执行的操作会被禁用，而不是
  点击后失败。en/ru/zh 消息目录保持一致；缺少键是测试失败。
- 配置和设置写入是原子且 **fsync** 的（文件和父目录）。临时草稿和备份权限为 `0600`；配置读取
  上限为 8 MiB；设置按字段加载；Windows 保留设备名和结尾点/空格在每个路径组件中都会被拒绝。
  配置验证的 stderr 在到达 UI 或日志前会脱敏。

## 自动更新矩阵

| 包类型 | 应用内更新 | 行为 |
|---|---|---|
| Windows NSIS | 是 | 下载已签名 setup `.exe`，停止受跟踪的 sidecar PID，以 passive 模式运行安装器，重启 |
| macOS `.app` | 是 | 下载已签名 `.app.tar.gz`，替换应用，重启 |
| Linux AppImage | 是 | 下载已签名 AppImage，替换，重启 |
| Windows portable ZIP | 否 | Settings 指向发布页；下载并解压新 ZIP |
| Linux deb | 否 | Settings 指向发布页；用包管理器升级 |
| Linux rpm | 否 | Settings 指向发布页；用包管理器升级 |
| MSI | 否 | 不生产 MSI；MSI 安装按手动处理 |
| 未知包类型 | 否 | Settings 指向发布页 |

仅手动是刻意设计。deb 或 rpm 安装由包数据库管理；MSI 不由本项目生产，NSIS 更新包无法替换它；
portable ZIP 没有可替换的安装器，且可能位于可移动介质上。桌面端报告已安装的包类型，并对这些
情况禁用应用内安装器。它不会假装手动包已被更新。

Windows NSIS 路径现已完成六次端到端验证：`0.2.0 → 0.2.1`、`0.2.1 → 0.2.2`、
`0.2.2 → 0.2.3`、`0.2.3 → 0.3.0`、`0.3.0 → 0.4.0` 和 `0.4.0 → 0.5.0`。第六次运行中，已安装的 `0.4.0`
通过 Rust 更新器升级，下载并验证已签名包，安装并重启后报告 **Desktop 0.5.0**、**Engine 0.7.0** 且引擎就绪。
任何带应用内更新器的 `0.2.x` 安装都可直接升级到 `0.5.0`；`0.1.0` 没有更新器，需要一次手动安装。

`0.2.1 → 0.2.2` 更新由旧的 `0.2.1` 更新器执行，其中没有新的受跟踪 PID 清理。如果首次更新期间
有 sidecar 正在运行，请在其退出后重试，或手动安装 `0.2.2`。`0.2.2 → 0.2.3` 及后续更新使用受跟踪 PID
清理，并在无法停止受跟踪 sidecar 时以 `UPDATE_ENGINE_BUSY` 阻止。

## 发布流水线

桌面 workflow 是手动且 owner-gated 的。它没有 push、pull-request 或 tag 触发器。所有者启动
**Actions → Desktop build → Run workflow** 并批准 `desktop-release` 环境；非所有者运行会被跳过。

| 输入 | 默认值 | 含义 |
|---|---|---|
| `engine_version` | `0.7.0` | sidecar 中捆绑的精确引擎版本 |
| `signed` | `false` | 请求操作系统签名/公证；此零支出仓库未配置 |
| `publish` | `false` | 所有矩阵构建通过后创建 GitHub release |
| `tag` | 空 | `vX.Y.Z` 发布标签；`publish=true` 时必填 |

默认值与 `0.5.0` 固定版本一致。如果传入不同版本，发布门控会拒绝清单不匹配。

| Runner | Target | 包 |
|---|---|---|
| `windows-latest` | `x86_64-pc-windows-msvc` | NSIS |
| `ubuntu-22.04` | `x86_64-unknown-linux-gnu` | AppImage、deb、rpm |
| `macos-15` | `aarch64-apple-darwin` | DMG + app |
| `macos-15-intel` | `x86_64-apple-darwin` | DMG + app |

所有 runner 都是标准 GitHub-hosted runner。不使用更大 runner、付费分钟、付费存储或付费签名
服务。构建产物保留 7 天；GitHub release 是持久分发渠道。

## Sidecar 固定与校验和

发布 sidecar 是 PyInstaller **onedir** 树，在匹配的主机上构建；PyInstaller 不交叉编译。引擎、
Python、Pydantic、Typer 和 PyInstaller 版本固定在 `scripts/cli-checksums.json`。`0.5.0` 固定
引擎 `0.7.0`（高于 `0.6.0`）、Python `3.12`、Pydantic `2.14.3`、Typer `0.29.0` 和 PyInstaller `6.22.3`。

PyInstaller onedir 输出不是字节可复现的。因此校验和政策分为三部分：

- **本地发布构建 — 严格。** `scripts/verify-sidecar.mjs` 必须匹配已提交的 SHA-256 和大小；
  `--write` 在审查后更新固定值。`null` 表示“尚未审查”，不是“已验证”。
- **CI 重建 — 重建感知。** 构建 job 以 `--no-hash` 运行验证器，并把实际 SHA-256 记录到
  `release/sidecar-checksums-<target>.json`。
- **发布门控 — 基于报告。** 发布 job 要求每个交付 target 都有有效报告：target 名称匹配、
  `hashPolicy: "rebuild"`、`ok: true`、64 位十六进制哈希、正大小和精确引擎版本。

对于 `0.7.0`，Windows x64 有已审查的本地固定值；Linux 和 macOS sidecar 由发布 workflow 重新构建并通过
rebuild-aware 报告，其已审查固定值仍为 `null`，直到在这些主机上审查本地构建。`0.6.0` 的 Windows 固定值没有沿用，因为可执行文件随引擎变化。校验和报告是 CI 证据，不是发布产物。
`SHA256SUMS.txt` 覆盖安装器、更新包、签名和 `latest.json`；sidecar 可执行文件位于这些包内，
不单独列出。手动安装的用户应使用 `SHA256SUMS.txt` 校验下载的产物。

```bash
node scripts/verify-sidecar.mjs \
  --root src-tauri/engine \
  --target x86_64-pc-windows-msvc \
  --engine-version 0.7.0
```

## `latest.json`、签名与发布

更新签名使用免费的 Ed25519/minisign 密钥，与操作系统代码签名分开。公钥内嵌在应用中；私钥是
仓库密钥，只传给构建步骤。启用了 `requireSignedVersion`，因此公告版本绑定到已签名包。更新器
只接受高于当前版本的版本，因此不能降级。

`scripts/stage-release-assets.mjs` 展平并规范化包名，写出各平台的 `updater-<platform>.json`
元数据。`scripts/merge-latest-json.mjs` 将它们合并为 `latest.json`：

- 必需的通用键：`windows-x86_64`、`linux-x86_64`、`darwin-aarch64`、`darwin-x86_64`；
- 更新器探测的 bundle 别名：`windows-x86_64-nsis`、`linux-x86_64-appimage`、
  `darwin-aarch64-app`、`darwin-x86_64-app`；
- 可选的 `linux-x86_64-deb` 和 `linux-x86_64-rpm`，仅在 Tauri 生成对应签名时；
- 每个 URL 都指向 `releases/download/<tag>/` 下；
- 每个签名都与磁盘上的 `.sig` 文件核对；
- 每个引用的产物都必须存在；
- 说明来自 `docs/releases/<version>.md`（如果存在）。

发布先创建为 **draft**。产物在 draft 状态下上传，`latest.json` 最后上传，然后 job 通过
`gh release edit --draft=false` 发布并核对远程产物名称。`releases/latest/download/latest.json`
只会解析到已发布版本，因此用户不会看到上传到一半的清单。重跑会复用现有 draft、清空其产物，
并拒绝覆盖已发布版本。

## 版本固定

桌面版本必须在 `package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`、Git 标签
和发布标题中一致。引擎固定值位于 `scripts/cli-checksums.json`；workflow 显式传入
`engine_version`，发布门控要求它与清单一致。

当前源码中 `src-tauri/src/commands.rs` 的 `MIN_ENGINE_VERSION` 为 `0.7.0`。`0.5.0` 捆绑引擎
`0.7.0`，因此最低版本与捆绑引擎一致，`0.6.x` 引擎会被视为不兼容。外壳接受不低于该
版本的引擎，并把更旧版本标记为离线并显示通知。更新的引擎会通过门控，但不是发布测试过的固定
版本。开发构建可通过 `LV24_SEO_BIN` 使用其他版本；UI 会将其标记为外部并仍检查最低版本。只有
设置 `LV24_SEO_ALLOW_PATH_ENGINE=1` 时才使用 `PATH` 中的引擎。

## 从 0.1.0 一次性升级

`0.1.0` 没有更新器、端点和公钥。它无法发现或安装 `0.5.0`。请手动下载并安装一次 `0.5.0`
（Windows 上的 NSIS 安装器或便携 ZIP）。之后，`0.5.0` 安装在使用支持自动更新的包类型时，
可以自动更新到后续版本。

## 更早的版本

- **桌面 0.4.0** 增加了 Logs、Tasks 和 Backup 页面及报告摘要卡片，捆绑引擎 `0.6.0`，并把 `MIN_ENGINE_VERSION` 提高到 `0.6.0`。
- **引擎 0.6.0** 增加了本地 nginx 日志分析和第 12 个 MCP 工具、归因变更摘要、带模式 v3 的任务生命周期、可移植备份和 20 个 CLI 命令。
- **桌面 0.3.0** 增加了项目向导、抓取屏幕、报告比较与导出、设置保存流程、集成、按工作区的报告窗口和运行状态。
- **引擎 0.5.3** 让 MCP 写入变成两阶段，把抓取移出事件循环，增加 `--strict` 退出码 `5`、类型化存储错误
  和诚实的 GSC/Metrika/Bing/Yandex 数据。
- **桌面 0.2.3** 把更新安装移入 Rust 并支持真实取消，让配置路径成为由对话框批准的权限，拒绝网络和设备
  路径，并在 webview 之前脱敏引擎输出。
- **桌面 0.2.2** 修复了 sidecar 被锁定导致的更新失败，让配置写入持久且私密，清理了过期 UI 状态，
  并捆绑引擎 `0.5.2`。
- **引擎 0.5.2** 把相对 `storage.data_dir` 锚定到配置文件，把写入账本接入 CLI 应用，脱敏站点地图
  抓取错误，并把恰好填满上限的 GSC 页面报告为截断。
- **桌面 0.2.1** 修复了 Yandex Metrika 令牌接口，并明确了 CLI/桌面共享钥匙串。它是第一个通过
  应用内更新器从 `0.2.0` 交付的版本。
- **桌面 0.2.0** 是首个多平台版本：Windows NSIS 和便携 ZIP、Linux AppImage/deb/rpm、macOS
  DMG 和已签名更新包。
- **引擎 0.5.1** 修复了写入门控重试、抓取文本上限、MCP 注解和可达限制。它把恰好达到上限的
  GSC 最后一页视为完整；`0.5.2` 改变了这一判断，把完整最后一页视为可能截断。

## 回滚

没有自动降级。回滚是手动安装旧版本。

| 故障 | 响应 |
|---|---|
| 安装器有问题但应用可用 | 发布修复补丁；不要在同一标签下覆盖产物 |
| `latest.json` 有问题 | 发布修复补丁；draft 门控防止部分清单可见 |
| 更新密钥泄露 | 轮换密钥，发布带新公钥的手动版本；自动更新无法跨越轮换 |
| 引擎回归 | 固定之前的引擎版本，重建并发布补丁 |
| 需要旧桌面版本 | 手动安装；更新器拒绝降级 |

不要移动或复用已发布标签。保留上一版本产物用于回滚。如果需要禁用端点，请发布手动版本并记录。

## 校验下载

`SHA256SUMS.txt` 覆盖每个已发布产物。校验你准备安装的文件：

```bash
sha256sum -c SHA256SUMS.txt --ignore-missing
```

在 macOS 上，基础系统提供 `shasum -a 256 -c SHA256SUMS.txt`。在 Windows 上，将
`Get-FileHash <file> -Algorithm SHA256` 与对应行比较。不要运行哈希不匹配的文件。

默认情况下，操作系统包未签名（Windows、Linux）或仅 ad-hoc 签名（macOS）。更新签名认证的是
更新，而不是首次手动下载。SmartScreen 和 Gatekeeper 警告是预期行为；校验校验和并使用文档化的
**More info → Run anyway** 或 **Open Anyway** 流程。不要全局禁用这些保护。

更新信任见[安全与隐私](/zh/security/)，sidecar 布局见[架构](/zh/architecture/)。

Source: `_source/engine-releases-0.7.0.md`, `_source/engine-releases-0.6.0.md`, `_source/engine-releases-0.5.3.md`, `_source/engine-releases-0.5.2.md`, `_source/desktop-releases-0.5.0.md`, `_source/desktop-releases-0.4.0.md`, `_source/desktop-releases-0.3.0.md`, `_source/desktop-releases-0.2.3.md`, `_source/desktop-releases-0.2.2.md`, `_source/desktop-releases-0.2.1.md`, `_source/desktop-releases-0.2.0.md`, `_source/desktop-release.md`, `_source/desktop-security.md`.

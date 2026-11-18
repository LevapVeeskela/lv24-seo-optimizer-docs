---
title: 架构
description: 引擎包结构、数据源信封、存储、报告快照、桌面 FSD 结构、Rust 外壳与 sidecar 解析。
---

# 架构

产品有一个权威引擎和一个外壳：

- `lv24-seo 0.15.2` 负责数据源客户端、抓取、分析、报告、存储、MCP 工具、CLI 命令、
  索引自动化和自动化。
- 桌面应用 `0.9.8` 是 React webview 加 Rust 进程外壳。它渲染界面、编辑配置并启动
  内置引擎；不重新实现引擎行为。

当两者指向同一工作区时，共享同一份 SQLite 历史。

## 引擎分层

```text
surfaces        CLI (Typer) · MCP server · skills · automation
                          |
analysis/report  deltas · rules · digests · render · delivery
                          |
store            SQLite (WAL) · snapshots · sends ledger
                          |
providers/crawl  provider adapters · fetcher · sitemap · log ingest
                          |
core             config · http · errors · time · write gate
```

依赖只向下。`providers` 和 `crawl` 从不导入 `report` 或 `cli`。分析依赖存储模型，而
不是数据源客户端类。适配器从不修改数据库；持久化由调用方完成。

## 引擎包结构

| 包 | 职责 |
|---|---|
| `core/` | 分层配置、HTTP 重试/限流、类型化错误、信封、时间、密钥存储、日志脱敏、写入门禁 |
| `providers/` | GSC、Yandex Webmaster、Yandex Metrika、Bing、CrUX、PSI、可选 GA4 适配器 |
| `crawl/` | Fetcher、HTML 解析器、robots 和 sitemap、规则模块、链接图、日志导入 |
| `analysis/` | Delta、机会、索引分诊、融合和抓取规则 |
| `store/` | SQLite 模式、迁移、仓库、快照和发送账本 |
| `report/` | 构建器、语言目录、渲染器、投递、差异 |
| `mcp/` | 服务器、规范注册表、资源、提示词 |
| `cli/` | Typer 命令和人类可读输出 |
| `automation/` | 计划任务生成器、投递配方、GitHub Actions 配方 |

`src/lv24_seo/mcp/registry.py` 是工具元数据的唯一事实来源。它驱动 MCP JSON schema、
CLI 帮助、`schemas/tools.json` 和文档表格。不要手工编辑生成文件；重新生成：

```bash
python -m lv24_seo.mcp.registry --write
python -m lv24_seo.mcp.registry --check
```

共有 12 个工具：10 个读取类工具（7 个纯只读加 3 个本地状态写入者）和两个受门禁的写入工具。`seo_crawl_site` 和
`seo_weekly_report` 是读取工具，但会保存本地快照，因此生成的 schema 增加
`writes_local_state` 并把它们标记为 `readOnlyHint: false`。

## 数据源契约

每个适配器返回同一个信封，这正是多引擎融合能够诚实的原因：

```python
@dataclass(frozen=True)
class ProviderResult[T]:
    source: str              # gsc, yandex_webmaster, yandex_metrika, bing, crux, psi
    property_id: str         # provider property id
    fetched_at: datetime     # UTC
    data_age_days: int       # provider lag at fetch time
    rows: list[T]
    total: int | None        # total available, when the provider reports it
    truncated: bool          # True when a cap was hit
    limitations: list[str]   # machine codes such as rows_cap_50000
    warnings: list[str]      # human hints such as host_not_loaded
```

规则：

- `truncated` 根据数据源自身的上限和“还有更多数据”的证据计算，绝不猜测。GSC 将恰好
  填满上限的最后一页报告为 `truncated: true`；完整一页不能证明不存在下一行。
- `limitations` 代码类似枚举，只在报告渲染器中翻译。
- 降级主机是数据，不是异常：空行、`host_not_loaded` 警告和 `degraded_host` 限制。

## 信封与失败模型

CLI `--json` 和 MCP 结构化输出使用同一个信封：

| 字段 | 含义 |
|---|---|
| `ok` | 成功或类型化失败 |
| `data` | 成功时的负载 |
| `error.code` | 失败时的稳定机器码 |
| `error.message` | 不含请求体和令牌的人类消息 |
| `error.next_action` | 建议的下一条命令 |
| `error.retryable` | 重试是否有帮助 |
| `meta` | 至少包含 `version`；可增加 `truncated`、`data_age_days`、`limitations`、`sources` |
| `warnings` | 缺少令牌、缺少属性、降级主机 |

按 `error.code` 分支，不要按退出码：不同失败共享退出码 `2`。`PROPERTY_NOT_FOUND`
没有专用退出码。退出码 `5` 保留给成功负载且带有 `meta.truncated` 和 `meta.strict`
的情况；当前没有命令设置 `strict`。

部分失败是正常的。数据源失败的周报仍返回可用部分，并带上 `sources_failed` 和
`complete: false`。它不会因为某个引擎的 401/403/429/超时而取消整个运行。完全中断会
产生明确的“无数据”报告。

## 存储与迁移

SQLite 以 WAL 模式运行。`data/seo.sqlite3` 被 git 忽略。`seo.toml` 中的相对
`storage.data_dir` 锚定到配置目录；内置默认值和 `LV24_SEO_DATA_DIR` 保持进程作用域。
`doctor --json` 报告 `meta.data_dir` 和 `meta.data_dir_source`，`config show --json`
报告有效路径。主要表：

| 表 | 用途 |
|---|---|
| `properties` | 配置的站点和数据源 id |
| `metric_daily` | 仅真正的按日行，以日期为键 |
| `metric_windows` | 带真实 `[start, end]` 的窗口聚合 |
| `pages` | URL 清单和索引状态 |
| `issues` | 抓取和数据源发现，带生命周期状态 |
| `snapshots` | 报告差异基线：规范 JSON，gzip 压缩 |
| `sends` | 投递账本和幂等占位 |
| `runs` | 每次抓取、报告或数据源操作 |
| `indexing_state` | 每个数据源/URL 的本地队列位置：`last_submitted_at`、`last_checked_at`、`submit_status`、`index_status`、`next_check_at`（模式 v5） |
| `indexing_runs` | 每次索引运行每个数据源一行：计划、提交、检查、跳过、前后配额和状态（模式 v5） |
| `quota_usage` | GSC 检查和 IndexNow 的本地 UTC 日计数器（模式 v5） |
| `schema_migrations` | 只追加的迁移账本 |

按日行和窗口聚合在结构上位于不同表，因此重叠窗口不会互相覆盖。单维键按原样存储；
多维键编码为 JSON，因此包含 `|` 的值不会冲突。

模式变更是 `store/db.py` 中的编号迁移，记录在 `schema_migrations`。升级不会删除
用户行。迁移 2 把迁移前的 GSC 按日行标记为 `accuracy=legacy_unknown_granularity`；
原始窗口无法恢复。普通按日读取会排除它们，调用方可以用 `include_legacy=True` 显式
检查。

磁盘上没有原始数据源归档。快照是 `snapshots` 表中的 gzip 规范 JSON。
`raw_retention_days` 是保留设置；清理日志会说明它没有效果。

## 报告快照与投递

`report/builders.py` 生成 `Report` dataclass，可 JSON 序列化且为规范英语。
`Report.to_dict()` 没有 locale 字段，因此快照、报告差异和 MCP 负载不随显示语言变化。
`report/i18n.py` 只负责呈现：语言目录（`en`、`ru`、`zh`）、复数规则以及数字、百分比、
位置和日期格式。未知语言回退到英语；无效数字或日期渲染为空文本，而不是 `0`。

周报邮件是 600px 内联 CSS 模板，包含 KPI 卡片、主要机会、问题严重度、合并数据源、
数据说明和页脚。没有外部图片、样式表、脚本或跟踪像素。投递使用验证型 TLS 上下文、
规范化传输结果和包含渲染语言的内容语义哈希。更改语言会重新发送同一周期一次；用同一
语言重建则不会。

报告差异读取两个已存储的周报快照，默认是第二新和最新。只存在于一个快照中的指标是
未知，不是零。`report diff` 只读，不调用数据源。

## 桌面前端

Feature-Sliced Design，依赖向下：

```text
app/        root store, providers, router, layout, styles
pages/      dashboard, reports, settings, configuration, recommendations, not-found
features/   save-config, secret-set, update, agent-task
entities/   config, engine, report, stats, recommendation, update
shared/     CLI transport, desktop settings/files, i18n, UI primitives, formatting
```

`0.3.0` 没有 `widgets/` 层。页头、导航和更新徽章位于 `app/layout` 和
`features/update`；只有当切片确实跨页面复用时才增加 widget 层。

每个切片暴露一个公共 API，从不导入另一个切片的内部实现。信封解析器和错误映射位于
`shared`；界面从不解析原始进程输出。UI 语言（`en`、`ru`、`zh`）独立于
`report.locale`。机器码从不翻译；未知码按原样显示。

状态限定在当前工作区：切换工作区或引擎离线时，报告、统计、doctor 和密钥状态会被清除，
不会显示上一个项目的数据。无法执行的操作会被禁用，而不是点击后失败。en/ru/zh 目录保持
一致；缺少键是测试失败。

MobX store 保存根状态、引擎状态、配置草稿、报告数据、建议和更新器状态。
`UpdateStore` 在启动时做静默检查（30 秒超时），在 Settings 中手动检查，并且只在用户
明确点击后安装。对于 portable、deb、rpm、MSI 和未知包类型，它禁用应用内安装。

## Rust 外壳与 sidecar

| 模块 | 职责 |
|---|---|
| `commands.rs` | 固定 Tauri 命令、引擎状态、`MIN_ENGINE_VERSION`、`prepare_update` |
| `cli.rs` | argv 构造、stdin 桥、环境过滤、超时、有界输出 |
| `config.rs` | `toml_edit` 补丁、校验、持久原子替换、`0600` 备份、有界读取 |
| `paths.rs` | config/data/log/export 根、路径允许列表、sidecar 解析 |
| `settings.rs` | UI 语言、窗口大小、选定的配置路径 |
| `error.rs` | 跨越 IPC 边界的类型化错误 |

发布 sidecar 是 PyInstaller **onedir** 树。拒绝 onefile：它每次调用都解包、启动慢，
并且不适合 macOS 签名。该树映射到 Tauri 资源 `engine/lv24-seo/`；外壳按以下顺序解析：

1. `LV24_SEO_BIN`（仅绝对路径）；
2. `<resource_dir>/engine/lv24-seo/lv24-seo[.exe]`（`bundled`）；
3. `<resource_dir>/lv24-seo/lv24-seo[.exe]`（`bundled-flat`）；
4. Linux AppImage 树 `$APPDIR/usr/lib/<product>/engine/lv24-seo/`（`appimage`）；
5. 应用旁的 `lv24-seo/` 目录（`sibling`）；
6. `PATH`，仅当设置 `LV24_SEO_ALLOW_PATH_ENGINE=1`。

不会自动下载任何内容。外壳运行 `lv24-seo version --json`，记录路径、来源和版本，并与
`MIN_ENGINE_VERSION`（当前源码中为 `0.15.2`）比较。旧引擎标记为 `compatible: false`；
UI 将其视为离线并显示提示。更新的引擎通过门禁，但不是发布测试的固定版本。

## 数据流

- **CLI：** 解析参数 → 构建一个 `composition.Workspace`（配置加共享 SQLite）→ 运行一个
  服务操作 → 关闭存储。带 `--confirm` 的写入应用会附加 SQLite 幂等账本；没有存储时信封
  会警告：在令牌五分钟有效期内没有重放保护。
- **MCP：** 工具通过同一 composition root 调用同一批服务。SDK 在工作线程中运行处理
  程序，但 `sqlite3` 连接绑定到创建它的线程，因此每个工具都通过 `async` 适配器注册。
  调用在事件循环线程上逐个运行；并发 `tools/call` 请求串行化。
- **桌面：** webview 调用固定的 Tauri 命令；Rust 校验参数，用 argv 数组和 `--json`
  启动 sidecar，解析一个信封并返回类型化结果。同一时间只有一个活动工作区。没有本地
  HTTP API。

没有 `init` 时，CLI 和 MCP 以无存储模式运行并给出明确警告。桌面仍需要选定的
`seo.toml`；它不会凭空创建数据目录，也不会静默覆盖 `LV24_SEO_DATA_DIR`。

## 可移植性

支持 Windows、macOS 和 Linux：

- Windows 需要 WebView2 运行时；NSIS 安装器可以获取它，portable ZIP 不能。外壳以
  `CREATE_NO_WINDOW` 启动，并设置 `PYTHONUTF8=1` 和 `PYTHONIOENCODING=utf-8`，让
  非 ASCII 路径穿过代码页。
- macOS 需要 macOS 13 或更高版本。构建仅 ad-hoc 签名，未公证。
- Linux 包在 Ubuntu 22.04 上构建，glibc 2.35 基线。AppImage 可能需要 FUSE 2；deb 和
  rpm 只能手动更新。
- 发布目标为 Windows x64、Linux x64、macOS arm64 和 macOS x64。没有 Windows arm64
  或 Linux arm64 构建。

控制措施见[安全与隐私](/zh/security/)，打包方式见[发布与更新](/zh/release/)。

Source: `_source/engine-architecture.md`, `_source/desktop-architecture.md`, `_source/engine-auth.md`, `_source/engine-releases-0.15.2.md`, `_source/engine-releases-0.15.1.md`, `_source/engine-releases-0.15.0.md`, `_source/engine-releases-0.14.1.md`, `_source/engine-releases-0.14.0.md`, `_source/engine-releases-0.13.1.md`, `_source/engine-releases-0.13.0.md`, `_source/engine-releases-0.12.2.md`, `_source/engine-releases-0.12.0.md`, `_source/engine-releases-0.11.0.md`, `_source/engine-releases-0.5.3.md`, `_source/desktop-releases-0.9.8.md`, `_source/desktop-releases-0.9.7.md`, `_source/desktop-releases-0.9.6.md`, `_source/desktop-releases-0.9.5.md`, `_source/desktop-releases-0.9.4.md`, `_source/desktop-releases-0.9.3.md`, `_source/desktop-releases-0.9.2.md`, `_source/desktop-releases-0.9.1.md`, `_source/desktop-releases-0.9.0.md`, `_source/desktop-releases-0.2.2.md`, `_source/desktop-release.md`.

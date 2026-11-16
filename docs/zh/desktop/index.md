---
title: 桌面应用
description: LV24 SEO Optimizer 桌面外壳增加了什么、签名更新如何工作，以及 0.6.0 的可取消运行与 0.5.0 及更早历史。
---

# 桌面应用

LV24 SEO Optimizer Desktop 是围绕 `lv24-seo` 引擎的本地、离线优先 Tauri v2 外壳。Python CLI 仍是核心引擎：它负责提供商客户端、抓取规则、分析、报告构建和投递。桌面端增加的是 React 界面和 Rust 进程桥，而不是第二套 SEO 实现。

`0.6.0` 以内置 PyInstaller onedir 边车的形式捆绑 `lv24-seo 0.8.0`，并增加可取消的后台运行。它要求引擎 `0.8.0` 或更新（`MIN_ENGINE_VERSION`）。没有云账号、遥测、本地 HTTP API 或搜索结果页抓取。桌面端通过固定且带允许列表的子进程桥与引擎通信。

## 增加了什么

- **工作区选择器。** 在 Settings 中通过原生文件对话框选择引擎应使用的 `seo.toml`。选中的配置路径就是工作区身份。配置被移动或删除时会显示为缺失，可重新选择，而不是阻塞启动。
- **统计仪表板。** 渲染有边界的 `stats` 信封：每个已配置提供商一张卡片，包含当前值、上一窗口比较、覆盖率、数据年龄、截断和限制。CTR 变化以百分点显示。不补零，也不做跨引擎合计；未知保持未知。
- **设置表单和配置输出。** Settings 屏幕是可编辑表单。Configuration 屏幕只读，包含 Overview、Effective、Source TOML、Diff、Validation、Doctor 和 Environment 标签页。Source TOML 已脱敏且只读；没有原始 TOML 编辑器。保存使用字段级补丁，保留注释和键顺序，用引擎校验，创建带时间戳的备份（保留最近五个）并原子替换文件。在 `0.6.0` 中，临时文件和备份在 POSIX 上权限为 `0600`，在 Windows 上带仅所有者 DACL，两者都会 fsync，重命名后还会 fsync 父目录。读取上限为 8 MiB；设置按字段加载；Windows 保留设备名和结尾点/空格在每个路径组件中都会被拒绝。GSC 服务账号在表单外配置：设置 `providers.gsc.service_account_file` 或 `LV24_SEO_GSC_SERVICE_ACCOUNT_FILE`，Configuration 屏幕会显示生效的脱敏配置。
- **报告。** 在本地运行周报，将 `report.json` 和 `report.html` 写入应用数据目录，并在默认浏览器中打开 HTML。报告 HTML 从不嵌入应用 webview。它比较两个最新存储的快照，导出 JSON（`lv24-seo.report/v1`）或 CSV，渲染引擎的归因变更摘要（包含原因、置信度、证据行和下一步操作），并按 URL 模板和设备显示 Core Web Vitals 卡片。
- **建议与智能体队列。** 将报告和统计发现转换为有边界的 Markdown 提示词。你可以复制提示词、导出为 `.md`，或将其保存在带状态的本地智能体队列中。队列存储在 webview 的本地存储中；不会自动提交任何内容。
- **通过 stdin 传递密钥。** token 输入是密码字段，只通过 IPC 发送一次。Rust 层将其传给 `lv24-seo auth set --provider <p> --stdin`，清零缓冲区，并且从不把值写入日志、MobX 存储、localStorage、剪贴板或诊断包。保存后，界面只显示是否存在及来源。
- **Yandex Metrika 令牌。** `0.6.0` 在 TypeScript 和 Rust 允许列表、Settings 徽章、密钥对话框和 en/ru/zh 标签中保留独立的 `metrika` 提供商（`yandex_metrika_token`）。Metrika 计数器绝不借用 Webmaster 令牌。引擎 `0.8.0` 修复了 `stat/v1/data` 的 offset，因此卡片不再出现已配置但为空的情况。
- **与 CLI 共享密钥存储。** 桌面应用在同一操作系统用户下运行同一引擎，因此在终端通过 `lv24-seo auth set` 保存的 token 在桌面应用中可见，反之亦然。系统钥匙串条目使用服务名 `lv24-seo` 和相同的密钥名。`LV24_SEO_*` 环境变量会被继承，但在 UI 中显示为只读：桌面端无法删除环境变量，因此会明确说明，而不是提供一个无效的删除按钮。只有两个界面使用同一 workspace/data 目录时，才共享显式启用的 `<data-dir>/secrets.json` 回退文件。
- **Logs 页面。** 原生 `pick_log_file` 选择一个 nginx JSON 访问日志（不超过 100 MiB）；其他路径会以 `PATH_NOT_APPROVED` 拒绝。页面显示机器人过滤、解析摘要、带按机器人拆分的抓取浪费、机器人汇总表和 JSON/CSV 导出。机器人仅按 User-Agent，结果标记为分诊。
- **Tasks 页面。** 最新优先的发现，包含属性、类型、状态、规则、URL、时间和存储的证据；支持过滤和最多 500 行的限制。状态变化遵循允许的转换，添加表单幂等，证据上限 16 KiB。
- **Backup 页面。** `backup create` 把可移植归档写入导出目录或原生对话框选择的目录；面板显示路径、大小、SHA-256、是否包含数据库、属性和快照数量以及成员表。恢复区从原生对话框选择的归档生成计划，并且只有确认后使用计划令牌应用；替换前当前数据库和配置会复制到 `.pre-restore-<utc>`。
- **Portfolio 页面。** 通过原生目录对话框选择文件夹；引擎最多向下三层扫描 `seo.toml`，每次最多检查 50 个站点。提供汇总计数、排序和过滤，打开一行会通过常规 shell 流程切换工作区。扫描不调用提供商、不读取令牌、不写磁盘。
- **可取消的后台运行。** 抓取、周报、日志分析、备份创建/恢复和计划任务安装作为后台子进程运行，带稳定 run id。窗口级横幅显示类型、耗时、状态和 **Cancel** 按钮；离开路由不会清除它。取消只向本应用为该运行注册的确切子进程 PID（以及 Unix 上的进程组）发信号，在确认仍是引擎映像或受跟踪子进程后执行；绝不按名称匹配。未知或已完成的运行返回 `false`，UI 不会声称取消。已取消运行返回 `RUN_CANCELLED`，与成功和失败运行分开显示。取消不是回滚，也没有任务队列。
- **更新面板。** 在启动时和按需检查已签名的 `latest.json`，显示发行说明，并且只有在你确认后才安装。安装器启动前，只停止本应用实例登记的引擎 sidecar PID；如果无法停止，安装会被 `UPDATE_ENGINE_BUSY` 阻止。下载和安装都在 Rust 中执行，而不是在 webview 中，并且可以在安装器启动前取消下载。

仪表板和报告屏幕基于与终端相同的引擎命令：

```bash
lv24-seo stats --days 7 --lag-days 2 --json
lv24-seo report weekly --days 7 --lag-days 2 --json
```

## 安装类型

从项目 Releases 页面下载桌面产物。桌面端与 Python 引擎安装分开；外壳可以使用内置 sidecar、显式 `LV24_SEO_BIN`、同级便携布局，或 `$APPDIR/usr/lib/<product>/engine/lv24-seo/` 下的 Linux AppImage 树。

| 包类型 | 安装方式 | 应用内更新 |
|---|---|---|
| Windows NSIS | `LV24.SEO.Optimizer_0.6.0_x64-setup.exe` | 是 |
| Windows 便携 ZIP | `LV24-SEO-Optimizer_0.6.0_x64-portable.zip`；解压整个文件夹并运行 `lv24-seo-desktop.exe` | 否 |
| Linux AppImage | `LV24.SEO.Optimizer_0.6.0_amd64.AppImage`；`chmod +x` 并运行 | 是 |
| Linux deb | `LV24.SEO.Optimizer_0.6.0_amd64.deb`；`sudo apt install ./*_amd64.deb` | 否 |
| Linux rpm | `LV24.SEO.Optimizer-0.6.0-1.x86_64.rpm`；`sudo dnf install ./*_amd64.rpm` | 否 |
| macOS `.app`（来自 DMG） | `LV24.SEO.Optimizer_0.6.0_aarch64.dmg` 或 `LV24.SEO.Optimizer_0.6.0_x64.dmg`；拖到 Applications | 是 |
| MSI | 本项目不生产 | 否 |

Windows 需要 Windows 10/11 x64 和 WebView2。Linux 仅提供 x64，基于 Ubuntu 22.04 构建，glibc 2.35 基线。macOS 需要 13 或更高；Apple silicon 使用 arm64 DMG，Intel 使用 x64 DMG。操作系统包未签名或仅 ad-hoc 签名，因此 SmartScreen 和 Gatekeeper 警告是预期行为。运行安装器前请校验 `SHA256SUMS.txt`。

## 更新如何工作

更新器从项目的 GitHub Releases 端点读取已签名 `latest.json`。包使用 minisign/Ed25519 密钥签名，公钥内嵌在应用中。启用了 `requireSignedVersion`，因此公告版本绑定到已签名包。

- 应用在启动时静默检查一次，超时 30 秒，并在你按下 **Check for updates** 时检查。
- 不会自动下载或安装。面板显示版本和说明；**Download and install** 启动更新。未保存的配置草稿会禁用按钮。从 `0.2.3` 起，面板可以在安装器启动前取消下载。
- 只接受高于当前版本的版本。更新器不能降级应用，并且 shell 会拒绝与面板公告版本不同的发布。
- 签名失败会阻止该产物，把错误标记为不可重试并指向发布页。它不会重试，也不会降级为离线警告。
- 安装器启动前，`prepare_update` 只停止本应用实例启动的引擎 sidecar PID。不会按映像名称匹配，因此另一个已安装副本、便携构建或终端运行不会被触碰。如果清理失败，安装会被 `UPDATE_ENGINE_BUSY` 阻止；关闭占用 sidecar 的运行后重试。
- Windows 以被动模式运行已签名的 NSIS 安装程序；macOS 替换 `.app`；Linux 替换 AppImage。安装后应用会重启；Windows 的重启由 NSIS 安装程序处理。

### 自动更新矩阵

| 包类型 | 自动更新 | 行为 |
|---|---|---|
| Windows NSIS | 是 | 下载已签名 setup `.exe`，停止受跟踪的 sidecar PID，以 passive 模式运行，重启 |
| macOS `.app` | 是 | 下载已签名 `.app.tar.gz`，替换应用，重启 |
| Linux AppImage | 是 | 下载已签名 AppImage，替换，重启 |
| Windows 便携 ZIP | 否 | 更新面板指向发布页；下载并解压新 ZIP |
| Linux deb | 否 | 更新面板指向发布页；用包管理器升级 |
| Linux rpm | 否 | 更新面板指向发布页；用包管理器升级 |
| MSI | 否 | 不生产 MSI；MSI 安装按手动处理 |
| 未知包类型 | 否 | 更新面板指向发布页 |

仅手动是刻意设计。deb/rpm 安装由发行版包数据库管理，MSI 不由本项目生产，便携 ZIP 没有可替换的安装器。桌面端报告已安装的包类型，并对这些情况禁用应用内安装器；它不会假装手动包已被更新。

`0.2.0 → 0.2.1` 更新已完成端到端验证。`0.2.1 → 0.2.2` 更新也已在 Windows 上验证：已安装的
`0.2.1` 检测到 `0.2.2`，下载并验证已签名包，以 passive 模式安装，重启后报告 `0.2.2` 且引擎
`0.5.2` 就绪。`0.2.2 → 0.2.3` 更新以同样方式验证：已安装的 `0.2.2` 在应用内更新后报告
**Desktop 0.2.3**、**Engine 0.5.3** 且引擎就绪。`0.2.3 → 0.3.0` 更新通过 Rust 更新器验证：
已安装的 `0.2.3` 报告 **Desktop 0.3.0**、**Engine 0.5.3** 且引擎就绪。`0.3.0 → 0.4.0` 更新以同样
方式验证：已安装的 `0.3.0` 报告 **Desktop 0.4.0**、**Engine 0.6.0** 且引擎就绪。`0.4.0 → 0.5.0` 更新通过
Rust 更新器验证：已安装的 `0.4.0` 报告 **Desktop 0.5.0**、**Engine 0.7.0** 且引擎就绪，Portfolio 页面可加载。
`0.5.0 → 0.6.0` 更新通过同一更新器验证：已安装的 `0.5.0` 报告 **Desktop 0.6.0**、**Engine 0.8.0**
且引擎就绪，真实 `lv24.by` 工作区加载。任何 `0.2.x` 安装都可直接升级到 `0.6.0`。

`0.2.2` 的安装也已在 macOS 和 Linux 上验证：macOS 27.2 上的 arm64 DMG 通过
`codesign --verify --deep --strict`，启动后引擎 `0.5.2` 就绪并获取了 `0.2.2` 清单；
Ubuntu 24.04 上的 deb、AppImage extract-and-run fallback 和 Fedora 45 上的 rpm 均安装、
启动并显示 `Engine ready`，引擎为 `0.5.2`；AppImage 的直接 FUSE 挂载也在 WSL2 中验证。

`0.2.1 → 0.2.2` 更新由旧的 `0.2.1` 更新器执行，其中没有新的受跟踪 PID 清理。如果首次更新期间
有 sidecar 正在运行，请在其退出后重试，或手动安装 `0.2.2`。`0.2.2 → 0.2.3` 使用受跟踪 PID
清理，并在无法停止受跟踪 sidecar 时以 `UPDATE_ENGINE_BUSY` 阻止。

## 0.6.0 可取消运行

2026-11-16 发布。捆绑 `lv24-seo 0.8.0` 并要求 `MIN_ENGINE_VERSION` `0.8.0`，因此 `0.7.x` 引擎会被报告为不兼容。

- **后台运行与取消。** `crawl`、`report_weekly`、`logs_analyze`、`backup_create`、`backup_restore` 和
  `schedule_install` 接受来自 webview 的稳定 run id。Rust 运行器在 spawn 前注册
  `run id → 确切子进程 PID`；其他命令的 run id 会以 `RUN_NOT_CANCELLABLE` 拒绝，因此短读取保持同步路径。
  运行存在于一个根 `RunStore`：窗口级横幅显示类型、耗时、状态和 **Cancel**，离开路由不会清除它，
  所有活动运行都会列出，最新的已取消运行会保留到关闭。`run_cancel(runId)` 在确认仍是引擎映像或
  受跟踪子进程后，只向该确切注册子进程（以及 Unix 上的进程组）发信号；绝不按名称匹配。未知或已完成
  的运行返回 `false`，已取消运行返回 `RUN_CANCELLED`，与成功和失败运行分开显示。
- **计划任务安装同意。** 引擎 `0.8.0` 使 `schedule install` 默认只生成计划。桌面端请求确认，并只在
  用户确认其显示的计划后追加 `--allow-write`；外壳仍在 spawn 引擎前以 `CONFIRM_REQUIRED` 拒绝没有
  `allowWrite=true` 的安装。仅计划预览和仅打印产物仍然可用，安装像其他长任务一样可取消。
- **引擎 0.8.0。** Sidecar 增加 GSC 服务账号、`cwv collect` 写入器、`backup restore --to`、
  `schedule status`/`uninstall`、更丰富的 Yandex 指标、Metrika 1-based offset 修复和 Windows JSON
  输出修复。`properties` 增加 `token_source`，`doctor` 增加 `gsc_auth`；`MIN_ENGINE_VERSION` 为
  `0.8.0`，因为强制性的 `schedule install --allow-write` 同意需要它。
- **外壳与契约。** 契约从 `lv24-seo 0.8.0` 重新生成；增量变化是 `gsc_auth` 检查、
  `properties.token_source` 和 `config.schema.json` 中的 `providers.gsc.service_account_file`。
  契约生成器把 `PYTHON_KEYRING_BACKEND` 固定为 null 后端，因此带有真实提供商令牌的开发机不会把
  令牌存在性泄漏到固定装置中。

0.6.0 的已知限制：

- 取消不是回滚，也没有任务队列。已取消运行可能留下部分报告、抓取、备份或调度器产物；已取消的就地
  恢复保留恢复前副本，但可能已替换一个文件，因此重试前请构建新计划。
- 计划任务安装只在确认后、只在本机修改主机；桌面端不管理、修复或卸载任务。请使用 CLI 的
  `schedule status`/`schedule uninstall`。
- GSC 服务账号在表单外配置，`cwv collect` 和 `backup restore --to` 仅限 CLI；桌面端渲染已存储的
  CWV 行并规划就地恢复。
- `MIN_ENGINE_VERSION` 为 `0.8.0`，因此 `0.7.x` 引擎会被拒绝。

## 0.5.0 恢复、组合与 CWV

2026-11-16 发布。捆绑 `lv24-seo 0.7.0` 并要求 `MIN_ENGINE_VERSION` `0.7.0`，因此 `0.6.x` 引擎会被报告为不兼容。

- **恢复。** 备份面板增加恢复区。`pick_backup_archive` 选择归档；第一次调用只生成计划，**Restore now** 在有令牌前保持禁用。应用时显示确认对话框，并用 `--allow-write` 和计划令牌调用 `backup_restore`。计划显示归档与清单哈希、目标配置和数据目录、当前与归档数据库哈希、配置动作（`create`、`replace` 或 `write_alongside`）以及 300 秒令牌有效期。归档变化、工作区变化、令牌过期或重放都会得到 `CONFIRM_REQUIRED`。
- **计划任务安装。** Integrations 的计划卡片有 **Preview artifact** 和 **Install on this host** 两种模式。安装会在确认对话框（显示配置和任务类型）后为每周或每日报告写入 cron 条目、systemd 用户定时器或 Windows 任务计划程序任务；它只影响本机。
- **组合。** Portfolio 页面在所选目录下最多三层扫描 `seo.toml`，每次扫描最多检查 50 个站点。行包含配置路径、名称、属性、基础 URL、数据目录、数据库是否存在、抓取次数、报告快照、问题计数和最后活动时间。可按未解决问题、名称、最后活动或错误优先排序，按名称、属性或路径过滤；打开一行会通过常规 shell 流程切换工作区。损坏的配置或不可读数据库成为该站点的错误，其余站点仍会扫描。
- **CWV 卡片。** 周报渲染引擎的 `cwv` 分区，按规范化 URL 模板和设备显示上一 p75、差值和回归标记，并显示截断、最早证据日期、跳过行和引擎限制。最多显示五个模板，先显示回归项。
- **外壳与引擎。** 新增白名单命令 `backup_restore`、`portfolio_list` 和 `schedule_install`，都在外壳中校验参数；`pick_backup_archive` 是新增命令，`pick_directory` 也会批准组合根目录和备份输出目录。契约从 `lv24-seo 0.7.0` 重新生成。

## 0.4.0 Logs、任务与备份

2026-11-16 发布。捆绑 `lv24-seo 0.6.0` 并要求 `MIN_ENGINE_VERSION` `0.6.0`，因此 `0.5.x` 引擎会被报告为不兼容。

- **Logs。** `pick_log_file` 选择一个 nginx JSON 访问日志（不超过 100 MiB）；不是来自对话框或应用自身数据/导出目录的路径会以 `PATH_NOT_APPROVED` 拒绝。页面显示机器人过滤、解析摘要（总数、已解析、已跳过）、带按机器人拆分的抓取浪费、机器人汇总表和 JSON/CSV 导出。机器人仅按 User-Agent，结果标记为分诊，而不是抓取覆盖的证明。
- **Tasks。** 最新优先的发现，包含属性、类型、状态、规则、URL、时间和存储的证据；支持过滤和最多 500 行的限制。状态变化遵循允许的转换，非法转换会带允许集合被拒绝，添加表单幂等，证据上限 16 KiB 并拒绝形似凭据的键。
- **Backup。** `backup create` 把一个可移植归档写入导出目录或原生对话框选择的目录；面板显示路径、大小、SHA-256、是否包含数据库、属性和快照数量、成员表以及引擎限制。未实现恢复，面板会说明。
- **摘要卡片。** 周报渲染引擎的归因变更摘要，包含原因、置信度、最多三行证据和下一步操作，以及 `showing N of M`、最早证据日期和跳过行数。
- **外壳与引擎。** 新增允许列表命令 `logs_analyze`、`tasks_list`、`tasks_add`、`tasks_update` 和 `backup_create`，都在外壳中校验参数；`pick_directory` 现在也批准备份输出目录。契约从 `lv24-seo 0.6.0` 重新生成。

## 0.3.0 工作流

2026-11-16 发布。捆绑 `lv24-seo 0.5.3`，并让 `MIN_ENGINE_VERSION` 保持 `0.5.2`。

- **入门。** 三步向导运行 `lv24-seo init`，在创建任何内容之前显示配置和数据路径，并在已有配置时提供
  **Open existing seo.toml** 而不是覆盖。`knownConfigs` 跨重启记住最多 20 个配置路径，仍由外壳校验；
  标题栏芯片打开 8 个最近工作区。
- **抓取屏幕。** 有界运行、汇总计数、严重性/规则/文本过滤以及 JSON/CSV 导出；表格渲染 500 行，导出包含
  引擎返回的每一行。
- **报告。** 比较两个最新快照并导出 JSON（`lv24-seo.report/v1`）或 CSV；**not comparable** 会明确显示，
  而不是静默比较。
- **设置。** 粘性保存栏、Ctrl/Cmd+S、**Only changed** 过滤以及应用级草稿保护，在丢弃编辑或关闭窗口前询问。
- **建议。** 搜索、按严重性排序以及批量 queue/export。
- **集成。** JSON 和 TOML 格式的 MCP 片段以及仅打印的调度器产物；不会安装或编辑任何内容。
- **报告窗口。** 每个工作区 7/28/90 天和 2/3 天延迟，统计和周报共用；运行显示耗时、上次时长和截断徽章。

## 0.2.3 加固

`0.2.3` 于 2026-11-16 发布。它把更新下载移入 Rust，让配置路径成为由对话框批准的权限，并修复可能误报保存或工作区状态的 UI。它捆绑 `lv24-seo 0.5.3`，并让 `MIN_ENGINE_VERSION` 保持 `0.5.2`，因此已安装的 `0.5.2` 引擎仍被接受。

### 更新器移入 Rust

webview 不再拥有更新器插件的下载和安装权限；其能力列表只保留 `updater:allow-check`。shell 中的 `update_install` 会重新检查端点，拒绝与面板公告不同的版本（`UPDATE_VERSION_MISMATCH`），下载、验证签名，然后才启动安装器。进度以 `update://progress` 到达；进度监听失败只是外观问题，绝不会阻止安装。

**取消**现在有实际含义。下载期间，面板调用 `update_cancel`；shell 丢弃下载流并返回 `UPDATE_CANCELLED`，使面板无错误地回到 idle。安装器启动后，`update_cancel` 返回 `false`，面板保持原状——绝不会声称发生了并未发生的取消。在 Windows 上，安装器启动时进程会退出，因此安装 promise 可能永远不会 resolve；这是预期行为。

### 由对话框批准的配置路径

`pick_config` 拥有原生对话框并记录所选文件。`settings_set` 只接受已经是活动路径或由对话框返回的配置路径；任何其他 `.toml` 都会以 `PATH_NOT_APPROVED` 被拒绝，因此被攻破的 webview 无法把 `config_write` 或 `config_patch` 指向任意文件。比较使用规范路径，因此已批准文件的等价写法仍然匹配。

`storage.data_dir` 若指向 UNC 共享、`\\?\` 设备路径或 `\\.\` 设备，会在相对于配置目录解析之前以 `INVALID_PATH` 和 `detail.reason: network_or_device_path` 被拒绝。否则拼接会隐藏 `\\server\share` 前缀，并在 UI 线程上打开 SMB 连接。

### 脱敏与路径超时

引擎 stderr 在到达 webview、日志或诊断包之前会被脱敏，而且脱敏发生在 300 字符预览截断之前：被截半的 token 将不再匹配脱敏模式。TOML 解析器错误可能引用出错行，因此也会脱敏。超过预算的辅助任务以 `PATH_TIMEOUT` 失败，而不是让屏幕挂起。

### 工作区与 UI 状态

- `shell_status` 报告 `configExists`。当保存的配置被移动或删除时，仪表板显示带 **Choose config** 的工作区缺失横幅，而不是通用的统计错误，并且不会尝试统计调用。字段缺失表示未知，而不是缺失，因此旧版 shell 不会被误读。
- 每个提供商区块都有显式的启用开关。它是 `providers.<id>.present` 的唯一写入者；禁用的区块在保存时会从 `seo.toml` 中移除，其字段保持不可访问。
- 校验是三态的：`valid`、`invalid` 或 `skipped`。双击、切换工作区或在引擎校验期间继续输入都会返回 `skipped`，UI 不会弹出 toast 声称草稿无效。
- 跳过链接把焦点移到主区域而不改变 hash 路由，因此不再渲染 NotFound。路由级错误边界会隔离渲染失败、提供重新加载，并在路径变化时重置。

### 发布流水线

拉取请求 CI 现在覆盖发布脚本本身，Rust 矩阵包含发布所用的 Intel macOS runner，Rust 固定为 `1.95.0` 而不是 `stable`。`latest.json` 在创建草稿之前会按 `contracts/latest.schema.json` 校验。发布产物允许列表位于一个经过测试的模块中，Windows 便携 ZIP 附带 `.sha256` sidecar，由发布闸门重新计算并比较。

## 工作区切换与过期状态

活动 `seo.toml` 路径是工作区身份。切换到不同配置或引擎离线时，桌面端会在任何屏幕显示上一个项目的数据之前清除统计、报告、doctor 和密钥状态。首次加载只记录路径；后续变化视为切换。未保存的配置草稿在 Settings 和 Configuration 之间共享，且仅限当前会话，因此关闭应用前请保存。

无法执行的操作会被禁用，而不是点击后失败：未选择工作区、引擎离线或引擎低于最低版本。模态框或面板关闭时，焦点返回触发控件。en/ru/zh 消息目录保持一致；缺少键是测试失败，而不是静默英文回退。

## Linux 钥匙串

在 Linux 上，CLI 运行器继承 Secret Service 所需的会话总线和 XDG 运行时变量（`DBUS_SESSION_BUS_ADDRESS`、`XDG_RUNTIME_DIR`、`TMPDIR` 及相关路径），同时过滤无关的主机变量。这使桌面进程可以访问操作系统钥匙串。密钥值仍然只通过 stdin 传递。如果钥匙串不可用，请使用 `LV24_SEO_*` 环境变量或引擎显式启用的文件回退。

## 0.6.0 中的抓取

桌面端有专门的 Crawl 屏幕：起始 URL 和 URL 预算、汇总计数、严重性/规则/文本过滤，以及 JSON/CSV 导出。表格最多渲染 500 行，而导出包含引擎返回的每一行；切换工作区会重置屏幕。抓取在后台运行，带窗口级横幅和 **Cancel** 按钮；取消只停止该确切子进程，已取消运行可能留下部分本地产物。没有任务队列，离开屏幕也不会停止运行。

## 基础故障排查

| 症状 | 可能原因 | 怎么做 |
|---|---|---|
| 没有工作区配置 | 未选择 `seo.toml`，或保存的路径已移动/删除 | 运行 `lv24-seo init`，然后在 Settings 中选择文件 |
| 引擎被标记为离线 | 引擎缺失或低于外壳的最低版本（`0.8.0`） | 使用内置引擎，或将 `LV24_SEO_BIN` 指向兼容引擎 |
| SmartScreen 或 Gatekeeper 警告 | 操作系统构建未签名或仅 ad-hoc 签名 | 校验 `SHA256SUMS.txt`，然后使用文档化的 **Run anyway** 或 **Open Anyway** 流程 |
| AppImage 无法启动 | 缺少 FUSE 2 | 安装 `libfuse2` 或改用 deb/rpm |
| 更新检查失败 | GitHub 端点被阻止或离线 | 保持当前版本；启动时的静默检查不会显示错误 |
| 更新按钮不可用 | 未保存的配置草稿或仅手动构建 | 保存或放弃草稿，或从发行页面下载软件包 |
| 更新签名失败 | 软件包与内嵌密钥不匹配 | 产物被阻止；从发行页面重新下载并校验校验和 |
| 工作区缺失横幅 | 保存的 `seo.toml` 被移动或删除 | 点击 **Choose config** 重新选择文件 |
| `PATH_NOT_APPROVED` | 配置路径未经原生对话框设置 | 通过 **Choose config** 选择文件；只有对话框选中的路径才能成为活动路径 |
| `INVALID_PATH` 且 `network_or_device_path` | `storage.data_dir` 指向 UNC 共享或设备路径 | 使用本地目录；网络共享会在打开前被拒绝 |
| `UPDATE_CANCELLED` | 你在安装器启动前取消了下载 | 预期行为；再次开始安装 |
| `UPDATE_VERSION_MISMATCH` | 公告的发布在检查与安装之间发生变化 | 再次点击 **Check for updates** 并安装新公告的版本 |
| `UPDATE_ENGINE_BUSY` | 应用无法停止的 sidecar 进程占用了已安装的引擎文件 | 关闭占用 `lv24-seo` 的终端或应用运行，然后再次点击 **Download and install** |
| 卡片显示 `missing_token` | 缺少提供商 token | 运行 `lv24-seo auth set --provider <p> --stdin` |
| 卡片显示 `no_data` | 提供商可访问，但该窗口没有数据行 | 扩大窗口，或检查资源和数据延迟 |
| 长时间调用看起来卡住 | 运行仍在窗口横幅中活动 | 点击横幅中的 **Cancel**，或等待；已取消运行可能留下部分文件且不会回滚 |

## 已知限制

- `0.1.0` 没有更新器，必须手动升级一次。从 `0.2.0` 起可以自动更新。
- deb、rpm、MSI 和便携 ZIP 仅支持手动更新。没有 Windows arm64 或 Linux arm64 构建。
- 需要 macOS 13+ 和 glibc 2.35+。较旧的系统可能无法运行这些构建。
- 更新器只安装更高版本；回滚需要手动安装旧版本。
- 更新器需要访问 GitHub Releases 端点。端点被阻止或离线时，应用会停留在当前版本。
- 更新器只能停止它自己启动的 sidecar。从终端或另一个应用副本启动的引擎不会被杀死；如果它占用已安装 sidecar，安装会被 `UPDATE_ENGINE_BUSY` 阻止。
- `0.2.1 → 0.2.2` 更新由旧的 `0.2.1` 更新器执行，其中没有受跟踪 PID 清理。如果首次更新期间有 sidecar 正在运行，请在其退出后重试，或手动安装 `0.2.2`。`0.2.2 → 0.2.3` 及后续更新使用清理。
- 取消不是回滚，`0.6.0` 也没有任务队列：已取消的抓取、报告、日志分析、备份或计划任务安装可能留下部分产物，已取消的就地恢复保留 `.pre-restore-<utc>` 副本，但可能已替换一个文件，因此重试前请构建新计划。关闭窗口不会把运行移入队列。
- 恢复替换数据库和配置，绝不合并；`.pre-restore-<utc>` 副本是唯一回滚手段，被其他进程打开的数据库在 Windows 上无法替换。令牌被排除，因此恢复后需要重新认证。`backup restore --to` 是仅限 CLI 的解压。
- 计划任务安装会修改主机：只有确认后才会写入 cron 条目、systemd 用户定时器或 Windows 任务，并且只在本机。桌面端不管理、修复或卸载任务；请使用 CLI 的 `schedule status`/`schedule uninstall`。
- GSC 服务账号在表单外配置：在 `seo.toml` 中设置 `providers.gsc.service_account_file`，或在环境中设置 `LV24_SEO_GSC_SERVICE_ACCOUNT_FILE`。桌面端没有该字段。
- 没有带 URL 和设备的 CrUX/PSI 字段行时 CWV 卡片为空；`cwv collect` 是 CLI 命令，PSI 实验室行绝不存储，最多显示五个模板。
- 组合只报告本地历史，每次扫描最多检查 50 个站点，并且从不调用提供商。
- 机器人分诊仅基于 User-Agent：伪造的 UA 不会被发现，非搜索爬虫归为 `other`。
- 一次一个日志文件，最多 100 MiB；没有轮转、glob、远程获取或持久日志历史。
- `MIN_ENGINE_VERSION` 为 `0.8.0`，因此 `0.7.x` 引擎会被拒绝；桌面端不会静默把命令降级到旧引擎。
- 摘要是基于证据的分诊，不是因果证明；没有证据的条目保持 `unexplained`。
- 计划运行只有在确认后才会安装，并且只安装在本机；桌面端不管理或卸载任务，也不编辑 MCP 客户端配置。请使用 CLI 的 `schedule status`/`schedule uninstall`。它也不执行数据源写入。
- 配置路径批准按进程生效，外加持久化的 `knownConfigs` 列表；两者之外的路径仍需要原生对话框。
- Windows ACL 加固是尽力而为。如果 `icacls` 失败，保存仍会继续，草稿保留目录的继承 DACL。
- 更新取消只在安装器启动前生效。安装开始后没有回滚。
- 外部引擎按版本门控，不随应用捆绑。界面会将其标记为外部，并检查最低版本。
- 建议文案已本地化为 en/ru/zh；在 `0.2.3` 之前排队的任务保留已存储的英文文本。
- 这是 `0.x` 预览：配置输出、更新器行为和界面细节可能在 1.0 前变化。

Source: `_source/desktop-README.md`, `_source/desktop-releases-0.6.0.md`, `_source/desktop-releases-0.5.0.md`, `_source/desktop-releases-0.4.0.md`, `_source/desktop-releases-0.3.0.md`, `_source/desktop-releases-0.2.3.md`, `_source/desktop-releases-0.2.2.md`, `_source/desktop-releases-0.2.1.md`, `_source/desktop-releases-0.2.0.md`, `_source/desktop-security.md`, `_source/desktop-architecture.md`.

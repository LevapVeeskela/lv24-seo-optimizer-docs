---
title: 桌面应用
description: LV24 SEO Optimizer 桌面外壳增加了什么、签名更新如何工作，以及 0.2.2 加固补丁带来的变化。
---

# 桌面应用

LV24 SEO Optimizer Desktop 是围绕 `lv24-seo` 引擎的本地、离线优先 Tauri v2 外壳。Python CLI 仍是核心引擎：它负责提供商客户端、抓取规则、分析、报告构建和投递。桌面端增加的是 React 界面和 Rust 进程桥，而不是第二套 SEO 实现。

`0.2.2` 加固补丁以内置 PyInstaller onedir 边车的形式捆绑 `lv24-seo 0.5.2`。没有云账号、遥测、本地 HTTP API 或搜索结果页抓取。桌面端通过固定且带允许列表的子进程桥与引擎通信。

## 增加了什么

- **工作区选择器。** 在 Settings 中通过原生文件对话框选择引擎应使用的 `seo.toml`。选中的配置路径就是工作区身份。配置被移动或删除时会显示为缺失，可重新选择，而不是阻塞启动。
- **统计仪表板。** 渲染有边界的 `stats` 信封：每个已配置提供商一张卡片，包含当前值、上一窗口比较、覆盖率、数据年龄、截断和限制。CTR 变化以百分点显示。不补零，也不做跨引擎合计；未知保持未知。
- **设置表单和配置输出。** Settings 屏幕是可编辑表单。Configuration 屏幕只读，包含 Overview、Effective、Source TOML、Diff、Validation、Doctor 和 Environment 标签页。Source TOML 已脱敏且只读；没有原始 TOML 编辑器。保存使用字段级补丁，保留注释和键顺序，用引擎校验，创建带时间戳的备份（保留最近五个）并原子替换文件。在 `0.2.2` 中，临时文件和备份权限为 `0600` 并 fsync，重命名后还会 fsync 父目录。读取上限为 8 MiB；设置按字段加载；Windows 保留设备名和结尾点/空格在每个路径组件中都会被拒绝。
- **报告。** 在本地运行周报，将 `report.json` 和 `report.html` 写入应用数据目录，并在默认浏览器中打开 HTML。报告 HTML 从不嵌入应用 webview。报告或导出失败时会说明失败原因和下一步。
- **建议与智能体队列。** 将报告和统计发现转换为有边界的 Markdown 提示词。你可以复制提示词、导出为 `.md`，或将其保存在带状态的本地智能体队列中。队列存储在 webview 的本地存储中；不会自动提交任何内容。
- **通过 stdin 传递密钥。** token 输入是密码字段，只通过 IPC 发送一次。Rust 层将其传给 `lv24-seo auth set --provider <p> --stdin`，清零缓冲区，并且从不把值写入日志、MobX 存储、localStorage、剪贴板或诊断包。保存后，界面只显示是否存在及来源。
- **Yandex Metrika 令牌。** `0.2.2` 在 TypeScript 和 Rust 允许列表、Settings 徽章、密钥对话框和 en/ru/zh 标签中保留独立的 `metrika` 提供商（`yandex_metrika_token`）。Metrika 计数器绝不借用 Webmaster 令牌。
- **与 CLI 共享密钥存储。** 桌面应用在同一操作系统用户下运行同一引擎，因此在终端通过 `lv24-seo auth set` 保存的 token 在桌面应用中可见，反之亦然。系统钥匙串条目使用服务名 `lv24-seo` 和相同的密钥名。`LV24_SEO_*` 环境变量会被继承，但在 UI 中显示为只读：桌面端无法删除环境变量，因此会明确说明，而不是提供一个无效的删除按钮。只有两个界面使用同一 workspace/data 目录时，才共享显式启用的 `<data-dir>/secrets.json` 回退文件。
- **更新面板。** 在启动时和按需检查已签名的 `latest.json`，显示发行说明，并且只有在你确认后才安装。安装器启动前，只停止本应用实例登记的引擎 sidecar PID；如果无法停止，安装会被 `UPDATE_ENGINE_BUSY` 阻止。

仪表板和报告屏幕基于与终端相同的引擎命令：

```bash
lv24-seo stats --days 7 --lag-days 2 --json
lv24-seo report weekly --days 7 --lag-days 2 --json
```

## 安装类型

从项目 Releases 页面下载桌面产物。桌面端与 Python 引擎安装分开；外壳可以使用内置 sidecar、显式 `LV24_SEO_BIN`、同级便携布局，或 `$APPDIR/usr/lib/<product>/engine/lv24-seo/` 下的 Linux AppImage 树。

| 包类型 | 安装方式 | 应用内更新 |
|---|---|---|
| Windows NSIS | `LV24.SEO.Optimizer_0.2.2_x64-setup.exe` | 是 |
| Windows 便携 ZIP | `LV24-SEO-Optimizer_0.2.2_x64-portable.zip`；解压整个文件夹并运行 `lv24-seo-desktop.exe` | 否 |
| Linux AppImage | `LV24.SEO.Optimizer_0.2.2_amd64.AppImage`；`chmod +x` 并运行 | 是 |
| Linux deb | `LV24.SEO.Optimizer_0.2.2_amd64.deb`；`sudo apt install ./*_amd64.deb` | 否 |
| Linux rpm | `LV24.SEO.Optimizer-0.2.2-1.x86_64.rpm`；`sudo dnf install ./*_amd64.rpm` | 否 |
| macOS `.app`（来自 DMG） | `LV24.SEO.Optimizer_0.2.2_aarch64.dmg` 或 `LV24.SEO.Optimizer_0.2.2_x64.dmg`；拖到 Applications | 是 |
| MSI | 本项目不生产 | 否 |

Windows 需要 Windows 10/11 x64 和 WebView2。Linux 仅提供 x64，基于 Ubuntu 22.04 构建，glibc 2.35 基线。macOS 需要 13 或更高；Apple silicon 使用 arm64 DMG，Intel 使用 x64 DMG。操作系统包未签名或仅 ad-hoc 签名，因此 SmartScreen 和 Gatekeeper 警告是预期行为。运行安装器前请校验 `SHA256SUMS.txt`。

## 更新如何工作

更新器从项目的 GitHub Releases 端点读取已签名 `latest.json`。包使用 minisign/Ed25519 密钥签名，公钥内嵌在应用中。启用了 `requireSignedVersion`，因此公告版本绑定到已签名包。

- 应用在启动时静默检查一次，超时 30 秒，并在你按下 **Check for updates** 时检查。
- 不会自动下载或安装。面板显示版本和说明；**Download and install** 启动更新。未保存的配置草稿会禁用按钮。
- 只接受高于当前版本的版本。更新器不能降级应用。
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
`0.5.2` 就绪。`0.2.2` 可从 `0.2.0` 直接更新。

安装也已在 macOS 和 Linux 上验证：macOS 27.2 上的 arm64 DMG 通过
`codesign --verify --deep --strict`，启动后引擎 `0.5.2` 就绪并获取了 `0.2.2` 清单；
Ubuntu 24.04 上的 deb、AppImage extract-and-run fallback 和 Fedora 45 上的 rpm 均安装、
启动并显示 `Engine ready`，引擎为 `0.5.2`；AppImage 的直接 FUSE 挂载也在 WSL2 中验证。

`0.2.1 → 0.2.2` 更新由旧的 `0.2.1` 更新器执行，其中没有新的受跟踪 PID 清理。如果首次更新期间
有 sidecar 正在运行，请在其退出后重试，或手动安装 `0.2.2`。`0.2.2 → later` 使用受跟踪 PID
清理，并在无法停止受跟踪 sidecar 时以 `UPDATE_ENGINE_BUSY` 阻止。

## 工作区切换与过期状态

活动 `seo.toml` 路径是工作区身份。切换到不同配置或引擎离线时，桌面端会在任何屏幕显示上一个项目的数据之前清除统计、报告、doctor 和密钥状态。首次加载只记录路径；后续变化视为切换。未保存的配置草稿在 Settings 和 Configuration 之间共享，且仅限当前会话，因此关闭应用前请保存。

无法执行的操作会被禁用，而不是点击后失败：未选择工作区、引擎离线或引擎低于最低版本。模态框或面板关闭时，焦点返回触发控件。en/ru/zh 消息目录保持一致；缺少键是测试失败，而不是静默英文回退。

## Linux 钥匙串

在 Linux 上，CLI 运行器继承 Secret Service 所需的会话总线和 XDG 运行时变量（`DBUS_SESSION_BUS_ADDRESS`、`XDG_RUNTIME_DIR`、`TMPDIR` 及相关路径），同时过滤无关的主机变量。这使桌面进程可以访问操作系统钥匙串。密钥值仍然只通过 stdin 传递。如果钥匙串不可用，请使用 `LV24_SEO_*` 环境变量或引擎显式启用的文件回退。

## 0.2.2 中的抓取

桌面端在 Settings 表单中提供抓取设置，并在报告和建议中呈现抓取发现。`0.2.2` 界面没有单独的 Crawl 屏幕，长时间引擎调用没有任务进度或取消按钮。需要完整抓取输出和 sitemap 覆盖差异时，请在终端运行 `lv24-seo crawl`。

## 基础故障排查

| 症状 | 可能原因 | 怎么做 |
|---|---|---|
| 没有工作区配置 | 未选择 `seo.toml`，或保存的路径已移动/删除 | 运行 `lv24-seo init`，然后在 Settings 中选择文件 |
| 引擎被标记为离线 | 引擎缺失或低于外壳的最低版本（`0.5.2`） | 使用内置引擎，或将 `LV24_SEO_BIN` 指向兼容引擎 |
| SmartScreen 或 Gatekeeper 警告 | 操作系统构建未签名或仅 ad-hoc 签名 | 校验 `SHA256SUMS.txt`，然后使用文档化的 **Run anyway** 或 **Open Anyway** 流程 |
| AppImage 无法启动 | 缺少 FUSE 2 | 安装 `libfuse2` 或改用 deb/rpm |
| 更新检查失败 | GitHub 端点被阻止或离线 | 保持当前版本；启动时的静默检查不会显示错误 |
| 更新按钮不可用 | 未保存的配置草稿或仅手动构建 | 保存或放弃草稿，或从发行页面下载软件包 |
| 更新签名失败 | 软件包与内嵌密钥不匹配 | 产物被阻止；从发行页面重新下载并校验校验和 |
| `UPDATE_ENGINE_BUSY` | 应用无法停止的 sidecar 进程占用了已安装的引擎文件 | 关闭占用 `lv24-seo` 的终端或应用运行，然后再次点击 **Download and install** |
| 卡片显示 `missing_token` | 缺少提供商 token | 运行 `lv24-seo auth set --provider <p> --stdin` |
| 卡片显示 `no_data` | 提供商可访问，但该窗口没有数据行 | 扩大窗口，或检查资源和数据延迟 |
| 长时间调用看起来卡住 | 0.2.2 没有进度或取消 | 等待命令超时；界面显示不确定的忙碌状态 |

## 已知限制

- `0.1.0` 没有更新器，必须手动升级一次。从 `0.2.0` 起可以自动更新。
- deb、rpm、MSI 和便携 ZIP 仅支持手动更新。没有 Windows arm64 或 Linux arm64 构建。
- 需要 macOS 13+ 和 glibc 2.35+。较旧的系统可能无法运行这些构建。
- 更新器只安装更高版本；回滚需要手动安装旧版本。
- 更新器需要访问 GitHub Releases 端点。端点被阻止或离线时，应用会停留在当前版本。
- 更新器只能停止它自己启动的 sidecar。从终端或另一个应用副本启动的引擎不会被杀死；如果它占用已安装 sidecar，安装会被 `UPDATE_ENGINE_BUSY` 阻止。
- `0.2.1 → 0.2.2` 更新由旧的 `0.2.1` 更新器执行，其中没有受跟踪 PID 清理。如果首次更新期间有 sidecar 正在运行，请在其退出后重试，或手动安装 `0.2.2`。`0.2.2 → later` 使用清理。
- 外部引擎按版本门控，不随应用捆绑。界面会将其标记为外部，并检查最低版本。
- 建议的标题、操作和验证步骤来自引擎，保持英文；只有周围界面会翻译（en/ru/zh）。
- 这是 `0.x` 预览：配置输出、更新器行为和界面细节可能在 1.0 前变化。

Source: `_source/desktop-README.md`, `_source/desktop-releases-0.2.2.md`, `_source/desktop-releases-0.2.1.md`, `_source/desktop-releases-0.2.0.md`, `_source/desktop-security.md`, `_source/desktop-architecture.md`.

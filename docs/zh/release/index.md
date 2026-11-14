---
title: 发行与更新
description: 引擎 0.5.2 变更、桌面 0.2.2 产物、签名自动更新矩阵、发布流水线、版本固定与回滚。
---

# 发行与更新

当前发行版本：

| 产品 | 版本 | 说明 |
|---|---|---|
| 引擎 | `lv24-seo 0.5.2` | 缺陷修复版本；无模式迁移、无新 CLI 命令或 MCP 工具 |
| 桌面 | `0.2.2` | 加固补丁：更新前清理 sidecar、持久写入、密钥与过期状态修复；捆绑引擎 0.5.2 |

桌面版本与引擎版本相互独立，但桌面固定精确引擎，并拒绝低于最低版本的引擎。

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

Windows NSIS 路径已对 `0.2.0 → 0.2.1` 完成端到端验证。下一次应用内更新是 `0.2.1 → 0.2.2`，
同时会验证 sidecar 清理路径。`0.2.2` 可从 `0.2.0` 直接更新；`0.1.0` 没有更新器，需要一次手动
安装。

## 发布流水线

桌面 workflow 是手动且 owner-gated 的。它没有 push、pull-request 或 tag 触发器。所有者启动
**Actions → Desktop build → Run workflow** 并批准 `desktop-release` 环境；非所有者运行会被跳过。

| 输入 | 默认值 | 含义 |
|---|---|---|
| `engine_version` | `0.5.2` | sidecar 中捆绑的精确引擎版本 |
| `signed` | `false` | 请求操作系统签名/公证；此零支出仓库未配置 |
| `publish` | `false` | 所有矩阵构建通过后创建 GitHub release |
| `tag` | 空 | `vX.Y.Z` 发布标签；`publish=true` 时必填 |

默认值与 `0.2.2` 固定版本一致。如果传入不同版本，发布门控会拒绝清单不匹配。

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
Python、Pydantic、Typer 和 PyInstaller 版本固定在 `scripts/cli-checksums.json`。`0.2.2` 固定
引擎 `0.5.2`、Python `3.12`、Pydantic `2.14.3`、Typer `0.29.0` 和 PyInstaller `6.22.3`。

PyInstaller onedir 输出不是字节可复现的。因此校验和政策分为三部分：

- **本地发布构建 — 严格。** `scripts/verify-sidecar.mjs` 必须匹配已提交的 SHA-256 和大小；
  `--write` 在审查后更新固定值。`null` 表示“尚未审查”，不是“已验证”。
- **CI 重建 — 重建感知。** 构建 job 以 `--no-hash` 运行验证器，并把实际 SHA-256 记录到
  `release/sidecar-checksums-<target>.json`。
- **发布门控 — 基于报告。** 发布 job 要求每个交付 target 都有有效报告：target 名称匹配、
  `hashPolicy: "rebuild"`、`ok: true`、64 位十六进制哈希、正大小和精确引擎版本。

对于 `0.5.2`，Windows x64 有已审查的本地固定值；Linux 和 macOS target 在匹配主机上重建并审查
`0.5.2` sidecar 之前仍为 `null`。`0.5.1` 的 Windows 固定值没有沿用，因为可执行文件随引擎变化。校验和报告是 CI 证据，不是发布产物。
`SHA256SUMS.txt` 覆盖安装器、更新包、签名和 `latest.json`；sidecar 可执行文件位于这些包内，
不单独列出。手动安装的用户应使用 `SHA256SUMS.txt` 校验下载的产物。

```bash
node scripts/verify-sidecar.mjs \
  --root src-tauri/engine \
  --target x86_64-pc-windows-msvc \
  --engine-version 0.5.2
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

当前源码中 `src-tauri/src/commands.rs` 的 `MIN_ENGINE_VERSION` 为 `0.5.2`。外壳接受不低于该
版本的引擎，并把更旧版本标记为离线并显示通知。更新的引擎会通过门控，但不是发布测试过的固定
版本。开发构建可通过 `LV24_SEO_BIN` 使用其他版本；UI 会将其标记为外部并仍检查最低版本。只有
设置 `LV24_SEO_ALLOW_PATH_ENGINE=1` 时才使用 `PATH` 中的引擎。

## 从 0.1.0 一次性升级

`0.1.0` 没有更新器、端点和公钥。它无法发现或安装 `0.2.2`。请手动下载并安装一次 `0.2.2`
（Windows 上的 NSIS 安装器或便携 ZIP）。之后，`0.2.2` 安装在使用支持自动更新的包类型时，
可以自动更新到后续版本。

## 更早的版本

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

Source: `_source/engine-releases-0.5.2.md`, `_source/desktop-releases-0.2.2.md`, `_source/desktop-releases-0.2.1.md`, `_source/desktop-releases-0.2.0.md`, `_source/desktop-release.md`, `_source/desktop-security.md`.

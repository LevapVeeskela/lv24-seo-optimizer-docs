---
title: 发布与更新
description: 引擎 0.5.1 变更、桌面 0.2.0 产物、签名自动更新矩阵、发布流水线、版本固定与回滚。
---

# 发布与更新

当前版本：

| 产品 | 版本 | 说明 |
|---|---|---|
| 引擎 | `lv24-seo 0.5.1` | 缺陷修复版本；无模式迁移、无新 CLI 命令或 MCP 工具 |
| 桌面 | `0.2.0` | 首个多平台构建；捆绑引擎 0.5.1 |

桌面版本与引擎版本相互独立，但桌面固定确切引擎，并拒绝低于最低版本的引擎。

## 引擎 0.5.1

这是 0.5.x 系列的缺陷修复版本。它关闭了 0.5.0 之后发现的发布阻塞项：数据源失败可能
永久把写入标记为重复、抓取文本保留没有上限、MCP 注解把两个本地状态工具声明为只读，
以及若干文档化限制实际不可达。

变更：

- **写入门禁重试。** apply 先把幂等槽位标记为 `pending`，调用数据源，然后才提升为
  `sent`。如果数据源抛出异常，pending 占位会在重新抛出原异常前释放，因此同一计划的
  重试被允许。已完成或仍在进行的占位仍是重复。
- **抓取文本上限。** `PageData.text` 最多保留 20,000 字符，而 `word_count` 仍使用完整
  可见文本。链接提取、JSON-LD、hreflang 和词数统计仍读取完整文档。
- **MCP 注解。** `seo_crawl_site` 和 `seo_weekly_report` 会保存本地快照，因此为
  `writes_local_state: true` 和 `readOnlyHint: false`。它们仍不改变数据源状态，也不
  需要确认令牌。
- **可达限制。** Sitemap 发现使用每请求响应体预算，因此文档化的每文档 50 MB 上限可达；
  普通页面保持 5 MB 上限，50,000 URL 协议上限不变。`stats` 和 `report weekly` 拒绝
  大于 3,660 的 `--days`，返回 `INVALID_INPUT`。
- **周报构建器失败。** 构建器签名在调用前检查一次。兼容构建器内部的 `TypeError` 不再
  被吞掉；命令返回 `INTERNAL`，不保存快照。
- **GSC 截断。** 恰好填满 50,000 行上限的最后一页是完整，不是截断。只有还存在另一行时
  才报告 `rows_cap_50000`。
- **较小修复。** Windows npm 启动器忽略 `.cmd` shim；MCP 默认窗口使用
  `report.timezone`；多维指标键编码为 JSON；负的存储限制截断为零；
  `report diff --markdown` 把警告写到 stderr；计划任务安装修复损坏的 managed 块；
  `auth status` 包含 Yandex Metrika。

本版本记录的验证：

| 检查 | 结果 |
|---|---|
| 离线测试套件 | 1114 passed, 1 skipped (1115 collected) |
| `ruff check` | 通过 |
| `ruff format --check` | 通过 |
| `mypy src` | 通过 |

新增回归测试覆盖写入门禁释放与重试、20k 文本上限及精确 `word_count`、MCP 注解、
50 MB sitemap 预算、`--days` 拒绝、构建器签名不匹配与内部 `TypeError`、GSC 精确上限
截断、Windows `.cmd` 启动器、配置时区窗口、指标键冲突、负限制、stderr 警告、计划任务
块修复和 Metrika 认证。

0.5.1 的已知限制：

- 崩溃后留下的 `pending` 写入占位没有 TTL；在操作员释放前，它被视为进行中。这是有意
  的：错误重试可能重复数据源写入。
- 抓取文本上限是保留边界，不是解析边界。
- 50 MB sitemap 预算按文档计算；sitemap 索引可以在多个子文档上花费它，受 20 文档上限
  约束。
- 依赖 `readOnlyHint` 的 MCP 客户端现在可能在 `seo_crawl_site` 或
  `seo_weekly_report` 前请求确认。

## 桌面 0.2.0 产物

`0.2.0` 是首个多平台版本。GitHub 会把产物名称中的空格替换为点；Linux 文件的确切名称
以发布页为准。

| 产物 | 平台 | 用途 |
|---|---|---|
| `LV24.SEO.Optimizer_0.2.0_x64-setup.exe` + `.exe.sig` | Windows x64 | 当前用户 NSIS 安装器；已签名更新包 |
| `LV24-SEO-Optimizer_0.2.0_x64-portable.zip` | Windows x64 | 便携构建；仅手动 |
| `LV24.SEO.Optimizer_0.2.0_aarch64.dmg` | macOS Apple silicon | 首次安装 |
| `LV24.SEO.Optimizer_0.2.0_x64.dmg` | macOS Intel | 首次安装 |
| `LV24.SEO.Optimizer_0.2.0_aarch64.app.tar.gz` + `.sig` | macOS Apple silicon | 已签名更新包 |
| `LV24.SEO.Optimizer_0.2.0_x64.app.tar.gz` + `.sig` | macOS Intel | 已签名更新包 |
| `*_amd64.AppImage` + `.AppImage.sig` | Linux x64 | AppImage；已签名更新包 |
| `*_amd64.deb`, `*_amd64.rpm` | Linux x64 | 包管理器安装；仅手动 |
| `latest.json` | 全部 | 已签名更新清单 |
| `SHA256SUMS.txt` | 全部 | 每个已发布产物的 SHA-256 |

Windows 安装器需要 Windows 10/11 x64 和 WebView2 运行时；NSIS 安装器可以获取它，
portable ZIP 不能。Linux 包在 Ubuntu 22.04 上构建，glibc 2.35 基线，仅 x64。macOS
需要 macOS 13 或更高；Apple silicon 使用 `aarch64` DMG，Intel 使用 `x64` DMG。

## 自动更新矩阵

| 包类型 | 应用内更新 | 行为 |
|---|---|---|
| Windows NSIS | 是 | 下载已签名 setup `.exe`，以 passive 模式运行，重启 |
| macOS `.app` | 是 | 下载已签名 `.app.tar.gz`，替换应用，重启 |
| Linux AppImage | 是 | 下载已签名 AppImage，替换，重启 |
| Windows portable ZIP | 否 | Settings 指向发布页；下载并解压新 ZIP |
| Linux deb | 否 | Settings 指向发布页；用包管理器升级 |
| Linux rpm | 否 | Settings 指向发布页；用包管理器升级 |
| MSI | 否 | 不生产 MSI；MSI 安装按手动处理 |
| 未知包类型 | 否 | Settings 指向发布页 |

仅手动是有意设计。deb 或 rpm 安装由包数据库管理；MSI 不是本项目生产的，NSIS 更新包
无法替换它；portable ZIP 没有可替换的安装器，而且可能位于可移动介质。桌面报告已安装
包类型，并对这些情况禁用应用内安装器。它不会假装手动包已更新。

## 发布流水线

桌面工作流是手动且由所有者把关的。没有 push、pull-request 或 tag 触发器。所有者启动
**Actions → Desktop build → Run workflow**，并批准 `desktop-release` 环境；非所有者
运行会被跳过。

| 输入 | 默认值 | 含义 |
|---|---|---|
| `engine_version` | `0.5.1` | sidecar 中捆绑的确切引擎 |
| `signed` | `false` | 请求操作系统签名/公证；本零支出仓库未配置 |
| `publish` | `false` | 矩阵构建全部通过后创建 GitHub release |
| `tag` | 空 | `vX.Y.Z` 发布标签；`publish=true` 时必填 |

默认值与 `0.2.0` 的固定版本一致。如果传入其他版本，发布门禁会拒绝清单不匹配。

| Runner | Target | 包 |
|---|---|---|
| `windows-latest` | `x86_64-pc-windows-msvc` | NSIS |
| `ubuntu-22.04` | `x86_64-unknown-linux-gnu` | AppImage、deb、rpm |
| `macos-15` | `aarch64-apple-darwin` | DMG |
| `macos-15-intel` | `x86_64-apple-darwin` | DMG |

所有 runner 都是标准 GitHub 托管运行器。不使用更大的 runner、付费分钟、付费存储或
付费签名服务。构建产物保留 7 天；GitHub release 是持久分发渠道。

## Sidecar 固定与校验和

发布 sidecar 是 PyInstaller **onedir** 树，在匹配的宿主上构建；PyInstaller 不交叉
编译。引擎、Python、Pydantic、Typer 和 PyInstaller 版本固定在
`scripts/cli-checksums.json`。`0.2.0` 固定引擎 `0.5.1`、Python `3.12`、Pydantic
`2.14.3`、Typer `0.29.0` 和 PyInstaller `6.22.3`。

PyInstaller onedir 输出不是字节可复现的。因此校验和策略分为三层：

- **本地发布构建——严格。** `scripts/verify-sidecar.mjs` 必须匹配已提交的 SHA-256 和
  大小；`--write` 在评审后更新固定值。`null` 表示“尚未评审”，不是“已验证”。
- **CI 重建——感知重建。** 构建任务用 `--no-hash` 运行验证器，并把实际 SHA-256 记录到
  `release/sidecar-checksums-<target>.json`。
- **发布门禁——基于报告。** 发布任务要求每个发布目标都有有效报告：目标名匹配、
  `hashPolicy: "rebuild"`、`ok: true`、64 位十六进制哈希、正大小和确切引擎版本。

校验和报告是 CI 证据，不是发布产物。`SHA256SUMS.txt` 覆盖安装器、更新包、签名和
`latest.json`；sidecar 可执行文件位于这些包内，不单独列出。手动安装的用户用
`SHA256SUMS.txt` 校验下载的产物。

```bash
node scripts/verify-sidecar.mjs \
  --root src-tauri/engine \
  --target x86_64-pc-windows-msvc \
  --engine-version 0.5.1
```

## `latest.json`、签名与发布

更新签名使用免费的 Ed25519/minisign 密钥，与操作系统代码签名分开。公钥内嵌在应用中；
私钥是仓库密钥，只传给构建步骤。启用了 `requireSignedVersion`，因此公告版本绑定到已
签名包。更新器只接受高于当前版本的版本，因此不能降级。

`scripts/stage-release-assets.mjs` 展平并规范化包名，写入
`updater-<platform>.json` 元数据。`scripts/merge-latest-json.mjs` 把它们合并为
`latest.json`：

- 必需通用键：`windows-x86_64`、`linux-x86_64`、`darwin-aarch64`、`darwin-x86_64`；
- 更新器探测的包别名：`windows-x86_64-nsis`、`linux-x86_64-appimage`、
  `darwin-aarch64-app`、`darwin-x86_64-app`；
- 仅当 Tauri 生成对应签名时添加可选的 `linux-x86_64-deb` 和 `linux-x86_64-rpm`；
- 每个 URL 指向 `releases/download/<tag>/` 下；
- 每个签名都与磁盘上的 `.sig` 文件核对；
- 每个引用的产物都必须存在；
- 说明来自 `docs/releases/<version>.md`（如果存在）。

发布先创建为 **draft**。产物在草稿状态上传，`latest.json` 最后上传；然后任务用
`gh release edit --draft=false` 发布，并核对远端产物名称。
`releases/latest/download/latest.json` 只解析到已发布版本，因此用户不会看到部分上传
的清单。重跑会复用现有 draft、清空其产物，并拒绝覆盖已发布版本。

## 版本固定

桌面版本必须在 `package.json`、`src-tauri/tauri.conf.json`、
`src-tauri/Cargo.toml`、Git 标签和发布标题中一致。引擎固定值位于
`scripts/cli-checksums.json`；工作流显式传入 `engine_version`，发布门禁要求它与清单
一致。

当前源码中 `src-tauri/src/commands.rs` 的 `MIN_ENGINE_VERSION` 为 `0.5.1`。外壳接受
不低于该版本的引擎，并把旧引擎标记为离线并显示提示。更新引擎通过门禁，但不是发布测试
的固定版本。开发构建可以通过 `LV24_SEO_BIN` 使用其他版本；UI 标记为 external，并仍
检查最低版本。只有设置 `LV24_SEO_ALLOW_PATH_ENGINE=1` 时才使用 `PATH` 引擎。

## 从 0.1.0 一次性升级

`0.1.0` 没有更新器、端点和公钥。它无法发现或安装 `0.2.0`。请手动下载并安装一次
`0.2.0`（Windows 上使用 NSIS 安装器或 portable ZIP）。之后，使用支持自动更新的包类型
时，`0.2.0` 安装可以自动更新到后续版本。

## 回滚

没有自动降级。回滚是手动安装旧版本。

| 故障 | 响应 |
|---|---|
| 安装器损坏但应用可用 | 发布修复补丁；不要覆盖同一标签下的产物 |
| `latest.json` 损坏 | 发布修复补丁；draft 门禁阻止部分清单可见 |
| 更新器密钥泄露 | 轮换密钥，发布带新公钥的手动版本；自动更新无法跨越轮换 |
| 引擎回归 | 固定上一个引擎版本，重建并发布补丁 |
| 需要旧桌面版本 | 手动安装；更新器拒绝降级 |

不要移动或复用已发布标签。保留上一个版本的产物以便回滚。如果必须禁用端点，请发布
手动版本并记录说明。

## 校验下载

`SHA256SUMS.txt` 覆盖每个已发布产物。校验你准备安装的文件：

```bash
sha256sum -c SHA256SUMS.txt --ignore-missing
```

macOS 自带 `shasum -a 256 -c SHA256SUMS.txt`。Windows 上用
`Get-FileHash <file> -Algorithm SHA256` 与对应行比较。哈希不匹配的文件不要运行。

默认情况下，操作系统包未签名（Windows、Linux）或仅 ad-hoc 签名（macOS）。更新器签名认证更新，
不是第一次手动下载。SmartScreen 和 Gatekeeper 警告是预期行为；校验哈希并使用文档化的
**More info → Run anyway** 或 **Open Anyway**。不要全局关闭这些保护。

更新器信任见[安全与隐私](/zh/security/)，sidecar 布局见[架构](/zh/architecture/)。

Source: `_source/engine-releases-0.5.1.md`, `_source/desktop-releases-0.2.0.md`, `_source/desktop-release.md`, `_source/desktop-security.md`.

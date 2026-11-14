---
title: 安装
description: 使用 uv、pipx、pip 或 npx 安装 lv24-seo 引擎，设置 token，安装桌面应用并干净卸载。
---

# 安装

有两条安装路径：Python 引擎（`lv24-seo`）和可选的桌面外壳。npm 包是同一引擎的启动器，不是第二套实现。

| 路径 | 适合 | 命令 |
|---|---|---|
| uv | 大多数用户；隔离的工具安装 | `uv tool install "lv24-seo[secrets]"` |
| pipx | 已经在使用 pipx | `pipx install "lv24-seo[secrets]"` |
| pip | 项目虚拟环境 | `pip install "lv24-seo[secrets]"` |
| npx | 不想全局安装的 Node 用户 | `npx @lv24/seo doctor --json` |
| 桌面端 | 同一引擎的图形界面 | 参见[桌面应用](/zh/desktop/) |

## 引擎

引擎需要 Python 3.11 或更高版本。`uv` 可以下载解释器，因此系统 Python 不是必需的。`[secrets]` extra 启用操作系统钥匙串存储；没有它，`auth set` 无法使用钥匙串，必须使用环境变量或显式启用的文件回退。

选择一种安装方式。使用 uv：

```bash
uv tool install "lv24-seo[secrets]"
```

使用 pipx：

```bash
pipx install "lv24-seo[secrets]"
```

在虚拟环境中使用 pip：

```bash
pip install "lv24-seo[secrets]"
```

使用 npm 启动器（不进行全局安装）：

```bash
npx @lv24/seo doctor --json
```

如果不需要钥匙串支持，请安装不带 extra 的 `lv24-seo`。npm 启动器需要 Node.js 18 或更高版本，以及 `uv` 或已安装的 `lv24-seo` 可执行文件。它把所有参数转发给固定版本的 Python 包；其中没有 SEO 逻辑。首次运行 `npx` 时，uv 可能需要几秒钟解析并缓存包。

如果 `uv tool install` 后找不到 `lv24-seo` 命令，请打开新终端，使工具的 bin 目录进入 `PATH`。

## 验证

```bash
lv24-seo version --json
lv24-seo doctor
```

`version --json` 在标准信封中返回包名和版本。`doctor` 检查 Python、配置文件、有效数据目录及其作用域（`meta.data_dir`、`meta.data_dir_source`）、当前目录可写性和 token 是否存在。它不发起网络调用，因此 `doctor` 通过并不能证明提供商 token 有效。

## 创建工作区

```bash
lv24-seo init --property https://example.com
```

`init` 写入带注释的 `seo.toml`，创建 `<config dir>/data` 并写入 `data_dir = "./data"`，因此工作区是自包含的。除非传入 `--force`，否则它拒绝覆盖已有的 `seo.toml`。一个 `seo.toml` 描述一个项目和一组提供商目标。多个站点请保留多个配置文件，并传入 `--config path/to/seo.toml`。

编辑 `seo.toml` 以设置 GSC 资源、Yandex 主机 ID、Metrika 计数器、Bing 站点、CrUX 源和 PSI URL。`lv24-seo config show --json` 打印生效配置，并隐藏看起来像密钥的值。

## Token

```bash
lv24-seo auth login --provider gsc
lv24-seo auth set --provider gsc --stdin
lv24-seo auth status --json
```

`auth login` 打印提供商的专用手动步骤；它不会打开浏览器。`auth set` 从 stdin 或隐藏提示读取密钥，并存入操作系统钥匙串；在显式允许时，也可存入权限为 `0600` 的文件回退。绝不要把 token 放进 argv、shell 历史、仓库文件或截图。`auth status` 只报告是否存在及来源；它从不打印值，也不验证权限。

支持的提供商名称有 `gsc`、`yandex`、`metrika`、`bing`、`crux`、`psi`、`smtp` 和 `telegram`。没有 `secrets` extra 时，请使用提供商专用的 `LV24_SEO_*` 环境变量，例如 `LV24_SEO_YANDEX_WEBMASTER_TOKEN`。无头环境的回退方式是 `LV24_SEO_ALLOW_FILE_SECRETS=1` 加上权限为 `0600` 的 `data/secrets.json`；该模式下引擎每次运行都会警告。

## 桌面安装矩阵

桌面端 `0.2.2` 是当前加固补丁，内置 `lv24-seo 0.5.2`。从项目的 Releases 页面下载资源文件；`SHA256SUMS.txt` 覆盖所有已发布资源。

| 平台 | 文件 | 自动更新 |
|---|---|---|
| Windows 10/11 x64 | NSIS `LV24.SEO.Optimizer_0.2.2_x64-setup.exe`（+ `.sig`）、便携包 `LV24-SEO-Optimizer_0.2.2_x64-portable.zip` | 仅 NSIS；便携包手动更新 |
| Linux x64 | `LV24.SEO.Optimizer_0.2.2_amd64.AppImage`（+ `.AppImage.sig`）、`LV24.SEO.Optimizer_0.2.2_amd64.deb`、`LV24.SEO.Optimizer-0.2.2-1.x86_64.rpm` | 仅 AppImage；deb/rpm 手动更新 |
| macOS 13+ arm64/x64 | 首次安装用 `LV24.SEO.Optimizer_0.2.2_aarch64.dmg` / `LV24.SEO.Optimizer_0.2.2_x64.dmg`，更新用 `LV24.SEO.Optimizer_0.2.2_aarch64.app.tar.gz` / `LV24.SEO.Optimizer_0.2.2_x64.app.tar.gz`（+ `.sig`） | 仅 `.app`；DMG 用于首次安装 |

### Windows

NSIS 安装程序按当前用户安装，添加开始菜单条目，并可以自动更新。由于构建未签名，SmartScreen 可能警告；请先校验校验和，然后选择 **更多信息 → 仍要运行**。应用内更新前，外壳只停止它启动的引擎 sidecar PID；如果无法停止，安装会以 `UPDATE_ENGINE_BUSY` 阻止，并在该运行退出后重试。便携 ZIP 没有安装程序，也没有应用内更新：解压整个 `LV24 SEO Optimizer` 文件夹，将 `lv24-seo\` 文件夹与 `lv24-seo-desktop.exe` 放在一起，然后运行可执行文件。要删除便携版，请删除解压后的文件夹。

### Linux

Linux 构建仅提供 x64，基于 Ubuntu 22.04 构建，glibc 2.35 基线。较新的发行版通常可以运行；较旧的发行版可能不行。请使用与你下载的包对应的命令。

```bash
chmod +x ./*_amd64.AppImage
./*_amd64.AppImage
sudo apt install ./*_amd64.deb
sudo dnf install ./*_amd64.rpm
```

如果 AppImage 因缺少 FUSE 2 而无法启动，请用发行版的包管理器安装 `libfuse2`，或改用 deb/rpm 包。

### macOS

Apple 芯片使用 `aarch64` DMG，Intel 使用 `x64` DMG。打开 DMG，将 **LV24 SEO Optimizer** 拖到 **Applications**，然后通过 **System Settings → Privacy & Security → Open Anyway** 批准首次启动，或右键点击应用并选择 **Open**。该构建为 ad-hoc 签名，未公证。自动更新使用与架构匹配的已签名 `.app.tar.gz`。

### 从桌面 0.1.0 升级

`0.1.0` 是仅限 Windows 的预览，没有更新器、端点或公钥。请手动安装一次 `0.2.2`（NSIS 安装程序或便携 ZIP）。从 `0.2.0` 起，只有 Windows NSIS、macOS `.app` 和 Linux AppImage 可以自动更新。

## 未签名构建

操作系统包没有由付费证书颁发机构签名。Windows 没有 Authenticode 签名；macOS 为 ad-hoc 签名；Linux 的 AppImage、deb 和 rpm 未签名。SmartScreen、Gatekeeper 或杀毒软件可能警告或阻止运行。运行前请用 `SHA256SUMS.txt` 校验下载文件：

```bash
sha256sum -c SHA256SUMS.txt --ignore-missing
```

在 Windows 上，将 `Get-FileHash <file> -Algorithm SHA256` 的输出与 `SHA256SUMS.txt` 中对应行比较。更新器签名与操作系统代码签名是分开的：它证明更新来自本项目的发布密钥，并不表示操作系统信任该包。不要全局禁用 Gatekeeper 或 SmartScreen。

## 卸载

```bash
uv tool uninstall lv24-seo
pipx uninstall lv24-seo
pip uninstall lv24-seo
```

使用与你的安装方式对应的命令。`npx` 不安装全局包，因此无需卸载。在 Windows 上，通过 **Settings → Apps → LV24 SEO Optimizer → Uninstall** 删除 NSIS 安装；便携文件夹请手动删除。在 Linux 上，用发行版的包管理器删除 deb/rpm。在 macOS 上，从 **Applications** 删除应用。

卸载工具不会删除你的项目。`seo.toml`、`data/`、SQLite 历史、报告和备份会保留在原处，直到你自行删除。

## 下一步

- [快速开始](/zh/start/) — 五分钟路径。
- [桌面应用](/zh/desktop/) — 功能、更新和限制。
- [配置参考](/zh/reference/config/) — 所有 `seo.toml` 键。
- [安全与隐私](/zh/security/) — token 存储和写操作门控。

Source: `_source/engine-README.md`, `_source/engine-cli.md`, `_source/engine-config.md`, `_source/desktop-README.md`, `_source/desktop-releases-0.2.2.md`, `_source/desktop-releases-0.2.0.md`.

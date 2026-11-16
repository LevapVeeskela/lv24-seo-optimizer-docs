---
title: 故障排查
description: 使用稳定错误码诊断认证、存储、抓取、报告、MCP、npm 启动器和桌面更新问题。
---

# 故障排查

先看 `error.code`，不要先看退出码：不同失败可能共享同一个状态，而且
`PROPERTY_NOT_FOUND` 没有专用退出码。每个 CLI 命令都接受 `--json`：

```json
{"ok": false, "error": {"code": "AUTH_REQUIRED", "message": "Google Search Console token is missing", "retryable": false, "next_action": "lv24-seo auth login --provider gsc"}, "meta": {"version": "0.5.2"}, "warnings": ["gsc: token missing"]}
```

MCP 工具以 `structuredContent` 返回同一信封，并在失败时设置 `isError: true`。桌面把
`ok=false` 映射为类型化 UI 错误。

## 首先检查

```bash
lv24-seo doctor --json
lv24-seo auth status --json
lv24-seo config show --json
# repeat the failing command with --json added
```

`doctor` 检查 Python、平台、配置路径、当前目录可写性、有效数据目录及其作用域，以及令牌
是否存在，不进行网络调用。它的顶层 `ok` 只取决于致命检查：Python、当前目录可写性，以及
配置文件或 `LV24_SEO_DATA_DIR` 声明数据目录时的该目录。其余内容查看 `checks[]`；
`meta.data_dir_declared` 说明数据目录是否属于契约的一部分。

常见退出码：`AUTH_REQUIRED` 和 `AUTH_INVALID`（3）、`PROPERTY_NOT_FOUND`（1）、
`QUOTA_EXCEEDED` 和 `UPSTREAM_UNAVAILABLE`（4）、`WRITE_DISABLED`（2）、
`CONFIRM_REQUIRED`（2）、`INVALID_INPUT` 和 `CONFIG_INVALID`（2）、`INTERNAL`（1）、
`STORE_LOCKED`、`STORE_CORRUPT` 和 `STORE_UNAVAILABLE`（1）。截断本身不是错误：截断的响应
退出 `0`，只有带 `--strict` 的命令在保持 `ok: true` 的同时退出 `5`。

## 缺少令牌和数据源认证

`AUTH_REQUIRED` 是本地问题：密钥存储没有找到该引擎的值。单引擎命令失败；聚合界面继续
运行并添加 `gsc: token missing` 之类的警告。

```bash
lv24-seo auth status
lv24-seo auth set --provider gsc
printf '%s' "$TOKEN" | lv24-seo auth set --provider gsc --stdin
```

`auth set` 接受 `gsc`、`yandex`、`metrika`、`bing`、`crux`、`psi`、`smtp` 和
`telegram`。Webmaster 令牌用 `auth set --provider yandex` 保存，Metrika 令牌用
`auth set --provider metrika` 或 `LV24_SEO_YANDEX_METRIKA_TOKEN`。
`auth login --provider gsc|yandex` 不打开浏览器，也不写任何内容；它只打印手动步骤。

401 表示令牌过期、被撤销、格式错误或来自错误账户——请替换。403 表示凭据有效但缺少
权限：修复属性或主机访问，而不是重新认证。对 Yandex，请把
`providers.yandex_webmaster.host_id` 与确切 id（`https:example.com:443`，不是 URL）
比较；未验证主机会表现为 403。

当前引擎没有 OAuth 刷新流程，也没有服务账号认证。`auth set --provider gsc` 保存一个
字符串并作为 `Authorization: Bearer` 发送；这是 Google access token，通常只有约一小
时寿命。每次运行前保存新的令牌。`auth status` 只报告 `present` 和来源（`env`、
`keyring`、`file`），绝不显示值。环境变量令牌是只读的：只要它存在，`auth set` 和
`auth logout` 就返回 `WRITE_DISABLED`。

## `data_dir` 与相对路径

`seo.toml` 中写入的相对 `storage.data_dir` 锚定到该文件所在目录。`init` 创建
`<config dir>/data` 并写入 `data_dir = "./data"`，因此 `--config /srv/site/seo.toml`
从任何工作目录都使用 `/srv/site/data`。路径通过 `os.path.abspath` 变为绝对路径
（展开 `~`、规范化 `..`）；符号链接有意不解析。

两种情况有意保持进程作用域：内置默认值（没有 `[storage]` 块）是相对于工作目录的 `data`，
而 `LV24_SEO_DATA_DIR` 覆盖文件，并把相对值解析为相对于工作目录。

`doctor --json` 让作用域可见：`meta.data_dir` 是有效目录，`meta.data_dir_source` 在路径
为绝对时是 `config`，为相对时是 `working directory`。存在配置文件时，相对目录会添加一条
指名配置目录的警告。`config show --json` 报告同一有效路径。设置绝对 `data_dir` 可固定数据库。

## 写令牌重放

带 `--confirm` 的写入应用在工作区已初始化时使用 SQLite 幂等账本。账本从所选工作区的数据目录
打开，因此 `--config /srv/site/seo.toml` 会把声明记录在 `/srv/site/data`，即使 shell 在别处。
重放同一令牌返回 `status: skipped` 和 `reason: duplicate`，提供商只被调用一次。试运行不打开
账本，也不创建数据库。没有数据目录时仍会应用，但信封会警告：在令牌五分钟有效期内没有重放
保护。崩溃留下的 pending 声明没有 TTL，会被视为进行中，直到操作员释放。

## 存储错误 `STORE_*`

SQLite 故障会被类型化，而不是表现为通用的 `INTERNAL`：

| 代码 | 原因 | 处理方式 |
|---|---|---|
| `STORE_LOCKED` | 另一个进程持有写锁超过 busy timeout | 等待另一个 `lv24-seo` 运行结束再重试；没有写入任何内容 |
| `STORE_CORRUPT` | 文件不是有效的 SQLite 数据库 | 查看 `detail.backup_path`，然后移动或删除数据库并重跑 |
| `STORE_UNAVAILABLE` | 权限、父目录缺失或磁盘已满 | 修复目录或释放空间，然后运行 `lv24-seo doctor` |

`STORE_CORRUPT` 会在做任何其他事情之前把不可用文件复制到自身旁边，名为
`seo.sqlite3.corrupt-20260101T101010Z`。原文件绝不会被移动或删除，复制失败也不会掩盖错误。
三个代码都没有专用退出状态；它们退出 `1`，因此请依据 `error.code`。归档副本后删除
`data/seo.sqlite3` 是安全的：会创建新的空数据库，写入账本也会重置。

## Sitemap `too_large`

Sitemap 发现对每个文档使用 50 MB 的响应体预算，包括 gzip 解压后的大小。普通页面保持
5 MB 上限。超过预算的文档报告为 `too_large`，而不是空 sitemap。协议上限是每个
sitemap 50,000 个 URL；索引遍历限制为 20 个文档、深度 2。

预算是响应体大小限制，不是时间限制：慢服务器仍可能先触发请求超时。把大 sitemap 拆成
多个文档，并用索引引用它们。提高抓取 URL 预算不会提高响应体预算。

## 抓取内存与 URL 预算

`crawl.max_urls` 默认为 500。CLI `--max-urls` 接受正整数；MCP `seo_crawl_site` 会把
超过 5,000 的值截断并给出警告。抓取是串行的，遵循 robots `Crawl-delay` 节奏；
`concurrency` 是保留设置，当前无效。

内存有界：页面响应体上限 5 MB，保留的页面文本上限 20,000 字符，请求预算为
`1 + max_urls * (max_redirects + 1)`。`word_count` 仍使用完整可见文本。如果抓取太大
或太慢，降低 `--max-urls` 并分段抓取。`0.5.3` 没有恢复或任务队列；桌面抓取超时为
600 秒，没有取消按钮。

## `--days` 限制

`stats` 和 `report weekly` 拒绝大于 3,660 的 `--days`，返回 `INVALID_INPUT` 和退出码
2。十年超过任何数据源的保留期。降低 `--days`，或用明确日期查询更长历史：

```bash
lv24-seo gsc query --start 2026-01-01 --end 2026-06-30 --json
```

GSC search analytics 延迟 2–3 天，Yandex queries 约 4 天，CrUX 是 28 天滚动 p75，
PSI 是当前 lab 运行。`--lag-days 2` 是报告默认值。

## 报告差异没有快照

`report diff` 需要同一属性的两个已存储周报快照。默认 base 是第二新周期，head 是最新
周期。常见错误：

| 消息 | 原因 |
|---|---|
| `report diff needs stored snapshots, but no store is configured` | 没有 `init`，或数据目录不同 |
| `need two stored weekly snapshots for <property>; found N` | 少于两个周期 |
| `no stored weekly snapshot for <label> period <period>` | 显式 `--base` 或 `--head` 不存在 |

运行一次 `init`，然后为不同周期运行两次 `report weekly`。`report diff` 只读，不调用
数据源。只存在于一个快照中的指标是未知，不是零；`comparable: false` 表示周期或 GSC
窗口不可比较。

## 安装 MCP 客户端

```bash
lv24-seo install --client claude
lv24-seo install --client opencode
lv24-seo install --client vscode
lv24-seo install --client cursor
lv24-seo install --client vscode --print
```

命令会合并宿主配置并打印改动。

| 症状 | 原因 | 修复 |
|---|---|---|
| 文件看起来有效，却提示 “not valid JSON” | UTF-8 BOM，常见于 PowerShell 5.1 | 重写为无 BOM，或删除文件后重试 |
| `No such command 'mcp'` | 旧构建没有 `mcp serve` | 升级到 0.5.3 |
| GUI 客户端无法启动服务器 | 应用不继承 shell 的 `PATH` | 在 `command` 中写绝对 `uvx` 路径 |
| VS Code 什么都不显示 | `install` 写入 `mcpServers`；VS Code 使用 `servers` | 重命名键或使用 VS Code 专用块 |

OpenCode 在 `opencode reload` 或重启会话前会保留旧工具；VS Code 升级后可能需要
**MCP: Reset Cached Tools**。

桌面不保存 MCP 条目；`lv24-seo install` 是 CLI 操作。如果显示合并后的宿主文档，只提取自己的条目，因为文档可能包含其他服务器的令牌。

## Windows 上的 npm `.cmd` 启动器

npm 包是薄启动器。它把参数转发给已安装的 `lv24-seo` 二进制，或
`uvx --from lv24-seo==<version> lv24-seo`。在 Windows 上，Node 无法用
`shell: false` 启动 `.cmd` shim；会以 `EINVAL` 失败。

0.5.3 忽略 `lv24-seo.cmd` 和 `.bat` shim，优先使用 `lv24-seo.exe` 或无扩展名二进制，
然后才回退到 `uvx`。如果启动器仍选错二进制，请设置绝对覆盖：

```bash
LV24_SEO_BIN=/absolute/path/to/lv24-seo npx @lv24/seo version --json
```

PowerShell 中先设置 `$env:LV24_SEO_BIN`。`LV24_SEO_PIN=0` 会恢复未固定的 `latest`
查找。启动器拒绝执行自己的 shim，因此 PATH 遮蔽不会递归。

## 桌面路径与更新错误

shell 报告自己的代码，绝不重用引擎代码。

| 代码 | 含义 | 处理方式 |
|---|---|---|
| `INVALID_PATH` | 路径不是绝对路径、不是 `.toml`、父目录不存在，或指向 UNC/设备路径（`detail.reason: network_or_device_path`） | 选择父目录存在的本地 `.toml` |
| `PATH_NOT_ALLOWED` | 路径被保留、超出批准根目录、扩展名不允许，或不是活动项目配置 | 使用应用自己的目录和 Settings 中选择的配置 |
| `PATH_NOT_APPROVED` | 配置路径未经原生对话框设置 | 通过 **Choose config** 选择文件；只有对话框选中的路径才能成为活动路径 |
| `PATH_TIMEOUT` | 辅助任务未在预算内完成 | 重试；若重复出现，检查引擎和文件大小 |
| `UPDATE_IN_PROGRESS` | 已有另一个安装在进行 | 等待其完成 |
| `UPDATE_NOT_AVAILABLE` | 公告的发布在安装前消失 | 点击 **Check for updates** |
| `UPDATE_VERSION_MISMATCH` | 发布在检查与安装之间发生变化 | 再次检查并安装新公告的版本 |
| `UPDATE_CANCELLED` | 下载在安装器启动前被取消 | 预期行为；重新开始安装 |
| `UPDATE_UNAVAILABLE` | 此构建未配置更新器 | 保持当前版本，或从发行页面下载 |

`UPDATE_ENGINE_BUSY` 是另一回事：受跟踪的 sidecar 无法停止，待其退出后安装可重试。

## 桌面引擎离线或版本门禁

外壳按以下顺序解析引擎：`LV24_SEO_BIN`（仅绝对路径）、内置 `engine/lv24-seo/`、扁平
`lv24-seo/`、同级 `lv24-seo/`，最后仅当 `LV24_SEO_ALLOW_PATH_ENGINE=1` 时使用
`PATH`。它运行 `lv24-seo version --json`，并与 `MIN_ENGINE_VERSION` 比较；当前源码中
该值为 `0.5.2`。

旧引擎标记为 `compatible: false`；UI 将其视为离线，不运行命令。不会自动下载任何内容。

| 症状 | 修复 |
|---|---|
| 找不到引擎 | 重新安装，或把 `LV24_SEO_BIN` 设为绝对可执行路径 |
| 引擎太旧 | 安装 0.5.2 或更新版本 |
| 显示 external engine | 设置 `LV24_SEO_BIN` 时属正常 |

除非设置 `LV24_SEO_ALLOW_PATH_ENGINE=1`，否则 `PATH` 中偶然出现的 `lv24-seo` 会被
忽略。

## Portable、deb 和 rpm 无法自动更新

自动更新仅适用于 Windows NSIS、macOS `.app` 和 Linux AppImage。deb、rpm、MSI 和
portable ZIP 只能手动更新：它们无法安全替换正在运行的安装。Settings 面板会禁用应用内
安装器并链接到发布页。

| 包类型 | 更新方式 |
|---|---|
| Windows NSIS | 应用内签名更新 |
| Windows portable ZIP | 下载并解压新 ZIP |
| Linux AppImage | 应用内签名更新 |
| Linux deb 或 rpm | 用包管理器升级 |

portable 构建根据 `sibling` 或 `bundled-flat` 引擎来源识别，因此把 `lv24-seo/` 放在
可执行文件旁也会让更新器保持手动模式。

## 更新器签名失败

签名失败是安全阻断，不是临时网络错误。更新器将其标记为不可重试，阻止该产物并指向
发布页。不要禁用 `requireSignedVersion`，也不要重试同一产物。

手动下载发布包，用 `SHA256SUMS.txt` 校验后安装。更新器签名认证的是更新，不是第一次
手动下载。签名错误可能意味着下载损坏、清单与包不匹配或密钥轮换。请报告，不要绕过。

## Linux 钥匙串与 DBus

只有安装 `secrets` extra 时，引擎才使用系统钥匙串。桌面 sidecar 捆绑了 keyring
后端。Linux 上 Secret Service 需要会话总线；桌面 CLI 运行器继承
`DBUS_SESSION_BUS_ADDRESS`、`XDG_RUNTIME_DIR`、XDG 目录和 `TMPDIR`，同时过滤其他
宿主变量。

| 症状 | 修复 |
|---|---|
| 钥匙串拒绝写入 | 解锁它，或设置 `LV24_SEO_ALLOW_FILE_SECRETS=1` 使用 0600 文件回退 |
| 没有可写密钥后端 | 安装 `lv24-seo[secrets]` 或启用文件回退 |
| 无会话总线的 headless 主机 | 使用 `LV24_SEO_*` 环境令牌 |

回退文件是 `data/secrets.json`，POSIX 模式 `0600`。Windows 使用 ACL。桌面显示当前
来源，并说明删除文件密钥不会删除环境变量。

## macOS Gatekeeper 与 Windows SmartScreen

macOS 构建仅 ad-hoc 签名，未公证。Gatekeeper 首次启动会警告。使用
**System Settings → Privacy & Security → Open Anyway**，或右键应用选择 **Open**。
不要全局关闭 Gatekeeper。

Windows 构建没有 Authenticode 签名。SmartScreen、Smart App Control 或杀毒软件可能
警告或阻止安装器或 portable 可执行文件。只有在用 `SHA256SUMS.txt` 校验 SHA-256 后，
才选择 **More info → Run anyway**。不要全局关闭这些保护。如果环境要求签名构建，请从
源码构建并用你自己的证书签名。

## 更新器显示 `UPDATE_ENGINE_BUSY`

引擎 sidecar 位于已安装的资源目录中。应用内更新前，外壳只停止它登记的 sidecar PID；从
终端或另一个应用副本启动的引擎不会被杀死。如果该进程占用已安装文件，安装会被
`UPDATE_ENGINE_BUSY` 阻止。

关闭占用 `lv24-seo` 的终端或应用运行，等待其退出，然后再次点击 **Download and install**。
该错误可重试；不要删除已安装资源目录中的文件。

## 日志与诊断

日志是可选项。`LV24_SEO_LOG_LEVEL=INFO`（或 `DEBUG`、`WARNING` 等）会让 CLI 和
`lv24-seo mcp serve` 安装脱敏处理器。未设置变量时不会改变调用方的日志配置；导入库或调用
`create_server()` 绝不替换根处理器。当 stderr 不是终端（管道、调度器日志、MCP 宿主）时，
每条记录输出一行 JSON；否则输出普通行。MCP 传输只写 stderr；stdout 保持协议输出。稳定的
诊断接口仍是 `--json` 信封，而不是日志文件。

桌面有日志目录、数据目录和导出目录。确切路径由 `shell_status` 报告，并显示在
Configuration 屏幕；不要根据包标识符猜测。诊断包由用户触发，包含版本、路径、doctor
检查、脱敏后的有效配置、环境变量名称和最近的非密钥任务错误。它从不上传。

发布信封前，删除令牌、cookie、`Authorization` 头、`LV24_SEO_WRITE_SECRET`、`.env`
内容、`data/secrets.json`、服务账号 JSON 和客户查询。CLI 输入校验可能回显你传入的
值，URL 查询可能包含 `key=`、`token=` 或 `signature=`。

```text
lv24-seo version:
OS / Python:
command:
expected:
actual (redacted --json envelope):
```

安全问题请通过 `SECURITY.md` 中的私有 advisory 报告，不要开公开 issue。

写入门禁见[安全与隐私](/zh/security/)，更新器行为见[发布与更新](/zh/release/)。

Source: `_source/engine-troubleshooting.md`, `_source/engine-releases-0.5.2.md`, `_source/engine-releases-0.5.3.md`, `_source/desktop-releases-0.2.2.md`, `_source/desktop-releases-0.2.3.md`, `_source/desktop-releases-0.2.1.md`, `_source/desktop-releases-0.2.0.md`, `_source/desktop-security.md`, `_source/desktop-architecture.md`.

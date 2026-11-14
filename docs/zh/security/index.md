---
title: 安全与隐私
description: LV24 SEO Optimizer 的威胁模型、密钥处理、写入门禁、SSRF 防护、桌面外壳边界与更新信任。
---

# 安全与隐私

LV24 SEO Optimizer 以本地为先。引擎（`lv24-seo 0.5.2`）负责数据源、抓取、存储和报告；
桌面应用（`0.2.2`）只是引擎之上的界面和进程外壳，不重新实现数据源客户端，也不代理
数据源流量。

本页区分两个产品和两种签名：

- **引擎**默认只读，并对每次数据源写入设置门禁；
- **桌面外壳**执行 argv、路径和环境边界；
- **操作系统安装包**默认未签名（Windows、Linux）或仅 ad-hoc 签名（macOS）；
- **更新包**由 minisign 签名，这是另一个信任锚。

## 信任模型

| 组件 | 信任级别 | 执行的边界 |
|---|---|---|
| 引擎 | 受信任：执行数据源语义和写入门禁 | 以用户身份运行；只写入配置的路径 |
| 桌面 webview | 不受信任的输入 | 固定的 Tauri 命令表、参数校验 |
| Rust 外壳 | 授权边界 | argv 数组、路径允许列表、环境过滤 |
| 数据源响应 | 不受信任的数据 | 解析、限长、显示前转义 |
| 更新通道 | 由内置密钥认证 | HTTPS 加 minisign 签名 |

本地数据留在本地：查询、URL、流量、快照和报告都保存在配置的存储中。网络只用于用户
请求的数据源调用、站点抓取、显式启用的 SMTP/Telegram 投递，以及桌面端请求
`latest.json` 和用户选择下载的更新包。LV24 没有遥测端点。

不在范围内：被攻陷的操作系统或钥匙串、用户通过 `LV24_SEO_BIN` 故意运行恶意引擎，
以及数据源侧的泄露。

## 密钥

引擎按以下顺序解析密钥：

1. `LV24_SEO_*` 环境变量；
2. 可选的系统钥匙串；
3. `data/secrets.json`，仅在设置 `LV24_SEO_ALLOW_FILE_SECRETS=1` 时使用。

要使用系统钥匙串，请安装 `lv24-seo[secrets]`。在 POSIX 上文件回退以 `0600` 模式
创建；Windows 依赖目录和文件 ACL，因为 POSIX 权限位在那里无法生效。

没有令牌命令行参数。`auth set` 读取隐藏提示或 stdin：

```bash
lv24-seo auth status --json
printf '%s' "$TOKEN" | lv24-seo auth set --provider gsc --stdin
```

`auth status` 只显示 `present`、来源（`env`、`keyring`、`file`、`missing`）和已知的
过期时间，绝不显示值。环境变量中的令牌是只读的：只要它存在，`auth set` 和
`auth logout` 就返回 `WRITE_DISABLED`。桌面应用显示同一来源，说明删除文件密钥不会
删除环境变量，并且不提供无法生效的删除操作。`auth logout` 返回 `deleted: false` 时会
如实显示为“没有删除任何内容”，而不是成功。

桌面应用和 CLI 为每个数据源使用同一条系统钥匙串记录：服务名 `lv24-seo`，用户名为
`gsc_token`、`psi_api_key` 等。终端中输入的 token 会立即出现在桌面应用的 `auth status`，
桌面应用中输入的 token 也对 CLI 可见；webview 或应用数据目录中没有第二份副本。
`LV24_SEO_*` 环境变量由桌面应用的 CLI 运行器继承。只有使用同一 workspace/data 目录时，
显式启用的 `<data-dir>/secrets.json` 回退文件才共享。

密钥不得出现在 `seo.toml`、版本控制、报告或测试夹具中。脱敏格式化器会掩码敏感键、
已知令牌前缀和 32 字符以上的不透明串，但只有在设置 `LV24_SEO_LOG_LEVEL` 时才安装。
CLI 回调和 `lv24-seo mcp serve` 是唯一安装它的进程入口；导入库、`create_server()`、
`SeoService` 或提供商客户端绝不替换调用方的根处理器。当 stderr 不是终端（管道、调度器
日志、MCP 宿主）时，每条记录输出一行 JSON；否则输出普通行。MCP 传输只写 stderr；
stdout 保持协议输出。脱敏是纵深防御，调用方仍不得记录原始凭据。`config show` 把看起来
像密钥的键掩码为 `***`，桌面应用不得“还原”它。

桌面应用不在 webview 中保存密钥。令牌输入是密码字段，值只通过 IPC 发送一次，并立即
传给 `lv24-seo auth set --provider <p> --stdin`。子进程退出后 Rust 层会清零缓冲区。
值不会写入日志、MobX store、localStorage、剪贴板、崩溃报告或支持包。Linux 上 CLI
运行器继承 Secret Service 需要的会话总线和 XDG 变量，其他宿主变量仍被过滤；值本身
仍然只通过 stdin 传输。

## 默认只读

数据源读取无需写入标志即可安全运行。数据源变更通过 `core/write_gate.py`：

1. **计划** — dry run 显示目标、动作和完整计划哈希，然后返回短期的
   `confirm_token`。
2. **确认** — 调用方审阅计划，并用 `--allow-write` 和该令牌重新运行。
3. **占位** — 存储在幂等账本中把槽位标记为 `pending`。
4. **应用** — 调用数据源；成功把占位提升为 `sent`，数据源异常则释放占位。

令牌是对动作、目标、完整计划哈希和过期时间的 HMAC，有效期 300 秒。修改 URL、主机、
密钥、属性或摘要都会使其失效。写入调用从不自动重试。工作区初始化后，CLI 会附加
SQLite 幂等账本，因此重放同一令牌返回 `status: skipped` 和 `reason: duplicate`，
提供商只被调用一次。没有数据目录时仍会应用，但信封会警告：在令牌五分钟有效期内没有
重放保护。试运行不打开账本，也不创建数据库。

| 动作 | 当前构建中的状态 |
|---|---|
| IndexNow 提交 | 已接通；需要 `--allow-write`、确认令牌和 `LV24_SEO_WRITE_SECRET` |
| GSC sitemap 提交 | `WRITE_DISABLED` — 适配器未接通 |
| Yandex recrawl | `WRITE_DISABLED` — 适配器未接通 |
| MCP 写入工具 | 即使 `allow_write=true` 也返回 `WRITE_DISABLED`；尚无确认令牌路径 |

当前构建中只有 CLI 能执行数据源写入，且只有 IndexNow 会到达数据源。MCP 写入工具
（`seo_recrawl_request`、`seo_sitemap_submit`）带有 `destructiveHint: true`，但仍返回
`WRITE_DISABLED`。

本地状态工具不同。`seo_crawl_site` 和 `seo_weekly_report` 会保存抓取和周报快照，因此
标记为 `writes_local_state: true` 和 `readOnlyHint: false`。它们不改变数据源状态，也
不需要确认令牌。

## MCP 注解

注解描述意图，不是授权机制。注册表根据工具契约生成它们：

| 工具 | 类型 | `writes_local_state` | `readOnlyHint` | `destructiveHint` |
|---|---|---|---|---|
| `seo_crawl_site` | read | `true` | `false` | `false` |
| `seo_weekly_report` | read | `true` | `false` | `false` |
| `seo_recrawl_request` | write | `false` | `false` | `true` |
| `seo_sitemap_submit` | write | `false` | `false` | `true` |
| 其余七个 | read | `false` | `true` | `false` |

依赖 `readOnlyHint` 的客户端可能会在抓取或周报前请求确认。这是有意的：两者都会写入
本地状态。客户端不得把只读注解当作跳过自身确认的依据，尤其是对受门禁的写入。

## 网络与 SSRF 防护

默认抓取器会解析每个请求的 URL——种子和每次重定向——并拒绝私有、回环、链路本地、
多播、保留和未指定地址，包括云元数据地址 `169.254.169.254`。拒绝是类型化的
`blocked_private` 结果，不是异常。本地站点审计只能由设置 `allow_private` 的嵌入方
启用私有目标；没有对应的 CLI 标志。

默认传输连接到已验证的 IP，同时保留原始 HTTP `Host` 和 TLS SNI，因此连接建立时不会
再次把主机名解析到不同地址。自定义注入传输是受信任的测试/嵌入边界，必须自行执行地址
策略。重定向手动跟随，因此每一跳都会被校验；HTTPS→HTTP 降级会记录为覆盖说明。

抓取编排在跟随目标前检查 robots 和源站范围。robots 的网络错误和 5xx 会推迟抓取；
robots 是礼貌信号，不是访问控制。数据源 HTTP 错误只包含主机和路径：查询字符串可能
携带密钥，请求头可能携带 bearer 令牌，两者都不会进入错误消息。

SMTP STARTTLS 在登录前验证证书。Telegram 发送纯文本，并把 HTTP/Bot API 错误视为失败。
投递是 at-least-once，不是 exactly-once：远程接受后、账本写入前崩溃，重试可能重复
消息。HTTP 限流是进程内的，不能保证跨 CLI 或 MCP 进程的账户级每日配额。

## 数据处理与注入

SQLite 保存在本地并被 git 忽略。`seo.toml` 中写入的相对 `storage.data_dir` 锚定到该
文件所在目录，因此同一配置从任何工作目录都使用同一数据库；内置默认值和
`LV24_SEO_DATA_DIR` 仍保持进程作用域。`doctor --json` 报告 `meta.data_dir` 和
`meta.data_dir_source`。模式变更以编号迁移发布并记录在 `schema_migrations`；
升级不会删除用户行。升级前请备份数据库。时间粒度未知的旧行会保留并标记，不会被静默
转换。

仓库 SQL 使用绑定参数，不做字符串插值。多维指标键编码为 JSON，因此包含 `|` 的值不会
冲突。报告 HTML 转义每个动态值，不使用外部图片、样式表、脚本或跟踪像素。桌面应用不把
报告 HTML 嵌入 webview：`open_path` 校验绝对路径、要求它位于批准的根目录下，并在交给
操作系统处理器前执行扩展名允许列表。

## 桌面外壳边界

webview 只能调用固定的命令表，参数经过校验。它不能传入可执行文件、shell 字符串、原始
环境映射或批准根目录之外的路径。所有引擎调用都使用 argv 数组、绝对规范化
`--config`、`--json`、有界超时和 `cwd = config parent`。超时只终止确切的子进程句柄或
PID；没有通配符进程清理，因为多个 LV24 应用可以同时运行。

子进程环境会被过滤。继承的名称包括平台基础变量（`PATH`、`SYSTEMROOT`、`HOME`、
`APPDATA`、代理和 CA 变量）、Linux Secret Service 变量
（`DBUS_SESSION_BUS_ADDRESS`、`XDG_RUNTIME_DIR`、`XDG_CONFIG_HOME`、`XDG_DATA_HOME`、
`XDG_CACHE_HOME`、`TMPDIR`）以及所有 `LV24_SEO_*` 名称。其他宿主变量被丢弃。

配置和设置写入持久且私密：构建 `toml_edit` 补丁，在目标旁写 `0600` 临时文件并 fsync，用
`lv24-seo config show` 校验，创建 `0600` 时间戳备份（保留最近五个）并 fsync，重命名，
然后 fsync 父目录并重新读取脱敏后的有效配置。校验失败会保持原内容和 mtime 不变。
读取上限为 8 MiB，并拒绝非普通文件或超大文件。设置按字段加载，因此一个损坏值不会丢弃
其余设置。过期的已保存配置路径会被容忍并报告为缺失。Windows 保留设备名和结尾点/空格
在每个路径组件中都会被拒绝。没有原始编辑器；编辑通过已验证的 Settings 表单和字段级
补丁完成。

工作区、报告、doctor 和密钥状态会在工作区变化或引擎离线时清除，因此不会在新工作区显示
上一个项目的数据。无法执行的操作会被禁用，而不是点击后失败。en/ru/zh 消息目录保持一致；
缺少键是测试失败。

生产 webview CSP 不允许远程脚本、样式、字体、图片或连接目标；它允许自有资源、内联样式、asset:/data: 图片和 IPC。`withGlobalTauri` 为 false，UI 使用类型化 API 导入。`0.2.2` 没有本地 HTTP API；未来版本需要自己的认证和回环绑定。

## 更新信任

更新包使用免费的 Ed25519/minisign 密钥，与操作系统代码签名分开。更新端点是
`src-tauri/tauri.conf.json` 中配置的 HTTPS GitHub Releases URL；公钥也内嵌在那里。私钥是仓库密钥，只传给构建步骤。启用了
`requireSignedVersion`，因此公告版本绑定到已签名包。HTTPS 保护传输；签名是信任锚。

更新器只接受高于当前版本的版本，因此不能降级。它从不自行下载或安装：用户点击
**Download and install**，未保存的配置草稿会禁用按钮。签名失败会阻止该产物，把错误
标记为不可重试并指向发布页；它绝不会降级为离线警告或自动重试。

安装器启动前，外壳只停止**本应用实例登记的**引擎 sidecar PID。Sidecar 位于已安装的
资源目录中，运行中的进程会锁定它并破坏 NSIS 更新。只停止确切跟踪的 PID；不会按映像
名称匹配，因此另一个已安装副本、便携构建或终端运行不会被触碰。清理失败会以
`UPDATE_ENGINE_BUSY` 阻止安装，而不是启动一个会在中途失败的安装器。

自动更新仅适用于 Windows NSIS、macOS `.app` 和 Linux AppImage。deb、rpm、MSI 和
portable ZIP 只能手动更新：UI 禁用应用内安装器并链接到发布页。`0.1.0` 没有更新器、
端点和公钥，因此其用户需要手动安装一次 `0.2.2`。

操作系统包签名是另一回事。默认情况下，Windows 构建没有 Authenticode 签名，macOS 仅 ad-hoc 签名，
Linux 包未签名。更新器签名不会让操作系统包对 SmartScreen、Gatekeeper 或发行版策略
变得可信。

## 供应链

依赖由 `package-lock.json`、`Cargo.lock` 以及 `scripts/cli-checksums.json` 中的
引擎/PyInstaller 固定版本锁定。引擎 CI action 按 SHA 固定；桌面工作流 action 按版本固定。下载的发布工具有校验和，评审时
运行密钥扫描。发布产物在发布前计算校验和；`SHA256SUMS.txt` 覆盖每个已发布文件，
包括更新器签名和 `latest.json`。

sidecar 是 PyInstaller **onedir** 树，不是 onefile。`scripts/verify-sidecar.mjs`
检查可执行文件和确切的引擎版本。校验和策略感知重建：经过评审的本地构建有严格的
SHA-256 固定值，而 CI 把不可复现重建的实际哈希记录到
`sidecar-checksums-<target>.json`。这些报告是 CI 证据，不是发布产物。`null` 固定值
表示“尚未评审”，不是“已验证”。

发布工作流是手动且由所有者把关的，没有 push、pull-request 或 tag 触发器。它只使用
标准 GitHub 托管运行器和免费分钟数。项目不购买代码签名证书、notarization 或付费
运行器。

## 报告漏洞

请在受影响的仓库使用私有 GitHub security advisory。不要用凭据、客户查询或利用细节
开公开 issue。每个仓库的 `SECURITY.md` 是联系方式和受支持版本策略的权威来源。

请包含产品（引擎或桌面）、确切版本、操作系统、安装方式和最小复现。发送前删除令牌、
cookie、`Authorization` 头、`LV24_SEO_WRITE_SECRET`、`.env` 内容、`data/secrets.json`
和服务账号 JSON。已暴露的密钥应轮换，而不仅仅是从最新提交中删除。

信任边界见[架构](/zh/architecture/)，已签名更新的矩阵见[发布与更新](/zh/release/)。

Source: `_source/engine-security.md`, `_source/desktop-security.md`, `_source/engine-architecture.md`, `_source/desktop-architecture.md`, `_source/engine-releases-0.5.2.md`, `_source/desktop-releases-0.2.2.md`.

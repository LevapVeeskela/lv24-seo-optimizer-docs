---
title: 配置参考
description: seo.toml 的位置与优先级、所有键及默认值，以及密钥、时区和语言的处理方式。
---

# 配置参考

一个 `seo.toml` 描述一个项目：站点身份、要读取的提供方目标、抓取限制、报告设置和本地存储。
模式是严格的，因此拼错的键会校验失败，而不是静默关闭某个设置。缺少配置文件不算错误；默认值
描述的是一个可运行的只读工具。

## 位置与优先级

值的优先级从低到高：内置默认值、选中的 `seo.toml`、`LV24_SEO_*` 环境变量。`--config PATH` 只负责
选择文件；引擎先取显式路径（它必须存在，否则返回 `CONFIG_INVALID`），再取 `./seo.toml`，最后取
平台用户配置：Windows 为 `%APPDATA%\lv24-seo\config.toml`，Linux 为
`~/.config/lv24-seo/config.toml`，macOS 为 platformdirs 对应的位置。

`.env` 文件不会自动加载。请在 shell、服务单元或运行命令的调度器环境中导出变量。

### 环境变量

| 变量 | 键 |
|---|---|
| `LV24_SEO_DATA_DIR` | `storage.data_dir` |
| `LV24_SEO_GSC_PROPERTY` | `providers.gsc.property` |
| `LV24_SEO_YANDEX_HOST_ID` | `providers.yandex_webmaster.host_id` |
| `LV24_SEO_YANDEX_METRIKA_COUNTER` | `providers.yandex_metrika.counter` |
| `LV24_SEO_REPORT_LOCALE` | `report.locale` |
| `LV24_SEO_REPORT_TIMEZONE` | `report.timezone` |
| `LV24_SEO_SMTP_HOST` | `report.email.smtp_host` |
| `LV24_SEO_SMTP_PORT` | `report.email.smtp_port` |
| `LV24_SEO_SMTP_USER` | `report.email.smtp_user` |
| `LV24_SEO_SMTP_FROM` | `report.email.from` |
| `LV24_SEO_MAIL_TO` | `report.email.to`（逗号分隔列表） |
| `LV24_SEO_TELEGRAM_CHAT_ID` | `report.telegram.chat_id` |

不支持的 `LV24_SEO_*` 变量会被忽略，以保持向前兼容。密钥变量列在[密钥](#密钥)一节；它们由密钥
存储解析，而不是由这个配置模型处理。

`LV24_SEO_LOG_LEVEL` 不是配置键。设置为 `DEBUG`、`INFO`、`WARNING` 等可启用脱敏日志。CLI
和 `lv24-seo mcp serve` 会安装处理器；未设置变量时不会改变调用方的日志配置。当 stderr 不是
终端（管道、调度器日志、MCP 宿主）时，每条记录输出一行 JSON；否则输出普通行。

## 键参考

下面的每个键都是可选的。缺少某个提供方块表示“未配置”，不是失败。

### `[project]`

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `name` | string | `""` | 工作区的可读名称。 |
| `base_url` | string | `""` | 省略 `--start` 时 `crawl` 的默认起始 URL。 |
| `default_property` | string | `""` | `init` 建议、`properties` 显示的 GSC 资源。GSC 查询使用 `providers.gsc.property`。 |

### `[providers.gsc]`

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `property` | string | `""` | `sc-domain:example.com` 或 `https://example.com/`。 |
| `auth` | string | `"keychain"` | 保留标签。会被接受但被忽略：凭据依次从环境、系统钥匙串、显式启用的文件后备中解析。 |

### `[providers.yandex_webmaster]`

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `host_id` | string | `""` | 精确的 Yandex 主机 ID，例如 `https:example.com:443`。不要猜测；请从 Webmaster API 或界面读取。 |

### `[providers.yandex_metrika]`

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `counter` | string | `""` | Metrika 计数器 ID。TOML 中不带引号的整数会被规范化为字符串。 |
| `goals` | 整数列表 | `[]` | 视为转化的目标 ID。 |

### `[providers.bing]`

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `site` | string | `""` | 在 Bing Webmaster Tools 中注册的站点 URL。 |
| `indexnow_key` | string | `""` | 公开的 IndexNow 密钥兼密钥文件名；可以安全地保存在 `seo.toml` 中。 |
| `indexnow_key_location` | string | `""` | 托管的密钥文件的绝对 URL（可选）；默认为 `https://<host>/<key>.txt`。 |

### `[providers.crux]`

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `origin` | string | `""` | 查询实测数据的 origin，例如 `https://example.com`。 |

### `[providers.psi]`

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `strategy` | `mobile` 或 `desktop` | `"mobile"` | Lighthouse 策略。 |
| `urls` | 字符串列表 | `[]` | PageSpeed Insights 检查的页面。最多检查五个；实验室评分来自第一个 URL。 |

当前严格模式中没有 `providers.ga4` 块。添加它会导致校验失败；GA4 被记录为可选的未来数据源，
而不是当前可配置的提供方。

### `[crawl]`

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `max_urls` | 整数 ≥ 1 | `500` | 单次抓取的 URL 预算。 |
| `concurrency` | 整数 ≥ 1 | `4` | 保留。抓取器目前是串行的，因此该键没有效果。 |
| `respect_robots` | boolean | `true` | 遵守 `robots.txt` 和 `Crawl-delay`。 |
| `user_agent` | string | `"lv24-seo/0.1"` | 抓取器发送的 User-Agent。 |

### `[report]`

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `locale` | `ru`、`en` 或 `zh` | `"ru"` | 面向人的渲染输出语言。仅影响呈现。 |
| `timezone` | IANA 时区名 | `"Europe/Minsk"` | 用于报告和 `stats` 窗口、MCP 默认窗口以及本地日期边界。 |
| `week_start` | `monday` 或 `sunday` | `"monday"` | 保留。周窗口按天计算，因此目前没有效果。 |
| `thresholds` | 内联表 | 见下文 | 报告和 `only_on_change` 闸门使用的变化阈值。 |

`thresholds` 接受 `clicks_pct`（默认 `10.0`）、`impressions_pct`（默认 `15.0`）和 `position_abs`
（默认 `1.5`）。

### `[report.email]` 与 `[report.telegram]`（投递）

没有单独的 `[delivery]` 表。投递配置在两个渠道块上，且默认都关闭。

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `email.enabled` | boolean | `false` | 通过电子邮件投递周报。 |
| `email.to` | 字符串列表 | `[]` | 收件人。 |
| `email.from` | string | `""` | 信封发件人。 |
| `email.only_on_change` | boolean | `true` | 周期内没有实质变化时跳过发送。 |
| `email.smtp_host` | string | `""` | SMTP 主机。 |
| `email.smtp_port` | 整数 1–65535 | `587` | SMTP 端口。 |
| `email.smtp_user` | string | `""` | SMTP 用户。密码来自密钥存储。 |
| `telegram.enabled` | boolean | `false` | 将周报投递到 Telegram。 |
| `telegram.chat_id` | string | `""` | 目标聊天 ID。 |
| `telegram.severity` | `critical` 或 `all` | `"critical"` | 哪些发现会触发 Telegram 消息。 |

没有 `report.email.locale` 或 `report.telegram.locale` 键。只需设置一次 `report.locale`；它是所有
渲染界面的唯一事实来源。

### `[storage]`

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `data_dir` | 路径 | `"data"` | 存放 `seo.sqlite3` 和引擎状态的本地目录。文件中写入的相对值相对于配置目录解析；内置默认值相对于工作目录。`LV24_SEO_DATA_DIR` 覆盖文件并保持进程作用域。 |
| `raw_retention_days` | 整数 ≥ 0 | `90` | 保留。不会写入原始归档，因此清理是记录日志的空操作。 |

### `[indexing]`

配额感知的提交与索引检查自动化默认关闭。`lv24-seo indexing run --allow-write` 需要
`enabled = true` 才会应用任何内容；否则运行只是只读计划。`providers` 选择参与的数据源；未配置的
数据源报告为 `not_configured`，绝不猜测。

| 键 | 默认值 | 含义 |
|---|---|---|
| `enabled` | `false` | 显式允许向数据源提交。 |
| `providers` | `["bing", "yandex", "gsc", "indexnow"]` | `--provider all` 包含的数据源。 |
| `max_submit_per_run` | `500` | 单次运行的全局提交上限。 |
| `max_inspect_per_run` | `20` | 每次运行的 GSC URL Inspection / Bing `GetUrlInfo` 检查数。 |
| `stale_days` | `7` | `indexing status` 将早于此的状态标为 `stale`。 |
| `check_interval_days` | `7` | 重新检查频率；同时设置 `next_check_at`。 |
| `gsc_inspect_daily_limit` | `2000` | 本地 UTC 日上限（GSC 不暴露剩余量）。 |
| `indexnow_daily_limit` | `1000` | IndexNow 提交的本地 UTC 日上限。 |

引擎在运行时仍执行数据源上限：Bing 每日/每月剩余配额、Yandex `quota_remainder`、每批 500 个 Bing
URL 和每个 Yandex 请求一个 URL。计划的 `lv24-seo indexing run --allow-write` 还需要调度器环境中的
`LV24_SEO_WRITE_SECRET`；参见[自动化与投递](/zh/automation/)。

## 数据目录

`storage.data_dir` 有三种作用域：

| 值 | 相对于什么解析 |
|---|---|
| `seo.toml` 中写入的相对值（`data_dir = "./data"`） | 配置文件所在目录 |
| 内置默认值（没有 `[storage]` 块） | 进程工作目录 |
| `LV24_SEO_DATA_DIR` | 按给定值使用；相对值相对于进程工作目录解析。环境始终优先于文件 |

固定相对目录的配置是自包含的：`--config /srv/site/seo.toml` 从任何工作目录都使用
`/srv/site/data`。`lv24-seo init` 创建 `<config dir>/data` 并写入 `data_dir = "./data"`。
路径通过 `os.path.abspath` 变为绝对路径（展开 `~`、规范化 `..`）；符号链接有意不解析，
因此通过链接访问的配置会把 data-dir 锚定在链接旁。SQLite 存储为 `<data_dir>/seo.sqlite3`。

`lv24-seo doctor --json` 让作用域可见：`meta.data_dir` 是有效目录，`meta.data_dir_source`
在路径为绝对（由文件或绝对 `LV24_SEO_DATA_DIR` 固定）时是 `config`，为相对时是
`working directory`。存在配置文件时，相对目录会添加一条指名配置目录的警告。
`config show --json` 报告同一有效路径。设置绝对路径可固定数据库。

显式启用的 `<data_dir>/secrets.json` 回退遵循同一目录；桌面端和 CLI 只有在解析到同一 data-dir
时才共享它。

## 密钥

密钥不应出现在 `seo.toml`、日志、报告或测试夹具中。解析顺序是环境、系统钥匙串、显式启用的文件
后备。

| 来源 | 用法 |
|---|---|
| 系统钥匙串 | `lv24-seo auth set --provider <name> --stdin`。需要可选的 `secrets` extra（`pip install "lv24-seo[secrets]"`）。 |
| 环境 | 导出下表中的提供方变量。环境值只读，并且始终优先。 |
| 文件后备 | 设置 `LV24_SEO_ALLOW_FILE_SECRETS=1`，并将 `data/secrets.json` 以 `0600` 权限保存。Windows 上依赖目录和文件 ACL。每次运行都会打印警告。 |

| 提供方 | `auth set --provider` | 环境变量 |
|---|---|---|
| Google Search Console | `gsc` | `LV24_SEO_GSC_TOKEN` |
| Yandex Webmaster | `yandex` | `LV24_SEO_YANDEX_WEBMASTER_TOKEN` |
| Yandex Metrika | `metrika` | `LV24_SEO_YANDEX_METRIKA_TOKEN` |
| Bing Webmaster | `bing` | `LV24_SEO_BING_API_KEY` |
| Chrome UX Report | `crux` | `LV24_SEO_CRUX_API_KEY` |
| PageSpeed Insights | `psi` | `LV24_SEO_PSI_API_KEY` |
| SMTP | `smtp` | `LV24_SEO_SMTP_PASSWORD` |
| Telegram | `telegram` | `LV24_SEO_TELEGRAM_BOT_TOKEN` |

受控写入还需要 `LV24_SEO_WRITE_SECRET`，即与执行应用命令相同的 shell 中的长随机值。
`auth status` 报告存在性和来源，从不报告值，也不校验权限或发起网络调用。`auth login` 只打印
手动说明。

## 时区与语言

`report.timezone` 必须是有效的 IANA 时区。它用于报告和 `stats` 窗口、MCP 默认窗口
（`gsc_search_analytics`、`seo_opportunities`、`seo_weekly_report`）以及本地日期边界。未知时区会
以 `CONFIG_INVALID` 失败；不会静默回退到 UTC。提供方数据保持基于日期，不在时区之间转换。

`report.locale` 接受 `ru`、`en` 和 `zh`，默认 `ru`。它决定周报邮件、Telegram 消息、CLI 文本摘要
以及 `report weekly --out` 生成的 HTML 的语言，也决定数字、百分比、位置、日期和复数格式。JSON
信封、MCP 载荷、保存的快照、`report.json` 和 `report diff` 保持规范英文，机器码从不翻译。
不支持的语言会在校验时失败，而不是静默回退。

## 校验与掩码

- 未知键、无效 TOML、缺失的显式 `--config` 路径、无效时区或语言，以及超出范围的 SMTP 端口都会
  以 `CONFIG_INVALID` 失败并返回退出码 `2`。
- `lv24-seo config show --json` 输出有效配置，并带有 `meta.redacted: true`。任何名称看起来像凭据
  的键（`token`、`secret`、`password`、`api_key`、`authorization`）都会以 `***` 掩码。
- `lv24-seo doctor` 检查 Python、平台、配置可读性、工作目录可写性、有效数据目录及其作用域，
  以及令牌存在性。不会发起网络调用。相对目录会显示 `meta.data_dir_source: "working directory"`
  并带警告；这不是失败。

## 最小示例

```toml
[project]
name = "example.com"
base_url = "https://example.com"

[providers.gsc]
property = "sc-domain:example.com"
```

只要 GSC 令牌对密钥存储可用，这就足以运行 `doctor`、`properties`、`gsc query` 和
`report weekly`。

## 完整示例

基于 `lv24-seo init` 写入的带注释模板，使用示例值：

```toml
# lv24-seo workspace configuration (generated by `lv24-seo init`).
# Secrets never belong here: use `lv24-seo auth set` or the matching LV24_SEO_* variable.

[project]
name = "example.com"
base_url = "https://example.com"
default_property = "sc-domain:example.com"

[providers.gsc]
property = "sc-domain:example.com"
auth = "keychain"

[providers.yandex_webmaster]
host_id = "https:example.com:443"

[providers.yandex_metrika]
counter = "123456"
goals = [1, 2]

[providers.bing]
site = "https://example.com"
indexnow_key = "abc12345"
indexnow_key_location = "https://example.com/abc12345.txt"

[providers.crux]
origin = "https://example.com"

[providers.psi]
strategy = "mobile"
urls = ["https://example.com/", "https://example.com/pricing"]

[report]
locale = "ru"
timezone = "Europe/Minsk"
week_start = "monday"
thresholds = { clicks_pct = 10, impressions_pct = 15, position_abs = 1.5 }

[report.email]
enabled = false
to = ["owner@example.com"]
from = "seo@example.com"
only_on_change = true
smtp_host = "smtp.example.com"
smtp_port = 587
smtp_user = "seo@example.com"

[report.telegram]
enabled = false
chat_id = "123456789"
severity = "critical"

[crawl]
max_urls = 500
concurrency = 4
respect_robots = true
user_agent = "lv24-seo/0.1"

[storage]
data_dir = "./data"      # relative to this file; absolute values and LV24_SEO_DATA_DIR are used as-is
raw_retention_days = 90

[indexing]
enabled = false          # explicit opt-in for provider submissions
providers = ["bing", "yandex", "gsc", "indexnow"]
max_submit_per_run = 500
max_inspect_per_run = 20
stale_days = 7
check_interval_days = 7
gsc_inspect_daily_limit = 2000
indexnow_daily_limit = 1000
```

在渠道上设置 `enabled = true` 之前，投递保持关闭。SMTP 密码和 Telegram 机器人令牌应放在密钥
存储中，而不是这个文件里。

## 相关页面

- [CLI 参考](/zh/reference/cli/)
- [安全与隐私](/zh/security/)
- [自动化与投递](/zh/automation/)
- [故障排查](/zh/troubleshooting/)

Source: `_source/engine-config.md`, `_source/engine-data-sources.md`, `_source/engine-releases-0.12.0.md`, `_source/engine-releases-0.5.2.md`; 引擎仓库中 0.12.2 的配置模型。

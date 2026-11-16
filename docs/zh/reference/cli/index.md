---
title: CLI 参考
description: lv24-seo 命令行的命令、全局参数、JSON 信封、退出码和示例。
---

# CLI 参考

`lv24-seo` 是引擎的命令行入口。它默认只读取提供方数据，使用 `--json` 时只输出一个机器可读信封，
并且只通过三个显式受控的写入命令改变提供方状态。同一个可执行文件可在 Windows、macOS 和 Linux
上运行。

## 命令表

该表可按命令、分组或描述筛选。命令名和参数在所有语言中完全一致，只有周围的文档被翻译。

<CliTables />

每个命令还接受 `--help`，它会输出当前安装版本的权威参数列表。

## 全局约定

### 响应信封

使用 `--json` 时，命令只输出一个 JSON 文档，不会输出其他内容：

```json
{ "ok": true, "data": {}, "meta": { "version": "0.6.0", "duration_ms": 812 }, "warnings": [] }
```

失败的命令使用相同结构，但 `ok: false`，并用 `error` 对象代替 `data`：

```json
{ "ok": false, "error": { "code": "AUTH_REQUIRED", "message": "Google Search Console token is missing", "retryable": false, "next_action": "lv24-seo auth login --provider gsc" }, "meta": { "version": "0.6.0" }, "warnings": ["gsc: token missing"] }
```

- `data` 因命令而异。`meta` 始终包含 `version`，通常还会加入 `duration_ms`、`truncated`、
  `data_age_days`、`limitations`、`locale` 或 `complete`。
- `warnings` 是简短的面向人的字符串。像 `stats` 这样的聚合命令在某个提供方失败时仍保持
  `ok: true`：失败会计入 `coverage` 并写入 `warnings`。
- 不带 `--json` 时，stdout 输出简洁的文本摘要，随后是警告和错误行。两种模式都不输出 ANSI 颜色。
- `config show` 会添加 `meta.redacted: true`；看起来像凭据的键会以 `***` 掩码。

### 退出码

| 退出码 | 含义 | 对应错误码 |
|---|---|---|
| `0` | 成功。信封为 `ok: true`。 | — |
| `1` | 未预期的内部故障。 | `INTERNAL` |
| `2` | 用法或配置问题。 | `INVALID_INPUT`, `CONFIG_INVALID`, `CONFIRM_REQUIRED`, `WRITE_DISABLED` |
| `3` | 认证问题。 | `AUTH_REQUIRED`, `AUTH_INVALID` |
| `4` | 配额或上游服务故障。 | `QUOTA_EXCEEDED`, `UPSTREAM_UNAVAILABLE` |
| `5` | 部分结果：严格模式下输出被截断。 | `TRUNCATED`，或任何带 `meta.truncated` 和 `meta.strict` 的 `ok: true` 信封 |

`WRITE_DISABLED` 的退出码是 `2` 而不是 `4`：写入在调用提供方之前就被拒绝。退出码 `5` 是部分结果，
不是硬失败：数据真实，但覆盖不完整。请依据退出码和 `error.code` 判断，不要解析面向人的文本。

### `--strict` 与退出码 5

`--strict` 把截断变成 CI 闸门。它适用于 `stats`、`gsc query`、`yandex queries`、`yandex indexing`、
`crawl`、`report weekly` 和 `report diff`：

```bash
lv24-seo gsc query --start 2026-11-01 --end 2026-11-07 --strict --json
lv24-seo report weekly --days 7 --strict --json
```

- 传入该参数时总会设置 `meta.strict`，因此消费者能区分严格运行与普通运行。
- 完整响应仍返回 `0`。
- 截断的响应保持 `ok: true`（数据是真实的），但返回 `5`，并由 `meta.limitations` 说明缺失了什么。如果提供方设置了 `truncated` 却没有限制说明，CLI 会补上。
- 不带 `--strict` 时，截断的响应返回 `0`，且不包含 `meta.strict`。

`report diff --markdown` 遵循同一退出码：Markdown 仍打印到 stdout，严格模式下 diff 被截断时进程返回 `5`。

### 存储故障

SQLite 问题不再表现为通用的 `INTERNAL`，而是三个稳定代码：

| 代码 | 含义 | 可重试 | 处理方式 |
|---|---|---|---|
| `STORE_LOCKED` | 另一个进程持有写锁超过 busy timeout | 是 | 等待另一个 `lv24-seo` 运行结束再重试；没有写入任何内容 |
| `STORE_CORRUPT` | 文件不是可用的 SQLite 数据库 | 否 | 查看 `detail.backup_path`，然后移动或删除数据库并重跑 |
| `STORE_UNAVAILABLE` | 权限、父目录缺失或磁盘已满 | 否 | 修复数据目录，然后运行 `lv24-seo doctor` |

损坏文件会先被复制到自身旁边，名为 `seo.sqlite3.corrupt-20260101T101010Z`；原文件绝不会被移动或删除，
复制失败也不会掩盖错误。三个代码的退出码都是 `1`，与 `INTERNAL` 相同；请依据 `error.code` 判断。

### 配置与参数

- `--config PATH` 选择特定的 `seo.toml`。路径必须存在；文件缺失会返回 `CONFIG_INVALID`，不会
  静默回退。解析后的路径是绝对且规范化的，因此调度器产物和相对设置不依赖进程工作目录。同一路径
  也决定哪个工作区的数据目录保存写入账本，因此写入会把声明记录在配置指定的位置，而不是 shell 的
  工作目录。
- 不带 `--config` 时，引擎先查找 `./seo.toml`，再查找平台用户配置
  （Windows 为 `%APPDATA%\lv24-seo\config.toml`，Linux 为 `~/.config/lv24-seo/config.toml`）。
- `LV24_SEO_*` 环境变量覆盖文件中的值。`.env` 文件不会自动加载；请在 shell 或运行命令的服务
  单元中导出变量。
- `mcp serve` 是长期运行的服务器，不接受 `--json` 和 `--config`。

`doctor --json` 报告 `meta.data_dir`、`meta.data_dir_source`（有效目录为绝对时是 `config`，
为相对时是 `working directory`）和 `meta.data_dir_declared`（配置文件或 `LV24_SEO_DATA_DIR`
指定目录时为 true）。已声明的数据目录是硬性要求：缺失或不可用会导致检查失败。相对目录本身不是
错误，但与配置文件并存时会添加一条指明配置文件夹的警告。

完整的键列表、默认值和密钥处理见[配置参考](/zh/reference/config/)。

### 默认只读与写入闸门

只有 `sitemap submit`、`yandex recrawl` 和 `indexnow submit` 可以改变提供方状态。它们分两步执行：

1. 不带 `--confirm` 运行命令。它会返回试运行结果，包含 `data.plan`、`data.plan_hash`、
   `data.confirm_token` 和 `meta.dry_run: true`。
2. 在同一个 shell 中设置一个足够长的随机 `LV24_SEO_WRITE_SECRET`，然后在五分钟内使用
   `--allow-write --confirm TOKEN` 重新运行。

令牌是对操作、目标、完整计划哈希和有效期的 HMAC，因此任何输入变化都会使其失效。工作区初始化
后，CLI 会附加 SQLite 幂等账本：重放同一令牌返回 `status: skipped` 和 `reason: duplicate`，
提供商只被调用一次。账本从所选工作区的数据目录打开：`--config /srv/site/seo.toml` 会把声明记录在
`/srv/site/data`，即使 shell 在别处。没有数据目录时仍会应用，但信封会警告：在令牌五分钟有效期内
没有重放保护；试运行不打开账本，也不创建数据库。

IndexNow 会真正提交 URL。GSC sitemap submit 和 Yandex
recrawl 目前返回 `WRITE_DISABLED`，不会假装提供方调用已经发生。

### 日志

日志是可选项。`LV24_SEO_LOG_LEVEL=INFO`（或 `DEBUG`、`WARNING` 等）会在 CLI 和
`lv24-seo mcp serve` 中安装脱敏处理器；未设置变量时不会改变调用方的日志配置。当 stderr
不是终端时，每条记录输出一行 JSON；否则输出普通行。MCP 传输只写 stderr；stdout 保持协议
输出。`--json` 信封仍是稳定的诊断接口。

### 确定性与数据诚实

- 日期为 ISO-8601（`2026-11-10`）；时间戳为 ISO-8601 UTC（`2026-11-14T12:00:00+00:00`）。
- CLI 字段顺序稳定，保存的快照载荷按键排序，可见输出中没有随机标识符。报告和差异适合在多次
  运行之间直接比较。
- 有界响应在适用时携带 `truncated`、`total`、`data_age_days` 和 `limitations[]`。只出现在一个
  窗口中的指标会标记为未知，而不是零。
- `--days` 接受 `1..3660`；更大的值会以 `INVALID_INPUT` 失败并返回退出码 `2`。
- 任何命令都不会输出令牌、cookie 或完整的 `Authorization` 头。

## 命令分组

| 分组 | 命令 | 影响范围 |
|---|---|---|
| Start | `version`, `doctor`, `init`, `properties`, `stats` | 本地文件和环境；`stats` 只读取提供方 KPI，不写入。 |
| Authentication | `auth status`, `auth set`, `auth login`, `auth logout` | 本地密钥存储；`login` 只打印说明。 |
| Configuration | `config show` | 有效配置，凭据已掩码。 |
| Google Search Console | `gsc query`, `sitemap submit` | 查询只读；sitemap submit 是受控写入。 |
| Yandex Webmaster | `yandex queries`, `yandex indexing`, `yandex recrawl` | 查询只读；recrawl 是受控写入。 |
| IndexNow | `indexnow submit` | 受控写入，会真正提交 URL。 |
| Crawl and audit | `crawl` | 与提供方无关；配置了存储时保存本地页面和问题。 |
| Reports | `report weekly`, `report diff` | `weekly` 保存本地快照；`diff` 只读。 |
| Logs | `logs analyze` | 只读分析一个本地 nginx JSON 访问日志；不会存储或上传。 |
| Tasks | `tasks list`, `tasks add`, `tasks update` | 工作区任务账本；`add` 幂等，`update` 遵循允许的状态转换。 |
| Backup | `backup create` | 写入一个可移植的工作区归档；源文件只读，恢复需手动。 |
| Scheduling | `schedule print`, `schedule install` | `print` 只渲染；`install` 写入主机计划任务文件。 |
| Agents and MCP | `mcp serve`, `install`, `export tools`, `export skills` | 主机配置、生成文件或本地服务器。 |

## 示例

### 仪表盘快照

```bash
lv24-seo stats --days 7 --lag-days 2 --json
```

只读，不需要存储。服务始终按 `gsc`、`yandex_webmaster`、`yandex_metrika`、`bing`、`crux`、
`psi` 的顺序出现；`metrics` 只包含实际返回的值，不补零，也不跨引擎求和。单个提供方失败会被
隔离，并增加 `coverage.failed`。

### Search Console

```bash
lv24-seo gsc query --start 2026-11-01 --end 2026-11-07 --dimensions query,page --limit 100 --json
```

`--start` 和 `--end` 是必填项。没有 `--days` 简写，也没有 `--property` 覆盖：资源来自
`seo.toml` 中的 `[providers.gsc]`。维度用逗号分隔，仅限 `query`、`page`、`country`、`device`
和 `date`。

### Yandex

```bash
lv24-seo yandex queries --limit 100 --json
lv24-seo yandex indexing --json
```

`yandex queries` 返回顶部行，而不是完整的查询与页面关联：Yandex 每个周期最多提供 3,000 个查询。
`yandex indexing` 显示配置的 `host_id` 的索引历史、搜索中页面数、诊断和搜索 URL 事件。

### 抓取

```bash
lv24-seo crawl --start https://example.com --max-urls 500 --json
```

抓取器遵守 `robots.txt`，按广度优先跟随同主机链接，运行全部规则，并在配置了存储时保存页面和
问题。`data.sitemap_coverage` 用六个分组比较站点地图与抓取结果。当返回 `complete: false` 时，
受影响的分组只是候选，不是已确认的发现；`limitations[]` 会指出被截断的输入。

### 日志、任务与备份

```bash
lv24-seo logs analyze --file /var/log/nginx/access.log --json
lv24-seo tasks list --state open --limit 200 --json
lv24-seo tasks add --kind issue --url https://example.com/page --rule broken-internal-link --json
lv24-seo tasks update TASK_ID --state verified --json
lv24-seo backup create --out /srv/backups --json
```

`logs analyze` 只读取一个不超过 100 MiB 的绝对路径 nginx JSON 访问日志，返回按日期、bot 和状态分组的 `bot_daily` 以及 `crawl_waste` 汇总；文件不会上传或写入 SQLite。`tasks list` 按最新优先返回有界任务，`tasks add` 幂等，`tasks update` 只接受允许的状态转换。`backup create` 写入一个带 manifest、脱敏 `seo.toml` 和一致 SQLite 副本的归档；恢复需要手动解包。

### 报告

```bash
lv24-seo report weekly --days 7 --lag-days 2 --out reports/ --json
lv24-seo report diff --markdown
```

`report weekly` 构建并保存快照；加上 `--send` 会通过 `seo.toml` 中启用的渠道投递。`--out` 写入
规范英文的 `report.json` 和按 `report.locale` 渲染的 `report.html`。`report diff` 比较两个已保存
的周报快照，不调用提供方，并且需要两个不同周期的运行。`--markdown` 只在 stdout 输出 Markdown；
警告写入 stderr。

### 计划任务

```bash
lv24-seo schedule print --cron "0 6 * * 1" --target systemd --json
lv24-seo schedule install --kind weekly --print
```

`print` 只渲染产物，不修改主机。`install` 写入 cron 块、systemd 用户单元或任务计划程序 XML，
生成的任务会运行 `report weekly --send --json`。只有简单的 cron 表达式（`M H * * *` 和
`M H * * DOW`）能转换为 systemd 或 Windows 计划。

### MCP 与智能体客户端

```bash
lv24-seo install --client cursor --print
lv24-seo mcp serve --transport http --port 8765
```

`install` 会把 `lv24-seo` 服务器条目合并进主机配置，而不是替换文件；`--print` 显示确切的 JSON。
`mcp serve` 默认使用 stdio，并可通过 `--transport http` 使用可流式 HTTP。

### 认证

```bash
lv24-seo auth status --json
lv24-seo auth set --provider gsc --stdin
```

`auth set` 从 stdin 或隐藏提示读取密钥，存入系统钥匙串，或存入显式启用的 `0600` 文件后备存储。
它只输出 `{provider, stored, source}`。`auth status` 报告存在性和来源（`env`、`keyring`、`file`、
`missing`），从不输出值。

### 导出

```bash
lv24-seo export tools --out schemas/tools.json
lv24-seo export skills --out skills/
```

`export tools` 为不使用 MCP 的智能体写入生成的 MCP 注册表；`export skills` 复制打包的
`SKILL.md` 文件及其清单。两者都只写本地文件。

## 相关页面

- [配置参考](/zh/reference/config/)
- [数据源与配额](/zh/providers/)
- [MCP 与智能体技能](/zh/mcp/)
- [故障排查](/zh/troubleshooting/)

Source: `_source/engine-cli.md`, `_source/engine-mcp.md`, `_source/engine-releases-0.5.2.md`, `_source/engine-releases-0.5.3.md`; 引擎仓库中 0.5.2 的 `--help` 输出。

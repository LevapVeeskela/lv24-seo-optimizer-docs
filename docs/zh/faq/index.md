---
title: 常见问题
description: 关于费用、令牌、数据存储、MCP、桌面应用、未签名构建和报告的简短解答。
---

# 常见问题

## 这个工具真的免费吗？

默认路径是免费的。Google Search Console、Yandex Webmaster、Yandex Metrika、Bing、CrUX 和
PageSpeed Insights 都提供免费额度，且没有必需依赖需要绑定银行卡。可选的付费 SERP 和外链适配器
只有文档，没有随包发布；如果以后加入，也会使用你自己的密钥并默认关闭。参见
[数据源与配额](/zh/providers/)。

## 每个提供方都需要令牌吗？

只需要为你配置的提供方准备。GSC、Yandex Webmaster、Yandex Metrika、Bing 和 CrUX 需要令牌或
API 密钥；PSI 无需密钥即可使用。`lv24-seo auth status --json` 只显示存在性和来源，不显示值。
参见[配置参考](/zh/reference/config/)。

## 它会抓取 Google 或 Yandex 的搜索结果吗？

不会。查询、排名和索引数据来自提供方 API。项目从不抓取搜索结果页、不破解 CAPTCHA，也不自动化
Yandex Business。参见[数据源与配额](/zh/providers/)。

## 我的数据存储在哪里？

存储在 `storage.data_dir` 下的本地 SQLite 数据库（默认 `data/seo.sqlite3`），以及你用 `--out`
请求的报告文件。没有遥测端点。数据只会通过提供方 API 调用和你启用的投递渠道离开本机。参见
[安全与隐私](/zh/security/)。

## 应该用 CLI 还是 MCP？

两者基于同一个引擎并返回相同的数据。CLI 面向终端、cron 和 CI。MCP 服务器通过 stdio 或可流式
HTTP 向编码智能体提供 11 个工具。参见 [MCP 与智能体技能](/zh/mcp/)。

## 桌面应用还是 CLI？

桌面应用把同一个引擎包装为 PyInstaller sidecar，并增加仪表盘、设置表单和推荐页面。CLI 仍是
可脚本化的界面，两者读取同一个 `seo.toml` 和数据目录。参见[桌面应用](/zh/desktop/)。

## 桌面应用会自动更新吗？

Windows NSIS、macOS `.app` 和 Linux AppImage 会：应用检查 `latest.json`，验证 minisign 签名，
并且只在你确认后安装。deb、rpm 和 portable ZIP 只能手动更新。0.1.0 构建早于更新器，需要手动
升级一次。参见[发布与更新](/zh/release/)。

## 为什么构建没有签名？

操作系统代码签名需要付费证书和公证，本项目不购买这些服务。Windows 和 Linux 包未签名；macOS
使用 ad-hoc 签名。更新载荷另外使用 minisign 签名，这保护了更新，但不会让安装程序获得操作系统
信任。运行安装程序前请核对 `SHA256SUMS.txt`。参见[安全与隐私](/zh/security/)。

## Windows SmartScreen 阻止安装程序怎么办？

由于安装程序没有 Authenticode 签名，SmartScreen、Smart App Control 或杀毒软件可能发出警告。
只从发布页面下载，用 `SHA256SUMS.txt` 核对 SHA-256，并且只在接受风险时允许 Windows 运行这个
特定应用。请保持 SmartScreen 和杀毒软件开启。参见[安装](/zh/install/)。

## macOS 无法打开应用怎么办？

应用使用 ad-hoc 签名，因此 Gatekeeper 会在首次启动时警告。请通过“系统设置”→“隐私与安全性”
→“仍要打开”打开一次，或右键点击应用并选择“打开”。不要关闭 Gatekeeper。参见[安装](/zh/install/)。

## Linux 上如何存储令牌？

安装引擎的 `secrets` extra 后，通过操作系统的 Secret Service 钥匙串存储；桌面应用会传递钥匙串
所需的 session bus 和 XDG runtime 变量。没有钥匙串时，设置 `LV24_SEO_ALLOW_FILE_SECRETS=1`
使用 `0600` 文件后备存储，它会在每次运行时打印警告。参见[配置参考](/zh/reference/config/)。

## 可以跟踪多个站点吗？

一个配置不行：一个 `seo.toml` 描述一个项目和一组提供方目标。请为每个站点运行一个配置并传入
`--config path/to/seo.toml`；桌面应用一次只使用一个选中的配置。参见
[配置参考](/zh/reference/config/)。

## 为什么 Yandex 和 GSC 的数字不同？

它们衡量的内容不同。GSC 每天最多返回 50,000 行，延迟 2–3 天。Yandex 每个周期最多返回 3,000
个查询，不支持查询与页面的关联，延迟约四天。工具从不跨引擎求和，也不会用零填充缺失行。参见
[数据源与配额](/zh/providers/)。

## 如何更改报告语言？

将 `report.locale` 设为 `ru`、`en` 或 `zh`（默认 `ru`）。它控制电子邮件、Telegram、CLI 文本摘要
以及 `report weekly --out` 生成的 HTML。JSON 信封、快照、`report.json` 和 `report diff` 保持
规范英文。参见[配置参考](/zh/reference/config/)。

## 数据保留多久？

快照和抓取记录会一直保存在 SQLite 中，直到你删除数据目录；每种类型、资源和周期保留一个快照。
`storage.raw_retention_days` 是保留字段，目前不起作用，因为不会写入原始归档。升级前请备份
数据库。参见[安全与隐私](/zh/security/)。

## 为什么周报不完整？

提供方有延迟和数据上限。检查信封中的 `data_age_days`、`truncated`、`limitations[]` 和
`warnings[]`，如果最近几天仍在填充，请增大 `--lag-days`。`report diff` 还需要两个已保存的周报
运行。参见[故障排查](/zh/troubleshooting/)。

## 可以在 CI 中运行吗？

可以。使用 `--json` 配合退出码，并用 `report diff --markdown` 生成拉取请求评论或任务摘要；警告
写入 stderr，因此 stdout 仍是有效的 Markdown。令牌应放在 CI 密钥中，而不是 `seo.toml`。参见
[CLI 参考](/zh/reference/cli/)。

## 如何贡献？

先开 issue，从 `main` 建分支，每次改动只涉及一个领域，并在提交拉取请求前运行完整检查：

```bash
uv sync --extra dev
uv run ruff check . && uv run ruff format --check . && uv run mypy src && uv run pytest -q
```

参见[贡献指南](https://github.com/LevapVeeskela/lv24-seo-optimizer/blob/main/CONTRIBUTING.md)，
了解接受的改动和提交格式。

## 在哪里报告问题？

引擎、CLI 和 MCP 问题：[lv24-seo-optimizer issues](https://github.com/LevapVeeskela/lv24-seo-optimizer/issues)。
桌面应用问题：[lv24-seo-optimizer-desktop issues](https://github.com/LevapVeeskela/lv24-seo-optimizer-desktop/issues)。
请附上 `lv24-seo version` 输出、确切命令、`--json` 信封和退出码。请隐去令牌和客户数据。

## 会发送遥测吗？

不会。没有遥测端点，也没有可关闭的 `[privacy]` 部分。工具只向你查询的提供方和启用的投递渠道
发送数据；桌面应用只联系 GitHub 获取更新元数据。

Source: `_source/engine-cli.md`, `_source/engine-config.md`, `_source/engine-data-sources.md`, `_source/engine-security.md`, `_source/desktop-README.md`, `_source/desktop-security.md`.

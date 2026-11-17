// Home page copy per locale. Routes are locale-neutral (`/start/`); the
// component prefixes the locale and the site base.
import type { LocaleKey } from './i18n';

interface Point {
  title: string;
  text: string;
}

interface PathCard {
  num: string;
  title: string;
  text: string;
  href: string;
  cta: string;
}

interface SurfaceCard {
  tag: string;
  text: string;
  href: string;
}

export interface HomeCopy {
  eyebrow: string;
  title: string;
  lead: string;
  ctaStart: string;
  ctaCli: string;
  copyInstall: string;
  copy: string;
  copied: string;
  altInstall: string;
  whyLabel: string;
  startEyebrow: string;
  startTitle: string;
  surfacesEyebrow: string;
  surfacesTitle: string;
  sourceNote: string;
  points: Point[];
  paths: PathCard[];
  surfaces: SurfaceCard[];
}

const ROUTES = [
  '/start/',
  '/install/',
  '/reference/cli/',
  '/providers/',
  '/desktop/',
  '/mcp/',
];
const SURFACE_ROUTES: Record<string, string> = {
  cli: '/reference/cli/',
  mcp: '/mcp/',
  desktop: '/desktop/',
  automation: '/automation/',
};

function paths(items: [string, string, string][]): PathCard[] {
  return items.map(([title, text, cta], i) => ({
    num: `0${i + 1}`,
    title,
    text,
    href: ROUTES[i],
    cta,
  }));
}

function surfaces(texts: [string, string, string, string]): SurfaceCard[] {
  return (['cli', 'mcp', 'desktop', 'automation'] as const).map((tag, i) => ({
    tag,
    text: texts[i],
    href: SURFACE_ROUTES[tag],
  }));
}

const en: HomeCopy = {
  eyebrow: 'LV24 SEO Optimizer · Documentation · engine 0.12.2 · desktop 0.9.0',
  title: 'SEO audits and weekly reports from Search Console, Yandex, Bing, CrUX and PSI',
  lead: 'One Python engine for search analytics, crawl audits, weekly reports and delivery — run it from the CLI, expose it to agents over MCP, schedule it, or open the desktop app. Free providers first, read-only by default.',
  ctaStart: 'Start in 5 minutes',
  ctaCli: 'CLI reference',
  copyInstall: 'Copy install command',
  copy: 'Copy',
  copied: 'Copied',
  altInstall: 'or try it without a global install:',
  whyLabel: 'Why LV24 SEO Optimizer',
  startEyebrow: 'Start here',
  startTitle: 'Pick your path',
  surfacesEyebrow: 'One engine, four surfaces',
  surfacesTitle: 'Use the surface that fits your day',
  sourceNote: 'Maintainer sources:',
  points: [
    {
      title: 'Free-first data sources',
      text: 'Google Search Console, Yandex Webmaster, Yandex Metrika, Bing, CrUX and PageSpeed Insights. PSI works without a key; every paid adapter is optional and brings your own key.',
    },
    {
      title: 'Read-only by default',
      text: 'Writes are plans first: sitemap submit, recrawl and IndexNow print a dry run, then require --allow-write and the confirm token.',
    },
    {
      title: 'Honest limits',
      text: 'Every bounded answer carries truncated, total, data_age and limitations[]. Missing data is reported as unknown, never as zero.',
    },
    {
      title: 'Built for agents',
      text: '12 MCP tools (read-only by default), agent skills and one-command host installs; JSON envelopes and stable exit codes for scripts.',
    },
    {
      title: 'Desktop when you want it',
      text: 'A Tauri app for Windows, Linux and macOS: dashboard, crawl, reports and recommendations over the same local engine.',
    },
  ],
  paths: paths([
    [
      'Quickstart',
      'Install, run doctor, and build your first weekly report.',
      'Read the quickstart',
    ],
    ['Install', 'uv, pipx and npm installs; tokens in the OS keychain.', 'Install the engine'],
    ['CLI reference', 'Every command, grouped, with copyable examples.', 'Browse commands'],
    [
      'Data sources',
      'What each provider returns, its quota and its limits.',
      'Compare providers',
    ],
    [
      'Desktop app',
      'Install 0.2.2 for Windows, Linux or macOS and connect a project.',
      'Open the desktop guide',
    ],
    [
      'MCP and skills',
      'Register the MCP server in Claude, OpenCode, VS Code or Cursor.',
      'Connect an agent',
    ],
  ]),
  surfaces: surfaces([
    'lv24-seo version, doctor, crawl, report — one envelope per run, stable exit codes.',
    'stdio or HTTP MCP with 12 tools for audits, reports and indexing triage.',
    'Tauri 0.9.0: dashboard KPIs, crawl, reports and the recommendations workbench.',
    'cron, systemd or Task Scheduler jobs that build and deliver the weekly report.',
  ]),
};

const ru: HomeCopy = {
  eyebrow: 'LV24 SEO Optimizer · Документация · движок 0.12.2 · приложение 0.9.0',
  title: 'SEO-аудиты и недельные отчёты из Search Console, Яндекса, Bing, CrUX и PSI',
  lead: 'Один Python-движок для поисковой аналитики, обхода и аудита сайта, недельных отчётов и доставки — запускайте из CLI, подключайте к агентам через MCP, ставьте в расписание или открывайте приложение. Сначала бесплатные источники, по умолчанию только чтение.',
  ctaStart: 'Начать за 5 минут',
  ctaCli: 'Справочник CLI',
  copyInstall: 'Копировать команду установки',
  copy: 'Копировать',
  copied: 'Скопировано',
  altInstall: 'или попробуйте без глобальной установки:',
  whyLabel: 'Почему LV24 SEO Optimizer',
  startEyebrow: 'С чего начать',
  startTitle: 'Выберите свой путь',
  surfacesEyebrow: 'Один движок, четыре поверхности',
  surfacesTitle: 'Используйте то, что удобно сегодня',
  sourceNote: 'Источники для сопровождающих:',
  points: [
    {
      title: 'Бесплатные источники в приоритете',
      text: 'Google Search Console, Яндекс Вебмастер, Яндекс Метрика, Bing, CrUX и PageSpeed Insights. PSI работает без ключа; платные адаптеры необязательны и работают с вашим ключом.',
    },
    {
      title: 'Только чтение по умолчанию',
      text: 'Записи начинаются с плана: отправка sitemap, переобход и IndexNow сначала печатают dry run, затем требуют --allow-write и confirm-токен.',
    },
    {
      title: 'Честные ограничения',
      text: 'Каждый ограниченный ответ несёт truncated, total, data_age и limitations[]. Отсутствующие данные помечаются как неизвестные, а не как ноль.',
    },
    {
      title: 'Создан для агентов',
      text: '12 MCP-инструментов (по умолчанию только чтение), навыки агентов и установка в хост одной командой; JSON-конверты и стабильные коды выхода для скриптов.',
    },
    {
      title: 'Приложение, когда нужно',
      text: 'Tauri-приложение для Windows, Linux и macOS: дашборд, обход, отчёты и рекомендации на том же локальном движке.',
    },
  ],
  paths: paths([
    [
      'Быстрый старт',
      'Установите, запустите doctor и соберите первый недельный отчёт.',
      'Читать быстрый старт',
    ],
    ['Установка', 'uv, pipx и npm; токены в связке ключей ОС.', 'Установить движок'],
    [
      'Справочник CLI',
      'Все команды по группам, с примерами для копирования.',
      'Смотреть команды',
    ],
    [
      'Источники данных',
      'Что возвращает каждый провайдер, его квоты и ограничения.',
      'Сравнить источники',
    ],
    [
      'Приложение',
      'Установите 0.9.0 для Windows, Linux или macOS и подключите проект.',
      'Открыть руководство',
    ],
    [
      'MCP и навыки',
      'Подключите MCP-сервер в Claude, OpenCode, VS Code или Cursor.',
      'Подключить агента',
    ],
  ]),
  surfaces: surfaces([
    'lv24-seo version, doctor, crawl, report — один конверт на запуск, стабильные коды выхода.',
    'stdio или HTTP MCP с 12 инструментами: аудиты, отчёты, разбор индексации.',
    'Tauri 0.9.0: KPI на дашборде, обход, отчёты и мастер рекомендаций.',
    'Задания cron, systemd или Task Scheduler, которые собирают и доставляют недельный отчёт.',
  ]),
};

const zh: HomeCopy = {
  eyebrow: 'LV24 SEO Optimizer · 文档 · 引擎 0.12.2 · 桌面应用 0.9.0',
  title: '来自 Search Console、Yandex、Bing、CrUX 和 PSI 的 SEO 审计与周报',
  lead: '一个 Python 引擎完成搜索分析、抓取审计、周报与投递——可通过 CLI 运行、通过 MCP 交给智能体、加入定时任务，或打开桌面应用。优先使用免费数据源，默认只读。',
  ctaStart: '5 分钟上手',
  ctaCli: 'CLI 参考',
  copyInstall: '复制安装命令',
  copy: '复制',
  copied: '已复制',
  altInstall: '或免全局安装试用：',
  whyLabel: '为什么选择 LV24 SEO Optimizer',
  startEyebrow: '从这里开始',
  startTitle: '选择你的路径',
  surfacesEyebrow: '一个引擎，四种使用方式',
  surfacesTitle: '按当天需要选择入口',
  sourceNote: '维护者来源：',
  points: [
    {
      title: '免费数据源优先',
      text: 'Google Search Console、Yandex 站长工具、Yandex Metrika、Bing、CrUX 和 PageSpeed Insights。PSI 无需密钥；付费适配器均可选，并使用你自己的密钥。',
    },
    {
      title: '默认只读',
      text: '写操作先出计划：sitemap 提交、重新抓取和 IndexNow 先打印 dry run，然后要求 --allow-write 与确认令牌。',
    },
    {
      title: '诚实的限制',
      text: '每个有界响应都带有 truncated、total、data_age 和 limitations[]。缺失数据标记为未知，绝不当作零。',
    },
    {
      title: '为智能体而建',
      text: '12 个 MCP 工具（默认只读）、智能体技能和一条命令接入宿主；JSON 信封和稳定退出码便于脚本处理。',
    },
    {
      title: '需要时用桌面应用',
      text: '面向 Windows、Linux 和 macOS 的 Tauri 应用：仪表盘、抓取、报告和推荐工作台，共用同一个本地引擎。',
    },
  ],
  paths: paths([
    ['快速开始', '安装、运行 doctor，并生成第一份周报。', '阅读快速开始'],
    ['安装', 'uv、pipx 和 npm 安装；令牌保存在操作系统密钥库。', '安装引擎'],
    ['CLI 参考', '所有命令分组列出，附可复制的示例。', '浏览命令'],
    ['数据源', '每个数据源返回什么、配额与限制。', '比较数据源'],
    [
      '桌面应用',
      '为 Windows、Linux 或 macOS 安装 0.9.0 并连接项目。',
      '打开桌面指南',
    ],
    [
      'MCP 与技能',
      '在 Claude、OpenCode、VS Code 或 Cursor 中注册 MCP 服务器。',
      '连接智能体',
    ],
  ]),
  surfaces: surfaces([
    'lv24-seo version、doctor、crawl、report——每次运行一个信封，退出码稳定。',
    'stdio 或 HTTP MCP，提供 12 个工具，覆盖审计、报告和索引排查。',
    'Tauri 0.9.0：仪表盘 KPI、抓取、报告和推荐工作台。',
    'cron、systemd 或 Task Scheduler 任务，自动生成并投递周报。',
  ]),
};

export const HOME: Record<LocaleKey, HomeCopy> = { root: en, ru, zh };

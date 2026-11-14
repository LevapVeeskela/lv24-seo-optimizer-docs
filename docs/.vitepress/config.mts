import { defineConfig, type DefaultTheme, type HeadConfig } from 'vitepress';

const hostname = (process.env.DOCS_SITE_URL || 'https://seo.lv24.by').replace(/\/$/, '');
const rawBase = process.env.DOCS_BASE || '/';
const base = rawBase === '/' ? '/' : `/${rawBase.replace(/^\/+|\/+$/g, '')}/`;

// Locale keys: `root` is English at the site root; ru and zh live under
// /ru/ and /zh/ with the same page structure (scripts/check.mjs enforces it).
type Locale = 'root' | 'ru' | 'zh';
const LOCALES: Locale[] = ['root', 'ru', 'zh'];
const HREFLANG: Record<Locale, string> = { root: 'en', ru: 'ru', zh: 'zh-Hans' };
const SITE_NAME: Record<Locale, string> = {
  root: 'LV24 SEO Optimizer docs',
  ru: 'Документация LV24 SEO Optimizer',
  zh: 'LV24 SEO Optimizer 文档',
};
const FALLBACK_DESC: Record<Locale, string> = {
  root: 'Documentation for LV24 SEO Optimizer.',
  ru: 'Документация LV24 SEO Optimizer.',
  zh: 'LV24 SEO Optimizer 文档。',
};

function localeOf(page: string): Locale {
  const first = page.split('/')[0];
  return first === 'ru' || first === 'zh' ? first : 'root';
}

/** `ru/start/index.md` -> `start/index.md` (the locale-neutral page). */
function neutral(page: string): string {
  const locale = localeOf(page);
  return locale === 'root' ? page : page.slice(locale.length + 1);
}

function localized(page: string, locale: Locale): string {
  return locale === 'root' ? page : `${locale}/${page}`;
}

function urlOf(page: string): string {
  const path = page.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '');
  return `${hostname}${base}${path}`;
}

// Routes are written once, locale-neutral; each locale prefixes them.
interface SidebarLabels {
  groups: [string, string, string, string];
  items: Record<string, string>;
}

const ROUTE_GROUPS: string[][] = [
  ['/start/', '/install/', '/desktop/'],
  ['/providers/', '/reports/', '/crawl/', '/automation/', '/mcp/'],
  ['/security/', '/architecture/', '/troubleshooting/', '/release/'],
  ['/reference/cli/', '/reference/config/', '/faq/'],
];

function sidebar(prefix: string, labels: SidebarLabels): DefaultTheme.SidebarItem[] {
  return ROUTE_GROUPS.map((routes, i) => ({
    text: labels.groups[i],
    items: routes.map((route) => ({ text: labels.items[route], link: `${prefix}${route}` })),
  }));
}

function nav(prefix: string, text: [string, string, string, string]): DefaultTheme.NavItem[] {
  return ['/start/', '/reference/cli/', '/security/', '/faq/'].map((route, i) => ({
    text: text[i],
    link: `${prefix}${route}`,
  }));
}

const enSidebar: SidebarLabels = {
  groups: ['Start', 'Use', 'Operate', 'Reference'],
  items: {
    '/start/': 'Quickstart',
    '/install/': 'Install',
    '/desktop/': 'Desktop app',
    '/providers/': 'Data sources',
    '/reports/': 'Reports and diffs',
    '/crawl/': 'Crawl and audit',
    '/automation/': 'Automation and delivery',
    '/mcp/': 'MCP and agent skills',
    '/security/': 'Security and privacy',
    '/architecture/': 'Architecture',
    '/troubleshooting/': 'Troubleshooting',
    '/release/': 'Releases and update',
    '/reference/cli/': 'CLI reference',
    '/reference/config/': 'Config reference',
    '/faq/': 'FAQ',
  },
};

const ruSidebar: SidebarLabels = {
  groups: ['Начало', 'Работа', 'Эксплуатация', 'Справочник'],
  items: {
    '/start/': 'Быстрый старт',
    '/install/': 'Установка',
    '/desktop/': 'Приложение',
    '/providers/': 'Источники данных',
    '/reports/': 'Отчёты и диффы',
    '/crawl/': 'Обход и аудит',
    '/automation/': 'Автоматизация и доставка',
    '/mcp/': 'MCP и навыки агентов',
    '/security/': 'Безопасность и приватность',
    '/architecture/': 'Архитектура',
    '/troubleshooting/': 'Устранение неполадок',
    '/release/': 'Релизы и обновление',
    '/reference/cli/': 'Справочник CLI',
    '/reference/config/': 'Справочник конфигурации',
    '/faq/': 'FAQ',
  },
};

const zhSidebar: SidebarLabels = {
  groups: ['开始', '使用', '运维', '参考'],
  items: {
    '/start/': '快速开始',
    '/install/': '安装',
    '/desktop/': '桌面应用',
    '/providers/': '数据源',
    '/reports/': '报告与差异',
    '/crawl/': '抓取与审计',
    '/automation/': '自动化与投递',
    '/mcp/': 'MCP 与智能体技能',
    '/security/': '安全与隐私',
    '/architecture/': '架构',
    '/troubleshooting/': '故障排查',
    '/release/': '发布与更新',
    '/reference/cli/': 'CLI 参考',
    '/reference/config/': '配置参考',
    '/faq/': '常见问题',
  },
};

const ruTheme: DefaultTheme.Config = {
  nav: nav('/ru', ['Документация', 'CLI', 'Безопасность', 'FAQ']),
  sidebar: sidebar('/ru', ruSidebar),
  outline: { level: [2, 3], label: 'На этой странице' },
  docFooter: { prev: 'Предыдущая страница', next: 'Следующая страница' },
  lastUpdated: { text: 'Обновлено' },
  returnToTopLabel: 'Наверх',
  sidebarMenuLabel: 'Меню',
  darkModeSwitchLabel: 'Оформление',
  lightModeSwitchTitle: 'Переключить на светлую тему',
  darkModeSwitchTitle: 'Переключить на тёмную тему',
  langMenuLabel: 'Сменить язык',
  skipToContentLabel: 'Перейти к содержимому',
  notFound: {
    title: 'СТРАНИЦА НЕ НАЙДЕНА',
    quote: 'Такой страницы в документации нет.',
    linkLabel: 'На главную документации',
    linkText: 'На главную',
  },
};

const zhTheme: DefaultTheme.Config = {
  nav: nav('/zh', ['文档', 'CLI', '安全', '常见问题']),
  sidebar: sidebar('/zh', zhSidebar),
  outline: { level: [2, 3], label: '本页目录' },
  docFooter: { prev: '上一页', next: '下一页' },
  lastUpdated: { text: '最后更新' },
  returnToTopLabel: '返回顶部',
  sidebarMenuLabel: '菜单',
  darkModeSwitchLabel: '外观',
  lightModeSwitchTitle: '切换到浅色主题',
  darkModeSwitchTitle: '切换到深色主题',
  langMenuLabel: '切换语言',
  skipToContentLabel: '跳到正文',
  notFound: {
    title: '页面未找到',
    quote: '文档中没有这个页面。',
    linkLabel: '返回文档首页',
    linkText: '返回首页',
  },
};

const searchLocales = {
  ru: {
    translations: {
      button: { buttonText: 'Поиск', buttonAriaLabel: 'Поиск' },
      modal: {
        displayDetails: 'Показать подробности',
        resetButtonTitle: 'Сбросить поиск',
        backButtonTitle: 'Закрыть поиск',
        noResultsText: 'Ничего не найдено по запросу',
        footer: {
          selectText: 'выбрать',
          selectKeyAriaLabel: 'Enter',
          navigateText: 'перейти',
          navigateUpKeyAriaLabel: 'стрелка вверх',
          navigateDownKeyAriaLabel: 'стрелка вниз',
          closeText: 'закрыть',
          closeKeyAriaLabel: 'Escape',
        },
      },
    },
  },
  zh: {
    translations: {
      button: { buttonText: '搜索', buttonAriaLabel: '搜索' },
      modal: {
        displayDetails: '显示详细信息',
        resetButtonTitle: '清除查询',
        backButtonTitle: '关闭搜索',
        noResultsText: '没有找到相关结果',
        footer: {
          selectText: '选择',
          selectKeyAriaLabel: '回车',
          navigateText: '切换',
          navigateUpKeyAriaLabel: '向上方向键',
          navigateDownKeyAriaLabel: '向下方向键',
          closeText: '关闭',
          closeKeyAriaLabel: 'Esc',
        },
      },
    },
  },
};

export default defineConfig({
  title: SITE_NAME.root,
  description:
    'Documentation for LV24 SEO Optimizer: Search Console, Yandex, Bing, CrUX and PSI audits, weekly reports, MCP tools and a desktop app.',
  base,
  cleanUrls: true,
  lastUpdated: true,
  appearance: true,
  locales: {
    root: { label: 'English', lang: 'en-US' },
    ru: {
      label: 'Русский',
      lang: 'ru-RU',
      title: SITE_NAME.ru,
      description:
        'Документация LV24 SEO Optimizer: аудиты Search Console, Яндекс, Bing, CrUX и PSI, недельные отчёты, MCP-инструменты и приложение.',
      themeConfig: ruTheme,
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      title: SITE_NAME.zh,
      description:
        'LV24 SEO Optimizer 文档：Search Console、Yandex、Bing、CrUX 与 PSI 审计、周报、MCP 工具和桌面应用。',
      themeConfig: zhTheme,
    },
  },
  sitemap: {
    // VitePress adds xhtml:link hreflang alternates across the locales.
    hostname: `${hostname}${base === '/' ? '/' : base}`,
    transformItems: (items) => items.filter((item) => !item.url.replace(/\/$/, '').endsWith('404')),
  },
  markdown: {
    // Code is always dark, in both themes: it matches the product identity and
    // keeps shell samples readable inside light pages.
    theme: 'github-dark',
  },
  themeConfig: {
    logo: { src: '/logo.svg', alt: 'LV24 SEO Optimizer' },
    siteTitle: 'LV24',
    outline: { level: [2, 3], label: 'On this page' },
    docFooter: { prev: 'Previous page', next: 'Next page' },
    returnToTopLabel: 'Back to top',
    sidebarMenuLabel: 'Menu',
    darkModeSwitchLabel: 'Appearance',
    lightModeSwitchTitle: 'Switch to light theme',
    darkModeSwitchTitle: 'Switch to dark theme',
    langMenuLabel: 'Change language',
    lastUpdated: { text: 'Last updated' },
    search: { provider: 'local', options: { locales: searchLocales } },
    editLink: undefined,
    nav: nav('', ['Docs', 'CLI', 'Security', 'FAQ']),
    sidebar: sidebar('', enSidebar),
  },
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` }],
    ['meta', { name: 'theme-color', content: '#f6f8fa', media: '(prefers-color-scheme: light)' }],
    ['meta', { name: 'theme-color', content: '#080d12', media: '(prefers-color-scheme: dark)' }],
  ],
  async transformHead({ pageData }) {
    const page = pageData.relativePath;
    const locale = localeOf(page);
    const url = urlOf(page);
    const title = `${pageData.title} | ${SITE_NAME[locale]}`;
    const desc = pageData.description || FALLBACK_DESC[locale];
    const head: HeadConfig[] = [
      ['link', { rel: 'canonical', href: url }],
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: desc }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { name: 'twitter:card', content: 'summary' }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: desc }],
    ];
    if (pageData.isNotFound || neutral(page) === '404.md') return head;
    // Every page exists in every locale (enforced by scripts/check.mjs).
    for (const alt of LOCALES) {
      const href = urlOf(localized(neutral(page), alt));
      head.push(['link', { rel: 'alternate', hreflang: HREFLANG[alt], href }]);
    }
    head.push(['link', { rel: 'alternate', hreflang: 'x-default', href: urlOf(neutral(page)) }]);
    return head;
  },
});

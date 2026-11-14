// UI strings for the theme components, per VitePress locale key.
// `root` is English; `ru` and `zh` mirror its keys (typed, so a missing key
// fails the type check in the editor and the build).
import { computed } from 'vue';
import { useData, withBase } from 'vitepress';

export type LocaleKey = 'root' | 'ru' | 'zh';

const en = {
  docs: 'Docs',
  breadcrumb: 'Breadcrumb',
  footer: 'Footer',
  quickstart: 'Quickstart',
  cli: 'CLI',
  security: 'Security',
  desktop: 'Desktop app',
  faq: 'FAQ',
  copy: 'Copy',
  copied: 'Copied',
  copyCommandFor: 'Copy command for',
  platformCommands: 'Platform commands',
  commandGroups: 'Command groups',
  filterCommands: 'Filter commands',
  filterPlaceholder: 'Type a command name, for example: report',
  command: 'Command',
  description: 'Description',
  noMatch: 'No commands match the filter.',
  theme: 'Theme',
  themeSystem: 'System',
  themeLight: 'Light',
  themeDark: 'Dark',
  updateTitle: 'Documentation updated',
  updateText: 'A new version of this page is available.',
  updateReload: 'Reload',
  updateLater: 'Later',
  crumbs: {
    start: 'Quickstart',
    install: 'Install',
    desktop: 'Desktop app',
    providers: 'Data sources',
    reports: 'Reports and diffs',
    crawl: 'Crawl and audit',
    automation: 'Automation and delivery',
    mcp: 'MCP and agent skills',
    security: 'Security and privacy',
    architecture: 'Architecture',
    troubleshooting: 'Troubleshooting',
    release: 'Releases and update',
    reference: 'Reference',
    cli: 'CLI reference',
    config: 'Config reference',
    faq: 'FAQ',
  } as Record<string, string>,
};

export type Messages = typeof en;

const ru: Messages = {
  docs: 'Документация',
  breadcrumb: 'Навигационная цепочка',
  footer: 'Нижняя навигация',
  quickstart: 'Быстрый старт',
  cli: 'CLI',
  security: 'Безопасность',
  desktop: 'Приложение',
  faq: 'FAQ',
  copy: 'Копировать',
  copied: 'Скопировано',
  copyCommandFor: 'Копировать команду для',
  platformCommands: 'Команды для платформ',
  commandGroups: 'Группы команд',
  filterCommands: 'Фильтр команд',
  filterPlaceholder: 'Введите имя команды, например: report',
  command: 'Команда',
  description: 'Описание',
  noMatch: 'Нет команд, подходящих под фильтр.',
  theme: 'Тема',
  themeSystem: 'Системная',
  themeLight: 'Светлая',
  themeDark: 'Тёмная',
  updateTitle: 'Документация обновлена',
  updateText: 'Доступна новая версия этой страницы.',
  updateReload: 'Обновить',
  updateLater: 'Позже',
  crumbs: {
    start: 'Быстрый старт',
    install: 'Установка',
    desktop: 'Приложение',
    providers: 'Источники данных',
    reports: 'Отчёты и диффы',
    crawl: 'Обход и аудит',
    automation: 'Автоматизация и доставка',
    mcp: 'MCP и навыки агентов',
    security: 'Безопасность и приватность',
    architecture: 'Архитектура',
    troubleshooting: 'Устранение неполадок',
    release: 'Релизы и обновление',
    reference: 'Справочник',
    cli: 'Справочник CLI',
    config: 'Справочник конфигурации',
    faq: 'FAQ',
  },
};

const zh: Messages = {
  docs: '文档',
  breadcrumb: '面包屑导航',
  footer: '页脚导航',
  quickstart: '快速开始',
  cli: 'CLI',
  security: '安全',
  desktop: '桌面应用',
  faq: '常见问题',
  copy: '复制',
  copied: '已复制',
  copyCommandFor: '复制命令：',
  platformCommands: '各平台命令',
  commandGroups: '命令分组',
  filterCommands: '筛选命令',
  filterPlaceholder: '输入命令名，例如：report',
  command: '命令',
  description: '说明',
  noMatch: '没有符合筛选条件的命令。',
  theme: '主题',
  themeSystem: '跟随系统',
  themeLight: '浅色',
  themeDark: '深色',
  updateTitle: '文档已更新',
  updateText: '此页面有新版本可用。',
  updateReload: '刷新',
  updateLater: '稍后',
  crumbs: {
    start: '快速开始',
    install: '安装',
    desktop: '桌面应用',
    providers: '数据源',
    reports: '报告与差异',
    crawl: '抓取与审计',
    automation: '自动化与投递',
    mcp: 'MCP 与智能体技能',
    security: '安全与隐私',
    architecture: '架构',
    troubleshooting: '故障排查',
    release: '发布与更新',
    reference: '参考',
    cli: 'CLI 参考',
    config: '配置参考',
    faq: '常见问题',
  },
};

export const MESSAGES: Record<LocaleKey, Messages> = { root: en, ru, zh };

export function toLocaleKey(index: string): LocaleKey {
  return index === 'ru' || index === 'zh' ? index : 'root';
}

/** Locale-aware strings and links for theme components. */
export function useLocale() {
  const { localeIndex } = useData();
  const key = computed<LocaleKey>(() => toLocaleKey(localeIndex.value));
  const t = computed<Messages>(() => MESSAGES[key.value]);
  /** Absolute route (`/start/`) -> same-locale URL with the site base. */
  const link = (route: string): string => {
    const prefix = key.value === 'root' ? '' : `/${key.value}`;
    return withBase(`${prefix}${route}`);
  };
  return { key, t, link };
}

import { h } from 'vue';
import DefaultTheme from 'vitepress/theme';
import Breadcrumbs from './Breadcrumbs.vue';
import ShellTabs from './ShellTabs.vue';
import CliTables from './CliTables.vue';
import CliOutline from './CliOutline.vue';
import HomePage from './HomePage.vue';
import BrandMark from './BrandMark.vue';
import NavBrandSuffix from './NavBrandSuffix.vue';
import SiteFooter from './SiteFooter.vue';
import LangSwitcher from './LangSwitcher.vue';
import ThemeSwitcher from './ThemeSwitcher.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'doc-top': () => h(Breadcrumbs),
      'nav-bar-title-after': () => h(NavBrandSuffix),
      'nav-bar-content-after': () => [h(LangSwitcher), h(ThemeSwitcher)],
      'aside-outline-after': () => h(CliOutline),
      'layout-bottom': () => h(SiteFooter),
    }),
  enhanceApp({ app }) {
    app.component('ShellTabs', ShellTabs);
    app.component('CliTables', CliTables);
    app.component('HomePage', HomePage);
    app.component('BrandMark', BrandMark);
  },
};

<script setup lang="ts">
import { computed } from 'vue';
import { useData } from 'vitepress';
import { useLocale } from './i18n';

const { page } = useData();
const { key, t, link } = useLocale();

// Built from the page file, not the URL, so the site base (/docs/) and the
// locale prefix (/ru/, /zh/) never show up as crumbs.
const crumbs = computed(() => {
  let parts = page.value.relativePath
    .replace(/(^|\/)index\.md$/, '')
    .replace(/\.md$/, '')
    .split('/')
    .filter(Boolean);
  if (key.value !== 'root' && parts[0] === key.value) parts = parts.slice(1);
  const items = [{ text: t.value.docs, href: link('/') }];
  let route = '';
  parts.forEach((part) => {
    route += `/${part}`;
    items.push({ text: t.value.crumbs[part] ?? part, href: link(`${route}/`) });
  });
  return items;
});
</script>

<template>
  <nav v-if="crumbs.length > 1" :aria-label="t.breadcrumb" class="breadcrumbs">
    <ol>
      <li v-for="(crumb, i) in crumbs" :key="crumb.href">
        <span v-if="i > 0" aria-hidden="true" class="sep">/</span>
        <a v-if="i < crumbs.length - 1" :href="crumb.href">{{ crumb.text }}</a>
        <span v-else aria-current="page">{{ crumb.text }}</span>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.breadcrumbs {
  margin-bottom: 1.1rem;
  font-size: 0.76rem;
  font-family: var(--lv24-font-mono);
  letter-spacing: 0.02em;
}
.breadcrumbs ol {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  list-style: none;
  margin: 0;
  padding: 0;
}
.breadcrumbs li {
  display: inline;
  margin: 0;
}
.breadcrumbs a {
  color: var(--vp-c-text-3);
  text-decoration: none;
}
.breadcrumbs a:hover {
  color: var(--lv24-accent);
}
.breadcrumbs .sep {
  margin-right: 0.3rem;
  color: var(--lv24-border-strong);
}
.breadcrumbs [aria-current='page'] {
  color: var(--lv24-accent);
}
</style>

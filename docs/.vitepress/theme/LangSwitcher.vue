<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vitepress';

type Locale = 'en' | 'ru' | 'zh';

const LABELS: Record<Locale, string> = {
  en: 'English',
  ru: 'Русский',
  zh: '简体中文',
};
const SHORT: Record<Locale, string> = { en: 'EN', ru: 'RU', zh: '中文' };

const route = useRoute();
const open = ref(false);
const root = ref<HTMLElement | null>(null);

const current = computed<Locale>(() => {
  const path = route.path;
  if (path === '/ru' || path.startsWith('/ru/')) return 'ru';
  if (path === '/zh' || path.startsWith('/zh/')) return 'zh';
  return 'en';
});

function hrefFor(locale: Locale): string {
  const path = route.path.replace(/^\/(ru|zh)(?=\/|$)/, '') || '/';
  if (locale === 'en') return path;
  return path === '/' ? `/${locale}/` : `/${locale}${path}`;
}

function toggle(): void {
  open.value = !open.value;
}

function close(): void {
  open.value = false;
}

function onDocumentClick(event: MouseEvent): void {
  if (root.value && !root.value.contains(event.target as Node)) close();
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close();
}

watch(
  () => route.path,
  () => close(),
);

onMounted(() => {
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div ref="root" class="lv-lang">
    <button
      type="button"
      class="lv-lang__button"
      :aria-label="`Language: ${LABELS[current]}`"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="toggle"
    >
      <span class="vpi-languages" aria-hidden="true" />
      <span class="lv-lang__short" aria-hidden="true">{{ SHORT[current] }}</span>
      <span class="vpi-chevron-down lv-lang__chevron" aria-hidden="true" />
    </button>
    <div v-show="open" class="lv-lang__menu" role="menu">
      <a
        v-for="locale in (['en', 'ru', 'zh'] as Locale[])"
        :key="locale"
        class="lv-lang__item"
        :href="hrefFor(locale)"
        role="menuitem"
        :aria-current="locale === current ? 'page' : undefined"
        :lang="locale"
        @click="close"
      >
        <span class="lv-lang__check" aria-hidden="true">{{ locale === current ? '✓' : '' }}</span>
        <span>{{ LABELS[locale] }}</span>
      </a>
    </div>
  </div>
</template>

<style scoped>
.lv-lang {
  position: relative;
  display: flex;
  align-items: center;
  margin-left: 0.5rem;
}

.lv-lang__button {
  display: inline-flex;
  align-items: center;
  gap: 0.32rem;
  height: 2.25rem;
  padding: 0 0.55rem;
  border: 1px solid var(--lv24-border);
  border-radius: 999px;
  background: var(--lv24-surface);
  color: var(--vp-c-text-2);
  cursor: pointer;
}

.lv-lang__button:hover {
  border-color: var(--lv24-accent);
  color: var(--lv24-accent);
}

.lv-lang__short {
  font-family: var(--lv24-font-mono);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.lv-lang__chevron {
  font-size: 0.7rem;
}

.lv-lang__menu {
  position: absolute;
  top: calc(100% + 0.45rem);
  right: 0;
  z-index: 60;
  min-width: 10.5rem;
  padding: 0.35rem;
  border: 1px solid var(--lv24-border);
  border-radius: 10px;
  background: var(--lv24-surface);
  box-shadow: var(--lv24-shadow);
}

.lv-lang__item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.42rem 0.55rem;
  border-radius: 7px;
  color: var(--vp-c-text-1);
  font-size: 0.86rem;
  text-decoration: none;
}

.lv-lang__item:hover {
  background: var(--lv24-bg-soft);
  color: var(--lv24-accent);
}

.lv-lang__item[aria-current='page'] {
  color: var(--lv24-accent);
  font-weight: 650;
}

.lv-lang__check {
  width: 0.9rem;
  font-size: 0.8rem;
}

/* Desktop has the explicit switcher; below 1280 the built-in translations
   menu stays in the extra (hamburger) menu. */
@media (max-width: 1279px) {
  .lv-lang {
    display: none;
  }
}
</style>

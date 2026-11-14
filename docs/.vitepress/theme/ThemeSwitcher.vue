<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useLocale } from './i18n';

type ThemeMode = 'auto' | 'light' | 'dark';
const STORAGE_KEY = 'vitepress-theme-appearance';

const { t } = useLocale();
const mode = ref<ThemeMode>('auto');
const open = ref(false);
const root = ref<HTMLElement | null>(null);

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function normalize(value: string | null): ThemeMode {
  return value === 'dark' || value === 'light' ? value : 'auto';
}

function resolved(): 'light' | 'dark' {
  if (mode.value === 'auto') return media?.matches ? 'dark' : 'light';
  return mode.value;
}

function apply(): void {
  const value = resolved();
  document.documentElement.classList.toggle('dark', value === 'dark');
  document.documentElement.style.colorScheme = value;
  try {
    localStorage.setItem(STORAGE_KEY, mode.value);
  } catch {
    /* storage may be unavailable */
  }
}

function setMode(next: ThemeMode): void {
  mode.value = next;
  apply();
  open.value = false;
}

function onMediaChange(): void {
  if (mode.value === 'auto') apply();
}

function onDocumentClick(event: MouseEvent): void {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false;
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') open.value = false;
}

const currentLabel = computed(() => {
  if (mode.value === 'auto') return t.value.themeSystem;
  return mode.value === 'dark' ? t.value.themeDark : t.value.themeLight;
});

onMounted(() => {
  try {
    mode.value = normalize(localStorage.getItem(STORAGE_KEY));
  } catch {
    mode.value = 'auto';
  }
  apply();
  media?.addEventListener('change', onMediaChange);
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  media?.removeEventListener('change', onMediaChange);
  document.removeEventListener('click', onDocumentClick);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div ref="root" class="lv-theme">
    <button
      type="button"
      class="lv-theme__button"
      :aria-label="`${t.theme}: ${currentLabel}`"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span v-if="mode === 'auto'" class="lv-theme__auto is-active" aria-hidden="true">A</span>
      <span v-else-if="mode === 'light'" class="vpi-sun" aria-hidden="true" />
      <span v-else class="vpi-moon" aria-hidden="true" />
      <span class="vpi-chevron-down lv-theme__chevron" aria-hidden="true" />
    </button>
    <div v-show="open" class="lv-theme__menu" role="menu">
      <button
        v-for="option in (['auto', 'light', 'dark'] as ThemeMode[])"
        :key="option"
        type="button"
        class="lv-theme__item"
        role="menuitemradio"
        :aria-checked="mode === option"
        @click="setMode(option)"
      >
        <span class="lv-theme__check" aria-hidden="true">{{ mode === option ? '✓' : '' }}</span>
        {{
          option === 'auto'
            ? t.themeSystem
            : option === 'light'
              ? t.themeLight
              : t.themeDark
        }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.lv-theme {
  position: relative;
  display: flex;
  align-items: center;
  margin-left: 0.5rem;
}

.lv-theme__button {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  height: 2.25rem;
  padding: 0 0.55rem;
  border: 1px solid var(--lv24-border);
  border-radius: 999px;
  background: var(--lv24-surface);
  color: var(--vp-c-text-2);
  cursor: pointer;
}

.lv-theme__button:hover {
  border-color: var(--lv24-accent);
  color: var(--lv24-accent);
}

.lv-theme__button .vpi-sun,
.lv-theme__button .vpi-moon {
  font-size: 0.9rem;
}

.lv-theme__button .is-muted {
  opacity: 0.35;
}

.lv-theme__auto {
  font-family: var(--lv24-font-mono);
  font-size: 0.66rem;
  font-weight: 700;
  opacity: 0.45;
}

.lv-theme__auto.is-active {
  color: var(--lv24-accent);
  opacity: 1;
}

.lv-theme__chevron {
  font-size: 0.7rem;
}

.lv-theme__menu {
  position: absolute;
  top: calc(100% + 0.45rem);
  right: 0;
  z-index: 60;
  min-width: 10rem;
  padding: 0.35rem;
  border: 1px solid var(--lv24-border);
  border-radius: 10px;
  background: var(--lv24-surface);
  box-shadow: var(--lv24-shadow);
}

.lv-theme__item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  width: 100%;
  padding: 0.42rem 0.55rem;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--vp-c-text-1);
  font-size: 0.86rem;
  text-align: left;
  cursor: pointer;
}

.lv-theme__item:hover {
  background: var(--lv24-bg-soft);
  color: var(--lv24-accent);
}

.lv-theme__item[aria-checked='true'] {
  color: var(--lv24-accent);
  font-weight: 650;
}

.lv-theme__check {
  width: 0.9rem;
  font-size: 0.8rem;
}

@media (max-width: 1279px) {
  .lv-theme {
    display: none;
  }
}
</style>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { withBase } from 'vitepress';
import { useLocale } from './i18n';

interface BuildInfo {
  version?: string;
  buildId?: string;
}

const { t } = useLocale();
const visible = ref(false);
const version = ref('');
let baseline = '';
let dismissed = '';
let timer: number | undefined;

async function fetchBuild(): Promise<BuildInfo | null> {
  try {
    const response = await fetch(withBase('/version.json'), { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as BuildInfo;
  } catch {
    return null;
  }
}

async function check(): Promise<void> {
  if (document.visibilityState === 'hidden') return;
  const info = await fetchBuild();
  const id = info?.buildId;
  if (!id) return;
  if (!baseline) {
    baseline = id;
    return;
  }
  if (id !== baseline && id !== dismissed) {
    version.value = info?.version ?? '';
    visible.value = true;
  }
}

function reload(): void {
  window.location.reload();
}

function later(): void {
  dismissed = baseline;
  visible.value = false;
}

function onVisible(): void {
  if (document.visibilityState === 'visible') void check();
}

onMounted(() => {
  if (import.meta.env.DEV) return;
  void check();
  timer = window.setInterval(() => void check(), 5 * 60 * 1000);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
});

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer);
  document.removeEventListener('visibilitychange', onVisible);
  window.removeEventListener('focus', onVisible);
});
</script>

<template>
  <div v-if="visible" class="lv-update" role="status" aria-live="polite">
    <div class="lv-update__body">
      <p class="lv-update__title">{{ t.updateTitle }}<span v-if="version"> · v{{ version }}</span></p>
      <p class="lv-update__text">{{ t.updateText }}</p>
    </div>
    <div class="lv-update__actions">
      <button type="button" class="lv-update__later" @click="later">{{ t.updateLater }}</button>
      <button type="button" class="lv-update__reload" @click="reload">{{ t.updateReload }}</button>
    </div>
  </div>
</template>

<style scoped>
.lv-update {
  position: fixed;
  right: 1.25rem;
  bottom: 1.25rem;
  z-index: 90;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.9rem 1.25rem;
  max-width: min(30rem, calc(100vw - 2.5rem));
  padding: 0.9rem 1rem;
  border: 1px solid var(--lv24-accent);
  border-radius: 14px;
  background: var(--lv24-surface);
  box-shadow: var(--lv24-shadow);
}

.lv-update__title {
  margin: 0;
  font-weight: 700;
  font-size: 0.92rem;
  color: var(--vp-c-text-1);
}

.lv-update__text {
  margin: 0.2rem 0 0;
  font-size: 0.84rem;
  color: var(--lv24-text-muted);
}

.lv-update__actions {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
}

.lv-update__later,
.lv-update__reload {
  min-height: 2.1rem;
  padding: 0.35rem 0.85rem;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 650;
  cursor: pointer;
}

.lv-update__later {
  border: 1px solid var(--lv24-border-strong);
  background: transparent;
  color: var(--vp-c-text-1);
}

.lv-update__reload {
  border: 1px solid var(--lv24-accent);
  background: var(--lv24-accent);
  color: var(--lv24-accent-contrast);
}

.lv-update__reload:hover {
  background: var(--lv24-accent-hover);
}

@media (max-width: 640px) {
  .lv-update {
    left: 0.85rem;
    right: 0.85rem;
    bottom: 0.85rem;
    max-width: none;
  }
}
</style>

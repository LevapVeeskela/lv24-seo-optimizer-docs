<script setup lang="ts">
import { ref } from 'vue';
import { useLocale } from './i18n';

const { t } = useLocale();

const props = defineProps<{
  windows: string;
  mac: string;
  linux?: string;
}>();

const tabs = ['Windows', 'macOS', props.linux !== undefined ? 'Linux' : null].filter(
  Boolean,
) as string[];
const active = ref(tabs[0]);
const copied = ref(false);

const codeFor = (tab: string): string =>
  tab === 'Windows' ? props.windows : tab === 'macOS' ? props.mac : (props.linux ?? props.mac);

function copy(text: string): void {
  const done = (): void => {
    copied.value = true;
    window.setTimeout(() => {
      copied.value = false;
    }, 1600);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done, done);
  }
}
</script>

<template>
  <div class="shell-tabs">
    <div role="tablist" :aria-label="t.platformCommands" class="tablist">
      <button
        v-for="tab in tabs"
        :key="tab"
        role="tab"
        type="button"
        :aria-selected="active === tab"
        :tabindex="active === tab ? 0 : -1"
        class="tab"
        @click="active = tab"
        @keydown.left.prevent="active = tabs[(tabs.indexOf(active) + tabs.length - 1) % tabs.length]"
        @keydown.right.prevent="active = tabs[(tabs.indexOf(active) + 1) % tabs.length]"
      >
        {{ tab }}
      </button>
      <span class="lang" aria-hidden="true">sh</span>
    </div>
    <div role="tabpanel" class="panel">
      <pre><code>{{ codeFor(active) }}</code></pre>
      <button type="button" class="copy" @click="copy(codeFor(active))">
        <span class="visually-hidden">{{ t.copyCommandFor }} {{ active }}</span>
        <span aria-hidden="true">{{ copied ? t.copied : t.copy }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.shell-tabs {
  border: 1px solid var(--lv24-code-border);
  border-radius: 12px;
  margin: 1.25rem 0;
  overflow: hidden;
  background: var(--lv24-code-bg);
}

.tablist {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid var(--lv24-code-border);
  background: rgb(255 255 255 / 3%);
}

.tab {
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--lv24-code-muted);
  padding: 0.35rem 0.65rem;
  font-family: var(--lv24-font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  cursor: pointer;
}

.tab:hover {
  color: var(--lv24-code-text);
}

.tab[aria-selected='true'] {
  color: var(--lv24-code-text);
  background: rgb(255 255 255 / 9%);
  box-shadow: inset 0 -2px 0 var(--lv24-accent);
}

.lang {
  margin-left: auto;
  font-family: var(--lv24-font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.06em;
  color: var(--lv24-code-muted);
}

.panel {
  position: relative;
}

.panel pre {
  margin: 0;
  padding: 1rem 1.1rem;
  overflow-x: auto;
}

.panel code {
  font-family: var(--lv24-font-mono);
  font-size: 0.84rem;
  line-height: 1.65;
  color: var(--lv24-code-text);
}

.copy {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  font-family: var(--lv24-font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.05em;
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: 7px;
  background: rgb(255 255 255 / 6%);
  color: var(--lv24-code-text);
  padding: 0.28rem 0.55rem;
  cursor: pointer;
}

.copy:hover {
  background: rgb(255 255 255 / 14%);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>

<script setup lang="ts">
import { computed, ref } from 'vue';
import rawCommands from './commands.json';
import rawTranslations from './commands.i18n.json';
import { useLocale } from './i18n';

interface CliCommand {
  id: string;
  group: string;
  command: string;
  description: string;
}

interface CommandTranslation {
  groups: Record<string, string>;
  descriptions: Record<string, string>;
}

const source = rawCommands as CliCommand[];
const translations = rawTranslations as Record<string, CommandTranslation>;
const { key, t } = useLocale();

// Group names and descriptions are translated; ids and commands never are.
const commands = computed<CliCommand[]>(() => {
  const tr = translations[key.value];
  if (!tr) return source;
  return source.map((cmd) => ({
    ...cmd,
    group: tr.groups[cmd.group] ?? cmd.group,
    description: tr.descriptions[cmd.id] ?? cmd.description,
  }));
});
const filter = ref('');
const copiedId = ref<string | null>(null);

const groups = computed(() => {
  const q = filter.value.trim().toLowerCase();
  const byGroup = new Map<string, CliCommand[]>();
  for (const cmd of commands.value) {
    if (q && !`${cmd.id} ${cmd.group} ${cmd.command} ${cmd.description}`.toLowerCase().includes(q)) {
      continue;
    }
    const list = byGroup.get(cmd.group) ?? [];
    list.push(cmd);
    byGroup.set(cmd.group, list);
  }
  return [...byGroup.entries()];
});

function copy(text: string, id: string): void {
  const done = (): void => {
    copiedId.value = id;
    window.setTimeout(() => {
      copiedId.value = null;
    }, 1600);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done, done);
  }
}
</script>

<template>
  <div class="cli-tables">
    <label class="filter-label" for="cli-filter">{{ t.filterCommands }}</label>
    <input
      id="cli-filter"
      v-model="filter"
      type="search"
      class="filter"
      :placeholder="t.filterPlaceholder"
      autocomplete="off"
    />
    <section v-for="[group, list] in groups" :key="group" :aria-label="group" class="group">
      <h2 class="group-title">
        {{ group }} <span class="count">{{ list.length }}</span>
      </h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">{{ t.command }}</th>
              <th scope="col">{{ t.description }}</th>
              <th scope="col"><span class="visually-hidden">{{ t.copy }}</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cmd in list" :key="cmd.id">
              <td>
                <code :id="`cmd-${cmd.id}`">{{ cmd.command }}</code>
              </td>
              <td class="desc">{{ cmd.description }}</td>
              <td class="cell-copy">
                <button type="button" class="copy" @click="copy(cmd.command, cmd.id)">
                  <span class="visually-hidden">{{ t.copy }} {{ cmd.command }}</span>
                  <svg
                    v-if="copiedId !== cmd.id"
                    viewBox="0 0 16 16"
                    width="12"
                    height="12"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
                    <path d="M10.5 5.5v-2A1.5 1.5 0 0 0 9 2H3.5A1.5 1.5 0 0 0 2 3.5V9a1.5 1.5 0 0 0 1.5 1.5h2" />
                  </svg>
                  <svg
                    v-else
                    viewBox="0 0 16 16"
                    width="12"
                    height="12"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m3 8.5 3 3 7-7" />
                  </svg>
                  <span aria-hidden="true">{{ copiedId === cmd.id ? t.copied : t.copy }}</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <p v-if="groups.length === 0" role="status">{{ t.noMatch }}</p>
  </div>
</template>

<style scoped>
.filter-label {
  display: block;
  margin-bottom: 0.4rem;
  font-family: var(--lv24-font-mono);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}

.filter {
  width: 100%;
  max-width: 30rem;
  padding: 0.6rem 0.85rem 0.6rem 2.4rem;
  border: 1px solid var(--lv24-border);
  border-radius: 10px;
  background-color: var(--lv24-surface);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%237a8896' stroke-width='1.5' stroke-linecap='round'%3E%3Ccircle cx='7' cy='7' r='4.5'/%3E%3Cpath d='m10.5 10.5 3 3'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 0.8rem center;
  background-size: 15px 15px;
  color: var(--vp-c-text-1);
  font-size: 0.9rem;
  margin-bottom: 2rem;
}

.filter:focus-visible {
  outline: 3px solid var(--lv24-accent);
  outline-offset: 2px;
  border-color: var(--lv24-accent);
}

.group {
  margin-bottom: 1.5rem;
}

.group-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 2rem 0 0.85rem;
  padding-top: 0;
  border-top: none;
  font-size: 1.3rem;
  letter-spacing: -0.02em;
}

.count {
  font-family: var(--lv24-font-mono);
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--lv24-accent);
  background: var(--vp-c-brand-soft);
  border-radius: 999px;
  padding: 0.14rem 0.5rem;
}

.table-wrap {
  position: relative;
  overflow-x: auto;
  max-width: 100%;
  border: 1px solid var(--lv24-border);
  border-radius: 12px;
  background: var(--lv24-surface);
}

table {
  display: table;
  width: 100%;
  min-width: 620px;
  border-collapse: collapse;
  overflow: visible;
  font-size: 0.9rem;
}

th,
td {
  text-align: left;
  padding: 0.7rem 0.9rem;
  border-bottom: 1px solid var(--lv24-border);
  vertical-align: top;
}

tbody tr:last-child td {
  border-bottom: none;
}

th {
  background: var(--lv24-bg-soft);
  font-family: var(--lv24-font-mono);
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
  white-space: nowrap;
}

tbody tr:hover {
  background: color-mix(in srgb, var(--lv24-bg-soft) 55%, transparent);
}

code {
  font-family: var(--lv24-font-mono);
  font-size: 0.82rem;
  color: var(--vp-c-text-1);
  white-space: nowrap;
}

.desc {
  color: var(--vp-c-text-2);
  min-width: 18rem;
}

.cell-copy {
  text-align: right;
  width: 1%;
  white-space: nowrap;
}

.copy {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-family: var(--lv24-font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.05em;
  border: 1px solid var(--lv24-border);
  border-radius: 7px;
  background: var(--lv24-bg-soft);
  color: var(--vp-c-text-2);
  padding: 0.3rem 0.55rem;
  cursor: pointer;
  transition:
    border-color 140ms ease,
    color 140ms ease;
}

.copy:hover {
  border-color: var(--lv24-accent);
  color: var(--lv24-accent);
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

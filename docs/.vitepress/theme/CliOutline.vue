<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vitepress';
import { useLocale } from './i18n';

const { t } = useLocale();
const route = useRoute();

interface OutlineItem {
  id: string;
  text: string;
}

const items = ref<OutlineItem[]>([]);
const active = ref('');
let observer: IntersectionObserver | null = null;

function collect(): void {
  const heads = Array.from(
    document.querySelectorAll<HTMLElement>('.vp-doc h2.group-title'),
  );
  items.value = heads.map((head, index) => {
    if (!head.id) head.id = `cli-group-${index}`;
    return { id: head.id, text: (head.textContent ?? '').replace(/\s+\d+\s*$/, '').trim() };
  });
  observer?.disconnect();
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) active.value = (entry.target as HTMLElement).id;
      }
    },
    { rootMargin: '-96px 0px -62% 0px' },
  );
  heads.forEach((head) => observer?.observe(head));
}

function refresh(): void {
  collect();
  // The command table renders after hydration; re-read once it settles.
  window.setTimeout(collect, 300);
}

onMounted(refresh);
// The aside survives client-side navigation (including a language switch).
watch(() => route.path, refresh, { flush: 'post' });

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <nav v-if="items.length" class="cli-outline" :aria-label="t.commandGroups">
    <p class="title">{{ t.commandGroups }}</p>
    <ul>
      <li v-for="item in items" :key="item.id">
        <a
          :href="`#${item.id}`"
          :class="{ active: active === item.id }"
          @click="active = item.id"
        >
          {{ item.text }}
        </a>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.cli-outline {
  margin-top: 1rem;
}

.title {
  margin: 0 0 0.5rem;
  padding-left: 0.75rem;
  font-size: 0.95rem;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--vp-c-text-1);
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
  border-left: 1px solid var(--lv24-border);
}

li {
  margin: 0;
}

a {
  display: block;
  padding: 0.18rem 0 0.18rem 0.75rem;
  margin-left: -1px;
  border-left: 2px solid transparent;
  font-size: 0.8rem;
  line-height: 1.45;
  color: var(--vp-c-text-3);
  text-decoration: none;
}

a:hover,
a.active {
  color: var(--lv24-accent);
  border-left-color: var(--lv24-accent);
}
</style>

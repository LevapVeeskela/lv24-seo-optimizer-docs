<script setup lang="ts">
import { useLocale } from './i18n';
import UpdatePrompt from './UpdatePrompt.vue';

const { t, link } = useLocale();
</script>

<template>
  <footer class="lv-footer">
    <div class="lv-footer__inner">
      <a class="lv-footer__brand" :href="link('/')">
        <span class="lv-footer__mark" aria-hidden="true"><BrandMark /></span>
        <span class="lv-footer__name">LV24 SEO Optimizer</span>
      </a>
      <p class="lv-footer__meta">Apache-2.0 · engine 0.5.2 · desktop 0.2.2</p>
      <nav class="lv-footer__links" :aria-label="t.footer">
        <a :href="link('/start/')">{{ t.quickstart }}</a>
        <a :href="link('/reference/cli/')">{{ t.cli }}</a>
        <a :href="link('/security/')">{{ t.security }}</a>
        <a :href="link('/desktop/')">{{ t.desktop }}</a>
        <a :href="link('/faq/')">{{ t.faq }}</a>
      </nav>
    </div>
  </footer>
  <UpdatePrompt />
</template>

<style scoped>
.lv-footer {
  border-top: 1px solid var(--lv24-border);
  background: var(--lv24-bg-soft);
  margin-top: 0;
}

.lv-footer__inner {
  width: min(1440px, 100% - 2.5rem);
  margin-inline: auto;
  min-height: 3.75rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.25rem;
  padding-block: 0.9rem;
}

.lv-footer__brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--vp-c-text-1);
  text-decoration: none;
  font-weight: 700;
  letter-spacing: -0.015em;
}

.lv-footer__mark {
  display: inline-flex;
  color: var(--lv24-accent);
}

.lv-footer__meta {
  margin: 0;
  font-family: var(--lv24-font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.03em;
  color: var(--vp-c-text-3);
}

.lv-footer__links {
  margin-left: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.lv-footer__links a {
  font-size: 0.8rem;
  color: var(--vp-c-text-3);
  text-decoration: none;
}

.lv-footer__links a:hover {
  color: var(--lv24-accent);
}

@media (max-width: 640px) {
  .lv-footer__links {
    margin-left: 0;
    width: 100%;
  }
}
</style>

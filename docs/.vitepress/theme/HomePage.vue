<script setup lang="ts">
import { computed, ref } from 'vue';
import { useLocale } from './i18n';
import { HOME } from './home.i18n';

const installCommand = 'uv tool install lv24-seo';
const altCommand = 'npx @lv24/seo';
const copied = ref(false);

function copyInstall(): void {
  const done = (): void => {
    copied.value = true;
    window.setTimeout(() => {
      copied.value = false;
    }, 1600);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(installCommand).then(done, done);
  }
}

const { key, link } = useLocale();
const copy = computed(() => HOME[key.value]);
</script>

<template>
  <main id="main-content" class="home">
    <section class="hero" aria-labelledby="home-title">
      <div class="shell hero-inner">
        <p class="eyebrow">{{ copy.eyebrow }}</p>
        <h1 id="home-title" class="display">{{ copy.title }}</h1>
        <p class="lead">{{ copy.lead }}</p>
        <div class="actions">
          <a class="btn btn-primary" :href="link('/start/')">
            {{ copy.ctaStart }} <span aria-hidden="true">→</span>
          </a>
          <a class="btn btn-secondary" :href="link('/reference/cli/')">{{ copy.ctaCli }}</a>
        </div>
        <div class="command">
          <code>{{ installCommand }}</code>
          <span class="command-lang" aria-hidden="true">sh</span>
          <button type="button" class="command-copy" @click="copyInstall">
            <span class="visually-hidden">{{ copy.copyInstall }}</span>
            <span aria-hidden="true">{{ copied ? copy.copied : copy.copy }}</span>
          </button>
        </div>
        <p class="command-alt">
          {{ copy.altInstall }} <code>{{ altCommand }}</code>
        </p>
      </div>
    </section>

    <section class="shell points" :aria-label="copy.whyLabel">
      <div v-for="point in copy.points" :key="point.title" class="point">
        <h2 class="point-title">{{ point.title }}</h2>
        <p class="point-text">{{ point.text }}</p>
      </div>
    </section>

    <section class="shell start-here" aria-labelledby="start-title">
      <header class="section-head">
        <p class="eyebrow">{{ copy.startEyebrow }}</p>
        <h2 id="start-title" class="section-title">{{ copy.startTitle }}</h2>
      </header>
      <ul class="cards">
        <li v-for="item in copy.paths" :key="item.num">
          <a class="card" :href="link(item.href)">
            <span class="card-num">{{ item.num }}</span>
            <span class="card-title">{{ item.title }}</span>
            <span class="card-text">{{ item.text }}</span>
            <span class="card-cta">{{ item.cta }} <span aria-hidden="true">→</span></span>
          </a>
        </li>
      </ul>
    </section>

    <section class="surfaces" aria-labelledby="surfaces-title">
      <div class="shell">
        <header class="section-head">
          <p class="eyebrow">{{ copy.surfacesEyebrow }}</p>
          <h2 id="surfaces-title" class="section-title">{{ copy.surfacesTitle }}</h2>
        </header>
        <div class="surface-grid">
          <a
            v-for="surface in copy.surfaces"
            :key="surface.tag"
            class="surface-card"
            :href="link(surface.href)"
          >
            <code class="surface-tag">{{ surface.tag }}</code>
            <span class="surface-text">{{ surface.text }}</span>
          </a>
        </div>
      </div>
    </section>

    <p class="shell source-note">
      {{ copy.sourceNote }} <code>_source/engine-README.md</code>,
      <code>_source/engine-cli.md</code>, <code>_source/desktop-README.md</code>.
    </p>
  </main>
</template>

<style scoped>
.home {
  padding-bottom: 3rem;
}

.shell {
  width: min(1120px, 100% - 2.5rem);
  margin-inline: auto;
}

/* Hero */
.hero {
  position: relative;
  overflow: hidden;
  padding-block: clamp(3rem, 6vw, 5.25rem) clamp(2rem, 4vw, 3.25rem);
  background:
    radial-gradient(
      60rem 32rem at 6% -12%,
      color-mix(in srgb, var(--lv24-accent) 15%, transparent),
      transparent 70%
    ),
    radial-gradient(
      44rem 26rem at 100% 0%,
      color-mix(in srgb, var(--lv24-accent) 8%, transparent),
      transparent 65%
    );
  border-bottom: 1px solid var(--lv24-border);
}

.hero-inner {
  display: grid;
  gap: 1.05rem;
  justify-items: start;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-family: var(--lv24-font-mono);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--lv24-accent);
}

.eyebrow::before {
  content: '';
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: currentColor;
}

.display {
  margin: 0;
  max-width: 21ch;
  font-size: clamp(2.35rem, 4.6vw + 0.6rem, 3.9rem);
  line-height: 1.06;
  font-weight: 760;
  letter-spacing: -0.04em;
  text-wrap: balance;
  color: var(--vp-c-text-1);
}

.lead {
  margin: 0;
  max-width: 58ch;
  font-size: clamp(1rem, 0.4vw + 0.94rem, 1.14rem);
  line-height: 1.6;
  color: var(--lv24-text-muted);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 2.75rem;
  padding: 0.6rem 1.2rem;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 0.95rem;
  font-weight: 650;
  text-decoration: none;
  transition:
    background-color 150ms ease,
    border-color 150ms ease,
    color 150ms ease,
    transform 150ms ease;
}

.btn:hover {
  transform: translateY(-1px);
}

.btn-primary {
  background: var(--lv24-accent);
  color: var(--lv24-accent-contrast);
}

.btn-primary:hover {
  background: var(--lv24-accent-hover);
  color: var(--lv24-accent-contrast);
}

.btn-secondary {
  background: var(--lv24-surface);
  border-color: var(--lv24-border-strong);
  color: var(--vp-c-text-1);
}

.btn-secondary:hover {
  border-color: var(--lv24-accent);
  color: var(--vp-c-text-1);
}

/* Command strip */
.command {
  position: relative;
  width: min(100%, 760px);
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.95rem 1.1rem;
  border: 1px solid var(--lv24-code-border);
  border-radius: 12px;
  background: var(--lv24-code-bg);
  overflow-x: auto;
}

.command code {
  font-family: var(--lv24-font-mono);
  font-size: 0.88rem;
  color: var(--lv24-code-text);
  white-space: nowrap;
}

.command-lang {
  margin-left: auto;
  font-family: var(--lv24-font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.06em;
  color: var(--lv24-code-muted);
}

.command-copy {
  flex-shrink: 0;
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: 7px;
  background: rgb(255 255 255 / 6%);
  color: var(--lv24-code-text);
  font-family: var(--lv24-font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.05em;
  padding: 0.3rem 0.55rem;
  cursor: pointer;
}

.command-copy:hover {
  background: rgb(255 255 255 / 14%);
}

.command-alt {
  margin: -0.15rem 0 0;
  font-size: 0.84rem;
  color: var(--vp-c-text-3);
}

.command-alt code {
  font-family: var(--lv24-font-mono);
  font-size: 0.86em;
  color: var(--lv24-accent);
}

/* Value points */
.points {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
  gap: clamp(1.25rem, 3vw, 2.5rem);
  padding-block: clamp(2.5rem, 4vw, 3.5rem);
}

.point {
  padding-top: 1rem;
  border-top: 2px solid var(--lv24-accent);
}

.point-title {
  margin: 0 0 0.4rem;
  font-size: 1.02rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--vp-c-text-1);
}

.point-text {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.55;
  color: var(--lv24-text-muted);
}

/* Sections */
.section-head {
  display: grid;
  gap: 0.35rem;
  margin-bottom: 1.75rem;
}

.section-head .eyebrow {
  font-size: 0.68rem;
}

.section-title {
  margin: 0;
  font-size: clamp(1.5rem, 1.5vw + 1rem, 2rem);
  letter-spacing: -0.025em;
  color: var(--vp-c-text-1);
}

/* Cards */
.start-here {
  padding-block: clamp(2rem, 4vw, 3rem);
}

.cards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
  gap: 1rem;
}

.cards li {
  margin: 0;
}

.card {
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  gap: 0.4rem;
  height: 100%;
  padding: 1.2rem 1.25rem;
  border: 1px solid var(--lv24-border);
  border-radius: var(--lv24-radius);
  background: var(--lv24-surface);
  box-shadow: var(--lv24-shadow-sm);
  text-decoration: none;
  transition:
    border-color 160ms ease,
    transform 160ms ease,
    box-shadow 160ms ease;
}

.card:hover {
  border-color: var(--lv24-accent);
  transform: translateY(-2px);
  box-shadow: var(--lv24-shadow);
}

.card-num {
  font-family: var(--lv24-font-mono);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--lv24-accent);
}

.card-title {
  font-size: 1.04rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--vp-c-text-1);
}

.card-text {
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--lv24-text-muted);
}

.card-cta {
  margin-top: 0.35rem;
  font-size: 0.82rem;
  font-weight: 650;
  color: var(--lv24-accent);
}

/* Surfaces */
.surfaces {
  padding-block: clamp(2rem, 4vw, 3.25rem);
  background: var(--lv24-bg-soft);
  border-block: 1px solid var(--lv24-border);
}

.surface-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: 1rem;
}

.surface-card {
  display: grid;
  gap: 0.55rem;
  padding: 1.1rem 1.2rem;
  border: 1px solid var(--lv24-border);
  border-radius: var(--lv24-radius);
  background: var(--lv24-surface);
  text-decoration: none;
  transition:
    border-color 160ms ease,
    transform 160ms ease;
}

.surface-card:hover {
  border-color: var(--lv24-accent);
  transform: translateY(-2px);
}

.surface-tag {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.55rem;
  font-family: var(--lv24-font-mono);
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.06em;
  color: var(--lv24-accent);
  background: var(--vp-c-brand-soft);
  border-radius: 999px;
  padding: 0.3rem 0.7rem;
}

.surface-text {
  font-size: 0.9rem;
  line-height: 1.55;
  color: var(--lv24-text-muted);
}

/* Source note */
.source-note {
  margin-top: 2.5rem;
  font-size: 0.8rem;
  color: var(--vp-c-text-3);
}

.source-note code {
  font-family: var(--lv24-font-mono);
  font-size: 0.92em;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .btn:hover,
  .card:hover,
  .surface-card:hover {
    transform: none;
  }
}

@media (max-width: 640px) {
  .shell {
    width: min(1120px, 100% - 1.75rem);
  }

  .command {
    flex-wrap: wrap;
  }

  .command code {
    white-space: normal;
    overflow-wrap: anywhere;
  }
}
</style>

// Quality gate: node ./scripts/check.mjs (no dependencies).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const docs = join(root, 'docs');
let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`FAIL: ${msg}`);
};

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '.vitepress') continue;
      out.push(...walk(f));
    } else if (e.name.endsWith('.md')) out.push(f);
  }
  return out;
}

const pages = walk(docs);
const routeOf = (f) => {
  const rel = f.slice(docs.length).replace(/\\/g, '/');
  if (rel === '/404.md') return null;
  return rel.endsWith('/index.md') ? rel.slice(0, -'/index.md'.length) + '/' || '/' : rel.slice(0, -3);
};

// 1. Every _source file is mapped in _source/MAP.md.
{
  const map = readFileSync(join(root, '_source', 'MAP.md'), 'utf8');
  const listed = readdirSync(join(root, '_source')).filter((n) => n.endsWith('.md'));
  for (const n of listed) {
    if (n === 'MAP.md' || n === 'README.md') continue;
    if (!map.includes(n)) fail(`_source/${n} is not mapped in _source/MAP.md`);
  }
  console.log(`source map: checked ${listed.length} snapshot files`);
}

// 2. Every page has title and description.
for (const f of pages) {
  const text = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  const rel = f.slice(root.length);
  if (!m) {
    fail(`${rel} has no frontmatter`);
    continue;
  }
  if (!/^title: .+/m.test(m[1])) fail(`${rel} frontmatter lacks title`);
  if (!/^description: .+/m.test(m[1])) fail(`${rel} frontmatter lacks description`);
}
console.log(`frontmatter: checked ${pages.length} pages`);

// 3. Every internal link resolves (file + anchor).
function slugify(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[*_`~[\](){}!#$%^+=>|/\\:'",.?]/g, '')
    .replace(/\s+/g, '-');
}
function fileForRoute(route) {
  if (route === '/') return join(docs, 'index.md');
  const clean = route.replace(/\/$/, '');
  const asDir = join(docs, clean, 'index.md');
  if (existsSync(asDir)) return asDir;
  const asFile = join(docs, `${clean}.md`);
  if (existsSync(asFile)) return asFile;
  return null;
}
function anchorsOf(file) {
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const set = new Set();
  // Markdown headings.
  for (const m of text.matchAll(/^#{1,6}\s+(.+)$/gm)) set.add(slugify(m[1]));
  // Vue component anchors and explicit ids are not validated; only markdown headings.
  return set;
}
{
  let checked = 0;
  for (const f of pages) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/\]\(([^)]+)\)/g)) {
      const target = m[1];
      if (/^(https?:|mailto:|#|{|data:)/.test(target)) continue;
      const hash = target.indexOf('#');
      const path = (hash === -1 ? target : target.slice(0, hash)) || '/';
      const anchor = hash === -1 ? null : target.slice(hash + 1);
      if (!path.startsWith('/')) {
        fail(`${f.slice(root.length)} has non-absolute internal link: ${target}`);
        continue;
      }
      const file = fileForRoute(path);
      if (!file) {
        fail(`${f.slice(root.length)} links to missing route: ${target}`);
        continue;
      }
      if (anchor && !anchorsOf(file).has(anchor)) {
        fail(`${f.slice(root.length)} links to missing anchor: ${target}`);
      }
      checked += 1;
    }
  }
  console.log(`internal links: checked ${checked}`);
}

// 4. CLI reference: unique ids, non-empty commands.
{
  const cmds = JSON.parse(readFileSync(join(docs, '.vitepress', 'theme', 'commands.json'), 'utf8'));
  const ids = new Set();
  for (const c of cmds) {
    if (!c.id || ids.has(c.id)) fail(`CLI entry has duplicate or empty id: ${JSON.stringify(c)}`);
    ids.add(c.id);
    if (!c.command || !c.command.trim()) fail(`CLI entry ${c.id} has empty command`);
    if (!c.group || !c.description) fail(`CLI entry ${c.id} lacks group or description`);
  }
  console.log(`CLI reference: checked ${cmds.length} commands`);
}

// 5. Sidebar contains every page.
{
  const config = readFileSync(join(docs, '.vitepress', 'config.mts'), 'utf8');
  for (const f of pages) {
    const route = routeOf(f);
    if (!route || route === '/' || /\/404$/.test(route)) continue;
    // Sidebars are declared once with locale-neutral routes and prefixed per
    // locale, so check the neutral route against the shared route groups.
    const neutral = route.replace(/^\/(ru|zh)(?=\/)/, '');
    if (!config.includes(`'${neutral}'`)) fail(`sidebar config lacks route ${route}`);
  }
  console.log(`sidebar: checked ${pages.filter((f) => routeOf(f)).length} routes`);
}

// 6. Locale parity: every English page exists in ru/ and zh/, with identical
// code fences (commands and samples must not drift between languages).
{
  const locales = ['ru', 'zh'];
  const fences = (file) => {
    const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    return [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) =>
      m[1].trim(),
    );
  };
  const relOf = (file) => file.slice(docs.length + 1).replace(/\\/g, '/');
  const enPages = pages.filter((f) => {
    const rel = relOf(f);
    return !rel.startsWith('ru/') && !rel.startsWith('zh/');
  });
  for (const file of enPages) {
    const rel = relOf(file);
    const enFences = fences(file);
    for (const locale of locales) {
      const target = join(docs, locale, rel);
      if (!existsSync(target)) {
        fail(`locale ${locale} lacks page ${rel}`);
        continue;
      }
      if (JSON.stringify(enFences) !== JSON.stringify(fences(target))) {
        fail(`locale ${locale} code blocks differ from English: ${rel}`);
      }
    }
  }
  console.log(`locale parity: checked ${enPages.length} pages x ${locales.length} locales`);
}

if (failures > 0) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
console.log('all checks passed');

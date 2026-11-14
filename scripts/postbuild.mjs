// Post-build: move VitePress's inline data script (hash map + site data) into a
// classic external script. The edge CSP allows only same-origin scripts and two
// stable inline hashes; this script's content changes with every build, so it
// must not stay inline.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.argv[2] || 'docs/.vitepress/dist';
const base = process.env.DOCS_BASE || '/';

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const written = new Set();
let changed = 0;

for (const file of walk(dist)) {
  const html = readFileSync(file, 'utf8');
  const next = html.replace(
    /<script>window\.__VP_HASH_MAP__[\s\S]*?<\/script>/g,
    (tag) => {
      const js = tag.replace(/^<script>/, '').replace(/<\/script>$/, '');
      const hash = createHash('sha256').update(js).digest('hex').slice(0, 12);
      const name = `vp-data.${hash}.js`;
      const target = join(dist, 'assets', name);
      if (!written.has(name)) {
        writeFileSync(target, js);
        written.add(name);
      }
      changed += 1;
      return `<script src="${base}assets/${name}"></script>`;
    },
  );
  if (next !== html) writeFileSync(file, next);
}

// Build marker for the "documentation updated" prompt. The client fetches it
// without caching and offers a reload when the id changes under an open tab.
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const buildId = `${pkg.version}-${Date.now().toString(36)}`;
writeFileSync(
  join(dist, 'version.json'),
  `${JSON.stringify({ version: pkg.version, buildId }, null, 2)}\n`,
);

console.log(`externalized ${changed} inline data script(s), ${written.size} file(s)`);
console.log(`version marker: ${buildId}`);

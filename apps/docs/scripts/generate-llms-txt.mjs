// Generates public/llms.txt (index) and public/llms-full.txt (full content)
// from src/content/docs, in sidebar order. Self-checks its slug list.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = join(root, 'src', 'content', 'docs');
const SITE = 'https://mycl.dev';

// Keep in sync with the sidebar in astro.config.mjs (build fails loudly if a slug is missing).
const SECTIONS = [
  ['Getting Started', ['getting-started/introduction', 'getting-started/installation', 'getting-started/quick-start']],
  ['Guide', ['guide/channels', 'guide/capabilities', 'guide/scopes', 'guide/registries-and-layers', 'guide/factories', 'guide/augmentation', 'guide/layer-strategies', 'guide/snapshots-and-async']],
  ['Advanced', ['advanced/core-substrate', 'advanced/building-a-kernel', 'advanced/type-guarantees', 'advanced/duplicate-detection', 'advanced/concepts']],
  ['Reference', ['reference/core', 'reference/glossary', 'reference/changelog']],
  ['For Agents', ['agents/using-mycl']],
];

const cook = (raw) => new Function('return `' + raw + '`;')();

function loadPage(slug) {
  const base = join(docsDir, slug);
  const path = ['.mdx', '.md'].map((e) => base + e).find(existsSync);
  if (!path) throw new Error(`llms-txt: no file for slug '${slug}' — update SECTIONS`);
  const raw = readFileSync(path, 'utf8');
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  const meta = fm ? fm[1] : '';
  const title = (meta.match(/^title:\s*(.+)$/m)?.[1] ?? slug).trim().replace(/^['"]|['"]$/g, '');
  const description = (meta.match(/^description:\s*(.+)$/m)?.[1] ?? '').trim().replace(/^['"]|['"]$/g, '');
  let body = raw.slice(fm ? fm[0].length : 0);
  // Strip ONLY the Playground component import — a broad /^import/ strip would
  // also delete import lines inside fenced code examples.
  body = body.replace(/^import\s+Playground\s+from\s+.+$/gm, '');
  body = body.replace(/<Playground[^>]*code=\{`((?:\\[\s\S]|[^`\\])*)`\}[^>]*\/>/g,
    (_, code) => '```ts\n' + cook(code).trim() + '\n```');
  return { title, description, body: body.trim() };
}

let index = `# mycl\n\n> connect your code — a capability/registry system for TypeScript.\n> Errors resolve at ${SITE}/errors/<code>. Full docs text: ${SITE}/llms-full.txt\n`;
let full = '';
for (const [section, slugs] of SECTIONS) {
  index += `\n## ${section}\n\n`;
  for (const slug of slugs) {
    const { title, description, body } = loadPage(slug);
    index += `- [${title}](${SITE}/${slug}/): ${description}\n`;
    full += `# ${title}\n\n> ${description}\n\n${body}\n\n---\n\n`;
  }
}
mkdirSync(join(root, 'public'), { recursive: true });
writeFileSync(join(root, 'public', 'llms.txt'), index);
writeFileSync(join(root, 'public', 'llms-full.txt'), full);
console.log('wrote public/llms.txt and public/llms-full.txt');

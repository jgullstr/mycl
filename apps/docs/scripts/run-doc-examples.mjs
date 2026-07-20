// Extracts every Playground code={`...`} block from src/content/docs, plus every
// standalone example in src/examples (imported into pages via ?raw), and runs
// each in its own Node process against the built workspace packages.
// Usage: node scripts/run-doc-examples.mjs [pathFilter]
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { transform } from 'sucrase';
import { rewriteImports } from '../src/recipes-ui/imports.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = join(root, 'src', 'content', 'docs');
const tmpDir = join(root, 'scripts', '.examples-tmp');
const filter = process.argv[2] ?? '';

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.mdx?$/.test(name)) yield p;
  }
}

function* walkTs(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walkTs(p);
    else if (/\.ts$/.test(name)) yield p;
  }
}

// Node ESM needs explicit relative extensions. Map './x' and './x.ts' -> './x.js'.
const toNodeSpec = (spec) => (spec.startsWith('.') ? spec.replace(/(\.ts)?$/, '.js') : null);

// Template-literal span: escaped char or any char that is not a backtick/backslash.
const EMBED_RE = /code=\{`((?:\\[\s\S]|[^`\\])*)`\}/g;

// Cook the raw span exactly like JS would. Unescaped ${...} throws -> caught
// below and reported as a failure (it means the page author forgot \${).
function cook(raw) {
  return new Function('return `' + raw + '`;')();
}

rmSync(tmpDir, { recursive: true, force: true });
mkdirSync(tmpDir, { recursive: true });

let total = 0, failures = 0;

// Transpile one TS example and run it in its own Node process.
function runExample(ts, id, outName) {
  total++;
  try {
    const js = transform(ts, { transforms: ['typescript'] }).code;
    const out = join(tmpDir, outName);
    writeFileSync(out, js);
    const res = spawnSync(process.execPath, [out], { cwd: root, timeout: 10_000, encoding: 'utf8' });
    if (res.status !== 0) {
      failures++;
      console.error(`FAIL ${id}\n${res.stderr || res.stdout || '(timeout)'}`);
    } else {
      console.log(`PASS ${id}`);
    }
  } catch (err) {
    failures++;
    console.error(`FAIL ${id} (extract/transform): ${err.message}`);
  }
}

for (const file of walk(docsDir)) {
  const rel = relative(docsDir, file).replace(/\\/g, '/');
  if (rel.startsWith('errors/')) continue; // generated pages
  if (filter && !rel.includes(filter)) continue;
  const text = readFileSync(file, 'utf8');
  EMBED_RE.lastIndex = 0; // module-level /g regex: reset per file or matches get skipped
  let m, i = 0;
  while ((m = EMBED_RE.exec(text))) {
    const id = `${rel} #${i++}`;
    // Cook may throw (author forgot \${) -> report as a failure, same as before.
    let ts;
    try {
      ts = cook(m[1]);
    } catch (err) {
      total++;
      failures++;
      console.error(`FAIL ${id} (extract/transform): ${err.message}`);
      continue;
    }
    runExample(ts, id, rel.replace(/[\\/]/g, '__') + `.${i}.mjs`);
  }
}

// Standalone example files: real TS modules, no template-literal cooking needed.
const examplesDir = join(root, 'src', 'examples');
if (existsSync(examplesDir)) {
  for (const name of readdirSync(examplesDir).filter((n) => /\.ts$/.test(n)).sort()) {
    const id = `examples/${name}`;
    if (filter && !id.includes(filter)) continue;
    runExample(readFileSync(join(examplesDir, name), 'utf8'), id, `examples__${name}.mjs`);
  }
}

// ── Recipes: run each src/recipes/<slug> as a real module graph ────────────
const recipesDir = join(root, 'src', 'recipes');
if (existsSync(recipesDir)) {
  for (const slug of readdirSync(recipesDir).sort()) {
    const dir = join(recipesDir, slug);
    if (!statSync(dir).isDirectory()) continue; // skips manifest.ts
    const id = `recipes/${slug}`;
    if (filter && !id.includes(filter)) continue;
    total++;
    try {
      const outDir = join(tmpDir, `recipe__${slug}`);
      for (const abs of walkTs(dir)) {
        const rel = relative(dir, abs).replace(/\\/g, '/');
        const js = transform(readFileSync(abs, 'utf8'), { transforms: ['typescript'] }).code;
        const rewritten = rewriteImports(js, toNodeSpec);
        const outFile = join(outDir, rel.replace(/\.ts$/, '.js'));
        mkdirSync(dirname(outFile), { recursive: true });
        writeFileSync(outFile, rewritten);
      }
      const res = spawnSync(process.execPath, [join(outDir, 'recipe.js')], {
        cwd: root, timeout: 10_000, encoding: 'utf8',
      });
      if (res.status !== 0) {
        failures++;
        console.error(`FAIL ${id}\n${res.stderr || res.stdout || '(timeout)'}`);
      } else {
        console.log(`PASS ${id}`);
      }
    } catch (err) {
      failures++;
      console.error(`FAIL ${id} (extract/transform): ${err.message}`);
    }
  }
}

console.log(`\n${total - failures}/${total} examples passed`);
process.exit(failures ? 1 : 0);

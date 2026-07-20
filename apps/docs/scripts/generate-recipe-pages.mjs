import { build } from 'esbuild';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Generate one Starlight page per recipe, served at /recipes/<slug>/. The single
// source of truth is src/recipes/manifest.ts; we bundle it and read it directly
// so the pages can never drift from the manifest. Mirrors generate-error-pages.mjs.

const here = dirname(fileURLToPath(import.meta.url));
const manifestSrc = resolve(here, '../src/recipes/manifest.ts');
const outDir = resolve(here, '../src/content/docs/recipes');

const res = await build({
  entryPoints: [manifestSrc],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  write: false,
  logLevel: 'silent',
});
const bundled = Buffer.from(res.outputFiles[0].contents).toString('utf8');
const mod = await import(`data:text/javascript,${encodeURIComponent(bundled)}`);
const recipes = mod.recipes;

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const [i, r] of recipes.entries()) {
  const page = `---
title: ${JSON.stringify(r.title)}
description: ${JSON.stringify(r.blurb)}
tableOfContents: false
prev: false
next: false
sidebar:
  order: ${i + 1}
---
import RecipeApp from '../../../recipes-ui/RecipeApp.tsx';

<div class="recipe-full">
  <RecipeApp client:only="react" slug="${r.slug}" />
</div>
`;
  await writeFile(resolve(outDir, `${r.slug}.mdx`), page);
}

console.log(`Generated ${recipes.length} recipe pages: src/content/docs/recipes/`);

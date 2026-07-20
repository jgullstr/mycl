import { useMemo } from 'react';
import { buildFileTree } from './tree.mjs';
import { recipes, type RecipeMeta } from '../recipes/manifest';

// Eagerly load every recipe file's raw source at build time. Keys look like
// '/src/recipes/hero/capabilities/greet.ts'.
const RAW = import.meta.glob('/src/recipes/*/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

interface TreeNode { name: string; path?: string; children?: TreeNode[] }

export interface LoadedRecipe {
  meta: RecipeMeta;
  files: Record<string, string>; // recipe-relative path -> source
  entry: string;
  tree: TreeNode[];
}

export function useRecipe(slug: string): LoadedRecipe {
  return useMemo(() => {
    const meta = recipes.find((r) => r.slug === slug);
    if (!meta) throw new Error(`Unknown recipe: ${slug}`);
    const prefix = `/src/recipes/${slug}/`;
    const files: Record<string, string> = {};
    for (const [abs, source] of Object.entries(RAW)) {
      if (abs.startsWith(prefix)) files[abs.slice(prefix.length)] = source;
    }
    return { meta, files, entry: 'recipe.ts', tree: buildFileTree(Object.keys(files)) };
  }, [slug]);
}

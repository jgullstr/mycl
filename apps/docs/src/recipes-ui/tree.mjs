const ENTRY = 'recipe.ts';

/**
 * Build a display tree from recipe-relative file paths. Entry first, then root
 * files (alpha), then folders (alpha) with their files (alpha).
 */
export function buildFileTree(paths) {
  const rootFiles = [];
  const folders = new Map(); // name -> string[]
  for (const p of paths) {
    const slash = p.indexOf('/');
    if (slash === -1) rootFiles.push(p);
    else {
      const folder = p.slice(0, slash);
      if (!folders.has(folder)) folders.set(folder, []);
      folders.get(folder).push(p);
    }
  }
  const byName = (a, b) => a.localeCompare(b);
  rootFiles.sort((a, b) => (a === ENTRY ? -1 : b === ENTRY ? 1 : byName(a, b)));

  const fileNodes = rootFiles.map((p) => ({ name: p, path: p }));
  const folderNodes = [...folders.keys()].sort(byName).map((name) => ({
    name,
    children: folders.get(name).sort(byName).map((p) => ({ name: p.slice(name.length + 1), path: p })),
  }));
  return [...fileNodes, ...folderNodes];
}

/** Neighboring recipes for prev/next navigation. */
export function prevNext(recipes, slug) {
  const i = recipes.findIndex((r) => r.slug === slug);
  return {
    prev: i > 0 ? recipes[i - 1] : null,
    next: i >= 0 && i < recipes.length - 1 ? recipes[i + 1] : null,
  };
}

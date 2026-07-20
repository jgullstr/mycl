import { resolveRelative, toVirtualKey, rewriteImports } from './imports.mjs';
import { buildSrcDoc, IFRAME_RUNTIME } from './srcdoc.mjs';

/**
 * Prepare a runnable iframe document from a set of recipe files.
 * Pure given injected `transpile(ts)=>js` and `makeUrl(js)=>url`.
 *
 * @param {{ files: Record<string,string>, entry: string, coreUrl: string,
 *           transpile: (ts:string)=>string, makeUrl: (js:string)=>string }} opts
 * @returns {{ srcdoc: string, urls: string[] }}
 */
export function prepareRun({ files, entry, coreUrl, transpile, makeUrl }) {
  const paths = Object.keys(files);
  const known = new Set(paths);
  // Both specifiers resolve to the same blob URL, so they share one evaluated
  // module instance (the bundle inlines main + /helpers together).
  const imports = { '@mycl/core': coreUrl, '@mycl/core/helpers': coreUrl };
  const urls = [];
  for (const path of paths) {
    const js = transpile(files[path]);
    const resolveSpec = (spec) =>
      spec.startsWith('.') ? toVirtualKey(resolveRelative(path, spec, known)) : null;
    const rewritten = rewriteImports(js, resolveSpec);
    const url = makeUrl(rewritten);
    imports[toVirtualKey(path)] = url;
    urls.push(url);
  }
  const srcdoc = buildSrcDoc({ imports, runtime: IFRAME_RUNTIME, entryKey: toVirtualKey(entry) });
  return { srcdoc, urls };
}

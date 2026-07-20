// Pure, browser-safe helpers for resolving and rewriting recipe module imports.
// Paths are recipe-relative: no leading slash, '/'-separated, with '.ts' extension.

/** Directory portion of a recipe-relative path ('' for a root file). */
export function dirname(p) {
  const i = p.lastIndexOf('/');
  return i === -1 ? '' : p.slice(0, i);
}

/** Collapse '.' and '..' segments. */
export function normalize(p) {
  const parts = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') { parts.pop(); continue; }
    parts.push(seg);
  }
  return parts.join('/');
}

/** Join a directory and a relative specifier, normalized. */
export function joinPath(dir, spec) {
  return normalize(dir === '' ? spec : dir + '/' + spec);
}

/** 'virtual:' import-map key for a recipe-relative path. */
export const toVirtualKey = (path) => 'virtual:' + path;

/**
 * Resolve a relative import specifier to a known recipe-relative file path.
 * Returns null for bare specifiers (e.g. '@mycl/core'); throws if a relative
 * specifier matches no known file.
 */
export function resolveRelative(fromPath, spec, knownPaths) {
  if (!spec.startsWith('.')) return null;
  const base = joinPath(dirname(fromPath), spec);
  const candidates = base.endsWith('.ts') ? [base] : [base + '.ts', base + '/index.ts'];
  for (const c of candidates) if (knownPaths.has(c)) return c;
  throw new Error(`Cannot resolve '${spec}' from '${fromPath}'`);
}

// Match the specifier string of static import/export-from and side-effect imports.
// Matching is anchored at line start, and the binding scan ([^;'"]*?) stops at the
// first quote or semicolon, so a following comment or a side-effect import (no 'from')
// cannot leak a later 'from'-specifier into the match. Import bindings never contain
// ';', '\'', or '"'; multi-line bindings with newlines/braces/commas still match.
// Known residual limitation: a line that begins with import/export ... from '...'
// inside a block comment or template literal is still matched. That is acceptable
// because the rewritten source is execute-only.
const FROM_RE = /((?:^|\n)\s*(?:import|export)\b[^;'"]*?\bfrom\s*)(['"])([^'"]+)\2/g;
const BARE_RE = /((?:^|\n)\s*import\s*)(['"])([^'"]+)\2/g;

/**
 * Rewrite import/export specifiers. `resolveSpec(spec)` returns a replacement
 * string, or null/undefined to leave the specifier unchanged.
 */
export function rewriteImports(source, resolveSpec) {
  const sub = (pre, q, spec) => pre + q + (resolveSpec(spec) ?? spec) + q;
  return source
    .replace(FROM_RE, (m, pre, q, spec) => sub(pre, q, spec))
    .replace(BARE_RE, (m, pre, q, spec) => sub(pre, q, spec));
}

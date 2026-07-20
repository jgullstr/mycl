// Runtime injected into the runner iframe: overrides console + forwards logs to
// the parent, and (for posted code) executes it as an ES module. No backticks so
// it embeds cleanly in a srcdoc string.
export const IFRAME_RUNTIME = [
  'function fmt(v){',
  "  if (typeof v === 'string') return v;",
  "  if (v instanceof Error) return v.stack || (v.name + ': ' + v.message);",
  '  try {',
  "    var s = JSON.stringify(v, function(k, val){ return typeof val === 'bigint' ? val.toString() + 'n' : val; }, 2);",
  '    return s === undefined ? String(v) : s;',
  '  } catch (e) { return String(v); }',
  '}',
  "function post(level, args){ parent.postMessage({ source: 'mycl-pg', type: 'log', level: level, text: Array.prototype.map.call(args, fmt).join(' ') }, '*'); }",
  "['log','info','debug','warn','error'].forEach(function(m){ var o = console[m] ? console[m].bind(console) : function(){}; console[m] = function(){ o.apply(null, arguments); post(m, arguments); }; });",
  "window.onerror = function(msg){ post('error', [String(msg)]); };",
  "window.addEventListener('unhandledrejection', function(e){ post('error', [String(e && e.reason)]); });",
  "window.addEventListener('message', function(e){ if (e.data && e.data.type === 'code'){ var s = document.createElement('script'); s.type = 'module'; s.textContent = e.data.code; document.body.appendChild(s); } });",
  "parent.postMessage({ source: 'mycl-pg', type: 'ready' }, '*');",
].join('\n');

/** Build the full iframe document: import map + runtime + entry module import. */
export function buildSrcDoc({ imports, runtime, entryKey }) {
  const importMap = JSON.stringify({ imports });
  return (
    '<!doctype html><html><head>' +
    '<script type="importmap">' + importMap + '</script>' +
    '</head><body>' +
    '<script>' + runtime + '</script>' +
    '<script type="module">import ' + JSON.stringify(entryKey) + ';</script>' +
    '</body></html>'
  );
}

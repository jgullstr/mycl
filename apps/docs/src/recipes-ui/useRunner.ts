import { useCallback, useEffect, useRef, useState } from 'react';
import { transform } from 'sucrase';
import { prepareRun } from './run-core.mjs';
import { getBundleUrl } from './bundle';
import type { LogEntry } from './ConsoleStrip';

// A blank iframe document until the first run; each run replaces srcDoc entirely
// (a fresh realm, so mycl's duplicate-identity guard never fires across runs).
const BLANK = '<!doctype html><html><head></head><body></body></html>';

/** Drives one hidden iframe: transpiles + links recipe files, runs, collects logs. */
export function useRunner() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [srcDoc, setSrcDoc] = useState<string>(BLANK);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // Multiple islands share window; handle only THIS iframe's messages.
      if (e.source !== iframeRef.current?.contentWindow) return;
      const d = e.data;
      if (!d || d.source !== 'mycl-pg') return;
      if (d.type === 'log') setLogs((prev) => [...prev, { level: d.level, text: d.text }]);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const run = useCallback((files: Record<string, string>, entry: string) => {
    // Revoke the previous run's blobs (never the shared @mycl/core bundle).
    for (const u of urlsRef.current) URL.revokeObjectURL(u);
    urlsRef.current = [];
    setLogs([]);
    try {
      const { srcdoc, urls } = prepareRun({
        files,
        entry,
        coreUrl: getBundleUrl(),
        transpile: (ts: string) => transform(ts, { transforms: ['typescript'] }).code,
        makeUrl: (js: string) => URL.createObjectURL(new Blob([js], { type: 'text/javascript' })),
      });
      urlsRef.current = urls;
      // Force a reload even if srcdoc text is identical to the last run.
      setSrcDoc(BLANK);
      requestAnimationFrame(() => setSrcDoc(srcdoc));
    } catch (e) {
      setLogs([{ level: 'error', text: String(e) }]);
    }
  }, []);

  const clear = useCallback(() => setLogs([]), []);

  return { logs, run, clear, iframeRef, srcDoc };
}

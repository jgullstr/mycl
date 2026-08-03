import { useEffect, useMemo, useRef, useState } from 'react';
import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import { useRunner } from '../recipes-ui/useRunner';
import { configureMonaco } from '../recipes-ui/monaco-setup';
import ConsoleStrip, { CONSOLE_HEIGHT } from '../recipes-ui/ConsoleStrip';

/**
 * Single-file editor + console: a one-file case of the shared recipe runner
 * (one module 'recipe.ts' whose imports come from '@mycl/core' and/or
 * '@mycl/core/helpers'). Auto-runs on mount
 * and, debounced, on edit. The editor sizes to the code's line count;
 * `height` only sets the minimum in stretch mode.
 */
const LINE_HEIGHT = 20;
const EDITOR_PADDING = 24; // top 12 + bottom 12, mirrors the Editor options below.

export default function Playground({ code, height = 320, stretch = false }: { code: string; height?: number; stretch?: boolean }) {
  const codeHeight = (code.trimEnd().split('\n').length + 1) * LINE_HEIGHT + EDITOR_PADDING;
  const { logs, run, iframeRef, srcDoc } = useRunner();
  const codeRef = useRef(code);
  const modelPath = useMemo(() => 'playground-' + Math.random().toString(36).slice(2) + '.ts', []);

  const [dark, setDark] = useState(() => document.documentElement.dataset.theme !== 'light');
  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => setDark(el.dataset.theme !== 'light'));
    observer.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Run once on mount and after each edit (debounced). `run` is stable (useCallback).
  useEffect(() => { run({ 'recipe.ts': codeRef.current }, 'recipe.ts'); }, [run]);

  const onChange = useMemo(() => {
    let timer: ReturnType<typeof setTimeout>;
    return (value?: string) => {
      codeRef.current = value ?? '';
      clearTimeout(timer);
      timer = setTimeout(() => run({ 'recipe.ts': codeRef.current }, 'recipe.ts'), 500);
    };
  }, [run]);

  const beforeMount: BeforeMount = (monaco) => configureMonaco(monaco);

  // ── Touch scrolling ────────────────────────────────────────────────────────
  // Monaco preventDefaults touchstart to run its own gestures, and Chrome
  // cancels scrolling for the rest of a gesture the moment that happens, so one
  // finger inside the pane dead-ends on the last line instead of scrolling the
  // page. Keep single-finger touches away from Monaco and the pane behaves like
  // any other content: one finger scrolls the page, two scroll the code.
  //
  // Nothing here calls preventDefault, only stopPropagation, so the browser
  // still synthesizes the click behind a tap and Monaco places the caret
  // through its ordinary mouse path. That is why no tap detection is needed.
  const [coarse] = useState(() => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
  const paneRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const onMount: OnMount = (ed) => { editorRef.current = ed; };

  useEffect(() => {
    const pane = paneRef.current;
    if (!coarse || !pane) return;
    // Capture phase, so touches stop before Monaco's handlers on descendants see
    // them. Monaco's own gesture support is single-touch, so the two-finger pan
    // is applied here rather than passed to it.
    let lastY = 0;
    const midY = (e: TouchEvent) => (e.touches[0].clientY + e.touches[1].clientY) / 2;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) lastY = midY(e);
      e.stopPropagation();
    };
    const onMove = (e: TouchEvent) => {
      e.stopPropagation();
      if (e.touches.length < 2) return;
      // preventDefault so the page does not pan under the two-finger gesture as
      // well; this listener is non-passive for exactly that reason.
      e.preventDefault();
      const y = midY(e);
      const ed = editorRef.current;
      if (ed) ed.setScrollTop(ed.getScrollTop() - (y - lastY));
      lastY = y;
    };
    pane.addEventListener('touchstart', onStart, { capture: true, passive: true });
    pane.addEventListener('touchmove', onMove, { capture: true, passive: false });
    return () => {
      pane.removeEventListener('touchstart', onStart, { capture: true });
      pane.removeEventListener('touchmove', onMove, { capture: true });
    };
  }, [coarse]);

  return (
    <div
      className="not-content"
      style={{
        display: 'flex', flexDirection: 'column',
        height: stretch ? '100%' : codeHeight + CONSOLE_HEIGHT,
        minHeight: stretch ? height + CONSOLE_HEIGHT : undefined,
        border: '1px solid var(--sl-color-gray-5)', borderRadius: '0.5rem', overflow: 'hidden',
        margin: stretch ? 0 : '1rem 0',
      }}
    >
      <div ref={paneRef} style={stretch
        ? { flex: 1, minHeight: 0, borderBottom: '1px solid var(--sl-color-gray-5)' }
        : { height: codeHeight, borderBottom: '1px solid var(--sl-color-gray-5)' }}>
        <Editor
          defaultLanguage="typescript" defaultValue={code} path={modelPath}
          theme={dark ? 'vs-dark' : 'light'} beforeMount={beforeMount} onChange={onChange}
          onMount={onMount}
          height={stretch ? '100%' : codeHeight}
          options={{
            minimap: { enabled: false }, fontSize: 13, lineHeight: 20, wordWrap: 'on',
            scrollBeyondLastLine: false, padding: { top: 12, bottom: 12 }, automaticLayout: true, tabSize: 2,
          }}
        />
      </div>
      <div style={{
        ...(stretch ? { height: CONSOLE_HEIGHT, flex: 'none' } : { flex: 1, minHeight: 0 }),
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ fontSize: '0.625rem', letterSpacing: '0.12em', opacity: 0.45, userSelect: 'none', padding: '0.5rem 0.75rem 0' }}>CONSOLE</div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ConsoleStrip logs={logs} />
        </div>
      </div>
      <iframe ref={iframeRef} srcDoc={srcDoc} title="mycl playground runner" style={{ display: 'none' }} />
    </div>
  );
}

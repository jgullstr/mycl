import { useEffect, useMemo, useRef, useState } from 'react';
import Editor, { type BeforeMount } from '@monaco-editor/react';
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
      <div style={stretch
        ? { flex: 1, minHeight: 0, borderBottom: '1px solid var(--sl-color-gray-5)' }
        : { height: codeHeight, borderBottom: '1px solid var(--sl-color-gray-5)' }}>
        <Editor
          defaultLanguage="typescript" defaultValue={code} path={modelPath}
          theme={dark ? 'vs-dark' : 'light'} beforeMount={beforeMount} onChange={onChange}
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

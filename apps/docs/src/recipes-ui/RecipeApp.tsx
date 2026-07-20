import { useEffect, useRef, useState } from 'react';
import { useRecipe } from './useRecipe';
import { useRunner } from './useRunner';
import RecipeNav from './RecipeNav';
import FileTree from './FileTree';
import CodePane from './CodePane';
import Console from './Console';

// The console opens tall enough to read ~8-10 rows and is drag-resizable from
// there. Clamps keep both the editor and the console usable at the extremes.
const DEFAULT_CONSOLE_HEIGHT = 240;
const MIN_CONSOLE_HEIGHT = 80;
const MIN_ABOVE_CONSOLE = 200; // reserved for nav + code so the split stays usable

export default function RecipeApp({ slug }: { slug: string }) {
  const { files, entry, tree } = useRecipe(slug);
  const { logs, run, clear, iframeRef, srcDoc } = useRunner();

  const [buffers, setBuffers] = useState<Record<string, string>>(() => ({ ...files }));
  const [activePath, setActivePath] = useState(entry);
  const [treeCollapsed, setTreeCollapsed] = useState(false);
  const [consoleHeight, setConsoleHeight] = useState(DEFAULT_CONSOLE_HEIGHT);
  const [dragging, setDragging] = useState(false);
  const resetModelsRef = useRef<((pristine: Record<string, string>) => void) | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  // Lock the page to the viewport while a recipe is mounted: the widget fills the
  // area below the Starlight header and the page itself never scrolls. Mirrors the
  // pre-paint sidebar-attribute pattern; the class is removed on unmount.
  useEffect(() => {
    document.documentElement.classList.add('recipe-locked');
    return () => document.documentElement.classList.remove('recipe-locked');
  }, []);

  // Follow Starlight's theme (data-theme on <html>) so Monaco matches the site.
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme !== 'light');
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setDark(el.dataset.theme !== 'light'));
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const onChange = (path: string, value: string) =>
    setBuffers((prev) => (prev[path] === value ? prev : { ...prev, [path]: value }));

  const onReset = () => {
    setBuffers({ ...files });
    resetModelsRef.current?.(files);
    clear();
  };

  // Drag the divider to resize the console. Window-level pointer listeners keep the
  // drag tracking even when the pointer leaves the thin handle, and respond to the
  // synthetic pointer events Chrome derives from injected mouse events.
  const onResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    const shell = shellRef.current;
    const startY = e.clientY;
    const startH = consoleHeight;
    const room = shell ? shell.clientHeight - MIN_ABOVE_CONSOLE : 640;
    const clampMax = Math.max(MIN_CONSOLE_HEIGHT, room);
    setDragging(true);
    const move = (ev: PointerEvent) => {
      const next = Math.min(Math.max(startH - (ev.clientY - startY), MIN_CONSOLE_HEIGHT), clampMax);
      setConsoleHeight(next);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    // `not-content` opts this subtree out of Starlight's .sl-markdown-content
    // rhythm rules. Those inject an adjacent-sibling margin-top between Monaco's
    // per-line <div>s, which spaces the lines apart and drifts the caret/gutter
    // and error squiggles off the glyphs. Opting out keeps the editor aligned.
    <div className={`rcp-shell not-content${dragging ? ' rcp-dragging' : ''}`} ref={shellRef}>
      <RecipeNav slug={slug} />
      <div className="rcp-split">
        <FileTree
          tree={tree}
          activePath={activePath}
          onSelect={setActivePath}
          collapsed={treeCollapsed}
          onToggle={() => setTreeCollapsed((c) => !c)}
        />
        <CodePane
          files={files}
          path={activePath}
          value={buffers[activePath] ?? ''}
          dark={dark}
          onChange={onChange}
          registerReset={(fn) => { resetModelsRef.current = fn; }}
        />
      </div>
      <div
        className="rcp-resizer"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize console"
        onPointerDown={onResizeStart}
      />
      <Console height={consoleHeight} logs={logs} onPlay={() => run(buffers, entry)} onReset={onReset} />
      {/* Hidden runner iframe. Same-origin srcdoc so it can import the blob-backed import map. */}
      <iframe ref={iframeRef} srcDoc={srcDoc} title="mycl recipe runner" style={{ display: 'none' }} />
    </div>
  );
}

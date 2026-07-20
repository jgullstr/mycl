import { useEffect, useRef } from 'react';
import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import { configureMonaco } from './monaco-setup';

/**
 * Multi-file editor. A Monaco model is pre-created for EVERY recipe file up front,
 * each at a `file:///<recipe-relative-path>` URI, so a sibling import like
 * `./capabilities/scream` resolves to a real model (no phantom 2307) and bare
 * `@mycl/core` (and `@mycl/core/helpers`) resolve to the extra-libs under
 * `file:///node_modules`. The editor is
 * pointed at the active file's `file:///` URI, so switching files just swaps the
 * shown model and every edit persists on its own model. `registerReset` hands the
 * parent a function that rewrites every model back to pristine.
 */
export default function CodePane({
  files, path, value, dark, onChange, registerReset,
}: {
  files: Record<string, string>; path: string; value: string; dark: boolean;
  onChange: (path: string, value: string) => void;
  registerReset: (fn: (pristine: Record<string, string>) => void) => void;
}) {
  const filesRef = useRef(files);
  filesRef.current = files;
  // Monaco singleton + the URIs we created, captured for disposal on unmount.
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const uriKeysRef = useRef<string[]>([]);

  const uriFor = (rel: string) => `file:///${rel}`;

  const beforeMount: BeforeMount = (monaco) => {
    configureMonaco(monaco);
    // Seed a typescript model per file so cross-file imports resolve immediately.
    for (const [rel, source] of Object.entries(filesRef.current)) {
      const uri = monaco.Uri.parse(uriFor(rel));
      if (!monaco.editor.getModel(uri)) monaco.editor.createModel(source, 'typescript', uri);
    }
  };

  const onMount: OnMount = (_editor, monaco) => {
    monacoRef.current = monaco;
    uriKeysRef.current = Object.keys(filesRef.current).map(uriFor);
    // Reset rewrites every recipe model back to pristine.
    registerReset((pristine) => {
      for (const model of monaco.editor.getModels()) {
        const p = model.uri.path.replace(/^\//, '');
        if (p in pristine && model.getValue() !== pristine[p]) model.setValue(pristine[p]);
      }
    });
  };

  // Dispose the models we created when the recipe unmounts (the editor keeps its
  // current model via keepCurrentModel, so we own every model's lifecycle here).
  useEffect(() => () => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    for (const key of uriKeysRef.current) {
      monaco.editor.getModel(monaco.Uri.parse(key))?.dispose();
    }
  }, []);

  return (
    <div className="rcp-editor">
      <Editor
        path={uriFor(path)}
        value={value}
        defaultLanguage="typescript"
        theme={dark ? 'vs-dark' : 'light'}
        keepCurrentModel
        beforeMount={beforeMount}
        onMount={onMount}
        onChange={(v) => onChange(path, v ?? '')}
        height="100%"
        options={{
          minimap: { enabled: false }, fontSize: 13, lineHeight: 20, wordWrap: 'on',
          scrollBeyondLastLine: false, padding: { top: 12, bottom: 12 }, automaticLayout: true, tabSize: 2,
        }}
      />
    </div>
  );
}

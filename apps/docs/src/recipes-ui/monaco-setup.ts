import type { BeforeMount } from '@monaco-editor/react';
import { myclTypes, myclPackageJson } from '../playground/deps';

type Monaco = Parameters<BeforeMount>[0];

// Monaco's TS defaults + mycl types are global to the singleton monaco instance,
// so configure them once across every editor on a page.
let configured = false;

/** One-time TS compiler options + @mycl/core type libs on the Monaco singleton. */
export function configureMonaco(monaco: Monaco): void {
  if (configured) return;
  configured = true;
  const ts = monaco.languages.typescript;
  ts.typescriptDefaults.setCompilerOptions({
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    strict: true,
    skipLibCheck: true,
    allowNonTsExtensions: true,
  });
  // Bare '@mycl/core' resolves through the package.json "types" field.
  ts.typescriptDefaults.addExtraLib(myclPackageJson, 'file:///node_modules/@mycl/core/package.json');
  ts.typescriptDefaults.addExtraLib(myclTypes, 'file:///node_modules/@mycl/core/index.d.ts');
  // The classic (NodeJs) resolver looks up a subpath specifier as a file under
  // the package folder, so '@mycl/core/helpers' needs its own declaration file.
  // Same bundled content as the main entry (the bundle inlines both); it is a
  // superset for the /helpers path, which trades precision for one shared bundle.
  ts.typescriptDefaults.addExtraLib(myclTypes, 'file:///node_modules/@mycl/core/helpers.d.ts');
}

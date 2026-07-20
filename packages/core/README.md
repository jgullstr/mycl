# @mycl/core

[mycl](https://mycl.dev) in one package: a capability/registry system for
TypeScript. Modify a function's behavior without touching its declaration or
its call sites: define a capability once, call it like a plain function, and
whoever instantiates your code decides what the call does by layering
registries. Zero dependencies, the full stack under 2 KB min+gz.

```sh
npm install @mycl/core
```

Requires TypeScript 5.4 or newer: the public types use `NoInfer`.

```ts
import { createFnChannel, registry } from '@mycl/core';

const { capable, mycl } = createFnChannel('my-app');

// An ordinary function, made an extension point.
const greet = capable((name: string) => `greetings, ${name}`, 'greet');

const app = mycl(() => greet('world'));
console.log(app()); // greetings, world

// A registry re-binds greet; the call site never changes.
const loud = registry().layer(greet, (name: string) => `HELLO, ${name.toUpperCase()}`);
console.log(mycl(app, loud)()); // HELLO, WORLD
```

Everything else lives at [mycl.dev](https://mycl.dev): getting started, the
guides, the package's [entry points](https://mycl.dev/advanced/core-substrate/)
(`/helpers`, `/context`, `/factory`, `/introspect`), and the full
[API reference](https://mycl.dev/reference/core/). ESM-only, and the library
runs anywhere; the one Node-gated piece is `alsContext` (Node 20.16 or newer
for `process.getBuiltinModule`), and only at the point you call it.

## Status

Pre-1.0. The mechanism is stable and thoroughly tested; the API may still move
before 1.0.

MIT © Josef Gullström

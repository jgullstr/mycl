---
title: Installation
description: Install mycl in an app or a library, mint your channel, and set up the ./capabilities convention.
---

## Initial configuration

Install the package:

```bash
pnpm add @mycl/core
```

Then mint your channel once, in one module, and export the bound surface:

```ts
// src/kernel.ts: the capability kernel
import { createFnChannel } from '@mycl/core';

export const { capable, snapshot, channel, mycl, scope } = createFnChannel('my-app-or-library');
```

Everything else in your codebase imports from `./kernel`. The channel is yours alone:
mycl ships no ambient default, so nothing you mint can collide with another
library's capabilities, and theirs cannot see yours.

Building an application? You're done: head to the
[Quick Start](/getting-started/quick-start/). The rest of this page is for
library authors.

## Library exports

The same wiring, embedded: take `@mycl/core` as a dependency. Regular keeps it
fully invisible: it rides along inside your install, and consumers never see
it. Peer shares one copy across the libraries in an app, at a cost: `@mycl/core`
surfaces in the consumer's own install, a version constraint they now satisfy
and manage for a package they never import. Channels stay disjoint either way,
so the trade is packaging, not privacy. In both cases consumers never need to
import from `@mycl/core` directly: your public entry point should re-export
whatever they need under your own name.

```ts
// my-library/src/index.ts: the library export
export { registry } from '@mycl/core'; // plugin-author surface, re-exported as yours
```

Your channel is private by construction, so other mycl copies in a consumer's
realm are harmless: their channels are disjoint from yours, and duplicate
copies of your own library each work independently too. The one hazard is a
consumer whose tree resolves *your library* twice and mixes tokens across the
copies. No channel name can bridge them: the name is a label, never a key, so
two copies minting `'my-library'` still hold two disjoint channels (the same
fact that keeps strangers from reaching your channel by guessing its name).
That is a packaging problem; for a loud startup signal, see the self-report
recipe in
[Duplicate detection](/advanced/duplicate-detection/#recipe-self-report-your-own-copy).

To accept extensions from the outside, take registries through your entry
point (an option, a method, whatever fits your API) and pass them to your
`mycl`/`scope`, which compose them for you. What that seam looks like is your
design; mycl only supplies the mechanism. The mechanical half is small:

```ts
// my-library/src/index.ts: one possible seam
import type { Registry } from '@mycl/core';
import { mycl } from './kernel';
import { buildApi } from './api';

export const createMyLibrary = (...extensions: Registry[]) =>
  mycl(buildApi, ...extensions)();
```

For the end-to-end version, capabilities export and all, see the
[Extend a function from outside](/recipes/hero/) recipe.

### The `./capabilities` convention

A package that exposes capabilities should export them from a `./capabilities` subpath. Add the
export, with explicit `types` conditions so the typed contract resolves under every consumer's
module-resolution mode; on this subpath the contract is the product:

```json
{
  "name": "my-library",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./capabilities": { "types": "./dist/capabilities.d.ts", "default": "./dist/capabilities.js" }
  }
}
```

The file re-exports the `capable()`-wrapped functions, which are used as registry keys when binding external functionality. Only the exported functions can be rebound: unexported capabilities stay internal to the library.

```ts
// src/capabilities.ts
export { fetchUser, sendEmail, renderTemplate } from './impl';
```

Consumers import from `my-library/capabilities` to get the capability objects, then write bindings
against them. Keeping capabilities on one predictable subpath makes the extension surface easy to
find and lets separate contributors bind the same capabilities without coordinating.

## Where next

- [Quick Start](/getting-started/quick-start/): 60 seconds to your first override.
- [Duplicate detection](/advanced/duplicate-detection/): the two guards, and when to self-report.

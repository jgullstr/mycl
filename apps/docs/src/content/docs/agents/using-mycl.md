---
title: Using mycl (for agents)
description: Terse operating manual for AI agents reading, writing, and extending mycl code, covering invariants, conventions, recipes, and a drop-in AGENTS.md block.
---

Machine-optimized reference. Rules first, prose last. If you write mycl code, obey §2 exactly.

## 1. What mycl is

mycl is a **capability/registry system** for TypeScript, not a DI framework. A **capability** is a function you call normally; a **registry** re-binds what that call runs, per **scope**, at the composition root. Layer defaults and overrides into an immutable registry, activate it for a call tree, and every capability inside dispatches through it. Call sites never change.

> Mental model: **a capability is a function whose behavior the caller can re-bind per scope without touching the call site.**

One package, `@mycl/core`, five entry points. The main entry is the everyday surface: `createFnChannel` (whose kernel carries `capable`, `snapshot`, `mycl`, `scope`, and the `channel` token; these are kernel members, **not** package exports), plus `registry`, `requires`, `setChannelContext`, and the guards; `/helpers` holds the augment helpers (`before`/`after`/`pipe`/`handleError`, deliberately not on main); `/context`, `/factory` (including `merge`, the composition primitive `mycl`/`scope` call internally), and `/introspect` are the substrate subpaths kernel and connector authors build on. Default to the main entry.

## 2. Invariants (never violate)

- **Registries are immutable.** Every `.layer()` / `.augment()` returns a **new** registry (clone-on-write); nothing mutates in place. Keep the returned value.
- **Capability identifier path is mandatory and non-empty** (convention: `project/capability` when several areas share a channel), and **stable once published**: it is the public id, error label, and type-level layer-record key. Changing it is a breaking change.
- **Error codes are stable and never renumbered.** Match on the code, never the message.
- **Scope is synchronous.** A capability called after an `await`, in a `.then()`, a timer, or any deferred callback has lost the scope and throws error 1. Carry it across the boundary with `snapshot`.
- **Layer strategies own the `undefined`-acc case.** `step` receives `acc: V | undefined`; the strategy decides what "no prior value" means. No branching hides in the resolver; `seed` is optional.
- **Augments compose first-added innermost, last-added outermost.** So at call time the last-added augment runs first and delegates inward to the base.
- **Core ships mechanism, not policy.** There is **no** strategy library and no `defineStrategy`: you hand-roll strategies (§5.4). This is deliberate; do not look for one.
- **`requires(...)` is compile-time only.** It tags a make's type and is enforced at `mycl(...)`; it has zero runtime effect and raises no throw.

## 3. Conventions (follow in any mycl-using project)

- **Expose capabilities from a `./capabilities` package export** so consumers import the capability *value* (refactor-safe) rather than an identifier string:

  ```json
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.mjs" },
    "./capabilities": { "types": "./dist/capabilities/index.d.ts", "import": "./dist/capabilities/index.mjs" }
  }
  ```

- **Libraries take `@mycl/core` as a regular or peer dependency** (regular for the simplest install, peer to share one copy across libraries) and mint a private channel behind their own entry point: duplicate copies of mycl coexist harmlessly (channels are disjoint by construction, and every entry is side-effect-free). The real hazard is a consumer's tree resolving *your* package twice: registries built against one copy's capability tokens silently fall back to base in the other. That is a packaging problem, not a mycl setting. See [Installation → Library exports](/getting-started/installation/#library-exports) and [Duplicate detection](/advanced/duplicate-detection/) for the optional self-report recipe.
- **Prefer `project/capability` identifier paths when several areas share a channel.** The `project` segment namespaces them so they never collide (duplicate-identifier, error 13); a private single-owner channel can use flat names.

## 4. Do / Don't

| Do | Don't |
|----|-------|
| Build one `registry()` per test, holding only the layers under test | Call mycl "DI" or a dependency-injection framework (it is a capability/registry system) |
| Compose whole registries by passing several to `mycl`/`scope` (later wins per capability; augments accumulate) | Mutate or monkey-patch a resolved function (rebind through a registry instead) |
| `import * as introspect from '@mycl/core/introspect'`; use `introspect.explain(reg, cap)` (and `introspect.describe(reg)`) to debug "why isn't my override taking" | Catch mycl errors by message text (match the numeric code). Prod messages are only `mycl: error <code>, visit https://mycl.dev/errors/<code> for more information.` |
| Reach for the main entry (`createFnChannel` and friends) first | Reach for `/factory`, `/context`, or `/introspect` when the main entry suffices (those subpaths are for kernel/connector authors) |

## 5. Extending a mycl project

Real API only. Every capability below is imported as a *value*, not referenced by identifier string.

### 5.1 Add a capability

Define it, export it from `./capabilities`, layer a default where you compose.

```ts
// capabilities.ts: surfaced via the "./capabilities" package export
import { createFnChannel } from '@mycl/core';

const { capable } = createFnChannel('my-app-or-library');

export const fetchUser = capable(
  async (id: string) => ({ id, name: 'base' }), // base impl = the default
  'fetchUser',                                  // identifier path (mandatory)
);
```

### 5.2 Override behavior at the composition root

Bind a replacement in a registry, then activate it for a call tree with `scope`.

```ts
import { createFnChannel, registry } from '@mycl/core';

const { scope } = createFnChannel('my-app-or-library');
import { fetchUser } from './capabilities';

const reg = registry().layer(fetchUser, async (id) => ({ id, name: 'override' }));

scope(() => fetchUser('42'), reg)(); // dispatches the override; base untouched elsewhere
```

### 5.3 Cross-cutting concerns via `.augment` + helpers

Augments wrap the resolved callable without replacing it: logging, timing, error recovery. Compose several; they stack outer-wraps-inner.

```ts
import { registry } from '@mycl/core';
import { after, handleError } from '@mycl/core/helpers';
import { fetchUser } from './capabilities';

const observed = registry()
  .augment(fetchUser, after((u) => console.log('fetched', u)))
  .augment(fetchUser, handleError((err) => { report(err); return { id: 'unknown', name: 'anonymous' }; }));
```

> `after` / `pipe` observe the capability's **raw** result. For an async capability that is the Promise, not the settled value. `await` inside your callback if you need the resolved value.

### 5.4 Hand-rolled layer strategy (~5 lines)

No strategy library exists. A strategy is a left fold over the capability's layers: `step` is the fold function, `seed` the optional initial accumulator, `extract` the final projection into a callable. Write the fold your capability needs, inline. Here every layer *accumulates* instead of the default last-wins:

```ts
import { createFnChannel } from '@mycl/core';

const { capable } = createFnChannel('my-app-or-library');

const middleware = capable(() => [] as Mw[], 'middleware', {
  strategy: {
    // acc is the array folded so far (undefined on the first layer, §2)
    step: (acc: Mw[] | undefined) => (m: Mw) => [...(acc ?? []), m],
    extract: (all: Mw[]) => () => all, // extract must return a function
  },
});
```

## 6. Drop this into your project's AGENTS.md

Copy the block below into a consumer project (e.g. a library built on mycl) and fill the placeholder line. It is self-contained and useful verbatim.

```md
## This project uses mycl

mycl is a capability/registry system (NOT dependency injection). A capability is a
function whose behavior the caller re-binds per scope without touching the call site.
Package `@mycl/core`, main entry = everyday API; `/factory`, `/context`, `/introspect`
subpaths = substrate for kernel/connector authors.

Invariants (never violate):
- Registries are immutable: `.layer()` / `.augment()` return a NEW registry. Keep it.
- Capability identifier path is mandatory and non-empty (convention: project/capability when several packages share a channel, flat otherwise), stable once published.
- Error codes are stable and never renumbered: match the code, never the message
  (prod message is only `mycl: error <code>, visit https://mycl.dev/errors/<code>`).
- Scope is synchronous: anything past an await / .then / timer needs `snapshot`.
- Layer strategies own the `undefined`-parent (no-prior-value) case.
- Augments compose first-added innermost, last-added outermost.
- No strategy library exists on purpose: hand-roll strategies (a plain object, ~5 lines).
- `requires(...)` is compile-time only, enforced at `mycl(...)`; zero runtime effect.

Conventions:
- Import capabilities as VALUES from the `./capabilities` export, never identifier strings.
- Take `@mycl/core` as a regular or peer dependency (regular for the simplest install, peer to share one copy across libraries) and mint a private channel per package.
- One `registry()` per test, holding only the layers under test.
- Debug overrides with `import * as introspect from '@mycl/core/introspect'` →
  `introspect.explain(reg, cap)`.

<!-- where capabilities live in THIS project: ... -->

Full machine-readable docs: https://mycl.dev/llms-full.txt
```

## Where next

- [llms.txt](https://mycl.dev/llms.txt): the doc index for agents.
- [llms-full.txt](https://mycl.dev/llms-full.txt): every doc page as one text file.
- [`@mycl/core` reference](/reference/core/): every function and type, with signatures and error codes.
- [Glossary](/reference/glossary/): each term defined once.

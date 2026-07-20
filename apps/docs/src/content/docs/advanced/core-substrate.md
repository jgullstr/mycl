---
title: The Core Substrate
description: Why @mycl/core splits into a main entry (the everyday kernel) and substrate subpaths (/helpers, /context, /factory, /introspect), and how to read a registry at runtime.
---

mycl is one package, `@mycl/core`, with five entry points. The main entry is the
**everyday surface**: `createFnChannel` hands you a kernel with the factory
ergonomics (`mycl`, `scope`, `requires`) already wired, plus `registry`
and the guards, all in one import. The subpaths are the **substrate**: the
mechanism layer underneath, the part that knows how a capability dispatches, how
the layer fold runs, and how the type contracts hold, and nothing about *when*
code runs or how a scope crosses an `await`.

Most people import the main entry and never touch a subpath directly. Reach for
one when you are building a build plugin, tooling that inspects registries, or a
kernel with an execution model of its own: anything that needs the mechanism
alone.

## Why the split exists

The line is mechanism versus policy, drawn at the entry boundary rather than a
package boundary. The main entry ships the everyday policy already decided
(the stack context, wired through `createFnChannel`). The substrate subpaths
ship only mechanism: which context is active, and how a scope propagates across
an async boundary, is policy, and policy lives in *your* kernel: the module
where you mint your channel and pick its context. The stack context is the
simplest policy; a different kernel can pick a different one (an
`AsyncLocalStorage`-backed context via `alsContext`, a React context, a test
harness) on the same substrate. See [Building a Kernel](/advanced/building-a-kernel/).

The unit a kernel wires is a **channel**, and the thing that wires it is a
**connector**: `createChannel(name, connector)` hands the name to the connector, mints
the channel over the connector's fresh context, and returns the kernel the connector
builds from the channel's **surface**:

```ts
import { stackContext } from '@mycl/core/context';
import { createChannel } from '@mycl/core/factory';
import type { ChannelSurface } from '@mycl/core/factory';

// The minimal (identity) connector: fresh stack context, surface passthrough.
const bare = <G extends string>(_name: G) => ({
  context: stackContext(),
  build: (surface: ChannelSurface<G>) => surface,
});

const { capable, snapshot, channel, context } = createChannel('app', bare);
```

| surface field | what it is |
|-------|------------|
| `capable` | the **capability constructor**: mints capabilities that dispatch through this channel |
| `snapshot` | captures this channel's active scope for replay across an async boundary |
| `channel` | the channel token: pass it to `setChannelContext` to swap the backing context later |
| `context` | the channel's live `ScopeContext` (`{ get, run }`): use when you need `run` directly |

The connector behind [`createFnChannel`](/reference/core/#createfnchannel)
is the everyday one: it builds `{ channel, capable, snapshot, mycl, scope }` from
this surface (keeping the raw context private). That is all a kernel is: a
connector's build applied to a channel's surface.

## Subpaths

`@mycl/core` ships five entry points. Import from the narrowest one you need: the
introspection and factory surfaces stay out of the dispatch critical path.

| entry | what it carries |
|---------|-----------------|
| `@mycl/core` (main) | the everyday kernel: `createFnChannel`, `registry`, `requires`, `setChannelContext`, `isCapability`, `isResolvedRegistry`, and the full capability/registry type vocabulary |
| `@mycl/core/helpers` | augmentation helpers: `before`, `after`, `pipe`, `handleError` |
| `@mycl/core/context` | `ScopeContext` implementations: `stackContext` (synchronous) and `alsContext` (`AsyncLocalStorage`-backed, Node 20.16+) |
| `@mycl/core/factory` | the build-plugin and connector-author contract: `createChannel`, `merge`, `Connector`, `ChannelSurface`, `foldBindings`, `resolveContext`, `defineInternal` |
| `@mycl/core/introspect` | read-only `describe` / `explain` / `diff` over a registry |

`merge` lives on `/factory`, with the kernel authors who call it directly:
channel users compose by passing registries to `mycl`/`scope`, which run the
composition themselves. `createChannel` lives on
`/factory` too, one level above `createFnChannel`, which is exactly one
application of it.

## Reading a registry at runtime

A registry is immutable and its bindings are inspectable. The
`@mycl/core/introspect` subpath answers "what does this composed registry bind,
and what would a capability resolve to?" without invoking anything.

Import the trio as a namespace. `describe` collides with the Vitest/Jest global,
and these functions are used most inside tests, so the namespace form keeps them
unambiguous:

```ts
import * as introspect from '@mycl/core/introspect';

introspect.describe(reg);
// [{ identity: 'my-app-or-library:db', layers: 1, augments: 0, strategy: 'last-wins' }, …]

introspect.explain(reg, db);
// { identity: 'my-app-or-library:db', bound: true, resolvesToBase: false, layers: 1, augments: 0, strategy: 'last-wins' }

introspect.diff(before, after);
// { added: ['my-app-or-library:log'], removed: [], changed: [] }
```

`explain(reg, cap)` reports what `cap` resolves to (base vs. how many
layers/augments) without calling it, so a test can assert an override took:
`expect(introspect.explain(reg, cap).resolvesToBase).toBe(false)`. `diff` keys
`changed` on a structural signature (layer count + augment count), so it catches
added or removed contributions but not a changed *value* at the same count.

## Where next

- [Building a Kernel](/advanced/building-a-kernel/): wire your own channel to a context.
- [Type Guarantees](/advanced/type-guarantees/): how the substrate's type contracts hold.
- [`@mycl/core` reference](/reference/core/): every export, signature by signature.

---
title: '@mycl/core'
description: Complete API reference for @mycl/core, covering every exported function and type across its five entry points, with signatures, error codes, and minimal examples.
---

`@mycl/core` is mycl: one package, five entry points. The main entry is the everyday
surface, one ceremony: mint your channel with [`createFnChannel`](#createfnchannel),
one import, one call, and work with the kernel it returns plus the registry machinery
(`registry`, the augmentation helpers, [`requires`](#requires)). The subpaths
below it are the substrate: `/helpers` (augmentation helpers, deliberately not on
main), `/context` (`ScopeContext` implementations for kernel authors), `/factory`
(the connector and build-plugin contract), and `/introspect` (read-only registry
inspection). Connector authors, the level above the everyday surface, work against
`/factory` directly (`createChannel` and the [`Connector`](#connector) contract);
the connector behind `createFnChannel` is itself internal. Every entry is
side-effect-free.

```bash
pnpm add @mycl/core
```

Every example below shares one running kernel and a `fetchUser` capability:

```ts
import { createFnChannel } from '@mycl/core';

const { capable, snapshot, channel, mycl, scope } = createFnChannel('my-app-or-library');

const fetchUser = capable(
  async (id: string) => ({ id, name: 'base' }),
  'fetchUser',
); // full identifier: 'my-app-or-library:fetchUser'
```

---

## `@mycl/core` (main entry)

```ts
import {
  createFnChannel, registry, requires,
  setChannelContext, isCapability, isResolvedRegistry,
} from '@mycl/core';
```

### `createFnChannel`

```ts
createFnChannel<const G extends string>(name: G): FnKernel<G>
```

Mint a channel with the plain-function kernel bound to it: `FnKernel<G>` is `{ channel, capable, snapshot, mycl, scope }`. This is the whole ceremony; each call mints a fresh, isolated channel, and `name` becomes the identifier prefix of every capability minted through the kernel's `capable`. The raw context is deliberately absent from the kernel (the substrate stays private; swap contexts through [`setChannelContext`](#setchannelcontext) with the `channel` token).

```ts
import { createFnChannel } from '@mycl/core';

const { capable, snapshot, channel, mycl, scope } = createFnChannel('my-app-or-library');
```

Under the hood it is one application of the mechanism: [`createChannel`](#createchannel) (on `/factory`) applied to an internal connector. For a custom context (say `AsyncLocalStorage` on Node), mint the channel and swap its context with [`setChannelContext`](#setchannelcontext); connector authors building a different kernel shape work against `/factory`'s [`Connector`](#connector) contract and export their own bound factory. See [Building a Kernel](/advanced/building-a-kernel/).

**Errors:** a name containing `:` or `/` is a type error and, outside production, throws [error 12](/errors/12/) at runtime.

### `capable`

```ts
// on the kernel createFnChannel returns, for channel name G:
capable<T extends AnyFn, V = T, Args extends unknown[] = [V], const Id extends string = string>(
  baseFn: T | Capability<T, any, any, any>,
  idPath: IdPath<Id>,
  config?: CapableConfig<T, V, Args>,
): Capability<T, V, Args, `${G}:${Id}`>
```

Create a capability from a default implementation. `capable` is not a package export: it comes on the kernel [`createFnChannel`](#createfnchannel) returns (and on the [`ChannelSurface`](/reference/core/#channelsurfaceg) every connector receives), pre-bound to your channel. The returned [`Capability`](#capabilityt-v-args-id) is a plain callable that dispatches through the active scope, falling back to `baseFn` when nothing is bound. It is simultaneously its own registry key, its type contract, its default implementation, and its stable identifier.

The mandatory `idPath` is a non-empty **identifier path**. A flat name is enough for a private, single-owner channel; use `'project/capability'` when several packages share one channel, so their capabilities never collide. A capability belongs to the channel whose `capable` minted it, so with `createFnChannel('my-app-or-library')` and idPath `'fetchUser'` the full identifier becomes `my-app-or-library:fetchUser`. The optional `config.strategy` is a [`LayerStrategy`](#layerstrategyt-v-args) that changes how `.layer()` contributions fold. See [Layer strategies](/guide/layer-strategies/). See [Capability identifier](#capability-identifier) for the full model.

```ts
const fetchUser = capable(
  async (id: string) => ({ id, name: 'base' }),
  'fetchUser',
);
```

**Errors:** the identifier path is validated in dev: an empty path throws [error 11](/errors/11/). A second capability minted with the same full identifier is, in dev, reported to the console (`console.error`), [error 13](/errors/13/); it does not throw. Calling the returned capability with no active scope throws [error 1](/errors/1/); a binding that resolves to a non-function throws [error 2](/errors/2/).

### Capability identifier

Every capability carries a mandatory **identifier** string. `capable(baseFn, idPath, config?)` takes the **identifier path** as its second argument, and the channel prepends its own name to form the full identifier `name:idPath`. Any non-empty path works (channels are disjoint, so uniqueness only matters within one channel); a flat path is enough for a private, single-owner channel, and reaching for the `project/capability` shape when several packages share one channel gives three segments:

| Segment | Example | Owned by | Supplied at |
|---------|---------|----------|-------------|
| channel | `app` | whoever defines the capability *channel* | `createFnChannel('my-app-or-library')` (or `createChannel('my-app-or-library', connector)`) |
| project | `demo` | the package *minting* capabilities into that channel | the `idPath` argument to `capable` |
| capability | `greet` | the individual capability | the `idPath` argument to `capable` |

The identifier-path type is enforced by the [`IdPath`](#idpathid) validator: any non-empty literal passes; an empty one is replaced by a self-describing message type. Structure beyond non-emptiness is convention, not contract, and uniqueness within a channel is the author's responsibility.

- An empty identifier path from an untyped (JS) caller throws [error 11](/errors/11/) (**dev only**).
- A duplicate assembled identifier is reported via `console.error` ([error 13](/errors/13/)). This is **dev only, not a throw**. A duplicate corrupts the type-level layers and introspection labels but does not break dispatch, which keys on the capability object itself, not its identifier string; a `console.error` (rather than a throw) also avoids false positives under HMR / module re-evaluation.

The identifier does triple duty: the **type-level layer-record key** (making the registry's layers total and every capability type-distinguishable; see [`Capability`](#capabilityt-v-args-id)), the **runtime error/debug label** ([error 1](/errors/1/) and [error 2](/errors/2/) name it), and the **introspection label**. Because it is a stable public identifier, changing a published capability's identifier is a breaking change.

### `registry`

```ts
registry(): Registry<readonly []>
```

Create a fresh, frozen, empty [`Registry`](#registryl). Every `.layer()` and `.augment()` call returns a **new** registry (clone-on-write); nothing mutates in place. It starts with an empty type-level layer record (`readonly []`) so a `.layer` chain builds a precise per-registry layers tuple.

```ts
import { registry } from '@mycl/core';
import { after } from '@mycl/core/helpers';

const testReg = registry()
  .layer(fetchUser, async (id) => ({ id, name: 'mock' }))
  .augment(fetchUser, after((u) => console.log('fetched', u)));
```

The registry never accepts a caller-built bindings map: bindings flow in only through its two derivation methods, which keeps the binding value shape an internal invariant the runtime relies on. The registry carries four methods:

#### `.layer(cap, ...args)`

```ts
layer<T extends AnyFn, V, Args extends unknown[], Id extends string, const A extends Args>(
  cap: Capability<T, V, Args, Id>, ...args: A
): Registry<readonly [...L, { cap: Capability<T, V, Args, Id>; args: A }]>
```

Bind a capability to an implementation (or, for a capability with a custom strategy, a contribution). The args are spread into the capability's `step` fold. Under the default last-wins strategy the final `.layer()` call for a capability is the one dispatched; custom strategies accumulate across calls. Each layer is also recorded in the registry's type-level layers.

**Errors:** throws [error 5](/errors/5/) if `cap` is not a capability, and [error 6](/errors/6/) if the contribution is rejected by the strategy (default: an `undefined` value).

#### `.augment(cap, wrapper)`

```ts
augment<T extends AnyFn>(cap: Capability<T, any, any, any>, wrapper: AugmentWrapper<T>): Registry<L>
```

Wrap whatever the capability resolves to, without replacing it. `wrapper` is an [`AugmentWrapper<T>`](#augmentwrapperf): a raw `next => (...args) => …` function, or the result of a helper (`before`, `after`, `pipe`, `handleError`). Augments always apply, even when nothing is layered (they wrap the base). Multiple augments compose outer-wraps-inner. See [Augmentation](/guide/augmentation/).

**Errors:** throws [error 7](/errors/7/) if `cap` is not a capability and [error 8](/errors/8/) if `wrapper` is not a function. In **dev only**, a canary probe additionally rejects a builder-style argument (`h => h.after(fn)`) up front rather than at first dispatch: [error 9](/errors/9/) for a builder-shaped value, [error 10](/errors/10/) if the wrapper throws during the probe. This block is dead-code-eliminated in production.

#### `.has(cap)`

```ts
has(cap: AnyCapability): boolean
```

Report whether the registry holds any binding (a layer or an augment) for `cap`.

#### `.bindings()`

```ts
bindings(): RegistryBindings
```

Return the registry's internal capability-to-binding-value map as a [`RegistryBindings`](#registrybindings). Read-only; primarily for introspection (see [`/introspect`](#myclcoreintrospect)) and build tooling.

### `scope`

```ts
scope<T extends AnyFn>(fn: T): Snapshotted<T>
scope<T extends AnyFn>(fn: T, reg: Registry | ResolvedRegistry): Snapshotted<T>
```

Bind a function to a registry scope and return a call-signature-only wrapper (own properties of `fn` are dropped; the result is a [`Snapshotted<T>`](#snapshottedt)). Every call to the wrapper replays that scope. Pass a [`Registry`](#registryl) or a pre-composed [`ResolvedRegistry`](#resolvedregistry); with no second argument, `scope(fn)` pins the **base** behavior: capabilities inside fall back to their default implementations regardless of any ambient scope.

```ts
const base  = scope(() => fetchUser('42'));           // pins base implementations
const bound = scope(() => fetchUser('42'), testReg);  // pins to testReg
bound();
```

`scope` is not a package export: it comes on the kernel [`createFnChannel`](#createfnchannel)
returns, as in the running kernel above. Its function type is exported as `Scope`
(and `mycl`'s as `Mycl`), so a kernel module can annotate what it re-exports:
`export const scope: Scope = kernel.scope`.

**Errors:** `scope` always establishes a scope (empty when none is given), so capabilities called inside never throw [error 1](/errors/1/): they resolve to their base. A binding whose strategy assembles a non-function still surfaces [error 2](/errors/2/) at call time. See [Scopes](/guide/scopes/).

### `mycl`

```ts
mycl<F extends AnyFn, const Regs extends readonly Registry[]>(
  make: F,
  ...registries: [Exclude<RequiredIds<F>, ProvidedIds<Regs[number]>>] extends [never]
    ? Regs
    : readonly [MissingCapabilities<Exclude<RequiredIds<F>, ProvidedIds<Regs[number]>>>]
): MyclFactory<ReturnType<F>, Parameters<F>, readonly [...StoredRegs<F>, ...Regs]>
```

Build a factory. `mycl(make, ...regs)` returns a frozen [`MyclFactory`](#myclfactory): the registries resolve **once** at creation, and each call runs `make(...args)` inside that resolved scope, returning its result verbatim: `mycl` does not inspect, walk, scope-bind, or freeze the result. There is a single signature: because a `MyclFactory` is structurally a `(...args) => T`, passing one back as `make` matches the same call. When you do, its stored registries are merged **ahead** of the newly-passed ones and a fresh factory is built (detected at runtime via an internal brand), on the factory's **own channel**: a factory stays on its channel when extended, even by another channel's `mycl`.

The stored registry tuple is threaded onto the factory type: nothing the call site knew is erased. Read it back with [`SuppliedRegistries`](#suppliedregistries) and compose with `RegistryLayers` / `CapabilityLayers` / `ProvidedIds` to introspect a factory at the type level.

When `make` is wrapped with [`requires(...)`](#requires), `mycl` also performs a **provider-completeness check**: it type-errors unless the passed registries provide every required capability, naming any that are missing. An unwrapped `make` has no requirements, so the check passes vacuously. This check is compile-time only: it raises no runtime error, and it is enforced at `mycl`, not at `scope`.

```ts
const createApp = mycl(
  () => ({ getUser: snapshot((id: string) => fetchUser(id)) }),
  testReg,
);
const app = createApp();

const createExtended = mycl(createApp, loggingReg); // extends: testReg + loggingReg
```

`mycl` is not a package export: it comes on the kernel [`createFnChannel`](#createfnchannel)
returns, as in the running kernel above.

**Errors:** provider-completeness is a compile-time type error, not a throw. At runtime, a capability invoked **after** `make` returns (inside a callback that was not wrapped in [`snapshot`](#snapshot)) has lost the resolved scope and throws [error 1](/errors/1/). See [Factories](/guide/factories/).

### `requires`

```ts
requires<const Caps extends readonly AnyCapability[]>(...caps: Caps):
  <F extends AnyFn>(make: F) => Requiring<F, CapabilityId<Caps[number]>>
```

**Compile-time only, with zero runtime effect.** Declare the capabilities an entry function requires its registry to provide. Curried: `requires(db, currentUser)(make)` returns `make` **unchanged at runtime** and tags its *type* with the union of those capabilities' identifiers (e.g. `'my-app-or-library:db' | 'my-app-or-library:currentUser'`). The enforcement point is [`mycl(make, ...regs)`](#mycl), which then type-errors unless the registries provide every tagged identifier, naming any that are missing. The currency is capability **values**, not identifier strings: refactor-safe and autocompleting.

```ts
import { registry, requires } from '@mycl/core';

const db = capable((): Db => { throw new Error('no db bound'); }, 'db');

const handler = requires(db)((req: Req) => db().query(req.id));

mycl(handler, registry().layer(db, () => realDb)); // ✓ provides db
mycl(handler, registry());
// ✗ type error: mycl: registry is missing required capability: my-app-or-library:db
```

Opt-in: a `make` passed to `mycl` without `requires` has an empty required set and is unchecked. Intended for **required-effect seams**: capabilities whose base throws or stubs (like `db` above); enrichment capabilities with a usable base need not be listed. Worth knowing: the list is hand-maintained (it cannot read the call body); it is enforced at `mycl` only; and it is **permissive when the registry's layers are not visible**: passing a pre-resolved `ResolvedRegistry` (from `merge(...)`) or a build-collapsed registry makes the provided set unknown, so the check passes rather than failing falsely.

**Errors:** none; `requires` has no runtime behavior.

### `snapshot`

```ts
snapshot<T extends AnyFn>(fn: T): Snapshotted<T>
```

Pin the currently-active scope (including "no scope") onto `fn` and replay it on every later call: the manual carrier across async boundaries. Returns a call-signature-only wrapper (a [`Snapshotted<T>`](#snapshottedt)): `this`, params, and return type are preserved, own properties are dropped, and a capability passed in comes back de-branded. Call `snapshot` **while a scope is active** (inside a `mycl` factory, or a synchronous call chain it initiates); the returned wrapper then carries that scope into deferred callbacks.

```ts
const createApp = mycl(() => ({
  load: snapshot(async (id: string) => {
    const finish = snapshot((u: User) => fetchUser(u.id)); // scope preserved in .then()
    return fetchUser(id).then(finish);
  }),
}), testReg);
```

`snapshot` comes on the kernel [`createFnChannel`](#createfnchannel) returns, pre-bound to
your channel, as in the running kernel above.

**Errors:** if `snapshot` captures a moment with no active scope, the replayed wrapper dispatches capabilities without one and throws [error 1](/errors/1/), the loud signal of a missed async boundary. On Node, [`alsContext`](#alscontext) retires manual snapshotting for automatic propagation instead. See [Snapshots and async](/guide/snapshots-and-async/).

### `channel` (the token on your kernel)

```ts
channel: Channel<G>   // on the kernel createFnChannel returns
```

Your channel's token (a [`Channel`](#channelg)), on the kernel alongside `capable`/`snapshot`/`mycl`/`scope`. Pass it to [`setChannelContext`](#setchannelcontext) to swap the channel's backing context, for example to install [`alsContext`](#alscontext) for automatic async scope propagation instead of manual `snapshot`.

```ts
import { setChannelContext } from '@mycl/core';
import { alsContext } from '@mycl/core/context';
import { channel } from './kernel'; // your createFnChannel('my-app-or-library') module

setChannelContext(channel, alsContext());
```

### `setChannelContext`

```ts
setChannelContext(channel: Channel, ctx: ScopeContext<ResolvedRegistry>): void
```

Swap the [`ScopeContext`](#scopecontextr) backing an existing channel, in place. The swap is visible immediately to **every** capability and snapshot already built from that channel: dispatch reads the channel's mutable context cell live, so no per-call lookup and no rebuild are needed. This is how you install [`alsContext`](#alscontext) (or any custom context) once at startup. Throws [error 3](/errors/3/) if `channel` is not a valid channel. A context instance belongs to **one** channel: installing one that already backs another channel throws [error 16](/errors/16/) in dev, because a shared context would merge the channels' scopes (see [Channels are disjoint](/guide/channels/#channels-are-disjoint)). Mint a fresh context per channel.

```ts
import { setChannelContext } from '@mycl/core';
import { alsContext } from '@mycl/core/context';
import { channel } from './kernel'; // your createFnChannel('my-app-or-library') module

setChannelContext(channel, alsContext());
```

### `isCapability`

```ts
isCapability(value: unknown): value is AnyCapability
```

Type guard: `true` if `value` is a capability created by any `capable()` call in the same realm (it carries the package's global brand symbol). Narrows to [`AnyCapability`](#anycapability).

### `isResolvedRegistry`

```ts
isResolvedRegistry(reg: Registry | ResolvedRegistry): reg is ResolvedRegistry
```

Type guard: `true` if `reg` is a [`ResolvedRegistry`](#resolvedregistry) (it exposes `resolve`) rather than a buildable [`Registry`](#registryl).

---

### Types (root)

Every type below is exported from `@mycl/core`'s main entry. Import with `import type`.

#### `FnKernel<G>`

```ts
interface FnKernel<G extends string> {
  channel: Channel<G>;
  capable: ChannelSurface<G>['capable'];
  snapshot: ChannelSurface<G>['snapshot'];
  mycl: Mycl;
  scope: Scope;
}
```

The kernel shape [`createFnChannel`](#createfnchannel) returns: the channel-bound everyday surface, without the raw context. You rarely write this by hand; it is what `createFnChannel(name)` produces.

#### `MyclFactory<T, Args, Regs>`

```ts
type MyclFactory<
  T = unknown,
  Args extends any[] = any[],
  Regs extends readonly Registry[] = readonly Registry[],
> = ((...args: Args) => T) & { readonly [MYCL_META]: MyclFactoryMeta<Regs> }
```

The frozen callable returned by [`mycl`](#mycl). `T` is `make`'s return type, `Args` its parameters, `Regs` the stored registry tuple (extension appends to it). You rarely write this by hand: it is what a `mycl(...)` call produces; annotate a variable with it when passing a factory across a module boundary.

#### `SuppliedRegistries<F>`

```ts
type SuppliedRegistries<F> =
  F extends { readonly [MYCL_META]: MyclFactoryMeta<infer Regs> } ? Regs : never
```

The registry tuple a factory was built over (`never` for a non-factory). The single factory-level reader. Everything else composes from the core readers:

```ts
type Regs   = SuppliedRegistries<typeof createApp>;   // the stored registry tuple
type Layers = RegistryLayers<Regs[number]>;           // combined type-level layers
type Caps   = CapabilityLayers<Layers, typeof fetchUser>; // layers on fetchUser
type Ids    = ProvidedIds<Regs[number]>;              // provided capability identifiers
```

#### `Requiring<F, R>`

```ts
type Requiring<F extends AnyFn, R extends string> = F & { readonly [REQUIRES]: R }
```

A `make` function tagged with the union `R` of capability identifiers it requires: the return type of [`requires(...)(make)`](#requires). You seldom name it; it flows automatically from `requires` into `mycl`'s provider-completeness check.

#### `RequiredIds<F>`

```ts
type RequiredIds<F> = F extends { readonly [REQUIRES]: infer R extends string } ? R : never
```

Extract the required-identifier union tagged on a make (`never` when unwrapped). Used internally by `mycl`; occasionally handy when writing a wrapper over `mycl` that needs to read a make's requirements.

#### `Mycl` and `Scope`

```ts
interface Mycl {
  <F extends AnyFn, const Regs extends readonly Registry[]>(
    make: F, ...registries: Regs /* or a MissingCapabilities message, see mycl() */
  ): MyclFactory<ReturnType<F>, Parameters<F>, readonly [...StoredRegs<F>, ...Regs]>;
}

type Scope = {
  <T extends AnyFn>(fn: T): Snapshotted<T>;
  <T extends AnyFn>(fn: T, reg: Registry | ResolvedRegistry): Snapshotted<T>;
};
```

The call-signature types of [`mycl`](#mycl) and [`scope`](#scope) as they appear on a kernel. Annotate a re-export with them: `export const scope: Scope = kernel.scope`.

#### `ChannelName<G>`

```ts
type ChannelName<G extends string> = G extends `${string}${':' | '/'}${string}`
  ? `mycl: channel name must not contain ':' or '/', got '${G}'` : G
```

Rejects a channel name containing the `:` or `/` identifier separators at the type level: a clean name passes through unchanged (literal inference of `G` intact), an offending one is replaced by a self-describing message type, so the compiler error names the culprit instead of collapsing to `never`. [`createChannel`](#createchannel)'s `name` parameter uses this; a bound factory like `createFnChannel` validates identically.

#### `Channel<G>`

```ts
interface Channel<G extends string = string> {
  readonly [CHANNEL_KEY]: symbol;
  readonly name: G;
}
```

The opaque channel token returned as `channel` from [`createFnChannel`](#createfnchannel) (or [`createChannel`](#createchannel)). Its hidden symbol proves provenance. Pass it to [`setChannelContext`](#setchannelcontext).

#### `ScopeContext<R>`

```ts
interface ScopeContext<R = unknown> {
  get: () => R | undefined;
  run: <T>(value: R | undefined, fn: () => T) => T;
}
```

Scoped access to a value: stores and retrieves, never inspects. `get` returns the active value or `undefined` when no scope is active; `run` executes `fn` within the scope of `value` and must be synchronous. Passing `undefined` to `run` **pins scopelessness**: inside `fn`, `get()` returns `undefined` even when an outer scope is active. A channel requires `ScopeContext<ResolvedRegistry>`. [`stackContext`](#stackcontext) and [`alsContext`](#alscontext), both on `/context`, are the built-in implementations.

#### `LayerStrategy<T, V, Args>`

```ts
interface LayerStrategy<T extends AnyFn, V, Args extends unknown[] = [V]> {
  extract: (value: V, base: T) => T;
  step: (acc: V | undefined) => (...args: Args) => V;
  seed?: V;
}
```

The **layer strategy** on a capability: a left fold (the shape of `reduce`) over its `.layer()` values:

- `step(acc)(...args)`: the fold function; `acc` is the value folded so far, `undefined` for the first layer (the strategy owns the no-prior-value case, no resolver branching).
- `extract(value, base)`: projects the final folded value into a callable `T`; `base` is the prior stage's result, or the capability's base function for the first stage. Must return a function: a non-function makes dispatch throw [error 2](/errors/2/).
- `seed`: optional initial accumulator. It seeds `step`; it does **not** trigger the strategy. With zero layers, dispatch falls through to the base regardless.

Because it is a left fold, composition is free: layers from composed registries fold as one sequence, in registration order within a registry and composition order across registries, so contributors never coordinate.

With no strategy a capability uses the implicit default: last-wins `step`, an identity-function `extract`. This is a **layer strategy** (it folds `.layer()` values), unrelated to [`merge()`](#merge). See [Layer strategies](/guide/layer-strategies/).

#### `AnyFn`

```ts
type AnyFn = (...args: any[]) => unknown
```

The unconstrained function bound used throughout the capability generics. Params are `any[]` so every function satisfies it; the return is `unknown` to stop leakage.

#### `AugmentWrapper<F>`

```ts
type AugmentWrapper<F extends AnyFn = AnyFn> = (next: F) => F
```

The unit `.augment()` composes: takes the next callable in the chain and returns a new one of the same signature (outer wraps inner wraps base). Write it directly, or produce one with a [helper](#myclcorehelpers).

#### `Transform<T>`

```ts
type Transform<T extends AnyFn> = (value: ReturnType<T>) => ReturnType<T>
```

A single result transformer in a [`pipe`](#pipe) chain: maps the capability's return value to a new value of the same type.

#### `Capability<T, V, Args, Id>`

```ts
type Capability<T extends AnyFn = AnyFn, V = T, Args extends unknown[] = [V], Id extends string = string>
```

The full nominal type produced by `capable()`. `T` is the callable signature (what users call). `V` is the value stored in a registry (what `.layer()` contributions accumulate into). `Args` is the tuple each `.layer()` call accepts. For ordinary function capabilities `V = T` and `Args = [V]`; ignore both. `Id` is the assembled identifier literal (`name:project/capability`), an invariant brand that makes two otherwise identically-shaped capabilities distinct types (the discriminant behind a registry's total layers). See [Type guarantees](/advanced/type-guarantees/#capabilityt-v-args-id-and-identifier-as-discriminant).

#### `AnyCapability`

```ts
type AnyCapability = Capability<AnyFn, any, any, string>
```

The runtime-erasure view: any capability, with its value/identifier contracts intentionally discarded. Used wherever code only needs to *invoke* or *key on* a capability, not honor its value contract: `.augment`, `.has`, `explain`, the guards.

#### `IdPath<Id>`

```ts
type IdPath<Id extends string>
```

The type-level validator for the string `capable()` takes as `idPath`: any non-empty literal passes through unchanged; an empty one is replaced by a self-describing message type, so the compiler error says why instead of collapsing to a generic mismatch.

#### `CapableConfig<T, V, Args>`

```ts
interface CapableConfig<T extends AnyFn = AnyFn, V = T, Args extends unknown[] = [V]> {
  strategy?: LayerStrategy<T, V, Args>;
}
```

The optional third argument to `capable(baseFn, idPath, config)`. Its only field is `strategy`, which selects custom layer-fold semantics. The identifier path is a mandatory positional argument, **not** a config field.

#### `Snapshotted<T>`

```ts
type Snapshotted<T extends AnyFn> =
  (this: ThisParameterType<T>, ...args: Parameters<T>) => ReturnType<T>
```

The return type of `snapshot(fn)` (and a kernel's `scope(fn, reg?)`). A call-signature-only wrapper: `this`, params, and return type match `T`; own properties are dropped (a capability passed in comes back de-branded).

#### `CapabilityId<C>`

```ts
type CapabilityId<C extends AnyCapability> = /* C's identifier literal */
```

A capability's assembled identifier literal (`name:project/capability`), read straight off its identifier slot.

#### `AccumulatedValue<C>`

```ts
type AccumulatedValue<C extends AnyCapability> = /* C's V */
```

The value type `V` a capability accumulates in the registry (`T` for a plain capability): the type `.layer()` contributions fold into, read straight off `C`'s invariant contract slot.

#### `LayerArgs<C>`

```ts
type LayerArgs<C extends AnyCapability> = /* C's Args */
```

The tuple each `.layer()` call accepts for a capability (`[T]` for a plain capability), read off the same contract slot as [`AccumulatedValue`](#accumulatedvaluec).

#### `Registry<L>`

The type of an immutable, clone-on-write registry, parameterized by its type-level layers `L` (a `readonly RegistryLayer[]`). Exposes `.layer`, `.augment`, `.has`, `.bindings` (see [`registry`](#registry)).

#### `RegistryBindings`

```ts
type RegistryBindings = ReadonlyMap<AnyCapability, RegistryBindingValue>
```

The capability→binding-value map a registry stores, returned by [`.bindings()`](#bindings). The `RegistryBindingValue` shape is an internal binding record (layer args and boxed augments) and is intentionally **not** root-exported: read it through [introspection](#myclcoreintrospect), not by hand.

#### `ResolvedRegistry`

```ts
interface ResolvedRegistry {
  resolve: (capability: AnyCapability) => AnyFn | null;
}
```

The composed, dispatch-ready output of [`merge`](#merge) (or built internally by a kernel's `scope`), and the only form a scope dispatches against. Its single `resolve` method maps a capability to the function to call (or `null` for the base), and must return the same result for the same capability for the registry's lifetime: the dispatch cache assumes this; build a new `ResolvedRegistry` when bindings change.

#### `RegistryLayer`

```ts
type RegistryLayer = { cap: AnyCapability; args: readonly unknown[] }
```

One layer recorded in a registry's **type-level layers**: the type-level record of a `.layer(cap, ...args)` call. Because every capability has an identifier, the registry's layers are **total**: they record every layered capability, not an opt-in subset.

#### `RegistryLayers<R>`

```ts
type RegistryLayers<R> = R extends Registry<infer L> ? L : never
```

Extracts a registry type's type-level layers tuple `L`.

#### `CapabilityLayers<L, C>`

```ts
type CapabilityLayers<L extends readonly RegistryLayer[], C extends AnyCapability>
```

The layers in `L` layered onto a specific capability `C`. Takes **two** type parameters (the layers tuple and the capability) and filters by the capability's identifier literal (its 4th type param), so it selects `C`'s layers even among same-shaped capabilities.

#### `ProvidedIds<R>`

```ts
type ProvidedIds<R> = R extends Registry<infer L> ? CapabilityId<L[number]['cap']> : never
```

The union of capability identifiers a registry provides, read off its type-level layers. Distributes over a union of registries, so `ProvidedIds<RegA | RegB>` unions both. This is the type a kernel's provider-completeness check measures a `requires` set against. See [Provider-completeness](/advanced/type-guarantees/#provider-completeness-with-requires).

---

## `@mycl/core/helpers`

Standalone augmentation helpers: pure generics over a capability's function type `T`, inferred at the `.augment(cap, …)` call site. Each returns an [`AugmentWrapper<T>`](#augmentwrapperf). Deliberately not on the main entry; import from here whenever you augment.

```ts
import { before, after, pipe, handleError } from '@mycl/core/helpers';
```

### `before`

```ts
before<T extends AnyFn>(fn: (...args: Parameters<T>) => void): AugmentWrapper<T>
```

Build an augment that runs `fn` with the call's arguments **before** the capability executes. The return value of `fn` is ignored; the capability's result passes through untouched.

```ts
import { registry } from '@mycl/core';
import { before } from '@mycl/core/helpers';

registry().augment(fetchUser, before((id) => console.log('fetching', id)));
```

### `after`

```ts
after<T extends AnyFn>(fn: (result: ReturnType<T>, ...args: Parameters<T>) => void): AugmentWrapper<T>
```

Build an augment that runs `fn` with the result and the original arguments **after** the capability executes; the original result passes through. **Async caveat:** the result is observed as-is, so for an async capability that is the *Promise*, not the settled value; `await` inside `fn` if you need it. See [Augmentation](/guide/augmentation/).

### `pipe`

```ts
pipe<T extends AnyFn>(...fns: Transform<T>[]): AugmentWrapper<T>
```

Build an augment that threads the capability's return value through one or more [`Transform<T>`](#transformt) functions left-to-right. **Async caveat:** sync-only, so for an async capability the value piped is the *Promise*. See [Augmentation](/guide/augmentation/).

### `handleError`

```ts
handleError<T extends AnyFn>(
  handler: (error: unknown, ...args: Parameters<T>) => ReturnType<T> | Awaited<ReturnType<T>>,
  shouldHandle?: (error: unknown) => boolean,
  options?: { rethrow?: boolean },
): AugmentWrapper<T>
```

Build an augment that catches sync throws **and** async rejections (any thenable) from the capability, replacing the result with `handler(error, ...args)`. Pass `shouldHandle` to filter which errors are caught: errors it rejects re-throw. With `{ rethrow: true }` the handler runs for side effects only: its return value is discarded and the original error rethrows. This is the one augmentation helper that catches across the async boundary.

```ts
import { registry } from '@mycl/core';
import { handleError } from '@mycl/core/helpers';

const canaryReg = registry()
  .layer(processPayment, newPaymentImpl)
  .augment(processPayment, handleError(
    (err, ...args) => { reportError(err); return oldPaymentImpl(...args); },
    (err) => err instanceof PaymentError,
  ));
```

---

## `@mycl/core/context`

`ScopeContext` implementations, for kernel authors wiring a channel's backing store.

```ts
import { stackContext, alsContext } from '@mycl/core/context';
import type { ScopeContext } from '@mycl/core';
```

### `stackContext`

```ts
stackContext<R = ResolvedRegistry>(): ScopeContext<R>
```

Create a fresh synchronous, stack-based [`ScopeContext`](#scopecontextr), the built-in default. `run` pushes the value onto a stack for the duration of `fn` and always pops after; `get` reads the top. `R` defaults to `ResolvedRegistry` (what `createChannel` expects), so `stackContext()` needs no annotation in the common case.

Correct for synchronous code and tests. It does **not** propagate scope across `await` boundaries. For that, install [`alsContext`](#alscontext) via [`setChannelContext`](#setchannelcontext), or carry scope manually with `snapshot`.

### `alsContext`

```ts
alsContext(): ScopeContext<ResolvedRegistry>
```

Create an `AsyncLocalStorage`-backed [`ScopeContext`](#scopecontextr): one store minted per call, carrying the scoped registry across `await`, `setTimeout`, and microtask boundaries inside `run`. Install it with [`setChannelContext`](#setchannelcontext) to retire manual `snapshot` calls on Node:

```ts
import { setChannelContext } from '@mycl/core';
import { alsContext } from '@mycl/core/context';
import { channel } from './kernel'; // your createFnChannel('my-app-or-library') module

setChannelContext(channel, alsContext());
```

The `node:async_hooks` builtin resolves **lazily**, through `process.getBuiltinModule`, the first time `alsContext()` is *called*, never through a static import: the module stays browser-safe to import even for consumers that never call it, so importing `@mycl/core/context` cannot break a browser build on its own. That lazy resolution needs Node 20.16 or newer (or another runtime that provides `process.getBuiltinModule`); this is `alsContext`'s own floor, not the package's, everything else in mycl runs anywhere.

**Errors:** throws [error 14](/errors/14/) where `process.getBuiltinModule` is unavailable. Reach for [`stackContext`](#stackcontext) there instead, or install your own `ScopeContext` (it is just `{ get, run }`). See [Snapshots and async](/guide/snapshots-and-async/).

---

## `@mycl/core/factory`

:::caution[Connector and build-plugin authors only]
This is the contract one level above the everyday surface: connector authors
writing a kernel like `createFnChannel`'s, and build tooling that folds
registries ahead of time. It is **not** a general-purpose user API; symbols
here may change as the contract evolves. Ordinary application code never
imports this subpath.
:::

```ts
import { createChannel, merge, foldBindings, resolveContext, defineInternal } from '@mycl/core/factory';
import type { Connector, ChannelSurface } from '@mycl/core/factory';
```

One more export, `resolveSnapshot`, is intentionally undocumented: `createFnChannel`'s internal scope binder composes it, and it is not part of the documented surface.

### `createChannel`

```ts
createChannel<const G extends string, K>(
  name: G,  // must not contain ':' or '/' (enforced at the type level)
  connector: Connector<G, K>,
): K
```

Create a named **channel** for a **connector**, the once-per-kernel call that stands up a runtime. `createChannel` hands `name` to the connector, mints the channel over the connector's fresh context, and returns the kernel the connector's `build` curates from the channel's [`ChannelSurface`](#channelsurfaceg). There is no connectorless form: a channel always belongs to the connector that operates it, and its context never escapes, so two channels cannot share a scope stack by accident.

The channel `name` (e.g. `'app'`) becomes the leading `name:` segment of every capability identifier minted through this channel's `capable` (see [Capability identifier](#capability-identifier)). The name **must not contain `:` or `/`**: banning `:` keeps the first `:` an unambiguous delimiter, so distinct name/path pairs can never assemble the same identifier, and `/` is reserved as the path segment separator. A name with either is a type error, and in dev throws [error 12](/errors/12/). Dots are fine (`my.kernel` is valid).

```ts
import { stackContext } from '@mycl/core/context';
import { createChannel } from '@mycl/core/factory';
import type { ChannelSurface } from '@mycl/core/factory';

const myConnector = <G extends string>(_name: G) => ({
  context: stackContext(),
  build: (surface: ChannelSurface<G>) => surface, // curate your kernel here
});

const { capable, snapshot, channel, context } = createChannel('my.kernel', myConnector);

const greet = capable((name: string) => `hi ${name}`, 'greet');
// greet identifier: 'my.kernel:greet'
```

[`createFnChannel`](#createfnchannel) is exactly one such call bound to an internal connector. See [Building a Kernel](/advanced/building-a-kernel/) for the full walkthrough, including writing a connector of your own.

### `merge`

```ts
merge(...registries: Registry[]): ResolvedRegistry
```

Compose whole registries into a single [`ResolvedRegistry`](#resolvedregistry), the dispatch-ready form a scope runs against. Later registries win per capability; augments accumulate across all of them. `merge()` with no arguments is the empty resolved registry. The same registry sequence (by object identity, in order) always returns the **same** instance, cached on a composite-symbol trie.

This is the composition primitive a kernel's boundary members are built on: `mycl` and `scope` call it internally on their variadic registries, which is why channel users never import it. Reach for it directly when *you* are the kernel: a connector's boundary member runs a scope by hand, and a build plugin precomputes the resolved form.

```ts
import { merge } from '@mycl/core/factory';

// A connector's boundary member: run fn inside a scope over the registries.
run: <T>(fn: () => T, ...regs: Registry[]): T =>
  surface.context.run(merge(...regs), fn),
```

A precomputed `ResolvedRegistry` is still accepted by any kernel's `scope`/`mycl` as the **sole** scope source (`scope(fn, resolved)`), so tooling can hand its output back to the everyday surface.

**Errors:** `merge` composes lazily and does not throw for valid registries. If a capability's `LayerStrategy.extract` returns a non-function, that surfaces as [error 2](/errors/2/) when the resolved scope dispatches the capability. A `ResolvedRegistry` cannot be re-composed: passing one to `merge` throws [error 15](/errors/15/) in dev.

### `Connector`

```ts
type Connector<G extends string, K> = (name: G) => {
  context: ScopeContext<ResolvedRegistry>;
  build(surface: ChannelSurface<G>): K;
};
```

The per-environment bundle [`createChannel`](#createchannel) invokes: a function of the channel name returning the channel's **fresh context** and `build`, which shapes the public kernel `K` from the channel's [`ChannelSurface`](#channelsurfaceg). Core defines and invokes this contract but never implements one (the same pattern as `LayerStrategy`): the everyday implementation is the internal connector behind [`createFnChannel`](#createfnchannel), and a custom connector is how you pick a different context (e.g. [`alsContext`](#alscontext) from the start) or curate a different kernel surface.

Two rules for connector authors:

- **Mint the context inside the connector.** A context closed over from outside is shared by every channel the connector mints, collapsing their scopes into one.
- **Write your connector generic over `G`** (`<G extends string>(name: G) => …`) so the kernel type carries each channel's name literal. The name parameter is the type-level carrier; it is also legitimately useful for diagnostics.

The minimal **identity connector**, for tooling and infrastructure that want the raw channel surface:

```ts
const bare = <G extends string>(_name: G) => ({
  context: stackContext(),
  build: (surface: ChannelSurface<G>) => surface,
});
const { capable, snapshot, channel, context } = createChannel('infra', bare);
```

### `ChannelSurface<G>`

```ts
interface ChannelSurface<G extends string = string> {
  capable: <T extends AnyFn, V = T, Args extends unknown[] = [V], const Id extends string = string>(
    baseFn: T | Capability<T, any, any, any>,
    idPath: IdPath<Id>,
    config?: CapableConfig<T, V, Args>,
  ) => Capability<T, V, Args, `${G}:${Id}`>;
  snapshot: <T extends AnyFn>(fn: T) => Snapshotted<T>;
  channel: Channel<G>;
  context: ScopeContext<ResolvedRegistry>;
}
```

Everything core exposes per channel (capable, snapshot, token, context facade), handed to a [`Connector`](#connector)'s `build`, which curates it into the kernel (and what the identity connector returns verbatim). `capable` prefixes the channel name `G` onto the identifier path to form the `${G}:${Id}` identifier carried in the capability's type; `context` is the live facade that follows [`setChannelContext`](#setchannelcontext) swaps. What of this reaches users is each connector's choice: `createFnChannel`'s connector passes on everything but `context`.

### `foldBindings`

```ts
foldBindings(
  cap: AnyCapability,
  // one binding per contributing registry; augments arrive boxed and are unboxed here
  entries: Iterable<{ argsList?: ReadonlyArray<ReadonlyArray<unknown>>; augments: ReadonlyArray<readonly [AugmentWrapper]> }>,
): AnyFn | null
```

The single fold both the runtime path (`merge`, after it dedups a registry sequence into canonical binding values) and the build-plugin path route through, so the two can never compute a capability differently. Each binding's `augments` arrive as boxed singleton tuples, the shape `RegistryBindingValue` also carries at rest; `foldBindings` unboxes them as it collects. A build plugin folds a capability's collapsed binding stream through this eagerly, at module init, and stores the result (`AnyFn` = dispatch to it, `null` = use the base) in its own keying structure: typically a `WeakMap<AnyCapability, AnyFn | null>` behind a plain frozen [`ResolvedRegistry`](#resolvedregistry), which `scope`/`mycl` accept through the existing passthrough with no separate build-plugin code path.

### `resolveContext`

```ts
resolveContext(channel: Channel): ScopeContext<ResolvedRegistry>
```

The channel-keyed context accessor, for kernel authors who hold only the channel token. Returns a forwarding facade over the channel's context: it captures the channel's context cell once (validating provenance eagerly, [error 3](/errors/3/)) and reads the live context per call, so the facade follows [`setChannelContext`](#setchannelcontext) swaps made after it was created. `createChannel` builds its `.context` field through this; `createFnChannel`'s internal `mycl` and `scope` binders are its main consumers.

### `defineInternal`

```ts
defineInternal<T extends object>(obj: T, key: PropertyKey, value: unknown): void
```

Define a non-writable, non-enumerable property: the substrate's helper for stamping capabilities and channel tokens with their hidden symbol slots. Exported for kernels that stamp their own internal metadata the same way.

The capability symbols (tag, base, config, id, cache) stay private to the substrate: [`isCapability`](#iscapability) is the public detection surface.

---

## `@mycl/core/introspect`

Three **pure, read-only** functions over a [`Registry`](#registryl). They never mutate, do I/O, or **invoke a capability**: they describe a registry's bindings and what a capability *would* resolve to, computed from the same entry shape dispatch reads. They live on their own subpath to stay out of the core critical-path bundle: you pay for them only if you import them. Being deterministic over the immutable registry makes them both an audit/test primitive and the runtime counterpart to the compile-time [provider-completeness check](/advanced/type-guarantees/#provider-completeness-with-requires).

`describe` collides with the Vitest/Jest test global exactly where introspection is most used. Import the namespace to keep both:

```ts
import * as introspect from '@mycl/core/introspect';

introspect.describe(reg);    // [{ identity: 'my-app-or-library:db', layers: 1, augments: 0, strategy: 'last-wins' }, …]
introspect.explain(reg, db); // { identity: 'my-app-or-library:db', bound: true, resolvesToBase: false, layers: 1, augments: 0, strategy: 'last-wins' }
introspect.diff(regA, regB); // { added: ['my-app-or-library:log'], removed: [], changed: [] }
```

### `describe`

```ts
describe(reg: Registry): CapabilityDescription[]
```

List every capability `reg` binds. Each row is `{ identity, layers, augments, strategy }`.

### `explain`

```ts
explain(reg: Registry, cap: AnyCapability): Explanation
```

What `cap` resolves to under `reg`, **without invoking it**: the debugging answer to "is my override taking?". Returns the `CapabilityDescription` fields plus `bound` (the registry carries any contribution for `cap`) and `resolvesToBase` (nothing is bound, so dispatch falls through to the capability's base). For example, `expect(explain(reg, cap).resolvesToBase).toBe(false)` asserts an override is in place.

### `diff`

```ts
diff(regA: Registry, regB: Registry): RegistryDiff
```

Capability identities `{ added, removed, changed }` between two registries. `changed` is detected by a structural signature (layer count + augment count), so it catches added or removed contributions, but **not** a changed *value* at the same count (that would need a deep argument comparison).

### Introspection types

#### `StrategyKind`

```ts
type StrategyKind = 'last-wins' | 'custom'
```

Whether a capability merges via the implicit last-wins default or a custom [`LayerStrategy`](#layerstrategyt-v-args).

#### `CapabilityDescription`

```ts
interface CapabilityDescription {
  identity: string;
  layers: number;    // count of .layer(cap, …) contributions
  augments: number;  // count of .augment(cap, …) wrappers
  strategy: StrategyKind;
}
```

One row of [`describe`](#describe).

#### `Explanation`

```ts
interface Explanation extends CapabilityDescription {
  bound: boolean;          // registry carries any contribution for this capability
  resolvesToBase: boolean; // nothing bound → dispatch falls through to the base
}
```

The result of [`explain`](#explain).

#### `RegistryDiff`

```ts
interface RegistryDiff {
  added: string[];
  removed: string[];
  changed: string[];
}
```

The result of [`diff`](#diff): identities in each bucket.

---

## Where next

- [Capabilities guide](/guide/capabilities/): the mental model behind `capable`.
- [Factories guide](/guide/factories/): `mycl`, `scope`, and `snapshot` in practice.
- [Building a Kernel](/advanced/building-a-kernel/): the `/factory` and `/context` subpaths, for connector authors.
- [The Core Substrate](/advanced/core-substrate/): how the entry split fits together.

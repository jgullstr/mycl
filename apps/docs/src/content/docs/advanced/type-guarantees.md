---
title: Type Guarantees
description: "How mycl's types enforce contracts at the layer boundary: the Capability discriminant, AnyCapability, requires provider-completeness, and reading a registry's type-level layers."
---

mycl enforces its contracts at compile time. The value you `layer` and the
wrapper you `augment` must match the capability's declared signature, a
capability's identifier is part of its type, and `requires` can make a registry
type-error before it is ever run. This page shows each guarantee and the actual
compiler error it produces.

The blocks below are static because they are meant *not* to compile. Each shows
the error TypeScript prints. TypeScript reports resolved signatures, not the alias
names, so the messages name concrete function types.

## `layer` rejects a mismatched value

`layer(cap, value)` requires `value` to satisfy the capability's full signature.
An incompatible implementation does not compile:

```ts
import { createFnChannel, registry } from '@mycl/core';

const { capable } = createFnChannel('my-app-or-library');

const greet = capable((name: string) => `hello ${name}`, 'greet');

registry().layer(greet, (name: number) => `hello ${name}`);
// error TS2345: Argument of type '(name: number) => string' is not assignable
//   to parameter of type '(name: string) => string'.
//     Types of parameters 'name' and 'name' are incompatible.
//       Type 'string' is not assignable to type 'number'.
```

## `augment` rejects a signature change

`augment(cap, wrapper)` requires the wrapper to preserve the signature
end-to-end. Change the return type (or a parameter type) and it does not compile:

```ts
registry().augment(greet, next => (name: string) => next(name).length);
// error TS2322: Type '(name: string) => number' is not assignable to
//   type '(name: string) => string'.
//     Type 'number' is not assignable to type 'string'.
```

A wrapper that keeps the signature is accepted:

```ts
registry().augment(greet, next => (name: string) => next(name).toUpperCase());
// ✓ still (name: string) => string
```

## `Capability<T, V, Args, Id>` and identifier as discriminant

A capability's type carries four parameters:

- `T`: the callable signature users invoke.
- `V`: the value a `layer` contribution stores (equal to `T` for ordinary
  function capabilities; different when a [layer strategy](/guide/layer-strategies/)
  accumulates something else).
- `Args`: the tuple each `layer` call accepts (`[V]` by default).
- `Id`: the assembled identifier literal, `channelName:idPath`.

`Id` is not just a runtime label. It is a string **literal** in the type,
preserved by `const` inference from the identifier path you pass to `capable`. Two
capabilities that share a signature and value contract are still **distinct
types**, because their identifier literals differ:

```ts
const a = capable((n: string) => n, 'a'); // Capability<…, 'my-app-or-library:a'>
const b = capable((n: string) => n, 'b'); // Capability<…, 'my-app-or-library:b'>
// a and b have identical call signatures but are not interchangeable types.
```

Because every capability carries a mandatory identifier, a registry's type-level
**layers** are *total*: they record every layered capability, and same-shaped
ones never conflate. The value contract `V` is an invariant brand on top of that:
a capability typed for `string` values is not assignable to one typed for
`number` values even when their call signatures overlap, which blocks silent
substitution of capabilities with different semantics.

## `AnyCapability` for heterogeneous collections

Code that operates on capabilities *generically* (a guard, a middleware helper,
a registry inspector) cannot name a specific `V` or `Id`. `AnyCapability`
(`Capability<AnyFn, any, any, string>`) is the erased view: enough to invoke or
key on a capability, without the value-contract brand or a concrete identifier. It
is what lets a heterogeneous list of capabilities share one type:

```ts
import type { AnyCapability, Registry } from '@mycl/core';

// Works over any mix of capabilities, whatever each one's value contract is.
const boundCount = (reg: Registry, caps: AnyCapability[]): number =>
  caps.filter(cap => reg.has(cap)).length;
```

`registry().has(cap)` and the map returned by `registry().bindings()` are both
typed in terms of `AnyCapability` for exactly this reason. Code that *contributes*
a concrete implementation keeps the full `Capability<T, V, Args, Id>` type so the
value can be checked; code that *ranges over* capabilities takes `AnyCapability`.

## Provider-completeness with `requires`

The registry's total layers let `mycl` check that the registries you pass actually provide
what an entry point needs. Wrap a `make` function with `requires(...)` to declare
its required capabilities; `mycl(make, ...regs)` then type-errors unless the
registries provide every one, naming any that are missing:

```ts
import { createFnChannel, registry, requires } from '@mycl/core';

const { capable, mycl } = createFnChannel('my-app-or-library');

type Db = { query: (id: string) => unknown };
const db = capable((): Db => { throw new Error('no db bound'); }, 'db');

const handler = requires(db)((req: { id: string }) => db().query(req.id));

mycl(handler, registry().layer(db, () => realDb)); // ✓ provides db

mycl(handler, registry());
// error TS2345: Argument of type 'Registry<readonly []>' is not assignable to
//   parameter of type '"mycl: registry is missing required capability: my-app-or-library:db"'.
```

`requires` is **compile-time only, zero runtime**: it returns `make` unchanged;
the required set is read purely at the type level. It is honest about its bounds:

- The list is **hand-maintained**: it declares intent and cannot read the call
  graph. Use it for required-effect seams (capabilities whose base throws or
  stubs); an enrichment capability with a working base need not be listed.
- It is enforced at **`mycl` only**, not `scope`. Requirements split across
  several registries union their provided sets.
- It is **permissive when the layers aren't visible**: a pre-resolved
  `ResolvedRegistry` (from `merge(...)`) or a build-collapsed registry carries no
  type-level layers, so the provided set is unknown and the check passes rather than
  failing falsely. It is sound when it fires, silent when it can't see the layers.

## Reading the layers

The same total layers are readable at the type level. Four readers cover it.
Note that `CapabilityLayers` takes **two** type parameters (the layers and the capability):

```ts
import type { RegistryLayers, CapabilityLayers, ProvidedIds, CapabilityId } from '@mycl/core';

const reg = registry().layer(greet, (n: string) => `hi ${n}`);

type Layers  = RegistryLayers<typeof reg>;           // the registry's type-level layers
type Greets  = CapabilityLayers<Layers, typeof greet>; // layers on `greet`
type Ids     = ProvidedIds<typeof reg>;              // union of provided identifiers
type GreetId = CapabilityId<typeof greet>;           // 'my-app-or-library:greet'
```

`RegistryLayers<R>` extracts a registry's layers tuple; `CapabilityLayers<Layers, Cap>`
projects the layers on one capability; `ProvidedIds<R>` is the union of
identifiers the registry provides (what `requires` checks against); `CapabilityId<C>`
reads a single capability's identifier literal. All four live on `@mycl/core`'s
main entry, alongside `requires` itself.

## Where next

- [Layer Strategies](/guide/layer-strategies/): when `V` and `Args` diverge from `T`.
- [The Core Substrate](/advanced/core-substrate/): reading the same bindings at runtime with `describe`/`explain`.
- [`requires` reference](/reference/core/#requires): the full signature and semantics.

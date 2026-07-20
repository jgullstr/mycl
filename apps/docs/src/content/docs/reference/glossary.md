---
title: Glossary
description: Every mycl term, defined once.
---

One entry per term, alphabetized. **Bold** words inside a definition name another entry on this page. *Appears in* links go to the reference and guide pages where the term is defined in full.

## augment

A wrapper applied via `.augment(cap, wrapper)` that composes around whatever the capability resolves to, without replacing it.

*Not to be confused with:* a **layer**; a decorator/AOP pointcut.
*Appears in:* [`.augment()`](/reference/core/#augmentcap-wrapper); [helpers](/reference/core/#myclcorehelpers); [Augmentation guide](/guide/augmentation/).

## binding

One entry of a registry: a capability and everything bound to it, its layers and augments. The map returned by `.bindings()` holds one binding per capability; the value half is `RegistryBindingValue`.

*Not to be confused with:* a **layer** (one `.layer()` call); an **augment** (one `.augment()` call); the ECMAScript sense of binding (a name bound to a value in a scope).
*Appears in:* [`.bindings()`](/reference/core/#bindings); [`RegistryBindings`](/reference/core/#registrybindings).

## builder (`make`)

The function passed as `mycl()`'s first argument; constructs and returns the instance, run inside the resolved scope.

*Not to be confused with:* a JS class constructor; the returned **factory**.
*Appears in:* [`mycl()`](/reference/core/#mycl).

## capability

A function wrapped by `capable()` that is simultaneously its own registry key, type contract, default implementation, and stable identifier, dispatching through the active scope when called.

*Not to be confused with:* a plain imported function; a class/service.
*Appears in:* [`capable`](/reference/core/#capable), [Capability identifier](/reference/core/#capability-identifier); [Capabilities guide](/guide/capabilities/).

## capability constructor

The bound `capable`: the function that mints capabilities for a channel, returned by `createChannel`/`createFnChannel`.

*Not to be confused with:* a JS constructor; a **factory**.
*Appears in:* [`capable`](/reference/core/#capable).

## channel

A named capability namespace (`createChannel(name, connector)`) owning the `channel:` identifier prefix; the unit of context ownership and duplicate detection. Channels are disjoint by construction; each owns exactly one context.

*Not to be confused with:* a **registry**; a package.
*Appears in:* [`@mycl/core`](/reference/core/#createchannel); [kernel guide](/advanced/building-a-kernel/).

## connector

What `createChannel` invokes to stand a channel up: a function of the channel name returning the channel's fresh context and `build`, which shapes the public kernel from the channel's surface. The everyday one is internal, behind `createFnChannel`; custom connectors pick other contexts or curate other surfaces.

*Not to be confused with:* the **context** it mints; the **kernel** its build returns.
*Appears in:* [`Connector`](/reference/core/#connector); [`createFnChannel`](/reference/core/#createfnchannel); [kernel guide](/advanced/building-a-kernel/).

## context

A `ScopeContext` (`{ get, run }`) telling a channel how to read and set the active resolved registry; swappable via `setChannelContext`.

*Not to be confused with:* a **scope** (the state the context carries).
*Appears in:* [`@mycl/core`](/reference/core/#scopecontextr); [kernel guide](/advanced/building-a-kernel/).

## dispatch

The call-time resolution a capability performs: consult the active scope, run the bound/folded/augmented implementation, else the base.

*Not to be confused with:* binding (`.layer`); composition (`merge()`).
*Appears in:* [Scopes guide](/guide/scopes/).

## duplicate detection

The **duplicate-identifier** guard: `capable` reports (dev/test `console.error`, never throws) when two capabilities assemble one identifier, error 13. Duplicate *packages* need no guard: copies coexist by construction, and a library wanting a startup self-report hand-rolls the documented recipe.

*Not to be confused with:* a package-copy guard (mycl ships none).
*Appears in:* [error 13](/errors/13/); [Duplicate detection page](/advanced/duplicate-detection/).

## factory

The frozen callable returned by `mycl(make, ...regs)`; registries resolve once at creation, `make` runs per call, its result returned verbatim.

*Not to be confused with:* the **substrate**; the **capability constructor**; the **builder**.
*Appears in:* [`mycl()`](/reference/core/#mycl); [Factories guide](/guide/factories/).

## identifier

The assembled `channel:idPath` string (a flat `channel:idPath` for a private channel, or `channel:project/capability` when several packages share one, e.g. `my-app-or-library:fetchUser`): a capability's canonical public identifier, error label, and type-level layer-record key.

*Not to be confused with:* the **identifier path** argument; the capability object itself, which is what dispatch keys on, not this string.
*Appears in:* [`capable()`](/reference/core/#capable); [error 1](/errors/1/), [error 2](/errors/2/); [Capability identifier](/reference/core/#capability-identifier).

## identifier path

The non-empty string you pass to `capable()` as `idPath` (conventionally `project/capability`); the channel name is prepended to form the full identifier.

*Not to be confused with:* the full **identifier**; a file path.
*Appears in:* [`capable()` signature](/reference/core/#capable); [error 11](/errors/11/).

## kernel

The module that stands a channel up and exports an everyday API; the quick-start's one-call `createFnChannel(name)` module is one. What a connector's `build` returns.

*Not to be confused with:* the **substrate** it builds on; a build plugin.
*Appears in:* [core-substrate page](/advanced/core-substrate/).

## layer

A single capability binding contributed by one `.layer(cap, value)` call: the folded unit within a registry.

*Not to be confused with:* a whole registry in a stack; `LayerStrategy`; `merge()`.
*Appears in:* [`.layer()`](/reference/core/#layercap-args); [Registries and layers guide](/guide/registries-and-layers/#a-layer-is-one-binding).

## layer strategy

The `LayerStrategy` on a capability: a left fold over its `.layer()` values. **step** is the fold function (`acc: V | undefined`, so the strategy owns the no-prior-value case), **extract** projects the accumulated value into the callable, optional **seed** is the initial accumulator; default last-wins.

*Not to be confused with:* `merge()`; "merge strategy" (misnomer); an **augment**.
*Appears in:* [`capable()` config](/reference/core/#layerstrategyt-v-args); [Layer strategies guide](/guide/layer-strategies/).

## layers (type-level)

The `Registry<L>` type-level tuple recording every layered entry; read with `RegistryLayers`/`CapabilityLayers`/`ProvidedIds`.

*Not to be confused with:* any runtime value.
*Appears in:* [Type guarantees page](/advanced/type-guarantees/#reading-the-layers).

## merge

The free function `merge(...registries)` composing whole registries into one resolved registry: later wins per capability, augments accumulate. Lives on `@mycl/core/factory`; `mycl()`/`scope()` call it internally on their variadic registries, so channel users never import it.

*Not to be confused with:* `.layer()`; a **layer strategy**.
*Appears in:* [`merge`](/reference/core/#merge).

## provider-completeness

The compile-time check where `requires(...caps)(make)` makes `mycl(make, ...regs)` type-error unless the registries provide every required capability. Type-only; zero runtime effect.

*Not to be confused with:* a runtime check; introspection.
*Appears in:* [`requires`](/reference/core/#requires); [Type guarantees page](/advanced/type-guarantees/#provider-completeness-with-requires).

## registry

An immutable, clone-on-write, keyed collection of per-capability **bindings** (`.layer()`/`.augment()`) created by `registry()`; every operation returns a new one.

*Not to be confused with:* a **resolved registry**; a **layer**; a **binding**.
*Appears in:* [`@mycl/core`](/reference/core/#registryl).

## resolved registry

The composed, dispatch-ready output of `merge()` (or built internally by `scope()`/`mycl()`); the only form a scope dispatches against.

*Not to be confused with:* a buildable `Registry`; a **scope**.
*Appears in:* [`merge`](/reference/core/#merge) / [`scope`](/reference/core/#scope) / [`mycl`](/reference/core/#mycl) signatures; [`ResolvedRegistry`](/reference/core/#resolvedregistry).

## scope

The active resolved registry on the call stack at invocation time; capabilities dispatch through it; calling with no scope throws loud.

*Not to be confused with:* a **context** (the mechanism carrying it); a registry.
*Appears in:* [`scope()`](/reference/core/#scope); [Scopes guide](/guide/scopes/).

## snapshot

`snapshot(fn)` captures the scope active at call time (including "no scope") and replays it on every later invocation: the manual async-boundary carrier.

*Not to be confused with:* `scope(fn)` (declares a scope up front); a data snapshot.
*Appears in:* [`@mycl/core`](/reference/core/#snapshot); [Snapshots and async guide](/guide/snapshots-and-async/).

## substrate

The mechanism layer under the everyday surface (capability dispatch, the strategy fold, type contracts), shipped on `@mycl/core`'s subpaths; what kernels build on.

*Not to be confused with:* a **kernel**; mycl-the-whole-library.
*Appears in:* [`@mycl/core`](/reference/core/).

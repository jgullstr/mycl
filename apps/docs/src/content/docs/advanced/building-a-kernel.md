---
title: Building a Kernel
description: Write a connector (a fresh context plus a kernel builder), stand a channel up with createChannel(name, connector), and swap the context later with setChannelContext (AsyncLocalStorage).
---

A **kernel** is the module that binds a channel to an execution context and
exports an everyday API. The one-call wiring in the
[quick start](/getting-started/quick-start/) already is one, on the simplest
context. This page is the deeper story: what a `ScopeContext` is, how to write
your own (async propagation, a React tree, an isolated test harness), and how
to swap a channel's context after the fact.

The examples on this page import `@mycl/core/factory`, `@mycl/core/context`, and
Node built-ins, so they are shown as static code rather than runnable
Playgrounds (the Playground only ships `@mycl/core`'s main entry and `/helpers`).

## A ScopeContext holds the active scope

A channel needs one thing from you: a `ScopeContext`, a `{ get, run }` pair that
stores and retrieves the active resolved registry. It never inspects the value;
it only holds it.

```ts
interface ScopeContext<R = unknown> {
  get: () => R | undefined;
  run: <T>(value: R | undefined, fn: () => T) => T;
}
```

`get` is called on every capability dispatch and returns the current registry, or
`undefined` when no scope is active. `run` installs `value` for the duration of
`fn` and returns whatever `fn` returns. Passing `undefined` to `run` pins
scopelessness: inside `fn`, `get()` returns `undefined` even if an outer scope
was active.

For synchronous code you do not have to write one. `stackContext()` returns a
ready `ScopeContext` backed by a push/pop stack, the default choice for
browsers and synchronous code.

## Write a connector

A **connector** is what [`createChannel`](/reference/core/#createchannel) invokes
to stand a channel up: a function of the channel name returning the channel's
fresh context and `build`, which shapes the public kernel from the channel's surface
(`capable`, `snapshot`, `channel`, `context`). The connector behind
[`createFnChannel`](/reference/core/#createfnchannel) is the everyday one, and it is
internal; you write your own when you want a different execution
model, curating your kernel from the surface alone:

```ts
import type { Registry } from '@mycl/core';
import { createChannel, merge } from '@mycl/core/factory';
import type { ChannelSurface } from '@mycl/core/factory';
import { alsContext } from '@mycl/core/context';

// A connector with AsyncLocalStorage from the start (no swap needed later).
// alsContext() mints a fresh store per call, so each channel this connector
// stands up gets its own: exactly the "mint inside the connector" rule below.
const alsConnector = <G extends string>(_name: G) => ({
  context: alsContext(),
  build: (surface: ChannelSurface<G>) => ({
    channel: surface.channel,
    capable: surface.capable,
    snapshot: surface.snapshot,
    // This kernel's own boundary: run fn inside a scope over the registries.
    run: <T>(fn: () => T, ...regs: Registry[]): T =>
      surface.context.run(merge(...regs), fn),
  }),
});

// The connector-author deliverable: a bound factory, your createFnChannel.
export const createAlsChannel = <const G extends string>(name: G) =>
  createChannel(name, alsConnector);

export const { capable, snapshot, channel, run } = createAlsChannel('myproject');
```

The kernel's boundary members are yours to design: this one exposes a bare
`run`; `createFnChannel`'s exposes `mycl` and `scope`. What every kernel shares
is the shape underneath: a connector's `build` applied to a channel's surface.

### Want createFnChannel's kernel on a custom context?

Don't write a connector at all: mint the kernel with `createFnChannel` and
swap the context, as shown in [the section below](#swap-the-context-later).
The kernel members read the channel's context cell live, so a swap installed
at module load is indistinguishable from a connector that started with it.

Two rules. **Mint the context inside the connector**: a context closed over from
outside would be shared by every channel the connector mints, collapsing their
scopes into one. This is dev-enforced: a context that already backs another
channel throws [error 16](/errors/16/) at `createChannel` or
`setChannelContext`. **Keep the connector generic over the name** so the kernel's
types carry each channel's literal. And the convention: channel users should
meet your *bound factory* (`createAlsChannel` above, `createFnChannel` for the
everyday kernel), not `createChannel` or the connector; those are this level's
tools.

The channel name becomes the leading `channelName:` segment of every
capability's identifier, so it must not contain a `:` (the delimiter that
splits an identifier back into channel and path) or a `/` (reserved for path
segments); `createChannel` rejects a bad name at the type level and, outside
production, throws [error 12](/errors/12/) at runtime. Channels are disjoint by
construction: capabilities carry their channel's identifier prefix and dispatch
through their own context, so two channels never mix.

A library embedding mycl does exactly the same, importing the same entries.
See [Installation → Library exports](/getting-started/installation/#library-exports).

## Swap the context later

The channel token you exported lets you replace the backing context at any time
with `setChannelContext(channel, ctx)`. Already-built capabilities pick up the swap on
their next dispatch: they read the channel's context cell live, so nothing needs
rebuilding.

The common reason to swap is async propagation. `stackContext` is correct for
synchronous code but a scope does not survive an `await`. On Node, back the
channel with [`alsContext`](/reference/core/#alscontext) instead, the shipped
`AsyncLocalStorage`-backed `ScopeContext` from `@mycl/core/context`, and the
scope propagates across `await`, `setTimeout`, and microtask boundaries on its
own:

```ts
import { setChannelContext } from '@mycl/core';
import { alsContext } from '@mycl/core/context';

setChannelContext(channel, alsContext());
```

A `ScopeContext` is just `{ get, run }` (as above), so if `alsContext` is not
the shape you need, hand-rolling one stays a few lines.

After the swap, `snapshot` still works: it just becomes optional, because the
context now carries the scope across boundaries for you. In the browser there is
no `AsyncLocalStorage`, so a stack context plus manual `snapshot` stays the model.

## Where next

- [The Core Substrate](/advanced/core-substrate/): what `createChannel` returns and the subpaths a kernel imports.
- [Snapshots & Async](/guide/snapshots-and-async/): the async-boundary problem `alsContext` retires.
- [Duplicate Detection](/advanced/duplicate-detection/): why duplicate copies coexist, and the one hazard that remains.

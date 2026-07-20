---
title: Prior Art
description: The established ideas mycl draws on (effects and handlers, the expression problem, microkernels, information hiding, and aspects), each mapped to the part of mycl it informs.
---

mycl is not a new idea so much as a small, hopefully practical assembly of old ones. If any
of the names below are familiar, this page is the shortest path to "oh, it's
*that*." Each section states the idea in plain terms, then maps it to mycl. None
of this is required reading: the [guide](/guide/capabilities/) stands on its own.

## Effects and handlers

A computation signals an operation; a separate handler decides what that operation
actually does and returns a result. Because the handler is chosen independently of
the operation, one operation can be answered many ways: real, in-memory, mocked.

**In mycl terms:** a capability is the operation, a registry is the handler, and
the active scope is which handler is installed. That is the whole trick behind
changing *how* without touching *what*. See [Scopes](/guide/scopes/) and
[Registries and Layers](/guide/registries-and-layers/).

## The expression problem

The classic tension: how do you add new behaviours to existing types, *and* new
types under existing behaviours, without modifying either party or losing type
safety? Most designs let you extend along one axis cheaply and pay dearly on the
other.

**In mycl terms:** a capability's behaviour lives outside the capability itself,
so any registry (including a third party's) can contribute to it without
editing the original, and the type system still checks each contribution.
Extension is by layering into a scope, not by patching source. See
[Registries and Layers](/guide/registries-and-layers/) and
[Augmentation](/guide/augmentation/).

## Microkernel and plugin architecture

Second-generation microkernels (L4, seL4) draw a hard line between mechanism and
policy: the kernel provides only dispatch and validation; everything else is
user-space. The result is a tiny, stable core with all the variety pushed
outward.

**In mycl terms:** `@mycl/core`'s substrate subpaths are the microkernel: they
ship only mechanism (dispatch, the layer fold, the type contracts). Policy (which
context is active, how a scope crosses an async boundary) lives in the kernel
above it, like the one `createFnChannel` builds. Each capability is itself a tiny
core: its base is the mechanism, its layers are the policy. See
[The Core Substrate](/advanced/core-substrate/) and
[Building a Kernel](/advanced/building-a-kernel/).

## Information hiding

Parnas (1972): split a system so each module hides one design decision: above all,
the decision most likely to change. The test of a good seam is that the things it
separates can be built independently against the seam alone.

**In mycl terms:** a capability is a Parnas module whose secret is the *how*. The
consumer holds the capability and its contract; whoever supplies the
implementation is free to change it without the consumer noticing. If two sides of
a seam can be built against the capability's signature alone, the seam is in the
right place. See [Capabilities](/guide/capabilities/).

## Cross-cutting concerns

Some concerns (logging, timing, validation, caching) scatter across many
functions and tangle with the real logic. Aspect-oriented programming pulls such a
concern into one place and attaches it at named points in the program.

**In mycl terms:** `augment` is that attachment, a capability is the named, first-
class point it attaches to, and layering is the explicit wiring. Unlike classic
AOP there are no hidden pointcuts: every join point is a capability you can see
and name, so there is nothing spooky to trace. See [Augmentation](/guide/augmentation/).

## Where next

- [Capabilities](/guide/capabilities/): the mechanism these ideas converge on.
- [The Core Substrate](/advanced/core-substrate/): the mechanism/policy split in code.
- [Glossary](/reference/glossary/): one definition per term, used identically everywhere.

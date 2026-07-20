---
title: Duplicate Detection
description: "Why duplicate copies coexist harmlessly by construction, the one real hazard (cross-copy token mixing), the duplicate-identifier guard (error 13), and a self-report recipe for libraries that want startup detection."
---

Code being loaded twice is normally where plugin systems break. mycl's embedded
model is built so it mostly cannot: **duplicate copies coexist by
construction**. This page explains the guarantee, the one genuine hazard that
remains, the guard mycl ships for it, and a recipe for libraries that want
more.

## Duplicates coexist by design

A channel lives in the module instance that minted it. If two copies of a
package that mints a channel load in one realm (a nested install, or a dual
ESM+CJS load), each copy runs its own channel: capabilities minted by one copy
dispatch through their own context, scopes activated through one copy bind
that copy's capabilities, and each copy is fully self-consistent. Nothing
crashes, nothing corrupts. Two copies of a form library each render their own
forms correctly.

mycl itself is immune twice over: `@mycl/core` mints no channel of its own and
touches no realm-global state (every entry is side-effect-free), so duplicate
copies of *mycl* are simply independent mechanism.

## The one real hazard: cross-copy token mixing

The failure that remains needs a *split import graph* in the consumer: a
registry built against capability tokens from copy A handed to the runtime of
copy B. Bindings key on the capability object itself, so copy B's dispatch
finds nothing and silently falls back to base implementations. Extensions
appear to register but never apply.

This is the classic npm dual-package hazard (the same class as two copies of
React disagreeing about hooks), and it is a **packaging problem**: it can only
happen when the consumer's dependency tree resolves your package to two
places. To confirm a single copy resolves:

```sh
pnpm why @myorg/widgets
```

It should resolve to one version at one path.

## Duplicate-identifier (error 13)

Every capability's identifier is `channelName:idPath`. If two
capabilities resolve to the *same* identifier, one silently shadows the other
in tooling and error labels. When `capable` mints a capability whose
identifier was already seen this realm, it reports via `console.error`, in dev
and test only:

- It **reports, never throws.** A duplicate identifier does not break
  dispatch (the dispatch cache keys on the capability object, not its
  identifier string), and a report avoids false positives under HMR and
  module re-evaluation.
- In **production** the check is dropped entirely (the whole dev-only block
  is dead-code-eliminated).

One cause is a second copy of the package that mints the capability, which
makes this guard a useful *symptom* of a split graph. The other is two
unrelated packages colliding on the same `project/capability` path, which is
why identifier paths are namespaced by project. [Error 13](/errors/13/) names
the offending identifier.

## Recipe: self-report your own copy

mycl ships no package-level guard (duplicates coexist, so it has nothing to
detect on its own behalf). If your library wants a loud startup signal when a
consumer's tree carries two copies of *it*, hand-roll the self-report: a
realm-global ledger keyed by your package name. The subtle parts are the
`version (moduleId)` identity and the query-string strip, which keep test
isolation and Vite HMR (same file, timestamped URL) silent while catching a
genuine second copy even at the same version:

```ts
// duplicateGuard.ts: call selfReport() once at your package entry's init.
const seen: Record<string, Set<string>>
  = ((globalThis as any)[Symbol.for('myorg.instances')] ??= {});

export const selfReport = (name: string, version: string, moduleId = 'unknown'): void => {
  const id = moduleId.split('?')[0];
  const copies = (seen[name] ??= new Set());
  copies.add(`${version} (${id})`);
  if (copies.size > 1 && process.env.NODE_ENV !== 'production') {
    const msg = `[${name}] duplicate copies loaded: ${[...copies].join(' + ')}. `
      + 'Registries built against one copy cannot bind the other; deduplicate the install.';
    if (process.env.NODE_ENV === 'development') throw new Error(msg);
    console.warn(msg);
  }
};
```

```ts
// your package entry
import { selfReport } from './duplicateGuard';

selfReport('@myorg/widgets', '1.2.0',
  typeof __filename === 'string' ? __filename : import.meta.url);
```

Throw in development (a duplicate is a real bug, fail loud), warn in test
(runners legitimately load multiple copies; crashing a suite is wrong), stay
quiet in production or warn there too, your call. Use your own
`Symbol.for` key; the ledger is your package's, not mycl's.

## Where next

- [Installation](/getting-started/installation/#library-exports): the embedded setup for libraries.
- [Building a Kernel](/advanced/building-a-kernel/): how channels and the module boundary relate.
- [Error 13](/errors/13/): the duplicate-identifier message text.

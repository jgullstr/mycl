import { describe, expect, it } from 'vitest';
import * as factory from '@mycl/core/factory';

// /factory is the level above: the contract for connector authors, build
// plugins, and sibling kernels. createChannel mints a channel for a connector;
// merge composes registries into the ResolvedRegistry a context runs; the rest
// are the composition internals a kernel needs. Channel users never need merge
// (mycl/scope call it internally), so it is NOT on the main entry.

describe('/factory entry surface', () => {
  it('exports exactly the six level-above runtime members', () => {
    expect(Object.keys(factory).sort()).toEqual([
      'createChannel',
      'defineInternal',
      'foldBindings',
      'merge',
      'resolveContext',
      'resolveSnapshot',
    ]);
  });

  it('does not re-surface the main-entry runtime', () => {
    const surface = factory as Record<string, unknown>;
    expect(surface.registry).toBeUndefined();
    expect(surface.createFnChannel).toBeUndefined();
  });
});

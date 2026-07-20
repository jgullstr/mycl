import { describe, expect, expectTypeOf, it } from 'vitest';
import * as entry from '../index';
import type { FnKernel, Mycl, RequiredIds, Requiring, Scope } from '../index';
import type { CapabilityId } from '../index';

// The main entry is the one-package user story: the bound channel factory and
// the everyday runtime kit, plus the full user type vocabulary. The helpers
// live on /helpers, ScopeContext implementations on /context, and the
// connector-author contract (including merge — channel users compose by
// passing registries to mycl/scope) on /factory — none of those are
// re-surfaced here.

describe('main entry surface', () => {
  it('exports exactly the six runtime members', () => {
    expect(Object.keys(entry).sort()).toEqual([
      'createFnChannel',
      'isCapability',
      'isResolvedRegistry',
      'registry',
      'requires',
      'setChannelContext',
    ]);
  });

  it('the user-facing runtime is present and callable', () => {
    expect(entry.createFnChannel).toBeTypeOf('function');
    expect(entry.registry).toBeTypeOf('function');
    expect(entry.requires).toBeTypeOf('function');
    expect(entry.setChannelContext).toBeTypeOf('function');
    expect(entry.isCapability).toBeTypeOf('function');
    expect(entry.isResolvedRegistry).toBeTypeOf('function');
  });

  it('the level-above and helper members are NOT on main', () => {
    const surface = entry as Record<string, unknown>;
    expect(surface.createChannel).toBeUndefined();
    expect(surface.merge).toBeUndefined();
    expect(surface.stackContext).toBeUndefined();
    expect(surface.alsContext).toBeUndefined();
    expect(surface.before).toBeUndefined();
    expect(surface.after).toBeUndefined();
    expect(surface.pipe).toBeUndefined();
    expect(surface.foldBindings).toBeUndefined();
  });

  it('the user type vocabulary stands on the entry', () => {
    type K = FnKernel<'app'>;
    expectTypeOf<K['channel']['name']>().toEqualTypeOf<'app'>();
    expectTypeOf<Scope>().toBeFunction();
    expectTypeOf<Mycl>().toBeFunction();
    type R = Requiring<() => void, 'app/x'>;
    expectTypeOf<RequiredIds<R>>().toEqualTypeOf<'app/x'>();
  });

  it('core vocabulary flows through inference off the main entry', () => {
    const { capable } = entry.createFnChannel('surface');
    const cap = capable((x: number) => x, 'demo/plain');
    expectTypeOf<CapabilityId<typeof cap>>().toEqualTypeOf<'surface:demo/plain'>();
  });

  it('touches no realm-global state on import — the entry is side-effect-free', () => {
    const ledger = (globalThis as Record<symbol, unknown>)[Symbol.for('mycl.instances')];
    expect(ledger).toBeUndefined();
  });

  it('drives a private kernel end to end', () => {
    const { capable, snapshot, mycl, scope } = entry.createFnChannel('test.mainEntry');
    const cap = capable((x: number) => x, 't/mainEntryBase');
    const reg = entry.registry().layer(cap, (x: number) => x * 10);

    const app = mycl(() => ({
      calc: snapshot((x: number) => cap(x)),
    }), reg)();
    expect(app.calc(5)).toBe(50);

    const bound = scope((x: number) => cap(x), reg);
    expect(bound(5)).toBe(50);
  });
});

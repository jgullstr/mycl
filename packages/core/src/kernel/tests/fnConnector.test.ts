import { describe, expect, expectTypeOf, it } from 'vitest';
import { createChannel } from '@mycl/core/factory';
import { registry, requires } from '@mycl/core';
import { fnConnector } from '../fnConnector';
import type { FnKernel } from '@mycl/core';
import type { CapabilityId, Snapshotted } from '@mycl/core';
import type { SuppliedRegistries } from '../types';

/**
 * fnConnector: the plain-function connector. createChannel(name, fnConnector) is the
 * whole ceremony; the kernel it builds is {channel, capable, snapshot, mycl,
 * scope} with the raw context deliberately absent.
 */

describe('createChannel(name, fnConnector)', () => {
  const app = createChannel('formox', fnConnector);

  it('infers the kernel type with no call-site annotations', () => {
    expectTypeOf(app).toEqualTypeOf<FnKernel<'formox'>>();
    expectTypeOf(app.channel.name).toEqualTypeOf<'formox'>();
  });

  it('does not expose the raw context on the kernel', () => {
    expect('context' in app).toBe(false);
    expectTypeOf<'context' extends keyof typeof app ? true : false>().toEqualTypeOf<false>();
  });

  it('capable keeps minting literal identities through the kernel', () => {
    const cap = app.capable((x: number) => x, 'project/cap');
    expectTypeOf<CapabilityId<typeof cap>>().toEqualTypeOf<'formox:project/cap'>();
    const reg = registry().layer(cap, (x: number) => x * 10);
    const bound = app.scope((x: number) => cap(x), reg);
    expect(bound(4)).toBe(40);
  });

  it('kernel.mycl drives factories, snapshot carries scope, requires still rejects', () => {
    const cap = app.capable((x: number) => x, 'project/needed');
    const make = requires(cap)((seed: number) => ({ go: app.snapshot(() => cap(seed)) }));
    const reg = registry().layer(cap, (x: number) => x + 1);
    const factory = app.mycl(make, reg);
    expect(factory(1).go()).toBe(2);
    expectTypeOf<SuppliedRegistries<typeof factory>>().toEqualTypeOf<readonly [typeof reg]>();
    // @ts-expect-error the registry provides nothing; the error names 'formox:project/needed'
    app.mycl(make, registry());
  });

  it('snapshot has the Snapshotted shape', () => {
    const snap = app.snapshot((s: string) => s.length);
    expectTypeOf(snap).toEqualTypeOf<Snapshotted<(s: string) => number>>();
    expect(app.scope(() => snap('four'))()).toBe(4);
  });

  it('two channels from one fnConnector stay isolated (fresh context per call)', () => {
    const a = createChannel('iso-fa', fnConnector);
    const b = createChannel('iso-fb', fnConnector);
    const capA = a.capable((x: number) => x, 't/iso');
    const regA = registry().layer(capA, (x: number) => x * 100);
    // Activating a scope on B's channel must not mask A's registry.
    const inner = b.scope((x: number) => capA(x), registry());
    const outer = a.scope((x: number) => inner(x), regA);
    expect(outer(3)).toBe(300);
  });

  it('extension stays on the factory’s own channel, even via another kernel’s mycl', () => {
    const other = createChannel('other', fnConnector);
    const cap = app.capable((x: number) => x, 'project/extend');
    const reg = registry().layer(cap, (x: number) => x + 1);
    const base = app.mycl(() => app.snapshot(() => cap(1)), reg);
    // Extending through ANOTHER channel's mycl must keep the stored channel:
    // the added registry installs where cap's dispatch can see it.
    const more = registry().layer(cap, (x: number) => x + 41);
    const extended = other.mycl(base, more);
    expect(extended()()).toBe(42);
  });
});

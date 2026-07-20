import { describe, expect, expectTypeOf, it } from 'vitest';
import mycl from './mycl';
import { registry } from '@mycl/core';
import type { CapabilityLayers, RegistryLayers } from '@mycl/core';
import { foldBindings } from '@mycl/core/factory';
import { capable, snapshot } from './defaultContext';
import { MYCL_META } from '../constants';
import type { SuppliedRegistries } from '../types';

describe('mycl', () => {
  describe('mycl(make, ...regs) — create factory', () => {
    it('returns a frozen callable', () => {
      const createApp = mycl((prefix: string) => ({ prefix }), registry());
      expect(typeof createApp).toBe('function');
      expect(Object.isFrozen(createApp)).toBe(true);
    });

    it('factory carries MYCL_META with make and registries', () => {
      const make = (prefix: string) => ({ prefix });
      const reg = registry();
      const createApp = mycl(make, reg);
      expect((createApp as any)[MYCL_META]).toBeDefined();
      expect((createApp as any)[MYCL_META].make).toBe(make);
      expect((createApp as any)[MYCL_META].registries).toContain(reg);
    });

    it('forwards constructor args and returns the result verbatim', () => {
      const obj = { x: 1 };
      const createApp = mycl(() => obj, registry());
      const made = createApp();
      expect(made).toBe(obj); // same reference — not rebuilt
      expect(Object.isFrozen(made)).toBe(false); // not frozen by mycl
    });

    it('each call produces whatever the constructor produces', () => {
      const createApp = mycl((_: string) => ({ x: 1 }), registry());
      expect(createApp('a')).not.toBe(createApp('a'));
    });

    it('runs the constructor inside the resolved scope', () => {
      const greetCap = capable((name: string) => `hi ${name}`, 't/greetDuringConstruction');
      const reg = registry().layer(greetCap, (name: string) => `hello ${name}`);
      // greetCap is called DURING construction, while the scope is active
      const createApp = mycl((name: string) => ({ greeting: greetCap(name) }), reg);
      expect(createApp('world').greeting).toBe('hello world');
    });

    it('snapshotted methods dispatch in the construction scope when called later', () => {
      const greetCap = capable((name: string) => `hi ${name}`, 't/greetSnapshotted');
      const reg = registry().layer(greetCap, (name: string) => `hello ${name}`);
      const createApp = mycl((prefix: string) => ({
        greet: snapshot((name: string) => `${prefix}: ${greetCap(name)}`),
      }), reg);
      expect(createApp('test').greet('world')).toBe('test: hello world');
    });

    it('un-snapshotted methods that escape the scope fail loud', () => {
      const greetCap = capable((name: string) => `hi ${name}`, 't/greetUnsnapshotted');
      const reg = registry().layer(greetCap, (name: string) => `hello ${name}`);
      const createApp = mycl(() => ({
        greet: (name: string) => greetCap(name), // NOT snapshotted
      }), reg);
      const app = createApp();
      expect(() => app.greet('world')).toThrow(/outside any registry scope/);
    });

    it('passes a bare function return through by reference', () => {
      const handler = () => 1;
      const createApp = mycl(() => handler, registry());
      expect(createApp()).toBe(handler); // returned verbatim, not wrapped
    });

    it('a bare function return that escapes the scope fails loud when called later', () => {
      const greetCap = capable((name: string) => `hi ${name}`, 't/greetBareFn');
      const reg = registry().layer(greetCap, (name: string) => `hello ${name}`);
      const createApp = mycl(() => (name: string) => greetCap(name), reg); // bare fn, not snapshotted
      const fn = createApp();
      expect(() => fn('world')).toThrow(/outside any registry scope/);
    });
  });

  describe('mycl(factory, ...regs) — extend factory', () => {
    it('returns a new frozen factory, original unchanged', () => {
      const createApp = mycl((_: string) => ({ x: 1 }), registry());
      const createExt = mycl(createApp, registry());
      expect(typeof createExt).toBe('function');
      expect(createExt).not.toBe(createApp);
      expect(Object.isFrozen(createExt)).toBe(true);
    });

    it('merges stored registries ahead of the new ones', () => {
      const base = registry();
      const override = registry();
      const createApp = mycl(() => ({}), base);
      const createExt = mycl(createApp, override);
      expect((createExt as any)[MYCL_META].registries).toEqual([base, override]);
    });

    it('extension registry overrides factory behavior', () => {
      const fetchCap = capable((url: string) => `default:${url}`, 't/fetchOverride');
      const base = registry().layer(fetchCap, (url: string) => `base:${url}`);
      const override = registry().layer(fetchCap, (url: string) => `override:${url}`);
      const createApp = mycl((prefix: string) => ({
        fetch: snapshot((url: string) => `${prefix}:${fetchCap(url)}`),
      }), base);
      const createExt = mycl(createApp, override);
      expect(createExt('app').fetch('/api')).toBe('app:override:/api');
    });

    it('factory args flow through extension', () => {
      const createApp = mycl((prefix: string) => ({
        greet: snapshot((name: string) => `${prefix} ${name}`),
      }), registry());
      const createExt = mycl(createApp, registry());
      expect(createExt('hi').greet('world')).toBe('hi world');
    });

    it('augments compose across extension layers', () => {
      const cap = capable((x: number) => x, 't/augmentCompose');
      const base = registry()
        .layer(cap, (x: number) => x * 2)
        .augment(cap, (next) => (x: number) => next(x) + 10);
      const createApp = mycl(() => ({ calc: snapshot((x: number) => cap(x)) }), base);
      const plugin = registry().augment(cap, (next) => (x: number) => next(x) * 100);
      // set: x*2, base augment: +10, plugin augment: *100 → ((5*2)+10)*100 = 2000
      expect(mycl(createApp, plugin)().calc(5)).toBe(2000);
    });
  });

  describe('mycl(make, reg) — precomputed ResolvedRegistry', () => {
    it('resolves a precomputed ResolvedRegistry through the passthrough, like scope', () => {
      const cap = capable((x: number) => x * 2, 't/precomputedLookup');
      const m = new WeakMap();
      m.set(cap, foldBindings(cap as any, [{ argsList: [[(x: number) => x * 100]], augments: [] }]));
      const reg = Object.freeze({ resolve: (c: any) => m.get(c) ?? null });
      const createApp = mycl(() => ({ calc: snapshot((x: number) => cap(x)) }), reg as any);
      expect(createApp().calc(5)).toBe(500);
    });
  });

  describe('types', () => {
    it('infers args and return type from the constructor', () => {
      const createApp = mycl((n: number) => ({ n }));
      expectTypeOf(createApp).parameters.toEqualTypeOf<[n: number]>();
      expectTypeOf(createApp(1).n).toEqualTypeOf<number>();
    });

    it('return type is unconstrained (non-object allowed)', () => {
      const createNum = mycl(() => 42);
      expectTypeOf(createNum()).toEqualTypeOf<number>();
    });

    it('threads the registries onto the factory type — no erasure', () => {
      const cap = capable((x: number) => `${x}`, 't/manifestThreaded');
      const reg = registry().layer(cap, (x: number) => `v${x}`);
      const createApp = mycl(() => 0, reg);
      expectTypeOf<SuppliedRegistries<typeof createApp>>().toEqualTypeOf<readonly [typeof reg]>();
      // the manifest reads off the factory exactly as it reads off the registry
      expectTypeOf<RegistryLayers<SuppliedRegistries<typeof createApp>[number]>>()
        .toEqualTypeOf<RegistryLayers<typeof reg>>();
    });

    it('a consumer can project layered entries from the factory type alone', () => {
      const cap = capable((x: number) => `${x}`, 't/factoryProjection');
      const impl = (x: number) => `v${x}`;
      const reg = registry().layer(cap, impl);
      const createApp = mycl(() => 0, reg);
      type Entries = CapabilityLayers<RegistryLayers<SuppliedRegistries<typeof createApp>[number]>, typeof cap>;
      expectTypeOf<Entries['args'][0]>().toEqualTypeOf<typeof impl>();
    });

    it('extension appends the new registries after the stored ones', () => {
      const capA = capable((x: number) => x, 't/extendStoredA');
      const capB = capable((s: string) => s, 't/extendStoredB');
      const regA = registry().layer(capA, (x: number) => x + 1);
      const regB = registry().layer(capB, (s: string) => `${s}!`);
      const base = mycl((n: number) => n, regA);
      const ext = mycl(base, regB);
      expectTypeOf<SuppliedRegistries<typeof ext>>()
        .toEqualTypeOf<readonly [typeof regA, typeof regB]>();
    });

    it('SuppliedRegistries a plain function is never', () => {
      expectTypeOf<SuppliedRegistries<(x: number) => number>>().toEqualTypeOf<never>();
    });
  });
});

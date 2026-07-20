import { describe, expect, it } from 'vitest';
import { registry } from '@mycl/core';
import { createChannel } from '@mycl/core/factory';
import { fnConnector } from '../fnConnector';
import { capable as fnCapable } from './defaultContext';
import mycl, { resolveMycl } from './mycl';

describe('resolveMycl', () => {
  it('runs make inside the given channel channel', () => {
    const kernel = createChannel('test.resolveMycl', fnConnector);
    const cap = kernel.capable((x: number) => x, 't/forBase');
    const reg = registry().layer(cap, (x: number) => x * 10);

    const app = resolveMycl(kernel.channel)(() => ({
      calc: kernel.snapshot((x: number) => cap(x)),
    }), reg)();

    expect(app.calc(5)).toBe(50);
  });

  it('does not install registries into other channels (channel isolation)', () => {
    const kernel = createChannel('test.resolveMyclIso', fnConnector);
    const fnCap = fnCapable((x: number) => x, 't/forIsoFnCap');
    const reg = registry().layer(fnCap, (x: number) => x * 10);

    // The registry binds an fn-channel capability, but resolveMycl(kernel) installs it
    // into the kernel channel only — the fn slot stays empty, so the call throws.
    const factory = resolveMycl(kernel.channel)(() => fnCap(5), reg);
    expect(() => factory()).toThrow(/outside any registry scope/);
  });

  it('extension via plain mycl() preserves the creating channel channel', () => {
    const kernel = createChannel('test.resolveMyclExt', fnConnector);
    const cap = kernel.capable((x: number) => x, 't/forExtBase');
    const reg = registry().layer(cap, (x: number) => x * 10);

    const base = resolveMycl(kernel.channel)(() => ({
      calc: kernel.snapshot((x: number) => cap(x)),
    }), reg);

    // Extending with the default (fn-channel) mycl must keep dispatch on the
    // kernel channel — otherwise cap would find an empty kernel slot and throw.
    const extended = mycl(base, registry().layer(cap, (x: number) => x * 100));
    expect(extended().calc(5)).toBe(500);
  });
});

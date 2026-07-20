import { describe, expect, it } from 'vitest';
import { registry } from '@mycl/core';
import { createChannel } from '@mycl/core/factory';
import { fnConnector } from '../fnConnector';
import { capable as fnCapable } from './defaultContext';
import { resolveScope } from './scope';

describe('resolveScope', () => {
  it('binds a function to a registry on the given channel channel', () => {
    const kernel = createChannel('test.resolveScope', fnConnector);
    const cap = kernel.capable((x: number) => x, 't/resolveScopeBase');
    const reg = registry().layer(cap, (x: number) => x * 10);

    const bound = resolveScope(kernel.channel)((x: number) => cap(x), reg);
    expect(bound(5)).toBe(50);
  });

  it('with no registry pins the base implementation', () => {
    const kernel = createChannel('test.resolveScopeEmpty', fnConnector);
    const cap = kernel.capable((x: number) => x * 2, 't/resolveScopeEmpty');

    const bound = resolveScope(kernel.channel)((x: number) => cap(x));
    expect(bound(5)).toBe(10);
  });

  it('does not install registries into other channels (channel isolation)', () => {
    const kernel = createChannel('test.resolveScopeIso', fnConnector);
    const fnCap = fnCapable((x: number) => x, 't/resolveScopeIsoFnCap');
    const reg = registry().layer(fnCap, (x: number) => x * 10);

    const bound = resolveScope(kernel.channel)(() => fnCap(5), reg);
    expect(() => bound()).toThrow(/outside any registry scope/);
  });
});

import { describe, it, expect } from 'vitest';
import type { AnyFn } from '../util/types';
import { createChannel } from '../channel/createChannel';
import { registry } from '../registry/registry';
import { describe as describeReg, explain, diff } from '../util/introspect';
import { connectorOf } from './connectorOf';

const { capable } = createChannel('itx', connectorOf({
  get: () => undefined,
  run: <T>(_: unknown, fn: () => T): T => fn(),
}));

const dbq = capable((): string => 'base', 'app/db'); // last-wins
const log = capable((_m: string): void => {}, 'app/log'); // last-wins, augment target
const dictStrategy = {
  step: (parent: Record<string, AnyFn> | undefined) =>
    (name: string, fn: AnyFn): Record<string, AnyFn> => ({ ...(parent ?? {}), [name]: fn }),
  extract: (dict: Record<string, AnyFn>) => (): Record<string, AnyFn> => dict,
};
const ext = capable((): Record<string, AnyFn> => ({}), 'app/ext', { strategy: dictStrategy });

const find = <T extends { identity: string }>(rows: T[], id: string): T => rows.find((r) => r.identity === id)!;

describe('describe(reg)', () => {
  const reg = registry().layer(dbq, () => 'real').augment(log, (next) => next).layer(ext, 'k', () => 1);
  const rows = describeReg(reg);

  it('lists every bound capability by identity', () => {
    expect(rows.map((r) => r.identity).sort()).toEqual(['itx:app/db', 'itx:app/ext', 'itx:app/log']);
  });

  it('reports layer and augment counts', () => {
    expect(find(rows, 'itx:app/db')).toMatchObject({ layers: 1, augments: 0 });
    expect(find(rows, 'itx:app/log')).toMatchObject({ layers: 0, augments: 1 });
  });

  it('reports strategy kind', () => {
    expect(find(rows, 'itx:app/db').strategy).toBe('last-wins');
    expect(find(rows, 'itx:app/ext').strategy).toBe('custom');
  });

  it('does not mutate the registry (pure read)', () => {
    const before = reg.bindings().size;
    describeReg(reg);
    expect(reg.bindings().size).toBe(before);
  });
});

describe('explain(reg, cap)', () => {
  it('reports a bound, overridden capability', () => {
    const reg = registry().layer(dbq, () => 'real');
    expect(explain(reg, dbq)).toMatchObject({
      identity: 'itx:app/db', bound: true, resolvesToBase: false, layers: 1, augments: 0,
    });
  });

  it('reports an unbound capability as resolving to base', () => {
    expect(explain(registry(), dbq)).toMatchObject({
      identity: 'itx:app/db', bound: false, resolvesToBase: true, layers: 0, augments: 0,
    });
  });

  it('an augment-only entry does not resolve to base', () => {
    const reg = registry().augment(log, (next) => next);
    expect(explain(reg, log)).toMatchObject({ bound: true, resolvesToBase: false, layers: 0, augments: 1 });
  });
});

describe('diff(regA, regB)', () => {
  const base = registry().layer(dbq, () => 'a');

  it('detects an added capability', () => {
    const withLog = base.layer(log, (_m: string) => {});
    expect(diff(base, withLog)).toEqual({ added: ['itx:app/log'], removed: [], changed: [] });
  });

  it('detects a removed capability (reverse direction)', () => {
    const withLog = base.layer(log, (_m: string) => {});
    expect(diff(withLog, base)).toEqual({ added: [], removed: ['itx:app/log'], changed: [] });
  });

  it('detects a changed capability (extra layer)', () => {
    const moreDb = base.layer(dbq, () => 'b');
    expect(diff(base, moreDb)).toEqual({ added: [], removed: [], changed: ['itx:app/db'] });
  });

  it('is empty for identical registries', () => {
    expect(diff(base, base)).toEqual({ added: [], removed: [], changed: [] });
  });
});

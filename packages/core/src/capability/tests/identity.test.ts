import { describe, it, expect, vi } from 'vitest';
import { createChannel } from '../../channel/createChannel';
import { connectorOf } from '../../tests/connectorOf';

// A scopeless context: get() === undefined means every dispatch throws ERR_OUT_OF_SCOPE,
// which is the cheapest way to observe the identity that capable stamps on a capability.
// A factory (not a shared instance): contexts are per-channel, dev-enforced.
const scopeless = () => ({ get: () => undefined, run: <T>(_: unknown, fn: () => T): T => fn() });

describe('capable identity assembly', () => {
  it('names the assembled channelName:project/capability identity in the out-of-scope error', () => {
    const { capable } = createChannel('idtest', connectorOf(scopeless()));
    const cap = capable((x: number) => x, 'formox/setValue');
    expect(() => cap(1)).toThrow('idtest:formox/setValue');
  });
});

describe('capable identity path validation (dev)', () => {
  const { capable } = createChannel('fmt', connectorOf(scopeless()));

  it.each(['', undefined, null])('throws on an empty or missing identifier path %j', (bad) => {
    // Cast past the type to exercise the runtime guard a JS caller would hit.
    expect(() => capable((x: number) => x, bad as unknown as string)).toThrow();
  });

  it.each(['proj/cap', 'flat', 'formox/form/setValue'] as const)('accepts a non-empty identifier path %j', (ok) => {
    expect(() => capable((x: number) => x, ok)).not.toThrow();
  });
});

describe('channel name separator validation (dev)', () => {
  it.each(['a:b', 'a/b', 'g:p/c'])('rejects channel name containing a separator %j', (bad) => {
    expect(() => createChannel(bad, connectorOf(scopeless()))).toThrow();
  });

  it.each(['mycl.fn', 'idtest', 'my-channel'])('accepts a separator-free channel name %j', (ok) => {
    expect(() => createChannel(ok, connectorOf(scopeless()))).not.toThrow();
  });
});

describe('duplicate identity warning (dev)', () => {
  it('warns when two capabilities resolve to the same identifier', () => {
    const { capable } = createChannel('dupgrp', connectorOf(scopeless()));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    capable((x: number) => x, 'p/dup');
    capable((y: number) => y, 'p/dup');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('does not warn across distinct identities', () => {
    const { capable } = createChannel('dupgrp2', connectorOf(scopeless()));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    capable((x: number) => x, 'p/a');
    capable((y: number) => y, 'p/b');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

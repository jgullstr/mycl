import { afterEach, describe, expect, it, vi } from 'vitest';
import { errMsg, fmt, MESSAGES, ERR_OUT_OF_SCOPE, ERR_LAYER_TARGET } from '../util/errors';

describe('errors (dev)', () => {
  it('fmt substitutes known placeholders and leaves unknown intact', () => {
    expect(fmt('a {x} b {y}', { x: '1' })).toBe('a 1 b {y}');
  });

  it('fmt replaces every occurrence of a placeholder', () => {
    expect(fmt('{n} and {n}', { n: 'x' })).toBe('x and x');
  });

  it('errMsg formats the template for a code', () => {
    const msg = errMsg(ERR_OUT_OF_SCOPE, { name: 'foo' });
    expect(msg).toBe(MESSAGES[ERR_OUT_OF_SCOPE].replace('{name}', 'foo'));
    expect(msg).toContain('mycl: capability "foo" called outside any registry scope');
  });

  it('errMsg needs no params for a parameterless message', () => {
    expect(errMsg(ERR_LAYER_TARGET)).toBe('layer: target must be a capability');
  });
});

describe('errors (prod)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('errMsg returns the coded URL message when NODE_ENV=production', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    const mod = await import('../util/errors');
    // Literal 7 (not a named constant) on purpose: pins the exact prod URL format
    // independent of which error a code maps to.
    expect(mod.errMsg(7))
      .toBe('mycl: error 7, visit https://mycl.dev/errors/7 for more information.');
  });
});

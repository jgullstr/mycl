import type { ScopeContext } from '../types';
import { expect, it } from 'vitest';

type Factory = () => ScopeContext<string>;

/**
 * Shared contract suite for all {@link ScopeContext} implementations.
 *
 * Covers scoping, nesting, and cleanup.
 */
export const sharedContextContract = (make: Factory): void => {
  it('get returns undefined when empty', () => {
    const ctx = make();
    expect(ctx.get()).toBeUndefined();
  });

  it('run makes value visible inside callback', () => {
    const ctx = make();
    ctx.run('hello', () => {
      expect(ctx.get()).toBe('hello');
    });
  });

  it('value is gone after run returns', () => {
    const ctx = make();
    ctx.run('hello', () => {});
    expect(ctx.get()).toBeUndefined();
  });

  it('nested run shadows parent', () => {
    const ctx = make();
    ctx.run('outer', () => {
      ctx.run('inner', () => {
        expect(ctx.get()).toBe('inner');
      });
      expect(ctx.get()).toBe('outer');
    });
  });

  it('sibling scopes do not bleed', () => {
    const ctx = make();
    ctx.run('base', () => {
      ctx.run('left', () => {
        expect(ctx.get()).toBe('left');
      });
      ctx.run('right', () => {
        expect(ctx.get()).toBe('right');
      });
      expect(ctx.get()).toBe('base');
    });
  });
};

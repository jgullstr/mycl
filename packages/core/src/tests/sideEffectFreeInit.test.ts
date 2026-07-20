import { describe, expect, it } from 'vitest';
import '../index';

describe('core init', () => {
  it('importing @mycl/core touches no realm-global state (side-effect-free init)', () => {
    const ledger = (globalThis as Record<symbol, unknown>)[Symbol.for('mycl.instances')];
    expect(ledger).toBeUndefined();
  });
});

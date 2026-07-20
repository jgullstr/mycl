import { describe, expect, it } from 'vitest';
import * as context from '@mycl/core/context';

// /context carries the ScopeContext implementations: the synchronous stack and
// the AsyncLocalStorage-backed als.

describe('/context entry surface', () => {
  it('exports exactly the two ScopeContext implementations', () => {
    expect(Object.keys(context).sort()).toEqual([
      'alsContext',
      'stackContext',
    ]);
  });
});

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const VOCAB_FILES = ['../util/types.ts', '../capability/types.ts', '../registry/types.ts', '../strategy/types.ts'];

// Lines where `any` is intentional/structural.
const ALLOWED = [
  'export type AnyFn = (...args: any[]) => unknown;',
  'export type AnyCapability = Capability<AnyFn, any, any, string>;',
];

describe('any-containment', () => {
  it('the exported type vocabulary uses `any` only in AnyFn params, AnyCapability, and erased augment params', () => {
    const offenders = VOCAB_FILES.flatMap((file) => {
      const src = readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');
      return src
        .split('\n')
        .map((line, i) => ({ file, line: line.trim(), n: i + 1 }))
        // skip comment lines — doc comments mention the word "any" prosaically
        .filter(({ line }) => !/^(\*|\/\/|\/\*)/.test(line))
        .filter(({ line }) => /\bany\b/.test(line))
        .filter(({ line }) => !ALLOWED.includes(line))
        // The erased-view augment param is allowed: `Capability<T, any, any[, any]>`
        // keeps only the call signature.
        .filter(({ line }) => !line.includes('Capability<T, any, any'))
        // Extra strategies field erases value/arg types — same justification as AnyCapability.
        .filter(({ line }) => !line.includes('LayerStrategy<T, any, any'));
    });

    expect(offenders).toEqual([]);
  });
});

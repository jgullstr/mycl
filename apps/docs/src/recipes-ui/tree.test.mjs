import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFileTree, prevNext } from './tree.mjs';

test('buildFileTree puts recipe.ts first, then root files, then folders', () => {
  const tree = buildFileTree([
    'capabilities/scream.ts',
    'capabilities/greet.ts',
    'extensions.ts',
    'recipe.ts',
  ]);
  assert.deepEqual(tree.map((n) => n.name), ['recipe.ts', 'extensions.ts', 'capabilities']);
  const folder = tree.find((n) => n.name === 'capabilities');
  assert.deepEqual(folder.children.map((n) => n.name), ['greet.ts', 'scream.ts']);
  assert.equal(folder.children[0].path, 'capabilities/greet.ts');
  assert.equal(tree[0].path, 'recipe.ts');
});

test('prevNext returns neighbors by slug', () => {
  const recipes = [{ slug: 'a', title: 'A' }, { slug: 'b', title: 'B' }, { slug: 'c', title: 'C' }];
  assert.deepEqual(prevNext(recipes, 'a'), { prev: null, next: { slug: 'b', title: 'B' } });
  assert.deepEqual(prevNext(recipes, 'b'), { prev: { slug: 'a', title: 'A' }, next: { slug: 'c', title: 'C' } });
  assert.deepEqual(prevNext(recipes, 'c'), { prev: { slug: 'b', title: 'B' }, next: null });
});

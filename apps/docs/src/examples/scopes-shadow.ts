import { createFnChannel, registry } from '@mycl/core';

const { capable, scope } = createFnChannel('my-app-or-library');

const label = capable((): string => 'default', 'label');

const inner = registry().layer(label, () => 'inner');
const outer = registry().layer(label, () => 'outer');

// scoped carries the inner scope wherever it is called.
const scoped = scope(() => label(), inner);

// Called from within an outer scope, scoped still replays inner.
console.log(scope(() => scoped(), outer)()); // 'inner'

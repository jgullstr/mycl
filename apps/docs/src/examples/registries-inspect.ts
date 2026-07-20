import { createFnChannel, registry } from '@mycl/core';

const { capable } = createFnChannel('my-app-or-library');

const fetchUser = capable((id: string) => ({ id, name: 'Real User' }), 'fetchUser');
const notify = capable((_to: string) => undefined, 'notify');

const reg = registry().layer(fetchUser, (id: string) => ({ id, name: 'Bound User' }));

console.log(reg.has(fetchUser)); // true
console.log(reg.has(notify)); // false, never bound
console.log(reg.bindings().size); // 1, bindings() returns a ReadonlyMap

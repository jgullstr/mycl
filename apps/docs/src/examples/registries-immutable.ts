import { createFnChannel, registry } from '@mycl/core';

const { capable } = createFnChannel('my-app-or-library');

const fetchUser = capable((id: string) => ({ id, name: 'Real User' }), 'fetchUser');

// .layer() returns a NEW registry: base is left untouched.
const base = registry();
const withUser = base.layer(fetchUser, (id: string) => ({ id, name: 'Bound User' }));

console.log(base.has(fetchUser)); // false, original registry unchanged
console.log(withUser.has(fetchUser)); // true,  the new one has the binding

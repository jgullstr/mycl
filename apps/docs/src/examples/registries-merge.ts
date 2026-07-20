import { createFnChannel, registry } from '@mycl/core';

const { capable, mycl } = createFnChannel('my-app-or-library');

const fetchUser = capable((id: string) => ({ id, name: 'Real User' }), 'fetchUser');

const fromDb = registry().layer(fetchUser, (id: string) => ({ id, name: 'From DB' }));
const fromCache = registry().layer(fetchUser, (id: string) => ({ id, name: 'From cache' }));

// mycl composes its registries: the later registry wins per capability.
mycl(() => {
  // 'From cache'
  console.log(fetchUser('u1').name);
}, fromDb, fromCache)();

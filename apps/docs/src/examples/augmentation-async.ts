import { createFnChannel, registry } from '@mycl/core';
import { after } from '@mycl/core/helpers';

const { capable, mycl } = createFnChannel('my-app-or-library');

const load = capable(async (id: string) => ({ id, name: `User ${id}` }), 'load');

const reg = registry().augment(load, after((result) => {
  // result is the PROMISE, not the settled user.
  console.log('after sees a Promise:', result instanceof Promise);
}));

const run = mycl(async (id: string) => await load(id), reg);

const main = async () => {
  // after sees a Promise: true
  // settled: User u1
  const user = await run('u1');
  console.log('settled:', user.name);
};
main();

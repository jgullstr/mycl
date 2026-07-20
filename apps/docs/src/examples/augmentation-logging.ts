import { createFnChannel, registry } from '@mycl/core';
import { before, after } from '@mycl/core/helpers';

const { capable, mycl } = createFnChannel('my-app-or-library');

const fetchUser = capable((id: string) => ({ id, name: `User ${id}` }), 'fetchUser');

// Wrap fetchUser to log around it. The implementation is untouched.
const logged = registry()
  .augment(fetchUser, before((id) => console.log('->', id)))
  .augment(fetchUser, after((user) => console.log('<-', user.name)));

mycl(() => {
  // -> u1
  // <- User u1
  // 'User u1'
  console.log(fetchUser('u1').name);
}, logged)();

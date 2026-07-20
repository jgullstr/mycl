import { createFnChannel, registry } from '@mycl/core';

const { capable, snapshot, mycl } = createFnChannel('my-app-or-library');

const clock = capable((): string => 'DEFAULT', 'clock');

// The registry resolves once. The builder runs per call: each call gets its
// own arguments, but every instance shares that one resolved scope.
const makeSession = mycl((user: string) => {
  console.log(`build ${user}`);
  return {
    user,
    stamp: snapshot(() => `${user} @ ${clock()}`),
  };
}, registry().layer(clock, () => '09:00'));

const alice = makeSession('alice'); // logs: build alice
const bob = makeSession('bob'); // logs: build bob

console.log(alice.stamp()); // 'alice @ 09:00'
console.log(bob.stamp()); // 'bob @ 09:00'

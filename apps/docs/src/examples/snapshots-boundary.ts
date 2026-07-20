import { createFnChannel, registry } from '@mycl/core';

const { capable, snapshot, mycl } = createFnChannel('my-app-or-library');

const clock = capable((): string => 'default', 'clock');
const testScope = registry().layer(clock, () => 'test-clock');

// Losing the scope: the synchronous part runs inside the factory's scope, but
// the code after `await` resumes as a fresh call frame: the scope has exited.
const losing = mycl(async () => {
  // 'test-clock' (scope is active)
  console.log('before await:', clock());
  await Promise.resolve();
  try {
    // scope is gone, so this throws
    clock();
  } catch (err) {
    console.log('after await:', String(err));
  }
}, testScope);

// Fixing it: snapshot() while the scope is still active, then call the
// snapshotted function after the await: it replays the captured scope.
const fixed = mycl(async () => {
  // capture the scope now
  const resume = snapshot(() => clock());
  await Promise.resolve();
  // 'test-clock'
  console.log('after await (fixed):', resume());
}, testScope);

const main = async () => {
  await losing();
  await fixed();
};
main();

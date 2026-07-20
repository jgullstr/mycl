import { createFnChannel, registry } from '@mycl/core';

const { capable, mycl } = createFnChannel('my-app-or-library');

// Real I/O capabilities, with real side effects in their defaults.
const fetchUser = capable((id: string) => ({ id, name: 'Real User' }), 'fetchUser');
const sendEmail = capable((_to: string, _subject: string): void => {
  throw new Error('real email, must not run in a test');
}, 'sendEmail');

// The code under test, unchanged between production and tests.
const confirmOrder = (userId: string) => {
  const user = fetchUser(userId);
  sendEmail(user.name, 'Order confirmation');
  return `Confirmed for ${user.name}`;
};

// A test registry swaps the I/O for stand-ins. No mock library.
const testRegistry = registry()
  .layer(fetchUser, (id: string) => ({ id, name: 'Test User' }))
  // silent in tests
  .layer(sendEmail, () => undefined);

mycl(() => {
  // 'Confirmed for Test User'
  console.log(confirmOrder('u1'));
}, testRegistry)();

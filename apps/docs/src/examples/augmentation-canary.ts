import { createFnChannel, registry } from '@mycl/core';
import { handleError } from '@mycl/core/helpers';

const { capable, mycl } = createFnChannel('my-app-or-library');

// The stable implementation, also the base of the capability.
const stable = (amount: number) => `charged ${amount} (stable)`;
const charge = capable(stable, 'charge');

// The canary: new, and not yet ready for large amounts.
const canary = (amount: number) => {
  if (amount > 100) {
    throw new Error('too large for canary');
  }
  return `charged ${amount} (canary)`;
};

const rollout = registry()
  .layer(charge, canary)
  .augment(charge, handleError(
    (err, amount) => {
      console.log('fell back:', String(err));
      return stable(amount);
    },
    // shouldHandle: only recover from real errors
    (err) => err instanceof Error,
  ));

const pay = mycl((amount: number) => charge(amount), rollout);

// 'charged 50 (canary)'
console.log(pay(50));
// fell back: Error: too large for canary
// 'charged 200 (stable)'
console.log(pay(200));

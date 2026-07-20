/**
 * @file
 * The context subsystem's surface: the ScopeContext implementations (the
 * synchronous stack and the AsyncLocalStorage-backed als) and the contract
 * they implement.
 */

export { default as stackContext } from './stack';
export { alsContext } from './als';
export type { ScopeContext } from './types';

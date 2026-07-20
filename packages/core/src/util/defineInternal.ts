/**
 * @file
 * Shared object-definition plumbing for stamping hidden slots onto
 * capabilities and channel tokens.
 */

/**
 * Defines a non-writable, non-enumerable property; used for tag and metadata
 * symbols.
 */
export const defineInternal = <T extends object>(obj: T, key: PropertyKey, value: unknown): void => {
  Object.defineProperty(obj, key, { value, writable: false, enumerable: false });
};

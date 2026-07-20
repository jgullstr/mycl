# Changelog

## 0.1.0 (2026-07-20)

Initial release: the capability/registry core. `createFnChannel` mints a
private channel with the everyday kernel (`capable`, `snapshot`, `mycl`,
`scope`, the `channel` token); `registry` and `requires` build and check
registries, and `mycl`/`scope` compose their variadic registries themselves.
Augmentation helpers ship on `/helpers`, `ScopeContext` implementations on
`/context`, the connector contract (including `merge`) on `/factory`, and
read-only registry introspection on `/introspect`. ESM-only, TypeScript 5.4
or newer, main entry under 2 KB min+gz.

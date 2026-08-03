# Changelog

## 0.1.2 (2026-08-03)

The first release published from CI through npm trusted publishing, so this
tarball carries a provenance attestation linking it to the workflow run and
commit that built it. No runtime change: the package's behavior, exports and
size are untouched.

Test coverage is now gated at 100% of statements, branches, functions and lines.
Closing the last gap added a test for `merge()`'s rejection of an
already-resolved registry.

## 0.1.1 (2026-07-21)

fix: export the Capable type from the main entry

## 0.1.0 (2026-07-20)

Initial release: the capability/registry core. `createFnChannel` mints a
private channel with the everyday kernel (`capable`, `snapshot`, `mycl`,
`scope`, the `channel` token); `registry` and `requires` build and check
registries, and `mycl`/`scope` compose their variadic registries themselves.
Augmentation helpers ship on `/helpers`, `ScopeContext` implementations on
`/context`, the connector contract (including `merge`) on `/factory`, and
read-only registry introspection on `/introspect`. ESM-only, TypeScript 5.4
or newer, main entry under 2 KB min+gz.

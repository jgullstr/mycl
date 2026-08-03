# mycl

[![CI](https://github.com/jgullstr/mycl/actions/workflows/ci.yml/badge.svg)](https://github.com/jgullstr/mycl/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/jgullstr/mycl/branch/main/graph/badge.svg)](https://codecov.io/gh/jgullstr/mycl)
[![npm](https://img.shields.io/npm/v/@mycl/core.svg)](https://www.npmjs.com/package/@mycl/core)

Connect your code.

mycl is a capability/registry system for TypeScript: modify a function's behavior
without touching its declaration or its call sites. Define a capability once and
call it like a plain function; whoever instantiates your code decides what that
call does by layering registries. Zero dependencies, under 2 KB min+gz for the
whole stack.

Everything lives at [mycl.dev](https://mycl.dev): a live playground,
getting started, the guides, the package's
[entry points](https://mycl.dev/advanced/core-substrate/), and the full API
reference. The site builds from [apps/docs](apps/docs) in this repo; the
package is [`@mycl/core`](packages/core).

## Status

Pre-1.0, and honestly so: this is a sharp idea you can try in one corner of a
codebase for 2 KB, not yet something to bet a platform on. The mechanism is
stable and well tested; the API may still move before 1.0.

## Development

```sh
pnpm install
pnpm build && pnpm test && pnpm typecheck && pnpm lint
pnpm size      # bundle-size report + 2 KB budget gate
pnpm check-dce # verifies dev-only strings fold out of prod bundles
```

## License

MIT © Josef Gullström

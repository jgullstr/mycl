import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Capability } from '../capability/types';
import type { Registry } from '../registry/types';
import type { LayerStrategy } from '../strategy/types';
import { CAPABILITY_TAG } from '../capability/symbols';
import { createChannel } from '../channel/createChannel';
import { pipe } from '../util/helpers';
import { registry } from '../registry/registry';
import { connectorOf } from './connectorOf';

const { capable } = createChannel('types-test', connectorOf({ get: () => undefined, run: <T>(_: any, fn: () => T): T => fn() }));

describe('factory types', () => {
  it('Capability<T> extends T and has CAPABILITY_TAG', () => {
    type Fn = (x: number) => string;
    type C = Capability<Fn>;
    expectTypeOf<C>().toExtend<Fn>();
    expectTypeOf<C[typeof CAPABILITY_TAG]>().toEqualTypeOf<true>();
  });

  it('LayerStrategy requires extract and step', () => {
    type Config = LayerStrategy<() => string, string>;
    expectTypeOf<Config['extract']>().toEqualTypeOf<(value: string, base: () => string) => () => string>();
    expectTypeOf<Config['step']>().toEqualTypeOf<(parent: string | undefined) => (child: string) => string>();
  });

  it('Registry has layer/augment returning Registry', () => {
    type R = Registry;
    expectTypeOf<ReturnType<R['layer']>>().toEqualTypeOf<R>();
    expectTypeOf<ReturnType<R['augment']>>().toEqualTypeOf<R>();
  });
});

describe('symbol exports', () => {
  it('CAPABILITY_TAG is a global (Symbol.for) symbol — shared across copies', () => {
    expect(Symbol.keyFor(CAPABILITY_TAG)).toBe('mycl.capability');
  });
});

describe('Registry type enforcement', () => {
  it('layer enforces capability function signature', () => {
    const greet = capable((name: string) => `hello ${name}`, 't/layerEnforce');
    const reg = registry();

    reg.layer(greet, (name: string) => `hi ${name}`); // correct

    // @ts-expect-error — number is not assignable to string
    reg.layer(greet, (name: number) => `hello ${name}`);
  });

  it('augment enforces capability function signature', () => {
    const greet = capable((name: string) => `hello ${name}`, 't/augmentEnforce');
    const reg = registry();

    reg.augment(greet, (next) => (name: string) => next(name).toUpperCase()); // correct

    // @ts-expect-error — wrapper returns wrong type
    reg.augment(greet, (_next) => (name: string) => name.length);
  });

  it('layer enforces value type for capabilities with custom config', () => {
    const cssConfig: LayerStrategy<() => string, string> = {
      extract: (cls) => () => cls,
      step: (a) => (b) => `${a ?? ''} ${b}`,
    };
    const buttonClasses = capable(() => 'btn', 't/layerValueStrategy', { strategy: cssConfig });
    const reg = registry();

    reg.layer(buttonClasses, 'bg-blue-500 text-white'); // correct: string value

    // @ts-expect-error — number is not assignable to string
    reg.layer(buttonClasses, 42);
  });

  it('augment rejects a wrong-return transformer through pipe', () => {
    const greet = capable((name: string) => name.length, 't/pipeWrongReturn');
    const reg = registry();
    reg.augment(greet, pipe((n) => n + 1)); // correct: number -> number
    // @ts-expect-error — transformer must return number
    reg.augment(greet, pipe((n) => `${n}`));
  });

  it('layer still rejects a wrong value after branding', () => {
    const greet = capable((name: string) => `hi ${name}`, 't/layerWrongValue');
    const reg = registry();
    // @ts-expect-error — number is not assignable to the replacement fn type
    reg.layer(greet, (name: number) => `hi ${name}`);
  });

  it('capable rejects a strategy whose extract and step disagree on V', () => {
    // @ts-expect-error step yields number but extract consumes string
    capable(() => '', 't/strategyDisagree', { strategy: { extract: (v: string) => () => v, step: () => (n: number) => n } });
  });
});

describe('layer type-checking', () => {
  it('plain layer type-errors on a bad default-strategy arg', () => {
    const Button = capable((p: { className: string }) => p, 't/plainLayerBadArg');
    // @ts-expect-error — number is not a valid contribution for the default strategy.
    registry().layer(Button, 123);
  });
});

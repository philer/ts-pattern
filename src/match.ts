import { Pattern } from './types/Pattern';
import { GuardValue } from './types/helpers';
import { Match, PickReturnValue } from './types/Match';
import * as symbols from './internals/symbols';
import { matchPattern } from './internals/helpers';

/**
 * `match` creates a **pattern matching expression**.
 *
 * [Read `match` documentation on GitHub](https://github.com/gvergnaud/ts-pattern#match)
 *
 * Use `.with(pattern, handler)` to pattern match on the input.
 *
 * Use `.exhaustive()` or `.otherwise(() => defaultValue)` to end the expression and get the result.
 *
 * @example
 *  declare let input: "A" | "B";
 *
 *  return match(input)
 *    .with("A", () => "It's a A!")
 *    .with("B", () => "It's a B!")
 *    .exhaustive();
 *
 */
export const match = <input, output = symbols.unset>(
  value: input
): Match<input, output> => builder(value, []) as any;

const builder = <i, o>(
  value: i,
  cases: {
    test: (value: i) => unknown;
    select: (value: i) => any;
    handler: (...args: any) => any;
  }[]
) => {
  const run = () => {
    const entry = cases.find(({ test }) => test(value));
    if (!entry) {
      let displayedValue;
      try {
        displayedValue = JSON.stringify(value);
      } catch (e) {
        displayedValue = value;
      }
      throw new Error(
        `Pattern matching error: no pattern matches value ${displayedValue}`
      );
    }
    return entry.handler(entry.select(value), value);
  };

  return {
    with(...args: any[]) {
      const handler = args[args.length - 1];

      const patterns: Pattern<i>[] = [];
      const predicates: ((value: i) => unknown)[] = [];

      // case with guard as second argument
      if (args.length === 3 && typeof args[1] === 'function') {
        patterns.push(args[0]);
        predicates.push(args[1]);
      } else {
        patterns.push(...args.slice(0, args.length - 1));
      }

      let selected: Record<string, unknown> = {};

      const doesMatch = (value: i) =>
        Boolean(
          patterns.some((pattern) =>
            matchPattern(pattern, value, (key, value) => {
              selected[key] = value;
            })
          ) && predicates.every((predicate) => predicate(value as any))
        );

      return builder(
        value,
        cases.concat([
          {
            test: doesMatch,
            handler,
            select: (value) =>
              Object.keys(selected).length
                ? symbols.anonymousSelectKey in selected
                  ? selected[symbols.anonymousSelectKey]
                  : selected
                : value,
          },
        ])
      );
    },

    when: <p extends (value: i) => unknown, c>(
      predicate: p,
      handler: (value: GuardValue<p>) => PickReturnValue<o, c>
    ) =>
      builder<i, PickReturnValue<o, c>>(
        value,
        cases.concat([
          {
            test: predicate,
            handler,
            select: (value) => value,
          },
        ])
      ),

    otherwise: <c>(
      handler: (value: i) => PickReturnValue<o, c>
    ): PickReturnValue<o, c> =>
      builder<i, PickReturnValue<o, c>>(
        value,
        cases.concat([
          {
            test: () => true,
            handler,
            select: (value) => value,
          },
        ])
      ).run(),

    exhaustive: () => run(),

    run,
  };
};

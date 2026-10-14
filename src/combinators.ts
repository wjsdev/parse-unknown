// These combinators take parser(s) as arguments and return a parser
import { plainObject } from "./atomic-parsers";
import { at, parseError, parseErrorOf } from "./error-handling";
import type { Optional, Parser } from "./types";

/** Returns a parser that lets undefined through, otherwise parses
 *
 * @example
 * object({ name: optional(string) }) // Parser<{ name?: string }> */
export function optional<T>(parse: Parser<T>): Optional<T> {
  // we are creating a mark for typescript later to add ?: for properties on inferred types
  // we are NEVER attempting to read this property on the function at runtime
  const mark: { readonly optional: true } = { optional: true };

  return Object.assign(function (value: unknown): T | undefined {
    return value === undefined ? undefined : parse(value);
  }, mark);
}

/** Returns a parser that lets null through, otherwise parses */
export function nullable<T>(parse: Parser<T>): Parser<T | null> {
  return function (value: unknown): T | null {
    return value === null ? null : parse(value);
  };
}

/** Returns a parser for an array in which every item parses; a failing item throws with its index */
export function array<T>(parse: Parser<T>): Parser<T[]> {
  return function (value: unknown): T[] {
    if (!Array.isArray(value)) throw parseError("an array", value);

    return value.map(function (item: unknown, index: number): T {
      try {
        return parse(item);
      } catch (thrown) {
        throw at(thrown, index);
      }
    });
  };
}

/** Returns a parser for a plain object whose keys are not known ahead of time and whose values all parse the same way; a failing value throws with its key
 *
 * @example
 * record(number) // Parser<Record<string, number>> */
export function record<T>(parse: Parser<T>): Parser<Record<string, T>> {
  return function (value: unknown): Record<string, T> {
    const source = plainObject(value);

    return Object.fromEntries(
      Object.keys(source).map(function (key: string): [string, T] {
        try {
          return [key, parse(Reflect.get(source, key))];
        } catch (thrown) {
          throw at(thrown, key);
        }
      })
    );
  };
}

/** Returns a parser that tries each of the given parsers and returns the first that parses, otherwise throws, naming what each one expected
 *
 * @example
 * either(object({ x: number }), number) // Parser<{ x: number } | number> */
export function either<T extends unknown[]>(
  ...parsers: { [K in keyof T]: Parser<T[K]> }
): Parser<T[number]> {
  return function (value: unknown): T[number] {
    const expected: string[] = [];

    for (const parse of parsers) {
      try {
        // if something parses correctly, then we know that either must be met and we can return the parsed value
        return parse(value);
      } catch (thrown) {
        const found = parseErrorOf(thrown);
        // anything that isn't a parse error is rethrown as it is
        if (!found) throw thrown;
        expected.push(
          found.path ? `${found.expected} at ${found.path}` : found.expected
        );
      }
    }
    // if we haven't returned by this point then nothing was validly parsed so we throw
    throw parseError(expected.join(", or "), value);
  };
}

/** Returns a parser that first parses, then checks the value with the function you pass and throws if it returns false; optionally name what was expected in the error message as the third argument
 * This is for a rule the type cannot express, such as a number being inside a range, which can only be checked at runtime.
 * @example
 * where(number, (n) => n > 20) // fails as: expected (n) => n > 20, got 5 */
export function where<T>(
  parse: Parser<T>,
  check: (value: T) => boolean,
  expected: string = String(check)
): Parser<T> {
  return function (value: unknown): T {
    const parsed = parse(value);
    if (!check(parsed)) throw parseError(expected, parsed);

    return parsed;
  };
}

/** Returns a parser that parses, then applies your function to the value
 *
 * @example
 * transform(string, (s) => new Date(s)) // Parser<Date> */
export function transform<T, U>(
  parse: Parser<T>,
  f: (value: T) => U
): Parser<U> {
  return function (value: unknown): U {
    return f(parse(value));
  };
}

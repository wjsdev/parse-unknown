import { plainObject } from "./atomic-parsers";
import { at } from "./error-handling";
import type { Entries, Field, Output, Parser } from "./types";

/** Returns a parser for a plain object from a record of parsers, one per key: every key named parses, keys not named are dropped, and a key with an optional parser is optional in the type
 *
 * @example
 * const parseUser = object({ id: number, name: string, isAdmin: optional(boolean) }); // Parser<{ id: number; name: string; isAdmin?: boolean }>
 * object({ id: number, name: string } satisfies ParsersOf<User>) // checked against a type you already have */
export function object<T extends Entries>(parsers: T): Parser<Output<T>> {
  return function (value: unknown): Output<T> {
    const source = plainObject(value);
    const out = Object.fromEntries(
      Object.keys(parsers).map(function (key: string): [string, unknown] {
        const entry = parsers[key];
        const [from, parse] =
          typeof entry === "function"
            ? [key, entry]
            : [entry.from, entry.parse];
        try {
          return [
            key,
            parse(
              Object.hasOwn(source, from)
                ? Reflect.get(source, from)
                : undefined
            ),
          ];
        } catch (thrown) {
          throw at(thrown, from);
        }
      })
    );

    // The one assertion in this library, and the parsing above is what allows us to cheat this one time.
    // There would be no other way to write this function since TypeScript can never verify that an
    // object built at runtime can be of a specific shape.
    return out as Output<T>;
  };
}

/** Names the key to read from when it differs from the key in the record
 *
 * @example
 * object({ createdAt: from("created-at", string) }) // reads "created-at", gives createdAt */
export function from<T extends string, U extends Parser<unknown>>(
  key: T,
  parse: U
): Field<T, U> {
  return { from: key, parse };
}

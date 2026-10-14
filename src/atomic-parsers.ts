// The atomic parsers for primitives, literals, plain objects and unknown values
import { parseError } from "./error-handling";
import type { Parser } from "./types";

/** Return the value if it's a string, otherwise throw */
export function string(value: unknown): string {
  if (typeof value !== "string") throw parseError("a string", value);

  return value;
}

/** Return the value if it's a finite number, otherwise throw */
export function number(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw parseError("a number", value);
  }

  return value;
}

/** Return the value if it's NaN, Infinity or -Infinity, otherwise throw */
export function nonFinite(value: unknown): number {
  if (typeof value !== "number" || Number.isFinite(value)) {
    throw parseError("NaN, Infinity or -Infinity", value);
  }

  return value;
}

/** Return the value if it's a boolean, otherwise throw */
export function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw parseError("a boolean", value);

  return value;
}

/** Return the value if it's strictly null, otherwise throw */
export function nil(value: unknown): null {
  if (value !== null) throw parseError("null", value);

  return value;
}

/** Return the value if it's strictly undefined, otherwise throw */
export function nothing(value: unknown): undefined {
  if (value !== undefined) throw parseError("nothing", value);

  return value;
}

/** Identity function for unknown values that you are not making any claims about */
export function unknown(value: unknown): unknown {
  return value;
}

/** Returns a parser for one of a closed set of literals (strings, numbers, booleans or null).
 *
 * @example
 * literal(["a", 1, true, null]) // returns a function that parses "a" | 1 | true | null */
export function literal<const T extends string | number | boolean | null>(
  values: readonly T[]
): Parser<T> {
  return function (value: unknown): T {
    for (const candidate of values) {
      if (
        candidate === value ||
        // good old js...
        (Number.isNaN(candidate) && Number.isNaN(value))
      ) {
        return candidate;
      }
    }

    throw parseError(
      `one of ${values
        .map((v) => (typeof v === "string" ? JSON.stringify(v) : String(v)))
        .join(", ")}`,
      value
    );
  };
}

/** Return the value if it's a plain object (made from `{}`, `JSON.parse` or `Object.create(null)`) otherwise throw */
export function plainObject(value: unknown): object {
  // Since there is no type for a plain object, we can't type narrow for a plain object
  // Therefore the return type of "object" is weaker than our actual claim of plain object.
  if (typeof value !== "object" || value === null || !objIsPlain(value)) {
    throw parseError("a plain object", value);
  }

  return value;
}

// A plain object is an object whose prototype is null, or whose prototype's prototype is null
function objIsPlain(value: object): boolean {
  const prototype: unknown = Object.getPrototypeOf(value);

  return (
    prototype === null ||
    prototype === Object.prototype ||
    Object.getPrototypeOf(prototype) === null
  );
}

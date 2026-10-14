import { type ParseError, parseErrorOf } from "./error-handling";
import type { Parser } from "./types";

/** Catches a ParseError and returns it on .error with .ok: false; otherwise returns parsed value on .value with .ok: true; any other error is rethrown */
export function safeParse<T>(
  parse: Parser<T>,
  value: unknown
): SafeParseResult<T> {
  try {
    return { ok: true, value: parse(value) };
  } catch (thrown) {
    const found = parseErrorOf(thrown);
    if (found) return { ok: false, error: found };

    throw thrown;
  }
}

/** What {@link safeParse} returns */
export type SafeParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ParseError };

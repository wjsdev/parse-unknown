/** A function from unknown to T: it returns the value or throws */
export type Parser<T> = (value: unknown) => T;

/** The type a parser returns: Parsed<typeof parseUser> */
export type Parsed<T extends Parser<unknown>> =
  T extends Parser<infer U> ? U : never;

/** What optional(parse) returns: a parser of T | undefined, marked so its key is optional */
export type Optional<T> = Parser<T | undefined> & { readonly optional: true };

/** What from(key, parse) returns: a parser with the key it reads from */
export type Field<T extends string, U extends Parser<unknown>> = {
  readonly from: T;
  readonly parse: U;
};

/** The record of parsers for a type you already have, to check a record against it with satisfies; U, when given, is the wire type the keys passed to from must exist on
 *
 * @example
 * object({ id: from("user-id", number) } satisfies ParsersOf<User, UserWire>) */
export type ParsersOf<
  T extends object,
  U extends object = Record<string, unknown>,
> = {
  [K in keyof T]-?: Record<never, never> extends Pick<T, K>
    ?
        | Optional<Exclude<T[K], undefined>>
        | Field<keyof U & string, Optional<Exclude<T[K], undefined>>>
    : Parser<T[K]> | Field<keyof U & string, Parser<T[K]>>;
};

/** What object takes: a record of parsers, or of fields made with from */
export type Entries = Record<
  string,
  Parser<unknown> | Field<string, Parser<unknown>>
>;

/** The type object infers from a record: a key with an optional parser becomes optional */
export type Output<T extends Entries> = Flatten<
  {
    [K in keyof T as IsOptional<T[K]> extends true ? never : K]: Result<T[K]>;
  } & {
    [K in keyof T as IsOptional<T[K]> extends true ? K : never]?: Result<T[K]>;
  }
>;

// The type a parser or field gives
type Result<T> =
  T extends Field<string, infer U>
    ? Result<U>
    : T extends Parser<infer U>
      ? U
      : never;

// Whether a parser or field is marked optional
type IsOptional<T> =
  T extends Field<string, infer U>
    ? IsOptional<U>
    : T extends Optional<unknown>
      ? true
      : false;

// One object type instead of an intersection, so a hover shows the keys
type Flatten<T> = { [K in keyof T]: T[K] } & NonNullable<unknown>;

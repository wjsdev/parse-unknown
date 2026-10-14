# Parse Unknown

What if you were tasked with parsing unknown data at runtime without using Zod?
(If you are not writing a library you probably should just use Zod. This package was created because I
wanted something smaller that I can inline in other libraries and I prefer a more functional style)

## Install

```sh
npm install parse-unknown
```

(TypeScript 5.0 or later)

## Why

When we have data that is not known until runtime, calling it something other than `unknown` is a big mistake. We want to create a boundary where we can parse unknown data once and always count on it being valid once it's in the door. We may or may not have a pre-written TypeScript type for this data.

Before we design a system, let's look at an ugly primitive attempt to parse data to see why we need a system

```ts
type User = { id: number; name: string; isAdmin?: boolean };

function parseUser(data: unknown): User {
  if (typeof data !== "object" || data === null) throw Error("expected an object");
  if (!("id" in data) || typeof data.id !== "number") throw Error("id: expected a number");
  if (!("name" in data) || typeof data.name !== "string") throw Error("name: expected a string");
  const isAdmin = "isAdmin" in data ? data.isAdmin : undefined;
  if (isAdmin !== undefined && typeof isAdmin !== "boolean") throw Error("isAdmin: expected a boolean");
  return { id: data.id, name: data.name, isAdmin };
}
```

Not only is this insane to write by hand, but TypeScript can't hold us to account for optional keys. If you left out `isAdmin` from the return and removed its checks, then you are not parsing all properties that may exist, but TypeScript can't catch you since you are still technically returning something which is of type `User`.

We clearly need a systematic approach.

## Use

Below is the same example as above using this library

```ts
import { boolean, number, object, optional, type Parsed, safeParse, string } from "parse-unknown";

const parseUser = object({
  id: number,
  name: string,
  isAdmin: optional(boolean),
});
type User = Parsed<typeof parseUser>;

const user = parseUser(data); // User, or throws: name: expected a string, got nothing
const result = safeParse(parseUser, data); // { ok: true, value: User } | { ok: false, error: ParseError }
```

We are now as declarative as we can get, and we don't have to write the shape twice since we can infer the TypeScript type.

If we happen to have the TypeScript type already then we can force ourselves to write the parser correctly by checking the record against the type with `satisfies`.

```ts
import type { User } from "../somewhere";
import { boolean, number, object, optional, type ParsersOf, string } from "parse-unknown";

const parseUser = object({
  id: number,
  name: string,
  isAdmin: optional(boolean),
} satisfies ParsersOf<User>);
```

In the above example, if we left out `isAdmin` TypeScript would show an error, since the parser is checked against `User`, optional properties included. The hand-written version could never give us that.

## Parsers and combinators

A parser is a function from `unknown` to a type. It returns the value or throws.

| Parser | Parses |
| --- | --- |
| `string` | a string |
| `number` | a finite number; NaN and the infinities throw |
| `nonFinite` | NaN, Infinity or -Infinity |
| `boolean` | a boolean |
| `nil` | null |
| `nothing` | undefined |
| `unknown` | anything, unchanged |
| `literal(["a", 1, true, null])` | one of the listed literals, typed as their union |

A combinator takes parsers and returns one.

| Combinator | Returns a parser for |
| --- | --- |
| `object({ key: parser, … })` | a plain object with those keys; keys not named are dropped |
| `from("wire-key", parser)` | inside a record: the value read from another key |
| `array(parser)` | an array, every item parsed |
| `record(parser)` | an object with any keys, every value parsed |
| `optional(parser)` | the value or undefined, and the key becomes optional |
| `nullable(parser)` | the value or null |
| `either(a, b, …)` | what the first parser to succeed returns, typed as the union |
| `where(parser, check, expected?)` | the value, if `check` returns true for it |
| `transform(parser, fn)` | `fn` applied to the parsed value |

## Keys with other names

```ts
const parseUser = object({ createdAt: from("created-at", string) });
```

Reads `created-at`, gives `createdAt`, and an error names the key as it arrived. With a wire type, `satisfies ParsersOf<User, UserWire>` also checks that every key given to `from` exists on it.

## Nesting

A nested object is just another parser: write it in place, or name it once and use it wherever it appears.

```ts
const parseAddress = object({
  street: string,
  city: string,
});
const parseUser = object({
  name: string,
  age: where(number, (n) => n >= 0, "an age"),
  address: parseAddress,
  tags: array(string),
});
```

## If you already have TypeScript types written

[parse-unknown-codegen](https://github.com/wjsdev/parse-unknown-codegen) writes the parsers from them, so none of this is written by hand.

# Parse Unknown

What if you were tasked with parsing unknown data at runtime without using Zod?
(If you are not writing a library you probably should just use Zod. This package was created because I
wanted something smaller that I can inline in other libraries and I prefer a more functional style)

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

Not only is this insane to write by hand, but TypeScript can't hold us to account for optional keys. If you left out `isAdmin` from the return, then you are not parsing all properties that may exist, but TypeScript can't catch you since you are still technically returning something which is of type `User`.

We clearly need a systematic approach.

Below is the same example as above using this library

```ts
import { boolean, number, object, optional, type Parsed, safeParse, string } from "parse-unknown";

const parseUser = object({ id: number, name: string, isAdmin: optional(boolean) });
type User = Parsed<typeof parseUser>;

const user = parseUser(data); // User, or throws: name: expected a string, got nothing
const result = safeParse(parseUser, data); // { ok: true, value: User } | { ok: false, error: ParseError }
```

We are now as declarative as we can get, and we don't have to write the shape twice since we can infer the TypeScript type.

If we happen to have the TypeScript type already then we can force ourselves to write the parser correctly by checking the record against the type with `satisfies`.

```ts
import type { User } from "../somewhere";
import { boolean, number, object, optional, type ParsersOf, string } from "parse-unknown";

const parseUser = object({ id: number, name: string, isAdmin: optional(boolean) } satisfies ParsersOf<User>);
```

In the above example, if we left out `isAdmin` TypeScript would show an error, since the parser is checked against `User`, optional properties included. The hand-written version could never give us that.

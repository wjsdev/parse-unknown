import { expect, it } from "bun:test";
import {
  array,
  boolean,
  either,
  from,
  literal,
  nothing,
  number,
  object,
  optional,
  type Parsed,
  type ParsersOf,
  string,
} from "../src/index";

type User = { id: number; email: string; isAdmin?: boolean };
type UserWire = {
  "user-id": number;
  "user-email": string;
  "user-is-admin"?: boolean;
};

const parseUser = object({
  id: from("user-id", number),
  email: from("user-email", string),
  isAdmin: from("user-is-admin", optional(boolean)),
} satisfies ParsersOf<User, UserWire>);

it("parses", () => {
  expect(parseUser({ "user-id": 1, "user-email": "a@b.c" })).toEqual({
    id: 1,
    email: "a@b.c",
    isAdmin: undefined,
  });
});

const parseJob = object({
  title: string,
  remote: optional(boolean),
  pay: from("pay-per-hour", number),
});
type Job = Parsed<typeof parseJob>;

it("infers the type from the parsers, optional keys optional", () => {
  const job: Job = { title: "x", pay: 1 };
  const parsed: Job = parseJob({ title: "x", "pay-per-hour": 1 });

  expect(parsed).toEqual({ ...job, remote: undefined });
});

export const missingRequired = object({
  id: number,
  isAdmin: optional(boolean),
  // @ts-expect-error email missing
} satisfies ParsersOf<User>);

export const missingOptional = object({
  id: number,
  email: string,
  // @ts-expect-error isAdmin missing
} satisfies ParsersOf<User>);

export const wrongType = object({
  // @ts-expect-error string for number
  id: string,
  email: string,
  isAdmin: optional(boolean),
} satisfies ParsersOf<User>);

export const requiredAsOptional = object({
  id: number,
  // @ts-expect-error string | undefined for string
  email: optional(string),
  isAdmin: optional(boolean),
} satisfies ParsersOf<User>);

export const optionalAsRequired = object({
  id: number,
  email: string,
  // @ts-expect-error boolean for an optional key
  isAdmin: boolean,
} satisfies ParsersOf<User>);

export const extraKey = object({
  id: number,
  email: string,
  isAdmin: optional(boolean),
  // @ts-expect-error not in User
  name: string,
} satisfies ParsersOf<User>);

export const keyNotOnWire = object({
  id: from("user-id", number),
  // @ts-expect-error not a key of UserWire
  email: from("user-emial", string),
  isAdmin: from("user-is-admin", optional(boolean)),
} satisfies ParsersOf<User, UserWire>);

export const inferredWrongly: Job = {
  title: "x",
  pay: 1,
  // @ts-expect-error a string, not a boolean
  remote: "yes",
};

// literal keeps its literals when nested in another call (its const type parameter)
const parseShape = object({
  kind: literal(["circle", "square"]),
  tags: array(literal(["a", "b"])),
  note: optional(literal(["x"])),
  size: either(literal(["s", "m"]), number),
});
type Shape = Parsed<typeof parseShape>;

export const shape: Shape = { kind: "circle", tags: ["a"], note: "x", size: 1 };
export const notAShape: Shape = {
  // @ts-expect-error not one of the literals
  kind: "oval",
  // @ts-expect-error not one of the literals
  tags: ["c"],
  // @ts-expect-error not one of the literals
  note: "y",
  // @ts-expect-error not one of the literals
  size: "l",
};

// a required key whose value may be undefined is either(x, nothing), not optional(x)
const parseProfile = object({ nickname: either(string, nothing) });
type Profile = Parsed<typeof parseProfile>;

export const profile: Profile = { nickname: undefined };
// @ts-expect-error nickname is required, undefined or not
export const noProfile: Profile = {};

// ParsersOf is for objects only
// @ts-expect-error a string has no keys to parse
export type NotParsers = ParsersOf<string>;

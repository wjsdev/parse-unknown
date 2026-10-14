import { describe, expect, it } from "bun:test";
import {
  array,
  boolean,
  either,
  from,
  literal,
  nil,
  nonFinite,
  nothing,
  nullable,
  number,
  object,
  optional,
  type Parser,
  type ParsersOf,
  parseError,
  parseErrorOf,
  record,
  safeParse,
  string,
  transform,
  unknown,
  where,
} from "../src/index";

type Address = { street: string; city: string };
type User = {
  id: number;
  name: string;
  email?: string;
  role: "admin" | "member";
  deletedAt: string | null;
  tags: string[];
  address: Address;
  createdAt: string;
  meta: unknown;
};
const parseAddress = object({
  street: string,
  city: string,
} satisfies ParsersOf<Address>);

const parseUser = object({
  id: number,
  name: string,
  email: optional(string),
  role: literal(["admin", "member"]),
  deletedAt: nullable(string),
  tags: array(string),
  address: parseAddress,
  createdAt: from("created-at", string),
  meta: unknown,
} satisfies ParsersOf<User>);

const wire = {
  id: 1,
  name: "Ann",
  role: "admin",
  deletedAt: null,
  tags: ["a", "b"],
  address: { street: "1 Main St", city: "Springfield", zip: "00000" },
  "created-at": "2026-01-01",
  meta: { anything: 1 },
  password: "never",
};

function messageOf(parse: () => unknown): string {
  try {
    parse();
  } catch (thrown) {
    return thrown instanceof Error ? thrown.message : String(thrown);
  }

  return "";
}

describe("parse", () => {
  it("parses, dropping keys it doesn't name", () => {
    expect(parseUser(wire)).toEqual({
      id: 1,
      name: "Ann",
      email: undefined,
      role: "admin",
      deletedAt: null,
      tags: ["a", "b"],
      address: { street: "1 Main St", city: "Springfield" },
      createdAt: "2026-01-01",
      meta: { anything: 1 },
    });
  });

  it("throws with the path", () => {
    expect(
      messageOf(() => parseUser({ ...wire, address: { street: 1 } }))
    ).toBe("address.street: expected a string, got 1");
    expect(messageOf(() => parseUser({ ...wire, tags: ["a", 2] }))).toBe(
      "tags[1]: expected a string, got 2"
    );
    expect(messageOf(() => parseUser({ ...wire, role: "owner" }))).toBe(
      'role: expected one of "admin", "member", got "owner"'
    );
    expect(messageOf(() => parseUser({ ...wire, deletedAt: 3 }))).toBe(
      "deletedAt: expected a string, got 3"
    );
    expect(
      messageOf(() => parseUser({ ...wire, "created-at": undefined }))
    ).toBe("created-at: expected a string, got nothing");
    expect(messageOf(() => parseUser([]))).toBe(
      "expected a plain object, got an array"
    );
    expect(messageOf(() => nil(undefined))).toBe("expected null, got nothing");
    expect(messageOf(() => boolean({}))).toBe(
      "expected a boolean, got an object"
    );
    expect(messageOf(() => number("x".repeat(80)))).toBe(
      `expected a number, got "${"x".repeat(40)}…"`
    );
  });

  it("where", () => {
    const over = where(number, (n) => n > 20, "a number over 20");

    expect(over(21)).toBe(21);
    expect(messageOf(() => over(5))).toBe("expected a number over 20, got 5");
    expect(messageOf(() => where(string, (s) => s.length > 0)(""))).toBe(
      'expected (s) => s.length > 0, got ""'
    );
  });

  it("record, either, transform, literal with null", () => {
    expect(record(number)({ a: 1, b: 2 })).toEqual({ a: 1, b: 2 });
    expect(messageOf(() => record(number)({ a: "1" }))).toBe(
      'a: expected a number, got "1"'
    );
    expect(either(parseAddress, string)("home")).toBe("home");
    expect(messageOf(() => either(parseAddress, string)(3))).toBe(
      "expected a plain object, or a string, got 3"
    );
    expect(transform(array(number), (list) => list.length)([1, 2])).toBe(2);
    expect(literal(["a", 1, true, null])(null)).toBe(null);
  });

  it("number is finite; literal holds NaN the way includes does", () => {
    expect(number(-0)).toBe(-0);
    expect(messageOf(() => number(Number.NaN))).toBe(
      "expected a number, got NaN"
    );
    expect(messageOf(() => number(Number.POSITIVE_INFINITY))).toBe(
      "expected a number, got Infinity"
    );
    expect(messageOf(() => number(Number.NEGATIVE_INFINITY))).toBe(
      "expected a number, got -Infinity"
    );
    expect(literal([Number.NaN])(Number.NaN)).toBeNaN();
    expect(literal([0])(-0)).toBe(0);
    expect(either(number, literal([Number.NaN]))(Number.NaN)).toBeNaN();
    expect(messageOf(() => literal([Number.NaN, 1, "a"])("x"))).toBe(
      'expected one of NaN, 1, "a", got "x"'
    );
  });

  it("nonFinite is the three values typeof also calls numbers", () => {
    expect(nonFinite(Number.NaN)).toBeNaN();
    expect(nonFinite(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
    expect(nonFinite(Number.NEGATIVE_INFINITY)).toBe(Number.NEGATIVE_INFINITY);
    expect(messageOf(() => nonFinite(3))).toBe(
      "expected NaN, Infinity or -Infinity, got 3"
    );
    expect(messageOf(() => nonFinite("x"))).toBe(
      'expected NaN, Infinity or -Infinity, got "x"'
    );

    const anyNumber = either(number, nonFinite);
    expect(anyNumber(3)).toBe(3);
    expect(anyNumber(Number.NaN)).toBeNaN();
    expect(messageOf(() => anyNumber("x"))).toBe(
      'expected a number, or NaN, Infinity or -Infinity, got "x"'
    );
  });

  it("record keeps a key named __proto__ as a key", () => {
    const flat = record(number)(JSON.parse('{"__proto__": 1, "a": 2}'));
    expect(Object.keys(flat)).toEqual(["__proto__", "a"]);
    expect(Object.getPrototypeOf(flat)).toBe(Object.prototype);

    const nested = record(record(number))(
      JSON.parse('{"__proto__": {"x": 1}}')
    );
    expect(Object.keys(nested)).toEqual(["__proto__"]);
    expect(Object.getPrototypeOf(nested)).toBe(Object.prototype);
    expect(Reflect.get(nested, "x")).toBeUndefined();
  });

  it("nothing is undefined, the counterpart of nil", () => {
    expect(nothing(undefined)).toBeUndefined();
    expect(messageOf(() => nothing(null))).toBe("expected nothing, got null");
    expect(either(string, nothing)(undefined)).toBeUndefined();
    expect(messageOf(() => either(string, nothing)(5))).toBe(
      "expected a string, or nothing, got 5"
    );
  });

  it("only a plain object is an object", () => {
    class Thing {
      x = 1;
    }

    expect(record(number)(Object.create(null))).toEqual({});
    expect(messageOf(() => record(number)(new Map()))).toBe(
      "expected a plain object, got a Map"
    );
    expect(messageOf(() => record(number)(new Date(0)))).toBe(
      "expected a plain object, got a Date"
    );
    expect(messageOf(() => record(number)(new Thing()))).toBe(
      "expected a plain object, got a Thing"
    );
  });

  it("parseError, for a parser of your own", () => {
    function date(value: unknown): Date {
      const parsed = new Date(string(value));
      if (Number.isNaN(parsed.getTime())) throw parseError("a date", value);

      return parsed;
    }

    expect(date("2026-01-01").getTime()).toBe(Date.UTC(2026, 0, 1));
    expect(messageOf(() => date("yesterday"))).toBe(
      'expected a date, got "yesterday"'
    );
    expect(messageOf(() => object({ at: date })({ at: 5 }))).toBe(
      "at: expected a string, got 5"
    );
    expect(messageOf(() => array(date)(["2026-01-01", "x"]))).toBe(
      '[1]: expected a date, got "x"'
    );
  });

  it("safeParse", () => {
    expect(safeParse(parseUser, wire)).toMatchObject({
      ok: true,
      value: { id: 1 },
    });
    expect(safeParse(parseUser, { ...wire, id: "1" })).toEqual({
      ok: false,
      error: {
        path: "id",
        expected: "a number",
        received: '"1"',
        message: 'id: expected a number, got "1"',
      },
    });
    expect(parseErrorOf(new Error("mine"))).toBeUndefined();

    const broken: Parser<never> = () => {
      throw new Error("a bug");
    };
    expect(() => safeParse(broken, {})).toThrow("a bug");
  });
});

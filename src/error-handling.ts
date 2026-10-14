// The parse errors this module has made, and what each one carries
const data = new WeakMap<Error, ParseErrorData>();

/** Returns an Error saying what was expected and what arrived */
export function parseError(expected: string, value: unknown): Error {
  return carrying({ path: [], expected, received: describe(value) });
}

/** Returns a parse error with a step added to the front of its path; anything else is returned as it is */
export function at(thrown: unknown, step: string | number): unknown {
  const found = dataOf(thrown);

  return found ? carrying({ ...found, path: [step, ...found.path] }) : thrown;
}

/** Returns the fields of a parse error, or undefined for anything else */
export function parseErrorOf(thrown: unknown): ParseError | undefined {
  const found = dataOf(thrown);
  if (!found) return undefined;

  return {
    path: pathOf(found.path),
    expected: found.expected,
    received: found.received,
    message: messageOf(found),
  };
}

function carrying(found: ParseErrorData): Error {
  const error = new Error(messageOf(found));
  data.set(error, found);

  return error;
}

function dataOf(thrown: unknown): ParseErrorData | undefined {
  return thrown instanceof Error ? data.get(thrown) : undefined;
}

// Names a value by kind for the message: null, nothing, an array, "a string", 5, a Map
function describe(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "nothing";
  if (Array.isArray(value)) return "an array";
  switch (typeof value) {
    case "string":
      return JSON.stringify(
        value.length > 40 ? `${value.slice(0, 40)}…` : value
      );
    case "number":
    case "boolean":
      return String(value);
    case "object":
      return instanceOf(value);
    default:
      return typeof value;
  }
}

function instanceOf(value: object): string {
  const prototype = Object.getPrototypeOf(value);
  if (prototype === null || prototype === Object.prototype) return "an object";
  const maker: unknown = Reflect.get(value, "constructor");
  const name = typeof maker === "function" && maker.name ? maker.name : "";

  return name ? `${/^[AEIOU]/.test(name) ? "an" : "a"} ${name}` : "an object";
}

function messageOf(found: ParseErrorData): string {
  const where = pathOf(found.path);

  return `${where ? `${where}: ` : ""}expected ${found.expected}, got ${found.received}`;
}

// Joins the steps into a path the way it prints: users[1].name
function pathOf(steps: readonly (string | number)[]): string {
  let path = "";

  for (const step of steps) {
    path =
      typeof step === "number"
        ? `${path}[${step}]`
        : path
          ? `${path}.${step}`
          : step;
  }

  return path;
}

type ParseErrorData = {
  readonly path: readonly (string | number)[];
  readonly expected: string;
  readonly received: string;
};

/** A parse error's fields, with the path joined the way it prints */
export type ParseError = {
  path: string;
  expected: string;
  received: string;
  message: string;
};

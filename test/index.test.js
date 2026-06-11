import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createErrorClass,
  createErrorClassesByCode,
  createErrorClassesByName,
  isCustomError,
} from "../index.js";

describe("createErrorClass", () => {
  describe("basic error class creation", () => {
    it("creates an error class that produces Error instances", () => {
      const MyError = createErrorClass({
        code: "MY_ERROR",
        message: "Something went wrong",
        status: 500,
      });
      const err = new MyError();
      assert.ok(err instanceof Error);
      assert.ok(err instanceof MyError);
    });

    it("sets code from definition", () => {
      const NotFound = createErrorClass({
        code: "NOT_FOUND",
        message: "Not found",
        status: 404,
      });
      const err = new NotFound();
      assert.equal(err.code, "NOT_FOUND");
    });

    it("sets status from definition", () => {
      const NotFound = createErrorClass({
        code: "NOT_FOUND",
        message: "Not found",
        status: 404,
      });
      const err = new NotFound();
      assert.equal(err.status, 404);
    });

    it("converts SCREAMING_SNAKE_CASE code to PascalCase name", () => {
      const cases = [
        ["NOT_FOUND", "NotFound"],
        ["UNAUTHORIZED", "Unauthorized"],
        ["VALIDATION_ERROR", "ValidationError"],
        ["INTERNAL_SERVER_ERROR", "InternalServerError"],
        ["BAD_REQUEST", "BadRequest"],
      ];
      for (const [code, expectedName] of cases) {
        const Err = createErrorClass({ code, message: "msg", status: 500 });
        const err = new Err();
        assert.equal(err.name, expectedName, `${code} → ${expectedName}`);
      }
    });

    it("sets the class name to PascalCase", () => {
      const NotFound = createErrorClass({
        code: "NOT_FOUND",
        message: "Not found",
        status: 404,
      });
      assert.equal(NotFound.name, "NotFound");
    });

    it("exposes code as a static property on the class", () => {
      const NotFound = createErrorClass({
        code: "NOT_FOUND",
        message: "Not found",
        status: 404,
      });
      assert.equal(NotFound.code, "NOT_FOUND");
    });

    it("uses the default message when no arguments given", () => {
      const Err = createErrorClass({
        code: "FAIL",
        message: "Default message",
        status: 500,
      });
      const err = new Err();
      assert.equal(err.message, "Default message");
    });
  });

  describe("message templates", () => {
    it("interpolates template parameters", () => {
      const NotFound = createErrorClass({
        code: "NOT_FOUND",
        message: "Resource {resource} not found",
        status: 404,
      });
      const err = new NotFound({ resource: "User" });
      assert.equal(err.message, "Resource User not found");
    });

    it("interpolates multiple template parameters", () => {
      const Validation = createErrorClass({
        code: "VALIDATION_ERROR",
        message: "{field} is invalid: {reason}",
        status: 400,
      });
      const err = new Validation({ field: "email", reason: "too short" });
      assert.equal(err.message, "email is invalid: too short");
    });

    it("leaves unmatched placeholders in place", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "{a} and {b}",
        status: 500,
      });
      const err = new Err({ a: "hello" });
      assert.equal(err.message, "hello and {b}");
    });
  });

  describe("constructor signatures — errors with template parameters", () => {
    const NotFound = createErrorClass({
      code: "NOT_FOUND",
      message: "Resource {resource} not found",
      status: 404,
    });

    it("accepts params object as first argument", () => {
      const err = new NotFound({ resource: "User" });
      assert.equal(err.message, "Resource User not found");
    });

    it("accepts params object and cause option", () => {
      const cause = new Error("db failed");
      const err = new NotFound({ resource: "User" }, { cause });
      assert.equal(err.message, "Resource User not found");
      assert.equal(err.cause, cause);
    });

    it("accepts custom message string", () => {
      const err = new NotFound("Thing not found");
      assert.equal(err.message, "Thing not found");
    });

    it("accepts custom message with params for interpolation", () => {
      const err = new NotFound("{thing} is gone", { thing: "Widget" });
      assert.equal(err.message, "Widget is gone");
    });

    it("accepts custom message with cause option", () => {
      const cause = new Error("underlying");
      const err = new NotFound("Gone", { cause });
      assert.equal(err.message, "Gone");
      assert.equal(err.cause, cause);
    });

    it("accepts custom message, params, and cause", () => {
      const cause = new Error("underlying");
      const err = new NotFound("{x} missing", { x: "y" }, { cause });
      assert.equal(err.message, "y missing");
      assert.equal(err.cause, cause);
    });
  });

  describe("constructor signatures — errors without template parameters", () => {
    const Unauthorized = createErrorClass({
      code: "UNAUTHORIZED",
      message: "Access denied",
      status: 401,
    });

    it("accepts no arguments", () => {
      const err = new Unauthorized();
      assert.equal(err.message, "Access denied");
    });

    it("accepts custom message string", () => {
      const err = new Unauthorized("Nope");
      assert.equal(err.message, "Nope");
    });

    it("accepts custom message and cause option", () => {
      const cause = new Error("token expired");
      const err = new Unauthorized("Nope", { cause });
      assert.equal(err.message, "Nope");
      assert.equal(err.cause, cause);
    });
  });

  describe("cause chaining", () => {
    it("sets cause via options object", () => {
      const Err = createErrorClass({
        code: "WRAP",
        message: "Wrapped",
        status: 500,
      });
      const original = new TypeError("bad type");
      const err = new Err("Wrapped", { cause: original });
      assert.equal(err.cause, original);
    });

    it("cause is undefined when not provided", () => {
      const Err = createErrorClass({
        code: "NO_CAUSE",
        message: "No cause",
        status: 500,
      });
      const err = new Err();
      assert.equal(err.cause, undefined);
    });

    it("passes through falsy cause values (null, 0, false, empty string)", () => {
      const Err = createErrorClass({
        code: "FALSY",
        message: "Falsy cause",
        status: 500,
      });
      for (const falsyCause of [null, 0, false, ""]) {
        const err = new Err("msg", { cause: falsyCause });
        assert.equal(err.cause, falsyCause, `cause: ${JSON.stringify(falsyCause)}`);
      }
    });

    it("extracts cause and uses remaining keys as params when mixed in second arg", () => {
      const Err = createErrorClass({
        code: "MIXED",
        message: "{x} happened",
        status: 500,
      });
      const cause = new Error("root");
      const err = new Err("{x} happened", { x: "something", cause });
      assert.equal(err.message, "something happened");
      assert.equal(err.cause, cause);
    });

    it("cause is non-enumerable", () => {
      const Err = createErrorClass({
        code: "WRAP",
        message: "Wrapped",
        status: 500,
      });
      const err = new Err("Wrapped", { cause: new Error("root") });
      const descriptor = Object.getOwnPropertyDescriptor(err, "cause");
      assert.equal(descriptor.enumerable, false);
    });

    it("treats second arg as pure cause opts when only cause key is present", () => {
      const Err = createErrorClass({
        code: "PURE_OPTS",
        message: "default",
        status: 500,
      });
      const cause = new Error("root");
      const err = new Err("custom", { cause });
      assert.equal(err.message, "custom");
      assert.equal(err.cause, cause);
    });
  });

  describe("stack traces", () => {
    it("stack trace includes the error name and message", () => {
      const NotFound = createErrorClass({
        code: "NOT_FOUND",
        message: "Resource {resource} not found",
        status: 404,
      });
      const err = new NotFound({ resource: "User" });
      assert.ok(err.stack.includes("NotFound: Resource User not found"));
    });

    it("stack trace does not include internal constructor frames", () => {
      const Err = createErrorClass({
        code: "TEST",
        message: "test",
        status: 500,
      });
      function throwSite() {
        return new Err();
      }
      const err = throwSite();
      const stackLines = err.stack.split("\n");
      // The first frame after the message line should reference this test, not the class internals
      const firstFrame = stackLines[1];
      assert.ok(
        firstFrame.includes("throwSite"),
        `Expected first frame to reference throwSite, got: ${firstFrame}`,
      );
    });
  });

  describe("toString()", () => {
    it("toString() returns PascalCase name with message", () => {
      const NotFound = createErrorClass({
        code: "NOT_FOUND",
        message: "Resource {resource} not found",
        status: 404,
      });
      const err = new NotFound({ resource: "User" });
      assert.equal(err.toString(), "NotFound: Resource User not found");
    });

    it("toString() works for errors without params", () => {
      const Unauthorized = createErrorClass({
        code: "UNAUTHORIZED",
        message: "Access denied",
        status: 401,
      });
      const err = new Unauthorized();
      assert.equal(err.toString(), "Unauthorized: Access denied");
    });

    it("toString() works with custom message", () => {
      const Err = createErrorClass({
        code: "SOME_ERROR",
        message: "default",
        status: 500,
      });
      const err = new Err("custom message");
      assert.equal(err.toString(), "SomeError: custom message");
    });
  });

  describe("ErrorOpts as first argument for no-param errors", () => {
    const Err = createErrorClass({
      code: "SIMPLE",
      message: "Something failed",
      status: 500,
    });

    it("accepts { cause } as first argument", () => {
      const cause = new Error("root cause");
      const err = new Err({ cause });
      assert.equal(err.message, "Something failed");
      assert.equal(err.cause, cause);
    });

    it("accepts { cause: null } preserving falsy cause", () => {
      const err = new Err({ cause: null });
      assert.equal(err.message, "Something failed");
      assert.equal(err.cause, null);
    });

    it("accepts { cause: undefined } — no cause set", () => {
      const err = new Err({ cause: undefined });
      assert.equal(err.message, "Something failed");
      assert.equal(err.cause, undefined);
    });

    it("accepts {} — no cause set, uses default message", () => {
      const err = new Err({});
      assert.equal(err.message, "Something failed");
      assert.equal(err.cause, undefined);
    });

    it("does not affect parameterized errors", () => {
      const ParamErr = createErrorClass({
        code: "PARAM_ERR",
        message: "Missing {field}",
        status: 400,
      });
      // For parameterized errors, first object arg is always params
      const err = new ParamErr({ field: "name" });
      assert.equal(err.message, "Missing name");
      assert.equal(err.cause, undefined);
    });

    it("cause via opts is non-enumerable", () => {
      const err = new Err({ cause: new Error("root") });
      const descriptor = Object.getOwnPropertyDescriptor(err, "cause");
      assert.equal(descriptor.enumerable, false);
    });
  });

  describe("non-string template parameters", () => {
    it("interpolates number params", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "Found {count} items",
        status: 500,
      });
      const err = new Err({ count: 42 });
      assert.equal(err.message, "Found 42 items");
    });

    it("interpolates boolean params", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "Active: {flag}",
        status: 500,
      });
      assert.equal(new Err({ flag: true }).message, "Active: true");
      assert.equal(new Err({ flag: false }).message, "Active: false");
    });

    it("interpolates null and undefined params", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "Value is {val}",
        status: 500,
      });
      assert.equal(new Err({ val: null }).message, "Value is null");
      assert.equal(new Err({ val: undefined }).message, "Value is undefined");
    });

    it("interpolates object params", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "Data: {data}",
        status: 500,
      });
      const err = new Err({ data: { x: 1, y: "hello" } });
      assert.equal(err.message, "Data: { x: 1, y: 'hello' }");
    });

    it("interpolates array params", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "Items: {items}",
        status: 500,
      });
      const err = new Err({ items: [1, 2, 3] });
      assert.equal(err.message, "Items: [ 1, 2, 3 ]");
    });

    it("interpolates Error as param (not cause)", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "Wrapped: {inner}",
        status: 500,
      });
      const err = new Err({ inner: new TypeError("bad type") });
      assert.equal(err.message, "Wrapped: TypeError: bad type");
    });

    it("interpolates nested objects with depth limiting", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "Data: {data}",
        status: 500,
      });
      const err = new Err({
        data: { a: { b: { c: { d: { e: { f: 1 } } } } } },
      });
      assert.equal(
        err.message,
        "Data: { a: { b: { c: { d: { e: {…} } } } } }",
      );
    });

    it("interpolates circular references", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "Data: {data}",
        status: 500,
      });
      const obj = { x: 1 };
      obj.self = obj;
      const err = new Err({ data: obj });
      assert.equal(err.message, "Data: { x: 1, self: [Circular] }");
    });

    it("handles shared (non-circular) references correctly", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "Data: {data}",
        status: 500,
      });
      const shared = { val: 1 };
      const err = new Err({ data: [shared, shared] });
      assert.equal(err.message, "Data: [ { val: 1 }, { val: 1 } ]");
    });

    it("interpolates Date params", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "At: {when}",
        status: 500,
      });
      const d = new Date("2024-01-15T10:30:00Z");
      const err = new Err({ when: d });
      assert.equal(err.message, "At: 2024-01-15T10:30:00.000Z");
    });

    it("handles Invalid Date", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "At: {when}",
        status: 500,
      });
      const err = new Err({ when: new Date("invalid") });
      assert.equal(err.message, "At: Invalid Date");
    });

    it("interpolates Map params", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "Data: {data}",
        status: 500,
      });
      const err = new Err({
        data: new Map([
          ["a", 1],
          ["b", 2],
        ]),
      });
      assert.equal(err.message, "Data: Map(2) { 'a' => 1, 'b' => 2 }");
    });

    it("interpolates Set params", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "Data: {data}",
        status: 500,
      });
      const err = new Err({ data: new Set([1, 2, 3]) });
      assert.equal(err.message, "Data: Set(3) { 1, 2, 3 }");
    });

    it("handles mixed types in one template", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "{name} has {count} items: {items}",
        status: 500,
      });
      const err = new Err({ name: "Alice", count: 3, items: [1, 2, 3] });
      assert.equal(err.message, "Alice has 3 items: [ 1, 2, 3 ]");
    });

    it("string params are NOT quoted (backward compatible)", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "Hello {name}",
        status: 500,
      });
      const err = new Err({ name: "World" });
      assert.equal(err.message, "Hello World");
    });

    it("works with custom message and non-string params", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "default {x}",
        status: 500,
      });
      const err = new Err("{val} items", { val: 42 });
      assert.equal(err.message, "42 items");
    });

    it("interpolates RegExp params", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "Pattern: {pattern}",
        status: 500,
      });
      const err = new Err({ pattern: /foo|bar/gi });
      assert.equal(err.message, "Pattern: /foo|bar/gi");
    });

    it("truncates large arrays", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "Data: {data}",
        status: 500,
      });
      const err = new Err({ data: Array.from({ length: 100 }, (_, i) => i) });
      assert.ok(err.message.includes("… 50 more"));
      assert.ok(!err.message.includes("99"));
    });

    it("truncates objects with many keys", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "Data: {data}",
        status: 500,
      });
      const obj = {};
      for (let i = 0; i < 100; i++) obj[`k${i}`] = i;
      const err = new Err({ data: obj });
      assert.ok(err.message.includes("… 50 more"));
    });

    it("truncates large Maps", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "Data: {data}",
        status: 500,
      });
      const map = new Map(
        Array.from({ length: 100 }, (_, i) => [`key${i}`, i]),
      );
      const err = new Err({ data: map });
      assert.ok(err.message.startsWith("Data: Map(100) { "));
      assert.ok(err.message.includes("… 50 more"));
    });

    it("truncates large Sets", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "Data: {data}",
        status: 500,
      });
      const set = new Set(Array.from({ length: 100 }, (_, i) => i));
      const err = new Err({ data: set });
      assert.ok(err.message.startsWith("Data: Set(100) { "));
      assert.ok(err.message.includes("… 50 more"));
    });

    it("truncates very long nested strings", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "Data: {data}",
        status: 500,
      });
      const err = new Err({ data: { text: "x".repeat(1000) } });
      assert.ok(err.message.length < 500);
      assert.ok(err.message.includes("…'"));
    });

    it("does not crash on getter that throws", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "Data: {data}",
        status: 500,
      });
      const obj = {};
      Object.defineProperty(obj, "boom", {
        get() {
          throw new Error("getter exploded");
        },
        enumerable: true,
      });
      const err = new Err({ data: obj });
      assert.equal(err.message, "Data: {…}");
    });

    it("does not crash on object with throwing toString", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "Data: {data}",
        status: 500,
      });
      const obj = {
        toString() {
          throw new Error("boom");
        },
      };
      const err = new Err({ data: obj });
      assert.ok(err.message.startsWith("Data: "));
    });

    it("does not crash on Proxy with throwing traps", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "Data: {data}",
        status: 500,
      });
      const proxy = new Proxy(
        {},
        {
          ownKeys() {
            throw new Error("trap exploded");
          },
        },
      );
      const err = new Err({ data: proxy });
      assert.equal(err.message, "Data: {…}");
    });

    it("does not crash on Date with overridden toISOString", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "At: {when}",
        status: 500,
      });
      const d = new Date();
      d.toISOString = () => {
        throw new Error("boom");
      };
      const err = new Err({ when: d });
      assert.equal(err.message, "At: {…}");
    });

    it("does not crash on RegExp with overridden toString", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "Data: {data}",
        status: 500,
      });
      const rx = /test/;
      rx.toString = () => {
        throw new Error("boom");
      };
      const err = new Err({ data: rx });
      assert.equal(err.message, "Data: {…}");
    });

    it("does not crash on Error with throwing name getter", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "Data: {data}",
        status: 500,
      });
      const e = new Error("inner");
      Object.defineProperty(e, "name", {
        get() {
          throw new Error("boom");
        },
      });
      const err = new Err({ data: e });
      assert.equal(err.message, "Data: {…}");
    });

    it("does not crash on Map with forEach that throws", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "Data: {data}",
        status: 500,
      });
      const m = new Map([["a", 1]]);
      m.forEach = () => {
        throw new Error("boom");
      };
      const err = new Err({ data: m });
      assert.equal(err.message, "Data: {…}");
    });

    it("renders TypedArrays with type name and values", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "Data: {data}",
        status: 500,
      });
      const err = new Err({ data: new Uint8Array([1, 2, 3]) });
      assert.equal(err.message, "Data: Uint8Array([ 1, 2, 3 ])");
    });

    it("renders empty TypedArrays", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "Data: {data}",
        status: 500,
      });
      const err = new Err({ data: new Float64Array(0) });
      assert.equal(err.message, "Data: Float64Array([])");
    });

    it("truncates large TypedArrays", () => {
      const Err = createErrorClass({
        code: "ERR",
        message: "Data: {data}",
        status: 500,
      });
      const err = new Err({ data: new Int32Array(100) });
      assert.ok(err.message.includes("Int32Array("));
      assert.ok(err.message.includes("… 50 more"));
    });
  });

  describe("reserved parameter validation", () => {
    it("throws at definition time when message uses {cause}", () => {
      assert.throws(
        () =>
          createErrorClass({
            code: "BAD",
            message: "Failed because {cause}",
            status: 500,
          }),
        {
          message:
            'Error definition "BAD" uses reserved parameter name "{cause}" in message template',
        },
      );
    });
  });

  describe("function message", () => {
    it("calls the function with the params to build the message", () => {
      const NotFound = createErrorClass({
        code: "NOT_FOUND",
        message: (params) => `Resource ${params.resource} not found`,
        status: 404,
      });
      const err = new NotFound({ resource: "User" });
      assert.equal(err.message, "Resource User not found");
    });

    it("gives the function full control over formatting non-string params", () => {
      const Err = createErrorClass({
        code: "TOO_MANY",
        message: (params) => `Found ${params.items.length} items`,
        status: 500,
      });
      const err = new Err({ items: [1, 2, 3] });
      assert.equal(err.message, "Found 3 items");
    });

    it("passes the cause option alongside params", () => {
      const NotFound = createErrorClass({
        code: "NOT_FOUND",
        message: (params) => `Resource ${params.resource} not found`,
        status: 404,
      });
      const cause = new Error("db failed");
      const err = new NotFound({ resource: "User" }, { cause });
      assert.equal(err.message, "Resource User not found");
      assert.equal(err.cause, cause);
    });

    it("treats a zero-arg function as a no-param error", () => {
      const Unauthorized = createErrorClass({
        code: "UNAUTHORIZED",
        message: () => "Access denied",
        status: 401,
      });
      const err = new Unauthorized();
      assert.equal(err.message, "Access denied");
    });

    it("accepts { cause } as first arg for a zero-arg function message", () => {
      const Unauthorized = createErrorClass({
        code: "UNAUTHORIZED",
        message: () => "Access denied",
        status: 401,
      });
      const cause = new Error("token expired");
      const err = new Unauthorized({ cause });
      assert.equal(err.message, "Access denied");
      assert.equal(err.cause, cause);
    });

    it("uses a custom string message instead of the function when provided", () => {
      const NotFound = createErrorClass({
        code: "NOT_FOUND",
        message: (params) => `Resource ${params.resource} not found`,
        status: 404,
      });
      const err = new NotFound("Custom message");
      assert.equal(err.message, "Custom message");
    });

    it("interpolates a custom string message with params (template form)", () => {
      const NotFound = createErrorClass({
        code: "NOT_FOUND",
        message: (params) => `Resource ${params.resource} not found`,
        status: 404,
      });
      const err = new NotFound("{thing} is gone", { thing: "Widget" });
      assert.equal(err.message, "Widget is gone");
    });

    it("does not throw on a function message at runtime (cause reservation is compile-time only)", () => {
      // A `cause` param is rejected by the type checker, but function param
      // types are erased at runtime so there is nothing to validate here.
      assert.doesNotThrow(() =>
        createErrorClass({
          code: "WRAP",
          message: (params) => `Failed because ${params.reason}`,
          status: 500,
        }),
      );
    });

    it("works through createErrorClassesByCode", () => {
      const errors = createErrorClassesByCode([
        {
          code: "NOT_FOUND",
          message: (params) => `Resource ${params.resource} not found`,
          status: 404,
        },
      ]);
      const err = new errors.NOT_FOUND({ resource: "User" });
      assert.equal(err.message, "Resource User not found");
      assert.equal(err.code, "NOT_FOUND");
      assert.equal(err.name, "NotFound");
    });

    it("routes params regardless of function arity (default/rest params)", () => {
      // .length is 0 for a default-valued param, but params must still reach the
      // function — the old arity heuristic dropped them.
      const Default = createErrorClass({
        code: "X",
        message: (params = {}) => `r=${params.resource}`,
        status: 500,
      });
      const cause = new Error("root");
      const err = new Default({ resource: "User", cause });
      assert.equal(err.message, "r=User");
      assert.equal(err.cause, cause);

      const Rest = createErrorClass({
        code: "Y",
        message: (...args) => `r=${args[0]?.resource}`,
        status: 500,
      });
      assert.equal(new Rest({ resource: "User" }).message, "r=User");
    });

    it("does not throw when required params are omitted", () => {
      const E = createErrorClass({
        code: "X",
        message: (p) => `r=${p.resource}`,
        status: 500,
      });
      let err;
      assert.doesNotThrow(() => {
        err = new E();
      });
      assert.equal(err.message, "r=undefined");
    });

    it("falls back to the code when the message function throws", () => {
      const E = createErrorClass({
        code: "BOOM",
        message: () => {
          throw new Error("fn blew up");
        },
        status: 500,
      });
      const cause = new Error("real");
      let err;
      assert.doesNotThrow(() => {
        err = new E({ cause });
      });
      assert.equal(err.message, "BOOM");
      assert.equal(err.cause, cause);
    });
  });
});

describe("createErrorClassesByCode", () => {
  it("creates multiple error classes keyed by code", () => {
    const errors = createErrorClassesByCode([
      { code: "NOT_FOUND", message: "Not found", status: 404 },
      { code: "UNAUTHORIZED", message: "Access denied", status: 401 },
    ]);
    assert.ok(errors.NOT_FOUND);
    assert.ok(errors.UNAUTHORIZED);
  });

  it("each class works independently", () => {
    const errors = createErrorClassesByCode([
      {
        code: "NOT_FOUND",
        message: "Resource {resource} not found",
        status: 404,
      },
      { code: "UNAUTHORIZED", message: "Access denied", status: 401 },
    ]);

    const notFound = new errors.NOT_FOUND({ resource: "User" });
    assert.equal(notFound.message, "Resource User not found");
    assert.equal(notFound.code, "NOT_FOUND");
    assert.equal(notFound.status, 404);
    assert.equal(notFound.name, "NotFound");

    const unauthorized = new errors.UNAUTHORIZED();
    assert.equal(unauthorized.message, "Access denied");
    assert.equal(unauthorized.code, "UNAUTHORIZED");
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.name, "Unauthorized");
  });

  it("errors from different classes are not instanceof each other", () => {
    const errors = createErrorClassesByCode([
      { code: "NOT_FOUND", message: "Not found", status: 404 },
      { code: "UNAUTHORIZED", message: "Access denied", status: 401 },
    ]);

    const notFound = new errors.NOT_FOUND();
    assert.ok(notFound instanceof errors.NOT_FOUND);
    assert.ok(!(notFound instanceof errors.UNAUTHORIZED));
  });

  it("throws at definition time when a definition uses {cause}", () => {
    assert.throws(
      () =>
        createErrorClassesByCode([
          { code: "BAD", message: "Failed because {cause}", status: 500 },
        ]),
      {
        message:
          'Error definition "BAD" uses reserved parameter name "{cause}" in message template',
      },
    );
  });
});

describe("createErrorClassesByName", () => {
  it("creates multiple error classes keyed by PascalCase name", () => {
    const errors = createErrorClassesByName([
      { code: "NOT_FOUND", message: "Not found", status: 404 },
      { code: "UNAUTHORIZED", message: "Access denied", status: 401 },
    ]);
    assert.ok(errors.NotFound);
    assert.ok(errors.Unauthorized);
  });

  it("each class works independently", () => {
    const errors = createErrorClassesByName([
      {
        code: "NOT_FOUND",
        message: "Resource {resource} not found",
        status: 404,
      },
      { code: "UNAUTHORIZED", message: "Access denied", status: 401 },
    ]);

    const notFound = new errors.NotFound({ resource: "User" });
    assert.equal(notFound.message, "Resource User not found");
    assert.equal(notFound.code, "NOT_FOUND");
    assert.equal(notFound.status, 404);
    assert.equal(notFound.name, "NotFound");

    const unauthorized = new errors.Unauthorized();
    assert.equal(unauthorized.message, "Access denied");
    assert.equal(unauthorized.code, "UNAUTHORIZED");
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.name, "Unauthorized");
  });

  it("errors from different classes are not instanceof each other", () => {
    const errors = createErrorClassesByName([
      { code: "NOT_FOUND", message: "Not found", status: 404 },
      { code: "UNAUTHORIZED", message: "Access denied", status: 401 },
    ]);

    const notFound = new errors.NotFound();
    assert.ok(notFound instanceof errors.NotFound);
    assert.ok(!(notFound instanceof errors.Unauthorized));
  });

  it("throws at definition time when a definition uses {cause}", () => {
    assert.throws(
      () =>
        createErrorClassesByName([
          { code: "BAD", message: "Failed because {cause}", status: 500 },
        ]),
      {
        message:
          'Error definition "BAD" uses reserved parameter name "{cause}" in message template',
      },
    );
  });
});

describe("isCustomError", () => {
  it("returns true for errors created by createErrorClass", () => {
    const Err = createErrorClass({
      code: "TEST",
      message: "test",
      status: 500,
    });
    assert.ok(isCustomError(new Err()));
  });

  it("returns false for plain Error instances", () => {
    assert.ok(!isCustomError(new Error("plain")));
  });

  it("returns false for non-error objects", () => {
    assert.ok(!isCustomError({ code: "TEST", status: 500 }));
  });

  it("returns false for null and undefined", () => {
    assert.ok(!isCustomError(null));
    assert.ok(!isCustomError(undefined));
  });

  it("returns false for errors with code but no status", () => {
    const err = new Error("test");
    err.code = "TEST";
    assert.ok(!isCustomError(err));
  });

  it("returns false for errors with status but no code", () => {
    const err = new Error("test");
    err.status = 500;
    assert.ok(!isCustomError(err));
  });

  it("returns true for a manually augmented Error with code and status (duck-typing)", () => {
    const err = new Error("manual");
    err.code = "MANUAL";
    err.status = 500;
    assert.ok(isCustomError(err));
  });
});

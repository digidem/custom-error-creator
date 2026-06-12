import { expectType, expectError, expectAssignable } from "tsd";
import {
  createErrorClass,
  createErrorClassesByCode,
  createErrorClassesByName,
  isCustomError,
  isErrorWithCode,
  type ErrorDefinition,
  type CustomError,
  type ErrorWithCode,
} from "./index.js";

// ──────────────────────────────────────────────
// createErrorClass — with template parameters
// ──────────────────────────────────────────────

const NotFound = createErrorClass({
  code: "NOT_FOUND",
  message: "Resource {resource} not found",
  status: 404,
});

// Params required — typed and checked at compile time
const nf1 = new NotFound({ resource: "User" });
expectType<"NOT_FOUND">(nf1.code);
expectType<404>(nf1.status);
expectType<"NotFound">(nf1.name);
expectType<string>(nf1.message);
expectAssignable<Error>(nf1);

// Params with cause option
new NotFound({ resource: "User" }, { cause: new Error() });

// Custom message — params optional
new NotFound("Custom message");
new NotFound("{thing} gone", { thing: "Widget" });
new NotFound("Gone", { cause: new Error() });
new NotFound("{x} gone", { x: "y" }, { cause: new Error() });

// Missing params — should error
expectError(new NotFound());
// Wrong param name — should error
expectError(new NotFound({ resorce: "User" }));
// Empty params — should error
expectError(new NotFound({}));

// Provided status is inferred as the literal number
expectType<404>(new NotFound({ resource: "User" }).status);

// ──────────────────────────────────────────────
// createErrorClass — optional status
// ──────────────────────────────────────────────

// status omitted — instances have no `status` property; everything else inferred
const NoStatus = createErrorClass({
  code: "NO_STATUS",
  message: "Something failed",
});
const ns = new NoStatus();
expectType<"NO_STATUS">(ns.code);
expectType<"NoStatus">(ns.name);
expectType<string>(ns.message);
expectAssignable<Error>(ns);
// No `status` property at all — reading it is a compile-time error
expectError(ns.status);
new NoStatus("Custom message");
new NoStatus({ cause: new Error() });

// status omitted with template params — params still required and typed
const NoStatusParam = createErrorClass({
  code: "NO_STATUS_PARAM",
  message: "Resource {resource} not found",
});
const nsp = new NoStatusParam({ resource: "User" });
expectError(nsp.status);
expectError(new NoStatusParam());

// status omitted with a function message — params inferred, no `status`
const NoStatusFn = createErrorClass({
  code: "NO_STATUS_FN",
  message: (params: { resource: string }) => `Resource ${params.resource}`,
});
expectError(new NoStatusFn({ resource: "User" }).status);

// Batch helpers — status optional per definition
const mixedByCode = createErrorClassesByCode([
  { code: "WITH_STATUS", message: "x", status: 500 },
  { code: "NO_STATUS", message: "y" },
]);
expectType<500>(new mixedByCode.WITH_STATUS().status);
expectError(new mixedByCode.NO_STATUS().status);

const mixedByName = createErrorClassesByName([
  { code: "WITH_STATUS", message: "x", status: 500 },
  { code: "NO_STATUS", message: "y" },
]);
expectType<500>(new mixedByName.WithStatus().status);
expectError(new mixedByName.NoStatus().status);

// Created instances are assignable to the exported instance types
expectAssignable<CustomError>(new NotFound({ resource: "User" }));
expectAssignable<ErrorWithCode>(new NoStatus());
expectAssignable<ErrorWithCode>(new NotFound({ resource: "User" }));

// ──────────────────────────────────────────────
// createErrorClass — without template parameters
// ──────────────────────────────────────────────

const Unauthorized = createErrorClass({
  code: "UNAUTHORIZED",
  message: "Access denied",
  status: 401,
});

// All valid signatures
const ua1 = new Unauthorized();
expectType<"UNAUTHORIZED">(ua1.code);
expectType<401>(ua1.status);
expectType<"Unauthorized">(ua1.name);
expectAssignable<Error>(ua1);

new Unauthorized("Custom message");
new Unauthorized("Custom message", { cause: new Error() });

// Object arg should error for no-params errors
expectError(new Unauthorized({ x: "y" }));

// ──────────────────────────────────────────────
// createErrorClassesByCode — batch creation keyed by code
// ──────────────────────────────────────────────

const errors = createErrorClassesByCode([
  {
    code: "NOT_FOUND",
    message: "Resource {resource} not found",
    status: 404,
  },
  {
    code: "UNAUTHORIZED",
    message: "Access denied",
    status: 401,
  },
  {
    code: "VALIDATION_ERROR",
    message: "{field} is invalid: {reason}",
    status: 400,
  },
]);

// Each class exists and is constructible
const e1 = new errors.NOT_FOUND({ resource: "User" });
expectType<"NOT_FOUND">(e1.code);
expectType<404>(e1.status);
expectType<"NotFound">(e1.name);

const e2 = new errors.UNAUTHORIZED();
expectType<"UNAUTHORIZED">(e2.code);
expectType<401>(e2.status);
expectType<"Unauthorized">(e2.name);

const e3 = new errors.VALIDATION_ERROR({ field: "email", reason: "too short" });
expectType<"VALIDATION_ERROR">(e3.code);
expectType<400>(e3.status);
expectType<"ValidationError">(e3.name);

// Missing params should error for batch-created classes too
expectError(new errors.NOT_FOUND());
expectError(new errors.VALIDATION_ERROR());
expectError(new errors.VALIDATION_ERROR({ field: "email" }));

// ──────────────────────────────────────────────
// PascalCase name conversion at type level
// ──────────────────────────────────────────────

const InternalServerError = createErrorClass({
  code: "INTERNAL_SERVER_ERROR",
  message: "Internal server error",
  status: 500,
});
const ise = new InternalServerError();
expectType<"InternalServerError">(ise.name);
expectType<"INTERNAL_SERVER_ERROR">(ise.code);

const BadRequest = createErrorClass({
  code: "BAD_REQUEST",
  message: "Bad request",
  status: 400,
});
const br = new BadRequest();
expectType<"BadRequest">(br.name);

// ──────────────────────────────────────────────
// Reserved parameter name — {cause} in template
// ──────────────────────────────────────────────

// Using {cause} in a message template should produce a type error at definition time
expectError(
  createErrorClass({
    code: "BAD",
    message: "Failed because {cause}",
    status: 500,
  }),
);

// Also for createErrorClassesByCode
expectError(
  createErrorClassesByCode([
    {
      code: "BAD",
      message: "Failed because {cause}",
      status: 500,
    },
  ]),
);

// ──────────────────────────────────────────────
// isCustomError type guard
// ──────────────────────────────────────────────

const unknownErr: unknown = new NotFound({ resource: "test" });
if (isCustomError(unknownErr)) {
  expectType<CustomError>(unknownErr);
  expectType<string>(unknownErr.code);
  expectType<number>(unknownErr.status);
  expectAssignable<Error>(unknownErr);
}

const unknownErr2: unknown = new NoStatus();
if (isErrorWithCode(unknownErr2)) {
  expectType<ErrorWithCode>(unknownErr2);
  expectType<string>(unknownErr2.code);
  expectAssignable<Error>(unknownErr2);
}

// ──────────────────────────────────────────────
// Multiple template parameters
// ──────────────────────────────────────────────

const MultiParam = createErrorClass({
  code: "MULTI",
  message: "{a} and {b} and {c}",
  status: 500,
});

new MultiParam({ a: "1", b: "2", c: "3" });
// Missing one param should error
expectError(new MultiParam({ a: "1", b: "2" }));
// Extra param should error
expectError(new MultiParam({ a: "1", b: "2", c: "3", d: "4" }));

// ──────────────────────────────────────────────
// createErrorClassesByName — batch creation keyed by PascalCase name
// ──────────────────────────────────────────────

const byName = createErrorClassesByName([
  {
    code: "NOT_FOUND",
    message: "Resource {resource} not found",
    status: 404,
  },
  {
    code: "UNAUTHORIZED",
    message: "Access denied",
    status: 401,
  },
  {
    code: "VALIDATION_ERROR",
    message: "{field} is invalid: {reason}",
    status: 400,
  },
]);

// Each class exists and is constructible via PascalCase key
const bn1 = new byName.NotFound({ resource: "User" });
expectType<"NOT_FOUND">(bn1.code);
expectType<404>(bn1.status);
expectType<"NotFound">(bn1.name);

const bn2 = new byName.Unauthorized();
expectType<"UNAUTHORIZED">(bn2.code);
expectType<401>(bn2.status);
expectType<"Unauthorized">(bn2.name);

const bn3 = new byName.ValidationError({ field: "email", reason: "too short" });
expectType<"VALIDATION_ERROR">(bn3.code);
expectType<400>(bn3.status);
expectType<"ValidationError">(bn3.name);

// Missing params should error for byName classes too
expectError(new byName.NotFound());
expectError(new byName.ValidationError());
expectError(new byName.ValidationError({ field: "email" }));

// Reserved param name should error
expectError(
  createErrorClassesByName([
    {
      code: "BAD",
      message: "Failed because {cause}",
      status: 500,
    },
  ]),
);

// ──────────────────────────────────────────────
// Static properties on error classes
// ──────────────────────────────────────────────

expectType<"NOT_FOUND">(NotFound.code);
expectType<"NotFound">(NotFound.name);

// ──────────────────────────────────────────────
// ErrorOpts as first parameter (no-param errors)
// ──────────────────────────────────────────────

const SimpleErr = createErrorClass({
  code: "SIMPLE",
  message: "Something failed",
  status: 500,
});

// ErrorOpts as first arg — should compile for no-param errors
new SimpleErr({ cause: new Error("root") });
new SimpleErr({ cause: "string cause" });
new SimpleErr({ cause: null });
new SimpleErr({ cause: 42 });

// Empty object also valid (cause is optional in ErrorOpts)
new SimpleErr({});

// Should NOT compile for parameterized errors (object treated as params, wrong shape)
const ParamErrOpts = createErrorClass({
  code: "PARAM_ERR",
  message: "Missing {field}",
  status: 400,
});
expectError(new ParamErrOpts({ cause: new Error() }));

// ──────────────────────────────────────────────
// Non-string template parameters
// ──────────────────────────────────────────────

const NumParam = createErrorClass({
  code: "NUM_ERR",
  message: "Found {count} items",
  status: 500,
});

// Number params accepted
new NumParam({ count: 42 });
// Object params accepted
new NumParam({ count: { nested: true } });
// Boolean params accepted
new NumParam({ count: true });
// null/undefined accepted
new NumParam({ count: null });
new NumParam({ count: undefined });

// Mixed types in multi-param template
const MixedParam = createErrorClass({
  code: "MIXED_ERR",
  message: "{name} has {count} items",
  status: 500,
});
new MixedParam({ name: "Alice", count: 42 });
new MixedParam({ name: "Alice", count: [1, 2, 3] });

// String params still accepted (backward compatible)
new MixedParam({ name: "Alice", count: "many" });

// Custom message with non-string params
new NumParam("custom {val}", { val: 99 });

// ──────────────────────────────────────────────
// Function message — params inferred from the function signature
// ──────────────────────────────────────────────

const FnNotFound = createErrorClass({
  code: "NOT_FOUND",
  message: (params: { resource: string }) => `Resource ${params.resource} gone`,
  status: 404,
});

// Params required and typed from the function's parameter
const fn1 = new FnNotFound({ resource: "User" });
expectType<"NOT_FOUND">(fn1.code);
expectType<404>(fn1.status);
expectType<"NotFound">(fn1.name);
expectType<string>(fn1.message);
expectAssignable<Error>(fn1);

// Params with cause option
new FnNotFound({ resource: "User" }, { cause: new Error() });

// Custom message still allowed — params optional and untyped
new FnNotFound("Custom message");
new FnNotFound("{thing} gone", { thing: "Widget" });
new FnNotFound("Gone", { cause: new Error() });

// Missing params — should error
expectError(new FnNotFound());
// Wrong param name — should error
expectError(new FnNotFound({ resorce: "User" }));
// Extra param — should error
expectError(new FnNotFound({ resource: "User", extra: 1 }));

// Non-string param types are inferred from the function signature
const FnCount = createErrorClass({
  code: "TOO_MANY",
  message: (params: { items: number[] }) => `Found ${params.items.length}`,
  status: 500,
});
new FnCount({ items: [1, 2, 3] });
// Wrong param type — should error
expectError(new FnCount({ items: "nope" }));

// Zero-arg function message behaves like a no-param error
const FnSimple = createErrorClass({
  code: "SIMPLE",
  message: () => "Something failed",
  status: 500,
});
const fnS = new FnSimple();
expectType<"SIMPLE">(fnS.code);
new FnSimple({ cause: new Error() });
new FnSimple("Custom message");
new FnSimple("Custom message", { cause: new Error() });
// Object params should error for a no-param function message
expectError(new FnSimple({ resource: "User" }));

// `cause` is reserved for function message params too — error at definition time
expectError(
  createErrorClass({
    code: "WRAP",
    message: (params: { cause: string }) => `Failed: ${params.cause}`,
    status: 500,
  }),
);
// Including when mixed with other params
expectError(
  createErrorClass({
    code: "WRAP",
    message: (params: { resource: string; cause: unknown }) =>
      `Failed: ${params.resource}`,
    status: 500,
  }),
);
// Also enforced through the batch helpers
expectError(
  createErrorClassesByCode([
    {
      code: "WRAP",
      message: (params: { cause: string }) => `Failed: ${params.cause}`,
      status: 500,
    },
  ]),
);
// Reserved even when `cause` hides behind an index signature
expectError(
  createErrorClass({
    code: "WRAP",
    message: (params: { cause: string } & Record<string, unknown>) =>
      `Failed: ${params.cause}`,
    status: 500,
  }),
);

// Function message params must be an object — primitive params are rejected
expectError(
  createErrorClass({
    code: "COUNT",
    message: (n: number) => `Found ${n}`,
    status: 500,
  }),
);
expectError(
  createErrorClass({
    code: "NAMED",
    message: (s: string) => `Name ${s}`,
    status: 500,
  }),
);
expectError(
  createErrorClass({
    code: "NAMED",
    message: (s: Array<unknown>) => `Name ${s}`,
    status: 500,
  }),
);
expectError(
  createErrorClass({
    code: "NAMED",
    message: (s: boolean) => `Name ${s}`,
    status: 500,
  }),
);
expectError(
  createErrorClass({
    code: "NAMED",
    message: (s: () => void) => `Name ${s}`,
    status: 500,
  }),
);

// Function messages through batch helpers
const fnByCode = createErrorClassesByCode([
  {
    code: "NOT_FOUND",
    message: (params: { resource: string }) => `Resource ${params.resource}`,
    status: 404,
  },
  {
    code: "UNAUTHORIZED",
    message: () => "Access denied",
    status: 401,
  },
]);
const fbc1 = new fnByCode.NOT_FOUND({ resource: "User" });
expectType<"NOT_FOUND">(fbc1.code);
expectError(new fnByCode.NOT_FOUND());
new fnByCode.UNAUTHORIZED();

const fnByName = createErrorClassesByName([
  {
    code: "NOT_FOUND",
    message: (params: { resource: string }) => `Resource ${params.resource}`,
    status: 404,
  },
]);
const fbn1 = new fnByName.NotFound({ resource: "User" });
expectType<"NotFound">(fbn1.name);

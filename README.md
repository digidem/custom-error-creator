# custom-error-creator

[![npm version](https://img.shields.io/npm/v/custom-error-creator.svg)](https://www.npmjs.com/package/custom-error-creator)
[![GitHub CI](https://github.com/gmaclennan/custom-error-creator/actions/workflows/test.yml/badge.svg)](https://github.com/gmaclennan/custom-error-creator/actions/workflows/test.yml)
[![bundle size](https://deno.bundlejs.com/badge?q=custom-error-creator&treeshake=[*])](https://bundlejs.com/?q=custom-error-creator&treeshake=%5B*%5D)

Create typed, structured error classes from simple definitions.

## Why?

Lets you define errors declaratively and get back proper classes with:

- **Typed error codes** — catch and handle errors by code, not by sniffing
  message strings
- **HTTP status codes** — errors carry their status, so your error handler
  doesn't need a mapping table
- **Message templates** — parameterised messages with compile-time checking of
  required params
- **PascalCase names** — `NOT_FOUND` becomes `NotFound` in stack traces
  automatically
- **Clean stack traces** — the error points at your throw site, not the class
  internals
- **Standard `cause` chaining** — wrap underlying errors using the ES2022
  `cause` option

I found myself using similar patterns for error handling in multiple projects,
and this module encapsulates the common boilerplate into a simple, reusable API.

## Install

```
npm install custom-error-creator
```

## Quick start

```typescript
import { createErrorClass } from "custom-error-creator";

const NotFound = createErrorClass({
  code: "NOT_FOUND",
  message: "Resource {resource} not found",
  status: 404,
});

throw new NotFound({ resource: "User" });
// NotFound: Resource User not found
//     at handler (/app/routes.ts:12:9)
```

## API

### `createErrorClass(definition)`

Creates a single error class from a definition.

```typescript
const ValidationError = createErrorClass({
  code: "VALIDATION_ERROR",
  message: "{field} is invalid: {reason}",
  status: 400,
});
```

`status` is optional. Omit it for errors that don't map to an HTTP status — the
instance then has no `status` property at all (reading `.status` is a
compile-time error, and `"status" in err` is `false` at runtime):

```typescript
const ConfigError = createErrorClass({
  code: "CONFIG_ERROR",
  message: "Invalid config",
});

const err = new ConfigError();
err.status; // ❌ compile error — no such property
```

To recognise errors regardless of status, use the looser
[`isErrorWithCode`](#iserrorwithcodeerror) guard, which checks only `code`.

### `createErrorClassesByCode(definitions)`

Creates multiple error classes at once, returned as an object keyed by code.

```typescript
import { createErrorClassesByCode } from "custom-error-creator";

const errors = createErrorClassesByCode([
  { code: "NOT_FOUND", message: "Resource {resource} not found", status: 404 },
  { code: "UNAUTHORIZED", message: "Access denied", status: 401 },
  {
    code: "VALIDATION_ERROR",
    message: "{field} is invalid: {reason}",
    status: 400,
  },
]);

throw new errors.NOT_FOUND({ resource: "User" });
throw new errors.UNAUTHORIZED();
throw new errors.VALIDATION_ERROR({ field: "email", reason: "too short" });
```

### `createErrorClassesByName(definitions)`

Creates multiple error classes at once, returned as an object keyed by
PascalCase name.

```typescript
import { createErrorClassesByName } from "custom-error-creator";

const errors = createErrorClassesByName([
  { code: "NOT_FOUND", message: "Resource {resource} not found", status: 404 },
  { code: "UNAUTHORIZED", message: "Access denied", status: 401 },
]);

throw new errors.NotFound({ resource: "User" });
throw new errors.Unauthorized();
```

### `isCustomError(error)`

Type guard for errors created by this module that carry a numeric `status`.
Narrows to the exported `CustomError` type. Duck-typed on `code` + `status`, so
it also matches manually augmented errors with those properties.

### `isErrorWithCode(error)`

A looser alternative to `isCustomError` when you only want to check against
`error.code`. Narrows to the exported `ErrorWithCode` type. It checks `code`
alone and ignores `status`, so it matches every error this module creates (with
or without a status) as well as unrelated errors that carry a string `code`,
such as Node's system errors (`ENOENT`, etc.). Narrow further on `error.code`
when you need to be specific.

## Constructor signatures

The constructor is flexible depending on whether the message template has
parameters.

### Errors with template parameters

When the default message contains `{param}` placeholders, the params object is
required:

```typescript
const NotFound = createErrorClass({
  code: "NOT_FOUND",
  message: "Resource {resource} not found",
  status: 404,
});

// Params required — typed and checked at compile time
new NotFound({ resource: "User" });
new NotFound({ resource: "User" }, { cause: underlyingError });

// Custom message — params become optional and untyped
new NotFound("Thing not found");
new NotFound("{thing} is gone", { thing: "Widget" });
new NotFound("Gone", { cause: underlyingError });
new NotFound("{x} missing", { x: "y" }, { cause: underlyingError });
```

### Errors without template parameters

```typescript
const Unauthorized = createErrorClass({
  code: "UNAUTHORIZED",
  message: "Access denied",
  status: 401,
});

new Unauthorized();
new Unauthorized("Custom message");
new Unauthorized("Custom message", { cause: underlyingError });
```

### Function messages

When a `{param}` template isn't expressive enough, pass a function as the
message. Its parameter must be an object type, which defines the typed params
required by the constructor, and you control the formatting:

```typescript
const TooMany = createErrorClass({
  code: "TOO_MANY_ITEMS",
  message: (params: { items: number[] }) =>
    `Found ${params.items.length} items, expected fewer`,
  status: 400,
});

// Params required — typed as { items: number[] } from the function signature
new TooMany({ items: [1, 2, 3] });
new TooMany({ items: [1, 2, 3] }, { cause: underlyingError });
new TooMany({ items: "nope" }); // ❌ wrong param type, caught at compile time
```

The parameter must be an object — `(n: number) => ...` is a compile-time error,
since the constructor passes params as an object. Declare a required parameter
(`(params: { … }) => …`) rather than a defaulted one (`(params = {}) => …`); a
default makes the params optional at the type level.

A zero-argument function behaves like an error without template parameters:

```typescript
const Unauthorized = createErrorClass({
  code: "UNAUTHORIZED",
  message: () => "Access denied",
  status: 401,
});

new Unauthorized();
```

The optional custom message passed to the constructor is always a plain string
(`new TooMany("Custom message")`) — the function only produces the default
message.

As with `{param}` templates, `cause` is a reserved parameter name: a function
message whose params include a `cause` key is a compile-time error. This keeps
`cause` meaning only "the error's cause" (passed as the second constructor
argument), with no shadowing. Because a function's parameter types are erased at
runtime, this is enforced at compile time only — unlike the `{cause}` template
check, which also throws at runtime.

## Error instance properties

Every error instance has the standard `Error` properties plus:

```typescript
const err = new NotFound({ resource: "User" });

err.message; // "Resource User not found"
err.name; // "NotFound"
err.code; // "NOT_FOUND"
err.status; // 404 (the property is absent if the definition omits `status`)
err.stack; // stack trace pointing at the throw site
err.cause; // underlying error, if provided
```

## Static class properties

Error classes also expose `code` and `name` as static properties, useful for
comparisons without instantiating:

```typescript
const NotFound = createErrorClass({
  code: "NOT_FOUND",
  message: "Resource {resource} not found",
  status: 404,
});

NotFound.code; // "NOT_FOUND"
NotFound.name; // "NotFound"
```

## Error handling patterns

### By code

```typescript
try {
  await getUser(id);
} catch (err) {
  if (err.code === "NOT_FOUND") {
    // handle missing resource
  }
}
```

### By instanceof

```typescript
try {
  await getUser(id);
} catch (err) {
  if (err instanceof NotFound) {
    // handle missing resource
  }
}
```

## Wrapping errors with `cause`

Use the standard `cause` option to chain underlying errors:

```typescript
try {
  await db.query("SELECT ...");
} catch (err) {
  throw new NotFound({ resource: "User" }, { cause: err });
}
```

The `cause` is set using the native `Error` constructor option (ES2022), so it
behaves identically to `new Error("msg", { cause })` — non-enumerable and
compatible with all standard tooling.

## Reserved parameter names

The parameter name `cause` is reserved and cannot be used as a message
parameter, so it only ever refers to the error's `cause` (the second constructor
argument). For string templates this is enforced at both compile time and
runtime; for function messages, whose param types are erased at runtime, it is
enforced at compile time only.

```typescript
// ❌ Compile error at definition time + runtime throw
const Bad = createErrorClass({
  code: "BAD",
  message: "Failed because {cause}",
  status: 500,
});

// ❌ Compile error at definition time (function params)
const AlsoBad = createErrorClass({
  code: "BAD",
  message: (params: { cause: string }) => `Failed because ${params.cause}`,
  status: 500,
});
```

## Type safety

Template parameters are fully type-checked when using the default message:

```typescript
const NotFound = createErrorClass({
  code: "NOT_FOUND",
  message: "Resource {resource} not found",
  status: 404,
});

new NotFound({ resource: "User" }); // ✅
new NotFound({ resorce: "User" }); // ❌ typo caught at compile time
new NotFound({}); // ❌ missing required param
new NotFound(); // ❌ params required
```

Instance properties are also typed:

```typescript
const err = new NotFound({ resource: "User" });
err.code; // type: "NOT_FOUND"
err.status; // type: 404
err.name; // type: "NotFound"
```

## License

MIT

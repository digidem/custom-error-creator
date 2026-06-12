import {
  createErrorClass,
  createErrorClassesByCode,
  createErrorClassesByName,
} from "./index.js";

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
]);

// Default message — params required and typed
new errors.NOT_FOUND({ resource: "User" }); // ✅
new errors.NOT_FOUND({ resource: "User" }, { cause: new Error() }); // ✅
// @ts-expect-error Missing params — should error
new errors.NOT_FOUND(); // ❌
// @ts-expect-error Wrong param name — should error
new errors.NOT_FOUND({ typo: "User" }); // ❌

// Custom message — params optional, untyped
new errors.NOT_FOUND("Custom message"); // ✅
new errors.NOT_FOUND("{thing} gone", { thing: "Widget" }); // ✅
new errors.NOT_FOUND("Gone", { cause: new Error() }); // ✅
new errors.NOT_FOUND("{x} gone", { x: "y" }, { cause: new Error() }); // ✅

// No params
new errors.UNAUTHORIZED(); // ✅
new errors.UNAUTHORIZED("Nope"); // ✅
new errors.UNAUTHORIZED("Nope", { cause: new Error() }); // ✅

// Instance types
const e = new errors.NOT_FOUND({ resource: "User" });
e.name; // "NotFound"
e.code; // "NOT_FOUND"
e.status; // 404
e.message; // string
e.cause; // unknown

// Function message — params are inferred from the function signature
const TooMany = createErrorClass({
  code: "TOO_MANY_ITEMS",
  message: (params: { items: number[] }) =>
    `Found ${params.items.length} items, expected fewer`,
  status: 400,
});
new TooMany({ items: [1, 2, 3] }); // ✅ params typed as { items: number[] }
new TooMany({ items: [1, 2, 3] }, { cause: new Error() }); // ✅
// @ts-expect-error Wrong param type — should error
new TooMany({ items: "nope" }); // ❌

// createErrorClassesByName — keyed by PascalCase name
const byName = createErrorClassesByName([
  {
    code: "NOT_FOUND",
    message: "Resource {resource} not found",
    status: 404,
  },
]);
new byName.NotFound({ resource: "User" }); // ✅

// Cannot use 'cause' as a parameter name — errors at definition time
const Bad = createErrorClass({
  code: "BAD",
  // @ts-expect-error Cannot use 'cause' as a parameter name
  message: "Failed because {cause}",
  status: 500,
});

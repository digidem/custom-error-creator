function toPascalCase(screamingSnake) {
  return screamingSnake
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

const MAX_ITEMS = 50;
const MAX_STRING = 200;

function inspect(value, depth = 4, seen = new WeakSet()) {
  try {
    return _inspect(value, depth, seen);
  } catch {
    return "{…}";
  }
}

function _truncated(items, total) {
  if (total > MAX_ITEMS) items.push(`… ${total - MAX_ITEMS} more`);
  return items;
}

function _inspect(value, depth, seen) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  const t = typeof value;
  if (t === "string")
    return value.length > MAX_STRING
      ? `'${value.slice(0, MAX_STRING)}…'`
      : `'${value}'`;
  if (t === "number" || t === "boolean") return String(value);
  if (t === "symbol") return value.toString();
  if (t === "bigint") return `${value}n`;
  if (t === "function") return `[Function: ${value.name || "anonymous"}]`;
  // Non-recursive object types — always show regardless of depth
  if (value instanceof Date)
    return isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
  if (value instanceof RegExp) return value.toString();
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  // Depth/circular checks for recursive types
  if (depth < 0) return Array.isArray(value) ? "[…]" : "{…}";
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  let result;
  if (Array.isArray(value)) {
    if (value.length === 0) {
      result = "[]";
    } else {
      const items = _truncated(
        value.slice(0, MAX_ITEMS).map((v) => _inspect(v, depth - 1, seen)),
        value.length,
      );
      result = `[ ${items.join(", ")} ]`;
    }
  } else if (value instanceof Map) {
    if (value.size === 0) {
      result = "Map(0) {}";
    } else {
      const items = [];
      let i = 0;
      value.forEach((v, k) => {
        if (i++ < MAX_ITEMS)
          items.push(
            `${_inspect(k, depth - 1, seen)} => ${_inspect(v, depth - 1, seen)}`,
          );
      });
      _truncated(items, value.size);
      result = `Map(${value.size}) { ${items.join(", ")} }`;
    }
  } else if (value instanceof Set) {
    if (value.size === 0) {
      result = "Set(0) {}";
    } else {
      const items = [];
      let i = 0;
      value.forEach((v) => {
        if (i++ < MAX_ITEMS) items.push(_inspect(v, depth - 1, seen));
      });
      _truncated(items, value.size);
      result = `Set(${value.size}) { ${items.join(", ")} }`;
    }
  } else if (ArrayBuffer.isView(value) && typeof value.length === "number") {
    const name = value.constructor.name;
    if (value.length === 0) {
      result = `${name}([])`;
    } else {
      const items = _truncated(
        Array.from(value.subarray(0, MAX_ITEMS), (v) =>
          _inspect(v, depth - 1, seen),
        ),
        value.length,
      );
      result = `${name}([ ${items.join(", ")} ])`;
    }
  } else {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      result = "{}";
    } else {
      const items = _truncated(
        keys
          .slice(0, MAX_ITEMS)
          .map((k) => `${k}: ${_inspect(value[k], depth - 1, seen)}`),
        keys.length,
      );
      result = `{ ${items.join(", ")} }`;
    }
  }
  seen.delete(value);
  return result;
}

function interpolate(template, params) {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in params
      ? typeof params[key] === "string"
        ? params[key]
        : inspect(params[key])
      : match,
  );
}

const RESERVED_PARAMS = new Set(["cause"]);

function validateMessage(code, message) {
  const params = message.matchAll(/\{(\w+)\}/g);
  for (const [, key] of params) {
    if (RESERVED_PARAMS.has(key)) {
      throw new Error(
        `Error definition "${code}" uses reserved parameter name "{${key}}" in message template`,
      );
    }
  }
}

export function createErrorClass(definition) {
  const { code, message: defaultMessage, status } = definition;
  const className = toPascalCase(code);

  const isFunctionMessage = typeof defaultMessage === "function";
  const hasStatus = status !== undefined;

  if (!isFunctionMessage) {
    validateMessage(code, defaultMessage);
  }

  const ErrorKlass = class extends Error {
    code = code;
    name = className;

    constructor(messageOrParams, paramsOrOpts, opts) {
      const customMessage =
        typeof messageOrParams === "string" ? messageOrParams : undefined;

      let params, cause;

      if (typeof messageOrParams === "object" && messageOrParams !== null) {
        // First arg is a params and/or { cause } object. `cause` is a reserved
        // param name, so a cause key here is always the error's cause — which
        // also lets us route params without relying on the message's arity.
        if ("cause" in messageOrParams) {
          const { cause: extractedCause, ...rest } = messageOrParams;
          cause = extractedCause;
          params = Object.keys(rest).length > 0 ? rest : undefined;
        } else {
          params = messageOrParams;
          cause = paramsOrOpts?.cause;
        }
      } else if (typeof paramsOrOpts === "object" && paramsOrOpts !== null) {
        if (opts !== undefined) {
          // Three-arg form: new Err("msg", params, opts)
          params = paramsOrOpts;
          cause = opts.cause;
        } else if ("cause" in paramsOrOpts) {
          // Has cause key — extract it, use remaining keys as params
          const { cause: extractedCause, ...rest } = paramsOrOpts;
          cause = extractedCause;
          params = Object.keys(rest).length > 0 ? rest : undefined;
        } else {
          // Pure params object
          params = paramsOrOpts;
        }
      }

      // A custom message string always uses template interpolation; the
      // function form only ever produces the default message.
      let message;
      if (customMessage !== undefined) {
        message = params ? interpolate(customMessage, params) : customMessage;
      } else if (isFunctionMessage) {
        // The message function is user code; never let it abort construction of
        // the error (which would mask the original failure). Pass an object even
        // when params are absent, and fall back to the code if it throws.
        try {
          message = defaultMessage(params ?? {});
        } catch {
          message = code;
        }
      } else {
        message = params ? interpolate(defaultMessage, params) : defaultMessage;
      }

      super(message, cause !== undefined ? { cause } : undefined);

      if (hasStatus) this.status = status;

      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
      }
    }
  };

  Object.defineProperty(ErrorKlass, "name", { value: className });
  ErrorKlass.code = code;

  return ErrorKlass;
}

export function createErrorClassesByCode(definitions) {
  const classes = {};
  for (const def of definitions) {
    classes[def.code] = createErrorClass(def);
  }
  return classes;
}

export function createErrorClassesByName(definitions) {
  const classes = {};
  for (const def of definitions) {
    classes[toPascalCase(def.code)] = createErrorClass(def);
  }
  return classes;
}

export function isCustomError(error) {
  return (
    error instanceof Error &&
    typeof error.code === "string" &&
    typeof error.status === "number"
  );
}

export function isErrorWithCode(error) {
  return error instanceof Error && typeof error.code === "string";
}

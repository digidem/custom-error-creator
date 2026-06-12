type ExtractParams<T extends string> =
  T extends `${string}{${infer Param}}${infer Rest}`
    ? Param | ExtractParams<Rest>
    : never;

type PascalFromScreamingSnake<T extends string> =
  T extends `${infer Head}_${infer Rest}`
    ? `${Capitalize<Lowercase<Head>>}${PascalFromScreamingSnake<Rest>}`
    : Capitalize<Lowercase<T>>;

type ForbiddenParamKeys = "cause";

// Single source of truth for the compile-time hints surfaced on a definition's
// `message` field, shared across the string and function paths.
type ReservedCauseError =
  "Error: message cannot use reserved parameter name 'cause'";
type NonObjectParamsError =
  "Error: function message params must be an object type";

type ValidateMessage<T extends string> = string extends T
  ? T
  : ExtractParams<T> & ForbiddenParamKeys extends never
    ? T
    : ReservedCauseError;

type ParamsFor<T extends string> =
  ExtractParams<T> extends never
    ? never
    : ExtractParams<T> & ForbiddenParamKeys extends never
      ? Record<ExtractParams<T>, unknown>
      : never; // <- causes error when forbidden keys are used

type HasParams<T extends string> =
  ExtractParams<T> extends never ? false : true;

// A message can be a static template string or a function that receives the
// (typed) params object and returns the message string.
type MessageFn = (params: any) => string;

// Params accepted by an error's default constructor, derived from the message:
// inferred from the function's first parameter, or extracted from a template.
type MessageParams<TMessage> =
  TMessage extends (params: infer P) => string
    ? P
    : TMessage extends string
      ? ParamsFor<TMessage>
      : never;

// Whether the default message requires a params object. A zero-arg (or
// optional-arg) function message behaves like a no-param error.
type MessageHasParams<TMessage> =
  TMessage extends MessageFn
    ? TMessage extends () => string
      ? false
      : true
    : TMessage extends string
      ? HasParams<TMessage>
      : false;

// The explicitly-declared keys of T, dropping any index signature. Lets us spot
// an explicit `cause` member even when it coexists with `Record<string, …>`.
type ExplicitKeys<T> = {
  [K in keyof T as string extends K
    ? never
    : number extends K
      ? never
      : symbol extends K
        ? never
        : K]: T[K];
};

// True when a message uses the reserved `cause` parameter name — either as a
// `{cause}` placeholder in a string template or as an explicit key on a function
// message's params. Reserving it for both keeps `cause` meaning only "the
// error's cause". (Function params are erased at runtime, so for them this is
// compile-time only.)
type MessageUsesReservedKey<TMessage> = TMessage extends string
  ? ExtractParams<TMessage> & ForbiddenParamKeys extends never
    ? false
    : true
  : TMessage extends (params: infer P) => string
    ? ForbiddenParamKeys extends keyof ExplicitKeys<P>
      ? true
      : false
    : false;

// True when a function message's params are not an object type (e.g. a primitive
// like `(n: number) => string`), which the runtime cannot route as params.
type MessageParamsInvalid<TMessage> = TMessage extends () => string
  ? false
  : TMessage extends (params: infer P) => string
    ? P extends Record<string, unknown>
      ? false
      : true
    : false;

// The compile-time problem (if any) with a message, as a branded error string.
type MessageProblem<TMessage> =
  MessageUsesReservedKey<TMessage> extends true
    ? ReservedCauseError
    : MessageParamsInvalid<TMessage> extends true
      ? NonObjectParamsError
      : never;

export type ErrorDefinition<
  TMessage extends string | MessageFn = string | MessageFn,
> = {
  code: string;
  message: TMessage;
  status: number;
};

type ErrorOpts = { cause?: unknown };

type ErrorInstance<Def extends ErrorDefinition> = Error & {
  code: Def["code"];
  status: Def["status"];
  name: PascalFromScreamingSnake<Def["code"]>;
};

export type ErrorConstructor<Def extends ErrorDefinition> = (MessageHasParams<
  Def["message"]
> extends true
  ? {
      // Default message — params required
      new (params: MessageParams<Def["message"]>): ErrorInstance<Def>;
      new (
        params: MessageParams<Def["message"]>,
        opts: ErrorOpts,
      ): ErrorInstance<Def>;
      // Custom message — params optional
      new (
        message: string,
        params?: Record<string, unknown>,
      ): ErrorInstance<Def>;
      new (
        message: string,
        params: Record<string, unknown>,
        opts: ErrorOpts,
      ): ErrorInstance<Def>;
      new (message: string | undefined, opts: ErrorOpts): ErrorInstance<Def>;
    }
  : {
      new (): ErrorInstance<Def>;
      new (opts: ErrorOpts): ErrorInstance<Def>;
      new (message: string): ErrorInstance<Def>;
      new (message: string | undefined, opts: ErrorOpts): ErrorInstance<Def>;
    }) & {
  code: Def["code"];
  name: PascalFromScreamingSnake<Def["code"]>;
};

// The expected `message` type when a definition has a problem — a branded error
// string. For string templates it flows through ValidateMessage; for function
// messages (not assignable to a string) it surfaces the error on the field.
type ExpectedMessage<TMessage> = TMessage extends string
  ? ValidateMessage<TMessage>
  : MessageProblem<TMessage>;

type ValidateDefinition<Def extends ErrorDefinition> =
  [MessageProblem<Def["message"]>] extends [never]
    ? ErrorConstructor<Def>
    : MessageProblem<Def["message"]>;

export function createErrorClass<const Def extends ErrorDefinition>(
  def: [MessageProblem<Def["message"]>] extends [never]
    ? Def
    : Omit<ErrorDefinition, "message"> & {
        message: ExpectedMessage<Def["message"]>;
      },
): ValidateDefinition<Def>;

type ValidateDefinitions<Defs extends ReadonlyArray<ErrorDefinition>> = {
  [K in keyof Defs]: Defs[K] extends ErrorDefinition
    ? [MessageProblem<Defs[K]["message"]>] extends [never]
      ? Defs[K]
      : Omit<ErrorDefinition, "message"> & {
          message: ExpectedMessage<Defs[K]["message"]>;
        }
    : Defs[K];
};

export function createErrorClassesByCode<
  const Defs extends ReadonlyArray<ErrorDefinition>,
>(
  definitions: ValidateDefinitions<Defs>,
): {
  [D in Defs[number] as D["code"]]: ValidateDefinition<D>;
};

export function createErrorClassesByName<
  const Defs extends ReadonlyArray<ErrorDefinition>,
>(
  definitions: ValidateDefinitions<Defs>,
): {
  [D in Defs[number] as PascalFromScreamingSnake<
    D["code"]
  >]: ValidateDefinition<D>;
};

export function isCustomError(
  error: unknown,
): error is ErrorInstance<ErrorDefinition>;

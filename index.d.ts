type ExtractParams<T extends string> =
  T extends `${string}{${infer Param}}${infer Rest}`
    ? Param | ExtractParams<Rest>
    : never;

type PascalFromScreamingSnake<T extends string> =
  T extends `${infer Head}_${infer Rest}`
    ? `${Capitalize<Lowercase<Head>>}${PascalFromScreamingSnake<Rest>}`
    : Capitalize<Lowercase<T>>;

type ForbiddenParamKeys = "cause";

type ValidateMessage<T extends string> = string extends T
  ? T
  : ExtractParams<T> & ForbiddenParamKeys extends never
    ? T
    : `Error: message template cannot use reserved parameter name 'cause'`;

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

// True when a message uses the reserved `cause` parameter name — either as a
// `{cause}` placeholder in a string template or as a key on a function message's
// params. Reserving it for both keeps `cause` meaning only "the error's cause".
// (Function params are erased at runtime, so for them this is compile-time only.)
type MessageUsesReservedKey<TMessage> = TMessage extends string
  ? ExtractParams<TMessage> & ForbiddenParamKeys extends never
    ? false
    : true
  : TMessage extends (params: infer P) => string
    ? string extends keyof P
      ? false // index-signature params — not an explicit `cause` key
      : ForbiddenParamKeys extends keyof P
        ? true
        : false
    : false;

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

// The expected `message` type when a reserved key is used — a branded error
// string. For string templates this flows through ValidateMessage; for function
// messages (not assignable to a string) it surfaces the error on the field.
type ReservedKeyMessage<TMessage> = TMessage extends string
  ? ValidateMessage<TMessage>
  : "Error: function message params cannot use reserved parameter name 'cause'";

type ValidateDefinition<Def extends ErrorDefinition> =
  MessageUsesReservedKey<Def["message"]> extends true
    ? "Error: message cannot use reserved parameter name 'cause'"
    : ErrorConstructor<Def>;

export function createErrorClass<const Def extends ErrorDefinition>(
  def: MessageUsesReservedKey<Def["message"]> extends true
    ? Omit<ErrorDefinition, "message"> & {
        message: ReservedKeyMessage<Def["message"]>;
      }
    : Def,
): ValidateDefinition<Def>;

type ValidateDefinitions<Defs extends ReadonlyArray<ErrorDefinition>> = {
  [K in keyof Defs]: Defs[K] extends ErrorDefinition
    ? MessageUsesReservedKey<Defs[K]["message"]> extends true
      ? Omit<ErrorDefinition, "message"> & {
          message: ReservedKeyMessage<Defs[K]["message"]>;
        }
      : Defs[K]
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

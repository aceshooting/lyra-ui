import { createCatalog } from './catalog.js';
import { validateSchema } from './schema.js';
import type { JsonPrimitive, JsonValue, LyraGenActionBinding, LyraGenActionDefinition, LyraGenCatalog, LyraGenResult, LyraGenSchema } from './types.js';

type RequiredKeys<S, P> = S extends { readonly required: readonly (infer Key)[] } ? Extract<Key, keyof P> : never;
type ObjectValue<S, P extends Readonly<Record<string, LyraGenSchema>>> =
  { readonly [Key in RequiredKeys<S, P>]: InferSchema<P[Key]> } &
  { readonly [Key in Exclude<keyof P, RequiredKeys<S, P>>]?: InferSchema<P[Key]> };

/** Infer JSON value types from a const definition in the supported schema subset. Bounds remain runtime checks. */
export type InferSchema<Schema extends LyraGenSchema> = LyraGenSchema extends Schema ? JsonValue
  : Schema extends { readonly enum: readonly (infer Value extends JsonPrimitive)[] } ? Value
  : Schema extends { readonly anyOf: readonly (infer Branch extends LyraGenSchema)[] } ? InferSchema<Branch>
  : Schema extends { readonly type: 'string' } ? string
  : Schema extends { readonly type: 'number' | 'integer' } ? number
  : Schema extends { readonly type: 'boolean' } ? boolean
  : Schema extends { readonly type: 'null' } ? null
  : Schema extends { readonly type: 'array'; readonly items: infer Item extends LyraGenSchema } ? readonly InferSchema<Item>[]
  : Schema extends { readonly type: 'object'; readonly properties: infer Properties extends Readonly<Record<string, LyraGenSchema>> } ? ObjectValue<Schema, Properties>
  : never;

export type TypedActionName<Definition extends LyraGenCatalog> = Definition extends { readonly actions: infer Actions } ? Extract<keyof Actions, string> : never;
export type TypedActionPayload<Definition extends LyraGenCatalog, Name extends TypedActionName<Definition>> =
  Definition extends { readonly actions: Readonly<Record<Name, infer Action extends LyraGenActionDefinition>> } ? InferSchema<Action['payload']> : never;
export type TypedAction<Definition extends LyraGenCatalog, Name extends TypedActionName<Definition>> = LyraGenActionBinding & {
  readonly name: Name;
  readonly payload: TypedActionPayload<Definition, Name>;
};

export interface TypedCatalog<Definition extends LyraGenCatalog, State extends LyraGenSchema> {
  /** Const definitions retain action names and schema literals for static inference. */
  readonly definition: Readonly<Definition>;
  readonly catalog: LyraGenCatalog;
  readonly stateSchema: State;
  readonly action: <Name extends TypedActionName<Definition>>(name: Name, payload: TypedActionPayload<Definition, Name>) => LyraGenResult<TypedAction<Definition, Name>>;
  readonly parseState: (input: unknown) => LyraGenResult<InferSchema<State>>;
}

function freezeSchema<Schema extends LyraGenSchema>(schema: Schema): Schema {
  if ('anyOf' in schema) schema.anyOf.forEach(freezeSchema);
  else if (schema.type === 'array') freezeSchema(schema.items);
  else if (schema.type === 'object') Object.values(schema.properties).forEach(freezeSchema);
  return Object.freeze(schema);
}

function parseTyped<Schema extends LyraGenSchema>(input: unknown, schema: Schema): LyraGenResult<InferSchema<Schema> & JsonValue> {
  const checked = validateSchema(input, schema);
  if (!checked.ok) return checked;
  // This assertion follows the runtime validator for this exact supported schema; it does not admit unchecked input.
  return { ok: true, value: checked.value as InferSchema<Schema> & JsonValue, diagnostics: checked.diagnostics };
}

function factory<const Definition extends LyraGenCatalog, const State extends LyraGenSchema>(definition: Definition, state: State): TypedCatalog<Definition, State> {
  const catalog = createCatalog(definition);
  Object.freeze(definition.components);
  Object.freeze(definition);
  const stateSchema = freezeSchema(state);
  const action = <Name extends TypedActionName<Definition>>(name: Name, payload: TypedActionPayload<Definition, Name>): LyraGenResult<TypedAction<Definition, Name>> => {
    const declared = catalog.actions?.[name];
    if (!declared) return { ok: false, diagnostics: [{ code: 'action.unknown', path: '/name', message: 'Action is not declared by this typed catalog.', severity: 'error' }] };
    const checked = parseTyped(payload, declared.payload);
    if (!checked.ok) return checked;
    // The selected action definition is the same const definition indexed by Name above.
    const value: TypedAction<Definition, Name> = { name, payload: checked.value as TypedActionPayload<Definition, Name> & JsonValue };
    return { ok: true, value, diagnostics: [] };
  };
  return Object.freeze({ definition, catalog, stateSchema, action, parseState: (input: unknown) => parseTyped(input, stateSchema) });
}

export function createTypedCatalog<const Definition extends LyraGenCatalog>(definition: Definition): TypedCatalog<Definition, { readonly type: 'null' }>;
export function createTypedCatalog<const Definition extends LyraGenCatalog, const State extends LyraGenSchema>(definition: Definition, stateSchema: State): TypedCatalog<Definition, State>;
export function createTypedCatalog(definition: LyraGenCatalog, stateSchema: LyraGenSchema = { type: 'null' }): unknown { return factory(definition, stateSchema); }

/** Build a named, validated action while preserving the catalog's inferred payload type. */
export function typedAction<const Definition extends LyraGenCatalog, const State extends LyraGenSchema, Name extends TypedActionName<NoInfer<Definition>>>(catalog: TypedCatalog<Definition, State>, name: Name, payload: TypedActionPayload<NoInfer<Definition>, Name>): LyraGenResult<TypedAction<Definition, Name>> {
  return catalog.action(name, payload);
}

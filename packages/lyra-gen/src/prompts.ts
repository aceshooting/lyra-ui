import { DEFAULT_LIMITS } from './schema.js';
import type { JsonObject, JsonValue, LyraGenCatalog, LyraGenSchema } from './types.js';

function stable(value: unknown): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key => {
    const entry = (value as Record<string, unknown>)[key];
    return entry !== undefined && typeof entry !== 'function';
  }).map(key => [key, stable((value as Record<string, unknown>)[key]) ]));
  throw new TypeError('Artifact contains a non-JSON value.');
}

/** Portable catalog metadata contains no loaders, functions, or import instructions. */
export function exportCatalogArtifact(catalog: LyraGenCatalog): JsonObject {
  return stable({ format: 'lyra-gen-catalog', formatVersion: '1', id: catalog.id, version: catalog.version, components: catalog.components, actions: catalog.actions ?? {} }) as JsonObject;
}

function schema(value: LyraGenSchema): JsonObject {
  const base = stable(value) as JsonObject;
  if ('anyOf' in value) return { ...base, anyOf: value.anyOf.map(schema) };
  if (value.type === 'array') return { ...base, items: schema(value.items) };
  if (value.type === 'object') return { ...base, additionalProperties: false, properties: Object.fromEntries(Object.entries(value.properties).map(([key, child]) => [key, schema(child)])) };
  return base;
}

/** Standard JSON Schema for the structural envelope; runtime validation also checks cross-field rules. */
export function exportCatalogJsonSchema(catalog: LyraGenCatalog): JsonObject {
  const definitions: Record<string, JsonValue> = {};
  const action = Object.entries(catalog.actions ?? {}).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, definition]) => ({ type: 'object', additionalProperties: false, properties: { name: { const: name }, payload: schema(definition.payload) }, required: ['name'] }));
  for (const [role, component] of Object.entries(catalog.components).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    const properties: Record<string, JsonValue> = {
      id: { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$' },
      type: { const: role },
      props: { type: 'object', properties: Object.fromEntries(Object.entries(component.properties).map(([key, value]) => [key, schema(value)])), additionalProperties: false },
      slot: { type: 'string', maxLength: DEFAULT_LIMITS.maxStringLength },
    };
    if (component.text) properties['text'] = { type: 'string', maxLength: DEFAULT_LIMITS.maxStringLength };
    if (component.children) {
      const children = Array.isArray(component.children) ? component.children.map(child => ({ $ref: `#/$defs/${child}` })) : [{ $ref: '#/$defs/__lyra_gen_node' }];
      properties['children'] = { type: 'array', maxItems: DEFAULT_LIMITS.maxArrayLength, items: children.length ? { allOf: [{ anyOf: children }, { properties: { slot: component.slots?.length ? { enum: component.slots } : false } }] } : false };
    }
    if (!component.children) properties['children'] = { type: 'array', maxItems: 0 };
    const bindings = Object.keys(component.bindings ?? {});
    if (bindings.length) properties['bindings'] = { type: 'object', additionalProperties: false, properties: Object.fromEntries(bindings.map(key => [key, { type: 'string', pattern: '^(?:/(?:[^~/]|~[01])*)+$' }])) };
    if (component.events?.length && action.length) properties['action'] = { anyOf: action };
    const definition: Record<string, JsonValue> = { type: 'object', additionalProperties: false, properties, required: ['id', 'type'] };
    if (component.required?.length) definition['allOf'] = component.required.map((key): JsonObject => {
      const sources: JsonObject[] = [{ required: ['props'], properties: { props: { required: [key] } } }];
      if (component.bindings && Object.hasOwn(component.bindings, key)) sources.push({ required: ['bindings'], properties: { bindings: { required: [key] } } });
      return { anyOf: sources };
    });
    if (component.accessibleName?.required) {
      const paths: JsonValue[] = [];
      if (component.accessibleName.text && component.text) paths.push({ required: ['text'], properties: { text: { type: 'string', pattern: '\\S' } } });
      for (const key of component.accessibleName.properties ?? []) paths.push({ required: ['props'], properties: { props: { required: [key], properties: { [key]: { type: 'string', pattern: '\\S' } } } } });
      definition['anyOf'] = paths;
    }
    definitions[role] = definition;
  }
  definitions['__lyra_gen_node'] = { anyOf: Object.keys(catalog.components).sort().map(role => ({ $ref: `#/$defs/${role}` })) };
  return stable({
    $schema: 'https://json-schema.org/draft/2020-12/schema', title: 'Lyra generated view',
    type: 'object', additionalProperties: false,
    properties: { version: { const: '1' }, catalog: { type: 'object', additionalProperties: false, properties: { id: { const: catalog.id }, version: { const: catalog.version } }, required: ['id', 'version'] }, surfaceId: { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$' }, revision: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER }, root: { allOf: [{ $ref: '#/$defs/__lyra_gen_node' }, { properties: { slot: false } }] } },
    required: ['version', 'catalog', 'surfaceId', 'revision', 'root'], $defs: definitions,
  }) as JsonObject;
}

export interface LyraGenPromptOptions { readonly maxCharacters?: number }

/** Deterministic compact prompt; schemas are exported separately for constrained decoding. */
export function buildCatalogPrompt(catalog: LyraGenCatalog, options: LyraGenPromptOptions = {}): string {
  const artifact = exportCatalogArtifact(catalog);
  const prompt = [
    'Return one JSON LyraGenView: {version:"1",catalog:{id,version},surfaceId,revision,root}.',
    'A node is {id,type,props?,text?,children?,slot?,bindings?,action?}. Use unique ids, explicit accessible names, approved properties and declared child slots only.',
    'Use plain text. Never emit HTML, URLs, JavaScript, CSS, imports, handlers or invented component roles. Actions use host-declared names and payloads; bindings use local-state JSON Pointers.',
    'Keep source numbers as finite JSON numbers and dates as unambiguous ISO 8601 strings; the host locale formats display values. Never replace source numbers with locale-formatted strings. Write prose in the requested content language, which can differ from the host locale.',
    'Respect every schema bound. Request a supported subset when this catalog cannot express the task. Runtime validation remains required.',
    JSON.stringify(artifact),
  ].join('\n');
  const maximum = options.maxCharacters ?? 65536;
  if (!Number.isSafeInteger(maximum) || maximum < 1 || prompt.length > maximum) throw new RangeError('Catalog prompt exceeds its character budget. Select a smaller catalog.');
  return prompt;
}

/** Structural profiles describe emitted keywords; they do not certify a model provider. */
export type LyraGenSchemaProfile = 'json-schema-2020-12' | 'closed-json-v1';

/** The closed profile supports one leaf role and no composition, references, actions or bindings. */
export function exportCatalogSchemaForProfile(catalog: LyraGenCatalog, profile: LyraGenSchemaProfile): import('./types.js').LyraGenResult<JsonObject> {
  if (profile === 'json-schema-2020-12') return { ok: true, value: exportCatalogJsonSchema(catalog), diagnostics: [] };
  const diagnostics: import('./types.js').LyraGenDiagnostic[] = [];
  const unsupported = (path: string, message: string): void => { diagnostics.push({ code: 'schema.profile.unsupported', path, message, severity: 'error', hint: 'Select a single leaf role with simple schemas, or use the general JSON Schema profile.' }); };
  if (profile !== 'closed-json-v1') unsupported('', 'Unknown structural schema profile.');
  const entries = Object.entries(catalog.components);
  if (entries.length !== 1) unsupported('/components', 'The closed profile requires exactly one role.');
  const entry = entries[0];
  if (!entry) return { ok: false, diagnostics };
  const [role, component] = entry;
  if (component.children === true || (Array.isArray(component.children) && component.children.length > 0)) unsupported(`/components/${role}/children`, 'Recursive or selectable child roles need schema composition.');
  if (Object.keys(component.bindings ?? {}).length) unsupported(`/components/${role}/bindings`, 'State bindings are outside the closed profile.');
  if (component.events?.length && Object.keys(catalog.actions ?? {}).length) unsupported('/actions', 'Actions are outside the closed profile.');
  const simple = (current: LyraGenSchema, path: string): void => {
    if ('anyOf' in current) { unsupported(path, 'Alternative value types need schema composition.'); return; }
    if (current.type === 'array') simple(current.items, `${path}/items`);
    if (current.type === 'object') for (const [key, child] of Object.entries(current.properties)) simple(child, `${path}/properties/${key}`);
  };
  for (const [key, value] of Object.entries(component.properties)) simple(value, `/components/${role}/properties/${key}`);
  const names = component.accessibleName?.required ? [
    ...(component.accessibleName.text && component.text ? ['text'] : []),
    ...(component.accessibleName.properties ?? []).filter(key => Object.hasOwn(component.properties, key)).map(key => `props/${key}`),
  ] : [];
  if (names.length > 1) unsupported(`/components/${role}/accessibleName`, 'Alternative accessible-name paths need schema composition.');
  if (diagnostics.length) return { ok: false, diagnostics };
  const props = Object.fromEntries(Object.entries(component.properties).map(([key, value]) => [key, schema(value)]));
  const requiredProps = [...(component.required ?? [])];
  const required = ['id', 'type'];
  const nodeProperties: Record<string, JsonValue> = {
    id: { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$' }, type: { const: role },
    props: { type: 'object', properties: props, required: requiredProps, additionalProperties: false },
    children: { type: 'array', maxItems: 0 },
  };
  if (component.text) nodeProperties['text'] = { type: 'string', maxLength: DEFAULT_LIMITS.maxStringLength };
  const name = names[0];
  if (name === 'text') { required.push('text'); nodeProperties['text'] = { type: 'string', minLength: 1, maxLength: DEFAULT_LIMITS.maxStringLength, pattern: '\\S' }; }
  else if (name?.startsWith('props/')) {
    const key = name.slice(6);
    if (!requiredProps.includes(key)) requiredProps.push(key);
    props[key] = { ...props[key], pattern: '\\S' };
  }
  if (requiredProps.length) required.push('props');
  const general = exportCatalogJsonSchema(catalog);
  const rootProperties = general['properties'] as JsonObject;
  return { ok: true, value: stable({ $schema: general['$schema'], title: 'Lyra generated view, closed JSON profile', type: 'object', additionalProperties: false, required: general['required'], properties: { ...rootProperties, root: { type: 'object', additionalProperties: false, properties: nodeProperties, required } } }) as JsonObject, diagnostics: [] };
}

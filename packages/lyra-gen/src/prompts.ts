import { emitMarkup } from './authoring.js';
import { isContentUrlProperty } from './content-policy.js';
import { DEFAULT_LIMITS } from './schema.js';
import type { JsonObject, JsonValue, LyraGenCatalog, LyraGenNode, LyraGenSchema, LyraGenView } from './types.js';

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
  // Host-only properties are adapter output, never generated content, so prompts never name them.
  const components = Object.fromEntries(Object.entries(catalog.components).map(([role, component]) =>
    [role, Object.fromEntries(Object.entries(component).filter(([key]) => key !== 'hostProperties'))]));
  return stable({ format: 'lyra-gen-catalog', formatVersion: '1', id: catalog.id, version: catalog.version, components, actions: catalog.actions ?? {}, ...(catalog.queries ? { queries: catalog.queries } : {}) }) as JsonObject;
}

function schema(value: LyraGenSchema): JsonObject {
  const base = stable(value) as JsonObject;
  if ('anyOf' in value) return { ...base, anyOf: value.anyOf.map(schema) };
  if (value.type === 'array') return { ...base, items: schema(value.items) };
  if (value.type === 'object') {
    const properties = Object.fromEntries(Object.entries(value.properties).map(([key, child]) => [key, schema(child)]));
    if (typeof value.additionalProperties !== 'object') return { ...base, additionalProperties: false, properties };
    // An open map keeps its value schema and its width and key-length ceilings.
    return { ...base, additionalProperties: schema(value.additionalProperties), properties, propertyNames: { ...(base['propertyNames'] as JsonObject), type: 'string' } };
  }
  return base;
}

export interface LyraGenJsonSchemaOptions {
  /**
   * Repeat every shared sub-schema in place instead of hoisting it into `$defs`. The hoisted default
   * expands to exactly this output; use it for consumers that cannot resolve local references.
   */
  readonly inline?: boolean;
}

// Keywords whose values are schemas, arrays of schemas or name-to-schema maps (JSON Schema 2020-12).
const SCHEMA_KEYWORDS = new Set(['items', 'additionalProperties', 'propertyNames', 'not', 'contains', 'if', 'then', 'else']);
const SCHEMA_LIST_KEYWORDS = new Set(['anyOf', 'allOf', 'oneOf', 'prefixItems']);
const SCHEMA_MAP_KEYWORDS = new Set(['properties', '$defs', 'patternProperties', 'dependentSchemas']);
// A reference costs about 20 serialized characters; repeats shorter than this stay inline.
const HOIST_MINIMUM_LENGTH = 40;

/** Hoist sub-schemas repeated at schema positions into `$defs`; expanding every added reference restores the input. */
function hoistRepeatedSchemas(root: JsonObject): JsonObject {
  const counts = new Map<string, number>();
  const children = (schema: JsonObject, visit: (child: JsonValue) => void): void => {
    for (const [key, value] of Object.entries(schema)) {
      if (SCHEMA_KEYWORDS.has(key)) visit(value);
      else if (SCHEMA_LIST_KEYWORDS.has(key) && Array.isArray(value)) value.forEach(visit);
      else if (SCHEMA_MAP_KEYWORDS.has(key) && value && typeof value === 'object' && !Array.isArray(value)) Object.values(value).forEach(visit);
    }
  };
  const count = (value: JsonValue): void => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const encoded = JSON.stringify(value);
    if (encoded.length >= HOIST_MINIMUM_LENGTH) counts.set(encoded, (counts.get(encoded) ?? 0) + 1);
    children(value as JsonObject, count);
  };
  children(root, count);
  const definitions = root['$defs'] as Record<string, JsonValue>;
  const names = new Map<string, string>();
  const hoisted: Record<string, JsonValue> = {};
  let next = 0;
  const rewriteChildren = (schema: JsonObject): JsonObject => Object.fromEntries(Object.entries(schema).map(([key, value]) => {
    if (SCHEMA_KEYWORDS.has(key)) return [key, rewrite(value)];
    if (SCHEMA_LIST_KEYWORDS.has(key) && Array.isArray(value)) return [key, value.map(rewrite)];
    if (SCHEMA_MAP_KEYWORDS.has(key) && value && typeof value === 'object' && !Array.isArray(value)) return [key, Object.fromEntries(Object.entries(value).map(([name, child]) => [name, rewrite(child)]))];
    return [key, value];
  }));
  const rewrite = (value: JsonValue): JsonValue => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const encoded = JSON.stringify(value);
    if ((counts.get(encoded) ?? 0) < 2) return rewriteChildren(value as JsonObject);
    let name = names.get(encoded);
    if (name === undefined) {
      do name = `_${next++}`; while (Object.hasOwn(definitions, name));
      names.set(encoded, name);
      hoisted[name] = rewriteChildren(value as JsonObject);
    }
    return { $ref: `#/$defs/${name}` };
  };
  const result = rewriteChildren(root) as Record<string, JsonValue>;
  return stable({ ...result, $defs: { ...(result['$defs'] as JsonObject), ...hoisted } }) as JsonObject;
}

/**
 * Standard JSON Schema for the structural envelope; runtime validation also checks cross-field rules.
 * Repeated sub-schemas (node members, shared property shapes) are hoisted into `$defs` and referenced
 * with `$ref`; pass `{ inline: true }` for the equivalent fully inlined schema.
 */
export function exportCatalogJsonSchema(catalog: LyraGenCatalog, options: LyraGenJsonSchemaOptions = {}): JsonObject {
  const inline = inlineCatalogJsonSchema(catalog);
  return options.inline ? inline : hoistRepeatedSchemas(inline);
}

function inlineCatalogJsonSchema(catalog: LyraGenCatalog): JsonObject {
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
    const readable = Object.keys(component.properties).filter(key => !isContentUrlProperty(key, component));
    const pointer = { type: 'string', pattern: '^(?:/(?:[^~/]|~[01])*)*$' };
    if (component.children) properties['repeat'] = { type: 'object', additionalProperties: false, required: ['items', 'key'], properties: { items: pointer, key: pointer, from: { enum: ['live', 'state'] }, max: { type: 'integer', minimum: 1, maximum: 200 } } };
    const ref = { type: 'object', additionalProperties: false, required: ['source', 'pointer'], properties: { source: { enum: ['state', 'live', 'item'] }, pointer } };
    const condition = { type: 'object', additionalProperties: false, required: ['source', 'pointer', 'op'], properties: { source: { enum: ['state', 'live', 'item'] }, pointer, op: { enum: ['truthy', 'falsy', 'equals', 'notEquals', 'in', 'gt', 'gte', 'lt', 'lte'] }, value: {} } };
    properties['visible'] = condition;
    properties['a11y'] = { type: 'object', additionalProperties: false, properties: { label: { type: 'string', minLength: 1, maxLength: 256 }, description: { type: 'string', minLength: 1, maxLength: 1024 }, ...(component.interactive || component.events?.length || Object.keys(component.bindings ?? {}).length ? {} : { live: { enum: ['off', 'polite'] }, hidden: { type: 'boolean' } }) } };
    properties['checks'] = { type: 'array', minItems: 1, maxItems: 16, items: condition };
    if (readable.length) properties['computes'] = { type: 'object', additionalProperties: false, properties: Object.fromEntries(readable.map(key => [key, { type: 'object', additionalProperties: false, required: ['fn', 'arg'], properties: { fn: { type: 'string', maxLength: 64 }, arg: { anyOf: [ref, { type: 'array', maxItems: 32, items: ref }, { type: 'object', required: ['value'], additionalProperties: false, properties: { value: {} } }] } } }])) } as JsonObject;
    if (readable.length) properties['itemReads'] = { type: 'object', additionalProperties: false, properties: Object.fromEntries(readable.map(key => [key, pointer])) };
    const queries = Object.entries(catalog.queries ?? {}).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    if (queries.length) properties['dataQuery'] = { anyOf: queries.map(([name, definition]): JsonObject => ({ type: 'object', additionalProperties: false, required: ['name'], properties: { name: { const: name }, params: schema(definition.params), paramReads: { type: 'object', additionalProperties: pointer } } })) };
    if (readable.length) properties['reads'] = properties['liveReads'] = { type: 'object', additionalProperties: false, properties: Object.fromEntries(readable.map(key => [key, { type: 'string', pattern: '^(?:/(?:[^~/]|~[01])*)+$' }])) };
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

/** `'compact'` embeds the catalog as compact JSON; `'signature'` writes one typed line per role. */
export type LyraGenPromptProfile = 'compact' | 'signature';
/** The syntax a prompt asks the model to return. */
export type LyraGenPromptFormat = 'json' | 'markup';

export interface LyraGenPromptOptions {
  /** Character ceiling for the whole prompt; default 65536. A longer prompt throws a `RangeError`. */
  readonly maxCharacters?: number;
  /**
   * Catalog description. Default `'compact'`. `'signature'` is several times smaller and keeps every
   * bound; it is opt in until it has been evaluated with the model you deploy.
   */
  readonly profile?: LyraGenPromptProfile;
  /** Default `'json'` (a `LyraGenView`); `'markup'` asks for one Lyra Markup root and renders examples in Markup. */
  readonly format?: LyraGenPromptFormat;
  /** Include each role's examples. Default `true` for `'compact'` and `false` for `'signature'`. */
  readonly examples?: boolean;
}

const DEFAULT_PROMPT_CHARACTERS = 65536;
// Unbounded numbers in the reviewed catalogs use this range; the prompt states it once instead.
const DEFAULT_NUMBER_BOUND = 1e12;
const RENDERER_ONLY_MEMBERS = new Set(['documentation', 'tag', 'minimumBlockSize', 'optionalChildren']);
const NODE_MEMBERS = 'id,type,props?,text?,children?,slot?,bindings?,reads?,liveReads?,dataQuery?,repeat?,itemReads?,visible?,checks?,computes?,a11y?,action?';
const CONTENT_RULES = 'Use plain text. Never emit HTML, URLs, JavaScript, CSS, imports, handlers or invented component roles. Actions use host-declared names and payloads; bindings write and reads display local-state JSON Pointers; a read must address a path some binding in the view owns; liveReads shows a host-published live-data pointer the host documents; dataQuery names a declared query (paramReads take owned state) and liveReads then read its result; repeat renders its one child per item of an array with itemReads relative to the item; visible and checks are conditions {source: state|live|item, pointer, op, value}; computes calls a host function by name on referenced values.';
const VALUE_RULES = 'Keep source numbers as finite JSON numbers and dates as unambiguous ISO 8601 strings; the host locale formats display values. Never replace source numbers with locale-formatted strings. Write prose in the requested content language, which can differ from the host locale.';
const BOUND_RULES = 'Respect every schema bound. Objects accept only their listed properties unless additionalProperties gives a value schema; a number with no minimum or maximum stays within -1e12..1e12. Request a supported subset when this catalog cannot express the task. Runtime validation remains required.';
const SIGNATURE_LEGEND = 'Notation: role(prop:type, ...) lists the props a node may set. ! required, @ supplies the accessible name (one @ source is required), ~ bindable, key? optional object member; str(min..max) length, num and int(min..max) range (a missing side is -1e12 or 1e12), T[min..max] item count, a|b enum, A | B alternatives, {k:T} closed object, {[key str(..n) xmin..max]:T} open map, =v default, "..." note. Flags: text (text content, text@ names it), children:roles or any, slots:names, events:names, purpose:field purpose; -- when to use. En names a repeated enum.';

const JSON_HEAD = [
  'Return one JSON LyraGenView: {version:"1",catalog:{id,version},surfaceId,revision,root}.',
  `A node is {${NODE_MEMBERS}}. Use unique ids, explicit accessible names, approved properties and declared child slots only.`,
];
const MARKUP_HEAD = [
  'Return one restricted Lyra Markup root. Tag names are catalog roles, never arbitrary HTML; the host supplies the catalog, surface and revision.',
  'Every node needs a unique id="stable-id". text, slot and string properties use quoted attributes; other properties and the members bindings, reads, liveReads, dataQuery, repeat, itemReads, visible, checks, computes, a11y and action use name={JSON}. Use explicit accessible names, approved properties and declared child slots only.',
  'Plain text uses XML entities; no comments, scripts, CSS, URLs or declarations. Close every tag.',
];

function checkedPrompt(lines: readonly string[], maxCharacters: number | undefined): string {
  const prompt = lines.join('\n');
  const maximum = maxCharacters ?? DEFAULT_PROMPT_CHARACTERS;
  if (!Number.isSafeInteger(maximum) || maximum < 1 || prompt.length > maximum) throw new RangeError('Catalog prompt exceeds its character budget. Select a smaller catalog.');
  return prompt;
}

/** Drop implicit closure and the default numeric range from an artifact schema; every other bound stays. */
function compactSchema(value: JsonValue): JsonValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const schema = value as JsonObject;
  const numeric = schema['type'] === 'number' || schema['type'] === 'integer';
  const result: Record<string, JsonValue> = {};
  for (const [key, child] of Object.entries(schema)) {
    if (key === 'additionalProperties' && child === false) continue;
    if (numeric && ((key === 'minimum' && child === -DEFAULT_NUMBER_BOUND) || (key === 'maximum' && child === DEFAULT_NUMBER_BOUND))) continue;
    if (key === 'properties' && child && typeof child === 'object' && !Array.isArray(child)) result[key] = Object.fromEntries(Object.entries(child).map(([name, entry]) => [name, compactSchema(entry)]));
    else if (key === 'items' || key === 'additionalProperties') result[key] = compactSchema(child);
    else if (key === 'anyOf' && Array.isArray(child)) result[key] = child.map(compactSchema);
    else result[key] = child;
  }
  return result;
}

function compactArtifact(artifact: JsonObject, examples: boolean): JsonObject {
  const mapValues = (record: JsonValue | undefined, map: (entry: JsonObject) => JsonObject): JsonObject => Object.fromEntries(Object.entries((record ?? {}) as JsonObject).map(([name, entry]) => [name, map(entry as JsonObject)]));
  const components = mapValues(artifact['components'], component => Object.fromEntries(Object.entries(component)
    .filter(([key]) => !RENDERER_ONLY_MEMBERS.has(key) && (examples || key !== 'examples'))
    .map(([key, entry]) => [key, key === 'properties' ? mapValues(entry, compactSchema as (schema: JsonObject) => JsonObject) : entry])));
  const actions = mapValues(artifact['actions'], action => ({ ...action, payload: compactSchema(action['payload']!) }));
  const result: Record<string, JsonValue> = { ...artifact, components, actions };
  if (artifact['queries']) result['queries'] = mapValues(artifact['queries'], query => ({ ...query, params: compactSchema(query['params']!), ...(query['result'] ? { result: compactSchema(query['result']) } : {}) }));
  return result;
}

const bareWord = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const enumText = (values: readonly JsonValue[]): string => values.map(entry => typeof entry === 'string' && bareWord.test(entry) && !['true', 'false', 'null'].includes(entry) ? entry : JSON.stringify(entry)).join('|');
const bound = (value: JsonValue | undefined): string => typeof value === 'number' ? String(value) : '';
const range = (low: JsonValue | undefined, high: JsonValue | undefined): string => low === undefined && high === undefined ? '' : `(${bound(low)}..${bound(high)})`;

/** One-line type signature of a compacted artifact schema; `alias` names repeated enums. */
function signatureOf(value: JsonValue, alias: ReadonlyMap<string, string>): string {
  const schema = value as JsonObject;
  const annotations = `${schema['default'] !== undefined ? `=${JSON.stringify(schema['default'])}` : ''}${typeof schema['description'] === 'string' ? ` ${JSON.stringify(schema['description'])}` : ''}`;
  return `${signatureType(schema, alias)}${annotations}`;
}

function signatureType(schema: JsonObject, alias: ReadonlyMap<string, string>): string {
  if (Array.isArray(schema['anyOf'])) return schema['anyOf'].map(entry => signatureOf(entry, alias)).join(' | ');
  if (Array.isArray(schema['enum'])) { const text = enumText(schema['enum']); return alias.get(text) ?? text; }
  switch (schema['type']) {
    case 'string': return `str${range(schema['minLength'], schema['maxLength'])}`;
    case 'number': return `num${range(schema['minimum'], schema['maximum'])}`;
    case 'integer': return `int${range(schema['minimum'], schema['maximum'])}`;
    case 'boolean': return 'bool';
    case 'null': return 'null';
    case 'array': {
      const items = schema['items'] as JsonObject;
      const inner = signatureOf(items, alias);
      // Alternatives, enums and annotated items are grouped so the item count binds the whole item.
      const grouped = Array.isArray(items['anyOf']) || (Array.isArray(items['enum']) && inner.includes('|')) || items['default'] !== undefined || typeof items['description'] === 'string';
      return `${grouped ? `(${inner})` : inner}[${bound(schema['minItems'])}..${bound(schema['maxItems'])}]`;
    }
    case 'object': {
      const required = new Set((schema['required'] ?? []) as readonly string[]);
      const fields = Object.entries((schema['properties'] ?? {}) as JsonObject).map(([key, entry]) => `${key}${required.has(key) ? '' : '?'}:${signatureOf(entry, alias)}`);
      const map = schema['additionalProperties'];
      if (map && typeof map === 'object') {
        const names = (schema['propertyNames'] ?? {}) as JsonObject;
        fields.push(`[key str${range(names['minLength'], names['maxLength'])} x${bound(schema['minProperties'])}..${bound(schema['maxProperties'])}]:${signatureOf(map, alias)}`);
      }
      return `{${fields.join(', ')}}`;
    }
    default: return JSON.stringify(schema);
  }
}

/** Repeated long enums become `E0`, `E1`, ... so each is spelled once. */
function enumAliases(artifact: JsonObject): Map<string, string> {
  const counts = new Map<string, number>();
  const visit = (value: JsonValue): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const schema = value as JsonObject;
    if (Array.isArray(schema['enum'])) { const text = enumText(schema['enum']); counts.set(text, (counts.get(text) ?? 0) + 1); }
    for (const [key, child] of Object.entries(schema)) if (key !== 'enum' && key !== 'default' && key !== 'examples') visit(child);
  };
  visit(artifact);
  const chosen = [...counts].filter(([text, count]) => count >= 3 && text.length > 14)
    .sort(([a, countA], [b, countB]) => (b.length * countB - a.length * countA) || (a < b ? -1 : a > b ? 1 : 0));
  return new Map(chosen.map(([text], index) => [text, `E${index}`]));
}

function exampleLines(artifact: JsonObject, catalog: LyraGenCatalog, format: LyraGenPromptFormat): string[] {
  const lines: string[] = [];
  for (const [role, component] of Object.entries(artifact['components'] as JsonObject)) {
    for (const example of ((component as JsonObject)['examples'] ?? []) as readonly JsonValue[]) {
      let text = JSON.stringify(example);
      if (format === 'markup') {
        const view = { version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'example', revision: 0, root: example };
        const markup = emitMarkup(view, catalog);
        if (markup.ok) text = markup.value;
      }
      lines.push(`${role}: ${text}`);
    }
  }
  return lines;
}

function signatureLines(artifact: JsonObject): string[] {
  const alias = enumAliases(artifact);
  const lines = [SIGNATURE_LEGEND, `catalog ${String(artifact['id'])}@${String(artifact['version'])}`, ...[...alias].map(([text, name]) => `${name}=${text}`)];
  for (const [role, value] of Object.entries(artifact['components'] as JsonObject)) {
    const component = value as JsonObject;
    const required = new Set((component['required'] ?? []) as readonly string[]);
    const bindable = (component['bindings'] ?? {}) as JsonObject;
    const accessible = (component['accessibleName'] ?? {}) as JsonObject;
    const naming = accessible['required'] === true ? new Set((accessible['properties'] ?? []) as readonly string[]) : new Set<string>();
    const props = Object.entries((component['properties'] ?? {}) as JsonObject).map(([key, schema]) =>
      `${key}${required.has(key) ? '!' : ''}${naming.has(key) ? '@' : ''}${Object.hasOwn(bindable, key) ? '~' : ''}:${signatureOf(schema, alias)}`);
    const children = component['children'];
    const flags = [
      component['text'] === true ? (accessible['required'] === true && accessible['text'] === true ? 'text@' : 'text') : '',
      children === true ? 'children:any' : Array.isArray(children) && children.length ? `children:${children.join('|')}` : '',
      Array.isArray(component['slots']) && component['slots'].length ? `slots:${enumText(component['slots'])}` : '',
      Array.isArray(component['events']) && component['events'].length ? `events:${component['events'].join('|')}` : '',
      typeof component['fieldPurpose'] === 'string' ? `purpose:${component['fieldPurpose']}` : '',
    ].filter(Boolean);
    const notes = [component['useWhen'], component['description']].filter((note, index, all): note is string => typeof note === 'string' && all.indexOf(note) === index);
    lines.push(`${role}(${props.join(', ')})${flags.length ? ` ${flags.join(' ')}` : ''}${notes.length ? ` -- ${notes.join(' ')}` : ''}`);
  }
  for (const [name, value] of Object.entries((artifact['actions'] ?? {}) as JsonObject)) {
    const action = value as JsonObject;
    lines.push(`action ${name}(${signatureOf(action['payload']!, alias)})${action['confirm'] === true ? ' confirm' : ''}${typeof action['description'] === 'string' ? ` -- ${action['description']}` : ''}`);
  }
  for (const [name, value] of Object.entries((artifact['queries'] ?? {}) as JsonObject)) {
    const query = value as JsonObject;
    lines.push(`query ${name}(${signatureOf(query['params']!, alias)})${query['result'] ? ` => ${signatureOf(query['result'], alias)}` : ''}${typeof query['description'] === 'string' ? ` -- ${query['description']}` : ''}`);
  }
  return lines;
}

/** The catalog part of a prompt: compact JSON or role signatures, then any examples outside the JSON. */
function catalogLines(catalog: LyraGenCatalog, profile: LyraGenPromptProfile, format: LyraGenPromptFormat, examples: boolean): string[] {
  if (profile !== 'compact' && profile !== 'signature') throw new RangeError('Unknown prompt profile.');
  if (format !== 'json' && format !== 'markup') throw new RangeError('Unknown prompt format.');
  const artifact = compactArtifact(exportCatalogArtifact(catalog), true);
  const separate = examples && (profile === 'signature' || format === 'markup');
  const lines = profile === 'signature' ? signatureLines(artifact) : [JSON.stringify(compactArtifact(artifact, examples && format === 'json'))];
  const shown = separate ? exampleLines(artifact, catalog, format) : [];
  return shown.length ? [...lines, 'Examples:', ...shown] : lines;
}

/**
 * Deterministic catalog prompt; schemas are exported separately for constrained decoding. The prompt
 * leaves out renderer-only metadata (tags, documentation links, layout hints, optional-child lists)
 * and states the implicit object closure and default number range once instead of on every schema.
 */
export function buildCatalogPrompt(catalog: LyraGenCatalog, options: LyraGenPromptOptions = {}): string {
  const profile = options.profile ?? 'compact';
  const format = options.format ?? 'json';
  const examples = options.examples ?? profile === 'compact';
  return checkedPrompt([...(format === 'markup' ? MARKUP_HEAD : JSON_HEAD), CONTENT_RULES, VALUE_RULES, BOUND_RULES, ...catalogLines(catalog, profile, format, examples)], options.maxCharacters);
}

export interface LyraGenRefinementPromptOptions {
  /** Scope the change to this node and its descendants; only that subtree and the roles it uses are sent. */
  readonly nodeId?: string;
  /** Further catalog roles the model may introduce inside the scoped node. */
  readonly roles?: readonly string[];
  readonly profile?: LyraGenPromptProfile;
  /** Include each sent role's examples. Default `false`. */
  readonly examples?: boolean;
  readonly maxCharacters?: number;
}

function findNode(root: LyraGenNode, nodeId: string): LyraGenNode | undefined {
  const pending = [root];
  while (pending.length) { const node = pending.pop()!; if (node.id === nodeId) return node; if (node.children) pending.push(...node.children); }
  return undefined;
}

/** The roles a subtree uses plus their required child roles; parents lose unselected optional children. */
function scopedCatalog(catalog: LyraGenCatalog, node: LyraGenNode, extra: readonly string[]): LyraGenCatalog {
  const roles = new Set<string>();
  const add = (role: string): void => {
    const component = Object.hasOwn(catalog.components, role) ? catalog.components[role] : undefined;
    if (!component || roles.has(role)) return;
    roles.add(role);
    if (Array.isArray(component.children)) for (const child of component.children) if (!component.optionalChildren?.includes(child)) add(child);
  };
  const pending = [node];
  while (pending.length) { const current = pending.pop()!; add(current.type); if (current.children) pending.push(...current.children); }
  for (const role of extra) {
    if (!Object.hasOwn(catalog.components, role)) throw new RangeError('A requested refinement role is not in the catalog.');
    add(role);
  }
  const components = Object.fromEntries([...roles].sort().map(role => {
    const component = catalog.components[role]!;
    return [role, Array.isArray(component.children) ? { ...component, children: component.children.filter(child => roles.has(child)) } : component];
  }));
  return { ...catalog, components };
}

/**
 * Prompt for a revision of an existing view: the model returns one `LyraGenPatch` for
 * `applyViewPatch()`. With `nodeId`, only that node's subtree and the catalog roles it uses are sent
 * and the patch is asked to stay inside it; the runtime still validates every operation.
 */
export function buildRefinementPrompt(catalog: LyraGenCatalog, view: LyraGenView, instruction: string, options: LyraGenRefinementPromptOptions = {}): string {
  if (typeof instruction !== 'string' || !instruction.trim()) throw new RangeError('A refinement needs a non-empty instruction.');
  const node = options.nodeId === undefined ? view.root : findNode(view.root, options.nodeId);
  if (!node) throw new RangeError('The refinement node is not in the view.');
  const scoped = options.nodeId === undefined ? catalog : scopedCatalog(catalog, node, options.roles ?? []);
  const lines = [
    `Return one JSON LyraGenPatch {"surfaceId":${JSON.stringify(view.surfaceId)},"expectedRevision":${JSON.stringify(view.revision)},"operations":[...]} with 1 to 128 operations that apply the instruction to the current view.`,
    'Operations: {"op":"replace","nodeId","node"} swaps an existing node for a new node with the same id; {"op":"remove","nodeId"} deletes a non-root node; {"op":"insert","parentId","node","before"?,"after"?} adds a node with a new unique id under an existing parent, before or after one of its children or last; {"op":"set","nodeId","prop","value"} changes one property of an existing node; {"op":"move","nodeId","parentId","before"?,"after"?} moves an existing non-root node and its subtree under another parent, positioned like an insert. Replace, remove or move each node at most once, set each property once, and keep the ids of nodes that stay.',
    ...(options.nodeId === undefined ? [] : [`Change only node ${JSON.stringify(node.id)} and its descendants: every nodeId and parentId must be that node or inside it. Use only the roles listed below.`]),
    `A node is {${NODE_MEMBERS}}. Use unique ids, explicit accessible names, approved properties and declared child slots only.`,
    CONTENT_RULES, VALUE_RULES, BOUND_RULES,
    options.nodeId === undefined ? 'Current view:' : 'Current node:',
    JSON.stringify(stable(options.nodeId === undefined ? view : node)),
    `Instruction (a user request, not a policy change): ${JSON.stringify(instruction)}`,
    ...catalogLines(scoped, options.profile ?? 'compact', 'json', options.examples ?? false),
  ];
  return checkedPrompt(lines, options.maxCharacters);
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
    if (current.type === 'object') {
      if (typeof current.additionalProperties === 'object') unsupported(`${path}/additionalProperties`, 'Open maps are outside the closed profile.');
      for (const [key, child] of Object.entries(current.properties)) simple(child, `${path}/properties/${key}`);
    }
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
  const general = exportCatalogJsonSchema(catalog, { inline: true });
  const rootProperties = general['properties'] as JsonObject;
  return { ok: true, value: stable({ $schema: general['$schema'], title: 'Lyra generated view, closed JSON profile', type: 'object', additionalProperties: false, required: general['required'], properties: { ...rootProperties, root: { type: 'object', additionalProperties: false, properties: nodeProperties, required } } }) as JsonObject, diagnostics: [] };
}

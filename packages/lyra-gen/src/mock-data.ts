import type { JsonObject, JsonPrimitive, JsonValue, LyraGenCatalog, LyraGenNode, LyraGenSchema, LyraGenView } from './types.js';

/** Options for deterministic sample data. The same seed, catalog and inputs always give the same JSON. */
export interface LyraGenMockOptions {
  /** Any finite integer; defaults to 1. */
  readonly seed?: number;
  /** Item count used for arrays that declare no `minItems` (clamped to the declared bounds); default 4. */
  readonly itemCount?: number;
  /** Views whose node reads define the shape of a query that declares no `result` schema. */
  readonly view?: LyraGenView;
}

/** Request shape the mock query provider accepts; structurally the `lr-gen-view` query request. */
export interface LyraGenMockQueryRequest {
  readonly name: string;
  readonly params: JsonValue;
  readonly nodeId?: string;
}

const MAX_DEPTH = 8;
const MAX_ITEMS = 50;
const WORDS = ['alpha', 'bravo', 'delta', 'ember', 'fjord', 'grove', 'harbor', 'indigo', 'juniper', 'kestrel', 'lumen', 'meadow'];

function hashSeed(seed: number, context: string): number {
  let hash = (Math.trunc(Number.isFinite(seed) ? seed : 1) | 0) ^ 0x9e3779b9;
  for (let index = 0; index < context.length; index++) hash = Math.imul(hash ^ context.charCodeAt(index), 0x01000193);
  return hash >>> 0;
}
/** Small deterministic PRNG (mulberry32); returns floats in [0, 1). */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const finite = (value: unknown, fallback: number): number => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const pick = <T>(items: readonly T[], random: () => number): T => items[Math.min(items.length - 1, Math.floor(random() * items.length))]!;
const isPlain = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function sampleString(schema: { readonly minLength?: number; readonly maxLength?: number }, random: () => number): string {
  const min = Math.max(0, Math.trunc(finite(schema.minLength, 0)));
  const max = Math.max(min, Math.trunc(finite(schema.maxLength, 64)));
  if (max === 0) return '';
  const target = Math.min(max, Math.max(min, 1, 6 + Math.floor(random() * 9)));
  let text = '';
  while (text.length < target) text += `${text ? ' ' : ''}${pick(WORDS, random)}`;
  return text.slice(0, target).replace(/ $/, 'x');
}
function sampleNumber(schema: { readonly type: string; readonly minimum?: number; readonly maximum?: number }, random: () => number): number {
  const integer = schema.type === 'integer';
  let low = finite(schema.minimum, finite(schema.maximum, 100) < 0 ? finite(schema.maximum, 0) - 100 : 0);
  let high = finite(schema.maximum, Math.max(low, 0) + 100);
  if (integer) { low = Math.ceil(low); high = Math.floor(high); }
  if (high < low) high = low;
  const raw = low + random() * (high - low);
  if (integer) return Math.min(high, Math.max(low, Math.round(raw)));
  const rounded = Math.round(raw * 100) / 100;
  return Math.min(high, Math.max(low, Number.isFinite(rounded) ? rounded : raw));
}

function sample(schema: LyraGenSchema | undefined, random: () => number, options: Required<Pick<LyraGenMockOptions, 'itemCount'>>, depth: number): JsonValue {
  if (!schema || depth > MAX_DEPTH) return null;
  const shape = schema as unknown as Record<string, unknown>;
  if (Array.isArray(shape['enum']) && shape['enum'].length) return pick(shape['enum'] as readonly JsonPrimitive[], random);
  if (Array.isArray(shape['anyOf'])) {
    const variants = (shape['anyOf'] as readonly LyraGenSchema[]).filter(variant => (variant as { type?: string }).type !== 'null');
    const chosen = variants.length ? pick(variants, random) : (shape['anyOf'] as readonly LyraGenSchema[])[0];
    return sample(chosen, random, options, depth + 1);
  }
  switch (shape['type']) {
    case 'string': return sampleString(shape, random);
    case 'number': case 'integer': return sampleNumber(shape as { type: string }, random);
    case 'boolean': return random() < 0.5;
    case 'null': return null;
    case 'array': {
      const min = Math.max(0, Math.trunc(finite(shape['minItems'], 0)));
      const max = Math.min(MAX_ITEMS, Math.max(min, Math.trunc(finite(shape['maxItems'], MAX_ITEMS))));
      const count = Math.min(max, Math.max(min, Math.trunc(options.itemCount)));
      return Array.from({ length: count }, () => sample(shape['items'] as LyraGenSchema, random, options, depth + 1));
    }
    case 'object': {
      const properties = isPlain(shape['properties']) ? shape['properties'] as Record<string, LyraGenSchema> : {};
      const out: Record<string, JsonValue> = {};
      for (const key of Object.keys(properties)) out[key] = sample(properties[key], random, options, depth + 1);
      const extra = shape['additionalProperties'];
      if (isPlain(extra)) {
        const names = isPlain(shape['propertyNames']) ? shape['propertyNames'] : {};
        const maxName = Math.max(1, Math.trunc(finite(names['maxLength'], 8)));
        const needed = Math.min(finite(shape['maxProperties'], 16), Math.max(0, Math.trunc(finite(shape['minProperties'], 0))));
        for (let index = 0; Object.keys(out).length < needed && index < 64; index++) {
          const key = `k${index}`.slice(0, maxName);
          if (!Object.hasOwn(out, key)) out[key] = sample(extra as unknown as LyraGenSchema, random, options, depth + 1);
        }
      }
      return out as JsonObject;
    }
    default: return null;
  }
}

/** Decode a JSON Pointer into segments; `null` for a malformed pointer. */
function segments(pointer: string): readonly string[] | null {
  if (pointer === '') return [];
  if (!pointer.startsWith('/')) return null;
  return pointer.slice(1).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));
}
const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);
/** Write `value` at `pointer` inside `root`, creating containers on the way; numeric segments make arrays. Returns the (possibly new) root. */
function writeAt(root: JsonValue | undefined, pointer: string, value: JsonValue): JsonValue | undefined {
  const parts = segments(pointer);
  if (!parts || parts.some(part => UNSAFE.has(part))) return root;
  if (!parts.length) return value;
  const fresh = (part: string): Record<string, JsonValue> | JsonValue[] => /^\d+$/.test(part) ? [] : {};
  let container = (root !== null && typeof root === 'object' ? root : fresh(parts[0]!)) as Record<string, JsonValue> | JsonValue[];
  const top = container;
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index]!;
    const last = index === parts.length - 1;
    const bag = container as Record<string, JsonValue>;
    if (last) { bag[part] = value; break; }
    const existing = bag[part];
    const child = existing !== null && typeof existing === 'object' ? existing : fresh(parts[index + 1]!);
    bag[part] = child;
    container = child as Record<string, JsonValue> | JsonValue[];
  }
  return top;
}
interface Reads { readonly pointer: string; readonly schema: LyraGenSchema | undefined }

function propertySchema(catalog: LyraGenCatalog, node: LyraGenNode, property: string): LyraGenSchema | undefined {
  return catalog.components[node.type]?.properties[property];
}
function walk(node: LyraGenNode, visit: (node: LyraGenNode) => void, depth = 0): void {
  if (depth > 64) return;
  visit(node);
  for (const child of node.children ?? []) walk(child, visit, depth + 1);
}

/**
 * Build the data object a node set reads: each `liveReads` pointer receives a value satisfying the
 * target property's schema, and a `repeat` receives an array whose items satisfy the template's
 * `itemReads` and carry unique `key` values.
 */
function buildReads(nodes: readonly LyraGenNode[], catalog: LyraGenCatalog, random: () => number, options: Required<Pick<LyraGenMockOptions, 'itemCount'>>): JsonValue {
  let data: JsonValue | undefined;
  const reads = (node: LyraGenNode): readonly Reads[] => Object.entries(node.liveReads ?? {}).map(([property, pointer]) => ({ pointer, schema: propertySchema(catalog, node, property) }));
  for (const node of nodes) {
    for (const read of reads(node)) data = writeAt(data, read.pointer, sample(read.schema, random, options, 0));
    const repeat = node.repeat;
    const template = node.children?.[0];
    if (repeat && repeat.from !== 'state' && template) {
      const max = Math.min(MAX_ITEMS, Math.max(1, Math.trunc(finite(repeat.max, MAX_ITEMS))));
      const count = Math.min(max, Math.max(1, Math.trunc(options.itemCount)));
      const items: JsonValue[] = [];
      for (let index = 0; index < count; index++) {
        let item: JsonValue | undefined;
        for (const [property, pointer] of Object.entries(template.itemReads ?? {})) item = writeAt(item, pointer, sample(propertySchema(catalog, template, property), random, options, 0));
        item = writeAt(item, repeat.key, repeat.key === '' ? index : `item-${index}`) ?? item;
        items.push(item ?? {});
      }
      data = writeAt(data, repeat.items, items);
    }
  }
  return data ?? {};
}

/**
 * Deterministic sample result for a declared catalog query: it satisfies the query's `result`
 * schema (lengths, ranges, item counts and enums). A query without a `result` schema takes its
 * shape from `options.view` (the nodes that display it) and is otherwise an empty object.
 * Returns `undefined` for an undeclared query name.
 */
export function mockQueryResult(catalog: LyraGenCatalog, queryName: string, _params: JsonValue = {}, options: LyraGenMockOptions = {}): JsonValue | undefined {
  const definition = catalog.queries && Object.hasOwn(catalog.queries, queryName) ? catalog.queries[queryName] : undefined;
  if (!definition) return undefined;
  const random = createRandom(hashSeed(options.seed ?? 1, `query:${queryName}`));
  const settings = { itemCount: options.itemCount ?? 4 };
  if (definition.result) return sample(definition.result, random, settings, 0);
  if (!options.view) return {};
  const nodes: LyraGenNode[] = [];
  walk(options.view.root, node => { if (node.dataQuery?.name === queryName) nodes.push(node); });
  return buildReads(nodes, catalog, random, settings);
}

/**
 * Deterministic sample for `lr-gen-view.liveData`: covers the pointers read by every node without a
 * `dataQuery` (`liveReads`, live `repeat` lists and their `itemReads`), shaped by the target property
 * schemas, so a generated dashboard renders with plausible values and no backend.
 */
export function mockLiveData(view: LyraGenView, catalog: LyraGenCatalog, options: LyraGenMockOptions = {}): JsonValue {
  const random = createRandom(hashSeed(options.seed ?? 1, `live:${view.surfaceId}`));
  const nodes: LyraGenNode[] = [];
  walk(view.root, node => { if (!node.dataQuery) nodes.push(node); });
  return buildReads(nodes, catalog, random, { itemCount: options.itemCount ?? 4 });
}

/** A query provider compatible with `lr-gen-view.queryProvider`; undeclared queries reject. */
export function createMockQueryProvider(catalog: LyraGenCatalog, options: LyraGenMockOptions & { readonly latencyMs?: number } = {}): (request: LyraGenMockQueryRequest & { readonly signal?: AbortSignal }) => Promise<JsonValue> {
  return async request => {
    const delay = Math.max(0, Math.min(10_000, finite(options.latencyMs, 0)));
    if (delay) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delay);
        request.signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
      });
    }
    if (request.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const result = mockQueryResult(catalog, request.name, request.params, options);
    if (result === undefined) throw new TypeError('The query is not declared by the catalog.');
    return result;
  };
}

import { escapePointerSegment, resolveLimits, snapshotJson } from './schema.js';
import { parsePointer, readPointer } from './references.js';
import { validateView } from './runtime.js';
import type { JsonValue, LyraGenCatalog, LyraGenLimits, LyraGenNode, LyraGenResult } from './types.js';

export interface LyraGenTemplateValues {
  /** Property name to a JSON Pointer within the current data row. */
  readonly props?: Readonly<Record<string, string>>;
  /** A row JSON Pointer whose value must be a string. */
  readonly text?: string;
}
export interface LyraGenTemplate {
  readonly id: string;
  /** Row JSON Pointer resolving to an explicit stable string or safe integer key. */
  readonly key: string;
  readonly root: LyraGenNode;
  readonly values?: Readonly<Record<string, LyraGenTemplateValues>>;
}
export interface LyraGenTemplateExpansion {
  readonly templateId: string;
  readonly keys: readonly (string | number)[];
  readonly nodes: readonly LyraGenNode[];
  readonly removedNodeIds: readonly string[];
}
export interface LyraGenTemplateOptions {
  readonly limits?: Partial<LyraGenLimits>;
  /** Only a prior successful expansion from this module is accepted. */
  readonly previous?: LyraGenTemplateExpansion;
}
const cache = new WeakMap<LyraGenTemplateExpansion, ReadonlyMap<string, { fingerprint: string; node: LyraGenNode }>>();
const object = (value: unknown): value is Record<string, JsonValue> => value !== null && typeof value === 'object' && !Array.isArray(value);
const identity = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u;
const failure = <T>(code: string, message: string): LyraGenResult<T> => ({ ok: false, diagnostics: [{ code, message, path: '', severity: 'error' }] });

/** Expand a trusted template atomically; row data can fill values, never identities or actions. */
export function expandTemplate(template: LyraGenTemplate, rows: unknown, catalog: LyraGenCatalog, options: LyraGenTemplateOptions = {}): LyraGenResult<LyraGenTemplateExpansion> {
  const limits = resolveLimits(options.limits);
  const admittedTemplate = snapshotJson(template, limits);
  if (!admittedTemplate.ok) return admittedTemplate;
  const raw = admittedTemplate.value;
  if (!object(raw) || Object.keys(raw).some(key => !['id', 'key', 'root', 'values'].includes(key)) || typeof raw['id'] !== 'string' || !identity.test(raw['id']) || typeof raw['key'] !== 'string' || !parsePointer(raw['key']).ok || !object(raw['root'])) return failure('template.invalid', 'Template identity, root and key pointer must be valid.');
  const safe = raw as unknown as LyraGenTemplate;
  const admittedRows = snapshotJson(rows, limits);
  if (!admittedRows.ok) return admittedRows;
  if (!Array.isArray(admittedRows.value)) return failure('template.rows', 'Template data must be an array.');
  const previous = options.previous;
  const previousCache = previous ? cache.get(previous) : undefined;
  if (previous && (!previousCache || previous.templateId !== safe.id)) return failure('template.previous', 'Previous expansion must belong to this template.');
  const sourceIds = new Set<string>();
  const sourceNodes = new Map<string, Record<string, JsonValue>>();
  let sourceFailure = false;
  const inspect = (input: unknown): void => {
    if (!object(input) || Object.keys(input).some(key => !['id', 'type', 'props', 'children', 'text', 'slot', 'bindings', 'action'].includes(key)) || typeof input['id'] !== 'string' || !identity.test(input['id']) || sourceIds.has(input['id']) || typeof input['type'] !== 'string' || !Object.hasOwn(catalog.components, input['type'])) { sourceFailure = true; return; }
    sourceIds.add(input['id']);
    sourceNodes.set(input['id'], input);
    if (input['children'] !== undefined) {
      if (!Array.isArray(input['children'])) sourceFailure = true;
      else input['children'].forEach(inspect);
    }
  };
  inspect(safe.root);
  if (sourceFailure || sourceIds.size * admittedRows.value.length > limits.maxNodes) return failure('template.identity', 'Template node identities must be unique and expansion must fit the node ceiling.');
  if (raw['values'] !== undefined) {
    if (!object(raw['values'])) return failure('template.mapping', 'Template mappings must be an object.');
    for (const [nodeId, mapping] of Object.entries(raw['values'])) {
      if (!sourceIds.has(nodeId) || !object(mapping) || Object.keys(mapping).some(key => !['props', 'text'].includes(key))) return failure('template.mapping', 'Mappings must address declared template nodes.');
      if (mapping['text'] !== undefined && (typeof mapping['text'] !== 'string' || !parsePointer(mapping['text']).ok)) return failure('template.mapping', 'Text mappings need a valid row pointer.');
      if (mapping['props'] !== undefined && (!object(mapping['props']) || Object.values(mapping['props']).some(pointer => typeof pointer !== 'string' || !parsePointer(pointer).ok))) return failure('template.mapping', 'Property mappings need valid row pointers.');
      const sourceNode = sourceNodes.get(nodeId)!;
      const component = catalog.components[sourceNode['type'] as string]!;
      if (mapping['text'] !== undefined && !component.text || object(mapping['props']) && Object.keys(mapping['props']).some(property => !Object.hasOwn(component.properties, property))) return failure('template.mapping', 'Mappings may fill only catalog-declared text and properties.');
    }
  }
  const encodedKeys = new Set<string>();
  const keys: (string | number)[] = [];
  const nodes: LyraGenNode[] = [];
  const nextCache = new Map<string, { fingerprint: string; node: LyraGenNode }>();
  const nodeIds = new Set<string>();
  const encoder = new TextEncoder();
  let usedBytes = 2;
  let mappingFailure: LyraGenResult<never> | undefined;
  const recordIds = (node: LyraGenNode): void => { nodeIds.add(node.id); node.children?.forEach(recordIds); };
  for (const row of admittedRows.value) {
    const selectedKey = readPointer(row as JsonValue, safe.key);
    if (!selectedKey.ok || !(typeof selectedKey.value === 'string' && selectedKey.value.length > 0 || typeof selectedKey.value === 'number' && Number.isSafeInteger(selectedKey.value))) return failure('template.key', 'Each row needs a nonempty string or safe integer key.');
    const key = selectedKey.value as string | number;
    const keyText = String(key);
    if (keyText.length > 24) return failure('template.key', 'Template keys may contain at most 24 UTF-16 code units.');
    let encoded = typeof key === 'string' ? 's' : 'n';
    for (let index = 0; index < keyText.length; index++) encoded += keyText.charCodeAt(index).toString(16).padStart(4, '0');
    if (encodedKeys.has(encoded)) return failure('template.key-duplicate', 'Template row keys must be unique.');
    encodedKeys.add(encoded);
    const scope = `/_templates/${escapePointerSegment(safe.id)}/${encoded}`;
    const materialize = (node: LyraGenNode): LyraGenNode => {
      const id = `${safe.id.length}:${safe.id}.${encoded}.${node.id.length}:${node.id}`;
      if (!identity.test(id)) mappingFailure = failure('template.identity', 'Expanded identities exceed the supported length.');
      const mapping = safe.values?.[node.id];
      const props: Record<string, JsonValue> = { ...node.props };
      for (const [property, pointer] of Object.entries(mapping?.props ?? {})) {
        const value = readPointer(row as JsonValue, pointer);
        if (!value.ok) mappingFailure = failure('template.value', 'A template property pointer is unavailable.');
        else props[property] = value.value;
      }
      let text = node.text;
      if (mapping?.text !== undefined) {
        const value = readPointer(row as JsonValue, mapping.text);
        if (!value.ok || typeof value.value !== 'string') mappingFailure = failure('template.value', 'A template text pointer must resolve to a string.');
        else text = value.value;
      }
      const bindings: Record<string, string> = {};
      for (const [property, pointer] of Object.entries(node.bindings ?? {})) {
        if (typeof pointer !== 'string' || pointer === '' || !parsePointer(pointer).ok) mappingFailure = failure('template.binding', 'Template bindings need safe non-root local pointers.');
        else bindings[property] = `${scope}${pointer}`;
      }
      return {
        ...node, id,
        ...(node.props || mapping?.props ? { props } : {}),
        ...(text !== undefined ? { text } : {}),
        ...(node.bindings ? { bindings } : {}),
        ...(node.children ? { children: node.children.map(materialize) } : {})
      };
    };
    const expanded = materialize(safe.root);
    if (mappingFailure) return mappingFailure;
    const checked = validateView({ version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: safe.id, revision: 0, root: expanded }, catalog, { limits });
    if (!checked.ok) return checked;
    const fingerprint = JSON.stringify(checked.value.root);
    usedBytes += encoder.encode(fingerprint).byteLength + (nodes.length ? 1 : 0);
    if (usedBytes > limits.maxBytes) return failure('limit.bytes', 'Expanded templates exceed the accumulated byte ceiling.');
    const retained = previousCache?.get(encoded);
    const node = retained?.fingerprint === fingerprint ? retained.node : checked.value.root;
    nodes.push(node);
    keys.push(key);
    recordIds(node);
    nextCache.set(encoded, { fingerprint, node });
  }
  // Bound the aggregate value count as well as each individual validated instance.
  const aggregate = snapshotJson(nodes, limits);
  if (!aggregate.ok) return aggregate;
  const removedNodeIds: string[] = [];
  const removed = (node: LyraGenNode): void => { if (!nodeIds.has(node.id)) removedNodeIds.push(node.id); node.children?.forEach(removed); };
  previous?.nodes.forEach(removed);
  const value: LyraGenTemplateExpansion = Object.freeze({ templateId: safe.id, keys: Object.freeze(keys), nodes: Object.freeze(nodes), removedNodeIds: Object.freeze(removedNodeIds) });
  cache.set(value, nextCache);
  return { ok: true, value, diagnostics: [] };
}

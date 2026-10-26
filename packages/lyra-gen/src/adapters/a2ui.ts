import { snapshotA2uiData } from './a2ui-state.js';
import type { A2uiDataValue } from './a2ui-state.js';
export type { A2uiDataValue, A2uiDataObject } from './a2ui-state.js';
import { resolveLimits, snapshotJson, validateSchema } from '../schema.js';
import type { JsonObject, JsonValue, LyraGenCatalog, LyraGenDiagnostic, LyraGenLimits, LyraGenNode, LyraGenResult, LyraGenSchema, LyraGenView } from '../types.js';

/** The stable schema revision accepts both historical wire-version spellings. */
export type A2uiWireVersion = 'v0.9' | 'v0.9.1';
export const A2UI_STABLE_REVISION = '409ded29ccac3eebc541979ae5320771703248e8';
export const A2UI_STABLE_SPECIFICATION = 'https://github.com/a2ui-project/a2ui/tree/409ded29ccac3eebc541979ae5320771703248e8/specification/v0_9_1';
export interface A2uiPropertyDefinition { readonly schema: LyraGenSchema; readonly dynamic?: boolean; readonly itemsDynamic?: boolean }
export interface A2uiResolvedNode {
  /** Opaque instance identity, stable only within one processor surface lifetime. */
  readonly id: string;
  readonly sourceComponentId: string;
  /** Absolute JSON Pointer for this template instance; empty at the root. */
  readonly scope: string;
  readonly component: string;
  readonly props: Readonly<Record<string, JsonValue>>;
  readonly children: readonly A2uiResolvedNode[];
  readonly bindings: Readonly<Record<string, string>>;
  readonly checkErrors: readonly string[];
  readonly action?: { readonly name: string; readonly payload: JsonObject };
  readonly localAction?: { readonly name: string };
}
export interface A2uiComponentDefinition {
  readonly properties: Readonly<Record<string, A2uiPropertyDefinition>>;
  readonly required?: readonly string[];
  readonly child?: string;
  readonly children?: string;
  readonly writable?: readonly string[];
  readonly action?: string;
  readonly checks?: boolean;
  /** Trusted application code; never supplied by an incoming protocol message. */
  readonly toNode: (node: A2uiResolvedNode, children: readonly LyraGenNode[]) => LyraGenNode;
}
export interface A2uiFunctionDefinition {
  readonly args: Readonly<Record<string, A2uiPropertyDefinition>>;
  readonly required?: readonly string[];
  readonly returnType: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'any' | 'void';
  /** Host effects are available only through executeLocalAction with explicit authorization. */
  readonly effect?: 'host';
  /** Pure, synchronous implementation; absent for a host effect. */
  readonly evaluate?: (args: Readonly<Record<string, A2uiDataValue>>) => JsonValue;
}
export interface A2uiCatalog {
  readonly id: string;
  readonly version: 'v0.9.1';
  readonly viewCatalog: { readonly id: string; readonly version: string };
  readonly components: Readonly<Record<string, A2uiComponentDefinition>>;
  readonly functions?: Readonly<Record<string, A2uiFunctionDefinition>>;
  readonly theme?: LyraGenSchema;
}
export interface A2uiSurface {
  readonly surfaceId: string;
  readonly ownerId: string;
  readonly catalogId: string;
  readonly version: A2uiWireVersion;
  readonly revision: number;
  readonly dataRevision: number;
  readonly data: A2uiDataValue;
  readonly components: Readonly<Record<string, JsonObject>>;
  readonly theme?: JsonValue;
  readonly sendDataModel: boolean;
}
export interface A2uiProcessContext { readonly ownerId: string; readonly expectedRevision?: number }
export interface A2uiActionEnvelope {
  readonly ownerId: string;
  readonly revision: number;
  readonly message: { readonly version: A2uiWireVersion; readonly action: { readonly name: string; readonly surfaceId: string; readonly sourceComponentId: string; readonly timestamp: string; readonly context: JsonObject } };
  /** Attach using the transport's metadata facility, exclusively to ownerId. */
  readonly dataModel?: { readonly version: A2uiWireVersion; readonly surfaces: Readonly<Record<string, JsonObject>> };
}
export interface A2uiLocalActionRequest {
  readonly surfaceId: string;
  readonly sourceComponentId: string;
  readonly instanceId: string;
  readonly ownerId: string;
  readonly revision: number;
  readonly name: string;
  readonly args: Readonly<Record<string, A2uiDataValue>>;
}
export interface A2uiLocalActionHost {
  /** A synchronous host policy. Only an explicit true permits execution. */
  readonly authorize: (request: A2uiLocalActionRequest) => boolean;
  /** Called only for effect:'host'; never called while processing or resolving a view. */
  readonly execute: (request: A2uiLocalActionRequest) => void | Promise<void>;
}
export interface A2uiLocalActionResult {
  readonly request: A2uiLocalActionRequest;
  readonly value?: JsonValue;
}
export interface A2uiProcessorOptions {
  readonly catalogs: readonly A2uiCatalog[];
  readonly limits?: Partial<LyraGenLimits>;
  readonly maxSurfaces?: number;
  readonly maxComponents?: number;
  readonly maxInstances?: number;
  /** Qualification is an explicit host assertion, never inferred from registration. */
  readonly qualifiedCatalogIds?: readonly string[];
}

class ProtocolError extends Error {
  constructor(readonly code: string, message: string, readonly path = '') { super(message); }
}
function fail(code: string, message: string, path = ''): never { throw new ProtocolError(code, message, path); }
function object(value: unknown): value is JsonObject { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function own(value: object, key: string): boolean { return Object.hasOwn(value, key); }
function record(value: unknown, path = ''): JsonObject { if (!object(value)) fail('a2ui-shape', 'Expected an object.', path); return value; }
function string(value: unknown, path = ''): string { if (typeof value !== 'string' || !value.length) fail('a2ui-shape', 'Expected a nonempty string.', path); return value; }
function fields(value: JsonObject, allowed: readonly string[], path = ''): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail('a2ui-unsupported-member', `Unsupported member ${key}.`, `${path}/${escapePointer(key)}`);
}
function escapePointer(value: string): string { return value.replaceAll('~', '~0').replaceAll('/', '~1'); }
function segments(path: string, scope = ''): string[] {
  if (path === '' || path === '/') return [];
  const absolute = path.startsWith('/') ? path : `${scope}/${path}`;
  return absolute.slice(1).split('/').map(part => {
    if (/~(?:[^01]|$)/u.test(part)) fail('a2ui-pointer', 'Invalid JSON Pointer escape.');
    const decoded = part.replaceAll('~1', '/').replaceAll('~0', '~');
    if (['__proto__', 'prototype', 'constructor'].includes(decoded)) fail('a2ui-pointer', 'Unsafe JSON Pointer segment.');
    return decoded;
  });
}
function pointer(parts: readonly string[]): string { return parts.length ? `/${parts.map(escapePointer).join('/')}` : ''; }
function arrayIndex(key: string, limit: number): number {
  if (!/^(?:0|[1-9][0-9]*)$/u.test(key)) fail('a2ui-pointer', 'An array path requires a canonical numeric index.');
  const index = Number(key);
  if (!Number.isSafeInteger(index) || index >= limit) fail('a2ui-limit', 'Array index exceeds the configured limit.');
  return index;
}
function read(data: A2uiDataValue, parts: readonly string[], limit: number): A2uiDataValue {
  let value: A2uiDataValue = data;
  for (const key of parts) {
    if (Array.isArray(value)) value = value[arrayIndex(key, limit)];
    else if (object(value)) value = own(value, key) ? value[key] : undefined;
    else return undefined;
  }
  return value;
}
function update(data: A2uiDataValue, parts: readonly string[], value: JsonValue | undefined, limit: number): A2uiDataValue {
  if (!parts.length) return value === undefined ? {} : structuredClone(value);
  if (value === undefined && read(data, parts, limit) === undefined) return structuredClone(data);
  const root = data == null ? {} : structuredClone(data);
  let current: A2uiDataValue = root;
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i]!;
    if (!object(current) && !Array.isArray(current)) fail('a2ui-pointer', 'Cannot traverse a scalar data value.');
    const target = current as Record<string, A2uiDataValue>;
    if (Array.isArray(current)) {
      arrayIndex(key, limit);
    }
    if (i === parts.length - 1) {
      if (value === undefined && !Array.isArray(current)) delete target[key];
      else if (value === undefined) target[key] = undefined;
      else target[key] = structuredClone(value);
    } else {
      if (!own(current, key) || target[key] == null) target[key] = /^(?:0|[1-9][0-9]*)$/u.test(parts[i + 1]!) ? [] : {};
      current = target[key]!;
    }
  }
  return root;
}
function outcome<T>(work: () => T): LyraGenResult<T> {
  try { return { ok: true, value: work(), diagnostics: [] }; }
  catch (error) {
    const failure = error instanceof ProtocolError ? error : new ProtocolError('a2ui-processing', 'The protocol operation failed.');
    return { ok: false, diagnostics: [{ code: failure.code, message: failure['message'], path: failure['path'], severity: 'error' }] };
  }
}
function checked(value: unknown, schema: LyraGenSchema, limits: LyraGenLimits, path: string): void {
  const result = validateSchema(value, schema, limits);
  if (!result.ok) fail('a2ui-schema', result.diagnostics[0]?.['message'] ?? 'Schema validation failed.', path);
}
function textValue(value: A2uiDataValue): string {
  return value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/** Independent, transactional processor for a deliberately declared v0.9.1 catalog profile. */
export class A2uiProcessor {
  private readonly surfaces = new Map<string, A2uiSurface>();
  private readonly lifetimes = new Map<string, number>();
  private lastRevision = -1;
  private nextInstance = 0;
  private readonly instanceIds = new WeakMap<A2uiSurface, ReadonlyMap<string, string>>();
  private readonly catalogs = new Map<string, A2uiCatalog>();
  private readonly limits: LyraGenLimits;
  private readonly maxSurfaces: number;
  private readonly maxComponents: number;
  private readonly maxInstances: number;
  readonly supportedCatalogIds: readonly string[];

  constructor(options: A2uiProcessorOptions) {
    this.limits = resolveLimits(options.limits);
    this.maxSurfaces = this.bound(options.maxSurfaces ?? 32);
    this.maxComponents = this.bound(options.maxComponents ?? 2000);
    this.maxInstances = this.bound(options.maxInstances ?? 5000);
    for (const catalog of options.catalogs) {
      if (catalog['version'] !== 'v0.9.1' || !catalog['id'] || this.catalogs.has(catalog['id'])) throw new TypeError('Catalog identities must be unique stable profiles.');
      for (const fn of Object.values(catalog.functions ?? {})) {
        if (fn.effect === 'host' ? fn.returnType !== 'void' || fn.evaluate !== undefined : typeof fn.evaluate !== 'function' || fn.returnType === 'void') throw new TypeError('Functions require either a pure implementation or an explicit void host effect.');
      }
      this.catalogs.set(catalog['id'], catalog);
    }
    const ids = [...new Set(options.qualifiedCatalogIds ?? [])].sort();
    if (ids.some(id => !this.catalogs.has(id))) throw new TypeError('Only registered catalogs may be advertised.');
    this.supportedCatalogIds = Object.freeze(ids);
  }
  private bound(value: number): number { if (!Number.isSafeInteger(value) || value < 1) throw new TypeError('Limits must be positive safe integers.'); return value; }
  private nextRevision(): number {
    if (this.lastRevision >= Number.MAX_SAFE_INTEGER) fail('a2ui-limit', 'The processor revision budget is exhausted.');
    return this.lastRevision + 1;
  }
  private commit(surface: A2uiSurface): void {
    this.lastRevision = surface.revision;
    this.surfaces.set(surface.surfaceId, surface);
  }
  private get(id: string): A2uiSurface { const surface = this.surfaces.get(id); if (!surface) fail('a2ui-unknown-surface', 'The surface has not been created.'); return surface; }
  private authorize(surface: A2uiSurface, context: A2uiProcessContext): void {
    if (context.ownerId !== surface.ownerId) fail('a2ui-owner', 'The surface belongs to another owner.');
    if (context.expectedRevision !== undefined && context.expectedRevision !== surface.revision) fail('a2ui-revision', 'The surface revision is stale.');
  }
  private snapshot(input: unknown): JsonValue {
    const result = snapshotJson(input, this.limits);
    if (!result.ok) fail('a2ui-json', result.diagnostics[0]?.['message'] ?? 'Invalid JSON value.');
    return result['value'];
  }
  private protocolSnapshot(input: A2uiDataValue): A2uiDataValue {
    const result = snapshotA2uiData(input, this.limits);
    if (!result.ok) fail('a2ui-data', result.diagnostics[0]?.message ?? 'Invalid protocol state.');
    return result.value.data;
  }
  private project(input: A2uiDataValue): JsonValue | undefined {
    const result = snapshotA2uiData(input, this.limits);
    if (!result.ok) fail('a2ui-data', result.diagnostics[0]?.message ?? 'Invalid protocol state.');
    return result.value.json;
  }
  getSurface(id: string): A2uiSurface | undefined { const surface = this.surfaces.get(id); return surface ? structuredClone(surface) : undefined; }
  get surfaceIds(): readonly string[] { return [...this.surfaces.keys()]; }

  process(input: unknown, context: A2uiProcessContext): LyraGenResult<A2uiSurface | { readonly deleted: string; readonly revision: number }> {
    return outcome(() => {
      string(context.ownerId);
      const message = record(this.snapshot(input));
      if (message['version'] !== 'v0.9' && message['version'] !== 'v0.9.1') fail('a2ui-version', 'Only the stable v0.9.1 schema profile is admitted.');
      const kinds = ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface'];
      const active = kinds.filter(kind => own(message, kind));
      if (active.length !== 1) fail('a2ui-envelope', 'Exactly one message operation is required.');
      const kind = active[0]!;
      fields(message, ['version', kind]);
      const body = record(message[kind], `/${kind}`);
      const id = string(body['surfaceId'], `/${kind}/surfaceId`);
      if (kind === 'createSurface') {
        fields(body, ['surfaceId', 'catalogId', 'theme', 'sendDataModel']);
        if (this.surfaces.has(id)) fail('a2ui-duplicate-surface', 'Delete an existing surface before recreating it.');
        if (context.expectedRevision !== undefined) fail('a2ui-revision', 'Creation does not accept an existing revision.');
        if (this.surfaces.size >= this.maxSurfaces) fail('a2ui-limit', 'Surface limit exceeded.');
        const catalogId = string(body['catalogId']);
        const catalog = this.catalogs.get(catalogId);
        if (!catalog) fail('a2ui-catalog', 'The requested catalog is not registered.');
        if (own(body, 'theme')) {
          if (!catalog['theme']) fail('a2ui-unsupported-theme', 'This catalog does not support theme parameters.');
          checked(body['theme'], catalog['theme'], this.limits, '/createSurface/theme');
        }
        if (own(body, 'sendDataModel') && typeof body['sendDataModel'] !== 'boolean') fail('a2ui-shape', 'sendDataModel must be boolean.');
        const surface: A2uiSurface = { surfaceId: id, ownerId: context.ownerId, catalogId, version: message['version'], revision: this.nextRevision(), dataRevision: 0, data: {}, components: {}, sendDataModel: body['sendDataModel'] === true, ...(own(body, 'theme') ? { theme: body['theme']! } : {}) };
        this.lifetimes.set(id, surface.revision);
        this.commit(surface);
        return structuredClone(surface);
      }
      const previous = this.get(id);
      this.authorize(previous, context);
      if (kind === 'deleteSurface') {
        fields(body, ['surfaceId']);
        const revision = this.nextRevision();
        this.surfaces.delete(id);
        this.lifetimes.delete(id);
        this.lastRevision = revision;
        return { deleted: id, revision };
      }
      let next: A2uiSurface;
      if (kind === 'updateComponents') {
        fields(body, ['surfaceId', 'components']);
        if (!Array.isArray(body['components']) || !body['components'].length) fail('a2ui-shape', 'A nonempty component array is required.');
        const components: Record<string, JsonObject> = { ...previous['components'] };
        const seen = new Set<string>();
        const catalog = this.catalogs.get(previous['catalogId'])!;
        for (const raw of body['components']) {
          const component = record(raw);
          const componentId = string(component['id']);
          if (['__proto__', 'prototype', 'constructor'].includes(componentId)) fail('a2ui-component-id', 'Unsafe component identity.');
          if (seen.has(componentId)) fail('a2ui-duplicate-component', 'A component ID occurs twice in one update.');
          seen.add(componentId);
          this.validateComponent(component, catalog);
          components[componentId] = component;
        }
        if (Object.keys(components).length > this.maxComponents) fail('a2ui-limit', 'Component limit exceeded.');
        this.validateGraph(components, catalog);
        next = { ...previous, revision: this.nextRevision(), components: this.snapshot(components) as Readonly<Record<string, JsonObject>> };
      } else {
        fields(body, ['surfaceId', 'path', 'value']);
        if (own(body, 'path') && typeof body['path'] !== 'string') fail('a2ui-pointer', 'The update path must be a string.');
        const path = typeof body['path'] === 'string' ? body['path'] : '/';
        if (path !== '' && !path.startsWith('/')) fail('a2ui-pointer', 'Server data updates require an absolute path.');
        const data = update(previous.data, segments(path), body['value'], this.limits.maxArrayLength);
        next = { ...previous, revision: this.nextRevision(), dataRevision: previous.dataRevision + 1, data: this.protocolSnapshot(data) };
      }
      // Resolve before commit: a bad function, binding or expansion cannot replace valid state.
      if (next.sendDataModel && !object(next.data)) fail('a2ui-data-model', 'State metadata requires an object at the data-model root.');
      this.resolve(next);
      this.commit(next);
      return structuredClone(next);
    });
  }

  private validateExpression(value: JsonValue, definition: A2uiPropertyDefinition, catalog: A2uiCatalog, depth = 0): void {
    if (depth > this.limits.maxDepth) fail('a2ui-limit', 'Expression nesting exceeds the limit.');
    if (definition.dynamic && object(value) && (own(value, 'path') || own(value, 'call')) && validateSchema(value, definition.schema, this.limits).ok) fail('a2ui-ambiguous-value', 'The value matches both a literal property and a dynamic expression.');
    if (definition.dynamic && object(value) && own(value, 'path')) { fields(value, ['path']); if (typeof value['path'] !== 'string') fail('a2ui-pointer', 'Binding path must be a string.'); segments(value['path']); return; }
    if (definition.dynamic && object(value) && own(value, 'call')) {
      const fn = this.validateFunction(value, catalog, depth + 1);
      if ('type' in definition.schema) {
        const expected = definition.schema.type === 'integer' ? 'number' : definition.schema.type;
        if (fn.returnType !== expected && fn.returnType !== 'any') fail('a2ui-function-type', 'The function result type does not match the property.');
      }
      return;
    }
    if (definition.itemsDynamic && Array.isArray(value) && 'type' in definition.schema && definition.schema.type === 'array') {
      if (value.length > (definition.schema.maxItems ?? this.limits.maxArrayLength) || value.length < (definition.schema.minItems ?? 0)) fail('a2ui-schema', 'Array length is outside the declared range.');
      for (const item of value) this.validateExpression(item, { schema: definition.schema.items, dynamic: true }, catalog, depth + 1);
      return;
    }
    checked(value, definition.schema, this.limits, '');
  }
  private validateFunction(value: JsonObject, catalog: A2uiCatalog, depth: number, allowEffect = false): A2uiFunctionDefinition {
    fields(value, ['call', 'args', 'returnType']);
    const name = string(value['call']);
    const fn = catalog.functions && own(catalog.functions, name) ? catalog.functions[name] : undefined;
    if (!fn) fail('a2ui-unsupported-function', `Function ${name} is not admitted by this catalog.`);
    if (fn.effect === 'host' && !allowEffect) fail('a2ui-function-effect', 'A host effect is permitted only as an authorized local action.');
    if (own(value, 'returnType') && value['returnType'] !== fn['returnType']) fail('a2ui-function-type', 'Function returnType disagrees with the catalog.');
    const args = record(value['args'] ?? {});
    fields(args, Object.keys(fn['args']));
    for (const key of fn.required ?? []) if (!own(args, key)) fail('a2ui-function-argument', `Missing function argument ${key}.`);
    for (const [key, arg] of Object.entries(args)) this.validateExpression(arg, fn['args'][key]!, catalog, depth + 1);
    return fn;
  }
  private validateComponent(component: JsonObject, catalog: A2uiCatalog): void {
    const type = string(component['component']);
    const definition = own(catalog['components'], type) ? catalog['components'][type] : undefined;
    if (!definition) fail('a2ui-unsupported-component', `Component ${type} is not admitted by this catalog.`);
    const allowed = ['id', 'component', ...Object.keys(definition.properties)];
    if (definition.child) allowed.push(definition.child);
    if (definition.children) allowed.push(definition.children);
    if (definition.action) allowed.push(definition.action);
    if (definition['checks']) allowed.push('checks');
    fields(component, allowed);
    for (const key of definition.required ?? []) if (!own(component, key)) fail('a2ui-required', `Missing component property ${key}.`);
    for (const [key, rule] of Object.entries(definition.properties)) if (own(component, key)) this.validateExpression(component[key]!, rule, catalog);
    if (definition.child && own(component, definition.child)) string(component[definition.child]);
    if (definition.children && own(component, definition.children)) {
      const children = component[definition.children];
      if (Array.isArray(children)) {
        children.forEach(child => string(child));
        if (new Set(children).size !== children.length) fail('a2ui-duplicate-child', 'A child ID occurs twice in one list.');
      } else {
        const template = record(children);
        fields(template, ['componentId', 'path']); string(template['componentId']);
        if (typeof template['path'] !== 'string') fail('a2ui-pointer', 'A template path is required.');
        segments(template['path']);
      }
    }
    if (definition.action && own(component, definition.action)) {
      const action = record(component[definition.action]);
      if (own(action, 'functionCall')) {
        fields(action, ['functionCall']);
        this.validateFunction(record(action['functionCall']), catalog, 0, true);
      } else {
        fields(action, ['event']);
        const event = record(action['event']); fields(event, ['name', 'context']); string(event['name']);
        const context = record(event['context'] ?? {});
        for (const value of Object.values(context)) this.validateContext(value, catalog);
      }
    }
    if (own(component, 'checks')) {
      if (!Array.isArray(component['checks'])) fail('a2ui-checks', 'Checks must be an array.');
      for (const raw of component['checks']) {
        const check = record(raw); fields(check, ['condition', 'message']);
        if (typeof check['message'] !== 'string') fail('a2ui-checks', 'A check requires a message.');
        if (!own(check, 'condition')) fail('a2ui-checks', 'A check requires a condition.');
        this.validateExpression(check['condition']!, { schema: { type: 'boolean' }, dynamic: true }, catalog);
      }
    }
  }
  private validateContext(value: JsonValue, catalog: A2uiCatalog): void {
    if (object(value)) {
      if (own(value, 'path')) { fields(value, ['path']); if (typeof value['path'] !== 'string') fail('a2ui-pointer', 'Binding path must be a string.'); segments(value['path']); }
      else if (own(value, 'call')) this.validateFunction(value, catalog, 0);
      else fail('a2ui-action-context', 'Action context accepts primitives, arrays, bindings and functions.');
    } else if (value === null) fail('a2ui-action-context', 'Null is not a stable DynamicValue literal.');
  }
  private references(component: JsonObject, catalog: A2uiCatalog): string[] {
    const def = catalog['components'][String(component['component'])]!;
    const refs: string[] = [];
    if (def.child && typeof component[def.child] === 'string') refs.push(component[def.child] as string);
    const children = def.children ? component[def.children] : undefined;
    if (Array.isArray(children)) refs.push(...children as string[]);
    else if (object(children)) refs.push(children['componentId'] as string);
    return refs;
  }
  private validateGraph(components: Readonly<Record<string, JsonObject>>, catalog: A2uiCatalog): void {
    const done = new Set<string>(); const active = new Set<string>();
    const visit = (id: string, depth: number): void => {
      if (depth > this.limits.maxDepth) fail('a2ui-limit', 'Component nesting exceeds the limit.');
      if (active.has(id)) fail('a2ui-cycle', 'Component references form a cycle.');
      if (done.has(id) || !own(components, id)) return;
      active.add(id);
      for (const child of this.references(components[id]!, catalog)) visit(child, depth + 1);
      active.delete(id); done.add(id);
    };
    Object.keys(components).forEach(id => visit(id, 0));
  }
  private evaluateProperty(value: JsonValue, rule: A2uiPropertyDefinition, surface: A2uiSurface, scope: string, depth = 0): A2uiDataValue {
    if (rule.itemsDynamic && Array.isArray(value) && 'type' in rule.schema && rule.schema.type === 'array') {
      const items: A2uiDataValue[] = [];
      for (const item of value) {
        const result = this.evaluateProperty(item, { schema: rule.schema.items, dynamic: true }, surface, scope, depth + 1);
        if (result === undefined) return undefined;
        items.push(result);
      }
      return items;
    }
    return rule.dynamic ? this.evaluate(value, surface, scope, depth) : value;
  }
  private evaluate(value: JsonValue, surface: A2uiSurface, scope: string, depth = 0): A2uiDataValue {
    if (depth > this.limits.maxDepth) fail('a2ui-limit', 'Expression nesting exceeds the limit.');
    if (!object(value)) return value;
    if (own(value, 'path')) return read(surface.data, segments(value['path'] as string, scope), this.limits.maxArrayLength);
    if (!own(value, 'call')) return value;
    const catalog = this.catalogs.get(surface['catalogId'])!;
    const fn = catalog.functions?.[String(value['call'])];
    if (!fn) fail('a2ui-unsupported-function', 'Function is not admitted.');
    if (fn.effect === 'host' || !fn.evaluate) fail('a2ui-function-effect', 'Host effects cannot execute while resolving expressions.');
    const args = this.functionArguments(value, fn, surface, scope, depth);
    const result = this.snapshot(fn.evaluate(args));
    if (fn['returnType'] !== 'any' && (fn['returnType'] === 'array' ? !Array.isArray(result) : fn['returnType'] === 'object' ? !object(result) : typeof result !== fn['returnType'])) fail('a2ui-function-type', 'Function returned a value of the wrong type.');
    return result;
  }
  private functionArguments(value: JsonObject, fn: A2uiFunctionDefinition, surface: A2uiSurface, scope: string, depth = 0): Record<string, A2uiDataValue> {
    const args: Record<string, A2uiDataValue> = {};
    for (const [key, arg] of Object.entries(record(value['args'] ?? {}))) {
      const rule = fn['args'][key]!;
      args[key] = this.evaluateProperty(arg, rule, surface, scope, depth + 1);
      if (args[key] !== undefined) checked(this.project(args[key]), rule.schema, this.limits, `/args/${escapePointer(key)}`);
    }
    return args;
  }
  private resolve(surface: A2uiSurface): { root?: A2uiResolvedNode; diagnostics: LyraGenDiagnostic[] } {
    const diagnostics: LyraGenDiagnostic[] = []; const catalog = this.catalogs.get(surface['catalogId'])!;
    const committed = this.surfaces.get(surface.surfaceId);
    const previousIds = this.instanceIds.get(surface) ?? (committed ? this.instanceIds.get(committed) : undefined);
    const identities = new Map<string, string>();
    const instanceId = (scope: string, lineage: readonly string[]): string => {
      const key = JSON.stringify([scope, lineage]);
      let value = identities.get(key) ?? previousIds?.get(key);
      if (!value) {
        if (!Number.isSafeInteger(this.nextInstance)) fail('a2ui-limit', 'The processor instance budget is exhausted.');
        value = `a2ui:${this.lifetimes.get(surface.surfaceId)}:${this.nextInstance++}`;
      }
      identities.set(key, value);
      return value;
    };
    let count = 0;
    const visit = (id: string, scope: string, ancestry: readonly string[]): A2uiResolvedNode | undefined => {
      if (++count > this.maxInstances || ancestry.length > this.limits.maxDepth) fail('a2ui-limit', 'Expanded component limit exceeded.');
      const raw = own(surface['components'], id) ? surface['components'][id] : undefined;
      if (!raw) {
        if (diagnostics.length < this.limits.maxDiagnostics) diagnostics.push({ code: 'a2ui-pending-component', message: 'A referenced component has not arrived yet.', path: `/components/${escapePointer(id)}`, severity: 'warning' });
        return undefined;
      }
      const definition = catalog['components'][String(raw['component'])]!;
      const props: Record<string, JsonValue> = {}; const bindings: Record<string, string> = {};
      for (const [key, rule] of Object.entries(definition.properties)) {
        if (!own(raw, key)) continue;
        let value = this.evaluateProperty(raw[key]!, rule, surface, scope);
        if (rule.dynamic && 'type' in rule.schema && rule.schema.type === 'string') value = textValue(value);
        if (value !== undefined) { const json = this.project(value)!; checked(json, rule.schema, this.limits, `/components/${escapePointer(id)}/${escapePointer(key)}`); props[key] = json; }
        if (definition.writable?.includes(key) && object(raw[key]) && own(raw[key], 'path')) bindings[key] = pointer(segments(raw[key]['path'] as string, scope));
      }
      const checkErrors: string[] = [];
      for (const entry of (raw['checks'] ?? []) as readonly JsonValue[]) {
        const check = record(entry); const valid = this.evaluate(check['condition']!, surface, scope);
        if (valid !== undefined && typeof valid !== 'boolean') fail('a2ui-checks', 'A check did not return boolean.');
        if (valid !== true) checkErrors.push(check['message'] as string);
      }
      const lineage = [...ancestry, id]; const children: A2uiResolvedNode[] = [];
      const append = (childId: string, childScope: string): void => { const child = visit(childId, childScope, lineage); if (child) children.push(child); };
      if (definition.child && typeof raw[definition.child] === 'string') append(raw[definition.child] as string, scope);
      const list = definition.children ? raw[definition.children] : undefined;
      if (Array.isArray(list)) for (const child of list) append(child as string, scope);
      else if (object(list)) {
        const path = segments(list['path'] as string, scope); const values = read(surface.data, path, this.limits.maxArrayLength);
        if (values !== undefined && !Array.isArray(values)) fail('a2ui-template', 'A template binding must resolve to an array.');
        if (Array.isArray(values)) values.forEach((_, index) => append(list['componentId'] as string, pointer([...path, String(index)])));
      }
      let action: A2uiResolvedNode['action']; let localAction: A2uiResolvedNode['localAction'];
      if (definition.action && object(raw[definition.action])) {
        const rawAction = record(raw[definition.action]);
        if (own(rawAction, 'functionCall')) localAction = { name: string(record(rawAction['functionCall'])['call']) };
        else {
          const event = record(rawAction['event']); const payload: Record<string, JsonValue> = {};
          for (const [key, value] of Object.entries(record(event['context'] ?? {}))) {
            const resolved = this.project(this.evaluate(value, surface, scope));
            // Missing paths remain pending; dispatch rejects rather than dropping context members.
            if (resolved !== undefined) payload[key] = resolved;
          }
          action = { name: event['name'] as string, payload };
        }
      }
      return { id: instanceId(scope, lineage), sourceComponentId: id, scope, component: raw['component'] as string, props, children, bindings, checkErrors, ...(action ? { action } : {}), ...(localAction ? { localAction } : {}) };
    };
    const root = visit('root', '', []);
    this.instanceIds.set(surface, identities);
    return { ...(root ? { root } : {}), diagnostics };
  }
  resolveSurface(id: string): LyraGenResult<{ readonly surface: A2uiSurface; readonly root?: A2uiResolvedNode }> {
    const result = outcome(() => { const surface = this.get(id); return { surface: structuredClone(surface), ...this.resolve(surface) }; });
    return result.ok ? { ok: true, value: { surface: result['value'].surface, ...(result['value'].root ? { root: result['value'].root } : {}) }, diagnostics: result['value'].diagnostics } : result;
  }
  toView(id: string): LyraGenResult<LyraGenView> {
    const result = outcome(() => {
      const surface = this.get(id); const catalog = this.catalogs.get(surface['catalogId'])!; const resolved = this.resolve(surface);
      if (!resolved.root) fail('a2ui-pending-root', 'The root component has not arrived yet.');
      const convert = (node: A2uiResolvedNode): LyraGenNode => catalog['components'][node['component']]!.toNode(node, node.children.map(convert));
      const view: LyraGenView = { version: '1', catalog: catalog.viewCatalog, surfaceId: surface['surfaceId'], revision: surface.revision, root: convert(resolved.root) };
      return { view, diagnostics: resolved.diagnostics };
    });
    return result.ok ? { ok: true, value: result.value.view, diagnostics: result.value.diagnostics } : result;
  }
  private instance(surface: A2uiSurface, instanceId: string): A2uiResolvedNode {
    const root = this.resolve(surface).root;
    const find = (node: A2uiResolvedNode): A2uiResolvedNode | undefined => node['id'] === instanceId ? node : node.children.map(find).find(Boolean);
    const node = root ? find(root) : undefined;
    if (!node) fail('a2ui-instance', 'The rendered component instance no longer exists.');
    return node;
  }
  writeBinding(surfaceId: string, instanceId: string, property: string, value: unknown, context: A2uiProcessContext & { readonly expectedRevision: number }): LyraGenResult<A2uiSurface> {
    return outcome(() => {
      const previous = this.get(surfaceId);
      if (!Number.isSafeInteger(context.expectedRevision) || context.expectedRevision < 0) fail('a2ui-revision', 'A current expected revision is required.');
      this.authorize(previous, context);
      const node = this.instance(previous, instanceId);
      if (!own(node.bindings, property)) fail('a2ui-binding', 'The property has no writable binding.');
      const rule = this.catalogs.get(previous['catalogId'])!['components'][node['component']]!.properties[property]!;
      const json = this.snapshot(value); checked(json, rule.schema, this.limits, '');
      const data = this.protocolSnapshot(update(previous.data, segments(node.bindings[property]!), json, this.limits.maxArrayLength));
      const next = { ...previous, data, revision: this.nextRevision(), dataRevision: previous.dataRevision + 1 };
      if (next.sendDataModel && !object(next.data)) fail('a2ui-data-model', 'State metadata requires an object at the data-model root.');
      this.resolve(next); this.commit(next); return structuredClone(next);
    });
  }
  async executeLocalAction(surfaceId: string, instanceId: string, context: A2uiProcessContext & { readonly expectedRevision: number }, host: A2uiLocalActionHost): Promise<LyraGenResult<A2uiLocalActionResult>> {
    const prepared = outcome(() => {
      const surface = this.get(surfaceId);
      if (!Number.isSafeInteger(context.expectedRevision) || context.expectedRevision < 0) fail('a2ui-revision', 'A current expected revision is required.');
      this.authorize(surface, context);
      const node = this.instance(surface, instanceId);
      if (!node.localAction || node.checkErrors.length) fail('a2ui-action', 'The component has no enabled local action.');
      const catalog = this.catalogs.get(surface.catalogId)!; const definition = catalog.components[node.component]!;
      const call = record(record(surface.components[node.sourceComponentId]![definition.action!])['functionCall']);
      const fn = this.validateFunction(call, catalog, 0, true);
      const args = this.functionArguments(call, fn, surface, node.scope);
      if (Object.values(args).some(value => value === undefined)) fail('a2ui-pending-binding', 'A local action argument has not arrived yet.');
      const ownedArgs = this.protocolSnapshot(args) as Readonly<Record<string, A2uiDataValue>>;
      const request = Object.freeze({ surfaceId, sourceComponentId: node.sourceComponentId, instanceId, ownerId: surface.ownerId, revision: surface.revision, name: node.localAction.name, args: ownedArgs });
      if (host.authorize(request) !== true) fail('a2ui-action-denied', 'The host did not authorize this local action.');
      // Host policy is application code and may synchronously change the surface.
      if (this.get(surfaceId) !== surface) fail('a2ui-revision', 'The surface changed during local action authorization.');
      return { request, call, fn, surface, scope: node.scope };
    });
    if (!prepared.ok) return prepared;
    const { request, call, fn, surface, scope } = prepared.value;
    try {
      if (fn.effect === 'host') {
        await host.execute(request);
        return { ok: true, value: { request }, diagnostics: [] };
      }
      const value = this.project(this.evaluate(call, surface, scope));
      return { ok: true, value: { request, ...(value !== undefined ? { value } : {}) }, diagnostics: [] };
    } catch {
      return { ok: false, diagnostics: [{ code: 'a2ui-action-execution', path: '', message: 'The authorized local action failed.', severity: 'error' }] };
    }
  }
  createAction(surfaceId: string, instanceId: string, context: A2uiProcessContext & { readonly expectedRevision: number }, timestamp = new Date().toISOString()): LyraGenResult<A2uiActionEnvelope> {
    return outcome(() => {
      const surface = this.get(surfaceId);
      if (!Number.isSafeInteger(context.expectedRevision) || context.expectedRevision < 0) fail('a2ui-revision', 'A current expected revision is required.');
      this.authorize(surface, context);
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(timestamp) || !Number.isFinite(Date.parse(timestamp))) fail('a2ui-timestamp', 'A valid ISO 8601 timestamp is required.');
      const node = this.instance(surface, instanceId);
      if (!node.action || node.checkErrors.length) fail('a2ui-action', 'The component has no enabled event action.');
      const def = this.catalogs.get(surface['catalogId'])!['components'][node['component']]!;
      const event = record(record(surface['components'][node.sourceComponentId]![def.action!])['event']);
      if (Object.keys(record(event['context'] ?? {})).length !== Object.keys(node.action.payload).length) fail('a2ui-pending-binding', 'An action context binding has not arrived yet.');
      return { ownerId: surface.ownerId, revision: surface.revision, message: { version: surface['version'], action: { name: node.action['name'], surfaceId, sourceComponentId: node.sourceComponentId, timestamp, context: node.action.payload } }, ...(surface['sendDataModel'] ? { dataModel: { version: surface.version, surfaces: { [surfaceId]: this.project(surface.data) as JsonObject } } } : {}) };
    });
  }
}

/** Build a Lyra-owned wire catalog from a reviewed view catalog; this is not the basic catalog. */
export function createA2uiCatalog(catalog: LyraGenCatalog, id = `https://github.com/aceshooting/lyra-ui/a2ui/v0.9.1/${encodeURIComponent(catalog['id'])}/${encodeURIComponent(catalog['version'])}`): A2uiCatalog {
  const components: Record<string, A2uiComponentDefinition> = {};
  for (const [name, definition] of Object.entries(catalog['components'])) {
    const properties: Record<string, A2uiPropertyDefinition> = {};
    for (const [key, schema] of Object.entries(definition.properties)) properties[key] = { schema, dynamic: true };
    if (definition['text']) properties['text'] = { schema: { type: 'string' }, dynamic: true };
    const reserved = ['id', 'component', 'children', 'action', 'checks'];
    if (Object.keys(properties).some(key => reserved.includes(key))) throw new TypeError('A catalog property collides with the protocol vocabulary.');
    components[name] = {
      properties, ...(definition.required ? { required: definition.required } : {}),
      ...(definition.children ? { children: 'children' } : {}),
      ...(definition.events?.length ? { action: 'action' } : {}),
      writable: Object.keys(definition.bindings ?? {}),
      toNode(node, children) {
        if (node.localAction) fail('a2ui-local-action-renderer', 'A host converter must connect local actions to an authorized dispatcher.');
        const props = { ...node.props }; const text = definition['text'] ? props['text'] : undefined;
        if (definition['text']) delete props['text'];
        return { id: node['id'], type: name, props, ...(children.length ? { children } : {}), ...(typeof text === 'string' ? { text } : {}), ...(Object.keys(node.bindings).length ? { bindings: node.bindings } : {}), ...(node.action ? { action: node.action } : {}) };
      }
    };
  }
  return { id, version: 'v0.9.1', viewCatalog: { id: catalog['id'], version: catalog['version'] }, components };
}

/** Transport-neutral payload matching the stable client-capabilities schema. */
export function a2uiClientCapabilities(processor: A2uiProcessor): { readonly 'v0.9': { readonly supportedCatalogIds: readonly string[] } } {
  return { 'v0.9': { supportedCatalogIds: [...processor.supportedCatalogIds] } };
}

/** A catalog document for a pinned v0.9.1 schema consumer, with its own Lyra identity. */
export function exportA2uiCatalog(catalog: A2uiCatalog): JsonObject {
  const common = 'https://a2ui.org/specification/v0_9/common_types.json#/$defs/';
  const dynamic = (rule: A2uiPropertyDefinition): JsonValue => {
    const literal = rule.itemsDynamic && 'type' in rule.schema && rule.schema.type === 'array'
      ? { ...rule.schema, items: dynamic({ schema: rule.schema.items, dynamic: true }) } as unknown as JsonValue
      : rule.schema as unknown as JsonValue;
    return rule.dynamic ? { oneOf: [literal, { $ref: `${common}DataBinding` }, { $ref: `${common}FunctionCall` }] } : literal;
  };
  const components: Record<string, JsonValue> = {};
  for (const [name, definition] of Object.entries(catalog['components'])) {
    const properties: Record<string, JsonValue> = { id: { type: 'string' }, component: { const: name } };
    for (const [key, rule] of Object.entries(definition.properties)) properties[key] = dynamic(rule);
    if (definition.child) properties[definition.child] = { $ref: `${common}ComponentId` };
    if (definition.children) properties[definition.children] = { $ref: `${common}ChildList` };
    if (definition.action) properties[definition.action] = { oneOf: [{ type: 'object', properties: { event: { type: 'object', properties: { name: { type: 'string' }, context: { type: 'object', additionalProperties: { $ref: `${common}DynamicValue` } } }, required: ['name'], additionalProperties: false } }, required: ['event'], additionalProperties: false }, { type: 'object', properties: { functionCall: { $ref: `${common}FunctionCall` } }, required: ['functionCall'], additionalProperties: false }] };
    if (definition['checks']) properties['checks'] = { type: 'array', items: { $ref: `${common}CheckRule` } };
    components[name] = { type: 'object', properties, required: ['id', 'component', ...(definition.required ?? [])], additionalProperties: false };
  }
  const functions: Record<string, JsonValue> = {};
  for (const [name, definition] of Object.entries(catalog.functions ?? {})) {
    const args: Record<string, JsonValue> = {};
    for (const [key, rule] of Object.entries(definition['args'])) args[key] = dynamic(rule);
    functions[name] = { type: 'object', properties: { call: { const: name }, args: { type: 'object', properties: args, required: [...(definition.required ?? [])], additionalProperties: false }, returnType: { const: definition['returnType'] } }, required: ['call'], additionalProperties: false };
  }
  return { $schema: 'https://json-schema.org/draft/2020-12/schema', $id: catalog['id'], catalogId: catalog['id'], components, functions, $defs: { anyComponent: { oneOf: Object.keys(components).map(name => ({ $ref: `#/components/${escapePointer(name)}` })) }, anyFunction: Object.keys(functions).length ? { oneOf: Object.keys(functions).map(name => ({ $ref: `#/functions/${escapePointer(name)}` })) } : { not: {} }, theme: catalog['theme'] ? catalog['theme'] as unknown as JsonValue : { not: {} } } };
}

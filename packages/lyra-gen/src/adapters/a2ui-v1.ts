import { validateView } from '../runtime.js';
import { resolveLimits, snapshotJson, validateSchema } from '../schema.js';
import type {
  JsonObject, JsonValue, LyraGenCatalog, LyraGenCatalogReference, LyraGenDiagnostic, LyraGenLimits, LyraGenNode,
  LyraGenSchema, LyraGenValidationResult, LyraGenView,
} from '../types.js';
import { A2UI_CANDIDATE_IDENTIFIER, a2uiCandidateComponentNames } from './a2ui-v1-names.js';

/**
 * Declared candidate processor profile. Its wire shapes follow the published v1.0 specification
 * page; it is opt-in, separate from the stable v0.9.1 processor and never stable conformance.
 */
export const A2UI_V1_PROFILE = Object.freeze({
  version: '1.0',
  specification: 'https://a2ui.org/specification/v1.0-a2ui/',
  catalogs: 'https://a2ui.org/concepts/catalogs/',
  reviewed: '2026-11-24',
  /** Qualification is never inferred from registration; this cohort advertises nothing. */
  supportedCatalogIds: Object.freeze([] as string[]),
});

/** The error codes this profile emits; each names a code the v1.0 specification defines. */
export type A2uiV1ErrorCode = 'VALIDATION_FAILED' | 'UNALLOWED_PARENT' | 'UNALLOWED_CHILD' | 'INTEGRITY_ERROR' | 'INVALID_FUNCTION_CALL';
export interface A2uiV1Error {
  readonly code: A2uiV1ErrorCode;
  /** Short model-facing description; never contains data-model values. */
  readonly message: string;
  /** Present for surface errors; mutually exclusive with `functionCallId`. */
  readonly surfaceId?: string;
  /** JSON Pointer to the failing member of the offending message (validation codes). */
  readonly path?: string;
  readonly functionCallId?: string;
}
/** A renderer-to-agent `error` message a host can return to the model unchanged. */
export interface A2uiV1ErrorMessage { readonly version: '1.0'; readonly error: A2uiV1Error }

export interface A2uiV1PropertyDefinition { readonly schema: LyraGenSchema; readonly dynamic: boolean }
export interface A2uiV1ComponentDefinition {
  /** The lyra-gen view role this wire component produces. */
  readonly role: string;
  readonly properties: Readonly<Record<string, A2uiV1PropertyDefinition>>;
  readonly required: readonly string[];
  readonly text: boolean;
  readonly children: boolean;
  readonly action: boolean;
  /** Wire component names (or `Surface`); absent allows every parent. */
  readonly allowedParents?: readonly string[];
  /** Wire component names; absent allows every child. */
  readonly allowedChildren?: readonly string[];
  /** Property that receives `@accessibility.label`; absent rejects that label. */
  readonly accessibleNameProperty?: string;
}
export interface A2uiV1Catalog {
  readonly catalogId: string;
  readonly protocolVersion: '1.0';
  readonly viewCatalog: LyraGenCatalogReference;
  readonly components: Readonly<Record<string, A2uiV1ComponentDefinition>>;
}
export interface A2uiV1CatalogOptions {
  readonly catalogId?: string;
  /** View roles this wire catalog exposes; defaults to every role. */
  readonly roles?: readonly string[];
  /** Host-declared nesting rules by view role; values are view roles or `Surface`. */
  readonly allowedParents?: Readonly<Record<string, readonly string[]>>;
}
export interface A2uiV1Surface {
  readonly surfaceId: string;
  readonly ownerId: string;
  readonly catalogId?: string;
  readonly revision: number;
  readonly dataRevision: number;
  readonly data: JsonObject;
  readonly components: Readonly<Record<string, JsonObject>>;
  readonly sendDataModel: boolean;
  readonly metadata?: JsonObject;
}
export interface A2uiV1ProcessContext { readonly ownerId: string; readonly expectedRevision?: number }
export type A2uiV1ProcessResult =
  | { readonly ok: true; readonly value: A2uiV1Surface | { readonly deleted: string; readonly revision: number }; readonly diagnostics: readonly LyraGenDiagnostic[] }
  | { readonly ok: false; readonly error: A2uiV1ErrorMessage; readonly diagnostics: readonly LyraGenDiagnostic[] };
export type A2uiV1ViewResult = LyraGenValidationResult & { readonly error?: A2uiV1ErrorMessage };
export interface A2uiV1ProcessorOptions {
  /** The admission catalog every produced view is validated against. */
  readonly viewCatalog: LyraGenCatalog;
  /** The only catalogs a surface or component may name. */
  readonly catalogs: readonly A2uiV1Catalog[];
  readonly limits?: Partial<LyraGenLimits>;
  readonly maxSurfaces?: number;
  readonly maxComponents?: number;
  readonly maxInstances?: number;
  /** Surface identities stay reserved for the processor lifetime, up to this many. */
  readonly maxSurfaceLifetimes?: number;
}

const VERSION = '1.0';
const SURFACE = 'Surface';
const UNSAFE = ['__proto__', 'prototype', 'constructor'];
const VIEW_IDENTITY = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u;
const OPERATIONS = ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface', 'callRendererFunction', 'agentFunctionResponse'] as const;

interface FailureContext { readonly surfaceId?: string; readonly functionCallId?: string }
class V1Failure extends Error {
  constructor(readonly code: A2uiV1ErrorCode, message: string, readonly path?: string, readonly context: FailureContext = {}) { super(message); }
}
/** A failure raised while resolving, attributed to a source component. */
class ResolveFailure extends Error {
  constructor(readonly componentId: string, readonly member: string, message: string) { super(message); }
}
function fail(code: A2uiV1ErrorCode, message: string, path?: string, context?: FailureContext): never { throw new V1Failure(code, message, path, context); }
function invalid(message: string, path: string): never { return fail('VALIDATION_FAILED', message, path); }
function object(value: unknown): value is JsonObject { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function own(value: object, key: string): boolean { return Object.hasOwn(value, key); }
function escape(segment: string): string { return segment.replaceAll('~', '~0').replaceAll('/', '~1'); }
function join(path: string, key: string | number): string { return `${path}/${escape(String(key))}`; }
function record(value: unknown, path: string): JsonObject { if (!object(value)) invalid('Expected an object.', path); return value; }
function text(value: unknown, path: string): string { if (typeof value !== 'string' || !value.length) invalid('Expected a nonempty string.', path); return value; }
function members(value: JsonObject, allowed: readonly string[], path: string): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) invalid(`Member ${key} is outside this profile.`, join(path, key));
}
function pointerSegments(path: string, scope: string, at: string): string[] {
  if (path === '' || path === '/') return scope ? pointerSegments(scope, '', at) : [];
  const absolute = path.startsWith('/') ? path : `${scope}/${path}`;
  return absolute.slice(1).split('/').map(part => {
    if (/~(?:[^01]|$)/u.test(part)) invalid('Invalid JSON Pointer escape.', at);
    const decoded = part.replaceAll('~1', '/').replaceAll('~0', '~');
    if (UNSAFE.includes(decoded)) invalid('Unsafe JSON Pointer segment.', at);
    return decoded;
  });
}
function pointer(parts: readonly string[]): string { return parts.length ? `/${parts.map(escape).join('/')}` : ''; }
const INDEX = /^(?:0|[1-9][0-9]*)$/u;
function read(data: JsonValue | undefined, parts: readonly string[]): JsonValue | undefined {
  let value = data;
  for (const key of parts) {
    if (Array.isArray(value)) value = INDEX.test(key) ? value[Number(key)] : undefined;
    else if (object(value)) value = own(value, key) ? value[key] : undefined;
    else return undefined;
  }
  return value;
}
/** Bindings distinguish themselves from literals by their sole `@path` member. */
function binding(value: JsonValue): value is { readonly '@path': string } & JsonObject { return object(value) && own(value, '@path'); }

/** Build a candidate wire catalog from a reviewed view catalog; this is not the basic catalog. */
export function createA2uiV1Catalog(catalog: LyraGenCatalog, options: A2uiV1CatalogOptions = {}): A2uiV1Catalog {
  const names = a2uiCandidateComponentNames(catalog);
  const roles = options.roles ?? Object.keys(catalog.components);
  const wire = (role: string): string => {
    if (role === SURFACE) return SURFACE;
    const name = names.get(role);
    if (!name) throw new TypeError(`Unknown role ${role}.`);
    return name;
  };
  for (const role of Object.keys(options.allowedParents ?? {})) wire(role);
  const components: Record<string, A2uiV1ComponentDefinition> = Object.create(null) as Record<string, A2uiV1ComponentDefinition>;
  for (const role of new Set(roles)) {
    const definition = Object.hasOwn(catalog.components, role) ? catalog.components[role] : undefined;
    if (!definition) throw new TypeError(`Unknown role ${role}.`);
    const properties: Record<string, A2uiV1PropertyDefinition> = Object.create(null) as Record<string, A2uiV1PropertyDefinition>;
    for (const [key, schema] of Object.entries(definition.properties)) {
      if (!A2UI_CANDIDATE_IDENTIFIER.test(key)) throw new TypeError('Invalid candidate property identifier.');
      if (['id', 'component', 'children', 'action', 'text'].includes(key)) throw new TypeError('A catalog property collides with the protocol vocabulary.');
      // URL sinks stay literal so a data update cannot retarget reviewed media.
      properties[key] = { schema, dynamic: !Object.hasOwn(definition.urlSinks ?? {}, key) };
    }
    const parents = Object.hasOwn(options.allowedParents ?? {}, role) ? options.allowedParents![role]! : undefined;
    const nameProperty = definition.accessibleName?.properties?.find(key => Object.hasOwn(definition.properties, key));
    components[wire(role)] = {
      role, properties, required: [...(definition.required ?? [])], text: definition.text === true,
      children: Boolean(definition.children), action: Boolean(definition.events?.length),
      ...(parents ? { allowedParents: [...new Set(parents.map(wire))] } : {}),
      ...(Array.isArray(definition.children) ? { allowedChildren: definition.children.map(wire) } : !definition.children ? { allowedChildren: [] } : {}),
      ...(nameProperty ? { accessibleNameProperty: nameProperty } : {}),
    };
  }
  const catalogId = options.catalogId ?? `https://github.com/aceshooting/lyra-ui/a2ui/v1.0-candidate/processor/${encodeURIComponent(catalog.id)}/${encodeURIComponent(catalog.version)}`;
  return Object.freeze({ catalogId, protocolVersion: '1.0', viewCatalog: { id: catalog.id, version: catalog.version }, components });
}

/** A self-contained catalog document for a model or catalog consumer, with nesting rules. */
export function exportA2uiV1Catalog(catalog: A2uiV1Catalog): JsonObject {
  const dataBinding: JsonObject = { type: 'object', properties: { '@path': { type: 'string' } }, required: ['@path'], additionalProperties: false };
  const dynamic = (rule: A2uiV1PropertyDefinition): JsonValue => rule.dynamic ? { oneOf: [rule.schema as unknown as JsonValue, { $ref: '#/$defs/DataBinding' }] } : rule.schema as unknown as JsonValue;
  const components: Record<string, JsonValue> = Object.create(null) as Record<string, JsonValue>;
  for (const [name, definition] of Object.entries(catalog.components)) {
    const properties: Record<string, JsonValue> = { component: { const: name } };
    for (const [key, rule] of Object.entries(definition.properties)) properties[key] = dynamic(rule);
    if (definition.text) properties['text'] = { oneOf: [{ type: 'string' }, { $ref: '#/$defs/DataBinding' }] };
    if (definition.children) properties['children'] = { oneOf: [
      { type: 'array', items: { type: 'string' }, uniqueItems: true },
      { type: 'object', properties: { componentId: { type: 'string' }, path: { type: 'string' } }, required: ['componentId', 'path'], additionalProperties: false },
    ] };
    if (definition.action) properties['action'] = { type: 'object', properties: { event: { type: 'object', properties: {
      name: { type: 'string' }, context: { type: 'object', additionalProperties: true },
    }, required: ['name'], additionalProperties: false } }, required: ['event'], additionalProperties: false };
    components[name] = {
      type: 'object', properties, required: ['component', ...definition.required],
      ...(definition.allowedParents ? { allowedParents: [...definition.allowedParents] } : {}),
      ...(definition.allowedChildren ? { allowedChildren: [...definition.allowedChildren] } : {}),
    };
  }
  return {
    $schema: 'https://a2ui.org/specification/v1_0/catalog_definition.json', $id: catalog.catalogId, catalogId: catalog.catalogId,
    protocolVersion: '1.0', title: 'Lyra candidate processor catalog',
    description: 'Literal values and @path bindings, static or templated children and event actions. Function calls, checks and local actions are rejected.',
    components, functions: {},
    $defs: { DataBinding: dataBinding, anyComponent: { oneOf: Object.keys(components).map(name => ({ $ref: `#/components/${escape(name)}` })) }, anyFunction: { not: {} } },
  };
}

interface ResolvedNode { readonly node: LyraGenNode; readonly sources: ReadonlyMap<string, string> }

/** Opt-in transactional processor for a declared A2UI v1.0 candidate profile. */
export class A2uiV1Processor {
  private readonly surfaces = new Map<string, A2uiV1Surface>();
  private readonly lifetimes = new Map<string, number>();
  private readonly identities = new Map<string, ReadonlyMap<string, string>>();
  private readonly catalogs = new Map<string, A2uiV1Catalog>();
  private readonly viewCatalog: LyraGenCatalog;
  private readonly limits: LyraGenLimits;
  private readonly maxSurfaces: number;
  private readonly maxComponents: number;
  private readonly maxInstances: number;
  private readonly maxLifetimes: number;
  private lastRevision = -1;
  private lifetimeCount = 0;
  private nextInstance = 0;
  readonly registeredCatalogIds: readonly string[];

  constructor(options: A2uiV1ProcessorOptions) {
    this.viewCatalog = options.viewCatalog;
    this.limits = resolveLimits(options.limits);
    this.maxSurfaces = this.bound(options.maxSurfaces ?? 32);
    this.maxComponents = this.bound(options.maxComponents ?? 2000);
    this.maxInstances = this.bound(options.maxInstances ?? 5000);
    this.maxLifetimes = this.bound(options.maxSurfaceLifetimes ?? 10000);
    for (const catalog of options.catalogs) {
      if (catalog.protocolVersion !== '1.0' || !catalog.catalogId || this.catalogs.has(catalog.catalogId)) throw new TypeError('Catalog identities must be unique candidate profiles.');
      if (catalog.viewCatalog.id !== this.viewCatalog.id || catalog.viewCatalog.version !== this.viewCatalog.version) throw new TypeError('Every catalog must produce the processor view catalog.');
      for (const [name, definition] of Object.entries(catalog.components)) {
        if (!A2UI_CANDIDATE_IDENTIFIER.test(name) || name === SURFACE) throw new TypeError('Invalid candidate component identifier.');
        if (!Object.hasOwn(this.viewCatalog.components, definition.role)) throw new TypeError('A catalog component names a role outside the view catalog.');
      }
      this.catalogs.set(catalog.catalogId, catalog);
    }
    this.registeredCatalogIds = Object.freeze([...this.catalogs.keys()].sort());
  }
  private bound(value: number): number { if (!Number.isSafeInteger(value) || value < 1) throw new TypeError('Limits must be positive safe integers.'); return value; }
  get surfaceIds(): readonly string[] { return [...this.surfaces.keys()]; }
  getSurface(id: string): A2uiV1Surface | undefined { const surface = this.surfaces.get(id); return surface ? structuredClone(surface) : undefined; }

  process(input: unknown, context: A2uiV1ProcessContext): A2uiV1ProcessResult {
    if (typeof context.ownerId !== 'string' || !context.ownerId) throw new TypeError('An owner identity is required.');
    let surfaceId: string | undefined;
    let functionCallId: string | undefined;
    try {
      const snapshot = snapshotJson(input, this.limits);
      if (!snapshot.ok) invalid('The message is not bounded JSON.', '');
      const message = record(snapshot.value, '');
      const active = OPERATIONS.filter(kind => own(message, kind));
      if (active.length !== 1) invalid('Exactly one message operation is required.', '');
      const kind = active[0]!;
      const body = record(message[kind], `/${kind}`);
      if (typeof body['surfaceId'] === 'string' && body['surfaceId']) surfaceId = body['surfaceId'];
      if (typeof body['functionCallId'] === 'string' && body['functionCallId']) functionCallId = body['functionCallId'];
      if (message['version'] !== VERSION) invalid('Only the v1.0 candidate profile ("1.0") is admitted.', '/version');
      members(message, ['version', kind], '');
      if (kind === 'callRendererFunction') {
        members(body, ['surfaceId', 'functionCallId', 'callFunction'], `/${kind}`);
        text(body['functionCallId'], `/${kind}/functionCallId`);
        surfaceId = undefined;
        fail('INVALID_FUNCTION_CALL', 'This renderer registers no renderer functions.');
      }
      if (kind === 'agentFunctionResponse') {
        text(body['functionCallId'], `/${kind}/functionCallId`);
        surfaceId = undefined;
        fail('INTEGRITY_ERROR', 'No outstanding agent function call has this ID.');
      }
      functionCallId = undefined;
      const id = text(body['surfaceId'], `/${kind}/surfaceId`);
      const value = kind === 'createSurface' ? this.create(body, id, context) : this.change(kind, body, id, context);
      return { ok: true, value, diagnostics: [] };
    } catch (error) {
      const failure = error instanceof V1Failure ? error : new V1Failure('VALIDATION_FAILED', 'The message could not be processed.', '');
      return this.failure(failure, surfaceId, functionCallId);
    }
  }
  private failure(error: V1Failure, surfaceId: string | undefined, functionCallId: string | undefined): A2uiV1ProcessResult {
    const sid = error.context.surfaceId ?? surfaceId;
    const fid = error.context.functionCallId ?? functionCallId;
    const body: A2uiV1Error = {
      code: error.code, message: error.message,
      ...(fid !== undefined ? { functionCallId: fid } : sid !== undefined ? { surfaceId: sid } : {}),
      ...(error.path !== undefined && error.code !== 'INTEGRITY_ERROR' && error.code !== 'INVALID_FUNCTION_CALL' ? { path: error.path } : {}),
    };
    return { ok: false, error: { version: '1.0', error: body }, diagnostics: [{ code: error.code, message: error.message, path: error.path ?? '', severity: 'error' }] };
  }
  private nextRevision(): number {
    if (this.lastRevision >= Number.MAX_SAFE_INTEGER) invalid('The processor revision budget is exhausted.', '');
    return this.lastRevision + 1;
  }
  private create(body: JsonObject, id: string, context: A2uiV1ProcessContext): A2uiV1Surface {
    const base = '/createSurface';
    if (own(body, 'theme')) invalid('A v1.0 createSurface cannot carry theme.', `${base}/theme`);
    members(body, ['surfaceId', 'catalogId', 'sendDataModel', 'components', 'dataModel', 'metadata'], base);
    if (this.lifetimes.has(id)) fail('INTEGRITY_ERROR', 'A surface ID is unique for the renderer lifetime and cannot be created again.');
    if (!VIEW_IDENTITY.test(id)) invalid('The surface ID is outside this profile.', `${base}/surfaceId`);
    if (context.expectedRevision !== undefined) fail('INTEGRITY_ERROR', 'Creation does not accept an existing revision.');
    if (this.surfaces.size >= this.maxSurfaces) invalid('Surface limit exceeded.', `${base}/surfaceId`);
    if (this.lifetimeCount >= this.maxLifetimes) invalid('Surface lifetime limit exceeded.', `${base}/surfaceId`);
    let catalogId: string | undefined;
    if (own(body, 'catalogId')) {
      catalogId = text(body['catalogId'], `${base}/catalogId`);
      if (!this.catalogs.has(catalogId)) invalid('The surface catalog is not registered by this renderer.', `${base}/catalogId`);
    }
    if (own(body, 'sendDataModel') && typeof body['sendDataModel'] !== 'boolean') invalid('sendDataModel must be boolean.', `${base}/sendDataModel`);
    const data = own(body, 'dataModel') ? record(body['dataModel'], `${base}/dataModel`) : {};
    const metadata = own(body, 'metadata') ? this.metadata(body['metadata'], `${base}/metadata`) : undefined;
    const revision = this.nextRevision();
    let surface: A2uiV1Surface = { surfaceId: id, ownerId: context.ownerId, ...(catalogId ? { catalogId } : {}), revision, dataRevision: 0, data, components: {}, sendDataModel: body['sendDataModel'] === true, ...(metadata ? { metadata } : {}) };
    const lifetime = this.lifetimeCount + 1;
    // The data model applies before the initial components.
    let identities: ReadonlyMap<string, string> = new Map();
    if (own(body, 'components')) {
      const merged = this.mergeComponents(surface, body['components'], `${base}/components`);
      surface = { ...surface, components: merged.components };
      identities = this.resolveFor(surface, lifetime, merged.indexes, `${base}/components`).identities;
    }
    this.lifetimeCount = lifetime;
    this.lifetimes.set(id, lifetime);
    this.identities.set(id, identities);
    this.lastRevision = revision;
    this.surfaces.set(id, surface);
    return structuredClone(surface);
  }
  private change(kind: typeof OPERATIONS[number], body: JsonObject, id: string, context: A2uiV1ProcessContext): A2uiV1Surface | { readonly deleted: string; readonly revision: number } {
    const previous = this.surfaces.get(id);
    if (!previous || previous.ownerId !== context.ownerId) fail('INTEGRITY_ERROR', 'The surface has not been created for this agent.');
    if (context.expectedRevision !== undefined && context.expectedRevision !== previous.revision) fail('INTEGRITY_ERROR', 'The surface revision is stale.');
    const base = `/${kind}`;
    const lifetime = this.lifetimes.get(id)!;
    if (kind === 'deleteSurface') {
      members(body, ['surfaceId'], base);
      const revision = this.nextRevision();
      this.surfaces.delete(id);
      this.identities.delete(id);
      this.lastRevision = revision;
      return { deleted: id, revision };
    }
    let next: A2uiV1Surface;
    let resolved: { identities: ReadonlyMap<string, string> };
    if (kind === 'updateComponents') {
      members(body, ['surfaceId', 'components'], base);
      if (!own(body, 'components')) invalid('A component list is required.', `${base}/components`);
      const merged = this.mergeComponents(previous, body['components'], `${base}/components`);
      next = { ...previous, revision: this.nextRevision(), components: merged.components };
      resolved = this.resolveFor(next, lifetime, merged.indexes, `${base}/components`);
    } else {
      members(body, ['surfaceId', 'path', 'value'], base);
      if (!own(body, 'value')) invalid('updateDataModel requires a value; use null to delete.', `${base}/value`);
      if (own(body, 'path') && typeof body['path'] !== 'string') invalid('The data path must be a string.', `${base}/path`);
      const path = typeof body['path'] === 'string' ? body['path'] : '/';
      if (path !== '' && !path.startsWith('/')) invalid('Data updates require an absolute JSON Pointer.', `${base}/path`);
      const data = this.updateData(previous.data, pointerSegments(path, '', `${base}/path`), body['value']!, base);
      next = { ...previous, revision: this.nextRevision(), dataRevision: previous.dataRevision + 1, data };
      resolved = this.resolveFor(next, lifetime, new Map(), `${base}/value`, true);
    }
    this.identities.set(id, resolved.identities);
    this.lastRevision = next.revision;
    this.surfaces.set(id, next);
    return structuredClone(next);
  }
  private metadata(value: JsonValue | undefined, path: string): JsonObject {
    const metadata = record(value, path);
    members(metadata, ['extensions'], path);
    if (own(metadata, 'extensions')) {
      const extensions = record(metadata['extensions'], `${path}/extensions`);
      for (const key of Object.keys(extensions)) if (!A2UI_CANDIDATE_IDENTIFIER.test(key) || UNSAFE.includes(key)) invalid('Extension keys must be Unicode identifiers.', join(`${path}/extensions`, key));
    }
    return metadata;
  }
  private updateData(data: JsonObject, parts: readonly string[], value: JsonValue, base: string): JsonObject {
    if (!parts.length) {
      if (value === null) return {};
      return record(value, `${base}/value`);
    }
    const root = structuredClone(data) as Record<string, JsonValue>;
    let current: JsonValue = root;
    for (let i = 0; i < parts.length; i++) {
      const key = parts[i]!;
      const last = i === parts.length - 1;
      if (Array.isArray(current)) {
        if (!INDEX.test(key) || Number(key) >= this.limits.maxArrayLength) invalid('An array path requires a canonical in-bounds index.', `${base}/path`);
        const index = Number(key);
        if (last) {
          if (value === null) invalid('Deleting an array element by null is outside this profile; replace the array instead.', `${base}/path`);
          if (index > current.length) invalid('Array writes cannot leave gaps.', `${base}/path`);
          current[index] = value;
          return root;
        }
        if (current[index] == null) { if (index > current.length) invalid('Array writes cannot leave gaps.', `${base}/path`); current[index] = INDEX.test(parts[i + 1]!) ? [] : {}; }
        current = current[index]!;
      } else if (object(current)) {
        const target = current as Record<string, JsonValue>;
        if (last) {
          if (value === null) delete target[key];
          else target[key] = value;
          return root;
        }
        if (!own(target, key) || target[key] == null) { if (value === null) return root; target[key] = INDEX.test(parts[i + 1]!) ? [] : {}; }
        current = target[key]!;
      } else invalid('Cannot traverse a scalar data value.', `${base}/path`);
    }
    return root;
  }

  private componentCatalog(surface: A2uiV1Surface, component: JsonObject): A2uiV1Catalog {
    return this.catalogs.get(typeof component['@catalogId'] === 'string' ? component['@catalogId'] : surface.catalogId!)!;
  }
  private definition(surface: A2uiV1Surface, component: JsonObject): A2uiV1ComponentDefinition {
    return this.componentCatalog(surface, component).components[component['component'] as string]!;
  }
  private mergeComponents(surface: A2uiV1Surface, list: JsonValue | undefined, base: string): { components: Readonly<Record<string, JsonObject>>; indexes: ReadonlyMap<string, number> } {
    if (!Array.isArray(list) || !list.length) invalid('A nonempty component list is required.', base);
    const components: Record<string, JsonObject> = { ...surface.components };
    const indexes = new Map<string, number>();
    list.forEach((raw, index) => {
      const path = join(base, index);
      const component = record(raw, path);
      const id = this.validateComponent(surface, component, path);
      if (indexes.has(id)) invalid('A component ID occurs twice in one message.', `${path}/id`);
      indexes.set(id, index);
      // Updates replace a component definition in full.
      components[id] = component;
    });
    if (Object.keys(components).length > this.maxComponents) invalid('Component limit exceeded.', base);
    this.validateGraph(surface, components, indexes, base);
    return { components, indexes };
  }
  private validateComponent(surface: A2uiV1Surface, component: JsonObject, path: string): string {
    const id = text(component['id'], `${path}/id`);
    if (!A2UI_CANDIDATE_IDENTIFIER.test(id) || UNSAFE.includes(id)) invalid('Component IDs must be Unicode identifiers.', `${path}/id`);
    const type = text(component['component'], `${path}/component`);
    if (type === SURFACE) invalid('The Surface component is immutable.', `${path}/component`);
    let catalogId = surface.catalogId;
    if (own(component, '@catalogId')) {
      catalogId = text(component['@catalogId'], `${path}/@catalogId`);
      if (!this.catalogs.has(catalogId)) invalid('The component catalog is not registered by this renderer.', `${path}/@catalogId`);
    }
    if (!catalogId) invalid('The component names no catalog and the surface has no default catalog.', path);
    const catalog = this.catalogs.get(catalogId)!;
    const definition = Object.hasOwn(catalog.components, type) ? catalog.components[type] : undefined;
    if (!definition) invalid(`Component ${type} is not in its catalog.`, `${path}/component`);
    const allowed = ['id', 'component', '@catalogId', '@accessibility', '@metadata', ...Object.keys(definition.properties)];
    if (definition.text) allowed.push('text');
    if (definition.children) allowed.push('children');
    if (definition.action) allowed.push('action');
    members(component, allowed, path);
    if (own(component, '@metadata')) this.metadata(component['@metadata'], `${path}/@metadata`);
    let labelled = false;
    if (own(component, '@accessibility')) labelled = this.validateAccessibility(component, definition, `${path}/@accessibility`);
    for (const key of definition.required) {
      if (!own(component, key) && !(labelled && key === definition.accessibleNameProperty)) invalid(`Missing component property ${key}.`, join(path, key));
    }
    for (const [key, rule] of Object.entries(definition.properties)) if (own(component, key)) this.validateValue(component[key]!, rule, join(path, key));
    if (own(component, 'text')) this.validateValue(component['text']!, { schema: { type: 'string' }, dynamic: true }, `${path}/text`);
    if (own(component, 'children')) this.validateChildren(component['children']!, `${path}/children`);
    if (own(component, 'action')) this.validateAction(component['action']!, `${path}/action`);
    return id;
  }
  private validateAccessibility(component: JsonObject, definition: A2uiV1ComponentDefinition, path: string): boolean {
    const block = record(component['@accessibility'], path);
    members(block, ['label', 'description', 'live', 'hidden'], path);
    if (own(block, 'description')) invalid('Accessible descriptions are outside this profile.', `${path}/description`);
    if (own(block, 'live') && block['live'] !== 'off') invalid('Live announcements are host-owned in this profile.', `${path}/live`);
    if (own(block, 'hidden') && block['hidden'] !== false) invalid('Hiding content from assistive technology is outside this profile.', `${path}/hidden`);
    if (!own(block, 'label')) return false;
    const name = definition.accessibleNameProperty;
    if (!name) invalid('This component declares no accessible-name property for a label.', `${path}/label`);
    if (own(component, name)) invalid(`The label conflicts with the explicit ${name} property.`, `${path}/label`);
    this.validateValue(block['label']!, { schema: definition.properties[name]!.schema, dynamic: true }, `${path}/label`);
    return true;
  }
  private validateValue(value: JsonValue, rule: A2uiV1PropertyDefinition, path: string): void {
    if (object(value)) {
      if (own(value, '@call')) invalid('Function calls are outside this profile.', path);
      if (own(value, '@path')) {
        if (!rule.dynamic) invalid('This property accepts only a literal value.', path);
        members(value, ['@path'], path);
        if (typeof value['@path'] !== 'string') invalid('A binding path must be a string.', path);
        pointerSegments(value['@path'], '', path);
        return;
      }
      if (Object.keys(value).some(key => /^@(?:[^@]|$)/u.test(key))) invalid('Literal objects cannot use reserved @ members.', path);
    }
    const result = validateSchema(value, rule.schema, this.limits);
    if (!result.ok) invalid(result.diagnostics[0]?.message ?? 'Schema validation failed.', path);
  }
  private validateChildren(value: JsonValue, path: string): void {
    if (Array.isArray(value)) {
      const seen = new Set<string>();
      value.forEach((child, index) => {
        const id = text(child, join(path, index));
        if (id === 'root') invalid('The root component can only be the Surface child.', join(path, index));
        if (seen.has(id)) invalid('A child ID occurs twice in one list.', join(path, index));
        seen.add(id);
      });
      return;
    }
    const template = record(value, path);
    members(template, ['componentId', 'path'], path);
    const id = text(template['componentId'], `${path}/componentId`);
    if (id === 'root') invalid('The root component can only be the Surface child.', `${path}/componentId`);
    if (typeof template['path'] !== 'string') invalid('A template path is required.', `${path}/path`);
    pointerSegments(template['path'], '', `${path}/path`);
  }
  private validateAction(value: JsonValue, path: string): void {
    const action = record(value, path);
    if (own(action, 'functionCall')) invalid('Local function actions are outside this profile.', path);
    members(action, ['event'], path);
    const event = record(action['event'], `${path}/event`);
    members(event, ['name', 'context'], `${path}/event`);
    text(event['name'], `${path}/event/name`);
    if (!own(event, 'context')) return;
    const context = record(event['context'], `${path}/event/context`);
    for (const [key, entry] of Object.entries(context)) {
      const at = join(`${path}/event/context`, key);
      if (entry === null) invalid('Null is not a DynamicValue literal.', at);
      if (object(entry) && own(entry, '@call')) invalid('Function calls are outside this profile.', at);
      if (binding(entry)) {
        members(entry, ['@path'], at);
        if (typeof entry['@path'] !== 'string') invalid('A binding path must be a string.', at);
        pointerSegments(entry['@path'], '', at);
      } else if (object(entry) && Object.keys(entry).some(name => /^@(?:[^@]|$)/u.test(name))) invalid('Literal objects cannot use reserved @ members.', at);
    }
  }
  private references(component: JsonObject): string[] {
    const children = component['children'];
    if (Array.isArray(children)) return children as string[];
    if (object(children)) return [children['componentId'] as string];
    return [];
  }
  private validateGraph(surface: A2uiV1Surface, components: Readonly<Record<string, JsonObject>>, indexes: ReadonlyMap<string, number>, base: string): void {
    const at = (id: string, suffix = ''): string => indexes.has(id) ? `${join(base, indexes.get(id)!)}${suffix}` : base;
    const done = new Set<string>();
    const active = new Set<string>();
    const visit = (id: string, depth: number): void => {
      if (depth > this.limits.maxDepth) invalid('Component nesting exceeds the limit.', at(id));
      if (active.has(id)) invalid('Component references form a cycle.', at(id, '/children'));
      if (done.has(id) || !own(components, id)) return;
      active.add(id);
      for (const child of this.references(components[id]!)) visit(child, depth + 1);
      active.delete(id);
      done.add(id);
    };
    for (const id of Object.keys(components)) visit(id, 0);
    const root = own(components, 'root') ? components['root']! : undefined;
    if (root) {
      const parents = this.definition(surface, root).allowedParents;
      if (parents && !parents.includes(SURFACE)) fail('UNALLOWED_PARENT', `Component ${String(root['component'])} cannot be the surface root.`, at('root', '/component'));
    }
    for (const [id, component] of Object.entries(components)) {
      const definition = this.definition(surface, component);
      const type = component['component'] as string;
      const children = component['children'];
      this.references(component).forEach((childId, index) => {
        if (!own(components, childId)) return;
        const child = components[childId]!;
        const childType = child['component'] as string;
        const edge = indexes.has(id) ? at(id, Array.isArray(children) ? `/children/${index}` : '/children/componentId') : at(childId, '/component');
        if (definition.allowedChildren && !definition.allowedChildren.includes(childType)) fail('UNALLOWED_CHILD', `Component ${childType} is not an allowed child of ${type}.`, edge);
        const parents = this.definition(surface, child).allowedParents;
        if (parents && !parents.includes(type)) fail('UNALLOWED_PARENT', `Component ${childType} is not allowed under ${type}.`, edge);
      });
    }
  }

  /** Resolve before commit so a bad binding cannot replace valid state. */
  private resolveFor(surface: A2uiV1Surface, lifetime: number, indexes: ReadonlyMap<string, number>, base: string, dataUpdate = false): { identities: ReadonlyMap<string, string> } {
    try {
      return this.resolve(surface, lifetime);
    } catch (error) {
      if (!(error instanceof ResolveFailure)) throw error;
      const path = dataUpdate ? base : indexes.has(error.componentId) ? `${join(base, indexes.get(error.componentId)!)}${error.member}` : base;
      return invalid(error.message, path);
    }
  }
  private resolve(surface: A2uiV1Surface, lifetime = this.lifetimes.get(surface.surfaceId)!): { root?: ResolvedNode; identities: ReadonlyMap<string, string>; diagnostics: LyraGenDiagnostic[] } {
    const previous = this.identities.get(surface.surfaceId);
    const identities = new Map<string, string>();
    const diagnostics: LyraGenDiagnostic[] = [];
    const sources = new Map<string, string>();
    let count = 0;
    const identity = (scope: string, lineage: readonly string[]): string => {
      const key = JSON.stringify([scope, lineage]);
      let value = identities.get(key) ?? previous?.get(key);
      if (!value) {
        if (!Number.isSafeInteger(this.nextInstance)) throw new ResolveFailure('root', '', 'The processor instance budget is exhausted.');
        value = `a2ui1:${lifetime}:${this.nextInstance++}`;
      }
      identities.set(key, value);
      return value;
    };
    const value = (raw: JsonValue, rule: A2uiV1PropertyDefinition, scope: string, id: string, member: string): JsonValue | undefined => {
      const resolved = binding(raw) ? read(surface.data, pointerSegments(raw['@path'], scope, '')) : raw;
      if (resolved === undefined) return undefined;
      const result = validateSchema(resolved, rule.schema, this.limits);
      if (!result.ok) throw new ResolveFailure(id, member, `Bound data for ${id} does not match its property schema.`);
      return resolved;
    };
    const visit = (id: string, scope: string, ancestry: readonly string[]): LyraGenNode | undefined => {
      if (++count > this.maxInstances || ancestry.length > this.limits.maxDepth) throw new ResolveFailure(id, '', 'Expanded component limit exceeded.');
      const raw = own(surface.components, id) ? surface.components[id]! : undefined;
      if (!raw) {
        if (diagnostics.length < this.limits.maxDiagnostics) diagnostics.push({ code: 'a2ui-v1-pending-component', message: 'A referenced component has not arrived yet.', path: `/components/${escape(id)}`, severity: 'warning' });
        return undefined;
      }
      const definition = this.definition(surface, raw);
      const props: Record<string, JsonValue> = {};
      for (const [key, rule] of Object.entries(definition.properties)) {
        if (!own(raw, key)) continue;
        const resolved = value(raw[key]!, rule, scope, id, join('', key));
        if (resolved !== undefined) props[key] = resolved;
      }
      const accessibility = object(raw['@accessibility']) ? raw['@accessibility'] : undefined;
      if (accessibility && own(accessibility, 'label') && definition.accessibleNameProperty) {
        const name = definition.accessibleNameProperty;
        const resolved = value(accessibility['label']!, { schema: definition.properties[name]!.schema, dynamic: true }, scope, id, '/@accessibility/label');
        if (resolved !== undefined) props[name] = resolved;
      }
      const content = own(raw, 'text') ? value(raw['text']!, { schema: { type: 'string' }, dynamic: true }, scope, id, '/text') : undefined;
      const lineage = [...ancestry, id];
      const children: LyraGenNode[] = [];
      const append = (childId: string, childScope: string): void => { const child = visit(childId, childScope, lineage); if (child) children.push(child); };
      const list = raw['children'];
      if (Array.isArray(list)) for (const child of list) append(child as string, scope);
      else if (object(list)) {
        const parts = pointerSegments(list['path'] as string, scope, '');
        const items = read(surface.data, parts);
        if (items !== undefined && !Array.isArray(items)) throw new ResolveFailure(id, '/children/path', `The template for ${id} must bind to an array.`);
        if (Array.isArray(items)) items.forEach((_, index) => append(list['componentId'] as string, pointer([...parts, String(index)])));
      }
      let action: LyraGenNode['action'];
      if (object(raw['action'])) {
        const event = raw['action']['event'] as JsonObject;
        const payload: Record<string, JsonValue> = {};
        for (const [key, entry] of Object.entries(object(event['context']) ? event['context'] : {})) {
          const resolved = binding(entry) ? read(surface.data, pointerSegments(entry['@path'], scope, '')) : entry;
          if (resolved !== undefined) payload[key] = resolved;
        }
        action = { name: event['name'] as string, payload };
      }
      const nodeId = identity(scope, lineage);
      sources.set(nodeId, id);
      return {
        id: nodeId, type: definition.role, props,
        ...(children.length ? { children } : {}),
        ...(typeof content === 'string' ? { text: content } : {}),
        ...(action ? { action } : {}),
      };
    };
    const node = visit('root', '', []);
    return { ...(node ? { root: { node, sources } } : {}), identities, diagnostics };
  }

  /** Build the current lyra-gen view and admit it through `validateView` with the view catalog. */
  toView(surfaceId: string): A2uiV1ViewResult {
    const surface = this.surfaces.get(surfaceId);
    if (!surface) return { ok: false, diagnostics: [{ code: 'a2ui-v1-unknown-surface', message: 'The surface has not been created.', path: '', severity: 'error' }] };
    let resolved: ReturnType<A2uiV1Processor['resolve']>;
    try {
      resolved = this.resolve(surface);
    } catch (error) {
      const failure = error instanceof ResolveFailure ? error : new ResolveFailure('root', '', 'The surface could not be resolved.');
      const path = `/components/${escape(failure.componentId)}${failure.member}`;
      return { ok: false, diagnostics: [{ code: 'VALIDATION_FAILED', message: failure.message, path, severity: 'error' }], error: { version: '1.0', error: { code: 'VALIDATION_FAILED', message: failure.message, surfaceId, path } } };
    }
    if (!resolved.root) return { ok: false, diagnostics: [{ code: 'a2ui-v1-pending-root', message: 'The root component has not arrived yet.', path: '/components/root', severity: 'error' }, ...resolved.diagnostics] };
    // Keep the identities of the projection just produced so later reads reuse them.
    this.identities.set(surfaceId, resolved.identities);
    const view: LyraGenView = { version: '1', catalog: { id: this.viewCatalog.id, version: this.viewCatalog.version }, surfaceId, revision: surface.revision, root: resolved.root.node };
    const result = validateView(view, this.viewCatalog);
    if (result.ok) return { ...result, diagnostics: [...resolved.diagnostics, ...result.diagnostics] };
    const first = result.diagnostics.find(diagnostic => diagnostic.severity === 'error') ?? result.diagnostics[0];
    const path = this.sourcePath(view.root, first?.path ?? '', resolved.root.sources);
    const message = first?.message ?? 'The surface does not satisfy the view catalog.';
    return { ...result, error: { version: '1.0', error: { code: 'VALIDATION_FAILED', message, surfaceId, path } } };
  }
  /** Map a view diagnostic path onto `/components/<source id>/<member>`. */
  private sourcePath(root: LyraGenNode, path: string, sources: ReadonlyMap<string, string>): string {
    const parts = path.split('/').slice(1);
    let node = root;
    let index = parts[0] === 'root' ? 1 : 0;
    while (parts[index] === 'children' && parts[index + 1] !== undefined && node.children?.[Number(parts[index + 1])]) {
      node = node.children[Number(parts[index + 1])]!;
      index += 2;
    }
    const rest = parts.slice(index);
    const member = rest[0] === 'props' && rest[1] !== undefined ? rest[1] : rest[0] === 'text' || rest[0] === 'action' ? rest[0] : undefined;
    const source = sources.get(node.id) ?? 'root';
    return `/components/${escape(source)}${member !== undefined ? `/${member}` : ''}`;
  }
}

/** Transport-neutral v1.0 renderer capabilities; empty unless the host asserts qualification. */
export function a2uiV1RendererCapabilities(processor: A2uiV1Processor, qualifiedCatalogIds: readonly string[] = []): { readonly '1.0': { readonly supportedCatalogIds: readonly string[] } } {
  const ids = [...new Set(qualifiedCatalogIds)].sort();
  if (ids.some(id => !processor.registeredCatalogIds.includes(id))) throw new TypeError('Only registered catalogs may be advertised.');
  return { '1.0': { supportedCatalogIds: ids } };
}

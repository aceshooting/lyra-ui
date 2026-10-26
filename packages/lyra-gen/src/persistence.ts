import { validateView } from './runtime.js';
import { snapshotJson } from './schema.js';
import type { JsonObject, JsonValue, LyraGenCatalog, LyraGenView } from './types.js';

/** Portable content only. Identity, grants, routes and credentials belong to the host. */
export interface DashboardDefinition {
  readonly format: 'lyra-dashboard';
  readonly version: 1;
  readonly title: string;
  readonly view: LyraGenView;
  readonly dataSources: readonly DashboardDataReference[];
}
export interface DashboardDataReference {
  readonly id: string;
  readonly source: string;
  readonly parameters?: JsonObject;
}
export interface DashboardInstanceState {
  readonly version: 1;
  readonly values: JsonObject;
}
export interface DashboardContext {
  readonly actorId: string;
  readonly tenantId: string;
  readonly workspaceId: string;
}
export type DashboardOperation = 'create' | 'read' | 'draft' | 'list' | 'update' | 'delete' | 'publish' | 'fork' | 'history' | 'export' | 'data' | 'state';
export interface DashboardMetadata {
  readonly id: string;
  readonly ownerId: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly revision: number;
  readonly publishedRevision?: number;
}
export interface DashboardRevision {
  readonly revision: number;
  readonly definition: DashboardDefinition;
}
export interface DashboardDocument {
  readonly metadata: DashboardMetadata;
  readonly definition: DashboardDefinition;
}
/** The host must keep publications immutable and CAS writes atomic across all fields. */
export interface DashboardRecord {
  readonly metadata: DashboardMetadata;
  readonly definition: DashboardDefinition;
  readonly history: readonly DashboardRevision[];
  readonly publications: readonly DashboardRevision[];
}
export interface DashboardPage {
  readonly records: readonly DashboardRecord[];
  readonly cursor?: string;
}
export interface DashboardSavedInstance {
  readonly revision: number;
  readonly state: DashboardInstanceState;
}
export interface DashboardWriteResult {
  readonly ok: boolean;
}
/** Implement these on the trusted server, with authenticated context and transactional CAS. */
export interface DashboardHostAdapter {
  read(context: DashboardContext, id: string, operation: DashboardOperation): Promise<DashboardRecord | undefined>;
  list(context: DashboardContext, cursor?: string): Promise<DashboardPage>;
  /** Optional separate storage, scoped by authenticated tenant, workspace, actor and instance. */
  readInstance?(context: DashboardContext, id: string, instanceId: string): Promise<DashboardSavedInstance | undefined>;
  compareAndSwapInstance?(context: DashboardContext, id: string, instanceId: string, expectedRevision: number | null, next: DashboardSavedInstance): Promise<DashboardWriteResult>;
  /** null creates only if absent; numbers compare the current revision, including delete. */
  compareAndSwap(context: DashboardContext, id: string, expectedRevision: number | null, next: DashboardRecord | null, operation: DashboardOperation): Promise<DashboardWriteResult>;
}
export interface DashboardAuthorizationRequest {
  readonly operation: DashboardOperation;
  readonly context: DashboardContext;
  readonly id?: string;
  readonly metadata?: DashboardMetadata;
  readonly source?: string;
}
export interface DashboardStoreOptions {
  readonly adapter: DashboardHostAdapter;
  readonly catalog: LyraGenCatalog;
  /** Rechecked for every access and after asynchronous reads. Never derive grants from content. */
  readonly authorize: (request: DashboardAuthorizationRequest) => boolean | Promise<boolean>;
  readonly createId: () => string;
  /** Explicit admission policy for every saved instance-state key. Omitted means no state. */
  readonly allowState?: (key: string, value: JsonValue, context: DashboardContext) => boolean;
  /** Source parameters are rejected unless the host explicitly permits them. */
  readonly allowSourceParameters?: (reference: DashboardDataReference, context: DashboardContext) => boolean;
}
export class DashboardError extends Error {
  readonly code: 'denied' | 'invalid' | 'missing' | 'conflict' | 'unpublished';
  constructor(code: DashboardError['code'], message: string) {
    super(message);
    this.name = 'DashboardError';
    this.code = code;
  }
}
export class DashboardConflict extends DashboardError {
  readonly expectedRevision: number | null;
  /** The caller's proposal is retained for deliberate conflict resolution. */
  readonly proposed: DashboardDefinition | null;
  constructor(expectedRevision: number | null, proposed: DashboardDefinition | null) {
    super('conflict', 'The dashboard changed. Reload its current revision and resolve the competing edits.');
    this.expectedRevision = expectedRevision;
    this.proposed = proposed;
  }
}

function invalid(message: string): never { throw new DashboardError('invalid', message); }
function object(value: JsonValue): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid('Expected an object.');
  return value as JsonObject;
}
function keys(value: JsonObject, allowed: readonly string[]): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) invalid('Unexpected document field.');
}
function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value)) invalid('Invalid identifier.');
  return value;
}
/** Reject executable/accessor values before serialization, with bounded traversal. */
export function copyDashboardJson(input: unknown): JsonValue {
  const result = snapshotJson(input, { maxNodes: 50000, maxDepth: 48, maxBytes: 2_000_000 });
  if (!result.ok) invalid(result.diagnostics.map(item => item.message).join('; '));
  return result.value;
}

export function validateDashboardDefinition(input: unknown, catalog: LyraGenCatalog): DashboardDefinition {
  const value = object(copyDashboardJson(input));
  keys(value, ['format', 'version', 'title', 'view', 'dataSources']);
  if (value['format'] !== 'lyra-dashboard' || value['version'] !== 1) invalid('Unsupported dashboard format or version.');
  if (typeof value['title'] !== 'string' || value['title'].length > 512) invalid('Invalid dashboard title.');
  const view = validateView(value['view'], catalog);
  if (!view.ok) invalid(`Invalid dashboard view: ${view.diagnostics.map(item => item.message).join('; ')}`);
  if (!Array.isArray(value['dataSources']) || value['dataSources'].length > 128) invalid('Invalid data-source references.');
  const ids = new Set<string>();
  const dataSources = value['dataSources'].map(item => {
    const reference = object(item);
    keys(reference, ['id', 'source', 'parameters']);
    const id = identifier(reference['id']);
    const source = identifier(reference['source']);
    if (ids.has(id)) invalid('Duplicate data-source identifier.');
    ids.add(id);
    if (reference['parameters'] !== undefined) return { id, source, parameters: object(reference['parameters']) };
    return { id, source };
  });
  return { format: 'lyra-dashboard', version: 1, title: value['title'], view: view.value, dataSources };
}

export type DashboardUpdatePolicy = { readonly mode: 'follow' } | { readonly mode: 'pin'; readonly revision: number };
export interface DashboardResolved {
  readonly metadata: DashboardMetadata;
  readonly definition: DashboardDefinition;
  readonly selectedRevision: number;
}
export interface DashboardDifference {
  readonly path: string;
  readonly kind: 'added' | 'removed' | 'changed';
  readonly before?: JsonValue;
  readonly after?: JsonValue;
}
/** Stable JSON Pointer changes suitable for host rendering as text, never HTML. */
export function diffDashboardDefinitions(before: DashboardDefinition, after: DashboardDefinition): readonly DashboardDifference[] {
  const changes: DashboardDifference[] = [];
  const visit = (left: JsonValue | undefined, right: JsonValue | undefined, path: string): void => {
    if (JSON.stringify(left) === JSON.stringify(right)) return;
    if (left !== undefined && right !== undefined && left !== null && right !== null && typeof left === 'object' && typeof right === 'object' && !Array.isArray(left) && !Array.isArray(right)) {
      for (const key of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
        visit((left as JsonObject)[key], (right as JsonObject)[key], `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`);
      }
      return;
    }
    changes.push({ path, kind: left === undefined ? 'added' : right === undefined ? 'removed' : 'changed', ...(left === undefined ? {} : { before: left }), ...(right === undefined ? {} : { after: right }) });
  };
  visit(copyDashboardJson(before), copyDashboardJson(after), '');
  return changes;
}

/** Portable orchestration. Server-side adapter authorization remains the security boundary. */
export class DashboardStore {
  readonly #options: DashboardStoreOptions;
  constructor(options: DashboardStoreOptions) { this.#options = options; }

  async #check(context: DashboardContext, operation: DashboardOperation, id?: string, metadata?: DashboardMetadata, source?: string): Promise<void> {
    identifier(context.actorId); identifier(context.tenantId); identifier(context.workspaceId);
    if (metadata && (metadata.tenantId !== context.tenantId || metadata.workspaceId !== context.workspaceId || metadata.id !== id)) throw new DashboardError('denied', 'Dashboard access denied.');
    if (!await this.#options.authorize({ context, operation, ...(id === undefined ? {} : { id }), ...(metadata === undefined ? {} : { metadata }), ...(source === undefined ? {} : { source }) })) throw new DashboardError('denied', 'Dashboard access denied.');
  }
  #definition(input: unknown, context: DashboardContext): DashboardDefinition {
    const definition = validateDashboardDefinition(input, this.#options.catalog);
    for (const reference of definition.dataSources) {
      if (reference['parameters'] && !this.#options.allowSourceParameters?.(reference, context)) invalid('Data-source parameters require explicit host permission.');
    }
    return definition;
  }
  async #read(context: DashboardContext, id: string, operation: DashboardOperation): Promise<DashboardRecord> {
    identifier(id);
    await this.#check(context, operation, id);
    const raw = await this.#options.adapter.read(context, id, operation);
    if (!raw) throw new DashboardError('missing', 'Dashboard is unavailable.');
    const record = copyDashboardJson(raw) as unknown as DashboardRecord;
    await this.#check(context, operation, id, record.metadata);
    return record;
  }
  async #write(context: DashboardContext, record: DashboardRecord | null, id: string, expectedRevision: number | null, operation: DashboardOperation, metadata?: DashboardMetadata): Promise<void> {
    const next = record === null ? null : copyDashboardJson(record) as unknown as DashboardRecord;
    await this.#check(context, operation, id, metadata);
    if (expectedRevision !== null && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1 || expectedRevision >= Number.MAX_SAFE_INTEGER)) invalid('Invalid expected revision.');
    const result = await this.#options.adapter.compareAndSwap(context, id, expectedRevision, next, operation);
    if (!result.ok) throw new DashboardConflict(expectedRevision, record?.definition ?? null);
  }
  async create(context: DashboardContext, input: unknown): Promise<DashboardDocument> {
    await this.#check(context, 'create');
    const definition = this.#definition(input, context);
    const id = identifier(this.#options.createId());
    const record: DashboardRecord = { metadata: { id, ownerId: context.actorId, tenantId: context.tenantId, workspaceId: context.workspaceId, revision: 1 }, definition, history: [{ revision: 1, definition }], publications: [] };
    await this.#write(context, record, id, null, 'create', record.metadata);
    return copyDashboardJson({ metadata: record.metadata, definition: record.definition }) as unknown as DashboardDocument;
  }
  async read(context: DashboardContext, id: string): Promise<DashboardDocument> {
    const record = await this.#read(context, id, 'draft');
    return { metadata: record.metadata, definition: this.#definition(record.definition, context) };
  }
  async list(context: DashboardContext, cursor?: string): Promise<{ readonly items: readonly DashboardMetadata[]; readonly cursor?: string }> {
    await this.#check(context, 'list');
    const page = await this.#options.adapter.list(context, cursor);
    await this.#check(context, 'list');
    const items: DashboardMetadata[] = [];
    for (const record of page.records) {
      try { await this.#check(context, 'read', record.metadata.id, record.metadata); items.push(copyDashboardJson(record.metadata) as unknown as DashboardMetadata); }
      catch (error) { if (!(error instanceof DashboardError) || error.code !== 'denied') throw error; }
    }
    return { items, ...(page.cursor === undefined ? {} : { cursor: page.cursor }) };
  }
  async update(context: DashboardContext, id: string, expectedRevision: number, input: unknown): Promise<DashboardDocument> {
    const definition = this.#definition(input, context);
    const current = await this.#read(context, id, 'update');
    if (current.metadata.revision !== expectedRevision) throw new DashboardConflict(expectedRevision, definition);
    const revision = expectedRevision + 1;
    const next = { ...current, metadata: { ...current.metadata, revision }, definition, history: [...current.history, { revision, definition }] };
    await this.#write(context, next, id, expectedRevision, 'update', current.metadata);
    return copyDashboardJson({ metadata: next.metadata, definition: next.definition }) as unknown as DashboardDocument;
  }
  async delete(context: DashboardContext, id: string, expectedRevision: number): Promise<void> {
    const current = await this.#read(context, id, 'delete');
    await this.#write(context, null, id, expectedRevision, 'delete', current.metadata);
  }
  async publish(context: DashboardContext, id: string, expectedRevision: number): Promise<DashboardDocument> {
    const current = await this.#read(context, id, 'publish');
    this.#definition(current.definition, context);
    if (current.metadata.revision !== expectedRevision) throw new DashboardConflict(expectedRevision, current.definition);
    const revision = expectedRevision + 1;
    const next: DashboardRecord = { ...current, metadata: { ...current.metadata, revision, publishedRevision: revision }, history: [...current.history, { revision, definition: current.definition }], publications: [...current.publications, { revision, definition: current.definition }] };
    await this.#write(context, next, id, expectedRevision, 'publish', current.metadata);
    return copyDashboardJson({ metadata: next.metadata, definition: next.definition }) as unknown as DashboardDocument;
  }
  async resolve(context: DashboardContext, id: string, policy: DashboardUpdatePolicy = { mode: 'follow' }): Promise<DashboardResolved> {
    const record = await this.#read(context, id, 'read');
    const revision = policy.mode === 'pin' ? policy.revision : record.metadata.publishedRevision;
    const publication = record.publications.find(item => item.revision === revision);
    if (!publication) throw new DashboardError('unpublished', 'The requested publication is unavailable.');
    return { metadata: record.metadata, definition: this.#definition(publication.definition, context), selectedRevision: publication.revision };
  }
  async history(context: DashboardContext, id: string): Promise<readonly DashboardRevision[]> {
    const record = await this.#read(context, id, 'history');
    return record.history.map(item => ({ revision: item.revision, definition: this.#definition(item.definition, context) }));
  }
  /** Restoring history creates a new draft; it never mutates or silently republishes history. */
  async undo(context: DashboardContext, id: string, expectedRevision: number, targetRevision: number): Promise<DashboardDocument> {
    const history = await this.history(context, id);
    const target = history.find(item => item.revision === targetRevision);
    if (!target) throw new DashboardError('missing', 'The requested revision is unavailable.');
    return this.update(context, id, expectedRevision, target.definition);
  }
  /** Rollback changes the followed publication, preserving every immutable published value. */
  async rollback(context: DashboardContext, id: string, expectedRevision: number, publishedRevision: number): Promise<DashboardDocument> {
    const current = await this.#read(context, id, 'publish');
    if (current.metadata.revision !== expectedRevision) throw new DashboardConflict(expectedRevision, current.definition);
    if (!current.publications.some(item => item.revision === publishedRevision)) throw new DashboardError('unpublished', 'The requested publication is unavailable.');
    const revision = expectedRevision + 1;
    const next = { ...current, metadata: { ...current.metadata, revision, publishedRevision }, history: [...current.history, { revision, definition: current.definition }] };
    await this.#write(context, next, id, expectedRevision, 'publish', current.metadata);
    return copyDashboardJson({ metadata: next.metadata, definition: next.definition }) as unknown as DashboardDocument;
  }
  async fork(context: DashboardContext, id: string, policy: DashboardUpdatePolicy = { mode: 'follow' }): Promise<DashboardDocument> {
    await this.#read(context, id, 'fork');
    const original = await this.resolve(context, id, policy);
    const surfaceId = identifier(this.#options.createId());
    await this.#check(context, 'fork', id, original.metadata);
    return this.create(context, { ...original.definition, view: { ...original.definition.view, surfaceId, revision: 0 } });
  }
  /** Export requires read and export permissions; no host metadata or instance state is included. */
  async export(context: DashboardContext, id: string, policy: DashboardUpdatePolicy = { mode: 'follow' }): Promise<DashboardDefinition> {
    await this.#read(context, id, 'export');
    const resolved = await this.resolve(context, id, policy);
    await this.#check(context, 'export', id, resolved.metadata);
    return resolved.definition;
  }
  async import(context: DashboardContext, input: unknown): Promise<DashboardDocument> { return this.create(context, input); }
  async instanceState(context: DashboardContext, id: string, input: unknown): Promise<DashboardInstanceState> {
    const record = await this.#read(context, id, 'state');
    const state = object(copyDashboardJson(input));
    keys(state, ['version', 'values']);
    if (state['version'] !== 1) invalid('Unsupported instance-state version.');
    const values = object(state['values'] ?? null);
    for (const [key, value] of Object.entries(values)) {
      if (!this.#options.allowState?.(key, value, context)) invalid('Instance state contains a field not permitted by the host.');
    }
    await this.#check(context, 'state', id, record.metadata);
    return { version: 1, values };
  }
  /** Save admitted UI state separately from the shared definition and its publication history. */
  async saveState(context: DashboardContext, id: string, instanceId: string, expectedRevision: number | null, input: unknown): Promise<DashboardSavedInstance> {
    identifier(instanceId);
    if (expectedRevision !== null && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1 || expectedRevision >= Number.MAX_SAFE_INTEGER)) invalid('Invalid instance revision.');
    const state = await this.instanceState(context, id, input);
    const adapter = this.#options.adapter;
    if (!adapter.compareAndSwapInstance) invalid('The host has not configured instance-state persistence.');
    const next: DashboardSavedInstance = { revision: (expectedRevision ?? 0) + 1, state };
    await this.#check(context, 'state', id);
    const result = await adapter.compareAndSwapInstance(context, id, instanceId, expectedRevision, next);
    if (!result.ok) throw new DashboardError('conflict', 'The instance state changed. Reload it before saving.');
    return next;
  }
  async loadState(context: DashboardContext, id: string, instanceId: string): Promise<DashboardSavedInstance | undefined> {
    identifier(instanceId);
    await this.#read(context, id, 'state');
    const adapter = this.#options.adapter;
    if (!adapter.readInstance) invalid('The host has not configured instance-state persistence.');
    const saved = await adapter.readInstance(context, id, instanceId);
    await this.#check(context, 'state', id);
    if (!saved) return undefined;
    if (!Number.isSafeInteger(saved.revision) || saved.revision < 1) invalid('Invalid saved instance revision.');
    return { revision: saved.revision, state: await this.instanceState(context, id, saved.state) };
  }
  /** Invoke registered host data code with the current viewer, never stored executable code. */
  async data<T>(context: DashboardContext, id: string, referenceId: string, resolve: (reference: DashboardDataReference, context: DashboardContext) => Promise<T>, policy: DashboardUpdatePolicy = { mode: 'follow' }): Promise<T> {
    const record = await this.resolve(context, id, policy);
    const reference = record.definition.dataSources.find(item => item.id === referenceId);
    if (!reference) throw new DashboardError('missing', 'The data-source reference is unavailable.');
    await this.#check(context, 'data', id, record.metadata, reference['source']);
    const result = await resolve(reference, context);
    await this.#check(context, 'data', id, record.metadata, reference['source']);
    return result;
  }
}

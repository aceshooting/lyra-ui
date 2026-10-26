import type { JsonObject, JsonValue } from './types.js';
import { snapshotJson } from './schema.js';
import { readPointer } from './references.js';

export interface DashboardQueryContext {
  readonly viewerId: string;
  readonly tenantId: string;
  /** Host changes this value whenever the viewer's grants change. */
  readonly authorizationRevision: string;
}
export interface DashboardSourceRecord { readonly id: string; readonly label: string; readonly updatedAt: number }
export interface DashboardQueryResult {
  readonly data: JsonValue;
  readonly sources?: readonly DashboardSourceRecord[];
  /** JSON Pointer in data to a source record id. Unresolved values remain unverified. */
  readonly lineage?: Readonly<Record<string, string>>;
  readonly partial?: boolean;
  readonly sampled?: boolean;
  readonly aggregation?: string;
}
export interface DashboardQueryDefinition {
  readonly authorize: (context: DashboardQueryContext, parameters: JsonObject) => boolean | Promise<boolean>;
  readonly execute: (parameters: JsonObject, context: DashboardQueryContext, signal: AbortSignal) => Promise<DashboardQueryResult>;
  readonly maxBytes: number;
  readonly maxRows: number;
}

/** Semantic names resolve only to host callbacks; documents never carry URLs or credentials. */
export class HostQueryRegistry {
  private readonly definitions = new Map<string, DashboardQueryDefinition>();
  private readonly listeners = new Set<(id: string) => void>();
  register(id: string, definition: DashboardQueryDefinition): () => void {
    if (!/^[a-zA-Z][\w.-]{0,127}$/.test(id) || this.definitions.has(id)) throw new Error('Invalid or duplicate query name');
    if (!Number.isSafeInteger(definition.maxBytes) || definition.maxBytes < 1 || !Number.isSafeInteger(definition.maxRows) || definition.maxRows < 1) throw new Error('Invalid query limits');
    const registered = Object.freeze({ ...definition });
    this.definitions.set(id, registered);
    return () => {
      if (this.definitions.get(id) !== registered) return;
      this.definitions.delete(id);
      for (const listener of this.listeners) listener(id);
    };
  }
  get(id: string): DashboardQueryDefinition | undefined { return this.definitions.get(id); }
  onRevoke(listener: (id: string) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}

export type DashboardDataStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'partial' | 'error' | 'cancelled' | 'denied';
export interface DashboardDataSnapshot {
  readonly status: DashboardDataStatus;
  readonly result?: DashboardQueryResult;
  readonly receivedAt?: number;
  readonly stale: boolean;
  readonly error?: 'query-failed' | 'invalid-result' | 'access-denied';
}

function copyJson<T>(value: T, maxBytes: number): T {
  const encoded = JSON.stringify(value);
  if (encoded === undefined || new TextEncoder().encode(encoded).byteLength > maxBytes) throw new Error('Data budget exceeded');
  return JSON.parse(encoded) as T;
}
function admitJson<T>(value: T, maxBytes: number): T {
  const admitted = snapshotJson(value, { maxBytes });
  if (!admitted.ok) throw new Error('Invalid bounded JSON');
  return admitted.value as T;
}
function validResult(value: DashboardQueryResult, maxRows: number): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.hasOwn(value, 'data') || Object.keys(value).some(key => !['data', 'sources', 'lineage', 'partial', 'sampled', 'aggregation'].includes(key))) return false;
  if ((value.sources !== undefined && !Array.isArray(value.sources)) || (value.lineage !== undefined && (value.lineage === null || typeof value.lineage !== 'object' || Array.isArray(value.lineage))) || (value.partial !== undefined && typeof value.partial !== 'boolean') || (value.sampled !== undefined && typeof value.sampled !== 'boolean') || (value.aggregation !== undefined && typeof value.aggregation !== 'string')) return false;
  let rows = 0;
  const pending: JsonValue[] = [value.data];
  while (pending.length) {
    const item = pending.pop()!;
    if (Array.isArray(item)) {
      rows += item.length;
      if (rows > maxRows) return false;
      pending.push(...item);
    } else if (item !== null && typeof item === 'object') pending.push(...Object.values(item));
  }
  const ids = new Set<string>();
  for (const source of value.sources ?? []) {
    if (!source || Object.keys(source).some(key => !['id', 'label', 'updatedAt'].includes(key)) || typeof source.id !== 'string' || typeof source.label !== 'string' || !Number.isFinite(source.updatedAt) || ids.has(source.id)) return false;
    ids.add(source.id);
  }
  return Object.entries(value.lineage ?? {}).every(([path, id]) => (path === '' || path.startsWith('/')) && typeof id === 'string');
}

/** Request generations, authorization checks and explicit revocation guard every result commit. */
export class LiveDataController {
  private context: DashboardQueryContext;
  private generation = 0;
  private active?: AbortController;
  private activeQuery?: string;
  private disposed = false;
  private current: DashboardDataSnapshot = { status: 'idle', stale: true };
  private readonly listeners = new Set<(snapshot: DashboardDataSnapshot) => void>();
  private readonly offRevoke: () => void;
  constructor(private readonly registry: HostQueryRegistry, context: DashboardQueryContext, private readonly now: () => number = Date.now, private readonly staleAfterMs = 30000) {
    if (!Number.isFinite(staleAfterMs) || staleAfterMs < 0) throw new Error('Invalid freshness limit');
    this.context = Object.freeze({ ...context });
    this.offRevoke = registry.onRevoke(id => { if (id === this.activeQuery) this.revoke(); });
  }
  get snapshot(): DashboardDataSnapshot {
    const stale = this.current.stale || this.current.receivedAt === undefined || this.now() - this.current.receivedAt >= this.staleAfterMs;
    return copyJson({ ...this.current, stale }, Number.MAX_SAFE_INTEGER);
  }
  subscribe(listener: (snapshot: DashboardDataSnapshot) => void): () => void {
    if (this.disposed) throw new Error('Controller disposed');
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  private commit(snapshot: DashboardDataSnapshot): void {
    this.current = snapshot;
    for (const listener of this.listeners) listener(this.snapshot);
  }
  setContext(context: DashboardQueryContext): void {
    this.invalidate();
    this.context = Object.freeze({ ...context });
    this.activeQuery = undefined;
    this.commit({ status: 'idle', stale: true });
  }
  private invalidate(): void {
    this.generation++;
    this.active?.abort();
    this.active = undefined;
  }
  cancel(): void {
    this.invalidate();
    if (!this.disposed) this.commit({ ...this.current, status: 'cancelled', stale: true });
  }
  revoke(): void {
    this.invalidate();
    this.commit({ status: 'denied', stale: true, error: 'access-denied' });
  }
  async refresh(query: string, parameters: JsonObject = {}): Promise<DashboardDataSnapshot> {
    if (this.disposed) throw new Error('Controller disposed');
    this.cancel();
    // A new semantic source cannot inherit data from the preceding source.
    if (this.activeQuery !== query) this.current = { status: 'idle', stale: true };
    this.activeQuery = query;
    const generation = this.generation;
    const context = this.context;
    const controller = new AbortController();
    this.active = controller;
    const definition = this.registry.get(query);
    const isCurrent = () => !this.disposed && !controller.signal.aborted && this.generation === generation && this.registry.get(query) === definition;
    if (!definition) { this.revoke(); return this.snapshot; }
    let safeParameters: JsonObject;
    try { safeParameters = admitJson(parameters, definition.maxBytes); }
    catch { this.commit({ ...this.current, status: 'error', stale: true, error: 'invalid-result' }); return this.snapshot; }
    this.commit({ ...this.current, status: 'loading', stale: true, error: undefined });
    try {
      const authorized = await definition.authorize(context, safeParameters);
      if (!isCurrent()) return this.snapshot;
      if (!authorized) { this.revoke(); return this.snapshot; }
      const result = await definition.execute(safeParameters, context, controller.signal);
      if (!isCurrent()) return this.snapshot;
      const stillAuthorized = await definition.authorize(context, safeParameters);
      if (!isCurrent()) return this.snapshot;
      if (!stillAuthorized) { this.revoke(); return this.snapshot; }
      let safeResult: DashboardQueryResult;
      try {
        safeResult = admitJson(result, definition.maxBytes);
        if (!validResult(safeResult, definition.maxRows)) throw new Error('Invalid result');
      } catch {
        this.commit({ ...this.current, status: 'error', stale: true, error: 'invalid-result' });
        return this.snapshot;
      }
      this.commit({ status: safeResult.partial ? 'partial' : Array.isArray(safeResult.data) && safeResult.data.length === 0 ? 'empty' : 'ready', result: safeResult, receivedAt: this.now(), stale: Boolean(safeResult.partial) });
    } catch {
      if (isCurrent()) this.commit({ ...this.current, status: 'error', stale: true, error: 'query-failed' });
    }
    return this.snapshot;
  }
  dispose(): void {
    this.invalidate();
    this.disposed = true;
    this.current = { status: 'idle', stale: true };
    this.listeners.clear();
    this.offRevoke();
  }
}

export interface GroundedDashboardValue { readonly verified: boolean; readonly source?: DashboardSourceRecord }
export function resolveDashboardLineage(result: DashboardQueryResult, pointer: string): GroundedDashboardValue {
  const admitted = snapshotJson(result, { maxBytes: 4_194_304 });
  if (!admitted.ok) return { verified: false };
  result = admitted.value as unknown as DashboardQueryResult;
  if (!validResult(result, 100_000)) return { verified: false };
  if (!readPointer(result.data, pointer).ok) return { verified: false };
  const sourceId = result.lineage?.[pointer];
  const source = result.sources?.find(record => record.id === sourceId);
  return source ? { verified: true, source: { ...source } } : { verified: false };
}

export type DashboardOverflowPolicy = 'reject' | 'drop-oldest' | 'drop-newest';
export interface DashboardQueueOptions { readonly maxItems: number; readonly maxBytes: number; readonly batchSize: number; readonly overflow: DashboardOverflowPolicy }
/** Pull-based batches provide backpressure without starting timers or retaining consumer callbacks. */
export class DashboardDataQueue<T extends JsonValue> {
  private readonly items: { value: T; bytes: number }[] = [];
  private retainedBytes = 0;
  private droppedCount = 0;
  private closed = false;
  private readonly options: DashboardQueueOptions;
  constructor(options: DashboardQueueOptions) {
    if (![options.maxItems, options.maxBytes, options.batchSize].every(value => Number.isSafeInteger(value) && value > 0) || !['reject', 'drop-oldest', 'drop-newest'].includes(options.overflow)) throw new Error('Invalid queue limits');
    this.options = { ...options };
  }
  get metrics(): { readonly items: number; readonly bytes: number; readonly dropped: number } { return { items: this.items.length, bytes: this.retainedBytes, dropped: this.droppedCount }; }
  push(value: T): boolean {
    if (this.closed) return false;
    let admitted: T;
    try { admitted = admitJson(value, this.options.maxBytes); } catch { this.droppedCount++; return false; }
    const encoded = JSON.stringify(admitted);
    const bytes = new TextEncoder().encode(encoded).byteLength;
    if (bytes > this.options.maxBytes) { this.droppedCount++; return false; }
    const full = () => this.items.length >= this.options.maxItems || this.retainedBytes + bytes > this.options.maxBytes;
    if (full() && this.options.overflow !== 'drop-oldest') { this.droppedCount++; return false; }
    while (full()) { const dropped = this.items.shift()!; this.retainedBytes -= dropped.bytes; this.droppedCount++; }
    this.items.push({ value: JSON.parse(encoded) as T, bytes });
    this.retainedBytes += bytes;
    return true;
  }
  takeBatch(): readonly T[] {
    const batch = this.items.splice(0, this.options.batchSize);
    for (const item of batch) this.retainedBytes -= item.bytes;
    return batch.map(item => item.value);
  }
  dispose(): void { this.closed = true; this.items.length = 0; this.retainedBytes = 0; }
}

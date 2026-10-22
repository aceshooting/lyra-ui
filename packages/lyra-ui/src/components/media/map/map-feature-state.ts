import { isPlainDataRecord } from '../../../internal/data-descriptors.js';

export type LyraMapFeatureStateValue = null | boolean | number | string | readonly LyraMapFeatureStateValue[] | { readonly [key: string]: LyraMapFeatureStateValue };
export type LyraMapFeatureState = Readonly<Record<string, LyraMapFeatureStateValue>>;
export interface LyraMapFeatureIdentifier { readonly source: string; readonly sourceLayer?: string; readonly id: string | number; }
export interface MapFeatureStateRetirement { readonly target: LyraMapFeatureIdentifier; readonly keys: readonly string[]; }
export interface MapFeatureStatePeer {
  getSource(id: string): unknown;
  setFeatureState(target: LyraMapFeatureIdentifier, state: LyraMapFeatureState): unknown;
  removeFeatureState(target: LyraMapFeatureIdentifier, key: string): unknown;
}
export type MapFeatureStateIssue = 'invalid-input' | 'unknown-source' | 'limit' | 'reentrant' | 'cancelled' | 'disposed' | 'missing-source' | 'peer-error';
export interface MapFeatureStateResult { readonly accepted: boolean; readonly code?: MapFeatureStateIssue; }
export interface MapFeatureStateReplayResult extends MapFeatureStateResult {
  readonly applied: number;
  readonly diagnostics: readonly { readonly code: MapFeatureStateIssue; readonly target?: LyraMapFeatureIdentifier }[];
}
const badKey = (key: string) => key === '__proto__' || key === 'constructor' || key === 'prototype';
const name = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 1024;
function own(input: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(input, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new TypeError('Expected own data');
  return descriptor.value;
}
function record(input: unknown, maximum: number): readonly string[] {
  if (!isPlainDataRecord(input)) throw new TypeError('Expected plain data');
  const keys = Reflect.ownKeys(input);
  if (keys.length > maximum || keys.some((key) => typeof key !== 'string' || badKey(key))) throw new TypeError('Invalid data keys');
  return keys as string[];
}
function targetOf(input: unknown): LyraMapFeatureIdentifier {
  const keys = record(input, 3); if (keys.some((key) => !['source', 'sourceLayer', 'id'].includes(key))) throw new TypeError('Invalid feature identity');
  const source = own(input as object, 'source'), id = own(input as object, 'id');
  const sourceLayer = keys.includes('sourceLayer') ? own(input as object, 'sourceLayer') : undefined;
  if (!name(source) || !(typeof id === 'string' && id.length <= 1024 || typeof id === 'number' && Number.isFinite(id)) || (keys.includes('sourceLayer') && !name(sourceLayer))) throw new TypeError('Invalid feature identity');
  return Object.freeze(sourceLayer === undefined ? { source, id } : { source, sourceLayer: sourceLayer as string, id });
}
const keyOf = (target: LyraMapFeatureIdentifier) => JSON.stringify([target.source, target.sourceLayer ?? null, target.id]);
function stateOf(input: unknown): { state: LyraMapFeatureState; nodes: number; text: number } {
  let nodes = 0; const active = new WeakSet<object>();
  const visit = (value: unknown, depth: number): LyraMapFeatureStateValue => {
    if (++nodes > 1024 || depth > 8) throw new RangeError('State limit');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.length <= 4096) return value;
    if (typeof value !== 'object' || value === null || active.has(value)) throw new TypeError('Invalid state value');
    active.add(value);
    let result: LyraMapFeatureStateValue;
    if (Array.isArray(value)) {
      const length = own(value, 'length'); if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || length > 256) throw new RangeError('State array limit');
      if (Reflect.ownKeys(value).length !== length + 1) throw new TypeError('Invalid state array');
      const rows: LyraMapFeatureStateValue[] = []; for (let index = 0; index < length; index++) rows.push(visit(own(value, String(index)), depth + 1));
      result = Object.freeze(rows);
    } else {
      const keys = record(value, 64); const row: Record<string, LyraMapFeatureStateValue> = {};
      for (const key of keys) { if (!key.length || key.length > 256) throw new TypeError('Invalid state key'); row[key] = visit(own(value, key), depth + 1); }
      result = Object.freeze(row);
    }
    active.delete(value); return result;
  };
  record(input, 64); const state = visit(input, 0) as LyraMapFeatureState;
  return { state, nodes, text: JSON.stringify(state).length };
}
interface Entry { readonly target: LyraMapFeatureIdentifier; readonly state: LyraMapFeatureState; readonly removed: ReadonlySet<string>; readonly nodes: number; readonly text: number; dirty: boolean; }
const result = (code?: MapFeatureStateIssue): MapFeatureStateResult => Object.freeze(code ? { accepted: false, code } : { accepted: true });

/**
 * Bounded desired feature state owned by one map component. Writes merge own JSON data; get reads
 * retained state, not arbitrary peer mutations. Explicit replay applies changes after sources are
 * ready. The owner supplies stable logical source identity across style swaps and changes it when
 * replacing a dataset. Removal touches only owned keys, preserving unrelated peer state.
 */
export class MapFeatureStateStore {
  private sources = new Map<string, unknown>();
  private entries = new Map<string, Entry>();
  private epoch = 0;
  private busy = false;
  private disposed = false;
  private peer?: MapFeatureStatePeer;
  private generation: unknown;
  private run(action: (current: () => boolean) => MapFeatureStateResult): MapFeatureStateResult {
    if (this.disposed) return result('disposed'); if (this.busy) return result('reentrant');
    this.busy = true; const epoch = this.epoch; const current = () => !this.disposed && epoch === this.epoch;
    try { return action(current); } catch { return result(current() ? 'invalid-input' : 'cancelled'); } finally { this.busy = false; }
  }
  /** Atomically replace logical sources. Removed or changed identities discard their state. */
  setSources(input: unknown): MapFeatureStateResult {
    return this.run((current) => {
      if (!Array.isArray(input)) return result('invalid-input');
      const length = own(input, 'length'); if (typeof length !== 'number' || length > 256 || !Number.isSafeInteger(length) || length < 0) return result('limit');
      const next = new Map<string, unknown>();
      for (let index = 0; index < length; index++) {
        const value = own(input, String(index)), keys = record(value, 2);
        if (keys.length !== 2 || !keys.includes('source') || !keys.includes('identity')) return result('invalid-input');
        const source = own(value as object, 'source'), identity = own(value as object, 'identity');
        if (!name(source) || identity === undefined || next.has(source)) return result('invalid-input'); next.set(source, identity);
      }
      if (!current()) return result('cancelled');
      for (const [key, entry] of this.entries) if (!next.has(entry.target.source) || !Object.is(next.get(entry.target.source), this.sources.get(entry.target.source))) this.entries.delete(key);
      this.sources = next; return result();
    });
  }
  private retain(target: LyraMapFeatureIdentifier, state: LyraMapFeatureState, removed: ReadonlySet<string>): MapFeatureStateResult {
    const key = keyOf(target), snapshot = stateOf(state);
    if (new Set([...Object.keys(state), ...removed]).size > 64) return result('limit');
    const entry: Entry = { target, ...snapshot, removed, dirty: true };
    let nodes = snapshot.nodes, text = snapshot.text + key.length + [...removed].join('').length;
    for (const [otherKey, other] of this.entries) if (otherKey !== key) { nodes += other.nodes; text += other.text + otherKey.length + [...other.removed].join('').length; }
    if ((!this.entries.has(key) && this.entries.size >= 1024) || nodes > 65536 || text > 1024 * 1024) return result('limit');
    this.entries.set(key, entry); return result();
  }
  set(input: unknown, patch: unknown): MapFeatureStateResult {
    return this.run((current) => {
      const target = targetOf(input), snapshot = stateOf(patch);
      if (!current()) return result('cancelled'); if (!this.sources.has(target.source)) return result('unknown-source');
      const old = this.entries.get(keyOf(target)), state = { ...old?.state, ...snapshot.state }, removed = new Set(old?.removed);
      for (const key of Object.keys(snapshot.state)) removed.delete(key);
      if (!Object.keys(state).length && !removed.size) return result();
      return this.retain(target, state, removed);
    });
  }
  get(input: unknown): LyraMapFeatureState | undefined {
    let value: LyraMapFeatureState | undefined;
    this.run((current) => { const target = targetOf(input); if (!current()) return result('cancelled'); const state = this.entries.get(keyOf(target))?.state; if (state && Object.keys(state).length) value = state; return result(); });
    return value;
  }
  remove(input: unknown, property?: string): MapFeatureStateResult {
    return this.run((current) => {
      const target = targetOf(input); if (property !== undefined && (typeof property !== 'string' || !property.length || property.length > 256 || badKey(property))) return result('invalid-input');
      if (!current()) return result('cancelled'); const old = this.entries.get(keyOf(target)); if (!old) return result();
      const state = { ...old.state }, removed = new Set(old.removed);
      for (const key of property === undefined ? Object.keys(state) : [property]) if (Object.hasOwn(state, key)) { delete state[key]; removed.add(key); }
      return this.retain(target, state, removed);
    });
  }
  /** Snapshot owned keys and pending removals before retiring a logical source. */
  sourceRetirements(source: string): readonly MapFeatureStateRetirement[] {
    const retired: MapFeatureStateRetirement[] = [];
    for (const entry of this.entries.values()) if (entry.target.source === source) {
      retired.push(Object.freeze({ target: entry.target, keys: Object.freeze([...new Set([...Object.keys(entry.state), ...entry.removed])]) }));
    }
    return Object.freeze(retired);
  }
  /** Call before the peer removes or replaces a source, including replacement under the same ID. */
  invalidateSource(source: string): void { this.epoch++; this.sources.delete(source); for (const [key, entry] of this.entries) if (entry.target.source === source) this.entries.delete(key); }
  /** Cancel current replay on style/disconnection changes while retaining logical desired state. */
  cancel(): void { this.epoch++; }
  dispose(): void { this.cancel(); this.disposed = true; this.peer = undefined; this.generation = undefined; this.entries.clear(); this.sources.clear(); }
  replay(peer: MapFeatureStatePeer, generation: unknown, signal?: AbortSignal): MapFeatureStateReplayResult {
    let applied = 0; const diagnostics: { code: MapFeatureStateIssue; target?: LyraMapFeatureIdentifier }[] = [];
    const outcome = this.run((valid) => {
      const current = () => valid() && !signal?.aborted;
      if (!current()) return result('cancelled');
      const getSource = own(peer, 'getSource'), setState = own(peer, 'setFeatureState'), removeState = own(peer, 'removeFeatureState');
      if (!current()) return result('cancelled');
      if (typeof getSource !== 'function' || typeof setState !== 'function' || typeof removeState !== 'function') return result('invalid-input');
      if (this.peer !== peer || !Object.is(this.generation, generation)) {
        this.peer = peer; this.generation = generation;
        for (const [key, entry] of this.entries) {
          if (!Object.keys(entry.state).length) this.entries.delete(key);
          else this.entries.set(key, { ...entry, removed: new Set(), dirty: true });
        }
      }
      for (const [key, entry] of this.entries) {
        if (!current()) return result('cancelled'); if (!entry.dirty) continue;
        try {
          const exists = getSource.call(peer, entry.target.source); if (!current()) return result('cancelled');
          if (!exists) { diagnostics.push({ code: 'missing-source', target: entry.target }); continue; }
          for (const property of entry.removed) { removeState.call(peer, entry.target, property); if (!current()) return result('cancelled'); }
          if (Object.keys(entry.state).length) { setState.call(peer, entry.target, entry.state); if (!current()) return result('cancelled'); }
          if (!Object.keys(entry.state).length) this.entries.delete(key); else this.entries.set(key, { ...entry, removed: new Set(), dirty: false });
          applied++;
        } catch { if (!current()) return result('cancelled'); diagnostics.push({ code: 'peer-error', target: entry.target }); }
      }
      return result();
    });
    if (outcome.code) diagnostics.push({ code: outcome.code });
    return Object.freeze({ ...outcome, applied, diagnostics: Object.freeze(diagnostics.map((entry) => Object.freeze(entry))) });
  }
}

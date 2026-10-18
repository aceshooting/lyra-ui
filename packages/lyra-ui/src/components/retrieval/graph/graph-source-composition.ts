import type { LyraGraphRecord, LyraGraphSourceQuery, LyraSourceRecord } from '../../../data-sources.js';
import type { LyraGraphNode, LyraGraphEdge } from './graph-model.js';

type Record = LyraSourceRecord<LyraGraphRecord<LyraGraphNode, LyraGraphEdge & { readonly id: string }>>;
/** Accepted child-owned query snapshot; current must be checked before each effect. @internal */
export interface GraphSourceCompositionSnapshot {
  readonly query: LyraGraphSourceQuery;
  readonly page: number;
  readonly pageSize: number;
  readonly total: number | null;
  readonly current: () => boolean;
}
/** Explorer toolbar composition; not a provider or consumer query API. @internal */
export interface GraphSourceCompositionProfile {
  readonly search: string;
  readonly nodeTypes: readonly string[];
  readonly empty: boolean;
  readonly accepted: (snapshot: GraphSourceCompositionSnapshot) => void;
}
/** Bounded lookup shares the graph's selection lane. @internal */
export interface GraphSourceCompositionLookup {
  readonly records: readonly Record[];
  readonly current: () => boolean;
}
interface State {
  profile?: Readonly<GraphSourceCompositionProfile>;
  changed?: () => void;
  focus?: (key: string) => Promise<(() => boolean) | undefined>;
  resolve?: (keys: readonly string[]) => Promise<GraphSourceCompositionLookup | undefined>;
}
const states = new WeakMap<object, State>();
/** Install or remove the sole parent toolbar. @internal */
export function setGraphSourceComposition(host: object, profile: GraphSourceCompositionProfile | undefined): void {
  const state = states.get(host) ?? {};
  const old = state.profile;
  if (profile) {
    if (typeof profile.search !== 'string' || profile.search.length > 65_536 || profile.nodeTypes.length > 500) throw new RangeError('Invalid graph composition filter');
    let units = 0;
    for (const type of profile.nodeTypes) if (typeof type !== 'string' || !type.trim() || type.length > 65_536 || (units += type.length) > 2_000_000) throw new RangeError('Invalid graph composition type');
  }
  if (old === profile || (old && profile && old.search === profile.search && old.empty === profile.empty && old.accepted === profile.accepted && old.nodeTypes.length === profile.nodeTypes.length && old.nodeTypes.every((type, index) => type === profile.nodeTypes[index]))) return;
  state.profile = profile ? Object.freeze({ ...profile, nodeTypes: Object.freeze([...profile.nodeTypes]) }) : undefined;
  states.set(host, state); state.changed?.();
}
/** Uses the existing child lookup lane; never enumerates source records. @internal */
export function resolveGraphSourceComposition(host: object, keys: readonly string[]): Promise<GraphSourceCompositionLookup | undefined> {
  if (keys.length > 32 || keys.some(key => typeof key !== 'string' || key.length > 65_536 || !/^(node|edge):.+/s.test(key))) return Promise.resolve(undefined);
  const state = states.get(host);
  return state?.profile && !state.profile.empty ? state.resolve?.(Object.freeze([...keys])) ?? Promise.resolve(undefined) : Promise.resolve(undefined);
}
/** Waits for the child scene and camera/row without opening a parent overlay. @internal */
export function focusGraphSourceComposition(host: object, key: string): Promise<(() => boolean) | undefined> {
  const state = states.get(host);
  if (!state?.profile || state.profile.empty || !key.startsWith('node:') || key.length > 65_536) return Promise.resolve(undefined);
  return state.focus?.(key) ?? Promise.resolve(undefined);
}
/** Private per-graph endpoint. @internal */
export class GraphSourceCompositionController {
  constructor(private readonly host: object, changed: () => void, resolve: NonNullable<State['resolve']>, focus: NonNullable<State['focus']>) {
    const state = states.get(host) ?? {}; state.changed = changed; state.resolve = resolve; state.focus = focus; states.set(host, state);
  }
  get profile(): Readonly<GraphSourceCompositionProfile> | undefined { return states.get(this.host)?.profile; }
}

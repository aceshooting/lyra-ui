import { failure } from '../json-bytes.js';
import { snapshotJson, validateSchema } from '../schema.js';
import { object } from '../isolation.js';
import { parsePointer, readPointer } from '../references.js';
import { createSurfaceState, validateView, type LyraGenValidationOptions } from '../runtime.js';
import type { JsonObject, JsonValue, LyraGenCatalog, LyraGenDiagnostic, LyraGenIsolation, LyraGenResult, LyraGenView } from '../types.js';
import { applyJsonPatch, jsonPatchToViewPatch, parseJsonPatch, type LyraGenJsonPatchOperation } from './json-patch.js';

/** Default JSON Pointer of the lyra-gen container inside AG-UI shared state. */
export const LYRA_GEN_AG_UI_STATE_PATH = '/lyraGen';

/**
 * The AG-UI event members this reducer reads, typed structurally so no AG-UI package is needed.
 * `STATE_SNAPSHOT.snapshot` and `STATE_DELTA.delta` (RFC 6902) address the whole shared state;
 * `ACTIVITY_SNAPSHOT.content` and `ACTIVITY_DELTA.patch` address one activity message.
 */
export interface LyraGenAgUiEvent {
  readonly type: string;
  readonly snapshot?: unknown;
  readonly delta?: unknown;
  readonly messageId?: string;
  readonly activityType?: string;
  readonly content?: unknown;
  readonly patch?: unknown;
  readonly replace?: boolean;
}

export interface LyraGenAgUiViewReducerOptions extends LyraGenValidationOptions {
  readonly catalog: LyraGenCatalog;
  /** The one surface this reducer owns; a container view for another surface is rejected. */
  readonly surfaceId: string;
  /**
   * JSON Pointer of the container `{ view, liveData, bindingState }` inside shared state; defaults
   * to `/lyraGen`, and `''` makes the whole shared state the container.
   */
  readonly statePath?: string;
  /** When set, `ACTIVITY_SNAPSHOT`/`ACTIVITY_DELTA` events of this activity type carry the container as their content. */
  readonly activityType?: string;
}

export type LyraGenAgUiViewStatus = 'idle' | 'ready' | 'rejected';
export interface LyraGenAgUiViewState {
  /** `'rejected'` keeps the previous valid view, live data and binding state; `diagnostics` say why. */
  readonly status: LyraGenAgUiViewStatus;
  readonly view?: LyraGenView;
  /** Host-published live data for `lr-gen-view.liveData`, bounded JSON. */
  readonly liveData?: JsonValue;
  /** Values for `lr-gen-view.bindingState`: only the view's bound paths, each checked against its property schema. */
  readonly bindingState?: JsonValue;
  readonly isolated?: readonly LyraGenIsolation[];
  readonly diagnostics: readonly LyraGenDiagnostic[];
  /** The activity message currently carrying the container, when activity events are used. */
  readonly activityMessageId?: string;
}
export interface LyraGenAgUiViewReducer {
  readonly initial: LyraGenAgUiViewState;
  /** Returns `state` itself for an ignored event, so hosts can compare by identity. */
  reduce(state: LyraGenAgUiViewState, event: unknown): LyraGenAgUiViewState;
}

const INITIAL: LyraGenAgUiViewState = Object.freeze({ status: 'idle', diagnostics: Object.freeze([]) });
type Container = { view?: JsonValue; liveData?: JsonValue; bindingState?: JsonValue };

const stringMember = (source: object, key: string): string | undefined => {
  const descriptor = Object.getOwnPropertyDescriptor(source, key);
  return descriptor && 'value' in descriptor && typeof descriptor.value === 'string' ? descriptor.value : undefined;
};
const member = (source: object, key: string): { readonly value: unknown } | undefined => {
  const descriptor = Object.getOwnPropertyDescriptor(source, key);
  return descriptor && 'value' in descriptor ? { value: descriptor.value } : undefined;
};
const sameJson = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(left) !== Array.isArray(right)) return false;
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && sameJson(a[key], b[key]));
};

/**
 * A synchronous reducer from AG-UI events to validated lyra-gen render inputs. Shared state (or an
 * activity's content) carries `{ view, liveData, bindingState }` at `statePath`; snapshots are
 * admitted in full and deltas go through `jsonPatchToViewPatch`, so every lyra-gen guard applies.
 * A snapshot or wholesale view replacement must not lower the revision (an equal revision must be
 * identical); a delta inside the view advances it by exactly one, so agents either omit
 * `/revision` or replace it with the next value. Unknown events, other state keys and other
 * activity types are ignored; an invalid event yields `status: 'rejected'` with diagnostics and
 * keeps the previous valid values. Start a new session from `initial`.
 */
export function createAgUiViewReducer(options: LyraGenAgUiViewReducerOptions): LyraGenAgUiViewReducer {
  const statePath = options.statePath ?? LYRA_GEN_AG_UI_STATE_PATH;
  if (typeof options.surfaceId !== 'string' || !options.surfaceId || !parsePointer(statePath).ok) throw new TypeError('The AG-UI reducer needs a surface identity and a safe state path.');
  const { catalog } = options;
  const validation: LyraGenValidationOptions = { ...(options.limits ? { limits: options.limits } : {}), ...(options.recovery ? { recovery: options.recovery } : {}) };
  const reject = (state: LyraGenAgUiViewState, diagnostics: readonly LyraGenDiagnostic[]): LyraGenAgUiViewState => Object.freeze({ ...state, status: 'rejected', diagnostics: Object.freeze([...diagnostics]) });

  const admitBindingState = (view: LyraGenView | undefined, supplied: JsonValue | undefined): LyraGenResult<JsonValue | undefined> => {
    if (supplied === undefined || !view) return { ok: true, value: undefined, diagnostics: [] };
    const state = createSurfaceState(view, supplied);
    for (const [pointer, owner] of Object.entries(state.owners)) {
      const value = readPointer(supplied, pointer);
      if (!value.ok) continue;
      const schema = catalog.components[owner.type]?.properties[owner.property];
      if (!schema) return failure('state.unauthorized', 'Binding state has no catalog property schema.');
      const checked = validateSchema(value.value, schema, options.limits);
      if (!checked.ok) return checked;
    }
    return { ok: true, value: state.values, diagnostics: [] };
  };

  /** Admit a complete container; `view` must belong to this surface and not regress. */
  const admit = (state: LyraGenAgUiViewState, input: unknown, activityMessageId = state.activityMessageId): LyraGenAgUiViewState => {
    const admitted = snapshotJson(input, options.limits);
    if (!admitted.ok) return reject(state, admitted.diagnostics);
    if (!object(admitted.value)) return reject(state, failure('ag-ui.state', 'The lyra-gen state must be an object.').diagnostics);
    const container = admitted.value as Container;
    let view: LyraGenView | undefined;
    let isolated: readonly LyraGenIsolation[] | undefined;
    let diagnostics: readonly LyraGenDiagnostic[] = [];
    if (container.view !== undefined) {
      const checked = validateView(container.view, catalog, validation);
      if (!checked.ok) return reject(state, checked.diagnostics);
      if (checked.value.surfaceId !== options.surfaceId) return reject(state, failure('identity.conflict', 'The view belongs to another surface.').diagnostics);
      const current = state.view;
      if (current && (checked.value.revision < current.revision || (checked.value.revision === current.revision && !sameJson(checked.value, current)))) {
        return reject(state, failure('revision.conflict', 'A replacement view must advance the current revision.').diagnostics);
      }
      const unchanged = current && checked.value.revision === current.revision;
      view = unchanged ? current : checked.value;
      isolated = unchanged ? state.isolated : checked.isolated;
      diagnostics = checked.diagnostics;
    }
    const binding = admitBindingState(view, container.bindingState);
    if (!binding.ok) return reject(state, binding.diagnostics);
    return Object.freeze({
      status: view ? 'ready' : 'idle', diagnostics: Object.freeze([...diagnostics]),
      ...(view ? { view } : {}), ...(isolated ? { isolated } : {}),
      ...(container.liveData !== undefined ? { liveData: container.liveData } : {}),
      ...(binding.value !== undefined ? { bindingState: binding.value } : {}),
      ...(activityMessageId !== undefined ? { activityMessageId } : {}),
    } satisfies LyraGenAgUiViewState);
  };

  /** Apply container-relative operations; view-internal ones go through the identity-addressed adapter. */
  const applyDelta = (state: LyraGenAgUiViewState, operations: readonly LyraGenJsonPatchOperation[]): LyraGenAgUiViewState => {
    if (operations.length === 0) return state;
    const inView = (pointer: string): boolean => pointer.startsWith('/view/');
    const outsideView = (pointer: string): boolean => pointer !== '' && pointer !== '/view' && !inView(pointer);
    const scoped = operations.every(operation => {
      const from = 'from' in operation ? operation.from : undefined;
      return inView(operation.path) ? from === undefined || inView(from) : outsideView(operation.path) && (from === undefined || outsideView(from));
    });
    const current: Container = {
      ...(state.view ? { view: state.view as unknown as JsonValue } : {}),
      ...(state.liveData !== undefined ? { liveData: state.liveData } : {}),
      ...(state.bindingState !== undefined ? { bindingState: state.bindingState } : {}),
    };
    if (!scoped) {
      const patched = applyJsonPatch(current as JsonObject, operations, options.limits);
      return patched.ok ? admit(state, patched.value) : reject(state, patched.diagnostics);
    }
    const viewOperations = operations.filter(operation => inView(operation.path)).map(operation => ({
      ...operation, path: operation.path.slice('/view'.length), ...('from' in operation ? { from: operation.from.slice('/view'.length) } : {}),
    }));
    const dataOperations = operations.filter(operation => !inView(operation.path));
    let view = state.view;
    let isolated = state.isolated;
    let diagnostics: readonly LyraGenDiagnostic[] = [];
    if (viewOperations.length) {
      if (!view) return reject(state, failure('ag-ui.baseline', 'A view delta needs an admitted view.').diagnostics);
      const next = jsonPatchToViewPatch(view, viewOperations, catalog, validation);
      if (!next.ok) return reject(state, next.diagnostics);
      if (next.value !== view) { view = next.value; isolated = next.isolated; }
      diagnostics = next.diagnostics;
    }
    let data: Container = { ...current };
    delete data.view;
    if (dataOperations.length) {
      const patched = applyJsonPatch(data as JsonObject, dataOperations, options.limits);
      if (!patched.ok) return reject(state, patched.diagnostics);
      data = patched.value as Container;
    }
    const binding = admitBindingState(view, data.bindingState);
    if (!binding.ok) return reject(state, binding.diagnostics);
    return Object.freeze({
      status: view ? 'ready' : 'idle', diagnostics: Object.freeze([...diagnostics]),
      ...(view ? { view } : {}), ...(isolated ? { isolated } : {}),
      ...(data.liveData !== undefined ? { liveData: data.liveData } : {}),
      ...(binding.value !== undefined ? { bindingState: binding.value } : {}),
      ...(state.activityMessageId !== undefined ? { activityMessageId: state.activityMessageId } : {}),
    } satisfies LyraGenAgUiViewState);
  };

  /** Rewrite shared-state operations relative to the container; operations elsewhere are dropped. */
  const relative = (state: LyraGenAgUiViewState, operations: readonly LyraGenJsonPatchOperation[]): LyraGenJsonPatchOperation[] | LyraGenAgUiViewState => {
    const rebase = (pointer: string): string | null | undefined => {
      if (pointer === statePath) return '';
      if (statePath === '' || pointer.startsWith(statePath + '/')) return pointer.slice(statePath.length);
      return statePath.startsWith(pointer + '/') || pointer === '' ? null : undefined;
    };
    const result: LyraGenJsonPatchOperation[] = [];
    for (const operation of operations) {
      const path = rebase(operation.path);
      const from = 'from' in operation ? rebase(operation.from) : undefined;
      if (path === null || from === null || ('from' in operation && (path === undefined) !== (from === undefined) && !(operation.op === 'copy' && path === undefined))) {
        return reject(state, failure('ag-ui.delta-scope', 'A state delta must replace the lyra-gen state as a whole or stay inside it.').diagnostics);
      }
      if (path === undefined) continue;
      result.push(Object.freeze({ ...operation, path, ...('from' in operation ? { from: from! } : {}) }));
    }
    return result;
  };

  const reduce = (state: LyraGenAgUiViewState, event: unknown): LyraGenAgUiViewState => {
    if (event === null || typeof event !== 'object') return state;
    const type = stringMember(event, 'type');
    if (type === 'STATE_SNAPSHOT') {
      const snapshot = member(event, 'snapshot');
      if (!snapshot) return state;
      const container = snapshot.value === null || typeof snapshot.value !== 'object' ? undefined : readPointer(snapshot.value as JsonValue, statePath);
      if (!container?.ok) return state.status === 'idle' && !state.view && state.liveData === undefined ? state : Object.freeze({ ...INITIAL, ...(state.activityMessageId !== undefined ? { activityMessageId: state.activityMessageId } : {}) });
      return admit(state, container.value);
    }
    if (type === 'STATE_DELTA') {
      const delta = member(event, 'delta');
      if (!delta) return state;
      const parsed = parseJsonPatch(delta.value, options.limits);
      if (!parsed.ok) return reject(state, parsed.diagnostics);
      const operations = relative(state, parsed.value);
      return Array.isArray(operations) ? applyDelta(state, operations) : operations as LyraGenAgUiViewState;
    }
    if (!options.activityType || stringMember(event, 'activityType') !== options.activityType) return state;
    const messageId = stringMember(event, 'messageId');
    if (!messageId) return state;
    if (type === 'ACTIVITY_SNAPSHOT') {
      const content = member(event, 'content');
      if (!content || (member(event, 'replace')?.value === false && state.activityMessageId === messageId)) return state;
      return admit(state, content.value, messageId);
    }
    if (type === 'ACTIVITY_DELTA' && messageId === state.activityMessageId) {
      const patch = member(event, 'patch');
      if (!patch) return state;
      const parsed = parseJsonPatch(patch.value, options.limits);
      return parsed.ok ? applyDelta(state, parsed.value) : reject(state, parsed.diagnostics);
    }
    return state;
  };
  return Object.freeze({ initial: INITIAL, reduce });
}

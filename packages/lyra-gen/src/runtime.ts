import { failure } from './json-bytes.js';
import { escapePointerSegment, isSafeKey, snapshotJson, validateSchema, resolveLimits } from './schema.js';
import { REPAIRABLE_DIAGNOSTIC_CODES as repairableCodes, isNodeMember, isValidatedView, object, validateCanonicalView, validatePatchedView } from './isolation.js';
import { parsePointer, readPointer } from './references.js';
import { LYRA_GEN_ISOLATED_TYPE } from './isolation.js';
import type { JsonValue, LyraGenAction, LyraGenCatalog, LyraGenDiagnostic, LyraGenLimits, LyraGenNode, LyraGenRecoveryMode, LyraGenResult, LyraGenValidationResult, LyraGenView } from './types.js';

export interface LyraGenValidationOptions {
  readonly limits?: Partial<LyraGenLimits>;
  /** `'strict'` (default) rejects any error; `'isolate'` replaces component-local failures in place and rejects everything else. */
  readonly recovery?: LyraGenRecoveryMode;
}
/** Only content failures may be submitted to an explicit host repair request. */
export const REPAIRABLE_DIAGNOSTIC_CODES: readonly string[] = repairableCodes;

/** Normalize only bounded plain JSON, then pass the canonical shape through full admission again. */
function normalizeNode(value: JsonValue, catalog: LyraGenCatalog, path: string, warn: (path: string, target: string) => void): JsonValue {
  if (!object(value) || typeof value['type'] !== 'string' || !Object.hasOwn(catalog.components, value['type'])) return value;
  const role = catalog.components[value['type']]!;
  const node = { ...value };
  const original = node['props'];
  if (original === undefined || object(original)) {
    const props = { ...original };
    const move = (source: string, target: string): void => {
      props[target] = node[source]!;
      delete node[source];
      node['props'] = props;
      warn(path + '/' + escapePointerSegment(source), target);
    };
    for (const key of Object.keys(node)) {
      if (!isNodeMember(key) && Object.hasOwn(role.properties, key) && !Object.hasOwn(props, key)) move(key, key);
    }
    if (!role.text && typeof node['text'] === 'string') {
      const target = ['caption', 'description'].find(key => Object.hasOwn(role.properties, key) && (!Object.hasOwn(props, key) || props[key] === ''));
      if (target) move('text', target);
    }
  }
  if (Array.isArray(node['children'])) {
    node['children'] = node['children'].map((child, index) => normalizeNode(child, catalog, path + '/children/' + index, warn));
  }
  return node;
}

/**
 * Validate the whole generated boundary; identities and security failures are never repaired.
 * With `recovery: 'isolate'`, component-local failures (see `classifyDiagnostic`) replace only their
 * outermost failing node by an isolation marker and are reported in `isolated`; any other failure
 * rejects exactly as strict mode does. Components with `expand` are expanded into their primitive
 * nodes, which the returned view contains.
 */
export function validateView(input: unknown, catalog: LyraGenCatalog, options: LyraGenValidationOptions & { readonly normalize?: boolean } = {}): LyraGenValidationResult {
  if (!options.normalize) return validateCanonicalView(input, catalog, options);
  const snapshot = snapshotJson(input, options.limits);
  if (!snapshot.ok) return snapshot;
  const source = snapshot.value;
  const warnings: LyraGenDiagnostic[] = [];
  const limit = resolveLimits(options.limits).maxDiagnostics;
  const normalized = object(source) && source['root'] !== undefined ? {
    ...source,
    root: normalizeNode(source['root'], catalog, '/root', (path, target) => {
      if (warnings.length < limit) warnings.push({ code: 'node.normalized', path, severity: 'warning', message: `Moved member into props.${target}.` });
    })
  } : source;
  const result = validateCanonicalView(normalized, catalog, options, input);
  return { ...result, diagnostics: [...result.diagnostics, ...warnings].slice(0, limit) };
}

export function findNode(view: LyraGenView, nodeId: string): LyraGenNode | undefined {
  const pending = [view.root];
  while (pending.length) { const node = pending.pop()!; if (node.id === nodeId) return node; if (node.children) pending.push(...node.children); }
  return undefined;
}

/**
 * One scoped patch operation. `replace` and `remove` address an existing node by `nodeId`; `insert`
 * adds a new node (whose id must not exist yet) under the existing `parentId`, immediately `before`
 * or `after` one of its current children, or appended last when neither is given. `set` assigns one
 * property (`prop`) of an existing node to `value`, keeping its other members and children; several
 * `set` operations may address one node, each property once. `move` relocates an existing non-root
 * node, with its subtree, under the existing `parentId`, positioned like an insert; a node cannot move
 * inside itself. Several inserts and moves under one parent apply in operation order; anchors must
 * stay in place (not removed or moved). Untouched siblings keep their object identities, and the
 * patched view is validated in full.
 */
export type LyraGenPatchOperation =
  | { readonly op: 'replace'; readonly nodeId: string; readonly node: LyraGenNode }
  | { readonly op: 'remove'; readonly nodeId: string }
  | { readonly op: 'insert'; readonly parentId: string; readonly node: LyraGenNode; readonly before?: string; readonly after?: string }
  | { readonly op: 'set'; readonly nodeId: string; readonly prop: string; readonly value: JsonValue }
  | { readonly op: 'move'; readonly nodeId: string; readonly parentId: string; readonly before?: string; readonly after?: string };
export interface LyraGenPatch { readonly surfaceId: string; readonly expectedRevision: number; readonly operations: readonly LyraGenPatchOperation[] }
type LyraGenTargetOperation = Extract<LyraGenPatchOperation, { readonly op: 'replace' | 'remove' }>;
const OPERATION_MEMBERS: Readonly<Record<string, readonly string[]>> = {
  replace: ['op', 'nodeId', 'node'], remove: ['op', 'nodeId'], insert: ['op', 'parentId', 'node', 'before', 'after'],
  set: ['op', 'nodeId', 'prop', 'value'], move: ['op', 'nodeId', 'parentId', 'before', 'after']
};
/** A node an insert or move places under a parent, in operation order. */
interface Placement { readonly node?: LyraGenNode; readonly moved?: string; readonly before?: string; readonly after?: string }

/** Apply a single atomic revision. Untouched branches retain their object identities. */
export function applyViewPatch(view: LyraGenView, patch: LyraGenPatch, catalog: LyraGenCatalog, options: LyraGenValidationOptions = {}): LyraGenValidationResult {
  const current = validateCanonicalView(view, catalog, options);
  if (!current.ok) return current;
  // Only already-admitted immutable input can be shared with the next revision.
  if (!isValidatedView(view)) view = current.value;
  const admitted = snapshotJson(patch, options.limits);
  if (!admitted.ok) return admitted;
  const safe = admitted.value as unknown as LyraGenPatch;
  if (!object(admitted.value) || safe.surfaceId !== view.surfaceId || safe.expectedRevision !== view.revision || view.revision >= Number.MAX_SAFE_INTEGER) return failure('revision.conflict', 'The patch does not address the current surface revision.');
  if (Object.keys(safe).some(key => !['surfaceId', 'expectedRevision', 'operations'].includes(key)) || !Array.isArray(safe.operations) || safe.operations.length === 0 || safe.operations.length > 128) return failure('patch.invalid', 'Expected between one and 128 scoped operations.');
  // One identity index replaces a tree search per operation; validated views have unique ids.
  const index = new Map<string, { readonly node: LyraGenNode; readonly parent: LyraGenNode | undefined }>();
  const pending: (readonly [LyraGenNode, LyraGenNode | undefined])[] = [[view.root, undefined]];
  while (pending.length) {
    const [node, parent] = pending.pop()!;
    if (!index.has(node.id)) index.set(node.id, { node, parent });
    if (node.children) for (const child of node.children) pending.push([child, node]);
  }
  const targets = new Map<string, LyraGenTargetOperation>();
  const placements = new Map<string, Placement[]>();
  const insertedIds = new Set<string>();
  const assignments = new Map<string, Map<string, JsonValue>>();
  const moves = new Map<string, string>();
  const anchors: string[] = [];
  const place = (parentId: string, placement: Placement): void => { placements.set(parentId, [...(placements.get(parentId) ?? []), placement]); };
  for (const operation of safe.operations) {
    const members = object(operation) && typeof operation['op'] === 'string' && Object.hasOwn(OPERATION_MEMBERS, operation['op']) ? OPERATION_MEMBERS[operation['op']]! : undefined;
    if (!object(operation) || !members || Object.keys(operation).some(key => !members.includes(key))) return failure('patch.invalid', 'Invalid scoped operation.');
    if (operation['op'] === 'insert') {
      const { parentId, node, before, after } = operation;
      if (typeof parentId !== 'string' || !object(node) || typeof node['id'] !== 'string' || (before !== undefined && typeof before !== 'string') || (after !== undefined && typeof after !== 'string') || (before !== undefined && after !== undefined)) return failure('patch.invalid', 'An insert needs a parent, a node and at most one sibling anchor.');
      const parent = index.get(parentId)?.node;
      if (!parent) return failure('identity.conflict', 'Insert parents must exist.');
      if (index.has(node['id']) || insertedIds.has(node['id'])) return failure('identity.conflict', 'Inserted nodes need a new identity.');
      const anchor = before ?? after;
      if (anchor !== undefined && !parent.children?.some(child => child.id === anchor)) return failure('identity.conflict', 'An insert anchor must be a current child of its parent.');
      insertedIds.add(node['id']);
      if (anchor !== undefined) anchors.push(anchor);
      place(parentId, { node: node as unknown as LyraGenNode, ...(before !== undefined ? { before } : {}), ...(after !== undefined ? { after } : {}) });
      continue;
    }
    if (operation['op'] === 'set') {
      const { nodeId, prop, value } = operation;
      if (typeof nodeId !== 'string' || typeof prop !== 'string' || !isSafeKey(prop) || value === undefined) return failure('patch.invalid', 'A set needs a node, a property name and a value.');
      if (!index.has(nodeId)) return failure('identity.conflict', 'Patch targets must exist and be distinct.');
      const assigned = assignments.get(nodeId) ?? new Map<string, JsonValue>();
      if (assigned.has(prop)) return failure('identity.conflict', 'Each property can be set once per patch.');
      assignments.set(nodeId, assigned.set(prop, value));
      continue;
    }
    if (operation['op'] === 'move') {
      const { nodeId, parentId, before, after } = operation;
      if (typeof nodeId !== 'string' || typeof parentId !== 'string' || (before !== undefined && typeof before !== 'string') || (after !== undefined && typeof after !== 'string') || (before !== undefined && after !== undefined)) return failure('patch.invalid', 'A move needs a node, a new parent and at most one sibling anchor.');
      if (nodeId === view.root.id) return failure('patch.root', 'The root cannot be moved.');
      const parent = index.get(parentId)?.node;
      if (!index.has(nodeId) || !parent || moves.has(nodeId)) return failure('identity.conflict', 'A move needs an existing node, moved once, and an existing parent.');
      const anchor = before ?? after;
      if (anchor !== undefined && (anchor === nodeId || !parent.children?.some(child => child.id === anchor))) return failure('identity.conflict', 'A move anchor must be another current child of the new parent.');
      moves.set(nodeId, parentId);
      if (anchor !== undefined) anchors.push(anchor);
      place(parentId, { moved: nodeId, ...(before !== undefined ? { before } : {}), ...(after !== undefined ? { after } : {}) });
      continue;
    }
    if (typeof operation['nodeId'] !== 'string') return failure('patch.invalid', 'Invalid scoped operation.');
    if (targets.has(operation['nodeId']) || !index.has(operation['nodeId'])) return failure('identity.conflict', 'Patch targets must exist and be distinct.');
    if (operation['op'] === 'replace' && (!object(operation['node']) || operation['node']['id'] !== operation['nodeId'])) return failure('identity.conflict', 'Replacement must retain its target identity.');
    if (operation['op'] === 'remove' && operation['nodeId'] === view.root.id) return failure('patch.root', 'The root cannot be removed.');
    targets.set(operation['nodeId'], operation as unknown as LyraGenTargetOperation);
  }
  for (const id of [...assignments.keys(), ...moves.keys()]) if (targets.has(id)) return failure('identity.conflict', 'Patch targets must exist and be distinct.');
  // A move may not place a node inside its own subtree, directly or through other moves.
  const parentAfter = (id: string): string | undefined => moves.get(id) ?? index.get(id)?.parent?.id;
  for (const [id, parentId] of moves) {
    for (let current: string | undefined = parentId, steps = 0; current !== undefined && steps <= index.size; current = parentAfter(current), steps++) {
      if (current === id) return failure('identity.conflict', 'A node cannot move inside itself.');
    }
  }
  let conflict = false;
  for (const anchor of anchors) if (targets.get(anchor)?.op === 'remove' || moves.has(anchor)) conflict = true;
  const map = (node: LyraGenNode, ancestorTarget = false): LyraGenNode | undefined => {
    const operation = targets.get(node.id);
    const additions = placements.get(node.id);
    const assigned = assignments.get(node.id);
    if ((operation || additions || assigned) && ancestorTarget) conflict = true;
    if (additions && operation) conflict = true;
    let children = node.children?.map(child => {
      // A moved node is mapped where it lands; leaving a replaced or removed subtree overlaps it.
      if (moves.has(child.id)) { if (ancestorTarget || operation) conflict = true; return undefined; }
      return map(child, ancestorTarget || !!operation);
    }).filter((child): child is LyraGenNode => child !== undefined);
    if (operation) return operation.op === 'remove' ? undefined : operation.node;
    if (additions) {
      const next = [...(children ?? [])];
      for (const addition of additions) {
        const added = addition.moved !== undefined ? map(index.get(addition.moved)!.node, ancestorTarget) : addition.node;
        if (!added) continue;
        const anchor = addition.before ?? addition.after;
        const position = anchor === undefined ? next.length : next.findIndex(child => child.id === anchor) + (addition.after !== undefined ? 1 : 0);
        next.splice(position, 0, added);
      }
      children = next;
    }
    const reordered = children?.some((child, position) => child !== node.children?.[position]) || children?.length !== node.children?.length;
    if (!assigned && !reordered) return node;
    return Object.freeze({
      ...node,
      ...(assigned ? { props: Object.freeze({ ...node.props, ...Object.fromEntries(assigned) }) } : {}),
      ...(reordered ? { children: Object.freeze(children ?? []) } : {})
    });
  };
  const root = map(view.root)!;
  if (hasReservedType(safe.operations as unknown as JsonValue)) return failure('catalog.component', 'The reserved isolation type cannot be supplied.');
  if (conflict) return failure('identity.conflict', 'Patch targets cannot overlap their ancestors.');
  const next: LyraGenView = Object.freeze({ ...view, root, revision: view.revision + 1 });
  // Markers already present in the base view stay; the patch itself can never add one (checked above).
  return validatePatchedView(next, view, catalog, options);
}

/** Node ids a revision added, changed or removed, each in document order. */
export interface LyraGenViewChanges {
  /** Ids present only in the next view. */
  readonly added: readonly string[];
  /** Ids present in both views whose own members (type, props, text, slot, bindings, reads, liveReads, action) differ; child changes are reported on the children. */
  readonly changed: readonly string[];
  /** Ids present only in the previous view. */
  readonly removed: readonly string[];
}
const sameJson = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(left) !== Array.isArray(right)) return false;
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && sameJson(a[key], b[key]));
};
const OWN_MEMBERS = ['type', 'props', 'text', 'slot', 'bindings', 'reads', 'liveReads', 'dataQuery', 'repeat', 'itemReads', 'visible', 'checks', 'computes', 'a11y', 'action'] as const;
const sameOwnMembers = (left: LyraGenNode, right: LyraGenNode): boolean => OWN_MEMBERS.every(key => sameJson(left[key], right[key]));
const flatten = (root: LyraGenNode): LyraGenNode[] => {
  const nodes: LyraGenNode[] = [];
  const pending = [root];
  while (pending.length) { const node = pending.pop()!; nodes.push(node); if (node.children) for (let index = node.children.length - 1; index >= 0; index--) pending.push(node.children[index]!); }
  return nodes;
};
/** Compare two views of one surface by node identity; a reordered or reparented node is not changed. */
export function diffViews(previous: LyraGenView, next: LyraGenView): LyraGenViewChanges {
  const before = new Map(flatten(previous.root).map(node => [node.id, node]));
  const after = flatten(next.root);
  const seen = new Set<string>();
  const added: string[] = [];
  const changed: string[] = [];
  for (const node of after) {
    seen.add(node.id);
    const old = before.get(node.id);
    if (!old) added.push(node.id);
    else if (old !== node && !sameOwnMembers(old, node)) changed.push(node.id);
  }
  const removed = [...before.keys()].filter(id => !seen.has(id));
  return Object.freeze({ added: Object.freeze(added), changed: Object.freeze(changed), removed: Object.freeze(removed) });
}
const hasReservedType = (value: JsonValue): boolean => Array.isArray(value) ? value.some(hasReservedType) : object(value) && (value['type'] === LYRA_GEN_ISOLATED_TYPE || Object.values(value).some(hasReservedType));

export interface LyraGenStateOwner { readonly nodeId: string; readonly property: string; readonly type: string }
export interface LyraGenSurfaceState {
  readonly surfaceId: string;
  readonly revision: number;
  readonly values: JsonValue;
  readonly dirty: readonly string[];
  readonly owners: Readonly<Record<string, LyraGenStateOwner>>;
}
const indexView = (view: LyraGenView): { readonly owners: Readonly<Record<string, LyraGenStateOwner>>; readonly nodes: ReadonlyMap<string, LyraGenNode> } => {
  const owners: Record<string, LyraGenStateOwner> = {};
  const nodes = new Map<string, LyraGenNode>();
  const visit = (node: LyraGenNode): void => {
    if (!nodes.has(node.id)) nodes.set(node.id, node);
    for (const [property, pointer] of Object.entries(node.bindings ?? {})) owners[pointer] = Object.freeze({ nodeId: node.id, property, type: node.type });
    node.children?.forEach(visit);
  };
  visit(view.root);
  return { owners: Object.freeze(owners), nodes };
};
/** Apply several pointer writes on one copy-on-write draft, freezing each copied container once; the result preserves write order. */
function writePointers(root: JsonValue, writes: readonly (readonly [string, JsonValue])[]): JsonValue {
  const copies = new Set<object>();
  const draftOf = (current: JsonValue | undefined): Record<string, JsonValue> | JsonValue[] => {
    if (current !== null && typeof current === 'object' && copies.has(current)) return current as Record<string, JsonValue> | JsonValue[];
    const copy = Array.isArray(current) ? [...current] : current !== null && typeof current === 'object' ? { ...(current as Record<string, JsonValue>) } : {};
    copies.add(copy);
    return copy;
  };
  let result: JsonValue = root;
  for (const [pointer, value] of writes) {
    const parsed = parsePointer(pointer);
    if (!parsed.ok) throw new TypeError('Invalid state pointer.');
    if (parsed.value.length === 0) { result = value; continue; }
    const top = draftOf(result);
    result = top;
    let container = top;
    parsed.value.forEach((key, index) => {
      let slot: string | number = key;
      if (Array.isArray(container)) {
        slot = Number(key);
        if (!/^(0|[1-9][0-9]*)$/u.test(key) || slot > container.length) throw new TypeError('Invalid array state pointer.');
      }
      if (index === parsed.value.length - 1) { (container as Record<string | number, JsonValue>)[slot] = value; return; }
      const child = draftOf((container as Record<string | number, JsonValue>)[slot]);
      (container as Record<string | number, JsonValue>)[slot] = child;
      container = child;
    });
  }
  for (const copy of copies) Object.freeze(copy);
  return result;
}
/** Create state from a validated view, retaining only explicitly bound initial values. */
export function createSurfaceState(view: LyraGenView, initialValues: JsonValue = {}): LyraGenSurfaceState {
  const initial = snapshotJson(initialValues);
  if (!initial.ok) throw new TypeError('Initial state must be bounded JSON data.');
  const { owners, nodes } = indexView(view);
  const writes: (readonly [string, JsonValue])[] = [];
  for (const [pointer, owner] of Object.entries(owners)) {
    const supplied = readPointer(initial.value, pointer);
    const fallback = nodes.get(owner.nodeId)?.props?.[owner.property];
    if (supplied.ok || fallback !== undefined) writes.push([pointer, supplied.ok ? supplied.value : fallback!]);
  }
  const values = writePointers(Object.freeze({}), writes);
  return Object.freeze({ surfaceId: view.surfaceId, revision: view.revision, values, dirty: Object.freeze([]), owners });
}

const freezeDirtyPaths = (paths: readonly string[]): readonly string[] => Object.freeze([...new Set(paths)]);

export function setSurfaceState(state: LyraGenSurfaceState, pointer: string, value: JsonValue, expectedRevision = state.revision): LyraGenResult<LyraGenSurfaceState> {
  if (state.revision !== expectedRevision) return failure('revision.conflict', 'The state revision has advanced.');
  if (!Object.hasOwn(state.owners, pointer)) return failure('state.unauthorized', 'Only bound state paths may be edited.');
  const admitted = snapshotJson(value);
  if (!admitted.ok) return admitted;
  try {
    const values = writePointers(state.values, [[pointer, admitted.value]]);
    const checked = snapshotJson(values);
    if (!checked.ok) return checked;
    return { ok: true, value: Object.freeze({ ...state, values, dirty: freezeDirtyPaths([...state.dirty, pointer]) }), diagnostics: [] };
  } catch { return failure('state.pointer', 'State path cannot be materialized.'); }
}

export function reconcileSurfaceState(state: LyraGenSurfaceState, previous: LyraGenView, next: LyraGenView): LyraGenResult<LyraGenSurfaceState> {
  if (state.surfaceId !== previous.surfaceId || state.revision !== previous.revision || next.surfaceId !== previous.surfaceId || next.revision <= previous.revision) return failure('revision.conflict', 'State reconciliation requires the next revision of the same surface.');
  const fresh = createSurfaceState(next);
  const previousNodes = indexView(previous).nodes;
  const nextNodes = indexView(next).nodes;
  const writes: (readonly [string, JsonValue])[] = [];
  const dirty: string[] = [];
  for (const [pointer, owner] of Object.entries(fresh.owners)) {
    const old = state.owners[pointer];
    if (!old || old.nodeId !== owner.nodeId || old.property !== owner.property || old.type !== owner.type) continue;
    const retained = readPointer(state.values, pointer);
    const edited = state.dirty.includes(pointer);
    const oldDefault = previousNodes.get(owner.nodeId)?.props?.[owner.property];
    const newDefault = nextNodes.get(owner.nodeId)?.props?.[owner.property];
    if (retained.ok && (edited || JSON.stringify(oldDefault) === JSON.stringify(newDefault))) {
      writes.push([pointer, retained.value]);
      if (edited) dirty.push(pointer);
    }
  }
  const values = writePointers(fresh.values, writes);
  return { ok: true, value: Object.freeze({ ...fresh, values, dirty: Object.freeze(dirty) }), diagnostics: [] };
}

export interface LyraGenSnapshot { readonly version: '1'; readonly view: LyraGenView; readonly state: LyraGenSurfaceState }
export function createSnapshot(view: LyraGenView, state = createSurfaceState(view)): LyraGenSnapshot {
  if (state.surfaceId !== view.surfaceId || state.revision !== view.revision) throw new TypeError('Snapshot state must match its view.');
  const admitted = snapshotJson({ version: '1', view, state });
  if (!admitted.ok) throw new TypeError('Snapshot must contain bounded JSON data.');
  return admitted.value as unknown as LyraGenSnapshot;
}
export function restoreSnapshot(input: unknown, catalog: LyraGenCatalog, options: LyraGenValidationOptions = {}): LyraGenResult<LyraGenSnapshot> {
  const admitted = snapshotJson(input, options.limits);
  if (!admitted.ok) return admitted;
  const value = admitted.value;
  if (!object(value) || value['version'] !== '1' || Object.keys(value).some(key => !['version', 'view', 'state'].includes(key))) return failure('snapshot.invalid', 'Unknown snapshot format.');
  const view = validateCanonicalView(value['view'], catalog, options);
  if (!view.ok) return view;
  if (!object(value['state']) || Object.keys(value['state']).some(key => !['surfaceId', 'revision', 'values', 'dirty', 'owners'].includes(key)) || value['state']['surfaceId'] !== view.value.surfaceId || value['state']['revision'] !== view.value.revision || !Array.isArray(value['state']['dirty']) || !object(value['state']['owners'])) return failure('snapshot.state', 'Snapshot state does not match its view.');
  const state = createSurfaceState(view.value, value['state']['values'] ?? {});
  if (JSON.stringify(state.owners) !== JSON.stringify(value['state']['owners']) || JSON.stringify(state.values) !== JSON.stringify(value['state']['values']) || value['state']['dirty'].some(pointer => typeof pointer !== 'string' || !Object.hasOwn(state.owners, pointer))) return failure('state.unauthorized', 'Snapshot contains undeclared state or binding ownership.');
  for (const [pointer, owner] of Object.entries(state.owners)) {
    const supplied = readPointer(state.values, pointer);
    if (!supplied.ok) continue;
    const schema = catalog.components[owner.type]?.properties[owner.property];
    if (!schema) return failure('state.unauthorized', 'State binding has no catalog property schema.');
    const checked = validateSchema(supplied.value, schema, options.limits);
    if (!checked.ok) return checked;
  }
  const restored = Object.freeze({ ...state, dirty: freezeDirtyPaths(value['state']['dirty'] as string[]) });
  return { ok: true, value: Object.freeze({ version: '1', view: view.value, state: restored }), diagnostics: [] };
}

/** Produce context for host authorization; this helper never performs an action. */
export function createAction(view: LyraGenView, nodeId: string, catalog: LyraGenCatalog, payload?: JsonValue): LyraGenResult<LyraGenAction> {
  const checked = validateCanonicalView(view, catalog);
  if (!checked.ok) return checked;
  const node = findNode(checked.value, nodeId);
  if (!node?.action || !catalog.actions || !Object.hasOwn(catalog.actions, node.action.name)) return failure('action.unknown', 'No declared action exists for this node.');
  const validated = validateSchema(payload !== undefined ? payload : node.action.payload ?? null, catalog.actions[node.action.name]!.payload);
  return validated.ok ? { ok: true, value: Object.freeze({ surfaceId: view.surfaceId, nodeId, revision: view.revision, name: node.action.name, payload: validated.value }), diagnostics: [] } : validated;
}

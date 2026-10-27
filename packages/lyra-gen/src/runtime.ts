import { escapePointerSegment, snapshotJson, validateSchema, resolveLimits } from './schema.js';
import { isContentUrlProperty, validateContentProperties, validateFieldPurpose } from './content-policy.js';
import { parsePointer, readPointer } from './references.js';
import type { JsonValue, LyraGenAction, LyraGenCatalog, LyraGenDiagnostic, LyraGenLimits, LyraGenNode, LyraGenResult, LyraGenView } from './types.js';

export interface LyraGenValidationOptions { readonly limits?: Partial<LyraGenLimits> }
/** Only content failures may be submitted to an explicit host repair request. */
export const REPAIRABLE_DIAGNOSTIC_CODES: readonly string[] = Object.freeze(['schema.type', 'schema.enum', 'schema.length', 'schema.range', 'schema.required', 'schema.any-of', 'props.required', 'a11y.name']);
const identityPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u;
const validatedViews = new WeakSet<LyraGenView>();
const object = (value: unknown): value is Record<string, JsonValue> => value !== null && typeof value === 'object' && !Array.isArray(value);
const failure = <T>(code: string, message: string, path = ''): LyraGenResult<T> => ({ ok: false, diagnostics: [{ code, path, message, severity: 'error' }] });

/** Validate the whole generated boundary; identities and security failures are never repaired. */
export function validateView(input: unknown, catalog: LyraGenCatalog, options: LyraGenValidationOptions = {}): LyraGenResult<LyraGenView> {
  const admitted = snapshotJson(input, options.limits);
  if (!admitted.ok) return admitted;
  const view = admitted.value;
  if (!object(view)) return failure('view.invalid', 'Expected a view object.');
  if (view['version'] !== '1' || !object(view['catalog']) || view['catalog']['id'] !== catalog.id || view['catalog']['version'] !== catalog.version) return failure('view.catalog', 'View version and catalog version must match the active catalog.');
  if (Object.keys(view).some(key => !['version', 'catalog', 'surfaceId', 'revision', 'root'].includes(key)) || Object.keys(view['catalog']).some(key => !['id', 'version'].includes(key))) return failure('view.member', 'Unknown view member.');
  if (typeof view['surfaceId'] !== 'string' || !identityPattern.test(view['surfaceId']) || !Number.isSafeInteger(view['revision']) || (view['revision'] as number) < 0) return failure('identity.invalid', 'A surface needs a valid identity and nonnegative safe revision.');
  const diagnostics: LyraGenDiagnostic[] = [];
  const limits = resolveLimits(options.limits);
  const ids = new Set<string>();
  const bindings = new Set<string>();
  const bindingAncestors = new Set<string>();
  const issue = (code: string, path: string, message: string, hint?: string): void => {
    const diagnostic: LyraGenDiagnostic = { code, path, message, severity: 'error', ...(hint ? { hint } : {}) };
    if (diagnostics.length < limits.maxDiagnostics) diagnostics.push(diagnostic);
    else if (!REPAIRABLE_DIAGNOSTIC_CODES.includes(code)) diagnostics[diagnostics.length - 1] = diagnostic;
  };
  const visit = (value: JsonValue | undefined, path: string, parent?: LyraGenNode, inForm = false): void => {
    if (!object(value)) { issue('node.invalid', path, 'Expected a node object.'); return; }
    if (Object.keys(value).some(key => !['id', 'type', 'props', 'children', 'text', 'slot', 'bindings', 'action'].includes(key))) issue('node.member', path, 'Unknown node member.');
    if (typeof value['id'] !== 'string' || !identityPattern.test(value['id'])) issue('identity.invalid', `${path}/id`, 'A node needs an explicit valid identity.');
    else if (ids.has(value['id'])) issue('identity.duplicate', `${path}/id`, 'Node identities must be unique.');
    else ids.add(value['id']);
    if (typeof value['type'] !== 'string' || !Object.hasOwn(catalog.components, value['type'])) { issue('catalog.component', `${path}/type`, 'Component is not in the active catalog.'); return; }
    const component = catalog.components[value['type']]!;
    for (const diagnostic of validateFieldPurpose(value as unknown as LyraGenNode, view['surfaceId'] as string, catalog)) issue(diagnostic.code, path + diagnostic.path, diagnostic.message);
    if (component.tag === 'form' && inForm) issue('node.nested-form', path, 'Forms cannot be nested.');
    const props = value['props'] ?? {};
    if (!object(props)) issue('props.invalid', `${path}/props`, 'Properties must be an object.');
    else {
      for (const diagnostic of validateContentProperties(props, component)) issue(diagnostic.code, path + diagnostic.path, diagnostic.message);
      for (const [key, prop] of Object.entries(props)) {
        const schema = Object.hasOwn(component.properties, key) ? component.properties[key] : undefined;
        if (!schema) { issue('props.unknown', `${path}/props/${escapePointerSegment(key)}`, 'Property is not declared by the catalog.', `Allowed properties: ${Object.keys(component.properties).join(', ')}`); continue; }
        const checked = validateSchema(prop, schema, options.limits);
        if (!checked.ok) for (const diagnostic of checked.diagnostics) issue(diagnostic.code, `${path}/props/${escapePointerSegment(key)}${diagnostic.path}`, diagnostic.message);
      }
      for (const key of component.required ?? []) if (!Object.hasOwn(props, key) && !(object(value['bindings']) && Object.hasOwn(value['bindings'], key))) issue('props.required', `${path}/props/${escapePointerSegment(key)}`, 'A required property is missing.');
    }
    if (value['text'] !== undefined && (typeof value['text'] !== 'string' || !component.text)) issue('node.text', `${path}/text`, 'This component does not accept this text value.');
    if (value['slot'] !== undefined && (typeof value['slot'] !== 'string' || !parent || !(catalog.components[parent.type]?.slots ?? []).includes(value['slot']))) issue('node.slot', `${path}/slot`, 'Slot is not declared by the parent.');
    if (value['bindings'] !== undefined) {
      if (!object(value['bindings'])) issue('binding.invalid', `${path}/bindings`, 'Bindings must map properties to JSON Pointers.');
      else for (const [property, pointer] of Object.entries(value['bindings'])) {
        const bindingPath = `${path}/bindings/${escapePointerSegment(property)}`;
        if (!component.bindings || !Object.hasOwn(component.bindings, property) || typeof pointer !== 'string') { issue('binding.unknown', bindingPath, 'Binding is not declared by the catalog.'); continue; }
        if (isContentUrlProperty(property, component)) issue('content.url-binding', bindingPath, 'URL sinks cannot be state bindings.');
        const parsed = parsePointer(pointer);
        if (!parsed.ok || pointer === '') { issue('binding.pointer', bindingPath, 'Bindings need a safe non-root JSON Pointer.'); continue; }
        if (overlapsBinding(bindings, bindingAncestors, pointer)) issue('identity.binding', bindingPath, 'State paths must have exactly one nonoverlapping owner.');
        bindings.add(pointer);
        for (const ancestor of pointerAncestors(pointer)) bindingAncestors.add(ancestor);
      }
    }
    if (value['action'] !== undefined) {
      if (!object(value['action']) || Object.keys(value['action']).some(key => !['name', 'payload'].includes(key)) || typeof value['action']['name'] !== 'string' || !catalog.actions || !Object.hasOwn(catalog.actions, value['action']['name']) || !component.events?.length) issue('action.unknown', `${path}/action`, 'Action or action event is not declared by the catalog.');
      else if (value['action']['payload'] !== undefined) {
        const checked = validateSchema(value['action']['payload'] ?? null, catalog.actions[value['action']['name']]!.payload, options.limits);
        if (!checked.ok) for (const diagnostic of checked.diagnostics) issue(diagnostic.code, `${path}/action/payload${diagnostic.path}`, diagnostic.message);
      }
    }
    if (component.accessibleName?.required) {
      const named = object(props) && component.accessibleName.properties?.some(key => typeof props[key] === 'string' && (props[key] as string).trim().length > 0);
      if (!named && !(component.accessibleName.text && typeof value['text'] === 'string' && value['text'].trim())) issue('a11y.name', path, 'This component requires an accessible name.');
    }
    if (value['children'] !== undefined) {
      if (!Array.isArray(value['children'])) issue('children.invalid', `${path}/children`, 'Children must be an array.');
      else {
        if (value['children'].length && !component.children) issue('children.forbidden', `${path}/children`, 'This component does not accept children.');
        value['children'].forEach((child, index) => {
          if (Array.isArray(component.children) && object(child) && !component.children.includes(child['type'] as string)) issue('children.type', `${path}/children/${index}`, 'Child component type is not allowed here.');
          visit(child, `${path}/children/${index}`, value as unknown as LyraGenNode, inForm || component.tag === 'form');
        });
      }
    }
  };
  visit(view['root'], '/root');
  if (diagnostics.length) return { ok: false, diagnostics };
  validatedViews.add(view as unknown as LyraGenView);
  return { ok: true, value: view as unknown as LyraGenView, diagnostics: [] };
}

const pointerAncestors = function* (pointer: string): Generator<string> {
  for (let end = pointer.lastIndexOf('/'); end > 0; end = pointer.lastIndexOf('/', end - 1)) yield pointer.slice(0, end);
};
/** A pointer overlaps when it, an ancestor, or a descendant is already owned (`ancestors` holds every owned pointer's proper prefixes). */
const overlapsBinding = (owned: ReadonlySet<string>, ancestors: ReadonlySet<string>, pointer: string): boolean => {
  if (owned.has(pointer) || ancestors.has(pointer)) return true;
  for (const ancestor of pointerAncestors(pointer)) if (owned.has(ancestor)) return true;
  return false;
};

export function findNode(view: LyraGenView, nodeId: string): LyraGenNode | undefined {
  const pending = [view.root];
  while (pending.length) { const node = pending.pop()!; if (node.id === nodeId) return node; if (node.children) pending.push(...node.children); }
  return undefined;
}

export type LyraGenPatchOperation = { readonly op: 'replace'; readonly nodeId: string; readonly node: LyraGenNode } | { readonly op: 'remove'; readonly nodeId: string };
export interface LyraGenPatch { readonly surfaceId: string; readonly expectedRevision: number; readonly operations: readonly LyraGenPatchOperation[] }

/** Apply a single atomic revision. Untouched branches retain their object identities. */
export function applyViewPatch(view: LyraGenView, patch: LyraGenPatch, catalog: LyraGenCatalog, options: LyraGenValidationOptions = {}): LyraGenResult<LyraGenView> {
  const current = validateView(view, catalog, options);
  if (!current.ok) return current;
  // Only already-admitted immutable input can be shared with the next revision.
  if (!validatedViews.has(view)) view = current.value;
  const admitted = snapshotJson(patch, options.limits);
  if (!admitted.ok) return admitted;
  const safe = admitted.value as unknown as LyraGenPatch;
  if (!object(admitted.value) || safe.surfaceId !== view.surfaceId || safe.expectedRevision !== view.revision || view.revision >= Number.MAX_SAFE_INTEGER) return failure('revision.conflict', 'The patch does not address the current surface revision.');
  if (Object.keys(safe).some(key => !['surfaceId', 'expectedRevision', 'operations'].includes(key)) || !Array.isArray(safe.operations) || safe.operations.length === 0 || safe.operations.length > 128) return failure('patch.invalid', 'Expected between one and 128 scoped operations.');
  const targets = new Map<string, LyraGenPatchOperation>();
  for (const operation of safe.operations) {
    if (!object(operation) || typeof operation['op'] !== 'string' || !['replace', 'remove'].includes(operation['op']) || typeof operation['nodeId'] !== 'string' || Object.keys(operation).some(key => !['op', 'nodeId', ...(operation['op'] === 'replace' ? ['node'] : [])].includes(key))) return failure('patch.invalid', 'Invalid scoped operation.');
    if (targets.has(operation['nodeId']) || !findNode(view, operation['nodeId'])) return failure('identity.conflict', 'Patch targets must exist and be distinct.');
    if (operation['op'] === 'replace' && (!object(operation['node']) || operation['node']['id'] !== operation['nodeId'])) return failure('identity.conflict', 'Replacement must retain its target identity.');
    if (operation['op'] === 'remove' && operation['nodeId'] === view.root.id) return failure('patch.root', 'The root cannot be removed.');
    targets.set(operation['nodeId'], operation as unknown as LyraGenPatchOperation);
  }
  let conflict = false;
  const map = (node: LyraGenNode, ancestorTarget = false): LyraGenNode | undefined => {
    const operation = targets.get(node.id);
    if (operation && ancestorTarget) conflict = true;
    const children = node.children?.map(child => map(child, ancestorTarget || !!operation)).filter((child): child is LyraGenNode => child !== undefined);
    if (operation) return operation.op === 'remove' ? undefined : operation.node;
    return children?.some((child, index) => child !== node.children?.[index]) || children?.length !== node.children?.length ? Object.freeze({ ...node, children: Object.freeze(children ?? []) }) : node;
  };
  const root = map(view.root)!;
  if (conflict) return failure('identity.conflict', 'Patch targets cannot overlap their ancestors.');
  const next: LyraGenView = Object.freeze({ ...view, root, revision: view.revision + 1 });
  const checked = validateView(next, catalog, options);
  if (checked.ok) validatedViews.add(next);
  return checked.ok ? { ok: true, value: next, diagnostics: [] } : checked;
}

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
/** Apply several pointer writes on one copy-on-write draft, freezing each copied container once; the result equals sequential `writePointer` calls. */
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
function writePointer(root: JsonValue, pointer: string, value: JsonValue): JsonValue {
  const parsed = parsePointer(pointer);
  if (!parsed.ok) throw new TypeError('Invalid state pointer.');
  const write = (current: JsonValue | undefined, index: number): JsonValue => {
    if (index === parsed.value.length) return value;
    const key = parsed.value[index]!;
    const source = current !== null && typeof current === 'object' ? current : {};
    if (Array.isArray(source)) {
      const position = Number(key);
      if (!/^(0|[1-9][0-9]*)$/u.test(key) || position > source.length) throw new TypeError('Invalid array state pointer.');
      const copy = [...source]; copy[position] = write(source[position], index + 1); return Object.freeze(copy);
    }
    const sourceObject = source as Record<string, JsonValue>;
    return Object.freeze({ ...sourceObject, [key]: write(sourceObject[key], index + 1) });
  };
  return write(root, 0);
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

export function setSurfaceState(state: LyraGenSurfaceState, pointer: string, value: JsonValue, expectedRevision = state.revision): LyraGenResult<LyraGenSurfaceState> {
  if (state.revision !== expectedRevision) return failure('revision.conflict', 'The state revision has advanced.');
  if (!Object.hasOwn(state.owners, pointer)) return failure('state.unauthorized', 'Only bound state paths may be edited.');
  const admitted = snapshotJson(value);
  if (!admitted.ok) return admitted;
  try {
    const values = writePointer(state.values, pointer, admitted.value);
    const checked = snapshotJson(values);
    if (!checked.ok) return checked;
    return { ok: true, value: Object.freeze({ ...state, values, dirty: Object.freeze([...new Set([...state.dirty, pointer])]) }), diagnostics: [] };
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
  const values = writes.length ? writePointers(fresh.values, writes) : fresh.values;
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
  const view = validateView(value['view'], catalog, options);
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
  const restored = Object.freeze({ ...state, dirty: Object.freeze([...new Set(value['state']['dirty'] as string[])]) });
  return { ok: true, value: Object.freeze({ version: '1', view: view.value, state: restored }), diagnostics: [] };
}

/** Produce context for host authorization; this helper never performs an action. */
export function createAction(view: LyraGenView, nodeId: string, catalog: LyraGenCatalog, payload?: JsonValue): LyraGenResult<LyraGenAction> {
  const checked = validateView(view, catalog);
  if (!checked.ok) return checked;
  const node = findNode(checked.value, nodeId);
  if (!node?.action || !catalog.actions || !Object.hasOwn(catalog.actions, node.action.name)) return failure('action.unknown', 'No declared action exists for this node.');
  const validated = validateSchema(payload !== undefined ? payload : node.action.payload ?? null, catalog.actions[node.action.name]!.payload);
  return validated.ok ? { ok: true, value: Object.freeze({ surfaceId: view.surfaceId, nodeId, revision: view.revision, name: node.action.name, payload: validated.value }), diagnostics: [] } : validated;
}

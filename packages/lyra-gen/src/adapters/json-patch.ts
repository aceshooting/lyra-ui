import { failure } from '../json-bytes.js';
import { escapePointerSegment, resolveLimits, snapshotJson } from '../schema.js';
import { isValidatedView, object } from '../isolation.js';
import { parsePointer } from '../references.js';
import { applyViewPatch, validateView, type LyraGenPatch, type LyraGenPatchOperation, type LyraGenValidationOptions } from '../runtime.js';
import type { JsonValue, LyraGenCatalog, LyraGenLimits, LyraGenNode, LyraGenResult, LyraGenValidationResult, LyraGenView } from '../types.js';

/** One RFC 6902 operation. Members an operation does not define are ignored, as the RFC requires. */
export type LyraGenJsonPatchOperation =
  | { readonly op: 'add' | 'replace' | 'test'; readonly path: string; readonly value: JsonValue }
  | { readonly op: 'remove'; readonly path: string }
  | { readonly op: 'move' | 'copy'; readonly from: string; readonly path: string };
export type LyraGenJsonPatchOperationName = LyraGenJsonPatchOperation['op'];

/** The most operations one JSON Patch document may carry; the same ceiling as `applyViewPatch`. */
export const MAX_JSON_PATCH_OPERATIONS = 128;

type Mutable = Record<string, unknown> | unknown[];
const encoder = new TextEncoder();
const jsonBytes = (value: unknown): number => encoder.encode(JSON.stringify(value)).byteLength;
const INDEX = /^(0|[1-9][0-9]*)$/u;

const sameJson = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(left) !== Array.isArray(right)) return false;
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && sameJson(a[key], b[key]));
};

/** Admit an untrusted RFC 6902 document: bounded JSON, at most 128 operations, safe pointers only. */
export function parseJsonPatch(input: unknown, limits?: Partial<LyraGenLimits>): LyraGenResult<readonly LyraGenJsonPatchOperation[]> {
  const admitted = snapshotJson(input, limits);
  if (!admitted.ok) return admitted;
  const source = admitted.value;
  if (!Array.isArray(source) || source.length > MAX_JSON_PATCH_OPERATIONS) return failure('patch.invalid', 'Expected a JSON Patch array of at most 128 operations.');
  const operations: LyraGenJsonPatchOperation[] = [];
  for (const [index, candidate] of source.entries()) {
    const invalid = (code: string, message: string): LyraGenResult<readonly LyraGenJsonPatchOperation[]> => ({ ok: false, diagnostics: [{ code, path: '/' + index, message, severity: 'error' }] });
    if (!object(candidate) || typeof candidate['op'] !== 'string' || typeof candidate['path'] !== 'string') return invalid('patch.invalid', 'Each operation needs an op and a path.');
    const { op, path } = candidate as { op: string; path: string };
    const pointer = parsePointer(path);
    if (!pointer.ok) return invalid(pointer.diagnostics[0]!.code, 'Invalid operation path.');
    if (op === 'add' || op === 'replace' || op === 'test') {
      if (!Object.hasOwn(candidate, 'value')) return invalid('patch.invalid', 'This operation needs a value.');
      operations.push(Object.freeze({ op, path, value: candidate['value']! }));
    } else if (op === 'remove') {
      operations.push(Object.freeze({ op, path }));
    } else if (op === 'move' || op === 'copy') {
      const from = candidate['from'];
      if (typeof from !== 'string') return invalid('patch.invalid', 'This operation needs a from pointer.');
      const source = parsePointer(from);
      if (!source.ok) return invalid(source.diagnostics[0]!.code, 'Invalid operation source.');
      operations.push(Object.freeze({ op, from, path }));
    } else return invalid('patch.invalid', 'Unknown JSON Patch operation.');
  }
  return { ok: true, value: Object.freeze(operations), diagnostics: [] };
}

class PatchFailure { constructor(readonly code: string, readonly index: number, readonly message: string) {} }

/** Apply admitted operations in order to a mutable working copy, within the byte budget. */
function applyOperations(document: unknown, operations: readonly LyraGenJsonPatchOperation[], maxBytes: number): unknown {
  const box: Record<string, unknown> = { value: document };
  let bytes = jsonBytes(document);
  operations.forEach((operation, index) => {
    const fail = (code: string, message: string): never => { throw new PatchFailure(code, index, message); };
    const segments = (pointer: string): string[] => ['value', ...(parsePointer(pointer) as { value: readonly string[] }).value];
    const locate = (pointer: string): { container: Mutable; key: string } => {
      const path = segments(pointer);
      let container: unknown = box;
      for (const segment of path.slice(0, -1)) {
        container = read(container, segment);
        if (container === undefined) fail('patch.path', 'The operation path does not resolve.');
      }
      if (container === null || typeof container !== 'object') fail('patch.path', 'The operation path does not resolve to a container.');
      return { container: container as Mutable, key: path.at(-1)! };
    };
    const read = (container: unknown, key: string): unknown => {
      if (container === null || typeof container !== 'object') return undefined;
      if (Array.isArray(container)) return INDEX.test(key) && Number(key) < container.length ? container[Number(key)] : undefined;
      return Object.hasOwn(container, key) ? (container as Record<string, unknown>)[key] : undefined;
    };
    const get = (pointer: string): unknown => {
      const { container, key } = locate(pointer);
      const value = read(container, key);
      if (value === undefined) fail('patch.path', 'The operation target does not exist.');
      return value;
    };
    const grow = (value: unknown): void => {
      bytes += jsonBytes(value);
      if (bytes > maxBytes) fail('limit.bytes', 'The patched document exceeds the byte limit.');
    };
    const add = (pointer: string, value: unknown): void => {
      const { container, key } = locate(pointer);
      grow(value);
      if (!Array.isArray(container)) { (container as Record<string, unknown>)[key] = value; return; }
      if (key === '-') { container.push(value); return; }
      if (!INDEX.test(key) || Number(key) > container.length) fail('patch.path', 'Array insertion index is out of range.');
      container.splice(Number(key), 0, value);
    };
    const remove = (pointer: string): unknown => {
      const value = get(pointer);
      const { container, key } = locate(pointer);
      if (Array.isArray(container)) container.splice(Number(key), 1);
      else delete (container as Record<string, unknown>)[key];
      return value;
    };
    switch (operation.op) {
      case 'add': add(operation.path, structuredClone(operation.value)); break;
      case 'remove':
        if (operation.path === '') fail('patch.path', 'The document root cannot be removed.');
        remove(operation.path); break;
      case 'replace': {
        get(operation.path);
        const { container, key } = locate(operation.path);
        grow(operation.value);
        if (Array.isArray(container)) container[Number(key)] = structuredClone(operation.value);
        else (container as Record<string, unknown>)[key] = structuredClone(operation.value);
        break;
      }
      case 'move':
        if (operation.from === operation.path) { get(operation.from); break; }
        if (operation.path.startsWith(operation.from + '/')) fail('patch.path', 'A value cannot move into its own descendant.');
        { const value = remove(operation.from); bytes -= jsonBytes(value); add(operation.path, value); }
        break;
      case 'copy': add(operation.path, structuredClone(get(operation.from))); break;
      case 'test': if (!sameJson(get(operation.path), operation.value)) fail('patch.test', 'A test operation did not match.'); break;
    }
  });
  return box['value'];
}

function patchFailure<T>(error: unknown): LyraGenResult<T> {
  if (error instanceof PatchFailure) return { ok: false, diagnostics: [{ code: error.code, path: '/' + error.index, message: error.message, severity: 'error' }] };
  throw error;
}

/** Apply an RFC 6902 patch to bounded JSON data, atomically: any failing operation leaves no partial result. */
export function applyJsonPatch(document: JsonValue, operations: unknown, limits?: Partial<LyraGenLimits>): LyraGenResult<JsonValue> {
  const base = snapshotJson(document, limits);
  if (!base.ok) return base;
  const parsed = parseJsonPatch(operations, limits);
  if (!parsed.ok) return parsed;
  let result: unknown;
  try { result = applyOperations(structuredClone(base.value), parsed.value, resolveLimits(limits).maxBytes); } catch (error) { return patchFailure(error); }
  return snapshotJson(result, limits);
}

/** Top-level view members a patch may only `test`; `/revision` may also be replaced by exactly the next revision. */
const VIEW_MEMBERS = new Set(['version', 'catalog', 'surfaceId', 'revision']);
const firstSegment = (pointer: string): string | undefined => (parsePointer(pointer) as { value: readonly string[] }).value[0];

type PlainNode = Record<string, unknown>;
const childNodes = (node: PlainNode): PlainNode[] | undefined => {
  const children = node['children'];
  return Array.isArray(children) && children.every(child => object(child as JsonValue) && typeof (child as PlainNode)['id'] === 'string') ? children as PlainNode[] : undefined;
};
const sameOwnMembers = (base: LyraGenNode, next: PlainNode): boolean => {
  const keys = new Set([...Object.keys(base), ...Object.keys(next)]);
  keys.delete('id'); keys.delete('children');
  return [...keys].every(key => sameJson((base as unknown as PlainNode)[key], next[key]));
};

/** Express a position-addressed result as identity-addressed operations, replacing a subtree whenever children moved or reordered. */
function scopedOperations(base: LyraGenNode, next: PlainNode): LyraGenPatchOperation[] {
  const baseIds = new Set<string>();
  const pending = [base];
  while (pending.length) { const node = pending.pop()!; baseIds.add(node.id); if (node.children) pending.push(...node.children); }
  const nextIds = new Set<string>();
  const walk: unknown[] = [next];
  while (walk.length) {
    const node = walk.pop();
    if (!object(node as JsonValue)) continue;
    const id = (node as PlainNode)['id'];
    if (typeof id === 'string') {
      if (nextIds.has(id)) throw new PatchFailure('identity.conflict', -1, 'Patched nodes need unique identities.');
      nextIds.add(id);
    }
    const children = (node as PlainNode)['children'];
    if (Array.isArray(children)) walk.push(...children);
  }
  const operations: LyraGenPatchOperation[] = [];
  const replace = (node: PlainNode): void => { operations.push({ op: 'replace', nodeId: node['id'] as string, node: node as unknown as LyraGenNode }); };
  const visit = (old: LyraGenNode, node: PlainNode): void => {
    const children = childNodes(node);
    if (!sameOwnMembers(old, node) || (old.children === undefined) !== (node['children'] === undefined) || (node['children'] !== undefined && !children)) { replace(node); return; }
    const oldChildren = old.children ?? [];
    const current = children ?? [];
    const oldIds = new Set(oldChildren.map(child => child.id));
    const currentIds = new Set(current.map(child => child['id'] as string));
    const keptOld = oldChildren.filter(child => currentIds.has(child.id)).map(child => child.id);
    const keptNew = current.filter(child => oldIds.has(child['id'] as string)).map(child => child['id'] as string);
    const moved = current.some(child => !oldIds.has(child['id'] as string) && baseIds.has(child['id'] as string))
      || oldChildren.some(child => !currentIds.has(child.id) && nextIds.has(child.id));
    if (moved || keptOld.some((id, index) => keptNew[index] !== id)) { replace(node); return; }
    for (const child of oldChildren) if (!currentIds.has(child.id)) operations.push({ op: 'remove', nodeId: child.id });
    current.forEach((child, index) => {
      if (oldIds.has(child['id'] as string)) return;
      const anchor = current.slice(index + 1).find(sibling => oldIds.has(sibling['id'] as string));
      operations.push({ op: 'insert', parentId: old.id, node: child as unknown as LyraGenNode, ...(anchor ? { before: anchor['id'] as string } : {}) });
    });
    for (const child of current) {
      const previous = oldChildren.find(candidate => candidate.id === child['id']);
      if (previous) visit(previous, child);
    }
  };
  visit(base, next);
  return operations.length > MAX_JSON_PATCH_OPERATIONS ? [{ op: 'replace', nodeId: base.id, node: next as unknown as LyraGenNode }] : operations;
}

/**
 * Translate RFC 6902 operations addressed at positions in an admitted view (`/root/children/1`,
 * `/root/children/1/props/title`, `/root/children/-`) into one identity-addressed `LyraGenPatch`,
 * or `null` when the operations change nothing. Operations apply in order with RFC semantics (`test`
 * fails the whole patch). Only `/root` and its descendants are writable; `version`, `catalog` and
 * `surfaceId` can only be tested, and `/revision` can only be tested or replaced by exactly the next
 * revision. A changed node becomes a `replace`, a new child an anchored `insert`, a vanished child a
 * `remove`; a node whose children moved or were reordered is replaced as a whole.
 */
export function jsonPatchToScopedPatch(view: LyraGenView, operations: unknown, limits?: Partial<LyraGenLimits>): LyraGenResult<LyraGenPatch | null> {
  const parsed = parseJsonPatch(operations, limits);
  if (!parsed.ok) return parsed;
  for (const [index, operation] of parsed.value.entries()) {
    const reserved = (message: string): LyraGenResult<LyraGenPatch | null> => ({ ok: false, diagnostics: [{ code: 'patch.reserved', path: '/' + index, message, severity: 'error' }] });
    if (operation.op === 'test') continue;
    const target = firstSegment(operation.path);
    if (operation.op === 'replace' && operation.path === '/revision') {
      if (operation.value !== view.revision + 1) return { ok: false, diagnostics: [{ code: 'revision.conflict', path: '/' + index, message: 'A revision replacement must name the next revision.', severity: 'error' }] };
      continue;
    }
    if (target !== 'root' || (operation.path === '/root' && operation.op === 'remove')) return reserved('Only the root node and its descendants can be patched.');
    if (operation.op === 'move' && (firstSegment(operation.from) !== 'root' || operation.from === '/root')) return reserved('Only descendants of the root node can be moved.');
  }
  let next: unknown;
  try { next = applyOperations(JSON.parse(JSON.stringify(view)), parsed.value, resolveLimits(limits).maxBytes); } catch (error) { return patchFailure(error); }
  const document = next as PlainNode;
  for (const key of VIEW_MEMBERS) if (key !== 'revision' && !sameJson(document[key], (view as unknown as PlainNode)[key])) return failure('patch.reserved', 'View identity members cannot change.');
  const root = document['root'];
  if (!object(root as JsonValue) || (root as PlainNode)['id'] !== view.root.id) return failure('patch.root', 'The root node must keep its identity.');
  let scoped: LyraGenPatchOperation[];
  try { scoped = scopedOperations(view.root, root as PlainNode); } catch (error) {
    if (error instanceof PatchFailure) return failure(error.code, error.message);
    throw error;
  }
  if (scoped.length === 0) {
    if (document['revision'] === view.revision) return { ok: true, value: null, diagnostics: [] };
    scoped = [{ op: 'replace', nodeId: view.root.id, node: view.root }];
  }
  return { ok: true, value: Object.freeze({ surfaceId: view.surfaceId, expectedRevision: view.revision, operations: Object.freeze(scoped) }), diagnostics: [] };
}

/**
 * Apply RFC 6902 operations to an admitted view through `applyViewPatch`, so the revision check,
 * catalog, limits, identity and isolation guards all apply. The result is the next validated view
 * (one revision later), or the current admitted view unchanged when the operations change nothing.
 */
export function jsonPatchToViewPatch(view: LyraGenView, operations: unknown, catalog: LyraGenCatalog, options: LyraGenValidationOptions = {}): LyraGenValidationResult {
  const current = validateView(view, catalog, options);
  if (!current.ok) return current;
  // An already admitted view is the baseline itself, so untouched branches keep their identities.
  const base = isValidatedView(view) ? view : current.value;
  const scoped = jsonPatchToScopedPatch(base, operations, options.limits);
  if (!scoped.ok) return scoped;
  return scoped.value === null ? { ...current, value: base } : applyViewPatch(base, scoped.value, catalog, options);
}

const pointer = (path: string, segment: string): string => path + '/' + escapePointerSegment(segment);

function positionalOperations(base: LyraGenNode, next: LyraGenNode, path: string, operations: LyraGenJsonPatchOperation[]): void {
  const old = base as unknown as Record<string, JsonValue>, current = next as unknown as Record<string, JsonValue>;
  const keys = [...new Set([...Object.keys(old), ...Object.keys(current)])].filter(key => key !== 'id' && key !== 'children');
  for (const key of keys) {
    const before = old[key], after = current[key];
    if (sameJson(before, after)) continue;
    if (!Object.hasOwn(current, key)) operations.push({ op: 'remove', path: pointer(path, key) });
    else if (!Object.hasOwn(old, key)) operations.push({ op: 'add', path: pointer(path, key), value: after! });
    else if (object(before!) && object(after!)) {
      const member = pointer(path, key);
      for (const entry of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (!Object.hasOwn(after, entry)) operations.push({ op: 'remove', path: pointer(member, entry) });
        else if (!Object.hasOwn(before, entry)) operations.push({ op: 'add', path: pointer(member, entry), value: after[entry]! });
        else if (!sameJson(before[entry], after[entry])) operations.push({ op: 'replace', path: pointer(member, entry), value: after[entry]! });
      }
    } else operations.push({ op: 'replace', path: pointer(path, key), value: after! });
  }
  const children = pointer(path, 'children');
  if (!base.children && next.children) { operations.push({ op: 'add', path: children, value: next.children as unknown as JsonValue }); return; }
  if (base.children && !next.children) { operations.push({ op: 'remove', path: children }); return; }
  if (!base.children || !next.children) return;
  const oldIds = new Set(base.children.map(child => child.id));
  const nextIds = new Set(next.children.map(child => child.id));
  const keptOld = base.children.filter(child => nextIds.has(child.id)).map(child => child.id);
  const keptNew = next.children.filter(child => oldIds.has(child.id)).map(child => child.id);
  if (keptOld.some((id, index) => keptNew[index] !== id)) { operations.push({ op: 'replace', path: children, value: next.children as unknown as JsonValue }); return; }
  for (let index = base.children.length - 1; index >= 0; index--) if (!nextIds.has(base.children[index]!.id)) operations.push({ op: 'remove', path: children + '/' + index });
  next.children.forEach((child, index) => { if (!oldIds.has(child.id)) operations.push({ op: 'add', path: children + '/' + index, value: child as unknown as JsonValue }); });
  next.children.forEach((child, index) => {
    const previous = base.children!.find(candidate => candidate.id === child.id);
    if (previous && previous !== child) positionalOperations(previous, child, children + '/' + index, operations);
  });
}

/**
 * RFC 6902 operations that turn `previous` into `next`, two views of the same surface and catalog,
 * for clients that consume JSON Patch. Untouched nodes produce no operation; member changes are
 * addressed at `/props/<name>`-level paths; reordered children are replaced as one array. A
 * revision change ends the patch with `replace /revision`. Feeding the result to
 * `jsonPatchToViewPatch(previous, ...)` reproduces `next` when it is the following revision.
 */
export function viewPatchToJsonPatch(previous: LyraGenView, next: LyraGenView): LyraGenResult<readonly LyraGenJsonPatchOperation[]> {
  if (previous.surfaceId !== next.surfaceId || previous.version !== next.version || !sameJson(previous.catalog, next.catalog)) return failure('revision.conflict', 'Both views must address the same surface and catalog.');
  let operations: LyraGenJsonPatchOperation[] = [];
  if (previous.root.id !== next.root.id) operations.push({ op: 'replace', path: '/root', value: next.root as unknown as JsonValue });
  else if (previous.root !== next.root) positionalOperations(previous.root, next.root, '/root', operations);
  if (operations.length > MAX_JSON_PATCH_OPERATIONS - 1) operations = [{ op: 'replace', path: '/root', value: next.root as unknown as JsonValue }];
  if (previous.revision !== next.revision) operations.push({ op: 'replace', path: '/revision', value: next.revision });
  return { ok: true, value: Object.freeze(operations.map(operation => Object.freeze(operation))), diagnostics: [] };
}

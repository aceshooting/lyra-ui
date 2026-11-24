import { applyViewPatch, findNode } from './runtime.js';
import type { LyraGenValidationOptions } from './runtime.js';
import type { LyraGenCatalog, LyraGenDiagnostic, LyraGenNode, LyraGenValidationResult, LyraGenView } from './types.js';

export interface DashboardCopyOptions {
  /** The target catalog: it decides which bindings, reads and actions survive. */
  readonly catalog: LyraGenCatalog;
  /** Existing node of the target view that receives the copy. */
  readonly parentId: string;
  /** Prefix of every copied node id. A collision with the target selects `<prefix>-2`, `-3`, and so on. */
  readonly newIdPrefix: string;
  readonly before?: string;
  readonly after?: string;
  readonly validation?: LyraGenValidationOptions;
}
const PREFIX = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/u;
const failure = (code: string, message: string, path = ''): LyraGenValidationResult => ({ ok: false, diagnostics: [{ code, path, message, severity: 'error' } satisfies LyraGenDiagnostic] });

function ids(node: LyraGenNode, into = new Set<string>()): Set<string> {
  into.add(node.id);
  for (const child of node.children ?? []) ids(child, into);
  return into;
}
function pointers(node: LyraGenNode, into = new Set<string>()): Set<string> {
  for (const pointer of Object.values(node.bindings ?? {})) into.add(pointer);
  for (const child of node.children ?? []) pointers(child, into);
  return into;
}
const owned = (pointer: string, bound: ReadonlySet<string>): boolean => { for (const path of bound) if (pointer === path || pointer.startsWith(`${path}/`)) return true; return false; };

/**
 * Copy one node subtree of a validated source view into a target view as an atomic patch
 * insertion. Every copied node gets a new id under a collision-free prefix; bindings the target
 * catalog does not declare (or whose state path the target already owns), reads without a bound
 * state path, and actions the target catalog does not define are dropped; the result is
 * validated against the target catalog and returned as the next revision, or as diagnostics.
 */
export function copyDashboardPanel(source: LyraGenView, panelNodeId: string, target: LyraGenView, options: DashboardCopyOptions): LyraGenValidationResult {
  const panel = findNode(source, panelNodeId);
  if (!panel) return failure('copy.source', 'The panel does not exist in the source view.', `/nodes/${panelNodeId}`);
  if (typeof options.newIdPrefix !== 'string' || !PREFIX.test(options.newIdPrefix)) return failure('copy.prefix', 'The id prefix must start with a letter and use letters, digits, underscores or hyphens (at most 64).');
  const existing = ids(target.root);
  const sourceIds = ids(panel);
  let prefix = options.newIdPrefix;
  for (let attempt = 2; attempt < 1000 && [...sourceIds].some(id => existing.has(`${prefix}-${id}`)); attempt++) prefix = `${options.newIdPrefix}-${attempt}`;
  if ([...sourceIds].some(id => existing.has(`${prefix}-${id}`))) return failure('copy.prefix', 'No collision-free id prefix could be found.');
  const taken = pointers(target.root);
  const kept = new Set<string>();
  const adapt = (node: LyraGenNode): LyraGenNode => {
    const component = options.catalog.components[node.type];
    const bindings = Object.fromEntries(Object.entries(node.bindings ?? {}).filter(([key, pointer]) => component?.bindings?.[key] !== undefined && !taken.has(pointer) && !kept.has(pointer)));
    for (const pointer of Object.values(bindings)) kept.add(pointer);
    const { bindings: _b, reads: _r, liveReads: _l, action: _a, children, ...rest } = node;
    return { ...rest, id: `${prefix}-${node.id}`, ...(Object.keys(bindings).length ? { bindings } : {}), ...(node.reads ? { reads: node.reads } : {}), ...(node.liveReads ? { liveReads: node.liveReads } : {}), ...(node.action ? { action: node.action } : {}), ...(children ? { children: children.map(adapt) } : {}) };
  };
  // Reads and actions depend on what survived, so settle them after the bindings are known.
  const settle = (node: LyraGenNode): LyraGenNode => {
    const component = options.catalog.components[node.type];
    const reads = Object.fromEntries(Object.entries(node.reads ?? {}).filter(([key, pointer]) => component?.properties[key] !== undefined && (owned(pointer, kept) || owned(pointer, taken))));
    const liveReads = Object.fromEntries(Object.entries(node.liveReads ?? {}).filter(([key]) => component?.properties[key] !== undefined));
    const { reads: _r, liveReads: _l, action, children, ...rest } = node;
    const allowed = action && options.catalog.actions !== undefined && Object.hasOwn(options.catalog.actions, action.name);
    return { ...rest, ...(Object.keys(reads).length ? { reads } : {}), ...(Object.keys(liveReads).length ? { liveReads } : {}), ...(allowed ? { action } : {}), ...(children ? { children: children.map(settle) } : {}) };
  };
  const copy = settle(adapt(panel));
  return applyViewPatch(target, { surfaceId: target.surfaceId, expectedRevision: target.revision, operations: [{ op: 'insert', parentId: options.parentId, node: copy, ...(options.before !== undefined ? { before: options.before } : {}), ...(options.after !== undefined ? { after: options.after } : {}) }] }, options.catalog, options.validation);
}

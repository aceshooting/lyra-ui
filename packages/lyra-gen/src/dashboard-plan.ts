import { readPointer } from './references.js';
import { createSurfaceState, validateView } from './runtime.js';
import { snapshotJson, validateSchema } from './schema.js';
import type { JsonValue, LyraGenCatalog, LyraGenLimits, LyraGenNode, LyraGenView } from './types.js';

/** A static finding about a panel; `nodeId` names the panel it belongs to. */
export interface LyraDashboardPlanWarning {
  readonly nodeId: string;
  readonly code: 'param.unowned' | 'live.undeclared' | 'repeat.template' | 'panel.empty' | 'query.unknown';
  readonly message: string;
}
/** One argument of a bound query: a literal value or a read of a state pointer. */
export type LyraDashboardPlanParam =
  | { readonly name: string; readonly source: 'literal'; readonly value: JsonValue }
  | { readonly name: string; readonly source: 'state'; readonly pointer: string; readonly owned: boolean };
export interface LyraDashboardPlanControl {
  readonly nodeId: string;
  readonly role: string;
  readonly label?: string;
  /** State pointers this control owns through its bindings. */
  readonly statePaths: readonly string[];
}
export interface LyraDashboardPlanSources {
  readonly query?: { readonly name: string; readonly params: readonly LyraDashboardPlanParam[] };
  /** Pointers read from the query result, or from host live data when the node has no query. */
  readonly live: readonly string[];
  readonly repeat?: { readonly items: string; readonly key: string; readonly from: 'live' | 'state' | 'query'; readonly max: number };
}
export interface LyraDashboardPlanPanel {
  readonly nodeId: string;
  /** Component type of the panel node. */
  readonly role: string;
  readonly label?: string;
  readonly topLevel: boolean;
  readonly sources: LyraDashboardPlanSources;
  /** Interactive controls inside the panel (the node itself included). */
  readonly controls: readonly LyraDashboardPlanControl[];
  readonly warnings: readonly LyraDashboardPlanWarning[];
}
export interface LyraDashboardPlan {
  readonly surfaceId: string;
  readonly revision: number;
  readonly panels: readonly LyraDashboardPlanPanel[];
  /** Every control of the view, in document order. */
  readonly controls: readonly LyraDashboardPlanControl[];
  readonly warnings: readonly LyraDashboardPlanWarning[];
}
export interface LyraDashboardPlanOptions {
  /** True when the host publishes live data to the surface; otherwise `liveReads` without a query cannot resolve. */
  readonly liveData?: boolean;
}

const LABEL_PROPERTIES = ['title', 'label', 'heading', 'name', 'caption', 'aria-label'] as const;
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';
const freeze = <T extends object>(value: T): T => Object.freeze(value);

function labelOf(node: LyraGenNode, catalog: LyraGenCatalog): string | undefined {
  const declared = catalog.components[node.type]?.accessibleName?.properties ?? [];
  for (const property of [...declared, ...LABEL_PROPERTIES]) {
    const value = node.props?.[property];
    if (nonEmpty(value)) return value;
  }
  return nonEmpty(node.text) ? node.text : undefined;
}
const hasText = (node: LyraGenNode): boolean => nonEmpty(node.text) || (node.children?.some(hasText) ?? false);
const isControl = (node: LyraGenNode, catalog: LyraGenCatalog): boolean => Object.keys(node.bindings ?? {}).length > 0 || node.action !== undefined || catalog.components[node.type]?.interactive === true;
const isPanelNode = (node: LyraGenNode): boolean => node.dataQuery !== undefined || node.repeat !== undefined || Object.keys(node.liveReads ?? {}).length > 0;

function walk(node: LyraGenNode, visit: (node: LyraGenNode) => void): void {
  visit(node);
  node.children?.forEach(child => walk(child, visit));
}
function controlOf(node: LyraGenNode, catalog: LyraGenCatalog): LyraDashboardPlanControl {
  const label = labelOf(node, catalog);
  return freeze({ nodeId: node.id, role: node.type, ...(label !== undefined ? { label } : {}), statePaths: freeze([...new Set(Object.values(node.bindings ?? {}))]) });
}
const covers = (owned: ReadonlySet<string>, pointer: string): boolean => {
  for (const path of owned) if (pointer === path || pointer.startsWith(`${path}/`)) return true;
  return false;
};

/**
 * Describe a view's dashboard panels (top-level children of the root, plus any node with a data
 * query, repeat or live reads): data sources, parameter origins, interactive controls with the state
 * they own, and static warnings. Pure, deterministic and DOM-free; it never runs a query or action.
 */
export function planDashboard(view: LyraGenView, catalog: LyraGenCatalog, options: LyraDashboardPlanOptions = {}): LyraDashboardPlan {
  const owned = new Set<string>();
  const controls: LyraDashboardPlanControl[] = [];
  walk(view.root, node => {
    Object.values(node.bindings ?? {}).forEach(pointer => owned.add(pointer));
    if (isControl(node, catalog)) controls.push(controlOf(node, catalog));
  });
  const topLevel = new Set((view.root.children ?? []).map(child => child.id));
  const panels: LyraDashboardPlanPanel[] = [];
  const seen = new Set<string>();
  const build = (node: LyraGenNode): void => {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    const warnings: LyraDashboardPlanWarning[] = [];
    const warn = (code: LyraDashboardPlanWarning['code'], message: string): void => { warnings.push(freeze({ nodeId: node.id, code, message })); };
    const sources: { query?: { name: string; params: LyraDashboardPlanParam[] }; live: string[]; repeat?: LyraDashboardPlanSources['repeat'] } = { live: Object.values(node.liveReads ?? {}) };
    const query = node.dataQuery;
    if (query) {
      const names = new Set([...Object.keys(query.params ?? {}), ...Object.keys(query.paramReads ?? {})]);
      const params: LyraDashboardPlanParam[] = [];
      for (const name of [...names].sort()) {
        const pointer = query.paramReads?.[name];
        if (pointer !== undefined) {
          const isOwned = covers(owned, pointer);
          params.push(freeze({ name, source: 'state' as const, pointer, owned: isOwned }));
          if (!isOwned) warn('param.unowned', `Query parameter ${name} reads state that no control owns.`);
        } else params.push(freeze({ name, source: 'literal' as const, value: query.params![name]! }));
      }
      sources.query = { name: query.name, params };
      if (!catalog.queries?.[query.name]) warn('query.unknown', `Query ${query.name} is not declared by the catalog.`);
    } else if (sources.live.length > 0 && options.liveData !== true) warn('live.undeclared', 'Live reads need a query or host live data, and none is declared.');
    if (node.repeat) {
      const from: 'live' | 'state' | 'query' = node.repeat.from === 'state' ? 'state' : query ? 'query' : 'live';
      sources.repeat = freeze({ items: node.repeat.items, key: node.repeat.key, from, max: node.repeat.max ?? 200 });
      if (node.children?.length !== 1) warn('repeat.template', 'A repeat needs exactly one item template child.');
    }
    const inside: LyraDashboardPlanControl[] = [];
    walk(node, child => { if (isControl(child, catalog)) inside.push(controlOf(child, catalog)); });
    const isTop = topLevel.has(node.id);
    if (isTop && !query && !node.repeat && sources.live.length === 0 && inside.length === 0 && !hasText(node)) warn('panel.empty', 'Panel has no data, controls or text.');
    const label = labelOf(node, catalog);
    panels.push(freeze({
      nodeId: node.id, role: node.type, ...(label !== undefined ? { label } : {}), topLevel: isTop,
      sources: freeze({ ...(sources.query ? { query: freeze({ name: sources.query.name, params: freeze(sources.query.params) }) } : {}), live: freeze(sources.live), ...(sources.repeat ? { repeat: sources.repeat } : {}) }),
      controls: freeze(inside), warnings: freeze(warnings)
    }));
  };
  walk(view.root, node => { if (node !== view.root && (topLevel.has(node.id) || isPanelNode(node))) build(node); });
  return freeze({ surfaceId: view.surfaceId, revision: view.revision, panels: freeze(panels), controls: freeze(controls), warnings: freeze(panels.flatMap(panel => panel.warnings)) });
}

/** One query execution, as the host runs it for `lr-gen-view`. */
export interface LyraDashboardDryRunRequest {
  readonly surfaceId: string;
  readonly nodeId: string;
  readonly name: string;
  readonly params: JsonValue;
  readonly signal: AbortSignal;
}
export type LyraDashboardDryRunStatus = 'ok' | 'empty' | 'failed' | 'invalid-result' | 'oversized';
export interface LyraDashboardDryRunOptions {
  readonly queryProvider: (request: LyraDashboardDryRunRequest) => unknown;
  /** Host live data, used to judge panels that read live data without a query. */
  readonly liveData?: JsonValue;
  /** Initial values of bound state, as `lr-gen-view.bindingState`. */
  readonly bindingState?: JsonValue;
  readonly signal?: AbortSignal;
  /** Per-query ceiling in milliseconds (default 10000). */
  readonly timeoutMs?: number;
  /** At most this many queries run (default 50); the rest fail. */
  readonly maxQueries?: number;
  /** Treat an empty panel as not publishable (default false). */
  readonly emptyBlocksPublish?: boolean;
  /** Bounds for results and the view, applied like the surface's `limits`. */
  readonly limits?: Partial<LyraGenLimits>;
}
export interface LyraDashboardDryRunPanel {
  readonly nodeId: string;
  readonly role: string;
  readonly label?: string;
  readonly status: LyraDashboardDryRunStatus;
  /** Names of the queries run for this panel (itself and descendants). */
  readonly queries: readonly string[];
  /** Generic, never raw error text. */
  readonly message?: string;
}
export interface LyraDashboardDryRun {
  /** False when the view did not validate against the catalog; nothing was run. */
  readonly valid: boolean;
  readonly aborted: boolean;
  readonly publishable: boolean;
  readonly panels: readonly LyraDashboardDryRunPanel[];
}

const SEVERITY: Readonly<Record<LyraDashboardDryRunStatus, number>> = { ok: 0, empty: 1, oversized: 2, 'invalid-result': 3, failed: 4 };
const MESSAGES: Readonly<Record<LyraDashboardDryRunStatus, string | undefined>> = {
  ok: undefined, empty: 'The data source returned nothing to show.', failed: 'The data source could not be read.',
  'invalid-result': 'The data source returned data the catalog does not allow.', oversized: 'The data source returned more data than allowed.'
};
const isEmptyValue = (value: JsonValue): boolean => value === null || (Array.isArray(value) ? value.length === 0 : typeof value === 'object' && Object.keys(value).length === 0);

type Outcome = { readonly status: LyraDashboardDryRunStatus };
async function runQuery(provider: LyraDashboardDryRunOptions['queryProvider'], request: Omit<LyraDashboardDryRunRequest, 'signal'>, timeoutMs: number, outer: AbortSignal | undefined): Promise<{ readonly ok: true; readonly value: unknown } | { readonly ok: false }> {
  const controller = new AbortController();
  const stop = (): void => controller.abort();
  outer?.addEventListener('abort', stop, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const pending = Promise.resolve().then(() => provider({ ...request, signal: controller.signal }));
    pending.catch(() => undefined);
    const guard = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, timeoutMs);
      controller.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
    guard.catch(() => undefined);
    return { ok: true, value: await Promise.race([pending, guard]) };
  } catch { return { ok: false }; }
  finally { clearTimeout(timer); outer?.removeEventListener('abort', stop); }
}

/**
 * Execute every bound query once against the current state and judge each panel, without running
 * actions or changing state. A result is checked like `lr-gen-view` does: bounded JSON first, then
 * the catalog's result schema. Failures only carry generic messages; raw provider errors never leak.
 */
export async function dryRunDashboard(view: LyraGenView, catalog: LyraGenCatalog, options: LyraDashboardDryRunOptions): Promise<LyraDashboardDryRun> {
  const checked = validateView(view, catalog, options.limits ? { limits: options.limits } : {});
  if (!checked.ok) return freeze({ valid: false, aborted: false, publishable: false, panels: freeze([]) });
  const accepted = checked.value;
  const plan = planDashboard(accepted, catalog, { liveData: options.liveData !== undefined });
  const nodes = new Map<string, LyraGenNode>();
  walk(accepted.root, node => { if (!nodes.has(node.id)) nodes.set(node.id, node); });
  const supplied = snapshotJson(options.bindingState ?? {}, options.limits);
  let values: JsonValue = {};
  try { if (supplied.ok) values = createSurfaceState(accepted, supplied.value).values; } catch { values = {}; }
  const timeoutMs = typeof options.timeoutMs === 'number' && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : 10_000;
  const maxQueries = typeof options.maxQueries === 'number' && Number.isFinite(options.maxQueries) && options.maxQueries >= 0 ? Math.floor(options.maxQueries) : 50;
  const outcomes = new Map<string, Outcome>();
  let started = 0;
  let aborted = false;

  const judge = (node: LyraGenNode, value: JsonValue): LyraDashboardDryRunStatus => {
    const reads = Object.values(node.liveReads ?? {});
    if (isEmptyValue(value)) return 'empty';
    if (reads.length > 0 && reads.every(pointer => !readPointer(value, pointer).ok)) return 'empty';
    if (node.repeat && node.repeat.from !== 'state') {
      const items = readPointer(value, node.repeat.items);
      if (items.ok && Array.isArray(items.value) && items.value.length === 0) return 'empty';
    }
    return 'ok';
  };

  const queryNodes: LyraGenNode[] = [];
  walk(accepted.root, node => { if (node.dataQuery) queryNodes.push(node); });
  for (const node of queryNodes) {
    if (outcomes.has(node.id)) continue;
    const query = node.dataQuery!;
    const definition = catalog.queries?.[query.name];
    if (!definition || aborted || options.signal?.aborted) { aborted = aborted || options.signal?.aborted === true; outcomes.set(node.id, { status: 'failed' }); continue; }
    if (started >= maxQueries) { outcomes.set(node.id, { status: 'failed' }); continue; }
    const params: Record<string, JsonValue> = { ...query.params };
    for (const [key, pointer] of Object.entries(query.paramReads ?? {})) {
      const read = readPointer(values, pointer);
      if (read.ok) params[key] = read.value;
    }
    const resolved = validateSchema(params, definition.params, options.limits);
    if (!resolved.ok) { outcomes.set(node.id, { status: 'failed' }); continue; }
    started++;
    const response = await runQuery(options.queryProvider, { surfaceId: accepted.surfaceId, nodeId: node.id, name: query.name, params: resolved.value }, timeoutMs, options.signal);
    if (options.signal?.aborted) aborted = true;
    if (!response.ok) { outcomes.set(node.id, { status: 'failed' }); continue; }
    const admitted = snapshotJson(response.value, options.limits);
    if (!admitted.ok) { outcomes.set(node.id, { status: admitted.diagnostics.some(item => item.code.startsWith('limit.')) ? 'oversized' : 'invalid-result' }); continue; }
    if (definition.result && !validateSchema(admitted.value, definition.result, options.limits).ok) { outcomes.set(node.id, { status: 'invalid-result' }); continue; }
    outcomes.set(node.id, { status: judge(node, admitted.value) });
  }

  const panels: LyraDashboardDryRunPanel[] = plan.panels.map(panel => {
    const node = nodes.get(panel.nodeId)!;
    let status: LyraDashboardDryRunStatus = 'ok';
    const names: string[] = [];
    const worsen = (next: LyraDashboardDryRunStatus): void => { if (SEVERITY[next] > SEVERITY[status]) status = next; };
    walk(node, child => {
      const outcome = outcomes.get(child.id);
      if (outcome && child.dataQuery) { names.push(child.dataQuery.name); worsen(outcome.status); }
    });
    if (!node.dataQuery && options.liveData !== undefined && !names.length) {
      const reads = Object.values(node.liveReads ?? {});
      if (reads.length > 0 && reads.every(pointer => !readPointer(options.liveData!, pointer).ok)) worsen('empty');
    }
    const message = MESSAGES[status];
    return freeze({ nodeId: panel.nodeId, role: panel.role, ...(panel.label !== undefined ? { label: panel.label } : {}), status, queries: freeze(names), ...(message !== undefined ? { message } : {}) });
  });
  const blocked = panels.some(panel => panel.status === 'failed' || panel.status === 'invalid-result' || panel.status === 'oversized' || (options.emptyBlocksPublish === true && panel.status === 'empty'));
  return freeze({ valid: true, aborted, publishable: !blocked && !aborted, panels: freeze(panels) });
}

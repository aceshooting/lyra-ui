import type { JsonObject, JsonValue } from './types.js';
import { snapshotJson } from './schema.js';
import type { LyraDashboardCell } from '@aceshooting/lyra-ui/components/lr-dashboard-grid.js';

export interface DashboardSharedSnapshot {
  readonly filters: JsonObject;
  readonly selection: readonly string[];
  readonly revision: number;
}
export interface DashboardSharedEvent {
  readonly scope: string;
  readonly source: string;
  readonly snapshot: DashboardSharedSnapshot;
}
export interface DashboardSharedUpdate { readonly filters?: JsonObject; readonly selection?: readonly string[] }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
const EMPTY_SHARED: DashboardSharedSnapshot = Object.freeze({ filters: Object.freeze({}), selection: Object.freeze([]), revision: 0 });
function signature(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(signature).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${signature((value as JsonObject)[key]!)}`).join(',')}}`;
  return JSON.stringify(value);
}

/** Scope-local shared state with revision tokens and origin suppression for linked controls. */
export class SharedDashboardState {
  private readonly scopes = new Map<string, DashboardSharedSnapshot>();
  private readonly listeners = new Set<{ scope: string; source: string; notify: (event: DashboardSharedEvent) => void }>();
  constructor(private readonly validateFilters: (scope: string, filters: JsonObject) => boolean, private readonly maxScopes = 64, private readonly maxBytes = 65536) {
    if (![maxScopes, maxBytes].every(value => Number.isSafeInteger(value) && value > 0)) throw new Error('Invalid shared-state limits');
  }
  /** Returns the stored deep-frozen snapshot; it is shared, never copied. */
  snapshot(scope: string): DashboardSharedSnapshot { return this.scopes.get(scope) ?? EMPTY_SHARED; }
  subscribe(scope: string, source: string, notify: (event: DashboardSharedEvent) => void): () => void {
    const listener = { scope, source, notify };
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  update(scope: string, source: string, update: DashboardSharedUpdate, causedBy?: DashboardSharedEvent): boolean {
    // Applying a received event to a control must never publish that event again.
    if (causedBy) return false;
    if (!this.scopes.has(scope) && this.scopes.size >= this.maxScopes) throw new Error('Scope budget exceeded');
    const admitted = snapshotJson(update, { maxBytes: this.maxBytes });
    if (!admitted.ok || admitted.value === null || typeof admitted.value !== 'object' || Array.isArray(admitted.value)) throw new Error('Invalid shared state');
    const safeUpdate = admitted.value as unknown as DashboardSharedUpdate;
    const previous = this.snapshot(scope);
    const filters = safeUpdate.filters === undefined ? previous.filters : safeUpdate.filters;
    if (filters === null || typeof filters !== 'object' || Array.isArray(filters) || (safeUpdate.selection !== undefined && !Array.isArray(safeUpdate.selection))) throw new Error('Invalid shared state');
    const selection = [...new Set(safeUpdate.selection ?? previous.selection)];
    if (!this.validateFilters(scope, filters) || selection.some(id => typeof id !== 'string') || new TextEncoder().encode(JSON.stringify({ filters, selection })).byteLength > this.maxBytes) throw new Error('Invalid shared state');
    if (signature(filters) === signature(previous.filters) && signature(selection) === signature(previous.selection)) return false;
    const snapshot: DashboardSharedSnapshot = Object.freeze({ filters, selection: Object.freeze(selection), revision: previous.revision + 1 });
    this.scopes.set(scope, snapshot);
    // One failing listener must not starve the others; the first failure is rethrown after every listener has run.
    const event: DashboardSharedEvent = Object.freeze({ scope, source, snapshot });
    let failure: { readonly error: unknown } | undefined;
    for (const listener of [...this.listeners]) {
      if (listener.scope !== scope || listener.source === source) continue;
      try { listener.notify(event); } catch (error) { failure ??= { error }; }
    }
    if (failure) throw failure.error;
    return true;
  }
  clearDangling(scope: string, availableIds: ReadonlySet<string>): boolean {
    return this.update(scope, '', { selection: this.snapshot(scope).selection.filter(id => availableIds.has(id)) });
  }
  removeScope(scope: string): void {
    this.scopes.delete(scope);
    for (const listener of this.listeners) if (listener.scope === scope) this.listeners.delete(listener);
  }
  dispose(): void { this.scopes.clear(); this.listeners.clear(); }
}

export interface DashboardNavigationFrame {
  readonly destination: string;
  readonly label: string;
  readonly state: JsonObject;
  readonly scroll: { readonly inline: number; readonly block: number };
  readonly focusId?: string;
}
/** Host route authorization runs on entry and return; parent snapshots contain only caller-approved state. */
export class DashboardNavigation {
  private frames: DashboardNavigationFrame[] = [];
  private generation = 0;
  constructor(private readonly authorize: (destination: string) => boolean | Promise<boolean>, private readonly maxDepth = 16, private readonly maxBytes = 65536) {
    if (![maxDepth, maxBytes].every(value => Number.isSafeInteger(value) && value > 0)) throw new Error('Invalid navigation limits');
  }
  get breadcrumbs(): readonly { readonly destination: string; readonly label: string }[] { return this.frames.map(({ destination, label }) => ({ destination, label })); }
  get current(): DashboardNavigationFrame | undefined { return this.frames.at(-1) ? clone(this.frames.at(-1)!) : undefined; }
  private checked(frame: DashboardNavigationFrame): DashboardNavigationFrame {
    const admitted = snapshotJson(frame, { maxBytes: this.maxBytes });
    if (!admitted.ok) throw new Error('Invalid navigation state');
    const safe = admitted.value as unknown as DashboardNavigationFrame;
    if (!safe || typeof safe.destination !== 'string' || !safe.destination || typeof safe.label !== 'string' || !safe.scroll || !Number.isFinite(safe.scroll.inline) || !Number.isFinite(safe.scroll.block) || !safe.state || typeof safe.state !== 'object' || Array.isArray(safe.state)) throw new Error('Invalid navigation frame');
    return safe;
  }
  async enter(frame: DashboardNavigationFrame, parent?: DashboardNavigationFrame): Promise<boolean> {
    if (this.frames.length >= this.maxDepth) return false;
    const next = this.checked(frame);
    const savedParent = parent ? this.checked(parent) : undefined;
    if (savedParent && savedParent.destination !== this.current?.destination) return false;
    // Only a navigation that will actually run supersedes a pending one.
    const generation = ++this.generation;
    const allowed = await this.authorize(next.destination);
    if (generation !== this.generation || !allowed) return false;
    if (savedParent) this.frames[this.frames.length - 1] = savedParent;
    this.frames.push(next);
    return true;
  }
  async back(): Promise<DashboardNavigationFrame | undefined> {
    const parent = this.frames.at(-2);
    if (!parent) return undefined;
    const generation = ++this.generation;
    const allowed = await this.authorize(parent.destination);
    if (generation !== this.generation || !allowed) return undefined;
    this.frames.pop();
    return clone(parent);
  }
  reset(): void { this.generation++; this.frames = []; }
}

export interface DashboardPageWindow {
  readonly offset: number;
  readonly limit: number;
  readonly total?: number;
  readonly sampled: boolean;
  readonly aggregation?: string;
}
/** Bounded query window; no materialized copy of the complete dataset is needed. */
export function dashboardPageWindow(offset: number, limit: number, maximum: number, total?: number, summary?: { readonly sampled?: boolean; readonly aggregation?: string }): DashboardPageWindow {
  if (!Number.isSafeInteger(maximum) || maximum < 1 || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || (total !== undefined && (!Number.isSafeInteger(total) || total < 0))) throw new Error('Invalid page window');
  const size = Math.min(limit, maximum);
  const start = total === undefined ? offset : Math.min(offset, Math.max(0, total - 1));
  return { offset: start, limit: total === undefined ? size : Math.min(size, total - start), ...(total === undefined ? {} : { total }), sampled: Boolean(summary?.sampled), ...(summary?.aggregation === undefined ? {} : { aggregation: summary.aggregation }) };
}

export interface DashboardPanel { readonly id: string; readonly column: number; readonly row: number; readonly width: number; readonly height: number; readonly pinned?: boolean }
export interface DashboardLayoutConstraints {
  readonly columns: number;
  readonly maxRows: number;
  readonly maxPanels: number;
  readonly minWidth?: number;
  readonly minHeight?: number;
  readonly collision: 'reject' | 'pack';
}
export type DashboardLayoutEdit =
  | { readonly type: 'move'; readonly id: string; readonly columns: number; readonly rows: number }
  | { readonly type: 'resize'; readonly id: string; readonly columns: number; readonly rows: number }
  | { readonly type: 'pin'; readonly id: string; readonly pinned: boolean };
function overlaps(a: DashboardPanel, b: DashboardPanel): boolean { return a.column < b.column + b.width && a.column + a.width > b.column && a.row < b.row + b.height && a.row + a.height > b.row; }

/** Pinned cells are installed first; the deterministic pack policy scans rows then logical columns. */
export function constrainDashboardLayout(panels: readonly DashboardPanel[], constraints: DashboardLayoutConstraints): readonly DashboardPanel[] {
  const { columns, maxRows, maxPanels, minWidth = 1, minHeight = 1 } = constraints;
  if (![columns, maxRows, maxPanels, minWidth, minHeight].every(value => Number.isSafeInteger(value) && value > 0) || minWidth > columns || minHeight > maxRows || columns > 256 || maxRows > 4096 || maxPanels > 1024 || panels.length > maxPanels || !['reject', 'pack'].includes(constraints.collision)) throw new Error('Invalid layout constraints');
  const admitted = snapshotJson(panels, { maxArrayLength: 1024 });
  if (!admitted.ok || !Array.isArray(admitted.value)) throw new Error('Invalid layout');
  const safePanels = admitted.value as unknown as readonly DashboardPanel[];
  const ids = new Set<string>();
  const normalized = safePanels.map(panel => {
    if (!panel || typeof panel.id !== 'string' || !panel.id || ids.has(panel.id) || ![panel.column, panel.row, panel.width, panel.height].every(Number.isSafeInteger)) throw new Error('Invalid panel');
    ids.add(panel.id);
    const width = Math.max(minWidth, Math.min(columns, panel.width));
    const height = Math.max(minHeight, Math.min(maxRows, panel.height));
    if (panel.pinned && (width !== panel.width || height !== panel.height || panel.column < 0 || panel.row < 0 || panel.column + width > columns || panel.row + height > maxRows)) throw new Error('Pinned panel exceeds allocation');
    return { id: panel.id, column: Math.max(0, Math.min(columns - width, panel.column)), row: Math.max(0, Math.min(maxRows - height, panel.row)), width, height, pinned: Boolean(panel.pinned) };
  });
  const placed: DashboardPanel[] = [];
  let comparisons = 0;
  const collides = (candidate: DashboardPanel): boolean => placed.some(other => {
    if (++comparisons > 1_000_000) throw new Error('Layout work budget exceeded');
    return overlaps(candidate, other);
  });
  for (const panel of [...normalized.filter(panel => panel.pinned), ...normalized.filter(panel => !panel.pinned)]) {
    let candidate = panel;
    if (collides(candidate)) {
      if (panel.pinned || constraints.collision === 'reject') throw new Error('Panel collision');
      let found = false;
      for (let row = 0; row <= maxRows - panel.height && !found; row++) {
        for (let column = 0; column <= columns - panel.width && !found; column++) {
          candidate = { ...panel, row, column };
          if (!collides(candidate)) found = true;
        }
      }
      if (!found) throw new Error('Layout has no available space');
    }
    placed.push(candidate);
  }
  return safePanels.map(panel => ({ ...placed.find(candidate => candidate.id === panel.id)! }));
}
export function editDashboardLayout(panels: readonly DashboardPanel[], edit: DashboardLayoutEdit, constraints: DashboardLayoutConstraints): readonly DashboardPanel[] {
  const admitted = snapshotJson({ panels, edit }, { maxArrayLength: 1024 });
  if (!admitted.ok) throw new Error('Invalid layout edit');
  const safe = admitted.value as unknown as { panels: readonly DashboardPanel[]; edit: DashboardLayoutEdit };
  panels = safe.panels;
  edit = safe.edit;
  if (!Array.isArray(panels) || !edit || !['move', 'resize', 'pin'].includes(edit.type) || (edit.type === 'pin' && typeof edit.pinned !== 'boolean')) throw new Error('Invalid layout edit');
  const target = panels.find(panel => panel.id === edit.id);
  if (!target) throw new Error('Unknown panel');
  if (edit.type !== 'pin' && (target.pinned || ![edit.columns, edit.rows].every(Number.isSafeInteger))) throw new Error('Panel cannot be edited');
  return constrainDashboardLayout(panels.map(panel => {
    if (panel.id !== edit.id) return panel;
    if (edit.type === 'pin') return { ...panel, pinned: edit.pinned };
    if (edit.type === 'move') return { ...panel, column: panel.column + edit.columns, row: panel.row + edit.rows };
    return { ...panel, width: panel.width + edit.columns, height: panel.height + edit.rows };
  }), constraints);
}
export function regenerateDashboardLayout(previous: readonly DashboardPanel[], proposed: readonly DashboardPanel[], constraints: DashboardLayoutConstraints): readonly DashboardPanel[] {
  const admitted = snapshotJson({ previous, proposed }, { maxArrayLength: 1024 });
  if (!admitted.ok) throw new Error('Invalid layout regeneration');
  const safe = admitted.value as unknown as { previous: readonly DashboardPanel[]; proposed: readonly DashboardPanel[] };
  previous = safe.previous;
  proposed = safe.proposed;
  if (!Array.isArray(previous) || !Array.isArray(proposed)) throw new Error('Invalid layout regeneration');
  const pinned = previous.filter(panel => panel.pinned);
  const ids = new Set(pinned.map(panel => panel.id));
  return constrainDashboardLayout([...pinned, ...proposed.filter(panel => !ids.has(panel.id))], constraints);
}

/** Convert approved panel geometry to the public controlled dashboard-grid layout API. */
export function toLyraDashboardLayout(panels: readonly DashboardPanel[], constraints: DashboardLayoutConstraints): readonly LyraDashboardCell[] {
  return Object.freeze(constrainDashboardLayout(panels, constraints).map(panel => Object.freeze({ cellId: panel.id, x: panel.column, y: panel.row, w: panel.width, h: panel.height, locked: Boolean(panel.pinned) })));
}

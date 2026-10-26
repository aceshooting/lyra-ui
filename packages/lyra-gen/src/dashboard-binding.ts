import { LyraDashboardGrid, type LyraDashboardCell, type LyraDashboardLayoutChangeDetail } from '@aceshooting/lyra-ui/components/lr-dashboard-grid.js';
import type { LyraTable } from '@aceshooting/lyra-ui/components/lr-table.js';
import type { LyraLiteChart } from '@aceshooting/lyra-ui/components/lr-lite-chart.js';
import { LyraGenViewElement } from './gen-view.js';
import { constrainDashboardLayout, editDashboardLayout, SharedDashboardState, toLyraDashboardLayout } from './dashboard.js';
import type { DashboardLayoutConstraints, DashboardPanel, DashboardSharedSnapshot } from './dashboard.js';
import { snapshotJson } from './schema.js';
import { validateView } from './runtime.js';
import type { LyraGenCatalog, LyraGenView } from './types.js';

export interface DashboardLayoutState { readonly version: 1; readonly revision: number; readonly panels: readonly DashboardPanel[] }
export interface DashboardGridPanel { readonly id: string; readonly view: LyraGenView }
export interface DashboardGridBindingOptions {
  readonly grid: LyraDashboardGrid;
  readonly catalog: LyraGenCatalog;
  readonly panels: readonly DashboardGridPanel[];
  readonly state: DashboardLayoutState;
  readonly constraints: DashboardLayoutConstraints;
  /** Host performs authorization and conditional storage. False leaves the previous layout intact. */
  readonly persist?: (next: DashboardLayoutState, previous: DashboardLayoutState, signal: AbortSignal) => boolean | Promise<boolean>;
  readonly onError?: (code: 'invalid-layout' | 'save-failed') => void;
  readonly readonly?: boolean;
}
function layoutState(input: DashboardLayoutState, constraints: DashboardLayoutConstraints): DashboardLayoutState {
  const admitted = snapshotJson(input);
  if (!admitted.ok) throw new Error('Invalid dashboard layout state');
  const value = admitted.value as unknown as DashboardLayoutState;
  if (!value || value.version !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0 || !Array.isArray(value.panels) || Object.keys(value).some(key => !['version', 'revision', 'panels'].includes(key))) throw new Error('Invalid dashboard layout state');
  return Object.freeze({ version: 1, revision: value.revision, panels: Object.freeze(constrainDashboardLayout(value.panels, constraints).map(panel => Object.freeze(panel))) });
}

/** Binds the existing controlled grid to keyed generated-view children and a serializable layout. */
export class DashboardGridBinding {
  private current: DashboardLayoutState;
  private readonly views = new Map<string, LyraGenViewElement>();
  private readonly shells = new Map<string, HTMLElement>();
  private readonly grid: LyraDashboardGrid;
  private readonly options: DashboardGridBindingOptions;
  private pending?: AbortController;
  private disposed = false;
  private readonly onLayout = (event: Event): void => {
    if (event.target !== this.grid || this.disposed) return;
    const detail = (event as CustomEvent<LyraDashboardLayoutChangeDetail>).detail;
    void this.applyGridLayout(detail?.layout).catch(() => { this.options.onError?.('invalid-layout'); });
  };
  constructor(options: DashboardGridBindingOptions) {
    this.options = options;
    this.grid = options.grid;
    this.current = layoutState(options.state, options.constraints);
    const admittedPanels = snapshotJson(options.panels);
    if (!admittedPanels.ok || !Array.isArray(admittedPanels.value)) throw new Error('Invalid dashboard panels');
    const panels = admittedPanels.value as unknown as readonly DashboardGridPanel[];
    const panelIds = new Set(panels.map(panel => panel.id));
    if (panelIds.size !== panels.length || panelIds.size !== this.current.panels.length || this.current.panels.some(panel => !panelIds.has(panel.id))) throw new Error('Dashboard panel identities must match the layout');
    const documents = panels.map(panel => {
      const result = validateView(panel.view, options.catalog);
      if (!result.ok) throw new Error('Invalid dashboard panel document');
      return { id: panel.id, view: result.value };
    });
    for (const panel of documents) {
      const view = new LyraGenViewElement();
      view.catalog = options.catalog;
      view.document = panel.view;
      const shell = this.grid.ownerDocument.createElement('div');
      shell.setAttribute('cell-id', panel.id);
      shell.append(view);
      this.views.set(panel.id, view);
      this.shells.set(panel.id, shell);
      this.grid.append(shell);
    }
    this.grid.columns = options.constraints.columns;
    this.grid.collision = 'reject';
    this.grid.cellsDraggable = true;
    this.grid.cellsResizable = true;
    this.display();
    this.grid.addEventListener('lr-layout-change', this.onLayout);
  }
  get state(): DashboardLayoutState { return this.current; }
  panel(id: string): LyraGenViewElement | undefined { return this.views.get(id); }
  /** Restore navigation focus to a surviving panel when its original data mark was re-rendered. */
  focusPanel(id: string): boolean {
    const shell = this.shells.get(id);
    if (!shell || this.disposed) return false;
    shell.tabIndex = -1; shell.focus({ preventScroll: true }); return true;
  }
  private display(): void {
    this.grid.layout = toLyraDashboardLayout(this.current.panels, this.options.constraints);
    this.grid.readonly = Boolean(this.options.readonly || this.pending || this.disposed);
  }
  /** A higher document revision updates the same element, preserving untouched user state. */
  updatePanel(id: string, document: LyraGenView): void {
    if (this.disposed) throw new Error('Dashboard binding disposed');
    const view = this.views.get(id);
    const checked = validateView(document, this.options.catalog);
    if (!view || !checked.ok || checked.value.surfaceId !== view.document?.surfaceId || checked.value.revision <= (view.document?.revision ?? -1)) throw new Error('Invalid or stale dashboard panel update');
    view.document = checked.value;
  }
  async setPinned(id: string, pinned: boolean): Promise<boolean> {
    return this.apply(editDashboardLayout(this.current.panels, { type: 'pin', id, pinned }, this.options.constraints));
  }
  private async applyGridLayout(input: readonly LyraDashboardCell[] | undefined): Promise<boolean> {
    const admitted = snapshotJson(input);
    if (!admitted.ok || !Array.isArray(admitted.value)) throw new Error('Invalid grid layout proposal');
    const cells = admitted.value as unknown as readonly LyraDashboardCell[];
    if (cells.length !== this.current.panels.length || new Set(cells.map(cell => cell.cellId)).size !== cells.length) throw new Error('Grid layout identities cannot change');
    const panels = cells.map(cell => {
      const previous = this.current.panels.find(panel => panel.id === cell.cellId);
      if (!previous || (previous.pinned && (cell.x !== previous.column || cell.y !== previous.row || cell.w !== previous.width || cell.h !== previous.height))) throw new Error('Pinned or unknown grid cell');
      return { id: cell.cellId, column: cell.x, row: cell.y, width: cell.w, height: cell.h, pinned: previous.pinned };
    });
    return this.apply(panels);
  }
  private async apply(panels: readonly DashboardPanel[]): Promise<boolean> {
    if (this.disposed || this.options.readonly || this.pending) return false;
    const previous = this.current;
    const next = layoutState({ version: 1, revision: previous.revision + 1, panels }, this.options.constraints);
    const signal = new AbortController();
    this.pending = signal;
    this.display();
    try {
      const accepted = this.options.persist ? await this.options.persist(next, previous, signal.signal) : true;
      if (this.disposed || signal.signal.aborted || this.pending !== signal) return false;
      if (!accepted) { this.options.onError?.('save-failed'); return false; }
      this.current = next;
      return true;
    } catch {
      if (!signal.signal.aborted) this.options.onError?.('save-failed');
      return false;
    } finally {
      if (this.pending === signal) { this.pending = undefined; this.display(); }
    }
  }
  dispose(): void {
    this.disposed = true;
    this.pending?.abort();
    this.pending = undefined;
    this.grid.removeEventListener('lr-layout-change', this.onLayout);
    for (const shell of this.shells.values()) shell.remove();
    this.shells.clear();
    this.views.clear();
    this.grid.readonly = true;
  }
}

export interface DashboardSelectionBindingOptions<T> {
  readonly table: LyraTable<T, string>;
  readonly chart: LyraLiteChart;
  readonly shared: SharedDashboardState;
  readonly scope: string;
  readonly rowId: (row: T) => string;
  /** Chart category index to stable record id; update after host pagination/filter changes.
   * setKeys preserves off-page selection unless a complete availableIds set is supplied. */
  readonly keys: readonly string[];
  readonly onSelection?: (snapshot: DashboardSharedSnapshot) => void;
}
/** Uses the canonical chart event once; programmatic selection writes do not republish events. */
export function bindDashboardSelection<T>(options: DashboardSelectionBindingOptions<T>): { readonly setKeys: (keys: readonly string[], availableIds?: ReadonlySet<string>) => void; readonly dispose: () => void } {
  let keys = [...options.keys];
  options.table.rowKey = options.rowId;
  options.table.selectionMode = 'single';
  const apply = (snapshot: DashboardSharedSnapshot) => { options.table.selectedRowKeys = new Set(snapshot.selection); options.onSelection?.(snapshot); };
  const table = (event: Event) => {
    const selected = (event as CustomEvent<{ readonly selectedRowKeys: ReadonlySet<string> }>).detail.selectedRowKeys;
    options.shared.update(options.scope, 'table', { selection: [...selected] });
    options.onSelection?.(options.shared.snapshot(options.scope));
  };
  const chart = (event: Event) => {
    const index = (event as CustomEvent<{ readonly index: number }>).detail.index;
    const id = Number.isSafeInteger(index) ? keys[index] : undefined;
    if (id !== undefined) options.shared.update(options.scope, 'chart', { selection: [id] });
  };
  const off = options.shared.subscribe(options.scope, 'table', event => apply(event.snapshot));
  options.table.addEventListener('lr-selection-change', table);
  options.chart.addEventListener('lr-datum-activate', chart);
  apply(options.shared.snapshot(options.scope));
  return { setKeys(next, availableIds) { keys = [...next]; if (availableIds) options.shared.clearDangling(options.scope, availableIds); }, dispose() { off(); options.table.removeEventListener('lr-selection-change', table); options.chart.removeEventListener('lr-datum-activate', chart); } };
}

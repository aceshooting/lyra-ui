import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { tag } from '../../internal/prefix.js';
import { srOnly } from '../../internal/a11y.js';
import { Announcer } from '../../internal/announcer.js';
import { isRtl } from '../../internal/rtl.js';
import { isArrowKey, finiteInteger, finiteRange } from '../../internal/numbers.js';
import { styles } from './dashboard-grid.styles.js';
import {
  clampCandidate,
  findCollisions,
  resolvePlacement,
  sortSpatial,
  type DashboardCell,
  type DashboardCollisionPolicy,
} from './layout.js';

/** A light-DOM-adopted default cell (`<lr-widget>` wrapping an `<lr-widget-renderer>`) -- a
 *  structural type, not an import of `LyraWidget`/`LyraWidgetRenderer`, so this module never
 *  depends on the `widget`/`widget-renderer` components' own class module load order. Mirrors
 *  `lr-flow-canvas`'s own `FlowNodeCardEl` structural-type convention. */
interface DefaultCellEl extends HTMLElement {
  label: string;
}
interface WidgetRendererEl extends HTMLElement {
  tree: DashboardCell['widget'];
}

const INTERACTIVE_DESCENDANT_SELECTOR = 'button, a[href], input, select, textarea, [role="button"], [tabindex]:not([part="cell"])';

interface CellDragState {
  pointerId: number;
  cellId: string;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  w: number;
  h: number;
  colPitch: number;
  rowPitch: number;
  wrapper: HTMLElement;
  rtlFlip: number;
  currentX?: number;
  currentY?: number;
}

interface CellResizeState {
  pointerId: number;
  cellId: string;
  startClientX: number;
  startClientY: number;
  startW: number;
  startH: number;
  x: number;
  y: number;
  colPitch: number;
  rowPitch: number;
  wrapper: HTMLElement;
  rtlFlip: number;
  currentW?: number;
  currentH?: number;
}

export interface LyraDashboardGridEventMap {
  'lr-cell-move': CustomEvent<{ id: string; position: { x: number; y: number }; previous: { x: number; y: number } }>;
  'lr-cell-resize': CustomEvent<{ id: string; size: { w: number; h: number }; previous: { w: number; h: number } }>;
  'lr-collision': CustomEvent<{ id: string; collidedWith: string[]; policy: DashboardCollisionPolicy; accepted: boolean }>;
  'lr-layout-change': CustomEvent<{ layout: DashboardCell[] }>;
}

/**
 * `<lr-dashboard-grid>` — a responsive, keyboard-accessible widget grid: positions `layout`
 * entries (`DashboardCell`: `x`/`y`/`w`/`h` grid units + a widget descriptor) on a CSS Grid,
 * composing `<lr-widget>` + `<lr-widget-renderer>` for each cell's default content, and owns all
 * drag/resize/collision interaction as controlled events -- it never mutates `layout` itself, nor
 * ever touches `localStorage`/network; the host applies (or ignores) every emitted event and owns
 * persistence entirely, mirroring `lr-flow-canvas`/`lr-table`'s own controlled-component
 * convention. Readonly (viewer) by default; opt into editor gestures individually via
 * `cells-draggable`/`cells-resizable`, or lock the whole grid via `locked`.
 *
 * Cell content: a `layout` entry with no matching light-DOM child (matched by `cell-id`) gets a
 * default `<lr-widget label="...">` wrapping an `<lr-widget-renderer .tree=${cell.widget}>`
 * auto-created and adopted into `slot="cell-{id}"` -- this component's own job is the grid
 * layout/drag/resize/collision/persistence-event mechanics *around* that content, not widget
 * rendering itself (see `lr-widget-renderer`'s own doc for its declarative-tree contract). A
 * consumer wanting full control over one cell's markup can instead author
 * `<div cell-id="...">...</div>` as a direct child; it is adopted in place of the default cell.
 *
 * Keyboard: cells share one roving tabindex, in row-major (`sortSpatial`) order. Arrow
 * keys/Home/End move the roving focus (RTL-aware: physical Left/Right always match what the
 * cursor visually does, matching `lr-flow-canvas`'s own convention). While a cell has focus,
 * Ctrl/Cmd+Arrow moves it by one grid unit and Ctrl/Cmd+Shift+Arrow resizes it by one grid unit
 * (Right/Down grow, Left/Up shrink) -- the full keyboard-operable equivalent of the pointer
 * drag/resize gestures below, per this library's accessibility bar (no pointer-only interaction).
 *
 * Collision: every move/resize request -- pointer or keyboard -- is resolved through `collision`
 * (`'reject'` the default, `'push'`, or `'overlap'`; see `resolvePlacement()` in `layout.ts` for
 * the exact rule). A rejected request leaves `layout` untouched and only announces; an accepted
 * one emits `lr-cell-move`/`lr-cell-resize` plus a `lr-layout-change` snapshot of the full
 * proposed layout (including any `'push'` cascade) -- the host's one persistence hook: listen for
 * it and persist `event.detail.layout` however it likes (`localStorage`, a network call, neither).
 *
 * Responsive: below a ~40rem container allocation (`@container`, not the viewport -- a dashboard
 * grid is commonly embedded in a panel of varying width), cells stack into a single flowing
 * column in the same row-major order the grid itself renders them in, instead of overflowing or
 * shrinking columns unreadably.
 *
 * @customElement lr-dashboard-grid
 * @slot cell-{id} - A `layout` entry's cell content; auto-populated by a default composed
 *   `<lr-widget>`/`<lr-widget-renderer>` pair unless a light-DOM `[cell-id="{id}"]` child is
 *   authored instead.
 * @event lr-cell-move - `detail: { id, position, previous }` — an accepted move committed.
 * @event lr-cell-resize - `detail: { id, size, previous }` — an accepted resize committed.
 * @event lr-collision - `detail: { id, collidedWith, policy, accepted }` — a move/resize request
 *   overlapped at least one other cell, regardless of whether `policy` ultimately accepted it.
 * @event lr-layout-change - `detail: { layout } }` — the full proposed layout after any accepted
 *   move/resize (including a `'push'` cascade); the host's persistence hook.
 * @csspart base - The grid root.
 * @csspart empty - The `lr-empty` shown when `layout` is empty.
 * @csspart cell - A single cell's positioned wrapper.
 * @csspart resize-handle - The pointer resize grip in a cell's trailing/bottom corner (only
 *   rendered while `cells-resizable`); the Ctrl/Cmd+Shift+Arrow keyboard path is the resize
 *   handle's full accessible equivalent, so the handle itself is `aria-hidden`.
 * @csspart live-region - The current move/resize/collision announcement.
 */
export class LyraDashboardGrid extends LyraElement<LyraDashboardGridEventMap> {
  static styles = [LyraElement.styles, styles, srOnly];

  /** The grid's cells: position/size (grid units) + a widget descriptor per entry. Never mutated
   *  by this component -- every move/resize is an event the host applies (or ignores). */
  @property({ attribute: false }) layout: DashboardCell[] = [];
  /** Column count of the underlying CSS Grid. */
  @property({ type: Number }) columns = 12;
  /** Row track height, in px (also the pointer-resize/drag row snap pitch, together with `gap`). */
  @property({ type: Number, attribute: 'row-height' }) rowHeight = 80;
  /** Gap between cells, in px, on both axes. */
  @property({ type: Number }) gap = 8;
  /** How a move/resize that would overlap another cell is resolved -- see the class doc. */
  @property() collision: DashboardCollisionPolicy = 'reject';
  /** Opts into pointer-drag + Ctrl/Cmd+Arrow keyboard move for unlocked cells. */
  @property({ type: Boolean, attribute: 'cells-draggable' }) cellsDraggable = false;
  /** Opts into the pointer resize handle + Ctrl/Cmd+Shift+Arrow keyboard resize for unlocked cells. */
  @property({ type: Boolean, attribute: 'cells-resizable' }) cellsResizable = false;
  /** Disables every drag/resize gesture grid-wide, regardless of `cells-draggable`/
   *  `cells-resizable` or a cell's own `locked`. */
  @property({ type: Boolean, reflect: true }) locked = false;
  /** Overrides the grid region's accessible name; falls back to a generic localized label. Fed
   *  only by a host `aria-label`, matching `lr-flow-canvas`'s own host-override pattern. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  private get safeColumns(): number {
    return finiteInteger(this.columns, 12, 1, 48);
  }
  private get safeRowHeight(): number {
    return finiteRange(this.rowHeight, 80, 1);
  }
  private get safeGap(): number {
    return finiteRange(this.gap, 8, 0);
  }

  private get sortedLayout(): DashboardCell[] {
    return sortSpatial(this.layout);
  }

  private readonly announcer = new Announcer({ onFlush: (text) => (this.liveText = text) });
  @state() private liveText = '';
  @state() private activeCellIndex = 0;

  private cellDrag?: CellDragState;
  private cellResize?: CellResizeState;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // An in-flight drag/resize gesture holds window-level listeners; if the element is removed
    // mid-gesture nothing else ever detaches them, and a later unrelated pointerup would fire
    // against a detached tree with stale gesture state.
    this.cellDrag = undefined;
    window.removeEventListener('pointermove', this.onCellPointerMove);
    window.removeEventListener('pointerup', this.onCellPointerUp);
    window.removeEventListener('pointercancel', this.onCellPointerUp);
    window.removeEventListener('lostpointercapture', this.onCellPointerUp);
    this.cellResize = undefined;
    window.removeEventListener('pointermove', this.onResizeHandlePointerMove);
    window.removeEventListener('pointerup', this.onResizeHandlePointerUp);
    window.removeEventListener('pointercancel', this.onResizeHandlePointerUp);
    window.removeEventListener('lostpointercapture', this.onResizeHandlePointerUp);
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('layout')) this.syncDefaultCells();
  }

  // ---------------------------------------------------------------------
  // Default cell adoption (light-DOM, by cell-id -- mirrors lr-flow-canvas's node-id adoption)
  // ---------------------------------------------------------------------

  private cellLabel(cell: DashboardCell): string {
    return cell.label || cell.id;
  }

  /** By-`cell-id` reconciliation of light-DOM children: a user-authored child gets
   *  `slot="cell-{id}"` set on it and is left otherwise untouched; a `layout` entry with no
   *  matching light-DOM child gets a default `<lr-widget>`/`<lr-widget-renderer>` pair created
   *  and appended (marked `data-dashboard-grid-default-cell` so it -- and only it -- is removed
   *  again once its cell id disappears, and kept in sync on every `layout` change). A light-DOM
   *  child whose `cell-id` matches no current entry is left in place with no `slot` (renders
   *  nowhere) and a console warning, exactly like `lr-flow-canvas`'s equivalent case. */
  private syncDefaultCells(): void {
    const ids = new Set(this.layout.map((c) => c.id));
    const byCellId = new Map<string, Element>();
    for (const child of Array.from(this.children)) {
      const cellId = child.getAttribute('cell-id');
      if (!cellId) continue;
      byCellId.set(cellId, child);
      if (ids.has(cellId)) {
        child.setAttribute('slot', `cell-${cellId}`);
      } else {
        child.removeAttribute('slot');
        console.warn(
          `<lr-dashboard-grid> a child with cell-id="${cellId}" matches no entry in \`layout\`; it will not render.`,
        );
      }
    }
    for (const [cellId, child] of byCellId) {
      if (!ids.has(cellId) && child.hasAttribute('data-dashboard-grid-default-cell')) {
        child.remove();
        byCellId.delete(cellId);
      }
    }
    for (const cell of this.layout) {
      const existing = byCellId.get(cell.id);
      if (existing?.hasAttribute('data-dashboard-grid-default-cell')) {
        this.updateDefaultCell(existing as DefaultCellEl, cell);
      } else if (!existing) {
        this.appendChild(this.createDefaultCell(cell));
      }
    }
  }

  private createDefaultCell(cell: DashboardCell): Element {
    const widget = document.createElement(tag('widget')) as DefaultCellEl;
    widget.setAttribute('cell-id', cell.id);
    widget.setAttribute('data-dashboard-grid-default-cell', '');
    widget.setAttribute('slot', `cell-${cell.id}`);
    const renderer = document.createElement(tag('widget-renderer'));
    widget.appendChild(renderer);
    this.updateDefaultCell(widget, cell);
    return widget;
  }

  private updateDefaultCell(widget: DefaultCellEl, cell: DashboardCell): void {
    widget.label = this.cellLabel(cell);
    const renderer = widget.querySelector(tag('widget-renderer')) as WidgetRendererEl | null;
    if (renderer) renderer.tree = cell.widget ?? null;
  }

  // ---------------------------------------------------------------------
  // Roving focus / keyboard move & resize
  // ---------------------------------------------------------------------

  private onCellFocus(id: string): void {
    const index = this.sortedLayout.findIndex((c) => c.id === id);
    if (index >= 0) this.activeCellIndex = index;
  }

  private focusCellAt(index: number): void {
    const cells = this.sortedLayout;
    if (index < 0 || index >= cells.length) return;
    this.activeCellIndex = index;
    const cell = cells[index];
    this.announcer.announce(
      this.localize('flowItemAnnouncement', undefined, { item: this.cellLabel(cell), index: index + 1, total: cells.length }),
    );
    void this.updateComplete.then(() => {
      (this.renderRoot.querySelector(`[part="cell"][data-cell-id="${CSS.escape(cell.id)}"]`) as HTMLElement | null)?.focus();
    });
  }

  private onCellKeyDown(e: KeyboardEvent, cell: DashboardCell): void {
    const isMod = e.ctrlKey || e.metaKey;
    if (isMod && isArrowKey(e.key)) {
      e.preventDefault();
      if (e.shiftKey) this.keyboardResize(cell, e.key);
      else this.keyboardMove(cell, e.key);
      return;
    }
    const cells = this.sortedLayout;
    const index = cells.findIndex((c) => c.id === cell.id);
    if (index < 0) return;
    const rtl = isRtl(this);
    const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next = index;
    if (e.key === forwardKey || e.key === 'ArrowDown') next = Math.min(cells.length - 1, index + 1);
    else if (e.key === backwardKey || e.key === 'ArrowUp') next = Math.max(0, index - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = cells.length - 1;
    else return;
    e.preventDefault();
    this.focusCellAt(next);
  }

  private keyboardMove(cell: DashboardCell, key: string): void {
    if (!this.cellsDraggable || this.locked || cell.locked) return;
    const rtlFlip = isRtl(this) ? -1 : 1;
    let dx = 0;
    let dy = 0;
    if (key === 'ArrowRight') dx = rtlFlip;
    else if (key === 'ArrowLeft') dx = -rtlFlip;
    else if (key === 'ArrowDown') dy = 1;
    else if (key === 'ArrowUp') dy = -1;
    else return;
    this.commitPlacement(cell.id, { x: cell.x + dx, y: cell.y + dy, w: cell.w, h: cell.h }, 'move');
  }

  private keyboardResize(cell: DashboardCell, key: string): void {
    if (!this.cellsResizable || this.locked || cell.locked) return;
    const rtlFlip = isRtl(this) ? -1 : 1;
    let dw = 0;
    let dh = 0;
    if (key === 'ArrowRight') dw = rtlFlip;
    else if (key === 'ArrowLeft') dw = -rtlFlip;
    else if (key === 'ArrowDown') dh = 1;
    else if (key === 'ArrowUp') dh = -1;
    else return;
    this.commitPlacement(cell.id, { x: cell.x, y: cell.y, w: cell.w + dw, h: cell.h + dh }, 'resize');
  }

  // ---------------------------------------------------------------------
  // Shared commit path (keyboard nudge, and a pointer gesture's final drop)
  // ---------------------------------------------------------------------

  private commitPlacement(id: string, requested: { x: number; y: number; w: number; h: number }, kind: 'move' | 'resize'): void {
    const cell = this.layout.find((c) => c.id === id);
    if (!cell) return;
    const result = resolvePlacement(this.layout, id, requested, this.safeColumns, this.collision);
    if (result.collidedWith.length > 0) {
      this.emit('lr-collision', { id, collidedWith: result.collidedWith, policy: this.collision, accepted: result.accepted });
    }
    if (!result.accepted) {
      this.announcer.announce(this.localize('dashboardCellCollisionRejected', undefined, { label: this.cellLabel(cell) }));
      return;
    }
    const updated = result.layout.find((c) => c.id === id)!;
    // `requested` is clamped (bounds + this cell's own min/max) before ever reaching collision
    // resolution, so e.g. a shrink-past-minW request can come back byte-identical to `cell` --
    // that's a real no-op, not a move/resize, and must not emit a spurious event.
    const unchanged =
      kind === 'move' ? updated.x === cell.x && updated.y === cell.y : updated.w === cell.w && updated.h === cell.h;
    if (unchanged) return;
    if (kind === 'move') {
      this.emit('lr-cell-move', {
        id,
        position: { x: updated.x, y: updated.y },
        previous: { x: cell.x, y: cell.y },
      });
      this.announcer.announce(
        this.localize('dashboardCellMoved', undefined, { label: this.cellLabel(cell), x: updated.x + 1, y: updated.y + 1 }),
      );
    } else {
      this.emit('lr-cell-resize', {
        id,
        size: { w: updated.w, h: updated.h },
        previous: { w: cell.w, h: cell.h },
      });
      this.announcer.announce(
        this.localize('dashboardCellResized', undefined, { label: this.cellLabel(cell), w: updated.w, h: updated.h }),
      );
    }
    this.emit('lr-layout-change', { layout: result.layout });
  }

  // ---------------------------------------------------------------------
  // Pointer drag (move)
  // ---------------------------------------------------------------------

  private cellStyle(cell: DashboardCell): Record<string, string> {
    return {
      'grid-column': `${cell.x + 1} / span ${cell.w}`,
      'grid-row': `${cell.y + 1} / span ${cell.h}`,
    };
  }

  /** Column/row pixel pitch, measured once per gesture (not re-measured on every pointermove --
   *  matches `lr-flow-canvas`'s own once-per-gesture rect-measurement convention). */
  private measurePitch(): { colPitch: number; rowPitch: number } | null {
    const baseEl = this.renderRoot.querySelector('[part="base"]') as HTMLElement | null;
    if (!baseEl) return null;
    const rect = baseEl.getBoundingClientRect();
    const columns = this.safeColumns;
    const gap = this.safeGap;
    const rawColPitch = (rect.width - gap * (columns - 1)) / columns;
    return { colPitch: rawColPitch > 0 ? rawColPitch : 1, rowPitch: this.safeRowHeight + gap };
  }

  private resetCellInlineStyle(id: string, wrapper: HTMLElement): void {
    const cell = this.layout.find((c) => c.id === id);
    if (!cell) return;
    const style = this.cellStyle(cell);
    wrapper.style.gridColumn = style['grid-column'];
    wrapper.style.gridRow = style['grid-row'];
    wrapper.removeAttribute('data-collision');
  }

  private onCellPointerDown(e: PointerEvent, cell: DashboardCell): void {
    if (!this.cellsDraggable || this.locked || cell.locked || e.button !== 0) return;
    const wrapper = e.currentTarget as HTMLElement;
    const interactive = (e.target as HTMLElement).closest(INTERACTIVE_DESCENDANT_SELECTOR);
    if (interactive && interactive !== wrapper && wrapper.contains(interactive)) return;
    const pitch = this.measurePitch();
    if (!pitch) return;
    e.stopPropagation();
    this.cellDrag = {
      pointerId: e.pointerId,
      cellId: cell.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: cell.x,
      startY: cell.y,
      w: cell.w,
      h: cell.h,
      ...pitch,
      wrapper,
      rtlFlip: isRtl(this) ? -1 : 1,
    };
    wrapper.setPointerCapture?.(e.pointerId);
    wrapper.setAttribute('data-dragging', '');
    window.addEventListener('pointermove', this.onCellPointerMove);
    window.addEventListener('pointerup', this.onCellPointerUp);
    window.addEventListener('pointercancel', this.onCellPointerUp);
    window.addEventListener('lostpointercapture', this.onCellPointerUp);
  }

  private onCellPointerMove = (e: PointerEvent): void => {
    const drag = this.cellDrag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dxUnits = Math.round(((e.clientX - drag.startClientX) * drag.rtlFlip) / drag.colPitch);
    const dyUnits = Math.round((e.clientY - drag.startClientY) / drag.rowPitch);
    const { x, y } = clampCandidate(
      {},
      { x: drag.startX + dxUnits, y: drag.startY + dyUnits, w: drag.w, h: drag.h },
      this.safeColumns,
    );
    drag.wrapper.style.gridColumn = `${x + 1} / span ${drag.w}`;
    drag.wrapper.style.gridRow = `${y + 1} / span ${drag.h}`;
    if (this.collision !== 'overlap') {
      const collides = findCollisions(this.layout, { id: drag.cellId, x, y, w: drag.w, h: drag.h }).length > 0;
      drag.wrapper.toggleAttribute('data-collision', collides);
    }
    drag.currentX = x;
    drag.currentY = y;
  };

  private onCellPointerUp = (e: PointerEvent): void => {
    const drag = this.cellDrag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    this.cellDrag = undefined;
    drag.wrapper.removeAttribute('data-dragging');
    window.removeEventListener('pointermove', this.onCellPointerMove);
    window.removeEventListener('pointerup', this.onCellPointerUp);
    window.removeEventListener('pointercancel', this.onCellPointerUp);
    window.removeEventListener('lostpointercapture', this.onCellPointerUp);
    const x = drag.currentX ?? drag.startX;
    const y = drag.currentY ?? drag.startY;
    if (x !== drag.startX || y !== drag.startY) {
      this.commitPlacement(drag.cellId, { x, y, w: drag.w, h: drag.h }, 'move');
    }
    this.resetCellInlineStyle(drag.cellId, drag.wrapper);
    this.requestUpdate();
  };

  // ---------------------------------------------------------------------
  // Pointer resize
  // ---------------------------------------------------------------------

  private onResizeHandlePointerDown(e: PointerEvent, cell: DashboardCell): void {
    if (!this.cellsResizable || this.locked || cell.locked || e.button !== 0) return;
    const wrapper = (e.currentTarget as HTMLElement).closest('[part="cell"]') as HTMLElement | null;
    if (!wrapper) return;
    const pitch = this.measurePitch();
    if (!pitch) return;
    e.stopPropagation();
    this.cellResize = {
      pointerId: e.pointerId,
      cellId: cell.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startW: cell.w,
      startH: cell.h,
      x: cell.x,
      y: cell.y,
      ...pitch,
      wrapper,
      rtlFlip: isRtl(this) ? -1 : 1,
    };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    wrapper.setAttribute('data-resizing', '');
    window.addEventListener('pointermove', this.onResizeHandlePointerMove);
    window.addEventListener('pointerup', this.onResizeHandlePointerUp);
    window.addEventListener('pointercancel', this.onResizeHandlePointerUp);
    window.addEventListener('lostpointercapture', this.onResizeHandlePointerUp);
  }

  private onResizeHandlePointerMove = (e: PointerEvent): void => {
    const resize = this.cellResize;
    if (!resize || e.pointerId !== resize.pointerId) return;
    const dwUnits = Math.round(((e.clientX - resize.startClientX) * resize.rtlFlip) / resize.colPitch);
    const dhUnits = Math.round((e.clientY - resize.startClientY) / resize.rowPitch);
    const { w, h } = clampCandidate(
      this.layout.find((c) => c.id === resize.cellId) ?? {},
      { x: resize.x, y: resize.y, w: resize.startW + dwUnits, h: resize.startH + dhUnits },
      this.safeColumns,
    );
    resize.wrapper.style.gridColumn = `${resize.x + 1} / span ${w}`;
    resize.wrapper.style.gridRow = `${resize.y + 1} / span ${h}`;
    if (this.collision !== 'overlap') {
      const collides = findCollisions(this.layout, { id: resize.cellId, x: resize.x, y: resize.y, w, h }).length > 0;
      resize.wrapper.toggleAttribute('data-collision', collides);
    }
    resize.currentW = w;
    resize.currentH = h;
  };

  private onResizeHandlePointerUp = (e: PointerEvent): void => {
    const resize = this.cellResize;
    if (!resize || e.pointerId !== resize.pointerId) return;
    this.cellResize = undefined;
    resize.wrapper.removeAttribute('data-resizing');
    window.removeEventListener('pointermove', this.onResizeHandlePointerMove);
    window.removeEventListener('pointerup', this.onResizeHandlePointerUp);
    window.removeEventListener('pointercancel', this.onResizeHandlePointerUp);
    window.removeEventListener('lostpointercapture', this.onResizeHandlePointerUp);
    const w = resize.currentW ?? resize.startW;
    const h = resize.currentH ?? resize.startH;
    if (w !== resize.startW || h !== resize.startH) {
      this.commitPlacement(resize.cellId, { x: resize.x, y: resize.y, w, h }, 'resize');
    }
    this.resetCellInlineStyle(resize.cellId, resize.wrapper);
    this.requestUpdate();
  };

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  private renderCell(cell: DashboardCell, active: boolean): TemplateResult {
    const resizableHere = this.cellsResizable && !this.locked && !cell.locked;
    return html`<div
      part="cell"
      role="group"
      tabindex=${active ? '0' : '-1'}
      aria-label=${this.cellLabel(cell)}
      data-cell-id=${cell.id}
      style=${styleMap(this.cellStyle(cell))}
      @keydown=${(e: KeyboardEvent) => this.onCellKeyDown(e, cell)}
      @focus=${() => this.onCellFocus(cell.id)}
      @pointerdown=${(e: PointerEvent) => this.onCellPointerDown(e, cell)}
    >
      <slot name=${`cell-${cell.id}`}></slot>
      ${resizableHere
        ? html`<button
            part="resize-handle"
            type="button"
            tabindex="-1"
            aria-hidden="true"
            @pointerdown=${(e: PointerEvent) => this.onResizeHandlePointerDown(e, cell)}
          ></button>`
        : nothing}
    </div>`;
  }

  render(): TemplateResult {
    const cells = this.sortedLayout;
    const label = this.accessibleLabel || this.localize('dashboardGridLabel');
    if (cells.length === 0) {
      return html`<div part="base" role="region" aria-label=${label}>
        <lr-empty part="empty" heading=${this.localize('noData')}></lr-empty>
      </div>`;
    }
    const activeIndex = Math.min(this.activeCellIndex, cells.length - 1);
    return html`<div
      part="base"
      role="region"
      aria-label=${label}
      style=${styleMap({
        '--lr-dashboard-grid-columns': String(this.safeColumns),
        '--lr-dashboard-grid-row-height': `${this.safeRowHeight}px`,
        '--lr-dashboard-grid-gap': `${this.safeGap}px`,
      })}
    >
      ${repeat(cells, (cell) => cell.id, (cell, i) => this.renderCell(cell, i === activeIndex))}
      <div part="live-region" class="sr-only" role="status" aria-live="polite" aria-atomic="true">${this.liveText}</div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-dashboard-grid': LyraDashboardGrid;
  }
}

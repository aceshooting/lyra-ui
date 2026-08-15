import { html, nothing, type TemplateResult, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { styleMap } from "lit/directives/style-map.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { tag } from "../../../internal/prefix.js";
import { isAccessibilityVisible, srOnly } from "../../../internal/a11y.js";
import {
  Announcer,
  acquireAnnouncementSink,
  type AnnouncementSink,
} from "../../../internal/announcer.js";
import { isRtl } from "../../../internal/rtl.js";
import { getNumberFormat } from "../../../internal/intl-cache.js";
import {
  isArrowKey,
  finiteInteger,
  finiteRange,
} from "../../../internal/numbers.js";
import { styles } from "./dashboard-grid.styles.js";
import {
  type LyraDashboardCell,
  type LyraDashboardCollisionPolicy,
} from "./layout.js";
import {
  clampDashboardCandidate,
  createDashboardSpatialIndex,
  findDashboardCollisions,
  normalizeLyraDashboardCollisionPolicy,
  projectDashboardLayout,
  resolveDashboardPlacement,
  snapshotDashboardLayout,
  sortDashboardSpatial,
  type DashboardAuthoredCellSnapshot,
  type DashboardSpatialIndex,
} from "./layout-internal.js";
import {
  createWidgetDocument,
  type LyraWidgetDocument,
} from "../../conversation/widget-renderer/resolve.js";
import { activeElementIn } from "../../../internal/active-element.js";
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_dashboardCellCollisionRejected, LYRA_DEFAULT_dashboardCellMoved, LYRA_DEFAULT_dashboardCellResized, LYRA_DEFAULT_dashboardGridLabel, LYRA_DEFAULT_flowItemAnnouncement, LYRA_DEFAULT_noData } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** A light-DOM-adopted default cell (`<lr-widget>` wrapping an `<lr-widget-renderer>`) -- a
 *  structural type, not an import of `LyraWidget`/`LyraWidgetRenderer`, so this module never
 *  depends on the `widget`/`widget-renderer` components' own class module load order. Mirrors
 *  `lr-flow-canvas`'s own `FlowNodeCardEl` structural-type convention. */
interface DefaultCellEl extends HTMLElement {
  label: string;
}
interface WidgetRendererEl extends HTMLElement {
  document: LyraWidgetDocument | null;
}

const INTERACTIVE_DESCENDANT_SELECTOR =
  'button, a[href], area[href], input, select, textarea, summary, label, audio[controls], video[controls], [contenteditable]:not([contenteditable="false"]), [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="slider"], [role="spinbutton"], [role="textbox"], [role="combobox"], [role="option"], [role="menuitem"], [tabindex]:not([part="cell"])';

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
  ownerWindow: Window;
  rtlFlip: number;
  layout: readonly LyraDashboardCell[];
  spatialIndex: DashboardSpatialIndex;
  previewFrame?: number;
  pendingClientX?: number;
  pendingClientY?: number;
  moved?: boolean;
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
  captureTarget: HTMLElement;
  ownerWindow: Window;
  rtlFlip: number;
  layout: readonly LyraDashboardCell[];
  spatialIndex: DashboardSpatialIndex;
  previewFrame?: number;
  pendingClientX?: number;
  pendingClientY?: number;
  moved?: boolean;
  currentW?: number;
  currentH?: number;
}

export interface LyraDashboardCellMoveDetail {
  readonly id: string;
  readonly position: Readonly<{ x: number; y: number }>;
  readonly previous: Readonly<{ x: number; y: number }>;
}

export interface LyraDashboardCellResizeDetail {
  readonly id: string;
  readonly size: Readonly<{ w: number; h: number }>;
  readonly previous: Readonly<{ w: number; h: number }>;
}

export interface LyraDashboardCollisionDetail {
  readonly id: string;
  readonly collidedWith: readonly string[];
  readonly policy: LyraDashboardCollisionPolicy;
  readonly accepted: boolean;
}

export interface LyraDashboardLayoutChangeDetail {
  readonly layout: readonly LyraDashboardCell[];
}

export interface LyraDashboardGridEventMap {
  "lr-cell-move": CustomEvent<LyraDashboardCellMoveDetail>;
  "lr-cell-resize": CustomEvent<LyraDashboardCellResizeDetail>;
  "lr-collision": CustomEvent<LyraDashboardCollisionDetail>;
  "lr-layout-change": CustomEvent<LyraDashboardLayoutChangeDetail>;
}

/**
 * `<lr-dashboard-grid>` — a responsive, keyboard-accessible widget grid: positions `layout`
 * entries (`LyraDashboardCell`: `x`/`y`/`w`/`h` grid units + a widget descriptor) on a CSS Grid,
 * composing `<lr-widget>` + `<lr-widget-renderer>` for each cell's default content, and owns all
 * drag/resize/collision interaction as controlled events -- it never mutates `layout` itself, nor
 * ever touches `localStorage`/network; the host applies (or ignores) every emitted event and owns
 * persistence entirely, mirroring `lr-flow-canvas`/`lr-table`'s own controlled-component
 * convention. Readonly (viewer) by default; opt into editor gestures individually via
 * `cells-draggable`/`cells-resizable`, or lock the whole grid via `locked`.
 *
 * Cell content: a `layout` entry with no matching light-DOM child (matched by `cell-id`) gets a
 * default `<lr-widget label="...">` wrapping a version-two `<lr-widget-renderer>` document
 * auto-created and adopted into `slot="cell-{id}"` -- this component's own job is the grid
 * layout/drag/resize/collision/persistence-event mechanics *around* that content, not widget
 * rendering itself (see `lr-widget-renderer`'s own doc for its declarative-tree contract). A
 * consumer wanting full control over one cell's markup can instead author
 * `<div cell-id="...">...</div>` as a direct child; it is adopted in place of the default cell.
 *
 * Keyboard: cells share one roving tabindex in row-major spatial order. Arrow
 * keys/Home/End move the roving focus (RTL-aware: physical Left/Right always match what the
 * cursor visually does, matching `lr-flow-canvas`'s own convention). While a cell has focus,
 * Ctrl/Cmd+Arrow moves it by one grid unit and Ctrl/Cmd+Shift+Arrow resizes it by one grid unit
 * (Right/Down grow, Left/Up shrink) -- the full keyboard-operable equivalent of the pointer
 * drag/resize gestures below, per this library's accessibility bar (no pointer-only interaction).
 *
 * Collision: every move/resize request -- pointer or keyboard -- is resolved through `collision`
 * (`'reject'` the default, `'push'`, or `'overlap'`; see `resolveLyraDashboardPlacement()` for
 * the exact rule). A rejected request leaves `layout` untouched and only announces; an accepted
 * one emits `lr-cell-move`/`lr-cell-resize` plus a `lr-layout-change` snapshot of the full
 * proposed layout (including any `'push'` cascade) -- the host's one persistence hook: listen for
 * it and persist `event.detail.layout` however it likes (`localStorage`, a network call, neither).
 *
 * Responsive: below a ~40rem container allocation (`@container`, not the viewport -- a dashboard
 * grid is commonly embedded in a panel of varying width), cells stack into a single flowing
 * column in the same row-major order the grid itself renders them in, instead of overflowing or
 * shrinking columns unreadably. A cell that currently owns a resize handle retains the shared
 * interactive-action block-size floor, so the absolute handle cannot overlap the preceding cell
 * or gap when consumer-authored content is shorter than the handle. Host, grid, cell, and slotted
 * custom-content boundaries all permit intrinsic shrinkage and inherit `overflow-wrap: anywhere`,
 * so an unbroken direct text run cannot widen the stack; a consumer-owned scrollport can still
 * opt into `overflow: auto`/`white-space: nowrap` and contains its own extent.
 *
 * @customElement lr-dashboard-grid
 * @slot cell-{id} - A `layout` entry's cell content; auto-populated by a default composed
 *   `<lr-widget>`/`<lr-widget-renderer>` pair unless a light-DOM `[cell-id="{id}"]` child is
 *   authored instead.
 * @event lr-cell-move - `detail: { id, position, previous }` — an accepted move committed.
 * @event lr-cell-resize - `detail: { id, size, previous }` — an accepted resize committed.
 * @event lr-collision - `detail: { id, collidedWith, policy, accepted }` — a move/resize request
 *   overlapped at least one other cell, regardless of whether `policy` ultimately accepted it.
 * @event lr-layout-change - `detail: { layout }` — the full proposed layout after any accepted
 *   move/resize (including a `'push'` cascade); the host's persistence hook.
 * @csspart base - The grid root.
 * @csspart empty - The `lr-empty` shown when `layout` is empty.
 * @csspart cell - A single cell's positioned wrapper.
 * @csspart resize-handle - The pointer resize grip in a cell's trailing/bottom corner (only
 *   rendered while `cells-resizable`); the Ctrl/Cmd+Shift+Arrow keyboard path is the resize
 *   handle's full accessible equivalent, so the handle itself is `aria-hidden`.
 * @csspart live-region - The `aria-hidden` mirror of the current move/resize/collision
 *   announcement; the spoken copy is appended to the shared light-DOM polite sink only while
 *   the grid and all of its composed ancestors remain exposed to the accessibility tree.
 * @cssprop [--lr-dashboard-grid-columns=12] - Author override for the column count; otherwise the
 *   normalized `columns` property supplies the computed value.
 * @cssprop [--lr-dashboard-grid-row-height=80px] - Author override for row track
 *   height; otherwise the normalized `rowHeight` property supplies a pixel value.
 * @cssprop [--lr-dashboard-grid-gap=8px] - Author override for the gap between cells;
 *   otherwise the normalized `gap` property supplies a pixel value.
 * @cssprop [--lr-dashboard-grid-cell-hover-outline-color=var(--lr-color-border-strong)] - Outline
 *   color of a cell's mouse-hover preview of its own `:focus-visible` ring (shown because every
 *   cell is a real focusable, draggable/resizable target). Set to `transparent` to opt out.
 * @cssprop [--lr-dashboard-grid-collision-outline-color=var(--lr-color-danger)] - Outline color
 *   of a cell whose current drag/resize preview collides with another cell.
 * @cssprop [--lr-dashboard-grid-interaction-shadow=var(--lr-shadow)] - Box shadow applied to a
 *   cell for the duration of its pointer drag or resize interaction.
 * @status stable
 * @since 4.1.0
 */
export class LyraDashboardGrid extends LyraElement<LyraDashboardGridEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    dashboardCellCollisionRejected: LYRA_DEFAULT_dashboardCellCollisionRejected,
    dashboardCellMoved: LYRA_DEFAULT_dashboardCellMoved,
    dashboardCellResized: LYRA_DEFAULT_dashboardCellResized,
    dashboardGridLabel: LYRA_DEFAULT_dashboardGridLabel,
    flowItemAnnouncement: LYRA_DEFAULT_flowItemAnnouncement,
    noData: LYRA_DEFAULT_noData,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];

  private authoredLayout: readonly DashboardAuthoredCellSnapshot[] =
    Object.freeze([]);
  private effectiveLayout: readonly LyraDashboardCell[] = Object.freeze([]);

  /** The grid's immutable, bounded cell snapshot. Assign a new readonly collection to update it;
   * every move/resize remains a request event that the host applies or ignores. Invalid records
   * are skipped and duplicate ids use the first valid occurrence. */
  @property({ attribute: false })
  get layout(): readonly LyraDashboardCell[] {
    return this.effectiveLayout;
  }
  set layout(value: readonly LyraDashboardCell[]) {
    const previous = this.effectiveLayout;
    this.authoredLayout = snapshotDashboardLayout(value);
    this.effectiveLayout = projectDashboardLayout(
      this.authoredLayout,
      this.safeColumns
    );
    this.requestUpdate("layout", previous);
  }
  /** Column count of the underlying CSS Grid. */
  @property({ type: Number }) columns = 12;
  /** Row track height, in px (also the pointer-resize/drag row snap pitch, together with `gap`). */
  @property({ type: Number, attribute: "row-height" }) rowHeight = 80;
  /** Gap between cells, in px, on both axes. */
  @property({ type: Number }) gap = 8;
  private collisionValue: LyraDashboardCollisionPolicy = "reject";
  /** How a move/resize that would overlap another cell is resolved. Foreign runtime values
   * normalize to the safe `reject` policy. */
  @property()
  get collision(): LyraDashboardCollisionPolicy {
    return this.collisionValue;
  }
  set collision(value: LyraDashboardCollisionPolicy) {
    const previous = this.collisionValue;
    this.collisionValue = normalizeLyraDashboardCollisionPolicy(value);
    this.requestUpdate("collision", previous);
  }
  /** Opts into pointer-drag + Ctrl/Cmd+Arrow keyboard move for unlocked cells. */
  @property({ type: Boolean, attribute: "cells-draggable" }) cellsDraggable =
    false;
  /** Opts into the pointer resize handle + Ctrl/Cmd+Shift+Arrow keyboard resize for unlocked cells. */
  @property({ type: Boolean, attribute: "cells-resizable" }) cellsResizable =
    false;
  /** Disables every drag/resize gesture grid-wide, regardless of `cells-draggable`/
   *  `cells-resizable` or a cell's own `locked`. */
  @property({ type: Boolean, reflect: true }) locked = false;
  /** Overrides the grid region's accessible name; falls back to a generic localized label. Fed
   *  only by a host `aria-label`, matching `lr-flow-canvas`'s own host-override pattern. */
  @property({ attribute: "aria-label" }) accessibleLabel: string | null = null;

  private get safeColumns(): number {
    return finiteInteger(this.columns, 12, 1, 48);
  }
  private get safeRowHeight(): number {
    return finiteRange(this.rowHeight, 80, 1);
  }
  private get safeGap(): number {
    return finiteRange(this.gap, 8, 0);
  }

  private get sortedLayout(): readonly LyraDashboardCell[] {
    return sortDashboardSpatial(this.effectiveLayout);
  }

  private announcementSink?: AnnouncementSink;
  private readonly announcer = new Announcer({
    onFlush: (text) => {
      this.liveText = text;
      if (isAccessibilityVisible(this)) {
        this.announcementSink?.announce(text);
      }
    },
  });
  @state() private liveText = "";
  @state() private activeCellIndex = 0;
  @state() private activeCellId = "";

  private cellDrag?: CellDragState;
  private cellResize?: CellResizeState;
  private rehomeCellFocus = false;
  private childObserver?: MutationObserver;
  private childObserverDocument?: Document;
  private defaultCellSyncQueued = false;
  private readonly ownedDefaultCells = new WeakSet<Element>();
  private readonly warnedUnmatchedCells = new WeakSet<Element>();
  private readonly authoredSlotBaselines = new WeakMap<
    Element,
    string | null
  >();
  private readonly managedAuthoredCells = new Set<Element>();
  private suppressedClickCellId = "";
  private suppressedClickTimer?: number;
  private suppressedClickWindow?: Window;

  override connectedCallback(): void {
    super.connectedCallback();
    this.bindOwnerRealmResources();
    this.scheduleDefaultCellSync();
  }

  override disconnectedCallback(): void {
    this.announcer.cancel();
    this.announcementSink?.release();
    this.announcementSink = undefined;
    this.childObserver?.disconnect();
    this.childObserver = undefined;
    this.childObserverDocument = undefined;
    this.defaultCellSyncQueued = false;
    this.restoreManagedAuthoredSlots();
    this.clearSuppressedClick();
    // An in-flight drag/resize gesture holds window-level listeners; if the element is removed
    // mid-gesture nothing else ever detaches them, and a later unrelated pointerup would fire
    // against a detached tree with stale gesture state.
    this.cancelCellDrag();
    this.cancelCellResize();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.childObserver?.disconnect();
    this.childObserver = undefined;
    this.childObserverDocument = undefined;
    this.announcementSink?.release();
    this.announcementSink = undefined;
    this.clearSuppressedClick();
    if (this.isConnected) {
      this.bindOwnerRealmResources();
      this.scheduleDefaultCellSync();
    }
  }

  private bindOwnerRealmResources(): void {
    const ownerDocument = this.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    if (ownerWindow) this.announcer.setTimerHost(ownerWindow);
    this.announcementSink ??= acquireAnnouncementSink("polite", {
      document: ownerDocument,
      source: this,
    });
    if (this.childObserver && this.childObserverDocument === ownerDocument) {
      return;
    }
    this.childObserver?.disconnect();
    this.childObserver = undefined;
    this.childObserverDocument = undefined;
    const MutationObserverCtor = ownerWindow?.MutationObserver;
    if (!MutationObserverCtor) return;
    const observer = new MutationObserverCtor((records) => {
      if (
        this.childObserver !== observer ||
        this.childObserverDocument !== ownerDocument
      ) {
        return;
      }
      const directlyRelevant = records.some((record) =>
        record.type === "childList"
          ? record.target === this
          : record.target.parentNode === this
      );
      if (!directlyRelevant) return;
      this.scheduleDefaultCellSync();
    });
    observer.observe(this, {
      childList: true,
      attributes: true,
      attributeFilter: ["cell-id"],
      subtree: true,
    });
    this.childObserver = observer;
    this.childObserverDocument = ownerDocument;
  }

  private scheduleDefaultCellSync(): void {
    if (!this.isConnected || this.defaultCellSyncQueued) return;
    this.defaultCellSyncQueued = true;
    queueMicrotask(() => {
      this.defaultCellSyncQueued = false;
      if (this.isConnected) this.syncDefaultCells();
    });
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // no-op today, but keeps any future LyraElement/mixin willUpdate logic wired in
    if (changed.has("columns")) {
      this.effectiveLayout = projectDashboardLayout(
        this.authoredLayout,
        this.safeColumns
      );
    }
    if (changed.has("layout") || changed.has("columns")) {
      this.rehomeCellFocus =
        activeElementIn(this.renderRoot as ShadowRoot)?.getAttribute("part") ===
        "cell";
      // Server rendering has neither an owner document nor observable light-DOM children. The
      // model-driven cell wrappers/slots remain complete without synthesizing default light-DOM
      // widgets; the browser creates those after upgrade, where their node ownership is real.
      if (this.ownerDocument && this.isConnected) {
        if (this.hasUpdated) this.syncDefaultCells();
        else this.seedFirstRenderState(() => this.syncDefaultCells());
      }
      const cells = this.sortedLayout;
      const retainedIndex = cells.findIndex(
        (cell) => cell.id === this.activeCellId
      );
      const nextIndex =
        cells.length === 0
          ? 0
          : retainedIndex >= 0
          ? retainedIndex
          : Math.min(this.activeCellIndex, cells.length - 1);
      this.activeCellIndex = nextIndex;
      this.activeCellId = cells[nextIndex]?.id ?? "";
    }
    if (
      this.cellDrag &&
      (changed.has("layout") ||
        changed.has("columns") ||
        changed.has("rowHeight") ||
        changed.has("gap") ||
        ((changed.has("cellsDraggable") || changed.has("locked")) &&
          !this.canDragCell(this.cellDrag.cellId)))
    ) {
      this.cancelCellDrag();
    }
    if (
      this.cellResize &&
      (changed.has("layout") ||
        changed.has("columns") ||
        changed.has("rowHeight") ||
        changed.has("gap") ||
        ((changed.has("cellsResizable") || changed.has("locked")) &&
          !this.canResizeCell(this.cellResize.cellId)))
    ) {
      this.cancelCellResize();
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (!this.rehomeCellFocus) return;
    this.rehomeCellFocus = false;
    this.renderRoot
      .querySelector<HTMLElement>('[part="cell"][tabindex="0"]')
      ?.focus();
  }

  // ---------------------------------------------------------------------
  // Default cell adoption (light-DOM, by cell-id -- mirrors lr-flow-canvas's node-id adoption)
  // ---------------------------------------------------------------------

  private cellLabel(cell: LyraDashboardCell): string {
    return cell.label || cell.id;
  }

  private restoreAuthoredSlot(child: Element): void {
    if (!this.authoredSlotBaselines.has(child)) return;
    const baseline = this.authoredSlotBaselines.get(child);
    if (baseline === null) child.removeAttribute("slot");
    else if (baseline !== undefined) child.setAttribute("slot", baseline);
    this.authoredSlotBaselines.delete(child);
    this.managedAuthoredCells.delete(child);
  }

  private restoreManagedAuthoredSlots(): void {
    for (const child of this.managedAuthoredCells) {
      this.restoreAuthoredSlot(child);
    }
    this.managedAuthoredCells.clear();
  }

  /** Reconciles direct light-DOM children by live `cell-id`. The first authored child owns a
   * cell; library defaults are tracked by identity rather than by a forgeable attribute. */
  private syncDefaultCells(): void {
    if (!this.isConnected) return;
    const ids = new Set(this.effectiveLayout.map((cell) => cell.id));
    const authoredById = new Map<string, Element>();
    const ownedById = new Map<string, Element[]>();

    for (const child of Array.from(this.children)) {
      const cellId = child.getAttribute("cell-id");
      if (this.ownedDefaultCells.has(child)) {
        if (!cellId) {
          child.remove();
          continue;
        }
        const matches = ownedById.get(cellId) ?? [];
        matches.push(child);
        ownedById.set(cellId, matches);
        continue;
      }

      if (cellId && ids.has(cellId) && !authoredById.has(cellId)) {
        authoredById.set(cellId, child);
        this.warnedUnmatchedCells.delete(child);
        if (!this.authoredSlotBaselines.has(child)) {
          this.authoredSlotBaselines.set(child, child.getAttribute("slot"));
        }
        this.managedAuthoredCells.add(child);
        child.setAttribute("slot", `cell-${cellId}`);
      } else {
        this.restoreAuthoredSlot(child);
        if (
          cellId &&
          !ids.has(cellId) &&
          !this.warnedUnmatchedCells.has(child)
        ) {
          this.warnedUnmatchedCells.add(child);
          // Keep unmatched authored content intact; without a corresponding named slot it remains
          // undisplayed, while its original slot value is available again on disconnect/retarget.
          console.warn(
            `<lr-dashboard-grid> a child with cell-id="${cellId}" matches no entry in \`layout\`; it will not render.`
          );
        }
      }
    }

    const selectedAuthored = new Set(authoredById.values());
    for (const managed of [...this.managedAuthoredCells]) {
      if (!this.contains(managed) || !selectedAuthored.has(managed)) {
        this.restoreAuthoredSlot(managed);
      }
    }

    for (const cell of this.effectiveLayout) {
      const owned = ownedById.get(cell.id) ?? [];
      if (authoredById.has(cell.id)) {
        for (const defaultCell of owned) defaultCell.remove();
        continue;
      }
      const existing = owned.shift();
      if (existing) {
        existing.setAttribute("slot", `cell-${cell.id}`);
        this.updateDefaultCell(existing as DefaultCellEl, cell);
      } else {
        this.appendChild(this.createDefaultCell(cell));
      }
      for (const duplicate of owned) duplicate.remove();
      ownedById.delete(cell.id);
    }

    for (const stale of ownedById.values()) {
      for (const defaultCell of stale) defaultCell.remove();
    }
  }

  private createDefaultCell(cell: LyraDashboardCell): Element {
    const ownerDocument = this.ownerDocument;
    const widget = ownerDocument.createElement(tag("widget")) as DefaultCellEl;
    widget.setAttribute("cell-id", cell.id);
    widget.setAttribute("data-dashboard-grid-default-cell", "");
    widget.setAttribute("slot", `cell-${cell.id}`);
    this.ownedDefaultCells.add(widget);
    const renderer = ownerDocument.createElement(tag("widget-renderer"));
    widget.appendChild(renderer);
    this.updateDefaultCell(widget, cell);
    return widget;
  }

  private updateDefaultCell(
    widget: DefaultCellEl,
    cell: LyraDashboardCell
  ): void {
    widget.label = this.cellLabel(cell);
    const renderer = widget.querySelector(
      tag("widget-renderer")
    ) as WidgetRendererEl | null;
    if (renderer) {
      renderer.document =
        cell.widget == null
          ? null
          : createWidgetDocument(cell.widget);
    }
  }

  // ---------------------------------------------------------------------
  // Roving focus / keyboard move & resize
  // ---------------------------------------------------------------------

  private onCellFocus(id: string): void {
    const index = this.sortedLayout.findIndex((c) => c.id === id);
    if (index >= 0) {
      if (this.activeCellIndex !== index) this.activeCellIndex = index;
      if (this.activeCellId !== id) this.activeCellId = id;
    }
  }

  private cellElement(cellId: string): HTMLElement | null {
    const ownerCss = this.ownerDocument.defaultView?.CSS;
    if (typeof ownerCss?.escape === "function") {
      try {
        const candidate = this.renderRoot.querySelector<HTMLElement>(
          `[part="cell"][data-cell-id="${ownerCss.escape(cellId)}"]`
        );
        if (candidate?.getAttribute("data-cell-id") === cellId)
          return candidate;
      } catch {
        // A partial DOM can expose CSS.escape while rejecting selector construction.
      }
    }
    return (
      Array.from(
        this.renderRoot.querySelectorAll<HTMLElement>(
          '[part="cell"][data-cell-id]'
        )
      ).find(
        (candidate) => candidate.getAttribute("data-cell-id") === cellId
      ) ?? null
    );
  }

  private focusCellAt(index: number): void {
    const cells = this.sortedLayout;
    if (index < 0 || index >= cells.length) return;
    this.activeCellIndex = index;
    const cell = cells[index]!; // safe: bounds checked above (0 <= index < cells.length)
    this.activeCellId = cell.id;
    const number = getNumberFormat(this.effectiveLocale);
    this.announcer.announce(
      this.localize("flowItemAnnouncement", undefined, {
        item: this.cellLabel(cell),
        index: number.format(index + 1),
        total: number.format(cells.length),
      })
    );
    void this.updateComplete.then(() => {
      this.cellElement(cell.id)?.focus();
    });
  }

  private onCellKeyDown(e: KeyboardEvent, cell: LyraDashboardCell): void {
    const owner = e.currentTarget as HTMLElement;
    if (e.composedPath()[0] !== owner) return;
    const isMod = e.ctrlKey || e.metaKey;
    if (isMod && isArrowKey(e.key)) {
      const handled = e.shiftKey
        ? this.keyboardResize(cell, e.key)
        : this.keyboardMove(cell, e.key);
      if (handled) e.preventDefault();
      return;
    }
    const cells = this.sortedLayout;
    const index = cells.findIndex((c) => c.id === cell.id);
    if (index < 0) return;
    const rtl = isRtl(this);
    const forwardKey = rtl ? "ArrowLeft" : "ArrowRight";
    const backwardKey = rtl ? "ArrowRight" : "ArrowLeft";
    let next = index;
    if (e.key === forwardKey || e.key === "ArrowDown")
      next = Math.min(cells.length - 1, index + 1);
    else if (e.key === backwardKey || e.key === "ArrowUp")
      next = Math.max(0, index - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = cells.length - 1;
    else return;
    if (next !== index) {
      e.preventDefault();
      this.focusCellAt(next);
    }
  }

  private keyboardMove(cell: LyraDashboardCell, key: string): boolean {
    if (!this.cellsDraggable || this.locked || cell.locked) return false;
    const rtlFlip = isRtl(this) ? -1 : 1;
    let dx = 0;
    let dy = 0;
    if (key === "ArrowRight") dx = rtlFlip;
    else if (key === "ArrowLeft") dx = -rtlFlip;
    else if (key === "ArrowDown") dy = 1;
    else if (key === "ArrowUp") dy = -1;
    else return false;
    return this.commitPlacement(
      cell.id,
      { x: cell.x + dx, y: cell.y + dy, w: cell.w, h: cell.h },
      "move"
    );
  }

  private keyboardResize(cell: LyraDashboardCell, key: string): boolean {
    if (!this.cellsResizable || this.locked || cell.locked) return false;
    let dw = 0;
    let dh = 0;
    if (key === "ArrowRight") dw = 1;
    else if (key === "ArrowLeft") dw = -1;
    else if (key === "ArrowDown") dh = 1;
    else if (key === "ArrowUp") dh = -1;
    else return false;
    return this.commitPlacement(
      cell.id,
      { x: cell.x, y: cell.y, w: cell.w + dw, h: cell.h + dh },
      "resize"
    );
  }

  // ---------------------------------------------------------------------
  // Shared commit path (keyboard nudge, and a pointer gesture's final drop)
  // ---------------------------------------------------------------------

  private commitPlacement(
    id: string,
    requested: { x: number; y: number; w: number; h: number },
    kind: "move" | "resize"
  ): boolean {
    const layout = this.effectiveLayout;
    const cell = layout.find((c) => c.id === id);
    if (!cell) return false;
    const result = resolveDashboardPlacement(
      layout,
      id,
      requested,
      this.safeColumns,
      this.collision
    );
    if (result.collidedWith.length > 0) {
      this.emit(
        "lr-collision",
        Object.freeze({
          id,
          collidedWith: result.collidedWith,
          policy: this.collision,
          accepted: result.accepted,
        })
      );
    }
    if (!result.accepted) {
      this.announcer.announce(
        this.localize("dashboardCellCollisionRejected", undefined, {
          label: this.cellLabel(cell),
        })
      );
      return true;
    }
    const updated = result.layout.find((c) => c.id === id)!;
    const number = getNumberFormat(this.effectiveLocale);
    // `requested` is clamped (bounds + this cell's own min/max) before ever reaching collision
    // resolution, so e.g. a shrink-past-minW request can come back byte-identical to `cell` --
    // that's a real no-op, not a move/resize, and must not emit a spurious event.
    const unchanged =
      kind === "move"
        ? updated.x === cell.x && updated.y === cell.y
        : updated.w === cell.w && updated.h === cell.h;
    if (unchanged) return false;
    if (kind === "move") {
      this.emit(
        "lr-cell-move",
        Object.freeze({
          id,
          position: Object.freeze({ x: updated.x, y: updated.y }),
          previous: Object.freeze({ x: cell.x, y: cell.y }),
        })
      );
      this.announcer.announce(
        this.localize("dashboardCellMoved", undefined, {
          label: this.cellLabel(cell),
          x: number.format(updated.x + 1),
          y: number.format(updated.y + 1),
        })
      );
    } else {
      this.emit(
        "lr-cell-resize",
        Object.freeze({
          id,
          size: Object.freeze({ w: updated.w, h: updated.h }),
          previous: Object.freeze({ w: cell.w, h: cell.h }),
        })
      );
      this.announcer.announce(
        this.localize("dashboardCellResized", undefined, {
          label: this.cellLabel(cell),
          w: number.format(updated.w),
          h: number.format(updated.h),
        })
      );
    }
    this.emit("lr-layout-change", Object.freeze({ layout: result.layout }));
    return true;
  }

  // ---------------------------------------------------------------------
  // Pointer drag (move)
  // ---------------------------------------------------------------------

  private cellStyle(cell: LyraDashboardCell): {
    "grid-column": string;
    "grid-row": string;
  } {
    return {
      "grid-column": `${cell.x + 1} / span ${cell.w}`,
      "grid-row": `${cell.y + 1} / span ${cell.h}`,
    };
  }

  /** Column/row pixel pitch, measured once per gesture (not re-measured on every pointermove --
   *  matches `lr-flow-canvas`'s own once-per-gesture rect-measurement convention). */
  private measurePitch(): { colPitch: number; rowPitch: number } | null {
    const baseEl = this.renderRoot.querySelector(
      '[part="base"]'
    ) as HTMLElement | null;
    if (!baseEl) return null;
    const rect = baseEl.getBoundingClientRect();
    const columns = this.safeColumns;
    const gap = this.safeGap;
    const rawColPitch = (rect.width - gap * (columns - 1)) / columns;
    return {
      colPitch: rawColPitch > 0 ? rawColPitch : 1,
      rowPitch: this.safeRowHeight + gap,
    };
  }

  private resetCellInlineStyle(id: string, wrapper: HTMLElement): void {
    wrapper.removeAttribute("data-collision");
    const cell = this.effectiveLayout.find((candidate) => candidate.id === id);
    if (cell) {
      const style = this.cellStyle(cell);
      wrapper.style.gridColumn = style["grid-column"];
      wrapper.style.gridRow = style["grid-row"];
    }
  }

  private canDragCell(id: string): boolean {
    const cell = this.layout.find((candidate) => candidate.id === id);
    return (
      this.cellsDraggable && !this.locked && cell !== undefined && !cell.locked
    );
  }

  private canResizeCell(id: string): boolean {
    const cell = this.layout.find((candidate) => candidate.id === id);
    return (
      this.cellsResizable && !this.locked && cell !== undefined && !cell.locked
    );
  }

  /** Capability revocation can end a gesture before the native pointerup/pointercancel that would
   *  normally release capture. Ignore the browser's NotFoundError when a synthetic event, a
   *  disconnect, or an implicit native release already ended capture. */
  private releaseGesturePointerCapture(
    target: HTMLElement,
    pointerId: number
  ): void {
    try {
      target.releasePointerCapture?.(pointerId);
    } catch {
      // Capture is already gone.
    }
  }

  private cancelCellDrag(): void {
    const drag = this.cellDrag;
    if (!drag) return;
    this.cellDrag = undefined;
    if (drag.previewFrame !== undefined) {
      drag.ownerWindow.cancelAnimationFrame(drag.previewFrame);
    }
    this.releaseGesturePointerCapture(drag.wrapper, drag.pointerId);
    drag.wrapper.removeAttribute("data-dragging");
    this.resetCellInlineStyle(drag.cellId, drag.wrapper);
    drag.ownerWindow.removeEventListener("pointermove", this.onCellPointerMove);
    drag.ownerWindow.removeEventListener("pointerup", this.onCellPointerUp);
    drag.ownerWindow.removeEventListener("pointercancel", this.onCellPointerUp);
    drag.ownerWindow.removeEventListener(
      "lostpointercapture",
      this.onCellPointerUp
    );
  }

  private cancelCellResize(): void {
    const resize = this.cellResize;
    if (!resize) return;
    this.cellResize = undefined;
    if (resize.previewFrame !== undefined) {
      resize.ownerWindow.cancelAnimationFrame(resize.previewFrame);
    }
    this.releaseGesturePointerCapture(resize.captureTarget, resize.pointerId);
    resize.wrapper.removeAttribute("data-resizing");
    this.resetCellInlineStyle(resize.cellId, resize.wrapper);
    resize.ownerWindow.removeEventListener(
      "pointermove",
      this.onResizeHandlePointerMove
    );
    resize.ownerWindow.removeEventListener(
      "pointerup",
      this.onResizeHandlePointerUp
    );
    resize.ownerWindow.removeEventListener(
      "pointercancel",
      this.onResizeHandlePointerUp
    );
    resize.ownerWindow.removeEventListener(
      "lostpointercapture",
      this.onResizeHandlePointerUp
    );
  }

  /** Whether the pointer landed on an interactive control inside `wrapper` rather than on the
   *  cell's own drag surface. */
  private hasInteractiveTarget(e: PointerEvent, wrapper: HTMLElement): boolean {
    const path = e.composedPath();
    const stop = path.indexOf(wrapper);
    for (const node of stop < 0 ? path : path.slice(0, stop)) {
      const element = node as Element;
      if (
        typeof element.matches === "function" &&
        node !== wrapper &&
        element.matches(INTERACTIVE_DESCENDANT_SELECTOR)
      )
        return true;
    }
    return false;
  }

  private onCellPointerDown(e: PointerEvent, cell: LyraDashboardCell): void {
    if (
      !this.cellsDraggable ||
      this.locked ||
      cell.locked ||
      this.cellDrag ||
      !e.isPrimary ||
      e.button !== 0
    )
      return;
    const wrapper = e.currentTarget as HTMLElement;
    // Walk the *composed* path, not `closest()` + `contains()`: cell content is slotted light DOM
    // while `wrapper` lives in this shadow root, so `wrapper.contains(slottedControl)` is always
    // false (`contains()` walks the node tree, not the flat tree) and the guard never fired.
    // `composedPath()` crosses both the slot and any nested shadow root, and truncating it at
    // `wrapper` bounds the search to what is actually inside this cell.
    if (this.hasInteractiveTarget(e, wrapper)) return;
    const ownerWindow = wrapper.ownerDocument.defaultView;
    if (!ownerWindow) return;
    const pitch = this.measurePitch();
    if (!pitch) return;
    const layout = this.effectiveLayout;
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
      ownerWindow,
      rtlFlip: isRtl(this) ? -1 : 1,
      layout,
      spatialIndex: createDashboardSpatialIndex(layout, this.safeColumns),
    };
    wrapper.setPointerCapture?.(e.pointerId);
    wrapper.setAttribute("data-dragging", "");
    ownerWindow.addEventListener("pointermove", this.onCellPointerMove);
    ownerWindow.addEventListener("pointerup", this.onCellPointerUp);
    ownerWindow.addEventListener("pointercancel", this.onCellPointerUp);
    ownerWindow.addEventListener("lostpointercapture", this.onCellPointerUp);
  }

  private onCellPointerMove = (e: PointerEvent): void => {
    const drag = this.cellDrag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!this.canDragCell(drag.cellId)) {
      this.cancelCellDrag();
      return;
    }
    drag.pendingClientX = e.clientX;
    drag.pendingClientY = e.clientY;
    if (drag.previewFrame !== undefined) return;
    drag.previewFrame = drag.ownerWindow.requestAnimationFrame(() => {
      drag.previewFrame = undefined;
      if (this.cellDrag === drag) this.applyDragPreview(drag);
    });
  };

  private applyDragPreview(drag: CellDragState): void {
    if (
      drag.pendingClientX === undefined ||
      drag.pendingClientY === undefined
    ) {
      return;
    }
    const clientX = drag.pendingClientX;
    const clientY = drag.pendingClientY;
    drag.pendingClientX = undefined;
    drag.pendingClientY = undefined;
    const dxUnits = Math.round(
      ((clientX - drag.startClientX) * drag.rtlFlip) / drag.colPitch
    );
    const dyUnits = Math.round((clientY - drag.startClientY) / drag.rowPitch);
    const { x, y } = clampDashboardCandidate(
      {},
      {
        x: drag.startX + dxUnits,
        y: drag.startY + dyUnits,
        w: drag.w,
        h: drag.h,
      },
      drag.spatialIndex.columns
    );
    drag.wrapper.style.gridColumn = `${x + 1} / span ${drag.w}`;
    drag.wrapper.style.gridRow = `${y + 1} / span ${drag.h}`;
    if (this.collision !== "overlap") {
      const collides =
        findDashboardCollisions(drag.spatialIndex, {
          id: drag.cellId,
          x,
          y,
          w: drag.w,
          h: drag.h,
        }).length > 0;
      drag.wrapper.toggleAttribute("data-collision", collides);
    } else {
      drag.wrapper.removeAttribute("data-collision");
    }
    drag.currentX = x;
    drag.currentY = y;
    if (x !== drag.startX || y !== drag.startY) drag.moved = true;
  }

  private flushDragPreview(drag: CellDragState): void {
    if (drag.previewFrame !== undefined) {
      drag.ownerWindow.cancelAnimationFrame(drag.previewFrame);
      drag.previewFrame = undefined;
    }
    this.applyDragPreview(drag);
  }

  private onCellPointerUp = (e: PointerEvent): void => {
    const drag = this.cellDrag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (e.type !== "pointerup" || !this.canDragCell(drag.cellId)) {
      this.cancelCellDrag();
      return;
    }
    this.flushDragPreview(drag);
    this.cellDrag = undefined;
    this.releaseGesturePointerCapture(drag.wrapper, drag.pointerId);
    drag.wrapper.removeAttribute("data-dragging");
    drag.ownerWindow.removeEventListener("pointermove", this.onCellPointerMove);
    drag.ownerWindow.removeEventListener("pointerup", this.onCellPointerUp);
    drag.ownerWindow.removeEventListener("pointercancel", this.onCellPointerUp);
    drag.ownerWindow.removeEventListener(
      "lostpointercapture",
      this.onCellPointerUp
    );
    const x = drag.currentX ?? drag.startX;
    const y = drag.currentY ?? drag.startY;
    if (x !== drag.startX || y !== drag.startY) {
      this.commitPlacement(drag.cellId, { x, y, w: drag.w, h: drag.h }, "move");
    }
    if (drag.moved) this.armClickSuppression(drag.cellId, drag.ownerWindow);
    this.resetCellInlineStyle(drag.cellId, drag.wrapper);
    this.requestUpdate();
  };

  // ---------------------------------------------------------------------
  // Pointer resize
  // ---------------------------------------------------------------------

  private onResizeHandlePointerDown(
    e: PointerEvent,
    cell: LyraDashboardCell
  ): void {
    if (
      !this.cellsResizable ||
      this.locked ||
      cell.locked ||
      this.cellResize ||
      !e.isPrimary ||
      e.button !== 0
    )
      return;
    const wrapper = (e.currentTarget as HTMLElement).closest(
      '[part="cell"]'
    ) as HTMLElement | null;
    if (!wrapper) return;
    const ownerWindow = wrapper.ownerDocument.defaultView;
    if (!ownerWindow) return;
    const pitch = this.measurePitch();
    if (!pitch) return;
    const layout = this.effectiveLayout;
    e.stopPropagation();
    const captureTarget = e.currentTarget as HTMLElement;
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
      captureTarget,
      ownerWindow,
      rtlFlip: isRtl(this) ? -1 : 1,
      layout,
      spatialIndex: createDashboardSpatialIndex(layout, this.safeColumns),
    };
    captureTarget.setPointerCapture?.(e.pointerId);
    wrapper.setAttribute("data-resizing", "");
    ownerWindow.addEventListener("pointermove", this.onResizeHandlePointerMove);
    ownerWindow.addEventListener("pointerup", this.onResizeHandlePointerUp);
    ownerWindow.addEventListener("pointercancel", this.onResizeHandlePointerUp);
    ownerWindow.addEventListener(
      "lostpointercapture",
      this.onResizeHandlePointerUp
    );
  }

  private onResizeHandlePointerMove = (e: PointerEvent): void => {
    const resize = this.cellResize;
    if (!resize || e.pointerId !== resize.pointerId) return;
    if (!this.canResizeCell(resize.cellId)) {
      this.cancelCellResize();
      return;
    }
    resize.pendingClientX = e.clientX;
    resize.pendingClientY = e.clientY;
    if (resize.previewFrame !== undefined) return;
    resize.previewFrame = resize.ownerWindow.requestAnimationFrame(() => {
      resize.previewFrame = undefined;
      if (this.cellResize === resize) this.applyResizePreview(resize);
    });
  };

  private applyResizePreview(resize: CellResizeState): void {
    if (
      resize.pendingClientX === undefined ||
      resize.pendingClientY === undefined
    ) {
      return;
    }
    const clientX = resize.pendingClientX;
    const clientY = resize.pendingClientY;
    resize.pendingClientX = undefined;
    resize.pendingClientY = undefined;
    const dwUnits = Math.round(
      ((clientX - resize.startClientX) * resize.rtlFlip) / resize.colPitch
    );
    const dhUnits = Math.round(
      (clientY - resize.startClientY) / resize.rowPitch
    );
    const { w, h } = clampDashboardCandidate(
      resize.spatialIndex.byId.get(resize.cellId) ?? {},
      {
        x: resize.x,
        y: resize.y,
        w: resize.startW + dwUnits,
        h: resize.startH + dhUnits,
      },
      resize.spatialIndex.columns
    );
    resize.wrapper.style.gridColumn = `${resize.x + 1} / span ${w}`;
    resize.wrapper.style.gridRow = `${resize.y + 1} / span ${h}`;
    if (this.collision !== "overlap") {
      const collides =
        findDashboardCollisions(resize.spatialIndex, {
          id: resize.cellId,
          x: resize.x,
          y: resize.y,
          w,
          h,
        }).length > 0;
      resize.wrapper.toggleAttribute("data-collision", collides);
    } else {
      resize.wrapper.removeAttribute("data-collision");
    }
    resize.currentW = w;
    resize.currentH = h;
    if (w !== resize.startW || h !== resize.startH) resize.moved = true;
  }

  private flushResizePreview(resize: CellResizeState): void {
    if (resize.previewFrame !== undefined) {
      resize.ownerWindow.cancelAnimationFrame(resize.previewFrame);
      resize.previewFrame = undefined;
    }
    this.applyResizePreview(resize);
  }

  private onResizeHandlePointerUp = (e: PointerEvent): void => {
    const resize = this.cellResize;
    if (!resize || e.pointerId !== resize.pointerId) return;
    if (e.type !== "pointerup" || !this.canResizeCell(resize.cellId)) {
      this.cancelCellResize();
      return;
    }
    this.flushResizePreview(resize);
    this.cellResize = undefined;
    this.releaseGesturePointerCapture(resize.captureTarget, resize.pointerId);
    resize.wrapper.removeAttribute("data-resizing");
    resize.ownerWindow.removeEventListener(
      "pointermove",
      this.onResizeHandlePointerMove
    );
    resize.ownerWindow.removeEventListener(
      "pointerup",
      this.onResizeHandlePointerUp
    );
    resize.ownerWindow.removeEventListener(
      "pointercancel",
      this.onResizeHandlePointerUp
    );
    resize.ownerWindow.removeEventListener(
      "lostpointercapture",
      this.onResizeHandlePointerUp
    );
    const w = resize.currentW ?? resize.startW;
    const h = resize.currentH ?? resize.startH;
    if (w !== resize.startW || h !== resize.startH) {
      this.commitPlacement(
        resize.cellId,
        { x: resize.x, y: resize.y, w, h },
        "resize"
      );
    }
    if (resize.moved) {
      this.armClickSuppression(resize.cellId, resize.ownerWindow);
    }
    this.resetCellInlineStyle(resize.cellId, resize.wrapper);
    this.requestUpdate();
  };

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  private clearSuppressedClick(): void {
    if (this.suppressedClickTimer !== undefined && this.suppressedClickWindow) {
      this.suppressedClickWindow.clearTimeout(this.suppressedClickTimer);
    }
    this.suppressedClickTimer = undefined;
    this.suppressedClickWindow = undefined;
    this.suppressedClickCellId = "";
  }

  private armClickSuppression(cellId: string, ownerWindow: Window): void {
    this.clearSuppressedClick();
    this.suppressedClickCellId = cellId;
    this.suppressedClickWindow = ownerWindow;
    this.suppressedClickTimer = ownerWindow.setTimeout(() => {
      this.suppressedClickTimer = undefined;
      this.suppressedClickWindow = undefined;
      this.suppressedClickCellId = "";
    }, 0);
  }

  private onCellClick(e: MouseEvent, cellId: string): void {
    if (this.suppressedClickCellId !== cellId) return;
    this.clearSuppressedClick();
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  private renderCell(cell: LyraDashboardCell, active: boolean): TemplateResult {
    const resizableHere = this.cellsResizable && !this.locked && !cell.locked;
    return html`<div
      part="cell"
      role="group"
      tabindex=${active ? "0" : "-1"}
      aria-label=${this.cellLabel(cell)}
      data-cell-id=${cell.id}
      ?data-resizable=${resizableHere}
      style=${styleMap(this.cellStyle(cell))}
      @keydown=${(e: KeyboardEvent) => this.onCellKeyDown(e, cell)}
      @focus=${() => this.onCellFocus(cell.id)}
      @pointerdown=${(e: PointerEvent) => this.onCellPointerDown(e, cell)}
      @click=${(e: MouseEvent) => this.onCellClick(e, cell.id)}
    >
      <slot name=${`cell-${cell.id}`}></slot>
      ${resizableHere
        ? html`<button
            part="resize-handle"
            type="button"
            tabindex="-1"
            aria-hidden="true"
            @pointerdown=${(e: PointerEvent) =>
              this.onResizeHandlePointerDown(e, cell)}
          ></button>`
        : nothing}
    </div>`;
  }

  override render(): TemplateResult {
    const cells = this.sortedLayout;
    const label = this.accessibleLabel ?? this.localize("dashboardGridLabel");
    if (cells.length === 0) {
      return html`<div part="base" role="region" aria-label=${label}>
        <lr-empty part="empty" heading=${this.localize("noData")}></lr-empty>
      </div>`;
    }
    const retainedIndex = cells.findIndex(
      (cell) => cell.id === this.activeCellId
    );
    const activeIndex =
      retainedIndex >= 0
        ? retainedIndex
        : Math.min(this.activeCellIndex, cells.length - 1);
    return html`<div
      part="base"
      role="region"
      aria-label=${label}
      style=${styleMap({
        "--_lr-dashboard-grid-computed-columns": String(this.safeColumns),
        "--_lr-dashboard-grid-computed-row-height": `${this.safeRowHeight}px`,
        "--_lr-dashboard-grid-computed-gap": `${this.safeGap}px`,
      })}
    >
      ${repeat(
        cells,
        (cell) => cell.id,
        (cell, i) => this.renderCell(cell, i === activeIndex)
      )}
      <div part="live-region" class="sr-only" aria-hidden="true">
        ${this.liveText}
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lr-dashboard-grid": LyraDashboardGrid;
  }
}

import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { prefersReducedMotion } from '../../internal/motion.js';
import { styles } from './virtual-list.styles.js';

/** Fallback per-row height (px) used for any row that hasn't been measured
 *  yet in `row-height="auto"` mode -- close enough to a typical single-line
 *  chat-list row that the initial scrollbar/spacer size doesn't jump wildly
 *  once real measurements arrive. Irrelevant in fixed-`row-height` mode. */
const DEFAULT_ROW_ESTIMATE_PX = 48;
const DEFAULT_OVERSCAN_ROWS = 6;
/** Largest accepted overscan on either side of the visible range. This keeps
 *  an accidental huge value from defeating virtualization. */
export const MAX_OVERSCAN_ROWS = 100;

function normalizeOverscan(value: string | number | null): number {
  if (value === null) return DEFAULT_OVERSCAN_ROWS;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_OVERSCAN_ROWS;
  return Math.min(MAX_OVERSCAN_ROWS, Math.max(0, Math.floor(numeric)));
}

const overscanConverter = {
  fromAttribute(value: string | null): number {
    return normalizeOverscan(value);
  },
};

/** `lyra-visible-range-changed` detail -- the current visible (non-overscanned) item index range. */
export interface VirtualListRange {
  start: number;
  end: number;
}

/** A visible group label anchored to the first row in its group. */
export interface VirtualListGroup {
  key: string | number;
  label?: string;
  startIndex: number;
}

type VirtualListKey = string | number;

/** A typed key is used in maps and active-row matching; this token is only for
 * DOM attributes, where every value is necessarily a string. */
function domKeyToken(key: VirtualListKey): string {
  if (typeof key === 'number') {
    if (Number.isNaN(key)) return 'number:NaN';
    if (Object.is(key, -0)) return 'number:-0';
  }
  return `${typeof key}:${String(key)}`;
}

export interface LyraVirtualListEventMap {
  'lyra-visible-range-changed': CustomEvent<VirtualListRange>;
  'lyra-load-more': CustomEvent<undefined>;
}
/**
 * `<lyra-virtual-list>` — a generic windowed/virtualized list host. Renders
 * only the items within the current viewport (plus `overscan` padding rows
 * on each side) as real DOM, regardless of how large `items` is, so a
 * multi-thousand-row chat history sidebar or long message thread stays cheap
 * to scroll.
 *
 * Content is entirely caller-supplied: `renderItem(item, index)` returns
 * whatever `lit-html` value should represent that row (typically a
 * `TemplateResult`), and `keyFunction(item, index)` gives it a stable
 * identity for `repeat()`'s DOM-reconciliation key, so scroll position and
 * any per-row state (e.g. an `<audio>` element's playback position) survive
 * an `items` mutation instead of every row remounting from scratch.
 *
 * **Windowing math.** Every row — in both `row-height` modes — is positioned
 * by a `transform: translateY(offset)` computed from a single cumulative
 * `offsets` array (`offsets[i]` = the pixel top of row `i`), rather than by
 * page flow. This is what lets only a small DOM window exist while the
 * scrollbar still reflects the *true* total content height:
 * - **`row-height="auto"` (default).** Each currently-rendered row is
 *   watched by a `ResizeObserver`; its real height lands in a per-key
 *   `Map`, and any row not yet measured contributes `DEFAULT_ROW_ESTIMATE_PX`
 *   to the offsets array until it has been. `offsets` is *not* the same
 *   thing as a page-count-based `padding-top`/`padding-bottom` spacer pair —
 *   that approach reflows every unmeasured row's position on every new
 *   measurement, which is exactly what per-row transform offsets avoid: only
 *   the rows *after* a newly-measured one shift, and even that shift is a
 *   cheap style recompute, not a layout-affecting padding change.
 * - **Fixed numeric `row-height`.** No measurement needed — `offsets[i]` is
 *   just `i * rowHeightPx`, computed by the exact same cumulative-array code
 *   path (a dedicated "single spacer + start-index" special case was
 *   considered and would work too, but reusing one code path for both modes
 *   avoids maintaining two parallel rendering strategies for a difference
 *   that's otherwise just "how is row *i*'s height looked up").
 *
 * The `offsets` array is rebuilt only when `items`, `row-height`, or
 * `keyFunction` change, or a row's measured height changes -- not on every
 * update, so a pure scroll-position tick (potentially every rAF while
 * scrolling) only re-runs the cheap range/visibility math in
 * `computeRange()`, never the `O(n)` offsets rebuild (which, in
 * `row-height="auto"` mode, also means a `keyFunction` call per item). For
 * the list sizes this component is meant for (a scrollable history sidebar,
 * realistically hundreds to a few thousand rows) that rebuild is a trivial
 * `O(n)` arithmetic loop even when it does run; it is *not* the right
 * approach for a hundred-thousand-row list without further work (e.g. a
 * Fenwick/segment tree for `O(log n)` offset queries+updates), which is out
 * of scope here.
 *
 * **Accessibility.** The scroll container is `role="list"` and each rendered
 * row is `role="listitem"`, deliberately *not* `listbox`/`option` — this
 * component only provides windowing, not the roving-tabindex/
 * `aria-activedescendant` keyboard-interaction contract ARIA requires
 * alongside a real `listbox`. A consumer that wants full single-select
 * listbox semantics on top of this should compose that behavior itself (see
 * `<lyra-select>`'s pattern), the same way this component's `active-id`
 * only *scrolls* the matching row into view and marks it `aria-current` —
 * it never claims to be a selection widget. `aria-setsize`/`aria-posinset`
 * are computed from the row's real index in the full `items` array (not its
 * position among the currently-rendered DOM window), so a screen reader
 * still announces e.g. "item 12 of 340" correctly. `[part="base"]` itself
 * carries `tabindex="0"` — `renderItem`'s content is caller-supplied and not
 * guaranteed to contain a focusable element, and a scrollable region with no
 * focusable content of its own is otherwise unreachable by keyboard (native
 * arrow/Page Up/Page Down scrolling included).
 *
 * **Grouping.** When supplied, `groups` renders a labeled group marker at the
 * corresponding `startIndex`. Group markers are positioned independently of
 * the row window, so they remain available when the first row in a group is
 * outside the current overscanned range.
 *
 * **Programmatic scrolling.** `scrollToIndex()` is the public counterpart to `active-id`'s automatic
 * scroll-into-view -- used by `<lyra-chat-viewport>`'s virtual mode and any other host that needs to
 * scroll to a specific row without also changing which row is "active."
 *
 * @customElement lyra-virtual-list
 * @event lyra-load-more - Fired once per approach to the bottom of the list
 *   while `has-more` is true and `loading` is false. Deliberately does not
 *   refire on every scroll tick while still near the bottom (`loading`
 *   gates the in-flight case; scrolling back away from the bottom and
 *   returning, or `items` growing enough to move the window away from the
 *   end, re-arms it) — a consumer wanting an automatic retry after a failed
 *   fetch should surface its own retry affordance rather than relying on
 *   this firing again unprompted.
 * @event lyra-visible-range-changed - `detail: { start, end }` (see
 *   `VirtualListRange`) — the current visible (non-overscanned) item index
 *   range, fired only when it actually changes.
 * @csspart base - The scrollable container (`role="list"`).
 * @csspart spacer - The full-content-height inner element that gives the
 *   container its true scrollable extent.
 * @csspart group - A positioned group label.
 * @csspart row - One rendered row's absolutely-positioned wrapper
 *   (`role="listitem"`); `renderItem`'s return value renders inside it.
 */
export class LyraVirtualList extends LyraElement<LyraVirtualListEventMap> {
  static styles = [LyraElement.styles, styles];

  /** The full (non-windowed) item collection. */
  @property({ attribute: false }) items: unknown[] = [];

  /** Renders one row's content — typically returns a `lit-html` `TemplateResult`. */
  @property({ attribute: false }) renderItem: (item: unknown, index: number) => unknown = () => nothing;

  /** Derives a row's stable `repeat()` key. Falls back to the item's index
   *  in `items` when omitted, which is only a safe identity while `items`
   *  never reorders/inserts/removes — provide this whenever it can, or
   *  scroll position and any per-row DOM state can attach to the wrong row
   *  across a mutation (same caveat as `<lyra-table>`'s `rowKey`). */
  @property({ attribute: false }) keyFunction?: (item: unknown, index: number) => string | number;

  /** Group labels positioned at their first row's `startIndex`. Invalid or
   * duplicate indexes are ignored during rendering. */
  @property({ attribute: false }) groups?: VirtualListGroup[];

  /** `'auto'` (default) measures each row's real height via `ResizeObserver`;
   *  a numeric string fixes every row to that many pixels. */
  @property({ attribute: 'row-height' }) rowHeight = 'auto';

  /** Extra rows rendered beyond the visible viewport on each side, to reduce
   *  blank-frame risk during fast scrolling. Normalized to a whole number in
   *  the inclusive range 0–`MAX_OVERSCAN_ROWS`; non-finite values use the
   *  default. */
  @property({ converter: overscanConverter }) overscan = DEFAULT_OVERSCAN_ROWS;

  /** When set and it matches a row's typed `keyFunction` result, that row is
   * smoothly scrolled into view whenever this changes. Attribute values are
   * strings; assign the property for a numeric key. */
  @property({ attribute: 'active-id' }) activeId: VirtualListKey | '' = '';

  @property({ type: Boolean, reflect: true }) loading = false;

  /** When true, scrolling near the bottom fires `lyra-load-more`. */
  @property({ type: Boolean, attribute: 'has-more', reflect: true }) hasMore = false;

  // Named distinctly from the inherited DOM `scrollTop` (a `HTMLElement`
  // property this class would otherwise shadow) -- this tracks the *scroll
  // container's* scrollTop, not the host element's own (the host never
  // scrolls itself; [part="base"] does).
  @state() private containerScrollTop = 0;
  @state() private viewportHeight = 0;

  /** `offsets[i]` = row `i`'s pixel top; `offsets[items.length]` = total content height. Rebuilt only when `offsetsDirty` is set -- see `willUpdate()`. */
  private offsets: number[] = [0];
  /** Parsed `rowHeight`: a positive pixel number, or `null` for `'auto'` (measured) mode. */
  private fixedRowHeight: number | null = null;
  /** `row-height="auto"` per-row measured heights, keyed by
   *  keyFunction result. Pruned to the current `items`'
   *  live keys whenever `items` changes (see `recomputeOffsets()`), so a
   *  long-lived instance handed many wholly different `items` arrays over
   *  its life doesn't grow this map without bound. */
  private readonly measuredHeights = new Map<VirtualListKey, number>();
  /** True whenever `offsets` needs rebuilding before the next render --
   *  set initially and whenever `items`/`rowHeight`/`keyFunction` change or
   *  a row's measured height changes, but *not* on a pure scroll-position
   *  update, so the `O(n)` rebuild (including a `keyFunction` call per item
   *  in `row-height="auto"` mode) only runs when something that actually
   *  affects row heights or ordering changed. */
  private offsetsDirty = true;
  /** Set alongside `offsetsDirty` specifically when `items` changed (not
   *  just `rowHeight`/`keyFunction`/a measurement) -- consumed by the next
   *  `recomputeOffsets()` call to prune `measuredHeights` entries for keys
   *  no longer present in `items`. */
  private itemsChangedPendingPrune = false;

  private renderStart = 0;
  private renderEnd = -1;
  private visibleStart = 0;
  private visibleEnd = -1;
  private lastEmittedStart = -1;
  private lastEmittedEnd = -1;
  /** Re-armed whenever the window moves away from the end of `items` -- see the `lyra-load-more` event doc. */
  private loadMoreArmed = true;
  /** Set by `scrollToIndex()` in `row-height="auto"` mode when the target row hasn't been measured
   *  yet -- its offset is still estimate-based, so the scroll can land short of (or past) the real
   *  target. Consumed (and cleared) by `maybeCorrectPendingScroll()` the first time that row's real
   *  height arrives, issuing exactly one corrective re-scroll -- never more than one, so a
   *  still-settling row can't cause repeated scroll jumps. */
  private pendingScrollCorrection?: {
    key: VirtualListKey;
    align: 'start' | 'end' | 'auto';
    behavior: 'auto' | 'smooth';
  };
  private isFirstUpdate = true;

  private rowResizeObserver?: ResizeObserver;
  private containerResizeObserver?: ResizeObserver;
  private readonly observedRows = new Map<VirtualListKey, HTMLElement>();
  private readonly observedRowKeys = new WeakMap<HTMLElement, VirtualListKey>();
  private readonly observedRowIndices = new WeakMap<HTMLElement, number>();
  private scrollRafId?: number;
  private pendingScrollTop: number | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.rowResizeObserver = new ResizeObserver(this.onRowsResized);
    // firstUpdated() only ever fires once per element instance -- a
    // disconnect/reconnect (e.g. a reparenting drag) needs its own
    // re-attach here, since the container observer/scroll listener were
    // torn down in disconnectedCallback below. syncRowObservers() is called
    // directly here (rather than left for the next Lit render) because a
    // reconnect that doesn't also change some other reactive property never
    // triggers one, which would otherwise leave every already-rendered row
    // permanently unwatched by the freshly created ResizeObserver above.
    if (this.hasUpdated) {
      this.attachContainerListeners();
      this.syncRowObservers();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.rowResizeObserver?.disconnect();
    this.rowResizeObserver = undefined;
    this.observedRows.clear();
    this.containerResizeObserver?.disconnect();
    this.containerResizeObserver = undefined;
    if (this.scrollRafId !== undefined) {
      cancelAnimationFrame(this.scrollRafId);
      this.scrollRafId = undefined;
    }
    this.pendingScrollCorrection = undefined;
    this.renderRoot.querySelector('[part="base"]')?.removeEventListener('scroll', this.onScroll);
  }

  firstUpdated(): void {
    this.attachContainerListeners();
  }

  protected willUpdate(changed: PropertyValues): void {
    this.isFirstUpdate = !this.hasUpdated;
    if (changed.has('items') || changed.has('rowHeight') || changed.has('keyFunction')) {
      this.offsetsDirty = true;
    }
    if (changed.has('items')) {
      this.itemsChangedPendingPrune = true;
    }
    if (changed.has('rowHeight')) {
      this.fixedRowHeight = this.parseRowHeight(this.rowHeight);
    }
    if (this.offsetsDirty) {
      this.recomputeOffsets();
      this.offsetsDirty = false;
    }
    // Always cheap: just arithmetic over the already-current offsets +
    // scroll/viewport state, so this runs on a pure scroll-driven update too.
    this.computeRange();
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    this.syncRowObservers();
    if (changed.has('activeId') && !this.isFirstUpdate) this.scrollActiveIntoView();
    this.emitRangeChangeIfNeeded();
    this.maybeFireLoadMore();
    this.maybeCorrectPendingScroll();
  }

  private parseRowHeight(value: string): number | null {
    if (value === 'auto') return null;
    const n = Number(value);
    // Anything that isn't 'auto' or a positive finite number falls back to
    // auto mode rather than throwing or producing a zero/negative-height
    // row -- matches this library's generally-permissive attribute parsing.
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private keyOf(item: unknown, index: number): VirtualListKey {
    const key = this.keyFunction ? this.keyFunction(item, index) : index;
    return typeof key === 'string' || typeof key === 'number' ? key : index;
  }

  private recomputeOffsets(): void {
    const n = this.items.length;
    const offsets = new Array<number>(n + 1);
    offsets[0] = 0;
    // Only build the live-keys set (and only when in row-height="auto" mode,
    // where measuredHeights is actually populated) when items itself changed
    // -- a measurement-only or rowHeight/keyFunction-only recompute has no
    // stale entries to prune, so skipping this keeps those cases as cheap as
    // before.
    const pruneStale = this.itemsChangedPendingPrune && this.fixedRowHeight == null;
    const liveKeys = pruneStale ? new Set<VirtualListKey>() : null;
    for (let i = 0; i < n; i++) {
      let h: number;
      if (this.fixedRowHeight != null) {
        h = this.fixedRowHeight;
      } else {
        const key = this.keyOf(this.items[i], i);
        liveKeys?.add(key);
        h = this.measuredHeights.get(key) ?? DEFAULT_ROW_ESTIMATE_PX;
      }
      offsets[i + 1] = offsets[i] + h;
    }
    this.offsets = offsets;
    this.itemsChangedPendingPrune = false;
    if (liveKeys) {
      for (const key of this.measuredHeights.keys()) {
        if (!liveKeys.has(key)) this.measuredHeights.delete(key);
      }
    }
  }

  /** First item index whose bottom edge is at/after `offset`. */
  private findIndexAtOrAfter(offset: number): number {
    const offsets = this.offsets;
    let lo = 0;
    let hi = offsets.length - 2;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (offsets[mid + 1] <= offset) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /** Last item index whose top edge is at/before `offset`. */
  private findIndexAtOrBefore(offset: number): number {
    const offsets = this.offsets;
    let lo = 0;
    let hi = offsets.length - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (offsets[mid] < offset) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  private computeRange(): void {
    const n = this.items.length;
    if (n === 0 || this.viewportHeight <= 0) {
      this.visibleStart = 0;
      this.visibleEnd = -1;
      this.renderStart = 0;
      this.renderEnd = -1;
      return;
    }
    const viewTop = this.containerScrollTop;
    const viewBottom = viewTop + this.viewportHeight;
    this.visibleStart = this.findIndexAtOrAfter(viewTop);
    this.visibleEnd = this.findIndexAtOrBefore(viewBottom);
    // Property assignments bypass Lit's attribute converter, so normalize at
    // the arithmetic boundary too. This preserves virtualization even when
    // JavaScript writes Infinity, NaN, a negative, or an excessive number.
    const overscan = normalizeOverscan(this.overscan);
    this.renderStart = Math.max(0, this.visibleStart - overscan);
    this.renderEnd = Math.min(n - 1, this.visibleEnd + overscan);
  }

  private attachContainerListeners(): void {
    const base = this.renderRoot.querySelector('[part="base"]') as HTMLElement | null;
    if (!base) return;
    this.containerResizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      this.viewportHeight = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
    });
    this.containerResizeObserver.observe(base);
    base.addEventListener('scroll', this.onScroll, { passive: true });
    // Queue a one-time read as a fast path for browsers that delay the first
    // ResizeObserver callback. It runs after firstUpdated() returns, so these
    // reactive writes do not schedule an update from inside Lit's lifecycle
    // callback; the observer remains responsible for later measurements.
    queueMicrotask(() => {
      if (!this.isConnected || this.renderRoot.querySelector('[part="base"]') !== base) return;
      const viewportHeight = base.clientHeight;
      const scrollTop = base.scrollTop;
      if (this.viewportHeight !== viewportHeight) this.viewportHeight = viewportHeight;
      if (this.containerScrollTop !== scrollTop) this.containerScrollTop = scrollTop;
    });
  }

  private onScroll = (e: Event): void => {
    this.pendingScrollTop = (e.currentTarget as HTMLElement).scrollTop;
    if (this.scrollRafId !== undefined) return;
    // Coalesce to one recompute per animation frame -- native `scroll`
    // events can fire far faster than that under a fast trackpad/touch
    // fling, and each recompute is a full Lit update.
    this.scrollRafId = requestAnimationFrame(() => {
      this.scrollRafId = undefined;
      if (this.pendingScrollTop !== null) {
        this.containerScrollTop = this.pendingScrollTop;
        this.pendingScrollTop = null;
      }
    });
  };

  private onRowsResized = (entries: ResizeObserverEntry[]): void => {
    if (this.fixedRowHeight != null) return;
    const base = this.renderRoot.querySelector('[part="base"]') as HTMLElement | null;
    const oldScrollTop = base?.scrollTop ?? this.containerScrollTop;
    let scrollAdjustment = 0;
    let changed = false;
    for (const entry of entries) {
      const row = entry.target as HTMLElement;
      const key = this.observedRowKeys.get(row);
      const index = this.observedRowIndices.get(row);
      if (key === undefined || index === undefined) continue;
      const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height;
      const prev = this.measuredHeights.get(key);
      // A sub-pixel-only difference (common with fractional layout/zoom)
      // isn't worth a full offsets rebuild + re-render.
      if (prev === undefined || Math.abs(prev - height) > 0.5) {
        this.measuredHeights.set(key, height);
        // Keep the first visible row anchored while a row fully above it
        // changes size. Otherwise auto-height measurement makes the viewport
        // jump as soon as an earlier row is laid out.
        const oldHeight = prev ?? DEFAULT_ROW_ESTIMATE_PX;
        if (this.offsets[index + 1] <= oldScrollTop) scrollAdjustment += height - oldHeight;
        changed = true;
      }
    }
    if (changed) {
      if (base && scrollAdjustment !== 0) {
        const nextScrollTop = Math.max(0, oldScrollTop + scrollAdjustment);
        base.scrollTop = nextScrollTop;
        this.containerScrollTop = nextScrollTop;
        this.pendingScrollTop = null;
      }
      this.offsetsDirty = true;
      this.requestUpdate();
    }
  };

  /** Keeps the row `ResizeObserver` watching exactly the currently-rendered
   *  rows in `row-height="auto"` mode -- rows that scroll out of the
   *  rendered window are unobserved so the observer doesn't accumulate
   *  references to detached elements it can never usefully report on again. */
  private syncRowObservers(): void {
    const ro = this.rowResizeObserver;
    if (!ro) return;
    if (this.fixedRowHeight != null) {
      for (const el of this.observedRows.values()) ro.unobserve(el);
      this.observedRows.clear();
      return;
    }
    const current = new Map<VirtualListKey, HTMLElement>();
    this.renderRoot.querySelectorAll<HTMLElement>('[part="row"]').forEach((el) => {
      const index = Number(el.getAttribute('aria-posinset')) - 1;
      if (!Number.isInteger(index) || index < 0 || index >= this.items.length) return;
      const key = this.keyOf(this.items[index], index);
      current.set(key, el);
      this.observedRowKeys.set(el, key);
      this.observedRowIndices.set(el, index);
    });
    for (const [key, el] of this.observedRows) {
      if (current.get(key) !== el) {
        ro.unobserve(el);
        this.observedRows.delete(key);
      }
    }
    for (const [key, el] of current) {
      if (!this.observedRows.has(key)) {
        this.observedRows.set(key, el);
        ro.observe(el);
      }
    }
  }

  private scrollActiveIntoView(): void {
    if (this.activeId === '') return;
    const index = this.items.findIndex((item, i) => Object.is(this.keyOf(item, i), this.activeId));
    if (index < 0) return;
    const base = this.renderRoot.querySelector('[part="base"]') as HTMLElement | null;
    if (!base) return;
    const top = this.offsets[index] ?? 0;
    const bottom = this.offsets[index + 1] ?? top;
    const viewTop = base.scrollTop;
    const viewBottom = viewTop + base.clientHeight;
    let target: number | null = null;
    if (top < viewTop) target = top;
    else if (bottom > viewBottom) target = bottom - base.clientHeight;
    if (target === null) return;
    base.scrollTo({ top: Math.max(0, target), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  /**
   * Scrolls row `index` into view. `align` (default `'auto'`) chooses `'start'` (row's top edge
   * flush with the viewport top), `'end'` (row's bottom edge flush with the viewport bottom), or
   * `'auto'` (the same minimal-distance scroll `scrollActiveIntoView()` already uses for
   * `active-id` -- no scroll at all when the row is already fully visible). `behavior` (default
   * `'smooth'`) is forced to `'auto'` under `prefers-reduced-motion: reduce` regardless of what's
   * passed. `index` is clamped to `0…items.length-1`; a call against an empty `items` array is a
   * no-op.
   *
   * In `row-height="auto"` mode a far-off target's offset can still be estimate-based (its own
   * height, and every row between it and the current viewport, may not have been measured yet) --
   * once the target row's real height actually arrives, exactly one corrective re-scroll is issued
   * so the final resting position is accurate, without oscillating on every subsequent measurement.
   */
  scrollToIndex(
    index: number,
    options?: { align?: 'start' | 'end' | 'auto'; behavior?: 'auto' | 'smooth' },
  ): void {
    const n = this.items.length;
    if (n === 0) return;
    const clamped = Math.min(n - 1, Math.max(0, Math.trunc(index)));
    const align = options?.align ?? 'auto';
    const behavior: 'auto' | 'smooth' = prefersReducedMotion() ? 'auto' : (options?.behavior ?? 'smooth');
    this.performScrollTo(clamped, align, behavior);
    if (this.fixedRowHeight == null) {
      const key = this.keyOf(this.items[clamped], clamped);
      this.pendingScrollCorrection = this.measuredHeights.has(key) ? undefined : { key, align, behavior };
    } else {
      // Fixed row-height offsets are exact from the first render -- no
      // measurement to wait for, so no correction is ever needed.
      this.pendingScrollCorrection = undefined;
    }
  }

  private performScrollTo(index: number, align: 'start' | 'end' | 'auto', behavior: 'auto' | 'smooth'): void {
    const base = this.renderRoot.querySelector('[part="base"]') as HTMLElement | null;
    if (!base) return;
    const top = this.offsets[index] ?? 0;
    const bottom = this.offsets[index + 1] ?? top;
    const viewTop = base.scrollTop;
    const viewBottom = viewTop + base.clientHeight;
    let target: number | null = null;
    if (align === 'start') target = top;
    else if (align === 'end') target = bottom - base.clientHeight;
    else if (top < viewTop) target = top;
    else if (bottom > viewBottom) target = bottom - base.clientHeight;
    if (target === null) return;
    base.scrollTo({ top: Math.max(0, target), behavior });
  }

  private maybeCorrectPendingScroll(): void {
    const pending = this.pendingScrollCorrection;
    if (!pending || !this.measuredHeights.has(pending.key)) return;
    this.pendingScrollCorrection = undefined;
    const index = this.items.findIndex((item, i) => Object.is(this.keyOf(item, i), pending.key));
    if (index < 0) return;
    this.performScrollTo(index, pending.align, pending.behavior);
  }

  private emitRangeChangeIfNeeded(): void {
    if (this.visibleEnd < this.visibleStart) return;
    if (this.visibleStart === this.lastEmittedStart && this.visibleEnd === this.lastEmittedEnd) return;
    this.lastEmittedStart = this.visibleStart;
    this.lastEmittedEnd = this.visibleEnd;
    this.emit<VirtualListRange>('lyra-visible-range-changed', {
      start: this.visibleStart,
      end: this.visibleEnd,
    });
  }

  private maybeFireLoadMore(): void {
    const n = this.items.length;
    const nearBottom = n > 0 && this.visibleEnd >= n - 1;
    if (!nearBottom) {
      this.loadMoreArmed = true;
      return;
    }
    if (!this.hasMore || this.loading || !this.loadMoreArmed) return;
    this.loadMoreArmed = false;
    this.emit('lyra-load-more');
  }

  private renderRow(item: unknown, index: number, total: number): TemplateResult {
    const key = this.keyOf(item, index);
    const top = this.offsets[index] ?? 0;
    const isActive = this.activeId !== '' && Object.is(key, this.activeId);
    return html`
      <div
        part="row"
        role="listitem"
        data-row-key=${domKeyToken(key)}
        aria-setsize=${total}
        aria-posinset=${index + 1}
        aria-current=${isActive ? 'true' : nothing}
        style=${styleMap({ transform: `translateY(${top}px)` })}
      >
        ${this.renderItem(item, index)}
      </div>
    `;
  }

  private renderGroups(): TemplateResult[] {
    const seen = new Set<number>();
    return (this.groups ?? [])
      .filter((group) => {
        const index = group.startIndex;
        if (!Number.isInteger(index) || index < 0 || index >= this.items.length || seen.has(index)) return false;
        seen.add(index);
        return true;
      })
      .sort((a, b) => a.startIndex - b.startIndex)
      .map(
        (group) => html`
          <div
            part="group"
            role="heading"
            aria-level="2"
            style=${styleMap({ transform: `translateY(${this.offsets[group.startIndex] ?? 0}px)` })}
          >
            ${group.label ?? String(group.key)}
          </div>
        `,
      );
  }

  render(): TemplateResult {
    const n = this.items.length;
    const totalHeight = this.offsets[n] ?? 0;
    const windowed: { item: unknown; index: number }[] = [];
    for (let i = this.renderStart; i <= this.renderEnd; i++) {
      windowed.push({ item: this.items[i], index: i });
    }

    return html`
      <div part="base" role="list" tabindex="0" aria-busy=${this.loading ? 'true' : nothing}>
        <div part="spacer" style=${styleMap({ height: `${totalHeight}px` })}>
          ${this.renderGroups()}
          ${repeat(
            windowed,
            (w) => this.keyOf(w.item, w.index),
            (w) => this.renderRow(w.item, w.index, n),
          )}
        </div>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-virtual-list': LyraVirtualList;
  }
}

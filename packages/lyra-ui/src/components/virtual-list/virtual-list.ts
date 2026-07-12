import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './virtual-list.styles.js';

/** Fallback per-row height (px) used for any row that hasn't been measured
 *  yet in `row-height="auto"` mode -- close enough to a typical single-line
 *  chat-list row that the initial scrollbar/spacer size doesn't jump wildly
 *  once real measurements arrive. Irrelevant in fixed-`row-height` mode. */
const DEFAULT_ROW_ESTIMATE_PX = 48;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** `lyra-visible-range-changed` detail -- the current visible (non-overscanned) item index range. */
export interface VirtualListRange {
  start: number;
  end: number;
}

/** Placeholder for a later phase's sticky-header sectioning feature -- see the class doc. */
export interface VirtualListGroup {
  key: string | number;
  label?: string;
  startIndex: number;
}

/**
 * `<lyra-virtual-list>` — a generic windowed/virtualized list host. Renders
 * only the items within the current viewport (plus `overscan` padding rows
 * on each side) as real DOM, regardless of how large `items` is, so a
 * multi-thousand-row chat history sidebar (or, in a later phase, a long
 * message thread) stays cheap to scroll.
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
 * The `offsets` array is rebuilt on every update. For the list sizes this
 * component is meant for (a scrollable history sidebar, realistically
 * hundreds to a few thousand rows) that's a trivial `O(n)` arithmetic loop,
 * even at scroll-driven ~60fps; it is *not* the right approach for a
 * hundred-thousand-row list without further work (e.g. a Fenwick/segment
 * tree for `O(log n)` offset queries+updates), which is out of scope here.
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
 * **Grouping.** `groups` is accepted for forward API compatibility with a
 * later phase's sticky-header sectioning feature (paired with a
 * `groupByRecency()` helper that doesn't exist yet) but is not read or
 * rendered by this pass — every row still renders flat, in `items` order.
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
 * @csspart row - One rendered row's absolutely-positioned wrapper
 *   (`role="listitem"`); `renderItem`'s return value renders inside it.
 */
export class LyraVirtualList extends LyraElement {
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

  /** Reserved for a later phase's sticky-header sectioning — accepted but not yet rendered. See the class doc. */
  @property({ attribute: false }) groups?: VirtualListGroup[];

  /** `'auto'` (default) measures each row's real height via `ResizeObserver`;
   *  a numeric string fixes every row to that many pixels. */
  @property({ attribute: 'row-height' }) rowHeight = 'auto';

  /** Extra rows rendered beyond the visible viewport on each side, to reduce blank-frame risk during fast scrolling. */
  @property({ type: Number }) overscan = 6;

  /** When set and it matches a row's `keyFunction` result, that row is smoothly scrolled into view whenever this changes. */
  @property({ attribute: 'active-id' }) activeId = '';

  @property({ type: Boolean, reflect: true }) loading = false;

  /** When true, scrolling near the bottom fires `lyra-load-more`. */
  @property({ type: Boolean, attribute: 'has-more', reflect: true }) hasMore = false;

  // Named distinctly from the inherited DOM `scrollTop` (a `HTMLElement`
  // property this class would otherwise shadow) -- this tracks the *scroll
  // container's* scrollTop, not the host element's own (the host never
  // scrolls itself; [part="base"] does).
  @state() private containerScrollTop = 0;
  @state() private viewportHeight = 0;

  /** `offsets[i]` = row `i`'s pixel top; `offsets[items.length]` = total content height. Rebuilt every update. */
  private offsets: number[] = [0];
  /** Parsed `rowHeight`: a positive pixel number, or `null` for `'auto'` (measured) mode. */
  private fixedRowHeight: number | null = null;
  /** `row-height="auto"` per-row measured heights, keyed by `String(keyFunction(item, index))`. */
  private readonly measuredHeights = new Map<string, number>();

  private renderStart = 0;
  private renderEnd = -1;
  private visibleStart = 0;
  private visibleEnd = -1;
  private lastEmittedStart = -1;
  private lastEmittedEnd = -1;
  /** Re-armed whenever the window moves away from the end of `items` -- see the `lyra-load-more` event doc. */
  private loadMoreArmed = true;
  private isFirstUpdate = true;

  private rowResizeObserver?: ResizeObserver;
  private containerResizeObserver?: ResizeObserver;
  private readonly observedRows = new Map<string, HTMLElement>();
  private scrollRafId?: number;
  private pendingScrollTop: number | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.rowResizeObserver = new ResizeObserver(this.onRowsResized);
    // firstUpdated() only ever fires once per element instance -- a
    // disconnect/reconnect (e.g. a reparenting drag) needs its own
    // re-attach here, since the container observer/scroll listener were
    // torn down in disconnectedCallback below.
    if (this.hasUpdated) this.attachContainerListeners();
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
    this.renderRoot.querySelector('[part="base"]')?.removeEventListener('scroll', this.onScroll);
  }

  firstUpdated(): void {
    this.attachContainerListeners();
  }

  protected willUpdate(changed: PropertyValues): void {
    this.isFirstUpdate = !this.hasUpdated;
    if (changed.has('rowHeight')) {
      this.fixedRowHeight = this.parseRowHeight(this.rowHeight);
    }
    this.recomputeOffsets();
    this.computeRange();
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    this.syncRowObservers();
    if (changed.has('activeId') && !this.isFirstUpdate) this.scrollActiveIntoView();
    this.emitRangeChangeIfNeeded();
    this.maybeFireLoadMore();
  }

  private parseRowHeight(value: string): number | null {
    if (value === 'auto') return null;
    const n = Number(value);
    // Anything that isn't 'auto' or a positive finite number falls back to
    // auto mode rather than throwing or producing a zero/negative-height
    // row -- matches this library's generally-permissive attribute parsing.
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private keyOf(item: unknown, index: number): string | number {
    return this.keyFunction ? this.keyFunction(item, index) : index;
  }

  private recomputeOffsets(): void {
    const n = this.items.length;
    const offsets = new Array<number>(n + 1);
    offsets[0] = 0;
    for (let i = 0; i < n; i++) {
      const h =
        this.fixedRowHeight ??
        this.measuredHeights.get(String(this.keyOf(this.items[i], i))) ??
        DEFAULT_ROW_ESTIMATE_PX;
      offsets[i + 1] = offsets[i] + h;
    }
    this.offsets = offsets;
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
    this.renderStart = Math.max(0, this.visibleStart - this.overscan);
    this.renderEnd = Math.min(n - 1, this.visibleEnd + this.overscan);
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
    // Read synchronously too -- ResizeObserver's first callback is
    // asynchronous, so without this the very first render would otherwise
    // sit at viewportHeight=0 (rendering no rows at all) until that callback
    // eventually fires. This is called from firstUpdated(), so setting a
    // reactive property here schedules a second update on top of the one
    // that just finished -- Lit's dev-mode console flags that pattern, but
    // it's the documented exception ("the next update can only be scheduled
    // as a side effect of the previous update"): the container's real size
    // genuinely isn't knowable until after the first layout.
    this.viewportHeight = base.clientHeight;
    this.containerScrollTop = base.scrollTop;
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
    let changed = false;
    for (const entry of entries) {
      const key = (entry.target as HTMLElement).dataset.rowKey;
      if (key === undefined) continue;
      const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height;
      const prev = this.measuredHeights.get(key);
      // A sub-pixel-only difference (common with fractional layout/zoom)
      // isn't worth a full offsets rebuild + re-render.
      if (prev === undefined || Math.abs(prev - height) > 0.5) {
        this.measuredHeights.set(key, height);
        changed = true;
      }
    }
    if (changed) this.requestUpdate();
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
    const current = new Map<string, HTMLElement>();
    this.renderRoot.querySelectorAll<HTMLElement>('[part="row"]').forEach((el) => {
      const key = el.dataset.rowKey;
      if (key !== undefined) current.set(key, el);
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
    if (!this.activeId) return;
    const index = this.items.findIndex((item, i) => String(this.keyOf(item, i)) === this.activeId);
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
    const key = String(this.keyOf(item, index));
    const top = this.offsets[index] ?? 0;
    const isActive = this.activeId !== '' && key === this.activeId;
    return html`
      <div
        part="row"
        role="listitem"
        data-row-key=${key}
        aria-setsize=${total}
        aria-posinset=${index + 1}
        aria-current=${isActive ? 'true' : nothing}
        style=${styleMap({ transform: `translateY(${top}px)` })}
      >
        ${this.renderItem(item, index)}
      </div>
    `;
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

defineElement('virtual-list', LyraVirtualList);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-virtual-list': LyraVirtualList;
  }
}

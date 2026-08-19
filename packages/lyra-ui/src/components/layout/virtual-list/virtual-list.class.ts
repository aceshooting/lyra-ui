import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { finiteAdd, finiteCount, finiteInteger } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { styles } from './virtual-list.styles.js';

/** Fallback per-row height (px) used for any row that hasn't been measured
 *  yet in `row-height="auto"` mode -- close enough to a typical single-line
 *  chat-list row that the initial scrollbar/spacer size doesn't jump wildly
 *  once real measurements arrive. Irrelevant in fixed-`row-height` mode. */
const DEFAULT_ROW_ESTIMATE_PX = 48;
/** Initial block-size estimate for a visible group marker, replaced by its live measurement. */
const DEFAULT_GROUP_ESTIMATE_PX = 32;
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

/** `lr-visible-range-change` detail -- the current visible (non-overscanned) item index range. */
export interface LyraVirtualListRange {
  start: number;
  end: number;
}

/** A visible group label anchored to the first row in its group. */
export interface LyraVirtualListGroup {
  key: string | number;
  label?: string;
  startIndex: number;
}

/** The ARIA role pairing each rendered row participates in -- see `itemRole`'s own doc for what
 *  each value maps to. */
export type LyraVirtualListItemRole = 'listitem' | 'row';

/** A fixed positive pixel height, or live per-row measurement. */
export type LyraVirtualListRowHeight = number | 'auto';

function normalizeRowHeight(value: unknown): LyraVirtualListRowHeight {
  if (value === 'auto') return 'auto';
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 'auto';
}

const rowHeightConverter = {
  fromAttribute(value: string | null): LyraVirtualListRowHeight {
    return value === null ? 'auto' : normalizeRowHeight(value);
  },
  toAttribute(value: LyraVirtualListRowHeight): string {
    return String(normalizeRowHeight(value));
  },
};

type VirtualListKey = string | number;

/** A random-access collection that does not have to materialize one JavaScript value per row. */
export interface LyraVirtualListIndexedSource<T = unknown> {
  /** Number of addressable rows. Fractional, negative, and non-finite values normalize safely. */
  readonly count: number;
  /** Returns the value at `index`. The component calls this only for rows it needs to render. */
  itemAt(index: number): T;
  /** Returns a stable identity without first allocating or reading the row value. */
  keyAt?(index: number): string | number;
  /**
   * Resolves a stable key back to its row index without a count-sized scan. Use this alongside
   * `keyAt` whenever `active-item-id` should target an indexed collection. Indexed sources deliberately
   * do not fall back to a count-sized scan when this is absent. Invalid and out-of-range results
   * are treated as a missing key.
   */
  indexOfKey?(key: string | number): number;
}

/** Either an ordinary readonly array or a count/index-backed random-access collection. */
export type LyraVirtualListSource<T = unknown> =
  | readonly T[]
  | LyraVirtualListIndexedSource<T>;

function isIndexedSource(
  source: LyraVirtualListSource,
): source is LyraVirtualListIndexedSource {
  return !Array.isArray(source);
}

/** A typed key is used in maps and active-row matching; this token is only for
 * DOM attributes, where every value is necessarily a string. */
function domKeyToken(key: VirtualListKey): string {
  if (typeof key === 'number') {
    if (Number.isNaN(key)) return 'number:NaN';
    if (Object.is(key, -0)) return 'number:-0';
  }
  return `${typeof key}:${String(key)}`;
}

/** `lr-virtual-scroll` detail -- the scroll position and height after a coalesced tick. */
export interface LyraVirtualListScroll {
  scrollTop: number;
  viewportHeight: number;
}

export interface LyraVirtualListEventMap {
  'lr-visible-range-change': CustomEvent<LyraVirtualListRange>;
  'lr-load-more': CustomEvent<null>;
  'lr-virtual-scroll': CustomEvent<LyraVirtualListScroll>;
}
/**
 * `<lr-virtual-list>` — a generic windowed/virtualized list host. Renders
 * only the items within the current viewport (plus `overscan` padding rows
 * on each side) as real DOM, regardless of how large its effective source is, so a
 * multi-thousand-row chat history sidebar or long message thread stays cheap
 * to scroll.
 *
 * Content is entirely caller-supplied: `renderItem(item, index)` returns
 * whatever `lit-html` value should represent that row (typically a
 * `TemplateResult`), and `keyFunction(item, index)` gives it a stable
 * identity for `repeat()`'s DOM-reconciliation key, so scroll position and
 * any per-row state (e.g. an `<audio>` element's playback position) survive
 * an array/source mutation instead of every row remounting from scratch.
 *
 * **Narrow allocations.** Row wrappers allow their content to shrink and use
 * `overflow-wrap: anywhere` by default, so a normal long value wraps inside
 * the list rather than widening a narrow panel; its resulting height is what
 * `row-height="auto"` measures. A consumer that deliberately needs an
 * unbroken value can set `white-space: nowrap` on its own rendered content:
 * the scroll container remains horizontally scrollable for that opt-out.
 *
 * **Windowing math.** Every row is positioned by a `transform: translateY(offset)`, rather than by
 * page flow. Array sources use a cumulative offsets cache. Count/index sources stay sparse: fixed
 * row offsets are direct arithmetic and auto-height offsets add only mounted-row measurements to
 * the default estimate. This is what lets only a small DOM window exist while the scrollbar still
 * reflects the full content height without synthesizing count-sized item/key/offset arrays:
 * - **`row-height="auto"` (default).** Each currently-rendered row is
 *   watched by a `ResizeObserver`; its real height lands in a per-key
 *   `Map`, and any row not yet measured contributes `DEFAULT_ROW_ESTIMATE_PX`
 *   until it has been. This is *not* the same
 *   thing as a page-count-based `padding-top`/`padding-bottom` spacer pair —
 *   that approach reflows every unmeasured row's position on every new
 *   measurement, which is exactly what per-row transform offsets avoid: only
 *   the rows *after* a newly-measured one shift, and even that shift is a
 *   cheap style recompute, not a layout-affecting padding change.
 * - **Fixed numeric `row-height`.** No measurement needed — the offset is `i * rowHeightPx` for an
 *   indexed source, while arrays retain the same cached cumulative path as auto-height arrays.
 *
 * An array source's offsets cache is rebuilt only when `items`/`source`, `row-height`, or
 * `keyFunction` change, or a row's measured height changes -- not on every
 * update, so a pure scroll-position tick (potentially every rAF while
 * scrolling) only re-runs the cheap range/visibility math in
 * `computeRange()`, never the `O(n)` offsets rebuild (which, in
 * `row-height="auto"` mode, also means a `keyFunction` call per item). For
 * indexed sources skip that count-sized rebuild entirely.
 *
 * Before a viewport can be measured, including during server rendering, one bounded deterministic
 * first window (the first row plus `overscan`) is emitted instead of a false empty list. Hydration
 * preserves that server window on its first pass, then reconciles it with the measured viewport;
 * an ordinary browser-only mount retains its empty-until-measured range-event behavior.
 *
 * **Accessibility.** The scroll container is `role="list"` and each rendered
 * row is `role="listitem"`, deliberately *not* `listbox`/`option` — this
 * component only provides windowing, not the roving-tabindex/
 * `aria-activedescendant` keyboard-interaction contract ARIA requires
 * alongside a real `listbox`. A consumer that wants full single-select
 * listbox semantics on top of this should compose that behavior itself (see
 * `<lr-select>`'s pattern), the same way this component's `active-item-id`
 * only *scrolls* the matching row into view and marks it `aria-current` —
 * it never claims to be a selection widget. `aria-setsize`/`aria-posinset`
 * are computed from the row's real index in the full effective source (not its
 * position among the currently-rendered DOM window), so a screen reader
 * still announces e.g. "item 12 of 340" correctly. `[part="base"]` itself
 * carries `tabindex="0"` — `renderItem`'s content is caller-supplied and not
 * guaranteed to contain a focusable element, and a scrollable region with no
 * focusable content of its own is otherwise unreachable by keyboard (native
 * arrow/Page Up/Page Down scrolling included).
 *
 * **Grouping.** When supplied, `groups` renders a labeled, measured virtual entry immediately
 * before the corresponding `startIndex` row. Its live block size contributes to following offsets,
 * so an opaque variable-height marker cannot cover that first row. Markers are windowed with the
 * rows, while normalized metadata stays cached for sticky lookup; one-group-per-row catalogs remain
 * bounded.
 *
 * **Sticky group headers.** `renderStickyGroup` adds a `[part="sticky-group"]` overlay pinned to the
 * top of the scroll viewport, showing the `groups` entry the viewport is currently inside; as the
 * next group's header arrives it is pushed out by the overlap rather than swapped abruptly. Unset
 * (the default) renders no overlay element at all, and the list renders exactly as it does without
 * this feature. Four properties of the overlay matter to a consumer:
 * - It is a **strictly presentational visual copy** of content that already exists in the list, so
 *   the copy itself is both `aria-hidden` and `inert`. The real row keeps sole ownership of heading
 *   semantics, focus and activation without this component traversing or mutating caller-rendered
 *   descendants (including arbitrary open shadow roots).
 * - It is **pointer-transparent**. Put interactive group actions in the real row; the sticky copy
 *   deliberately cannot be opted into a pointer-only interaction state.
 * - It is **never measured as a row or real marker.** It contributes nothing to offsets, so the
 *   presentational copy is not counted twice.
 * - Its measured height becomes a `scroll-padding-block-start` on the scroll container, so both
 *   `active-item-id`/`scrollToIndex` and native keyboard scrolling stop *below* the band instead of
 *   parking the target row behind it. Scrolled above the first group the band shows nothing but
 *   stays mounted, so that height is known before the first jump rather than after it.
 * A host that renders its own group headers as ordinary rows supplies `groups` purely as position
 * anchors, with `label: ''` so no duplicate `[part="group"]` marker renders.
 *
 * **Position queries.** `offsetForIndex(index)` and `indexAtOffset(px)` expose the windowing math
 * itself: they translate between an item index and the pixel offset that row renders at, in the same
 * coordinate space as the scroll container's `scrollTop`. A host doing its own scroll-linked layout
 * (a pinned group header, a scrollbar minimap, a "jump to here" affordance) needs those numbers and
 * would otherwise have to duplicate the offsets array.
 *
 * **Programmatic scrolling.** `scrollToIndex()` is the public counterpart to `active-item-id`'s automatic
 * scroll-into-view -- used by `<lr-chat-viewport>`'s virtual mode and any other host that needs to
 * scroll to a specific row without also changing which row is "active."
 *
 * **`item-role="row"` mode.** Additive to the default `'listitem'` mapping above: `[part="base"]`
 * becomes `role="rowgroup"`, `[part="spacer"]` becomes `role="presentation"`, and each row becomes
 * `role="row"` with `aria-rowindex` (the row's 1-based index plus `row-index-offset`) instead of
 * `aria-setsize`/`aria-posinset`. For a consumer composing its own `role="table"` wrapper and header
 * row around this component (see `<lr-dataset-viewer>`), where `row-index-offset="1"` accounts for
 * that external header row occupying `aria-rowindex="1"`.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-virtual-list
 * @event lr-load-more - Fired once per approach to the bottom of the list
 *   while `has-more` is true and `loading` is false. Deliberately does not
 *   refire on every scroll tick while still near the bottom (`loading`
 *   gates the in-flight case; scrolling back away from the bottom and
 *   returning, or the effective source growing enough to move the window away from the
 *   end, re-arms it) — a consumer wanting an automatic retry after a failed
 *   fetch should surface its own retry affordance rather than relying on
 *   this firing again unprompted.
 * @event lr-visible-range-change - `detail: { start, end }` (see
 *   `LyraVirtualListRange`) — the current visible (non-overscanned) item index
 *   range, fired only when it actually changes.
 * @event lr-virtual-scroll - `detail: { scrollTop, viewportHeight }` (see
 *   `LyraVirtualListScroll`) — the scroll container moved. Emitted from the same
 *   `requestAnimationFrame` tick that already coalesces native `scroll`
 *   events, so a fling that fires dozens of native events produces at most one
 *   of these per frame, and none at all when the position did not actually
 *   change. Unlike `lr-visible-range-change` this reports *sub-row*
 *   movement, which is what a scroll-linked layout (a pinned header, a
 *   minimap) needs.
 *
 * A host `aria-label` attribute on this element is forwarded onto the internal `role="list"`
 * container, since `aria-label` set on a custom-element host does not by itself name a role living
 * on an internal shadow element. Used by `<lr-activity-feed>`'s virtualized mode.
 * @csspart base - The scrollable container (`role="list"`), including the horizontal scrollport
 *   used when consumer-rendered row content explicitly opts out of wrapping.
 * @csspart spacer - The full-content-height inner element that gives the
 *   container its true scrollable extent.
 * @csspart group - A positioned group label. Not rendered for a `groups` entry whose `label` is the
 *   empty string (a position-anchor-only entry).
 * @csspart sticky-group - The pinned copy of the current group, rendered only while
 *   `renderStickyGroup` is set (and showing nothing while the viewport is above the first group,
 *   where there is no group to pin). Always `aria-hidden`, `inert`, and pointer-transparent; put
 *   interactive actions in the real group row.
 * @csspart row - One rendered row's absolutely-positioned wrapper
 *   (`role="listitem"`); `renderItem`'s return value renders inside it. Normal content wraps
 *   within the row; consumer content can opt out with `white-space: nowrap`.
 * @cssprop [--lr-virtual-list-height=var(--lr-size-24rem)] - The scroll viewport's height. A
 *   virtualized list needs a bounded scroll extent, so this ships a default rather than
 *   collapsing to zero when a caller does not size the host.
 * @cssprop [--lr-virtual-list-hover-outline-width=var(--lr-border-width-thin)] - Outline width of
 *   the mouse-hover preview on `[part="base"]`.
 * @cssprop [--lr-virtual-list-hover-outline-style=solid] - Outline style of the mouse-hover preview
 *   on `[part="base"]`.
 * @cssprop [--lr-virtual-list-hover-outline-color=var(--lr-color-border-strong)] - Outline color of
 *   the mouse-hover preview on `[part="base"]` (a subtler, always-focusable-target preview of its
 *   own `:focus-visible` ring). Set to `transparent` to opt out of the hover treatment entirely.
 * @cssprop [--lr-virtual-list-hover-outline-offset=calc(-1 * var(--lr-border-width-thin))] -
 *   Inward offset of the mouse-hover preview on `[part="base"]`, keeping the outline inside its
 *   own scrollport so it is not clipped at the edge.
 * @status stable
 * @since 4.0.0
 */
export class LyraVirtualList extends LyraElement<LyraVirtualListEventMap> {
  protected static override readonly ownedCollectionProperties = Object.freeze([
    'items',
    'source',
    'groups',
  ]);
  /** Generic rows are keyed/rendered by caller identity; only their containing sequence is owned. */
  protected static override readonly identityCollectionProperties = Object.freeze([
    'items',
    'source',
  ]);
  /** Count/index providers are opaque imperative sources; array-valued sources still snapshot. */
  protected static override readonly identityCollectionObjectProperties =
    Object.freeze(['source']);

  static override styles = [LyraElement.styles, styles];

  /**
   * The full (non-windowed) item collection. Preserved as the array-compatible source when
   * `source` is unset.
   */
  @property({ attribute: false }) items: readonly unknown[] = [];

  /**
   * A readonly array or count/index-backed collection. An array assignment is copied, bounded,
   * and frozen while retaining each generic row's identity; reassign a new array after sequence
   * changes. Indexed-source objects pass through by identity. When set, this takes precedence over
   * `items`; an indexed source lets synthetic or remote models expose a large row count without
   * allocating an `Array(0…count)` merely to feed the virtualizer.
   */
  @property({ attribute: false }) source?: LyraVirtualListSource;

  /** Renders one row's content — typically returns a `lit-html` `TemplateResult`. */
  @property({ attribute: false }) renderItem: (
    item: unknown,
    index: number
  ) => unknown = () => nothing;

  /** Derives a row's stable `repeat()` key. Falls back to the item's index
   *  in the effective source when omitted, which is only a safe identity while the collection
   *  never reorders/inserts/removes — provide this whenever it can, or
   *  scroll position and any per-row DOM state can attach to the wrong row
   *  across a mutation (same caveat as `<lr-table>`'s `rowKey`). Duplicate keys remain distinct
   *  by occurrence for rendering and measurement; `activeItemId` targets the first occurrence. */
  @property({ attribute: false }) keyFunction?: (
    item: unknown,
    index: number
  ) => string | number;

  /** Measured group markers inserted immediately before their first row's `startIndex`. Invalid or
   * duplicate indexes are ignored during rendering. An entry whose `label` is
   * the empty string renders no `[part="group"]` marker at all — it is a pure
   * position anchor, for a host that renders its own group header as an
   * ordinary row (and would otherwise get two stacked headers) but still needs
   * this component to know where each group starts, e.g. to drive
   * `renderStickyGroup`. Omitting `label` entirely still falls back to `key`. */
  @property({ attribute: false }) groups?: readonly LyraVirtualListGroup[];

  /** Renders the pinned copy of whichever `groups` entry the viewport is
   *  currently inside, into a `[part="sticky-group"]` overlay layer that stays
   *  at the top of the scroll viewport. Unset (the default) renders no overlay
   *  element whatsoever. See the class doc's "Sticky group headers" section for
   *  the accessibility and interactivity contract.
   *
   *  Called on every scroll-driven update, so keep it cheap and side-effect
   *  free — including while the viewport is above the first group, where it is
   *  called with the *first* group and the result rendered hidden, purely to
   *  keep the band's height measurable for the scroll inset. */
  @property({ attribute: false }) renderStickyGroup?: (
    group: LyraVirtualListGroup
  ) => unknown;

  /** `'auto'` (default) measures each row's real height via `ResizeObserver`;
   *  a positive number fixes every row to that many pixels. Numeric markup attributes are parsed
   *  into numbers; invalid markup safely canonicalizes to `'auto'`. */
  @property({ attribute: 'row-height', converter: rowHeightConverter })
  rowHeight: LyraVirtualListRowHeight = 'auto';

  /** `'listitem'` (default) preserves today's `role="list"`/`role="listitem"` mapping with
   *  `aria-setsize`/`aria-posinset`. `'row'` maps to `role="rowgroup"`/`role="row"` with
   *  `aria-rowindex` instead -- for a consumer composing a virtualized `role="table"` (see
   *  `<lr-dataset-viewer>`). */
  @property({ attribute: 'item-role' }) itemRole: LyraVirtualListItemRole =
    'listitem';

  /** Added to a row's 1-based index to compute `aria-rowindex` in `item-role="row"` mode (e.g. `1`
   *  when a consumer renders its own header row occupying `aria-rowindex="1"` outside this
   *  component). No effect in `'listitem'` mode. */
  @property({ type: Number, attribute: 'row-index-offset' }) rowIndexOffset = 0;

  /** Extra rows rendered beyond the visible viewport on each side, to reduce
   *  blank-frame risk during fast scrolling. Normalized to a whole number in
   *  the inclusive range 0–`MAX_OVERSCAN_ROWS`; non-finite values use the
   *  default. */
  @property({ converter: overscanConverter }) overscan = DEFAULT_OVERSCAN_ROWS;

  /** When set and it matches a row's typed `keyFunction` result, that row is
   * smoothly scrolled into view whenever this changes. Attribute values are
   * strings; assign the property for a numeric key. */
  @property({ attribute: 'active-item-id' }) activeItemId: VirtualListKey | '' = '';

  @property({ type: Boolean, reflect: true }) loading = false;

  /** When true, scrolling near the bottom fires `lr-load-more`. */
  @property({ type: Boolean, attribute: 'has-more', reflect: true }) hasMore =
    false;

  /**
   * The real scroll container — the `[part="base"]` element, the box whose `scrollTop`/
   * `clientHeight` this component's windowing math is expressed against. `undefined` until the
   * first render (and for a never-connected element), since the element does not exist before then.
   *
   * Exposed so a host that needs the live scroll position, or needs to scroll the list itself, can
   * do it without reaching into this component's shadow root. Pair it with `lr-virtual-scroll` (change
   * notifications), `offsetForIndex()`/`indexAtOffset()` (coordinate conversion), and
   * `scrollToIndex()` (which expresses "show row N" without any manual arithmetic at all, and is
   * the better choice whenever that is the actual intent).
   */
  get scrollContainer(): HTMLElement | undefined {
    const root = this.renderRoot as ParentNode | undefined;
    return (
      (root?.querySelector('[part="base"]') as HTMLElement | null) ?? undefined
    );
  }

  /**
   * The row wrappers (`[part="row"]`) that currently exist as real DOM, in item order — the current
   * window, not the whole `items` collection, and empty before the first render. Each one carries
   * its own `data-row-index`, and `renderItem`'s output for that item is inside it.
   *
   * For a host that has to *reach* a rendered row rather than style it: focus management across a
   * windowed list is the motivating case, since the row that a keyboard command needs to focus may
   * not have existed a frame earlier. `exportparts` cannot serve that — it forwards styling, not
   * element references. Treat the returned elements as read-only: their positioning, keys, and
   * lifetime belong to the windowing math, and any of them can be recycled or removed on the next
   * update.
   */
  get renderedRows(): HTMLElement[] {
    const root = this.renderRoot as ParentNode | undefined;
    return root ? [...root.querySelectorAll<HTMLElement>('[part="row"]')] : [];
  }

  /** A finite, nonnegative whole-row count before it reaches ARIA arithmetic. */
  private get safeRowIndexOffset(): number {
    return finiteCount(this.rowIndexOffset);
  }

  private computedAriaRowIndex(index: number): number {
    return finiteInteger(
      finiteAdd(index + 1, this.safeRowIndexOffset),
      1,
      1,
      Number.MAX_SAFE_INTEGER
    );
  }

  // Named distinctly from the inherited DOM `scrollTop` (a `HTMLElement`
  // property this class would otherwise shadow) -- this tracks the *scroll
  // container's* scrollTop, not the host element's own (the host never
  // scrolls itself; [part="base"] does).
  @state() private containerScrollTop = 0;
  @state() private viewportHeight = 0;
  /** SSR has no viewport to measure, so its first render exposes a bounded deterministic window.
   * A normal browser mount preserves the established empty-until-measured event contract; a
   * hydrating mount keeps the server window for exactly its first render, then returns to that
   * browser contract through LyraElement's hydration-aware seed helper. */
  private renderUnmeasuredWindow = true;

  /** `offsets[i]` = row `i`'s pixel top for array sources. Indexed sources compute offsets from
   * their count plus sparse measurements and never allocate this array at source cardinality. */
  private offsets: number[] = [0];
  /** Occurrence-safe internal identities. Public duplicate keys remain visible as distinct rows,
   * while the first occurrence alone owns `activeItemId`. */
  private rowIdentities: string[] = [];
  /** Parsed `rowHeight`: a positive pixel number, or `null` for `'auto'` (measured) mode. */
  private fixedRowHeight: number | null = null;
  /** `row-height="auto"` per-row measured heights, keyed by
   *  keyFunction result. Pruned to the current `items`'
   *  live keys whenever `items` changes (see `recomputeOffsets()`), so a
   *  long-lived instance handed many wholly different `items` arrays over
   *  its life doesn't grow this map without bound. */
  private readonly measuredHeights = new Map<string, number>();
  /** Sparse index ownership for indexed-source measurements. Array sources derive this from their
   * cumulative offsets array instead. */
  private readonly measuredIndices = new Map<string, number>();
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
  /** Re-armed whenever the window moves away from the end of `items` -- see the `lr-load-more` event doc. */
  private loadMoreArmed = true;
  /** Identity- and source-bound correction transaction for estimate-based programmatic scrolling. */
  private pendingScrollCorrection?: {
    identity: string;
    index: number;
    align: 'start' | 'end' | 'auto';
    behavior: 'auto' | 'smooth';
    source: LyraVirtualListSource;
    keyFunction?: (item: unknown, index: number) => string | number;
    activeItemId?: VirtualListKey;
    lastMeasurementGeneration: number;
  };
  private measurementGeneration = 0;
  private isFirstUpdate = true;

  /** The sticky overlay's measured block size, used both for the push-off overlap math and for the
   *  scroll inset that keeps a scrolled-to row from landing underneath the band. Measured by its own
   *  `ResizeObserver` -- deliberately never by `rowResizeObserver`, which would fold this *copy* of a
   *  row into `offsets` and double-count the group header's height. */
  @state() private stickyHeight = 0;

  private rowResizeObserver?: ResizeObserver;
  private groupResizeObserver?: ResizeObserver;
  private containerResizeObserver?: ResizeObserver;
  private stickyResizeObserver?: ResizeObserver;
  private observedSticky?: HTMLElement;
  private readonly observedRows = new Map<string, HTMLElement>();
  private readonly observedRowKeys = new WeakMap<HTMLElement, string>();
  private readonly observedRowIndices = new WeakMap<HTMLElement, number>();
  private readonly observedGroups = new Map<number, HTMLElement>();
  private readonly observedGroupIndices = new WeakMap<HTMLElement, number>();
  private scrollRafId?: number;
  private scrollRafOwner?: Window;
  private scrollRafDocument?: Document;
  private scrollListenerTarget?: HTMLElement;
  private ownerRealmGeneration = 0;
  /** True for the remainder of the frame in which any of this component's `ResizeObserver`s
   *  delivered -- so `syncRowObservers()` can tell that the re-render it is running inside is still
   *  part of the browser's current resize-observation loop. See `beginResizeDelivery()`. */
  private inResizeDelivery = false;
  /** Rows that entered the window during such a re-render: already owned by `observedRows`, but not
   *  yet handed to `rowResizeObserver`. Always a subset of `observedRows` -- `syncRowObservers()`
   *  drops an entry here whenever it drops the same identity there. */
  private readonly deferredRowObservations = new Map<string, HTMLElement>();
  private readonly deferredGroupObservations = new Map<number, HTMLElement>();
  private rowObserveRafId?: number;
  private rowObserveRafOwner?: Window;
  private rowObserveRafDocument?: Document;

  /** Reference-keyed memo for `activeItemId`'s resolved index. `render()` re-runs on every scroll
   *  frame (`scrollTop` drives reactive state), and resolving an array source means scanning it
   *  with `keyOf` -- O(items) *per frame* without this memo. Indexed sources never scan their
   *  declared count: they use `indexOfKey`, or decline the match when it is absent/overridden by a
   *  consumer `keyFunction`. The inputs are source identity, `activeItemId`, count, and `keyFunction`.
   *  Mutable array length is keyed too: that catches an in-place
 *  insert/remove followed by a manual `requestUpdate()`. An in-place *reorder* of the same length
 *  is not detected -- the same identity caveat `keyFunction` already documents. */
  private activeIndexFor?: LyraVirtualListSource;
  private activeIndexForLength = -1;
  private activeIndexForId: VirtualListKey | '' = '';
  private activeIndexForKeyFn?: (item: unknown, index: number) => string | number;
  private activeIndexCache = -1;

  /** `activeItemId`'s index in the effective source, or -1. Memoized -- see `activeIndexFor`. */
  private get activeIndex(): number {
    if (this.activeItemId === '') return -1;
    const source = this.effectiveSource;
    const count = this.itemCount;
    if (
      this.activeIndexFor === source &&
      this.activeIndexForLength === count &&
      Object.is(this.activeIndexForId, this.activeItemId) &&
      this.activeIndexForKeyFn === this.keyFunction
    )
      return this.activeIndexCache;
    this.activeIndexFor = source;
    this.activeIndexForLength = count;
    this.activeIndexForId = this.activeItemId;
    this.activeIndexForKeyFn = this.keyFunction;
    this.activeIndexCache = -1;
    if (isIndexedSource(source)) {
      if (!this.keyFunction && source.indexOfKey) {
        const candidate = source.indexOfKey(this.activeItemId);
        if (Number.isInteger(candidate) && candidate >= 0 && candidate < count) {
          this.activeIndexCache = candidate;
        }
      }
      return this.activeIndexCache;
    }
    for (let index = 0; index < count; index++) {
      const item = this.itemAt(index);
      if (Object.is(this.keyOf(item, index), this.activeItemId)) {
        this.activeIndexCache = index;
        break;
      }
    }
    return this.activeIndexCache;
  }
  private pendingScrollTop: number | null = null;
  /** Normalized once per `groups`/source assignment, then shared by marker and sticky paths. */
  private normalizedGroups: LyraVirtualListGroup[] = [];
  private readonly normalizedGroupByIndex = new Map<number, LyraVirtualListGroup>();
  /** Live block sizes for real group markers. Position-only anchors (`label: ''`) never enter it. */
  private readonly measuredGroupHeights = new Map<number, number>();
  /** Cumulative marker heights in normalized-group order, used by sparse indexed sources. */
  private groupHeightPrefix: number[] = [0];

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.ownerDocument.defaultView) {
      this.seedFirstRenderState(() => {
        this.renderUnmeasuredWindow = false;
        this.requestUpdate();
      });
    }
    this.resetOwnerRealmWork();
    const ownerDocument = this.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    const generation = this.ownerRealmGeneration;
    const ResizeObserverCtor = ownerWindow?.ResizeObserver;
    if (ResizeObserverCtor) {
      const rowObserver = new ResizeObserverCtor((entries) => {
        if (
          this.rowResizeObserver !== rowObserver ||
          !this.isCurrentOwnerWork(ownerDocument, generation)
        ) return;
        this.onRowsResized(entries);
      });
      const groupObserver = new ResizeObserverCtor((entries) => {
        if (
          this.groupResizeObserver !== groupObserver ||
          !this.isCurrentOwnerWork(ownerDocument, generation)
        ) return;
        this.onGroupsResized(entries);
      });
      const stickyObserver = new ResizeObserverCtor((entries) => {
        if (
          this.stickyResizeObserver !== stickyObserver ||
          !this.isCurrentOwnerWork(ownerDocument, generation)
        ) return;
        this.onStickyResized(entries);
      });
      this.rowResizeObserver = rowObserver;
      this.groupResizeObserver = groupObserver;
      this.stickyResizeObserver = stickyObserver;
    }
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
      this.syncGroupObservers();
      this.syncStickyOverlay();
    }
  }

  override disconnectedCallback(): void {
    this.resetOwnerRealmWork();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.resetOwnerRealmWork();
  }

  private isCurrentOwnerWork(ownerDocument: Document, generation: number): boolean {
    return (
      this.ownerRealmGeneration === generation &&
      this.isConnected &&
      this.ownerDocument === ownerDocument
    );
  }

  private resetOwnerRealmWork(): void {
    this.ownerRealmGeneration += 1;
    this.rowResizeObserver?.disconnect();
    this.rowResizeObserver = undefined;
    this.groupResizeObserver?.disconnect();
    this.groupResizeObserver = undefined;
    this.observedRows.clear();
    this.observedGroups.clear();
    this.deferredRowObservations.clear();
    this.deferredGroupObservations.clear();
    this.inResizeDelivery = false;
    if (this.rowObserveRafId !== undefined) {
      this.rowObserveRafOwner?.cancelAnimationFrame(this.rowObserveRafId);
    }
    this.rowObserveRafId = undefined;
    this.rowObserveRafOwner = undefined;
    this.rowObserveRafDocument = undefined;
    this.containerResizeObserver?.disconnect();
    this.containerResizeObserver = undefined;
    this.stickyResizeObserver?.disconnect();
    this.stickyResizeObserver = undefined;
    this.observedSticky = undefined;
    if (this.scrollRafId !== undefined) {
      this.scrollRafOwner?.cancelAnimationFrame(this.scrollRafId);
    }
    this.scrollRafId = undefined;
    this.scrollRafOwner = undefined;
    this.scrollRafDocument = undefined;
    this.pendingScrollTop = null;
    this.pendingScrollCorrection = undefined;
    this.detachContainerListeners();
    this.scrollListenerTarget = undefined;
  }

  override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.attachContainerListeners();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.isFirstUpdate = !this.hasUpdated;
    if (
      changed.has('items') ||
      changed.has('source') ||
      changed.has('keyFunction') ||
      changed.has('rowHeight') ||
      changed.has('groups') ||
      changed.has('activeItemId')
    ) this.pendingScrollCorrection = undefined;
    if (
      changed.has('items') ||
      changed.has('source') ||
      changed.has('rowHeight') ||
      changed.has('keyFunction') ||
      changed.has('groups')
    ) {
      this.offsetsDirty = true;
    }
    if (changed.has('items') || changed.has('source')) {
      this.itemsChangedPendingPrune = true;
    }
    if (
      isIndexedSource(this.effectiveSource) &&
      (changed.has('items') || changed.has('source') || changed.has('keyFunction'))
    ) {
      this.measuredHeights.clear();
      this.measuredIndices.clear();
    }
    if (changed.has('groups')) this.measuredGroupHeights.clear();
    if (changed.has('items') || changed.has('source') || changed.has('groups')) {
      this.recomputeGroups();
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

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.syncRowObservers();
    this.syncGroupObservers();
    this.syncStickyOverlay();
    if (changed.has('activeItemId') && !this.isFirstUpdate)
      this.scrollActiveIntoView();
    this.emitRangeChangeIfNeeded();
    this.maybeFireLoadMore();
    this.maybeCorrectPendingScroll();
  }

  private parseRowHeight(value: LyraVirtualListRowHeight): number | null {
    const normalized = normalizeRowHeight(value);
    return normalized === 'auto' ? null : normalized;
  }

  private get effectiveSource(): LyraVirtualListSource {
    return this.source ?? this.items;
  }

  private get itemCount(): number {
    const source = this.effectiveSource;
    return isIndexedSource(source)
      ? finiteCount(source.count)
      : source.length;
  }

  private itemAt(index: number): unknown {
    const source = this.effectiveSource;
    return isIndexedSource(source) ? source.itemAt(index) : source[index];
  }

  private keyOf(item: unknown, index: number): VirtualListKey {
    const source = this.effectiveSource;
    const key = this.keyFunction
      ? this.keyFunction(item, index)
      : isIndexedSource(source)
        ? source.keyAt?.(index) ?? index
        : index;
    return typeof key === 'string' || typeof key === 'number' ? key : index;
  }

  private rowIdentity(key: VirtualListKey, occurrence: number): string {
    const token = domKeyToken(key);
    return `${token.length}:${token}:${occurrence}`;
  }

  private identityAt(index: number, item = this.itemAt(index)): string {
    if (!isIndexedSource(this.effectiveSource)) {
      return this.rowIdentities[index] ?? this.rowIdentity(this.keyOf(item, index), index);
    }
    // A source-provided key is expected to be stable and unique. Keeping the index in the internal
    // token still makes accidental duplicate keys distinct without scanning or allocating the
    // preceding collection merely to derive an occurrence count.
    return this.rowIdentity(this.keyOf(item, index), index);
  }

  private groupHeightAt(index: number): number {
    const group = this.normalizedGroupByIndex.get(index);
    if (!group || group.label === '') return 0;
    return this.measuredGroupHeights.get(index) ?? DEFAULT_GROUP_ESTIMATE_PX;
  }

  private rowHeightAt(index: number): number {
    if (this.fixedRowHeight != null) return this.fixedRowHeight;
    return this.measuredHeights.get(this.identityAt(index)) ?? DEFAULT_ROW_ESTIMATE_PX;
  }

  /** Marker height before and at `index`, from the sparse normalized group metadata. */
  private groupContributionThrough(index: number): number {
    let low = 0;
    let high = this.normalizedGroups.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (this.normalizedGroups[middle]!.startIndex <= index) low = middle + 1;
      else high = middle;
    }
    return this.groupHeightPrefix[low] ?? 0;
  }

  private recomputeGroupHeightPrefix(): void {
    const prefix = new Array<number>(this.normalizedGroups.length + 1);
    prefix[0] = 0;
    for (let index = 0; index < this.normalizedGroups.length; index++) {
      const group = this.normalizedGroups[index]!;
      const height = group.label === ''
        ? 0
        : this.measuredGroupHeights.get(group.startIndex) ?? DEFAULT_GROUP_ESTIMATE_PX;
      prefix[index + 1] = finiteAdd(prefix[index]!, height);
    }
    this.groupHeightPrefix = prefix;
  }

  private indexedOffsetForIndex(index: number): number {
    const baseHeight = this.fixedRowHeight ?? DEFAULT_ROW_ESTIMATE_PX;
    let offset =
      index > Number.MAX_VALUE / baseHeight
        ? Number.MAX_VALUE
        : index * baseHeight;
    if (this.fixedRowHeight == null) {
      for (const [identity, height] of this.measuredHeights) {
        const measuredIndex = this.measuredIndices.get(identity);
        if (measuredIndex !== undefined && measuredIndex < index) {
          offset = finiteAdd(offset, height - DEFAULT_ROW_ESTIMATE_PX);
        }
      }
    }
    return Math.max(0, finiteAdd(offset, this.groupContributionThrough(index)));
  }

  private offsetAt(index: number): number {
    return isIndexedSource(this.effectiveSource)
      ? this.indexedOffsetForIndex(index)
      : this.offsets[index] ?? 0;
  }

  private recomputeOffsets(): void {
    const n = this.itemCount;
    this.recomputeGroupHeightPrefix();
    if (isIndexedSource(this.effectiveSource)) {
      // Count-backed sources intentionally stay sparse. Offset queries use count arithmetic plus
      // only the rows actually measured by ResizeObserver; no count-sized items/keys/offsets array
      // is synthesized here.
      this.offsets = [0];
      this.rowIdentities = [];
      this.itemsChangedPendingPrune = false;
      return;
    }
    const offsets = new Array<number>(n + 1);
    let cursor = 0;
    // Only build the live-keys set (and only when in row-height="auto" mode,
    // where measuredHeights is actually populated) when items itself changed
    // -- a measurement-only or rowHeight/keyFunction-only recompute has no
    // stale entries to prune, so skipping this keeps those cases as cheap as
    // before.
    const pruneStale =
      this.itemsChangedPendingPrune && this.fixedRowHeight == null;
    const liveKeys = pruneStale ? new Set<string>() : null;
    const occurrences = new Map<string, number>();
    const identities = new Array<string>(n);
    for (let i = 0; i < n; i++) {
      cursor = finiteAdd(cursor, this.groupHeightAt(i));
      offsets[i] = cursor;
      const key = this.keyOf(this.itemAt(i), i);
      const token = domKeyToken(key);
      const occurrence = occurrences.get(token) ?? 0;
      occurrences.set(token, occurrence + 1);
      const identity = this.rowIdentity(key, occurrence);
      identities[i] = identity;
      let h: number;
      if (this.fixedRowHeight != null) {
        h = this.fixedRowHeight;
      } else {
        liveKeys?.add(identity);
        h = this.measuredHeights.get(identity) ?? DEFAULT_ROW_ESTIMATE_PX;
      }
      cursor = finiteAdd(cursor, h);
    }
    offsets[n] = cursor;
    this.offsets = offsets;
    this.rowIdentities = identities;
    this.itemsChangedPendingPrune = false;
    if (liveKeys) {
      for (const key of this.measuredHeights.keys()) {
        if (!liveKeys.has(key)) this.measuredHeights.delete(key);
      }
    }
  }

  private groupTopAt(index: number): number {
    return Math.max(0, this.offsetAt(index) - this.groupHeightAt(index));
  }

  private rowBottomAt(index: number): number {
    return finiteAdd(this.offsetAt(index), this.rowHeightAt(index));
  }

  private entryTopAt(index: number): number {
    return this.groupTopAt(index);
  }

  /** First item index whose bottom edge is at/after `offset`. */
  private findIndexAtOrAfter(offset: number): number {
    let lo = 0;
    let hi = this.itemCount - 1;
    while (lo < hi) {
      const mid = lo + Math.floor((hi - lo) / 2);
      if (this.rowBottomAt(mid) <= offset) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /** Last item index whose top edge is at/before `offset`. */
  private findIndexAtOrBefore(offset: number): number {
    let lo = 0;
    let hi = this.itemCount - 1;
    while (lo < hi) {
      const mid = lo + Math.ceil((hi - lo) / 2);
      if (this.entryTopAt(mid) < offset) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  /**
   * Row `index`'s pixel top in this list's own scroll-coordinate space — the exact value the row is
   * positioned at (`transform: translateY(...)`), and therefore directly comparable with
   * `scrollContainer.scrollTop`. `index` is clamped to `0…count`, so
   * `offsetForIndex(count)` is the total content height (`[part="spacer"]`'s height) and an
   * empty list always answers `0`.
   *
   * In `row-height="auto"` mode an unmeasured row contributes a fixed estimate. A real group marker
   * likewise contributes a bounded estimate until its own `ResizeObserver` measurement arrives.
   * Values converge as those measurements land; fixed numeric `row-height` makes row sizes exact
   * immediately, while any group-marker sizes still converge independently. This reflects the most
   * recent render, so `await el.updateComplete` after assigning `items` or `source` before querying.
   */
  offsetForIndex(index: number): number {
    const clamped = Math.min(
      this.itemCount,
      Math.max(0, Math.trunc(index) || 0)
    );
    return this.offsetAt(clamped);
  }

  /**
   * The index of the row whose box contains `px`, expressed in the same scroll-coordinate space
   * `offsetForIndex()` returns — so `indexAtOffset(offsetForIndex(i))` round-trips to `i`, and
   * `indexAtOffset(scrollContainer.scrollTop)` is the row at the top of the viewport. Clamped: a
   * negative offset resolves to `0` and an offset past the end of the content to the last row.
   * Returns `-1` when the effective source is empty. Same `row-height="auto"` estimate caveat as
   * `offsetForIndex()`.
   */
  indexAtOffset(px: number): number {
    const n = this.itemCount;
    if (n === 0) return -1;
    if (!Number.isFinite(px)) return px > 0 ? n - 1 : 0;
    return Math.min(n - 1, Math.max(0, this.findIndexAtOrAfter(px)));
  }

  private computeRange(): void {
    const n = this.itemCount;
    if (n === 0) {
      this.visibleStart = 0;
      this.visibleEnd = -1;
      this.renderStart = 0;
      this.renderEnd = -1;
      return;
    }
    if (this.viewportHeight <= 0) {
      if (!this.renderUnmeasuredWindow) {
        this.visibleStart = 0;
        this.visibleEnd = -1;
        this.renderStart = 0;
        this.renderEnd = -1;
        return;
      }
      // Before the browser can measure the viewport (including SSR), serialize one deterministic
      // overscanned window instead of a false empty list. This keeps content reachable with no JS
      // while preserving the library's bounded-DOM guarantee for arbitrarily large collections.
      this.visibleStart = 0;
      this.visibleEnd = 0;
      this.renderStart = 0;
      this.renderEnd = Math.min(n - 1, normalizeOverscan(this.overscan));
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
    const base = this.scrollContainer;
    const ownerDocument = this.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    if (!base || !this.isConnected || !ownerWindow) return;
    this.containerResizeObserver?.disconnect();
    this.detachContainerListeners();
    const generation = this.ownerRealmGeneration;
    const ResizeObserverCtor = ownerWindow.ResizeObserver;
    if (ResizeObserverCtor) {
      const observer = new ResizeObserverCtor((entries) => {
        if (
          this.containerResizeObserver !== observer ||
          this.scrollListenerTarget !== base ||
          !this.isCurrentOwnerWork(ownerDocument, generation)
        ) return;
        this.beginResizeDelivery();
        const entry = entries[0];
        if (!entry) return;
        this.viewportHeight =
          entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
      });
      this.containerResizeObserver = observer;
      observer.observe(base);
    } else {
      this.containerResizeObserver = undefined;
    }
    base.addEventListener('scroll', this.onScroll, { passive: true });
    base.addEventListener('wheel', this.onUserScrollIntent, { passive: true });
    base.addEventListener('pointerdown', this.onUserScrollIntent, { passive: true });
    base.addEventListener('touchstart', this.onUserScrollIntent, { passive: true });
    base.addEventListener('keydown', this.onUserScrollIntent);
    this.scrollListenerTarget = base;
    // Queue a one-time read as a fast path for browsers that delay the first
    // ResizeObserver callback. It runs after firstUpdated() returns, so these
    // reactive writes do not schedule an update from inside Lit's lifecycle
    // callback; the observer remains responsible for later measurements.
    ownerWindow.queueMicrotask(() => {
      if (
        this.scrollListenerTarget !== base ||
        this.scrollContainer !== base ||
        !this.isCurrentOwnerWork(ownerDocument, generation)
      ) return;
      const viewportHeight = base.clientHeight;
      const scrollTop = base.scrollTop;
      if (this.viewportHeight !== viewportHeight)
        this.viewportHeight = viewportHeight;
      if (this.containerScrollTop !== scrollTop)
        this.containerScrollTop = scrollTop;
    });
  }

  private detachContainerListeners(): void {
    const target = this.scrollListenerTarget;
    if (!target) return;
    target.removeEventListener('scroll', this.onScroll);
    target.removeEventListener('wheel', this.onUserScrollIntent);
    target.removeEventListener('pointerdown', this.onUserScrollIntent);
    target.removeEventListener('touchstart', this.onUserScrollIntent);
    target.removeEventListener('keydown', this.onUserScrollIntent);
  }

  private onUserScrollIntent = (event: Event): void => {
    if (event instanceof KeyboardEvent) {
      const scrollKeys = new Set([
        'ArrowUp',
        'ArrowDown',
        'PageUp',
        'PageDown',
        'Home',
        'End',
        ' ',
      ]);
      if (!scrollKeys.has(event.key)) return;
    }
    this.pendingScrollCorrection = undefined;
  };

  private onScroll = (e: Event): void => {
    this.pendingScrollTop = (e.currentTarget as HTMLElement).scrollTop;
    if (this.scrollRafId !== undefined) return;
    // Coalesce to one recompute per animation frame -- native `scroll`
    // events can fire far faster than that under a fast trackpad/touch
    // fling, and each recompute is a full Lit update. `lr-virtual-scroll` is emitted
    // from this same tick rather than a second rAF of its own, so a consumer
    // driving scroll-linked layout gets exactly one notification per frame,
    // already in sync with the range recompute.
    const ownerDocument = this.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    if (!ownerWindow || !this.isConnected) return;
    const generation = this.ownerRealmGeneration;
    const handle = ownerWindow.requestAnimationFrame(() => {
      if (
        this.scrollRafId !== handle ||
        this.scrollRafOwner !== ownerWindow ||
        this.scrollRafDocument !== ownerDocument ||
        !this.isCurrentOwnerWork(ownerDocument, generation)
      ) return;
      this.scrollRafId = undefined;
      this.scrollRafOwner = undefined;
      this.scrollRafDocument = undefined;
      if (this.pendingScrollTop !== null) {
        const scrollTop = this.pendingScrollTop;
        this.pendingScrollTop = null;
        const moved = this.containerScrollTop !== scrollTop;
        this.containerScrollTop = scrollTop;
        if (moved) {
          this.emit('lr-virtual-scroll', {
            scrollTop,
            viewportHeight: this.viewportHeight,
          });
        }
      }
    });
    this.scrollRafId = handle;
    this.scrollRafOwner = ownerWindow;
    this.scrollRafDocument = ownerDocument;
  };

  private onRowsResized = (entries: ResizeObserverEntry[]): void => {
    this.beginResizeDelivery();
    if (this.fixedRowHeight != null) return;
    const base = this.scrollContainer;
    const oldScrollTop = base?.scrollTop ?? this.containerScrollTop;
    let scrollAdjustment = 0;
    let changed = false;
    for (const entry of entries) {
      const row = entry.target as HTMLElement;
      const key = this.observedRowKeys.get(row);
      const index = this.observedRowIndices.get(row);
      if (key === undefined || index === undefined) continue;
      const height =
        entry.borderBoxSize?.[0]?.blockSize ??
        entry.target.getBoundingClientRect().height;
      const prev = this.measuredHeights.get(key);
      // A sub-pixel-only difference (common with fractional layout/zoom)
      // isn't worth a full offsets rebuild + re-render.
      if (prev === undefined || Math.abs(prev - height) > 0.5) {
        const oldBottom = this.rowBottomAt(index);
        this.measuredHeights.set(key, height);
        this.measuredIndices.set(key, index);
        // Keep the first visible row anchored while a row fully above it
        // changes size. Otherwise auto-height measurement makes the viewport
        // jump as soon as an earlier row is laid out.
        const oldHeight = prev ?? DEFAULT_ROW_ESTIMATE_PX;
        if (oldBottom <= oldScrollTop)
          scrollAdjustment += height - oldHeight;
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
      this.measurementGeneration += 1;
      this.requestUpdate();
    }
  };

  private onGroupsResized = (entries: ResizeObserverEntry[]): void => {
    this.beginResizeDelivery();
    const base = this.scrollContainer;
    const oldScrollTop = base?.scrollTop ?? this.containerScrollTop;
    let scrollAdjustment = 0;
    let changed = false;
    for (const entry of entries) {
      const marker = entry.target as HTMLElement;
      const index = this.observedGroupIndices.get(marker);
      if (index === undefined || !this.normalizedGroupByIndex.has(index)) continue;
      const height =
        entry.borderBoxSize?.[0]?.blockSize ??
        entry.target.getBoundingClientRect().height;
      if (!Number.isFinite(height) || height < 0) continue;
      const previous = this.measuredGroupHeights.get(index) ?? DEFAULT_GROUP_ESTIMATE_PX;
      if (Math.abs(previous - height) <= 0.5) continue;
      const oldRowTop = this.offsetAt(index);
      this.measuredGroupHeights.set(index, height);
      if (oldRowTop <= oldScrollTop) scrollAdjustment += height - previous;
      changed = true;
    }
    if (!changed) return;
    if (base && scrollAdjustment !== 0) {
      const nextScrollTop = Math.max(0, oldScrollTop + scrollAdjustment);
      base.scrollTop = nextScrollTop;
      this.containerScrollTop = nextScrollTop;
      this.pendingScrollTop = null;
    }
    this.offsetsDirty = true;
    this.measurementGeneration += 1;
    this.requestUpdate();
  };

  /**
   * Marks the rest of this frame as "inside a resize-observation delivery", and schedules the
   * flush that ends it. Called from every one of this component's `ResizeObserver` callbacks,
   * because each of them writes reactive state (`measuredHeights` + `requestUpdate()`,
   * `viewportHeight`, `stickyHeight`) and so can re-render the list -- and a re-render can move the
   * window.
   *
   * Re-rendering from inside a resize callback is inherent to `row-height="auto"` and is fine;
   * calling `observe()` from inside one is not. A brand-new observation is always active, and the
   * browser has already broadcast that DOM depth for this frame, so it is recorded as a *skipped*
   * observation and the loop ends by dispatching an uncaught `ErrorEvent` reading "ResizeObserver
   * loop completed with undelivered notifications". Nothing is actually wrong -- but the error is
   * uncaught, so it lands on whatever is running at the time, which is why it showed up as
   * unattributable flake in this component's *consumers* rather than here.
   *
   * Holding just those `observe()` calls until the next frame is the whole fix. The offsets
   * rebuild, the re-render, and the scroll-anchor correction all still happen synchronously, so
   * what gets painted is unchanged; only the moment the *newly windowed* rows start being measured
   * moves by a frame, during which they render at the same `DEFAULT_ROW_ESTIMATE_PX` they already
   * would have.
   */
  private beginResizeDelivery(): void {
    this.inResizeDelivery = true;
    if (this.rowObserveRafId !== undefined) return;
    const ownerDocument = this.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    if (!ownerWindow || !this.isConnected) {
      this.inResizeDelivery = false;
      return;
    }
    const generation = this.ownerRealmGeneration;
    const handle = ownerWindow.requestAnimationFrame(() => {
      if (
        this.rowObserveRafId !== handle ||
        this.rowObserveRafOwner !== ownerWindow ||
        this.rowObserveRafDocument !== ownerDocument ||
        !this.isCurrentOwnerWork(ownerDocument, generation)
      ) return;
      this.rowObserveRafId = undefined;
      this.rowObserveRafOwner = undefined;
      this.rowObserveRafDocument = undefined;
      this.inResizeDelivery = false;
      const ro = this.rowResizeObserver;
      for (const [identity, el] of this.deferredRowObservations) {
        // Defensive: syncRowObservers() already keeps this map a subset of observedRows.
        if (ro && this.observedRows.get(identity) === el) ro.observe(el);
      }
      this.deferredRowObservations.clear();
      const groupObserver = this.groupResizeObserver;
      for (const [index, el] of this.deferredGroupObservations) {
        if (groupObserver && this.observedGroups.get(index) === el)
          groupObserver.observe(el);
      }
      this.deferredGroupObservations.clear();
    });
    this.rowObserveRafId = handle;
    this.rowObserveRafOwner = ownerWindow;
    this.rowObserveRafDocument = ownerDocument;
  }

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
      this.deferredRowObservations.clear();
      return;
    }
    const current = new Map<string, HTMLElement>();
    this.renderRoot
      .querySelectorAll<HTMLElement>('[part="row"]')
      .forEach((el) => {
        const index = Number(el.getAttribute('data-row-index'));
        if (!Number.isInteger(index) || index < 0 || index >= this.itemCount)
          return;
        const identity = this.identityAt(index);
        current.set(identity, el);
        this.observedRowKeys.set(el, identity);
        this.observedRowIndices.set(el, index);
      });
    for (const [identity, el] of this.observedRows) {
      if (current.get(identity) !== el) {
        ro.unobserve(el);
        this.observedRows.delete(identity);
        this.deferredRowObservations.delete(identity);
      }
    }
    for (const [identity, el] of current) {
      if (!this.observedRows.has(identity)) {
        this.observedRows.set(identity, el);
        // See beginResizeDelivery(): observing from inside the browser's current
        // resize-observation loop is what trips its "undelivered notifications" guard.
        if (this.inResizeDelivery) this.deferredRowObservations.set(identity, el);
        else ro.observe(el);
      }
    }
  }

  /** Watches only the real, windowed group markers; position-only anchors have no box to measure. */
  private syncGroupObservers(): void {
    const observer = this.groupResizeObserver;
    if (!observer) return;
    const current = new Map<number, HTMLElement>();
    this.renderRoot
      .querySelectorAll<HTMLElement>('[part="group"][data-group-index]')
      .forEach((marker) => {
        const index = Number(marker.dataset['groupIndex']);
        if (!Number.isInteger(index) || !this.normalizedGroupByIndex.has(index)) return;
        current.set(index, marker);
        this.observedGroupIndices.set(marker, index);
      });
    for (const [index, marker] of this.observedGroups) {
      if (current.get(index) !== marker) {
        observer.unobserve(marker);
        this.observedGroups.delete(index);
        this.deferredGroupObservations.delete(index);
      }
    }
    for (const [index, marker] of current) {
      if (this.observedGroups.has(index)) continue;
      this.observedGroups.set(index, marker);
      if (this.inResizeDelivery) this.deferredGroupObservations.set(index, marker);
      else observer.observe(marker);
    }
  }

  /** How much of the viewport's top edge the sticky overlay covers. `0` whenever there is no sticky
   *  layer at all, which is what keeps every scroll path byte-identical to its pre-sticky behavior.
   *  Deliberately *not* conditioned on a group being pinned right now: a scroll target must not
   *  depend on whether the band happens to be showing at the moment the scroll is requested. */
  private get stickyInset(): number {
    return this.renderStickyGroup ? this.stickyHeight : 0;
  }

  private scrollActiveIntoView(): void {
    const index = this.activeIndex;
    if (index < 0) return;
    const behavior = prefersReducedMotion(this.ownerDocument.defaultView) ? 'auto' : 'smooth';
    if (!this.performScrollTo(index, 'auto', behavior)) return;
    this.beginPendingScrollCorrection(index, 'auto', behavior, this.activeItemId);
  }

  /**
   * Scrolls row `index` into view. `align` (default `'auto'`) chooses `'start'` (row's top edge
   * flush with the viewport top), `'end'` (row's bottom edge flush with the viewport bottom), or
   * `'auto'` (the same minimal-distance scroll `scrollActiveIntoView()` already uses for
   * `active-item-id` -- no scroll at all when the row is already fully visible). `behavior` (default
   * `'smooth'`) is forced to `'auto'` under `prefers-reduced-motion: reduce` regardless of what's
   * passed. `index` is clamped to `0…count-1`; a call against an empty source is a no-op.
   *
   * Estimate-based geometry is corrected as measurements arrive, including changes to rows before
   * the target and to real group markers. The transaction is bound to the target identity, source,
   * and key function, and is canceled by replacement data, a new target, manual scroll intent, or
   * disconnect, so a late observation can never drag a newer view back to a stale row.
   */
  scrollToIndex(
    index: number,
    options?: { align?: 'start' | 'end' | 'auto'; behavior?: 'auto' | 'smooth' }
  ): void {
    const n = this.itemCount;
    if (n === 0) return;
    // Math.trunc(NaN) is NaN and both Math.min/Math.max propagate it, so a range-only clamp
    // would send NaN into performScrollTo() -- scrolling the list to the top and parking an
    // unresolvable pending correction. finiteInteger() is the same normalization the sibling
    // position APIs (offsetForIndex/indexAtOffset) already apply.
    const clamped = finiteInteger(index, 0, 0, n - 1);
    const align = options?.align ?? 'auto';
    const behavior: 'auto' | 'smooth' = prefersReducedMotion(this.ownerDocument.defaultView)
      ? 'auto'
      : options?.behavior ?? 'smooth';
    if (this.performScrollTo(clamped, align, behavior))
      this.beginPendingScrollCorrection(clamped, align, behavior);
    else this.pendingScrollCorrection = undefined;
  }

  private hasUnmeasuredGroupThrough(index: number): boolean {
    return this.normalizedGroups.some(
      (group) =>
        group.startIndex <= index &&
        group.label !== '' &&
        !this.measuredGroupHeights.has(group.startIndex)
    );
  }

  private beginPendingScrollCorrection(
    index: number,
    align: 'start' | 'end' | 'auto',
    behavior: 'auto' | 'smooth',
    activeItemId?: VirtualListKey | ''
  ): void {
    if (this.fixedRowHeight != null && !this.hasUnmeasuredGroupThrough(index)) {
      this.pendingScrollCorrection = undefined;
      return;
    }
    this.pendingScrollCorrection = {
      identity: this.identityAt(index),
      index,
      align,
      behavior,
      source: this.effectiveSource,
      keyFunction: this.keyFunction,
      activeItemId: activeItemId === '' ? undefined : activeItemId,
      lastMeasurementGeneration: this.measurementGeneration,
    };
  }

  private performScrollTo(
    index: number,
    align: 'start' | 'end' | 'auto',
    behavior: 'auto' | 'smooth'
  ): boolean {
    const base = this.scrollContainer;
    if (!base) return false;
    const inset = this.stickyInset;
    const top = this.offsetAt(index);
    const bottom = this.rowBottomAt(index);
    const viewTop = base.scrollTop;
    const viewBottom = viewTop + base.clientHeight;
    let target: number | null = null;
    // Only the top-edge alignments need the sticky inset -- `'end'` puts the row's *bottom* edge at
    // the viewport bottom, which the band never covers.
    if (align === 'start') target = top - inset;
    else if (align === 'end') target = bottom - base.clientHeight;
    else if (top - inset < viewTop) target = top - inset;
    else if (bottom > viewBottom) target = bottom - base.clientHeight;
    if (target === null) return false;
    base.scrollTo({ top: Math.max(0, target), behavior });
    return true;
  }

  private maybeCorrectPendingScroll(): void {
    const pending = this.pendingScrollCorrection;
    if (!pending || pending.lastMeasurementGeneration >= this.measurementGeneration) return;
    if (
      pending.source !== this.effectiveSource ||
      pending.keyFunction !== this.keyFunction ||
      (pending.activeItemId !== undefined &&
        !Object.is(pending.activeItemId, this.activeItemId))
    ) {
      this.pendingScrollCorrection = undefined;
      return;
    }
    const index = pending.activeItemId !== undefined
      ? this.activeIndex
      : isIndexedSource(this.effectiveSource)
        ? pending.index
        : this.rowIdentities.indexOf(pending.identity);
    if (
      index < 0 ||
      index >= this.itemCount ||
      this.identityAt(index) !== pending.identity
    ) {
      this.pendingScrollCorrection = undefined;
      return;
    }
    this.performScrollTo(index, pending.align, pending.behavior);
    pending.index = index;
    pending.lastMeasurementGeneration = this.measurementGeneration;
    if (
      (this.fixedRowHeight != null || this.measuredHeights.has(pending.identity)) &&
      !this.hasUnmeasuredGroupThrough(index)
    ) this.pendingScrollCorrection = undefined;
  }

  private emitRangeChangeIfNeeded(): void {
    if (this.visibleEnd < this.visibleStart) {
      // Empty ranges are not published, but the next populated range must not
      // compare equal to the range from before this empty transition.
      this.lastEmittedStart = -1;
      this.lastEmittedEnd = -1;
      return;
    }
    if (
      this.visibleStart === this.lastEmittedStart &&
      this.visibleEnd === this.lastEmittedEnd
    )
      return;
    this.lastEmittedStart = this.visibleStart;
    this.lastEmittedEnd = this.visibleEnd;
    this.emit('lr-visible-range-change', {
      start: this.visibleStart,
      end: this.visibleEnd,
    });
  }

  private maybeFireLoadMore(): void {
    const n = this.itemCount;
    const nearBottom = n > 0 && this.visibleEnd >= n - 1;
    if (!nearBottom) {
      this.loadMoreArmed = true;
      return;
    }
    if (!this.hasMore || this.loading || !this.loadMoreArmed) return;
    this.loadMoreArmed = false;
    this.emit('lr-load-more');
  }

  private renderRow(
    item: unknown,
    index: number,
    total: number,
    activeIndex: number
  ): TemplateResult {
    const key = this.keyOf(item, index);
    const top = this.offsetAt(index);
    const isActive = index === activeIndex;
    const isRowMode = this.itemRole === 'row';
    return html`
      <div
        part="row"
        role=${isRowMode ? 'row' : 'listitem'}
        data-row-key=${domKeyToken(key)}
        data-row-index=${index}
        aria-setsize=${isRowMode ? nothing : total}
        aria-posinset=${isRowMode ? nothing : index + 1}
        aria-rowindex=${isRowMode ? this.computedAriaRowIndex(index) : nothing}
        aria-current=${isActive ? 'true' : 'false'}
        style=${styleMap({ transform: `translateY(${top}px)` })}
      >
        ${this.renderItem(item, index)}
      </div>
    `;
  }

  /** Normalizes group definitions only when their inputs change. */
  private recomputeGroups(): void {
    const seen = new Set<number>();
    this.normalizedGroups = (this.groups ?? [])
      .filter((group) => {
        const index = group.startIndex;
        if (
          !Number.isInteger(index) ||
          index < 0 ||
          index >= this.itemCount ||
          seen.has(index)
        )
          return false;
        seen.add(index);
        return true;
      })
      .sort((a, b) => a.startIndex - b.startIndex);
    this.normalizedGroupByIndex.clear();
    for (const group of this.normalizedGroups)
      this.normalizedGroupByIndex.set(group.startIndex, group);
  }

  private renderGroups(): TemplateResult[] {
    return (
      this.normalizedGroups
        // A positioned marker outside the overscanned row window cannot be seen. Windowing it keeps
        // one-group-per-row catalogs bounded by the same DOM ceiling as the rows themselves.
        .filter(
          (group) =>
            group.startIndex >= this.renderStart &&
            group.startIndex <= this.renderEnd
        )
        // An explicitly empty label means "anchor only" -- the host renders its own header for this
        // group (typically as a real row), so a marker here would duplicate it.
        .filter((group) => group.label !== '')
        .map(
          (group) => html`
            <div
              part="group"
              data-group-index=${group.startIndex}
              style=${styleMap({
                transform: `translateY(${this.groupTopAt(group.startIndex)}px)`,
              })}
            >
              ${group.label ??
              (typeof group.key === 'number'
                ? getNumberFormat(this.effectiveLocale).format(group.key)
                : group.key)}
            </div>
          `
        )
    );
  }

  /** The group the viewport is currently inside -- the last one whose first row's offset is at or
   *  above the current scroll position -- plus how far the incoming group's header has already
   *  pushed it out of the band. `null` when there are no groups to pin at all.
   *
   * Scrolled *above* the first group there is nothing to pin, but the band is still rendered
   * (`active: false`, visually hidden) rather than dropped: its measured height is what the scroll
   * inset is sized from, and a band that only exists once it has first been shown would let the
   * very first `active-item-id`/`scrollToIndex` jump park its target underneath it. */
  private currentStickyGroup(): {
    group: LyraVirtualListGroup;
    shift: number;
    active: boolean;
  } | null {
    const groups = this.normalizedGroups;
    if (groups.length === 0) return null;
    const scrollTop = this.containerScrollTop;
    let low = 0;
    let high = groups.length - 1;
    let current = -1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      if (this.groupTopAt(groups[middle]!.startIndex) <= scrollTop) {
        current = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    if (current < 0) return { group: groups[0]!, shift: 0, active: false }; // safe: groups.length === 0 returned above
    const next = groups[current + 1];
    let shift = 0;
    if (next && this.stickyHeight > 0) {
      // Distance from the top of the band to the next group's header row. Once that is less than
      // the band's own height, the incoming header pushes the pinned one out by the overlap
      // instead of the two swapping abruptly at the boundary.
      const distance = this.groupTopAt(next.startIndex) - scrollTop;
      if (distance < this.stickyHeight)
        shift = Math.min(0, distance - this.stickyHeight);
    }
    return { group: groups[current]!, shift, active: true }; // safe: 0 <= current < groups.length (set in the loop above)
  }

  private renderStickyLayer(): TemplateResult | typeof nothing {
    const render = this.renderStickyGroup;
    if (!render) return nothing;
    const state = this.currentStickyGroup();
    if (!state) return nothing;
    return html`
      <div
        part="sticky-group"
        aria-hidden="true"
        inert
        ?data-inactive=${!state.active}
        style=${state.shift !== 0
          ? `transform:translateY(${state.shift}px)`
          : nothing}
      >
        ${render(state.group)}
      </div>
    `;
  }

  /** Keeps the overlay's measured height current. Focus/activation ownership is declarative through
   * the overlay's `inert` attribute, so no caller-rendered subtree traversal is needed here. */
  private syncStickyOverlay(): void {
    const overlay = this.renderRoot.querySelector<HTMLElement>(
      '[part="sticky-group"]'
    );
    if (overlay !== this.observedSticky) {
      if (this.observedSticky)
        this.stickyResizeObserver?.unobserve(this.observedSticky);
      this.observedSticky = overlay ?? undefined;
      if (overlay) this.stickyResizeObserver?.observe(overlay);
    }
  }

  private onStickyResized = (entries: ResizeObserverEntry[]): void => {
    this.beginResizeDelivery();
    const entry = entries[0];
    if (!entry) return;
    const height =
      entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
    if (Math.abs(this.stickyHeight - height) > 0.5) this.stickyHeight = height;
  };

  override render(): TemplateResult {
    const n = this.itemCount;
    const totalHeight = this.offsetAt(n);
    const windowed: { item: unknown; index: number }[] = [];
    for (let i = this.renderStart; i <= this.renderEnd; i++) {
      windowed.push({ item: this.itemAt(i), index: i });
    }
    const isRowMode = this.itemRole === 'row';
    // Native keyboard/anchor scrolling gets the same treatment as the programmatic paths, from one
    // declaration -- and the attribute is absent entirely while there is no sticky layer.
    const stickyInset = this.stickyInset;
    const activeIndex = this.activeIndex;

    return html`
      <div
        part="base"
        role=${isRowMode ? 'rowgroup' : 'list'}
        tabindex="0"
        style=${stickyInset > 0
          ? `scroll-padding-block-start:${stickyInset}px`
          : nothing}
        aria-label=${this.hasAttribute('aria-label') ? this.getAttribute('aria-label')! : nothing}
        aria-busy=${this.loading ? 'true' : 'false'}
      >
        <div
          part="spacer"
          role=${isRowMode ? 'presentation' : nothing}
          style=${styleMap({ height: `${totalHeight}px` })}
        >
          ${this.renderGroups()}
          ${repeat(
            windowed,
            (w) => this.identityAt(w.index, w.item),
            (w) => this.renderRow(w.item, w.index, n, activeIndex)
          )}
          ${this.renderStickyLayer()}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-virtual-list': LyraVirtualList;
  }
}

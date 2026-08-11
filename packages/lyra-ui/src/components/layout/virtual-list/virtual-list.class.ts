import { html, nothing, type TemplateResult, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { styleMap } from "lit/directives/style-map.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { prefersReducedMotion } from "../../../internal/motion.js";
import { finiteAdd, finiteInteger } from "../../../internal/numbers.js";
import { getNumberFormat } from "../../../internal/intl-cache.js";
import { styles } from "./virtual-list.styles.js";
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_items } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** Fallback per-row height (px) used for any row that hasn't been measured
 *  yet in `row-height="auto"` mode -- close enough to a typical single-line
 *  chat-list row that the initial scrollbar/spacer size doesn't jump wildly
 *  once real measurements arrive. Irrelevant in fixed-`row-height` mode. */
const DEFAULT_ROW_ESTIMATE_PX = 48;
/** Ordinary focusable HTML inside the sticky overlay -- see `syncStickyOverlay()`. */
const STICKY_FOCUSABLE_SELECTOR =
  'a[href], area[href], button, input, select, textarea, iframe, details, summary, [tabindex], [contenteditable]:not([contenteditable="false"])';
const DEFAULT_OVERSCAN_ROWS = 6;
/** Largest accepted overscan on either side of the visible range. This keeps
 *  an accidental huge value from defeating virtualization. */
export const MAX_OVERSCAN_ROWS = 100;

function normalizeOverscan(value: string | number | null): number {
  if (value === null) return DEFAULT_OVERSCAN_ROWS;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_OVERSCAN_ROWS;
  return Math.min(MAX_OVERSCAN_ROWS, Math.max(0, Math.floor(numeric)));
}

const overscanConverter = {
  fromAttribute(value: string | null): number {
    return normalizeOverscan(value);
  },
};

/** `lr-visible-range-changed` detail -- the current visible (non-overscanned) item index range. */
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

/** The ARIA role pairing each rendered row participates in -- see `itemRole`'s own doc for what
 *  each value maps to. */
export type VirtualListItemRole = "listitem" | "row";

type VirtualListKey = string | number;

/** A typed key is used in maps and active-row matching; this token is only for
 * DOM attributes, where every value is necessarily a string. */
function domKeyToken(key: VirtualListKey): string {
  if (typeof key === "number") {
    if (Number.isNaN(key)) return "number:NaN";
    if (Object.is(key, -0)) return "number:-0";
  }
  return `${typeof key}:${String(key)}`;
}

/** `lr-scroll` detail -- the scroll container's position and height after a coalesced scroll tick. */
export interface VirtualListScroll {
  scrollTop: number;
  viewportHeight: number;
}

export interface LyraVirtualListEventMap {
  "lr-visible-range-changed": CustomEvent<VirtualListRange>;
  "lr-load-more": CustomEvent<undefined>;
  "lr-scroll": CustomEvent<VirtualListScroll>;
}
/**
 * `<lr-virtual-list>` — a generic windowed/virtualized list host. Renders
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
 * **Narrow allocations.** Row wrappers allow their content to shrink and use
 * `overflow-wrap: anywhere` by default, so a normal long value wraps inside
 * the list rather than widening a narrow panel; its resulting height is what
 * `row-height="auto"` measures. A consumer that deliberately needs an
 * unbroken value can set `white-space: nowrap` on its own rendered content:
 * the scroll container remains horizontally scrollable for that opt-out.
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
 * `<lr-select>`'s pattern), the same way this component's `active-id`
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
 * **Grouping.** When supplied, `groups` renders a labeled group marker at the corresponding
 * `startIndex`. Markers are windowed with the rows, while normalized group metadata stays cached
 * for sticky-header lookup; one-group-per-row catalogs therefore remain bounded.
 *
 * **Sticky group headers.** `renderStickyGroup` adds a `[part="sticky-group"]` overlay pinned to the
 * top of the scroll viewport, showing the `groups` entry the viewport is currently inside; as the
 * next group's header arrives it is pushed out by the overlap rather than swapped abruptly. Unset
 * (the default) renders no overlay element at all, and the list renders exactly as it does without
 * this feature. Four properties of the overlay matter to a consumer:
 * - It is a **visual copy** of content that already exists in the list, so it is `aria-hidden` and
 *   any ordinary focusable element inside it is forced to `tabindex="-1"`: the real row keeps sole
 *   ownership of the heading semantics and of the tab order. (`inert` would express this more
 *   directly but would also block the pointer opt-in below, so it is deliberately not used; a
 *   focus-delegating custom element rendered into the overlay needs its own `tabindex="-1"`.)
 * - It is **`pointer-events: none` by default**; a consumer whose header content is interactive
 *   opts in with `lr-virtual-list::part(sticky-group) { pointer-events: auto; }`.
 * - It is **never measured as a row.** It contributes nothing to `offsets`, so a group header that
 *   is also a real row is not counted twice in `row-height="auto"` mode.
 * - Its measured height becomes a `scroll-padding-block-start` on the scroll container, so both
 *   `active-id`/`scrollToIndex` and native keyboard scrolling stop *below* the band instead of
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
 * **Programmatic scrolling.** `scrollToIndex()` is the public counterpart to `active-id`'s automatic
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
 * @customElement lr-virtual-list
 * @event lr-load-more - Fired once per approach to the bottom of the list
 *   while `has-more` is true and `loading` is false. Deliberately does not
 *   refire on every scroll tick while still near the bottom (`loading`
 *   gates the in-flight case; scrolling back away from the bottom and
 *   returning, or `items` growing enough to move the window away from the
 *   end, re-arms it) — a consumer wanting an automatic retry after a failed
 *   fetch should surface its own retry affordance rather than relying on
 *   this firing again unprompted.
 * @event lr-visible-range-changed - `detail: { start, end }` (see
 *   `VirtualListRange`) — the current visible (non-overscanned) item index
 *   range, fired only when it actually changes.
 * @event lr-scroll - `detail: { scrollTop, viewportHeight }` (see
 *   `VirtualListScroll`) — the scroll container moved. Emitted from the same
 *   `requestAnimationFrame` tick that already coalesces native `scroll`
 *   events, so a fling that fires dozens of native events produces at most one
 *   of these per frame, and none at all when the position did not actually
 *   change. Unlike `lr-visible-range-changed` this reports *sub-row*
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
 *   where there is no group to pin). `aria-hidden` and
 *   `pointer-events: none` by default — style this part with `pointer-events: auto` to make copied
 *   interactive content clickable again.
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
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    items: LYRA_DEFAULT_items,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** The full (non-windowed) item collection. */
  @property({ attribute: false }) items: unknown[] = [];

  /** Renders one row's content — typically returns a `lit-html` `TemplateResult`. */
  @property({ attribute: false }) renderItem: (
    item: unknown,
    index: number
  ) => unknown = () => nothing;

  /** Derives a row's stable `repeat()` key. Falls back to the item's index
   *  in `items` when omitted, which is only a safe identity while `items`
   *  never reorders/inserts/removes — provide this whenever it can, or
   *  scroll position and any per-row DOM state can attach to the wrong row
   *  across a mutation (same caveat as `<lr-table>`'s `rowKey`). Duplicate keys remain distinct
   *  by occurrence for rendering and measurement; `activeId` targets the first occurrence. */
  @property({ attribute: false }) keyFunction?: (
    item: unknown,
    index: number
  ) => string | number;

  /** Group labels positioned at their first row's `startIndex`. Invalid or
   * duplicate indexes are ignored during rendering. An entry whose `label` is
   * the empty string renders no `[part="group"]` marker at all — it is a pure
   * position anchor, for a host that renders its own group header as an
   * ordinary row (and would otherwise get two stacked headers) but still needs
   * this component to know where each group starts, e.g. to drive
   * `renderStickyGroup`. Omitting `label` entirely still falls back to `key`. */
  @property({ attribute: false }) groups?: VirtualListGroup[];

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
    group: VirtualListGroup
  ) => unknown;

  /** `'auto'` (default) measures each row's real height via `ResizeObserver`;
   *  a numeric string fixes every row to that many pixels. */
  @property({ attribute: "row-height" }) rowHeight = "auto";

  /** `'listitem'` (default) preserves today's `role="list"`/`role="listitem"` mapping with
   *  `aria-setsize`/`aria-posinset`. `'row'` maps to `role="rowgroup"`/`role="row"` with
   *  `aria-rowindex` instead -- for a consumer composing a virtualized `role="table"` (see
   *  `<lr-dataset-viewer>`). */
  @property({ attribute: "item-role" }) itemRole: VirtualListItemRole =
    "listitem";

  /** Added to a row's 1-based index to compute `aria-rowindex` in `item-role="row"` mode (e.g. `1`
   *  when a consumer renders its own header row occupying `aria-rowindex="1"` outside this
   *  component). No effect in `'listitem'` mode. */
  @property({ type: Number, attribute: "row-index-offset" }) rowIndexOffset = 0;

  /** Extra rows rendered beyond the visible viewport on each side, to reduce
   *  blank-frame risk during fast scrolling. Normalized to a whole number in
   *  the inclusive range 0–`MAX_OVERSCAN_ROWS`; non-finite values use the
   *  default. */
  @property({ converter: overscanConverter }) overscan = DEFAULT_OVERSCAN_ROWS;

  /** When set and it matches a row's typed `keyFunction` result, that row is
   * smoothly scrolled into view whenever this changes. Attribute values are
   * strings; assign the property for a numeric key. */
  @property({ attribute: "active-id" }) activeId: VirtualListKey | "" = "";

  @property({ type: Boolean, reflect: true }) loading = false;

  /** When true, scrolling near the bottom fires `lr-load-more`. */
  @property({ type: Boolean, attribute: "has-more", reflect: true }) hasMore =
    false;

  /**
   * The real scroll container — the `[part="base"]` element, the box whose `scrollTop`/
   * `clientHeight` this component's windowing math is expressed against. `undefined` until the
   * first render (and for a never-connected element), since the element does not exist before then.
   *
   * Exposed so a host that needs the live scroll position, or needs to scroll the list itself, can
   * do it without reaching into this component's shadow root. Pair it with `lr-scroll` (change
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

  /** `rowIndexOffset` normalized to a finite integer before it's added into `renderRow()`'s
   *  `aria-rowindex` -- mirrors `normalizeOverscan()`'s own defensive normalization for `overscan`
   *  above, guarding a `NaN`/non-integer attribute value from producing a nonsensical
   *  `aria-rowindex="NaN"` for every row in `item-role="row"` mode. */
  private get safeRowIndexOffset(): number {
    return finiteInteger(this.rowIndexOffset, 0);
  }

  // Named distinctly from the inherited DOM `scrollTop` (a `HTMLElement`
  // property this class would otherwise shadow) -- this tracks the *scroll
  // container's* scrollTop, not the host element's own (the host never
  // scrolls itself; [part="base"] does).
  @state() private containerScrollTop = 0;
  @state() private viewportHeight = 0;

  /** `offsets[i]` = row `i`'s pixel top; `offsets[items.length]` = total content height. Rebuilt only when `offsetsDirty` is set -- see `willUpdate()`. */
  private offsets: number[] = [0];
  /** Occurrence-safe internal identities. Public duplicate keys remain visible as distinct rows,
   * while the first occurrence alone owns `activeId`. */
  private rowIdentities: string[] = [];
  /** Parsed `rowHeight`: a positive pixel number, or `null` for `'auto'` (measured) mode. */
  private fixedRowHeight: number | null = null;
  /** `row-height="auto"` per-row measured heights, keyed by
   *  keyFunction result. Pruned to the current `items`'
   *  live keys whenever `items` changes (see `recomputeOffsets()`), so a
   *  long-lived instance handed many wholly different `items` arrays over
   *  its life doesn't grow this map without bound. */
  private readonly measuredHeights = new Map<string, number>();
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
  /** Set by `scrollToIndex()` in `row-height="auto"` mode when the target row hasn't been measured
   *  yet -- its offset is still estimate-based, so the scroll can land short of (or past) the real
   *  target. Consumed (and cleared) by `maybeCorrectPendingScroll()` the first time that row's real
   *  height arrives, issuing exactly one corrective re-scroll -- never more than one, so a
   *  still-settling row can't cause repeated scroll jumps. Only ever fires for `align: 'end'` (and
   *  a downward-scrolling `align: 'auto'`): an offset is a function of every row *before* it, so
   *  measuring the target row itself can never change an `align: 'start'` target position -- that
   *  case has no self-correction. */
  private pendingScrollCorrection?: {
    identity: string;
    align: "start" | "end" | "auto";
    behavior: "auto" | "smooth";
  };
  private isFirstUpdate = true;

  /** The sticky overlay's measured block size, used both for the push-off overlap math and for the
   *  scroll inset that keeps a scrolled-to row from landing underneath the band. Measured by its own
   *  `ResizeObserver` -- deliberately never by `rowResizeObserver`, which would fold this *copy* of a
   *  row into `offsets` and double-count the group header's height. */
  @state() private stickyHeight = 0;

  private rowResizeObserver?: ResizeObserver;
  private containerResizeObserver?: ResizeObserver;
  private stickyResizeObserver?: ResizeObserver;
  private stickyFocusObserver?: MutationObserver;
  private observedSticky?: HTMLElement;
  private readonly observedRows = new Map<string, HTMLElement>();
  private readonly observedRowKeys = new WeakMap<HTMLElement, string>();
  private readonly observedRowIndices = new WeakMap<HTMLElement, number>();
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
  private rowObserveRafId?: number;
  private rowObserveRafOwner?: Window;
  private rowObserveRafDocument?: Document;

  /** Reference-keyed memo for `activeId`'s resolved index. `render()` re-runs on every scroll
   *  frame (`scrollTop` drives reactive state), and resolving `activeId` means scanning `items`
   *  with `keyOf` -- O(items) *per frame*, for a component whose entire purpose is large lists.
   *  The scan's inputs are only `items`, `activeId`, and `keyFunction`, none of which a scroll
   *  changes, so cache on their identities. `items` is `attribute: false` and only ever changes by
   *  reassignment, making reference equality a sound key (same rationale as `<lr-table>`'s row
   *  memo). `items` is a mutable array, so the length is keyed too: that catches an in-place
 *  insert/remove followed by a manual `requestUpdate()`. An in-place *reorder* of the same length
 *  is not detected -- the same identity caveat `keyFunction` already documents. */
  private activeIndexFor?: readonly unknown[];
  private activeIndexForLength = -1;
  private activeIndexForId: VirtualListKey | "" = "";
  private activeIndexForKeyFn?: (item: unknown, index: number) => string | number;
  private activeIndexCache = -1;

  /** `activeId`'s index in `items`, or -1. Memoized -- see `activeIndexFor`. */
  private get activeIndex(): number {
    if (this.activeId === "") return -1;
    if (
      this.activeIndexFor === this.items &&
      this.activeIndexForLength === this.items.length &&
      Object.is(this.activeIndexForId, this.activeId) &&
      this.activeIndexForKeyFn === this.keyFunction
    )
      return this.activeIndexCache;
    this.activeIndexFor = this.items;
    this.activeIndexForLength = this.items.length;
    this.activeIndexForId = this.activeId;
    this.activeIndexForKeyFn = this.keyFunction;
    this.activeIndexCache = this.items.findIndex((item, index) =>
      Object.is(this.keyOf(item, index), this.activeId)
    );
    return this.activeIndexCache;
  }
  private pendingScrollTop: number | null = null;
  /** Normalized once per `groups`/`items` assignment, then shared by marker and sticky paths. */
  private normalizedGroups: VirtualListGroup[] = [];

  override connectedCallback(): void {
    super.connectedCallback();
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
      const stickyObserver = new ResizeObserverCtor((entries) => {
        if (
          this.stickyResizeObserver !== stickyObserver ||
          !this.isCurrentOwnerWork(ownerDocument, generation)
        ) return;
        this.onStickyResized(entries);
      });
      this.rowResizeObserver = rowObserver;
      this.stickyResizeObserver = stickyObserver;
    }
    const MutationObserverCtor = ownerWindow?.MutationObserver;
    if (MutationObserverCtor) {
      const focusObserver = new MutationObserverCtor(() => {
        if (
          this.stickyFocusObserver !== focusObserver ||
          !this.isCurrentOwnerWork(ownerDocument, generation)
        ) return;
        this.onStickyContentMutated();
      });
      this.stickyFocusObserver = focusObserver;
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
      this.syncStickyOverlay();
    }
  }

  override disconnectedCallback(): void {
    this.resetOwnerRealmWork();
    super.disconnectedCallback();
  }

  adoptedCallback(): void {
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
    this.observedRows.clear();
    this.deferredRowObservations.clear();
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
    this.stickyFocusObserver?.disconnect();
    this.stickyFocusObserver = undefined;
    this.observedSticky = undefined;
    if (this.scrollRafId !== undefined) {
      this.scrollRafOwner?.cancelAnimationFrame(this.scrollRafId);
    }
    this.scrollRafId = undefined;
    this.scrollRafOwner = undefined;
    this.scrollRafDocument = undefined;
    this.pendingScrollTop = null;
    this.pendingScrollCorrection = undefined;
    this.scrollListenerTarget?.removeEventListener("scroll", this.onScroll);
    this.scrollListenerTarget = undefined;
  }

  override firstUpdated(): void {
    this.attachContainerListeners();
  }

  protected override willUpdate(changed: PropertyValues): void {
    this.isFirstUpdate = !this.hasUpdated;
    if (
      changed.has("items") ||
      changed.has("rowHeight") ||
      changed.has("keyFunction")
    ) {
      this.offsetsDirty = true;
    }
    if (changed.has("items")) {
      this.itemsChangedPendingPrune = true;
    }
    if (changed.has("items") || changed.has("groups")) {
      this.recomputeGroups();
    }
    if (changed.has("rowHeight")) {
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
    this.syncStickyOverlay();
    if (changed.has("activeId") && !this.isFirstUpdate)
      this.scrollActiveIntoView();
    this.emitRangeChangeIfNeeded();
    this.maybeFireLoadMore();
    this.maybeCorrectPendingScroll();
  }

  private parseRowHeight(value: string): number | null {
    if (value === "auto") return null;
    const n = Number(value);
    // Anything that isn't 'auto' or a positive finite number falls back to
    // auto mode rather than throwing or producing a zero/negative-height
    // row -- matches this library's generally-permissive attribute parsing.
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private keyOf(item: unknown, index: number): VirtualListKey {
    const key = this.keyFunction ? this.keyFunction(item, index) : index;
    return typeof key === "string" || typeof key === "number" ? key : index;
  }

  private rowIdentity(key: VirtualListKey, occurrence: number): string {
    const token = domKeyToken(key);
    return `${token.length}:${token}:${occurrence}`;
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
    const pruneStale =
      this.itemsChangedPendingPrune && this.fixedRowHeight == null;
    const liveKeys = pruneStale ? new Set<string>() : null;
    const occurrences = new Map<string, number>();
    const identities = new Array<string>(n);
    for (let i = 0; i < n; i++) {
      const key = this.keyOf(this.items[i], i);
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
      offsets[i + 1] = finiteAdd(offsets[i]!, h); // safe: offsets[0] set above, offsets[i] written on the prior iteration
    }
    this.offsets = offsets;
    this.rowIdentities = identities;
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
      // safe: mid < hi <= offsets.length - 2, so mid + 1 <= offsets.length - 1 is in bounds
      if (offsets[mid + 1]! <= offset) lo = mid + 1;
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
      // safe: mid <= hi <= offsets.length - 2, so mid is in bounds
      if (offsets[mid]! < offset) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  /**
   * Row `index`'s pixel top in this list's own scroll-coordinate space — the exact value the row is
   * positioned at (`transform: translateY(...)`), and therefore directly comparable with
   * `scrollContainer.scrollTop`. `index` is clamped to `0…items.length`, so
   * `offsetForIndex(items.length)` is the total content height (`[part="spacer"]`'s height) and an
   * empty list always answers `0`.
   *
   * In `row-height="auto"` mode an unmeasured row contributes a fixed per-row estimate to this
   * value, so an offset far below the rendered window stays estimate-based until every row above it
   * has been measured by the row `ResizeObserver`; it converges as those measurements land. Fixed
   * numeric `row-height` offsets are exact from the first render. Either way this reflects the most
   * recent render, so `await el.updateComplete` after assigning `items` before querying.
   */
  offsetForIndex(index: number): number {
    const clamped = Math.min(
      this.items.length,
      Math.max(0, Math.trunc(index) || 0)
    );
    return this.offsets[clamped] ?? 0;
  }

  /**
   * The index of the row whose box contains `px`, expressed in the same scroll-coordinate space
   * `offsetForIndex()` returns — so `indexAtOffset(offsetForIndex(i))` round-trips to `i`, and
   * `indexAtOffset(scrollContainer.scrollTop)` is the row at the top of the viewport. Clamped: a
   * negative offset resolves to `0` and an offset past the end of the content to the last row.
   * Returns `-1` when `items` is empty. Same `row-height="auto"` estimate caveat as
   * `offsetForIndex()`.
   */
  indexAtOffset(px: number): number {
    const n = this.items.length;
    if (n === 0) return -1;
    if (!Number.isFinite(px)) return px > 0 ? n - 1 : 0;
    return Math.min(n - 1, Math.max(0, this.findIndexAtOrAfter(px)));
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
    const base = this.scrollContainer;
    const ownerDocument = this.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    if (!base || !this.isConnected || !ownerWindow) return;
    this.containerResizeObserver?.disconnect();
    this.scrollListenerTarget?.removeEventListener("scroll", this.onScroll);
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
    base.addEventListener("scroll", this.onScroll, { passive: true });
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

  private onScroll = (e: Event): void => {
    this.pendingScrollTop = (e.currentTarget as HTMLElement).scrollTop;
    if (this.scrollRafId !== undefined) return;
    // Coalesce to one recompute per animation frame -- native `scroll`
    // events can fire far faster than that under a fast trackpad/touch
    // fling, and each recompute is a full Lit update. `lr-scroll` is emitted
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
          this.emit("lr-scroll", {
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
        this.measuredHeights.set(key, height);
        // Keep the first visible row anchored while a row fully above it
        // changes size. Otherwise auto-height measurement makes the viewport
        // jump as soon as an earlier row is laid out.
        const oldHeight = prev ?? DEFAULT_ROW_ESTIMATE_PX;
        // safe: index is a rendered row's item index, so index + 1 is within offsets (length items.length + 1)
        if (this.offsets[index + 1]! <= oldScrollTop)
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
      this.requestUpdate();
    }
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
        const index = Number(el.getAttribute("data-row-index"));
        if (!Number.isInteger(index) || index < 0 || index >= this.items.length)
          return;
        const identity = this.rowIdentities[index];
        if (identity === undefined) return;
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
    const base = this.scrollContainer;
    if (!base) return;
    const inset = this.stickyInset;
    const top = this.offsets[index] ?? 0;
    const bottom = this.offsets[index + 1] ?? top;
    const viewTop = base.scrollTop;
    const viewBottom = viewTop + base.clientHeight;
    let target: number | null = null;
    // A row hidden *behind* the sticky band counts as out of view, and the scroll that reveals it
    // has to clear the band too -- otherwise `active-id` parks the row underneath it.
    if (top - inset < viewTop) target = top - inset;
    else if (bottom > viewBottom) target = bottom - base.clientHeight;
    if (target === null) return;
    base.scrollTo({
      top: Math.max(0, target),
      behavior: prefersReducedMotion(this.ownerDocument.defaultView) ? "auto" : "smooth",
    });
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
   * for `align: 'end'` (and a downward-scrolling `align: 'auto'`), once the target row's real height
   * actually arrives, exactly one corrective re-scroll is issued so the final resting position is
   * accurate, without oscillating on every subsequent measurement. `align: 'start'` has no
   * self-correction: a row's offset depends only on the rows before it, so measuring the target
   * row's own height can never move that target position -- an `align: 'start'` jump against
   * unmeasured intermediate rows may land short and stay there.
   */
  scrollToIndex(
    index: number,
    options?: { align?: "start" | "end" | "auto"; behavior?: "auto" | "smooth" }
  ): void {
    const n = this.items.length;
    if (n === 0) return;
    // Math.trunc(NaN) is NaN and both Math.min/Math.max propagate it, so a range-only clamp
    // would send NaN into performScrollTo() -- scrolling the list to the top and parking an
    // unresolvable pending correction. finiteInteger() is the same normalization the sibling
    // position APIs (offsetForIndex/indexAtOffset) already apply.
    const clamped = finiteInteger(index, 0, 0, n - 1);
    const align = options?.align ?? "auto";
    const behavior: "auto" | "smooth" = prefersReducedMotion(this.ownerDocument.defaultView)
      ? "auto"
      : options?.behavior ?? "smooth";
    this.performScrollTo(clamped, align, behavior);
    if (this.fixedRowHeight == null) {
      const identity = this.rowIdentities[clamped]!;
      this.pendingScrollCorrection = this.measuredHeights.has(identity)
        ? undefined
        : { identity, align, behavior };
    } else {
      // Fixed row-height offsets are exact from the first render -- no
      // measurement to wait for, so no correction is ever needed.
      this.pendingScrollCorrection = undefined;
    }
  }

  private performScrollTo(
    index: number,
    align: "start" | "end" | "auto",
    behavior: "auto" | "smooth"
  ): void {
    const base = this.scrollContainer;
    if (!base) return;
    const inset = this.stickyInset;
    const top = this.offsets[index] ?? 0;
    const bottom = this.offsets[index + 1] ?? top;
    const viewTop = base.scrollTop;
    const viewBottom = viewTop + base.clientHeight;
    let target: number | null = null;
    // Only the top-edge alignments need the sticky inset -- `'end'` puts the row's *bottom* edge at
    // the viewport bottom, which the band never covers.
    if (align === "start") target = top - inset;
    else if (align === "end") target = bottom - base.clientHeight;
    else if (top - inset < viewTop) target = top - inset;
    else if (bottom > viewBottom) target = bottom - base.clientHeight;
    if (target === null) return;
    base.scrollTo({ top: Math.max(0, target), behavior });
  }

  private maybeCorrectPendingScroll(): void {
    const pending = this.pendingScrollCorrection;
    if (!pending || !this.measuredHeights.has(pending.identity)) return;
    this.pendingScrollCorrection = undefined;
    const index = this.rowIdentities.indexOf(pending.identity);
    if (index < 0) return;
    this.performScrollTo(index, pending.align, pending.behavior);
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
    this.emit("lr-visible-range-changed", {
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
    this.emit("lr-load-more");
  }

  private renderRow(
    item: unknown,
    index: number,
    total: number,
    activeIndex: number
  ): TemplateResult {
    const key = this.keyOf(item, index);
    const top = this.offsets[index] ?? 0;
    const isActive = index === activeIndex;
    const isRowMode = this.itemRole === "row";
    return html`
      <div
        part="row"
        role=${isRowMode ? "row" : "listitem"}
        data-row-key=${domKeyToken(key)}
        data-row-index=${index}
        aria-setsize=${isRowMode ? nothing : total}
        aria-posinset=${isRowMode ? nothing : index + 1}
        aria-rowindex=${isRowMode
          ? index + 1 + this.safeRowIndexOffset
          : nothing}
        aria-current=${isActive ? "true" : "false"}
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
          index >= this.items.length ||
          seen.has(index)
        )
          return false;
        seen.add(index);
        return true;
      })
      .sort((a, b) => a.startIndex - b.startIndex);
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
        .filter((group) => group.label !== "")
        .map(
          (group) => html`
            <div
              part="group"
              style=${styleMap({
                transform: `translateY(${
                  this.offsets[group.startIndex] ?? 0
                }px)`,
              })}
            >
              ${group.label ??
              (typeof group.key === "number"
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
   * very first `active-id`/`scrollToIndex` jump park its target underneath it. */
  private currentStickyGroup(): {
    group: VirtualListGroup;
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
      if (this.offsetForIndex(groups[middle]!.startIndex) <= scrollTop) {
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
      const distance = this.offsetForIndex(next.startIndex) - scrollTop;
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
        ?data-inactive=${!state.active}
        style=${state.shift !== 0
          ? `transform:translateY(${state.shift}px)`
          : nothing}
      >
        ${render(state.group)}
      </div>
    `;
  }

  /** Removes sequential focus stops from consumer-rendered sticky content, including descendants
   *  of open custom-element shadow roots, and observes every traversed tree so a child's later
   *  render cannot introduce a new stop into the aria-hidden copy. */
  private suppressStickyFocus(root: ParentNode): void {
    root
      .querySelectorAll<HTMLElement>(STICKY_FOCUSABLE_SELECTOR)
      .forEach((node) => {
        if (node.getAttribute("tabindex") !== "-1")
          node.setAttribute("tabindex", "-1");
      });
    root.querySelectorAll<HTMLElement>("*").forEach((node) => {
      if (node.shadowRoot) this.suppressStickyFocus(node.shadowRoot);
    });
    this.stickyFocusObserver?.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["tabindex", "href", "contenteditable", "disabled"],
    });
  }

  /** Rebuilds the observed-tree set as well as suppressing current controls. A single observer can
   *  watch the overlay and each open descendant shadow root, but cannot unobserve just a shadow
   *  root that was removed, so rebuilding keeps detached consumer trees out of the watch set. */
  private syncStickyFocusProtection(overlay: HTMLElement): void {
    this.stickyFocusObserver?.disconnect();
    this.suppressStickyFocus(overlay);
  }

  private onStickyContentMutated = (): void => {
    if (this.observedSticky)
      this.syncStickyFocusProtection(this.observedSticky);
  };

  /** Keeps the overlay's measured height current, and keeps it out of the tab order. Both are
   *  deliberately done here rather than in the template: the height is only knowable after layout,
   *  and the overlay's contents come from the consumer's own callback. */
  private syncStickyOverlay(): void {
    const overlay = this.renderRoot.querySelector<HTMLElement>(
      '[part="sticky-group"]'
    );
    if (overlay !== this.observedSticky) {
      if (this.observedSticky)
        this.stickyResizeObserver?.unobserve(this.observedSticky);
      this.stickyFocusObserver?.disconnect();
      this.observedSticky = overlay ?? undefined;
      if (overlay) this.stickyResizeObserver?.observe(overlay);
    }
    if (!overlay) return;
    // The overlay duplicates a row that already exists in the list, so it is `aria-hidden` -- which
    // makes any focusable element inside it a tab stop with no accessible name. `inert` would solve
    // that too, but it would also block the documented `pointer-events: auto` opt-in, so the tab
    // stop is removed directly instead. Open custom-element shadow trees are traversed as well,
    // because their native controls otherwise remain invisible sequential-focus stops.
    this.syncStickyFocusProtection(overlay);
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
    const n = this.items.length;
    const totalHeight = this.offsets[n] ?? 0;
    const windowed: { item: unknown; index: number }[] = [];
    for (let i = this.renderStart; i <= this.renderEnd; i++) {
      windowed.push({ item: this.items[i], index: i });
    }
    const isRowMode = this.itemRole === "row";
    // Native keyboard/anchor scrolling gets the same treatment as the programmatic paths, from one
    // declaration -- and the attribute is absent entirely while there is no sticky layer.
    const stickyInset = this.stickyInset;
    const activeIndex = this.activeIndex;

    return html`
      <div
        part="base"
        role=${isRowMode ? "rowgroup" : "list"}
        tabindex="0"
        style=${stickyInset > 0
          ? `scroll-padding-block-start:${stickyInset}px`
          : nothing}
        aria-label=${this.hasAttribute("aria-label") ? this.getAttribute("aria-label")! : nothing}
        aria-busy=${this.loading ? "true" : "false"}
      >
        <div
          part="spacer"
          role=${isRowMode ? "presentation" : nothing}
          style=${styleMap({ height: `${totalHeight}px` })}
        >
          ${this.renderGroups()}
          ${repeat(
            windowed,
            (w) => this.rowIdentities[w.index],
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
    "lr-virtual-list": LyraVirtualList;
  }
}

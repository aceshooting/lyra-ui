import {
  html,
  nothing,
  render,
  type RootPart,
  type TemplateResult,
  type PropertyValues,
} from 'lit';
import { html as staticHtml, unsafeStatic } from 'lit/static-html.js';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { literalSetConverter } from '../../../internal/converters.js';
import { tag } from '../../../internal/prefix.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { nativePopoverSupported } from '../../../internal/native-popover.js';
import {
  finiteAdd,
  finiteCount,
  finiteInteger,
  finiteNumber,
} from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
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
const MAX_VIRTUAL_LIST_GROUPS = 10_000;
const EMPTY_VIRTUAL_LIST_GROUPS: readonly LyraVirtualListGroup[] = Object.freeze([]);

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

/** Structural (not referential) equality for `groups` -- the shared collection-ownership
 *  boundary always clones every assignment into a fresh frozen array/objects (see
 *  `snapshotPublicCollection`), so a plain `!==` `hasChanged` treats a composing parent's
 *  fresh-but-content-identical re-render (a common, otherwise-harmless Lit rebinding pattern) as
 *  a real groups change, discarding every measured sticky/group-marker height for no reason.
 *  `LyraVirtualListGroup`'s shape is small and entirely primitive fields, so a shallow
 *  per-entry compare is cheap relative to the O(n) recompute + measurement-cache loss it avoids. */
function virtualListGroupsChanged(
  value: unknown,
  oldValue: unknown
): boolean {
  if (value === oldValue) return false;
  const next = value as readonly LyraVirtualListGroup[] | undefined;
  const previous = oldValue as readonly LyraVirtualListGroup[] | undefined;
  if (next == null || previous == null) return next !== previous;
  if (next.length !== previous.length) return true;
  for (let index = 0; index < next.length; index += 1) {
    const a = next[index]!;
    const b = previous[index]!;
    if (a.key !== b.key || a.label !== b.label || a.startIndex !== b.startIndex) return true;
  }
  return false;
}

/** The ARIA role pairing each rendered row participates in -- see `itemRole`'s own doc for what
 *  each value maps to. */
export type LyraVirtualListItemRole = 'listitem' | 'row';

/**
 * Where `renderItem`'s output is instantiated.
 *
 * - `'shadow'` (the default) stamps it inside this component's shadow root, where only inherited
 *   custom properties and an explicitly exported part reach it.
 * - `'light'` stamps it into the HOST'S OWN light DOM, assigned back into the windowed row wrapper
 *   through an internal named slot, so an ordinary document stylesheet styles a virtualized row.
 *   Windowing, measurement, spacer sizing, `scrollToIndex()`, the external-scroller mode and the
 *   ARIA contract all stay with this component either way.
 */
export type LyraVirtualListRowProjection = 'shadow' | 'light';

const ROW_PROJECTION = literalSetConverter<LyraVirtualListRowProjection>(
  ['shadow', 'light'],
  'shadow'
);

/**
 * Reserved attribute marking a light-DOM row wrapper this component created in
 * `row-projection="light"` mode, so consumer CSS, DOM diffing and snapshot tests can recognise a
 * library-owned light-DOM node. `::part()` cannot address one -- a projected row is in the
 * document's tree, not a shadow tree -- so this replaces `closest('[part="row"]')` for a delegated
 * listener in that mode. Built through `tag()`, exactly like `ANNOUNCEMENT_SINK_ATTRIBUTE`.
 */
export const VIRTUAL_LIST_ROW_ATTRIBUTE = `data-${tag('virtual-list-row')}`;

/** Reserved attribute marking the projected sticky-band wrapper. Same rationale as
 *  {@linkcode VIRTUAL_LIST_ROW_ATTRIBUTE}. */
export const VIRTUAL_LIST_STICKY_ATTRIBUTE = `data-${tag('virtual-list-sticky')}`;

/** lit-html binds attribute VALUES, never attribute NAMES, and the two reserved names above are
 *  derived from `tag()` rather than typed out — so the light template splices them in as static
 *  values. Both are module-level constants on purpose: `lit/static-html.js` caches a call site's
 *  expanded template by static-value identity, and a fresh `unsafeStatic()` per render would miss
 *  that cache on every frame. */
const ROW_ATTRIBUTE_STATIC = unsafeStatic(VIRTUAL_LIST_ROW_ATTRIBUTE);

/** Text of the trailing comment node that bounds the light-DOM render part. */
const PROJECTION_ANCHOR_MARKER = `${tag('virtual-list')}-projection`;

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

/** `Node.ELEMENT_NODE`, spelled out so the check below needs no live `Node` binding (the value is
 *  identical in every realm, including the one a server render runs in). */
const ELEMENT_NODE_TYPE = 1;

/** Only a `Window` is its own `window`, in any realm -- so this stays correct for a scroller handed
 *  in from an iframe, which an `instanceof Window` check against this realm would misclassify. */
function isWindowScroller(target: Element | Window): target is Window {
  return (target as Window).window === target;
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
 * `TemplateResult`). That value is instantiated inside this component's shadow root, not in the
 * caller's light DOM; style callback output in its own template/custom element, through inherited
 * custom properties, or through an explicitly exported part. `keyFunction(item, index)` gives the
 * row a stable `repeat()` reconciliation key, so scroll position and any per-row state (e.g. an
 * `<audio>` element's playback position) survive an array/source mutation instead of every row
 * remounting from scratch.
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
 * **Overlays inside rows.** That per-row transform makes every row the containing block of any
 * `position: fixed` descendant, inside this element's own clipping scroller, so an `absolute`
 * overlay in a row can never extend past the list. Rows therefore default anchored Lyra overlays
 * (dropdowns, tooltips, popovers, selects, context menus) to the `fixed` strategy, and a trapped
 * `fixed` overlay opens at full size in the browser top layer where the native Popover API exists.
 * Every authored value still wins: an instance's `positioning-strategy`/`hoist`, an ancestor's
 * `--lr-positioning-strategy` (even on `:root`), or `::part(row) { --lr-positioning-strategy:
 * absolute }` to opt a list's rows out. Where the Popover API is absent, a row holding an open
 * `lr-dropdown` (in `renderItem` mode) stops transforming while it is open, so its menu is no
 * longer clipped.
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
 *   stays mounted, so that height is known before the first jump rather than after it. Under an
 *   external `scrollElement` that inset is written on an element that no longer scrolls: the
 *   programmatic paths still clear the band (they subtract it arithmetically), but the consumer
 *   owns mirroring `scroll-padding-block-start` onto their own scroller for the native one.
 * A host that renders its own group headers as ordinary rows supplies `groups` purely as position
 * anchors, with `label: ''` so no duplicate `[part="group"]` marker renders.
 *
 * **Position queries.** `offsetForIndex(index)` and `indexAtOffset(px)` expose the windowing math
 * itself: they translate between an item index and the pixel offset that row renders at, in the same
 * coordinate space as the scroll container's `scrollTop`. A host doing its own scroll-linked layout
 * (a pinned group header, a scrollbar minimap, a "jump to here" affordance) needs those numbers and
 * would otherwise have to duplicate the offsets array.
 *
 * **External scroll container.** `scrollElement` points the whole windowing loop at an ancestor
 * element (or the `Window`) that already owns a scrollbar, for a list embedded in a longer scrolling
 * page rather than sized as its own panel. `[part="base"]` then stops scrolling and grows to the
 * list's full virtual extent, so the page scrollbar spans the whole list, the visible band is the
 * external scroller's height, and `[part="sticky-group"]` sticks to that scrollport. Every
 * list-coordinate API (`offsetForIndex()`, `indexAtOffset()`, `scrollToIndex()`, `active-item-id`,
 * `lr-virtual-scroll`) keeps answering in the list's own offsets; this component converts. There is
 * no ancestor auto-detection, deliberately: a detected scroller would silently change this
 * component's behavior the day an unrelated `overflow` rule landed on a wrapper in between.
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
 *   `LyraVirtualListScroll`) — the scroll container moved. `scrollTop` is always in the list's own
 *   offset space (`offsetForIndex()`'s space), including under an external `scrollElement`, where it
 *   is how far the list has scrolled past the top of that scroller rather than the scroller's own
 *   position. Emitted from the same
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
 *   used when consumer-rendered row content explicitly opts out of wrapping. Under an external
 *   `scrollElement` it stops scrolling, drops its `tabindex` and hover outline, and sizes itself to
 *   the list's full virtual extent instead of `--lr-virtual-list-height`.
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
 *   collapsing to zero when a caller does not size the host. Ignored while `scrollElement` names an
 *   external scroller, whose own height is the visible band.
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
 * @cssprop [--lr-theme-scrollbar-width=auto] - Opt-in theme-level scrollbar width honored by the
 *   `base` scroll viewport; unset, renders identically to before. Set on `:root` or any ancestor
 *   to retune every internal scroll container in the library at once.
 * @cssprop [--lr-theme-scrollbar-gutter=auto] - Opt-in theme-level scrollbar gutter honored by the
 *   `base` scroll viewport; see `--lr-theme-scrollbar-width`.
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

  /** Renders one row's content — typically a `lit-html` `TemplateResult` — inside this component's
   *  shadow root. The returned value is not light-DOM content: style it in its own template/custom
   *  element, with inherited custom properties, or through a part this component exports. */
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

  /** Measured group markers inserted immediately before their first row's `startIndex`. Non-object
   * entries, invalid indexes, and duplicate indexes are ignored during rendering. An entry whose `label` is
   * the empty string renders no `[part="group"]` marker at all — it is a pure
   * position anchor, for a host that renders its own group header as an
   * ordinary row (and would otherwise get two stacked headers) but still needs
   * this component to know where each group starts, e.g. to drive
   * `renderStickyGroup`. Omitting `label` entirely still falls back to `key`. */
  @property({ attribute: false, hasChanged: virtualListGroupsChanged })
  groups?: readonly LyraVirtualListGroup[];

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

  /** Where `renderItem`'s output is instantiated: `'shadow'` (the default) inside this component's
   *  shadow root, or `'light'` as a child of the host itself so ordinary document CSS reaches it.
   *  See the class doc's "Light-DOM row projection" section for the full contract. Unsupported
   *  attribute values and untyped property writes normalize back to `'shadow'`; the property is
   *  deliberately not reflected, matching `itemRole`. */
  private _rowProjection: LyraVirtualListRowProjection = 'shadow';

  @property({ attribute: 'row-projection', converter: ROW_PROJECTION })
  get rowProjection(): LyraVirtualListRowProjection {
    return this._rowProjection;
  }
  set rowProjection(next: LyraVirtualListRowProjection) {
    const normalized = ROW_PROJECTION.normalize(next);
    const previous = this._rowProjection;
    if (previous === normalized) return;
    this._rowProjection = normalized;
    this.requestUpdate('rowProjection', previous);
  }

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
   * An ancestor element — or the `Window` — that already owns the scrollbar, for a list that is
   * part of a longer scrolling page rather than a self-contained panel. While set, this component's
   * own `[part="base"]` viewport stops scrolling (it grows to the list's full virtual extent) and
   * the windowing math tracks the named scroller's position instead, so one page scrollbar moves
   * the whole page *and* re-windows the list.
   *
   * There is deliberately **no ancestor auto-detection**: the scroller is whichever element you
   * name and nothing else. A detected ancestor would silently change this component's behavior the
   * day an unrelated `overflow` rule lands on some wrapper between the two.
   *
   * Everything expressed in list coordinates keeps working unchanged — `offsetForIndex()`,
   * `indexAtOffset()`, `scrollToIndex()`, `active-item-id`, and `lr-virtual-scroll`'s `scrollTop`
   * are all still relative to the top of the list itself, not to the external scroller; the
   * component converts between the two. What changes hands is the scrollbar, the visible band's
   * height (the scroller's, not `--lr-virtual-list-height`'s), and `[part="sticky-group"]`'s
   * sticky container, which becomes the external scrollport.
   *
   * Four consequences worth knowing before reaching for this:
   * - `[part="base"]` drops its `tabindex` and its hover outline, because it is no longer a
   *   scrollable region. Keyboard scrolling belongs to the external scroller, and a focus stop that
   *   scrolls nothing is worse than none.
   * - Horizontal scrolling of row content that opted out of wrapping (`white-space: nowrap`)
   *   becomes the external scroller's responsibility: CSS cannot leave one axis visible while the
   *   other scrolls.
   * - The list's position inside the scroller is re-read on scroll, on the scroller's own resize,
   *   when the list's own rendered extent resizes, and whenever this property *changes*. A layout
   *   change *above* the list that shifts it without any of those happening is not observable. To
   *   force a re-read, clear the property and set it again
   *   (`el.scrollElement = undefined; el.scrollElement = scroller`) -- assigning the same value
   *   twice does nothing, because an unchanged value is not a change as far as Lit is concerned.
   * - While `renderStickyGroup` is set, mirror `scroll-padding-block-start` onto the external
   *   scroller yourself. This component writes that inset on `[part="base"]`, where it stops having
   *   any effect once that element no longer scrolls, and it will not write style on an element it
   *   does not own. Programmatic scrolling is unaffected -- `scrollToIndex()` and `active-item-id`
   *   subtract the band's height arithmetically -- but native keyboard scrolling can otherwise park
   *   the row it lands on underneath `[part="sticky-group"]`.
   *
   * A value that is neither an `Element` nor a `Window` is ignored (the component keeps scrolling
   * its own viewport) rather than throwing — a consumer wiring this from a ref commonly passes
   * `null`/`undefined` on its first render.
   */
  @property({ attribute: false }) scrollElement?: Element | Window;

  /**
   * The real scroll container — the `[part="base"]` element, the box whose `scrollTop`/
   * `clientHeight` this component's windowing math is expressed against. `undefined` until the
   * first render (and for a never-connected element), since the element does not exist before then.
   *
   * While `scrollElement` is set this element still exists and still hosts every row, but it no
   * longer scrolls: the named external scroller does. Read and write the scroll position there, or
   * keep using `scrollToIndex()`, which targets whichever of the two is currently in charge.
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

  /**
   * The projected light-DOM row wrappers (`[data-lr-virtual-list-row]`) that currently exist as
   * direct children of this host, in item order — the `row-projection="light"` counterpart of
   * {@linkcode renderedRows}, and always empty in the default `'shadow'` mode.
   *
   * Each one pairs 1:1 with the `[part="row"]` wrapper it is slotted into and mirrors that
   * wrapper's `data-row-index`/`data-row-key`. Only direct children are considered, so a nested
   * `<lr-virtual-list>` inside a projected row never contributes its own rows here. Treat the
   * returned elements as read-only: their lifetime belongs to the windowing math, and any of them
   * can be recycled or removed on the next update.
   */
  get projectedRows(): HTMLElement[] {
    const rows: HTMLElement[] = [];
    for (const child of this.children) {
      if (child.hasAttribute(VIRTUAL_LIST_ROW_ATTRIBUTE)) rows.push(child as HTMLElement);
    }
    return rows;
  }

  /** The configured external scroller once it is usable, or `undefined` whenever this component
   *  scrolls its own `[part="base"]` viewport. See `scrollElement` for why a non-`Element`,
   *  non-`Window` assignment resolves to "no external scroller" instead of throwing. */
  private get externalScroller(): Element | Window | undefined {
    const target = this.scrollElement;
    if (target == null) return undefined;
    if (isWindowScroller(target)) return target;
    return (target as Node).nodeType === ELEMENT_NODE_TYPE ? target : undefined;
  }

  /** The full-extent inner element every row offset is measured from — the origin of this
   *  component's own scroll-coordinate space, and therefore the thing an external scroller's
   *  position has to be expressed relative to. */
  private get spacerElement(): HTMLElement | undefined {
    const root = this.renderRoot as ParentNode | undefined;
    return (
      (root?.querySelector('[part="spacer"]') as HTMLElement | null) ?? undefined
    );
  }

  /**
   * The current scroll position in this list's *own* offset space (the space `offsetForIndex()`
   * answers in) plus the height of the band visible over it, whichever element is scrolling.
   * `null` before the container exists.
   *
   * For an external scroller the position is a rect delta rather than a `scrollTop` read, because
   * the list generally does not start at the top of that scroller's content. That delta is genuinely
   * negative while the scroller still sits above the list, so it is reported twice: `scrollTop` is
   * clamped at zero, which is what windowing wants (the window stays pinned to the first row while
   * the list is still below the scroller's top edge), and `rawScrollTop` keeps the signed value,
   * which is what any *conversion* wants. Converting through the clamped number would silently drop
   * exactly the lead-in distance from every absolute scroll target and from every anchoring
   * comparison, landing each one short by however far the scroller is above the list.
   * The band is reported as the scroller's whole height even when the list occupies only part of
   * it, which over-renders slightly at the edges and never under-renders.
   */
  private readScrollMetrics(): {
    scrollTop: number;
    rawScrollTop: number;
    viewportHeight: number;
  } | null {
    const base = this.scrollContainer;
    if (!base) return null;
    const external = this.externalScroller;
    if (!external) {
      // An element's own scrollTop is never negative, so the two positions coincide here.
      return {
        scrollTop: base.scrollTop,
        rawScrollTop: base.scrollTop,
        viewportHeight: base.clientHeight,
      };
    }
    const spacerTop = (this.spacerElement ?? base).getBoundingClientRect().top;
    if (isWindowScroller(external)) {
      // documentElement.clientHeight excludes a classic scrollbar's thickness; innerHeight does not.
      const documentHeight = finiteNumber(
        external.document?.documentElement?.clientHeight ?? 0,
        0
      );
      const rawScrollTop = finiteNumber(-spacerTop, 0);
      return {
        scrollTop: Math.max(0, rawScrollTop),
        rawScrollTop,
        viewportHeight:
          documentHeight > 0 ? documentHeight : finiteNumber(external.innerHeight, 0),
      };
    }
    const scrollerTop = external.getBoundingClientRect().top;
    const rawScrollTop = finiteNumber(scrollerTop - spacerTop, 0);
    return {
      scrollTop: Math.max(0, rawScrollTop),
      rawScrollTop,
      viewportHeight: finiteNumber(external.clientHeight, 0),
    };
  }

  /** Moves whichever element is scrolling so this list's own offset space lands at `top`. Omit
   *  `behavior` for the direct `scrollTop` write the measurement-anchoring paths need. */
  private applyScrollPosition(top: number, behavior?: 'auto' | 'smooth'): void {
    const external = this.externalScroller;
    if (!external) {
      const base = this.scrollContainer;
      if (!base) return;
      const next = Math.max(0, finiteNumber(top, 0));
      if (behavior === undefined) base.scrollTop = next;
      else base.scrollTo({ top: next, behavior });
      return;
    }
    const metrics = this.readScrollMetrics();
    if (!metrics) return;
    // List coordinates are an offset *into* the external scroller's content, not a position within
    // it, so move it by the difference rather than assigning an absolute value. The difference is
    // taken against the UNCLAMPED position: while the scroller is still above the list the true
    // list-space position is negative, and measuring from the clamped zero would move the scroller
    // short by exactly the distance it has yet to travel to reach the list.
    const delta = finiteNumber(top, metrics.rawScrollTop) - metrics.rawScrollTop;
    if (isWindowScroller(external)) {
      // A Window has no writable scrollTop, so even the instant path goes through scrollTo().
      const options: ScrollToOptions = {
        top: Math.max(0, finiteNumber(external.scrollY + delta, 0)),
      };
      if (behavior !== undefined) options.behavior = behavior;
      external.scrollTo(options);
      return;
    }
    const next = Math.max(0, finiteNumber(external.scrollTop + delta, 0));
    if (behavior === undefined) external.scrollTop = next;
    else external.scrollTo({ top: next, behavior });
  }

  /** Re-reads the external scroller's geometry into the reactive windowing state. Writes only on a
   *  real change, so the render this can trigger converges instead of looping. */
  private syncExternalScrollMetrics(): void {
    const metrics = this.readScrollMetrics();
    if (!metrics) return;
    if (this.viewportHeight !== metrics.viewportHeight)
      this.viewportHeight = metrics.viewportHeight;
    if (this.containerScrollTop !== metrics.scrollTop)
      this.containerScrollTop = metrics.scrollTop;
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
  /** `row-height="auto"` per-row measured heights, keyed by internal row identity. Array sources
   * are pruned to their current live identities whenever `items` changes; indexed sources retain
   * only a bounded window around the rendered range. */
  private readonly measuredHeights = new Map<string, number>();
  /** Index ownership for each retained measurement. Pruned in lockstep with `measuredHeights`. */
  private readonly measuredIndices = new Map<string, number>();
  /** Sorted retained indexes and their cumulative height deltas. Indexed offset queries binary
   * search this cache instead of rescanning every retained measurement. */
  private indexedMeasurementIndices: number[] = [];
  private indexedMeasurementDeltaPrefix: number[] = [0];
  private indexedMeasurementIndexDirty = true;
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
  /** The window the most recent shadow `render()` emitted, with each row's identity already
   *  resolved. `row-projection="light"` renders the SAME array, keyed by the SAME identity, so the
   *  two sides can never disagree about which rows exist or what they are called. */
  private renderedWindow: readonly {
    item: unknown;
    index: number;
    identity: string;
  }[] = [];
  /** Trailing comment bounding the light-DOM render part; also where lit-html caches that part. */
  private projectionAnchor?: Comment;
  private projectionPart?: RootPart;
  /**
   * True until the first render is safely past. A server render can never produce projected rows --
   * `@lit-labs/ssr` calls `connectedCallback()`, `willUpdate()` and `render()`, never
   * `update()`/`updated()`, and there is no DOM to render into -- so activating projection
   * unconditionally would serialize this component's bounded deterministic first window EMPTY and
   * make the browser's first render disagree with the markup it is hydrating.
   *
   * Released through `seedFirstRenderState()`, the same helper `renderUnmeasuredWindow` uses: a
   * browser-only mount clears it synchronously inside `connectedCallback()` (so the very first
   * render is already projected, with no flash and no extra update), while a hydrating mount keeps
   * the server's shadow-rendered window for exactly its first render and swaps into the light DOM
   * one task later.
   */
  private projectionDeferred = true;

  /** Stable reference so `seedFirstRenderState()`'s pending set dedupes the re-arm below. */
  private readonly releaseRowProjection = (): void => {
    this.projectionDeferred = false;
    this.requestUpdate();
  };
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
  /**
   * Engines without the native Popover API cannot lift a row's open dropdown into the top layer,
   * so `[part="base"]` carries `data-lr-no-top-layer` and the stylesheet stops that row from being
   * a containing block while the dropdown is open. A state, never a read inside `render()`: this
   * element is render-and-hydrate, and hydration primes attribute parts without committing them,
   * so the client value must land in a post-hydration update (see `firstUpdated()`).
   */
  @state() private noTopLayer = false;

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
  /** Whatever this component last bound its scroll/intent listeners to -- its own `[part="base"]`,
   *  an external `scrollElement`, or a `Window`. Detaching reads this stored target rather than
   *  re-deriving one, so re-pointing `scrollElement` can never strand a listener on the old target. */
  private scrollListenerTarget?: EventTarget;
  /** Set only for a `Window` scroller, which has no box a `ResizeObserver` could watch. */
  private viewportResizeTarget?: Window;
  /** An external scroll happened and its rect-delta position is still to be read, in the coalescing
   *  frame below rather than once per native `scroll` event. */
  private externalMetricsPending = false;
  private ownerRealmGeneration = 0;
  /** True for the remainder of the frame in which any of this component's `ResizeObserver`s
   *  delivered -- so `syncRowObservers()` can tell that a re-render it is running inside is still
   *  part of the browser's current resize-observation loop, and the measurement callbacks can tell
   *  that folding a new height into the offsets would resize an observed box from inside one. See
   *  `beginResizeDelivery()`. */
  private inResizeDelivery = false;
  /** Row heights observed during a delivery whose offsets rebuild waits for the frame flush, keyed
   *  by row identity exactly like `measuredHeights`. A raw observation, not yet a measurement: the
   *  0.5px compare, the cache write, and the scroll anchoring all still happen in one place, in
   *  `applyPendingRowMeasurements()`. See `beginResizeDelivery()`. */
  private readonly pendingRowMeasurements = new Map<
    string,
    { index: number; height: number }
  >();
  /** The same, for real group markers, keyed by `startIndex` like `measuredGroupHeights`. */
  private readonly pendingGroupMeasurements = new Map<number, number>();
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
  private normalizedGroups: readonly LyraVirtualListGroup[] = EMPTY_VIRTUAL_LIST_GROUPS;
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
      this.seedFirstRenderState(this.releaseRowProjection);
      // seedFirstRenderState() is a no-op once this element has updated, so an element that first
      // connected into an ownerless document (which seeds nothing at all) would otherwise carry a
      // stranded deferral into the realm that can actually render it.
      if (this.hasUpdated) this.projectionDeferred = false;
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
      // First, for the same reason it runs before syncRowObservers() in updated(): a reconnect
      // that changes no reactive property never triggers a Lit render, so without this the rows
      // would be observed and measured while their projected content is still torn down.
      this.syncRowProjection();
      this.attachContainerListeners();
      this.syncRowObservers();
      this.syncGroupObservers();
      this.syncStickyOverlay();
    }
  }

  override disconnectedCallback(): void {
    // Deliberately NOT inside resetOwnerRealmWork(): that also runs on connect, where tearing the
    // projection down would destroy and rebuild every row on each reconnect.
    this.teardownRowProjection();
    this.resetOwnerRealmWork();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.teardownRowProjection();
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
    // The frame that would have applied these is about to be cancelled. Dropping them loses
    // nothing: every row and marker is re-observed on reconnect, and a brand-new observation always
    // reports its current size once.
    this.pendingRowMeasurements.clear();
    this.pendingGroupMeasurements.clear();
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
    this.externalMetricsPending = false;
    this.pendingScrollCorrection = undefined;
    this.detachContainerListeners();
    this.scrollListenerTarget = undefined;
  }

  override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.attachContainerListeners();
    // A microtask, not a synchronous write: a state change inside firstUpdated() schedules an
    // update after the first one completed. Either way the value lands after hydration.
    queueMicrotask(() => {
      if (this.isConnected) this.noTopLayer = !nativePopoverSupported();
    });
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    // Re-arm rather than assume. LyraElement drops its deferred seeds when a first update throws
    // -- that update is not a hydration this element can still correct -- and it clears the
    // hydration flag at the same time, so seeding again here runs SYNCHRONOUSLY and this update
    // projects. Guarded on `!hasUpdated` because `seedFirstRenderState()` is a no-op past the
    // first update anyway; on every healthy path the seed above already released the flag, so this
    // is inert.
    // `ownerDocument` is optional-chained because this runs under SSR too: @lit-labs/ssr's element
    // renderer calls `willUpdate()` directly and never calls the element's own
    // `connectedCallback()`, so the identical guard there never runs and this is the first read.
    // A server-rendered element has no owner document at all, and a bare `.defaultView` throws.
    if (
      this.projectionDeferred &&
      !this.hasUpdated &&
      this.ownerDocument?.defaultView
    )
      this.seedFirstRenderState(this.releaseRowProjection);
    this.isFirstUpdate = !this.hasUpdated;
    if (this.hasUpdated) this.noTopLayer = !nativePopoverSupported();
    if (
      changed.has('items') ||
      changed.has('source') ||
      changed.has('keyFunction') ||
      changed.has('rowHeight') ||
      changed.has('groups') ||
      changed.has('activeItemId') ||
      changed.has('scrollElement')
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
      changed.has('keyFunction') ||
      (isIndexedSource(this.effectiveSource) &&
        (changed.has('items') || changed.has('source')))
    ) {
      // Measurements belong to the current row identities. A new key function can reuse an old
      // key for a different row, so retaining the cache would apply the old row's height to it.
      // An observation still waiting for its frame flush carries the same stale identity, so it
      // goes with them rather than landing after the cache it belongs to was dropped.
      this.measuredHeights.clear();
      this.measuredIndices.clear();
      this.pendingRowMeasurements.clear();
      this.indexedMeasurementIndexDirty = true;
    }
    if (changed.has('groups')) {
      this.measuredGroupHeights.clear();
      this.pendingGroupMeasurements.clear();
    }
    if (changed.has('items') || changed.has('source') || changed.has('groups')) {
      this.recomputeGroups();
    }
    if (changed.has('rowHeight')) {
      this.fixedRowHeight = this.parseRowHeight(this.rowHeight);
      if (this.fixedRowHeight != null) {
        this.measuredHeights.clear();
        this.measuredIndices.clear();
        this.pendingRowMeasurements.clear();
        this.indexedMeasurementIndexDirty = true;
      }
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
    // Ordering is load-bearing twice over. The row wrappers must be populated before the first
    // ResizeObserver.observe() below, or the first measurement is a spurious zero; and before
    // maybeCorrectPendingScroll() -> performScrollTo() -> readScrollMetrics() forces layout, which
    // would otherwise read a list of zero-height rows.
    this.syncRowProjection();
    this.syncRowObservers();
    this.syncGroupObservers();
    this.syncStickyOverlay();
    // Re-point every listener at the element that is now scrolling. attachContainerListeners()
    // detaches from the stored previous target first, so the element this component is leaving
    // never keeps a listener -- the leak an externally-supplied scroller otherwise invites.
    if (changed.has('scrollElement') && !this.isFirstUpdate)
      this.attachContainerListeners();
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
      this.rebuildIndexedMeasurementIndex();
      let low = 0;
      let high = this.indexedMeasurementIndices.length;
      while (low < high) {
        const middle = (low + high) >> 1;
        if (this.indexedMeasurementIndices[middle]! < index) low = middle + 1;
        else high = middle;
      }
      offset = finiteAdd(offset, this.indexedMeasurementDeltaPrefix[low] ?? 0);
    }
    return Math.max(0, finiteAdd(offset, this.groupContributionThrough(index)));
  }

  private rebuildIndexedMeasurementIndex(): void {
    if (!this.indexedMeasurementIndexDirty) return;
    const retained: Array<{ index: number; delta: number }> = [];
    for (const [identity, index] of this.measuredIndices) {
      const height = this.measuredHeights.get(identity);
      if (height !== undefined) {
        retained.push({ index, delta: height - DEFAULT_ROW_ESTIMATE_PX });
      }
    }
    retained.sort((a, b) => a.index - b.index);
    const indices = new Array<number>(retained.length);
    const prefix = new Array<number>(retained.length + 1);
    prefix[0] = 0;
    for (let position = 0; position < retained.length; position++) {
      const measurement = retained[position]!;
      indices[position] = measurement.index;
      prefix[position + 1] = finiteAdd(prefix[position]!, measurement.delta);
    }
    this.indexedMeasurementIndices = indices;
    this.indexedMeasurementDeltaPrefix = prefix;
    this.indexedMeasurementIndexDirty = false;
  }

  private pruneIndexedMeasurements(): boolean {
    if (
      !isIndexedSource(this.effectiveSource) ||
      this.fixedRowHeight != null ||
      this.renderEnd < this.renderStart
    ) return false;
    const renderedCount = this.renderEnd - this.renderStart + 1;
    const retentionRows = Math.max(
      renderedCount,
      normalizeOverscan(this.overscan) * 4
    );
    const firstRetained = Math.max(0, this.renderStart - retentionRows);
    const lastRetained = Math.min(
      this.itemCount - 1,
      this.renderEnd + retentionRows
    );
    let removedDeltaBeforeWindow = 0;
    let pruned = false;
    for (const [identity, measuredIndex] of this.measuredIndices) {
      if (measuredIndex < firstRetained || measuredIndex > lastRetained) {
        const height = this.measuredHeights.get(identity);
        if (height !== undefined && measuredIndex < firstRetained) {
          removedDeltaBeforeWindow = finiteAdd(
            removedDeltaBeforeWindow,
            height - DEFAULT_ROW_ESTIMATE_PX
          );
        }
        this.measuredIndices.delete(identity);
        this.measuredHeights.delete(identity);
        pruned = true;
      }
    }
    if (pruned) {
      this.indexedMeasurementIndexDirty = true;
      // Removing measurements above the retained window changes every following row's estimated
      // offset. Shift the scroll coordinate by the same delta so the first visible row remains
      // anchored; without this, a far scrollToIndex() jump can immediately reinterpret its target
      // as a different window when the old measurements are discarded.
      if (removedDeltaBeforeWindow !== 0) {
        // Anchoring is a *shift*, so it reads and writes the unclamped position: starting from the
        // clamped zero while an external scroller still sits above the list would turn the shift
        // into a jump down to the list's top. Only the windowing state keeps the clamped value.
        const oldScrollTop =
          this.readScrollMetrics()?.rawScrollTop ?? this.containerScrollTop;
        const nextScrollTop = oldScrollTop - removedDeltaBeforeWindow;
        this.applyScrollPosition(nextScrollTop);
        this.containerScrollTop = Math.max(0, nextScrollTop);
        this.pendingScrollTop = null;
      }
    }
    return pruned;
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
        if (!liveKeys.has(key)) {
          this.measuredHeights.delete(key);
          this.measuredIndices.delete(key);
          this.indexedMeasurementIndexDirty = true;
        }
      }
      for (const key of this.measuredIndices.keys()) {
        if (!liveKeys.has(key)) {
          this.measuredIndices.delete(key);
          this.indexedMeasurementIndexDirty = true;
        }
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
    if (this.pruneIndexedMeasurements()) this.computeRange();
  }

  private attachContainerListeners(): void {
    const base = this.scrollContainer;
    const ownerDocument = this.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    if (!base || !this.isConnected || !ownerWindow) return;
    this.containerResizeObserver?.disconnect();
    this.containerResizeObserver = undefined;
    this.detachContainerListeners();
    const external = this.externalScroller;
    // One binding site for both modes: whichever element is actually scrolling gets every
    // listener, and the stored reference is what the detach path later removes them from.
    const scrollTarget: EventTarget = external ?? base;
    const generation = this.ownerRealmGeneration;
    const ResizeObserverCtor = ownerWindow.ResizeObserver;
    if (ResizeObserverCtor) {
      const observer = new ResizeObserverCtor((entries) => {
        if (
          this.containerResizeObserver !== observer ||
          this.scrollListenerTarget !== scrollTarget ||
          !this.isCurrentOwnerWork(ownerDocument, generation)
        ) return;
        this.beginResizeDelivery();
        if (external) {
          // Either box resizing changes the same answer -- the scroller's is the visible band, and
          // this element's is the list's own extent within it -- so both route to one rect read.
          this.syncExternalScrollMetrics();
          return;
        }
        const entry = entries[0];
        if (!entry) return;
        this.viewportHeight =
          entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
      });
      this.containerResizeObserver = observer;
      observer.observe(base);
      if (external && !isWindowScroller(external)) observer.observe(external);
    }
    scrollTarget.addEventListener('scroll', this.onScroll, { passive: true });
    scrollTarget.addEventListener('wheel', this.onUserScrollIntent, { passive: true });
    scrollTarget.addEventListener('pointerdown', this.onUserScrollIntent, { passive: true });
    scrollTarget.addEventListener('touchstart', this.onUserScrollIntent, { passive: true });
    scrollTarget.addEventListener('keydown', this.onUserScrollIntent);
    this.scrollListenerTarget = scrollTarget;
    if (external && isWindowScroller(external)) {
      // A Window has no box for a ResizeObserver to watch; `resize` is its equivalent notification.
      external.addEventListener('resize', this.onExternalViewportResize, {
        passive: true,
      });
      this.viewportResizeTarget = external;
    }
    // Queue a one-time read as a fast path for browsers that delay the first
    // ResizeObserver callback. It runs after firstUpdated() returns, so these
    // reactive writes do not schedule an update from inside Lit's lifecycle
    // callback; the observer remains responsible for later measurements.
    ownerWindow.queueMicrotask(() => {
      if (
        this.scrollListenerTarget !== scrollTarget ||
        this.scrollContainer !== base ||
        !this.isCurrentOwnerWork(ownerDocument, generation)
      ) return;
      const metrics = this.readScrollMetrics();
      if (!metrics) return;
      if (this.viewportHeight !== metrics.viewportHeight)
        this.viewportHeight = metrics.viewportHeight;
      if (this.containerScrollTop !== metrics.scrollTop)
        this.containerScrollTop = metrics.scrollTop;
    });
  }

  private detachContainerListeners(): void {
    const viewportTarget = this.viewportResizeTarget;
    if (viewportTarget) {
      viewportTarget.removeEventListener(
        'resize',
        this.onExternalViewportResize
      );
      this.viewportResizeTarget = undefined;
    }
    const target = this.scrollListenerTarget;
    if (!target) return;
    target.removeEventListener('scroll', this.onScroll);
    target.removeEventListener('wheel', this.onUserScrollIntent);
    target.removeEventListener('pointerdown', this.onUserScrollIntent);
    target.removeEventListener('touchstart', this.onUserScrollIntent);
    target.removeEventListener('keydown', this.onUserScrollIntent);
  }

  private onExternalViewportResize = (): void => {
    this.syncExternalScrollMetrics();
  };

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
    if (this.externalScroller) {
      // Deferred to the coalescing frame below: an external position is a rect delta, and taking
      // one per native `scroll` event would force a layout per event instead of per frame.
      this.pendingScrollTop = null;
      this.externalMetricsPending = true;
    } else {
      this.pendingScrollTop = (e.currentTarget as HTMLElement).scrollTop;
    }
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
      if (this.externalMetricsPending) {
        this.externalMetricsPending = false;
        const metrics = this.readScrollMetrics();
        if (metrics) {
          this.pendingScrollTop = metrics.scrollTop;
          if (this.viewportHeight !== metrics.viewportHeight)
            this.viewportHeight = metrics.viewportHeight;
        }
      }
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
    for (const entry of entries) {
      const row = entry.target as HTMLElement;
      const key = this.observedRowKeys.get(row);
      const index = this.observedRowIndices.get(row);
      if (key === undefined || index === undefined) continue;
      const height =
        entry.borderBoxSize?.[0]?.blockSize ??
        entry.target.getBoundingClientRect().height;
      this.pendingRowMeasurements.set(key, { index, height });
    }
    // Reading is always safe inside the delivery; folding the result into the offsets is what
    // resizes an observed box, so that waits for the frame flush whenever it would. See
    // `beginResizeDelivery()`.
    if (!this.defersMeasurementApplication) this.applyPendingRowMeasurements();
  };

  /** Folds every stashed row observation into `measuredHeights`, anchoring and re-rendering once
   *  for the batch. Byte-for-byte the work `onRowsResized()` used to do inline. */
  private applyPendingRowMeasurements(): void {
    if (this.pendingRowMeasurements.size === 0) return;
    const observations = [...this.pendingRowMeasurements];
    this.pendingRowMeasurements.clear();
    if (this.fixedRowHeight != null) return;
    const base = this.scrollContainer;
    // Unclamped: both the "is this row above the viewport top?" test below and the shift it feeds
    // are expressed against the real position, which is negative while an external scroller has
    // not reached the list yet -- and then nothing is above the viewport top at all.
    const oldScrollTop =
      this.readScrollMetrics()?.rawScrollTop ?? this.containerScrollTop;
    let scrollAdjustment = 0;
    let changed = false;
    for (const [key, { index, height }] of observations) {
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
      this.indexedMeasurementIndexDirty = true;
      if (base && scrollAdjustment !== 0) {
        const nextScrollTop = oldScrollTop + scrollAdjustment;
        this.applyScrollPosition(nextScrollTop);
        this.containerScrollTop = Math.max(0, nextScrollTop);
        this.pendingScrollTop = null;
      }
      this.offsetsDirty = true;
      this.measurementGeneration += 1;
      this.requestUpdate();
    }
  }

  private onGroupsResized = (entries: ResizeObserverEntry[]): void => {
    this.beginResizeDelivery();
    for (const entry of entries) {
      const marker = entry.target as HTMLElement;
      const index = this.observedGroupIndices.get(marker);
      if (index === undefined || !this.normalizedGroupByIndex.has(index)) continue;
      const height =
        entry.borderBoxSize?.[0]?.blockSize ??
        entry.target.getBoundingClientRect().height;
      if (!Number.isFinite(height) || height < 0) continue;
      this.pendingGroupMeasurements.set(index, height);
    }
    if (!this.defersMeasurementApplication) this.applyPendingGroupMeasurements();
  };

  /** The group-marker half of `applyPendingRowMeasurements()`, on the same terms. */
  private applyPendingGroupMeasurements(): void {
    if (this.pendingGroupMeasurements.size === 0) return;
    const observations = [...this.pendingGroupMeasurements];
    this.pendingGroupMeasurements.clear();
    const base = this.scrollContainer;
    // Unclamped, for the same reason as `applyPendingRowMeasurements()`: a group at offset 0
    // compares equal to a clamped zero and would anchor against a viewport top the scroller has
    // not reached yet.
    const oldScrollTop =
      this.readScrollMetrics()?.rawScrollTop ?? this.containerScrollTop;
    let scrollAdjustment = 0;
    let changed = false;
    for (const [index, height] of observations) {
      if (!this.normalizedGroupByIndex.has(index)) continue;
      const previous = this.measuredGroupHeights.get(index) ?? DEFAULT_GROUP_ESTIMATE_PX;
      if (Math.abs(previous - height) <= 0.5) continue;
      const oldRowTop = this.offsetAt(index);
      this.measuredGroupHeights.set(index, height);
      if (oldRowTop <= oldScrollTop) scrollAdjustment += height - previous;
      changed = true;
    }
    if (!changed) return;
    if (base && scrollAdjustment !== 0) {
      const nextScrollTop = oldScrollTop + scrollAdjustment;
      this.applyScrollPosition(nextScrollTop);
      this.containerScrollTop = Math.max(0, nextScrollTop);
      this.pendingScrollTop = null;
    }
    this.offsetsDirty = true;
    this.measurementGeneration += 1;
    this.requestUpdate();
  }

  /** True while folding a fresh measurement into the offsets would resize a box one of this
   *  component's own `ResizeObserver`s is watching, from inside that observer's own delivery.
   *  See `beginResizeDelivery()`. */
  private get defersMeasurementApplication(): boolean {
    return this.inResizeDelivery && this.externalScroller !== undefined;
  }

  /**
   * Marks the rest of this frame as "inside a resize-observation delivery", and schedules the
   * flush that ends it. Called from every one of this component's `ResizeObserver` callbacks,
   * because each of them writes reactive state (`measuredHeights` + `requestUpdate()`,
   * `viewportHeight`, `stickyHeight`) and so can re-render the list -- and a re-render can move the
   * window.
   *
   * Two things must not happen inside a delivery, and both end the same way. Calling `observe()`
   * registers a brand-new observation, which is always active at a DOM depth the browser has
   * already broadcast this frame. Changing the list's *extent* does the same from the other
   * direction: `render()` writes it as `[part="spacer"]`'s block size, and under an external
   * `scrollElement` `[part="base"][data-external-scroll]` takes its own block size from that spacer
   * while `containerResizeObserver` watches it -- a box shallower in the tree than the rows just
   * broadcast. Either way the observation is recorded as a *skipped* one, the loop ends, and an
   * uncaught `ErrorEvent` reading "ResizeObserver loop completed with undelivered notifications" is
   * dispatched. Nothing is actually wrong -- but the error is uncaught, so it lands on whatever is
   * running at the time, which is why it showed up as unattributable flake in this component's
   * *consumers* rather than here.
   *
   * So this frame carries the deferred `observe()` calls and the stashed measurements, and the
   * measurement callbacks only *read* while the delivery is in flight. Renders are never held: an
   * update that lands mid-delivery re-reads offsets nothing has changed, so it writes the extent
   * already in the DOM, resizes no observed box, and cannot produce a skipped observation. That
   * matters beyond this component -- holding a render would move this element's `updateComplete`
   * out from under every parent composing it, which used to resolve in the same microtask run.
   *
   * Only the external-`scrollElement` case defers, because that is the only one where the extent
   * write reaches an observed box; with this component's own viewport scrolling, `[part="base"]`
   * takes its block size from `--lr-virtual-list-height` instead, so every measurement there stays
   * exactly as immediate as it was. What a row whose measurement is waiting shows during that one
   * frame is the same `DEFAULT_ROW_ESTIMATE_PX` geometry it already would have shown, and the
   * scroll-anchor correction travels with the measurement that causes it, so no frame is ever
   * painted with one applied and the other still pending.
   */
  private beginResizeDelivery(): void {
    this.inResizeDelivery = true;
    if (this.rowObserveRafId !== undefined) return;
    const ownerDocument = this.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    if (!ownerWindow || !this.isConnected) {
      // No frame can flush now, so `defersMeasurementApplication` stays false and this delivery's
      // callbacks apply their own measurements inline, exactly as they did before any of this.
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
      // Now that the loop this frame belongs to is over, the offsets may move again.
      this.applyPendingRowMeasurements();
      this.applyPendingGroupMeasurements();
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
    // Expressed against whichever element is scrolling, in this list's own offset space either
    // way -- so an external `scrollElement` needs no separate alignment arithmetic here.
    const metrics = this.readScrollMetrics();
    if (!metrics) return false;
    const inset = this.stickyInset;
    const top = this.offsetAt(index);
    const bottom = this.rowBottomAt(index);
    // The band's position, not the window's: under an external scroller that has not reached the
    // list, the visible part of the list starts at offset 0 but ENDS a lead-in early, and the
    // clamped number would report rows as visible that are still below the scroller's bottom edge.
    const viewTop = metrics.rawScrollTop;
    const viewBottom = viewTop + metrics.viewportHeight;
    let target: number | null = null;
    // Only the top-edge alignments need the sticky inset -- `'end'` puts the row's *bottom* edge at
    // the viewport bottom, which the band never covers.
    if (align === 'start') target = top - inset;
    else if (align === 'end') target = bottom - metrics.viewportHeight;
    else if (top - inset < viewTop) target = top - inset;
    else if (bottom > viewBottom) target = bottom - metrics.viewportHeight;
    if (target === null) return false;
    // Deliberately unclamped: a negative list offset is meaningless for this component's own
    // viewport but perfectly legal under an external scroller, where it simply means "park above
    // the list" -- which is exactly where `align: 'end'` on one of the first rows belongs. Both
    // branches of applyScrollPosition() already clamp to the scrolling element's own legal domain.
    this.applyScrollPosition(target, behavior);
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

  /** True whenever `renderItem`'s output belongs in the host's light DOM for THIS render. */
  private get projectionActive(): boolean {
    return !this.projectionDeferred && this.rowProjection === 'light';
  }

  /** The internal slot name pairing one shadow row wrapper with its projected light-DOM row.
   *  Keyed by the component's own row identity -- already the `repeat()` key on both sides -- so a
   *  scroll or a reorder moves rows without rewriting a single `slot`/`name` attribute. Slot
   *  matching is exact whole-value string comparison, so an identity containing a space or a colon
   *  still pairs correctly, and the name is never empty so it can never collide with a default
   *  slot (of which this component renders none). */
  private rowSlotName(identity: string): string {
    return `${tag('virtual-list')}-row-${identity}`;
  }

  /**
   * Mounts, updates or tears down the light-DOM render root that holds `renderItem`'s output in
   * `row-projection="light"` mode.
   *
   * The container is the HOST ITSELF — a slottable must be a direct child of the host — bounded by
   * a trailing comment anchor, so the part only ever owns `[startMarker … anchor)`. Anything a
   * consumer appends to this element later lands after the anchor and is never cleared by a
   * re-render, which is also what keeps a server-rendered light child alive across hydration.
   * `host: this` matches `ReactiveElement`'s own render options, so a `renderItem` template whose
   * event binding is a method reference gets the same `this` it gets in shadow mode.
   */
  private syncRowProjection(): void {
    if (!this.projectionActive || !this.isConnected) {
      if (this.projectionAnchor !== undefined) this.teardownRowProjection();
      return;
    }
    const anchor = this.ensureProjectionAnchor();
    this.projectionPart = render(this.renderProjectedRows(), this, {
      renderBefore: anchor,
      host: this,
    });
  }

  private ensureProjectionAnchor(): Comment {
    const existing = this.projectionAnchor;
    if (
      existing !== undefined &&
      existing.parentNode === this &&
      existing.ownerDocument === this.ownerDocument
    )
      return existing;
    if (existing !== undefined) this.teardownRowProjection();
    const anchor = this.ownerDocument.createComment(PROJECTION_ANCHOR_MARKER);
    // append(), never insertBefore(): the anchor bounds the part from the END, so a consumer's own
    // light children -- whether they were already here or arrive later -- always sit outside it.
    this.append(anchor);
    this.projectionAnchor = anchor;
    this.projectionPart = undefined;
    return anchor;
  }

  /**
   * Removes the projection completely, using public API only: `render(nothing, …)` so lit-html
   * detaches its own child parts and their directives, then the part's start marker, then the
   * anchor. Discarding the anchor discards lit's cached root part with it (the cache lives on the
   * `renderBefore` node), so no private-field poking is ever required and a later re-projection
   * starts from a genuinely fresh part.
   *
   * After this the host's light DOM holds exactly what the consumer put there: no rows, no lit
   * markers, no anchor. The accepted cost is that per-row DOM state inside a projected row does not
   * survive a disconnect/reconnect; scroll position, measurements and the window are unaffected,
   * because they live in component state rather than in the rows.
   */
  private teardownRowProjection(): void {
    const anchor = this.projectionAnchor;
    const part = this.projectionPart;
    this.projectionAnchor = undefined;
    this.projectionPart = undefined;
    if (anchor === undefined) return;
    if (part !== undefined) {
      const container = anchor.parentNode;
      if (container !== null)
        render(nothing, container as HTMLElement, {
          renderBefore: anchor,
          host: this,
        });
      const start = part.startNode;
      start?.parentNode?.removeChild(start);
    }
    anchor.parentNode?.removeChild(anchor);
  }

  /**
   * One light-DOM wrapper per windowed row, over the same array and keyed by the same identity the
   * shadow window used. The wrapper carries no `part` (a `part` attribute outside a shadow tree is
   * inert), no `role` and no inline positioning — the `[part="row"]` wrapper it is slotted into
   * keeps sole ownership of absolute positioning, the per-frame transform and every ARIA
   * attribute, so consumer CSS cannot break windowing. `data-row-index`/`data-row-key` are mirrored
   * so document CSS and delegated listeners can still address a specific row.
   */
  private renderProjectedRows(): unknown {
    return repeat(
      this.renderedWindow,
      (w) => w.identity,
      (w) => staticHtml`<div
          ${ROW_ATTRIBUTE_STATIC}
          slot=${this.rowSlotName(w.identity)}
          data-row-index=${w.index}
          data-row-key=${domKeyToken(this.keyOf(w.item, w.index))}
        >${this.renderItem(w.item, w.index)}</div>`
    );
  }

  private renderRow(
    item: unknown,
    index: number,
    total: number,
    activeIndex: number,
    identity: string
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
        style=${styleMap({
          transform: `translateY(${top}px)`,
          '--_lr-virtual-list-row-offset': `${top}px`,
        })}
      >
        ${this.projectionActive
          ? html`<slot name=${this.rowSlotName(identity)}></slot>`
          : this.renderItem(item, index)}
      </div>
    `;
  }

  /** Normalizes group definitions only when their inputs change. */
  private recomputeGroups(): void {
    const normalized: LyraVirtualListGroup[] = [];
    const seen = new Set<number>();
    try {
      const groups = this.groups;
      if (!Array.isArray(groups)) throw new TypeError('groups must be an array');
      const length = getOwnDataDescriptor(groups, 'length');
      if (
        length === MISSING_OWN_DATA_DESCRIPTOR ||
        length === UNSAFE_OWN_DATA_DESCRIPTOR ||
        typeof length.value !== 'number' ||
        !Number.isSafeInteger(length.value) ||
        length.value < 0
      )
        throw new TypeError('groups must have a bounded length');
      for (let position = 0; position < Math.min(length.value, MAX_VIRTUAL_LIST_GROUPS); position += 1) {
        const entry = getOwnDataDescriptor(groups, String(position));
        if (
          entry === MISSING_OWN_DATA_DESCRIPTOR ||
          entry === UNSAFE_OWN_DATA_DESCRIPTOR ||
          entry.value === null ||
          typeof entry.value !== 'object' ||
          Array.isArray(entry.value)
        )
          continue;
        const key = getOwnDataDescriptor(entry.value, 'key');
        const label = getOwnDataDescriptor(entry.value, 'label');
        const startIndex = getOwnDataDescriptor(entry.value, 'startIndex');
        if (
          key === MISSING_OWN_DATA_DESCRIPTOR ||
          key === UNSAFE_OWN_DATA_DESCRIPTOR ||
          startIndex === MISSING_OWN_DATA_DESCRIPTOR ||
          startIndex === UNSAFE_OWN_DATA_DESCRIPTOR ||
          label === UNSAFE_OWN_DATA_DESCRIPTOR ||
          (typeof key.value !== 'string' && typeof key.value !== 'number') ||
          typeof startIndex.value !== 'number' ||
          !Number.isInteger(startIndex.value) ||
          startIndex.value < 0 ||
          startIndex.value >= this.itemCount ||
          seen.has(startIndex.value)
        )
          continue;
        const labelValue = label === MISSING_OWN_DATA_DESCRIPTOR || typeof label.value !== 'string'
          ? undefined
          : label.value;
        seen.add(startIndex.value);
        normalized.push(Object.freeze({
          key: key.value,
          startIndex: startIndex.value,
          ...(labelValue === undefined ? {} : { label: labelValue }),
        }));
      }
    } catch {
      // A malformed group collection cannot block the remaining list projection.
    }
    this.normalizedGroups = Object.freeze(
      normalized.sort((a, b) => a.startIndex - b.startIndex)
    );
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
    // The identity is computed once here and reused by both the `repeat()` key and the row
    // template (and, in projection mode, by the light-DOM template through `renderedWindow`), so
    // enabling projection adds no extra `identityAt()` call per row per frame.
    const windowed: { item: unknown; index: number; identity: string }[] = [];
    for (let i = this.renderStart; i <= this.renderEnd; i++) {
      const item = this.itemAt(i);
      windowed.push({ item, index: i, identity: this.identityAt(i, item) });
    }
    this.renderedWindow = windowed;
    const isRowMode = this.itemRole === 'row';
    // Native keyboard/anchor scrolling gets the same treatment as the programmatic paths, from one
    // declaration -- and the attribute is absent entirely while there is no sticky layer.
    const stickyInset = this.stickyInset;
    const activeIndex = this.activeIndex;
    // An external scroller owns the scrollport, so this element is no longer a scrollable region:
    // it must not keep a tab stop (or the hover outline advertising one) for scrolling it cannot do.
    const isExternallyScrolled = this.externalScroller !== undefined;

    return html`
      <div
        part="base"
        role=${isRowMode ? 'rowgroup' : 'list'}
        ?data-external-scroll=${isExternallyScrolled}
        ?data-lr-no-top-layer=${this.noTopLayer}
        tabindex=${isExternallyScrolled ? nothing : '0'}
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
            (w) => w.identity,
            (w) => this.renderRow(w.item, w.index, n, activeIndex, w.identity)
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

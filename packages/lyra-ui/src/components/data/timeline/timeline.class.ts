import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import {
  applyComposedFocusRepair,
  captureComposedFocusRepair,
  collectComposedFocusTargets,
  type ComposedFocusRepairSnapshot,
} from '../../../internal/focus-navigation.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import { observeScrollOverflow } from '../../../internal/scroll-overflow.js';
import { activeElementIn } from '../../../internal/active-element.js';
import type { LyraOrientation } from '../../../internal/shared-unions.js';
import type { LyraTimelineItem } from './timeline-item.class.js';
import {
  OBSERVE_TIMELINE_ITEM_TIMESTAMP,
  SET_TIMELINE_CLUSTER_PRESENTATION,
  isTimelineClusterItemContract,
} from './timeline-cluster.js';
import { styles } from './timeline.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_timeline, LYRA_DEFAULT_timelineClusterCount } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const normalizeTimelineOrientation = (value: unknown): LyraOrientation =>
  value === 'horizontal' ? 'horizontal' : 'vertical';

/** Browser active-element getters are typed as Element but partial DOMs can return structural
 * lookalikes. Brand-check before focus repair or composed containment traverses a candidate. */
function isUsableActiveElement(value: unknown): value is Element {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null)
    return false;
  try {
    const candidate = value as Node;
    if (candidate.nodeType !== 1) return false;
    const NodeConstructor =
      candidate.ownerDocument?.defaultView?.Node ??
      (typeof Node === 'undefined' ? undefined : Node);
    if (!NodeConstructor) return false;
    NodeConstructor.prototype.getRootNode.call(candidate);
    return true;
  } catch {
    return false;
  }
}

/** Descends only across genuine active-element values; an invalid nested answer makes focus
 * ownership unknowable, so cluster repair fails closed instead of forwarding it to shared walks. */
function safelyDeepActiveElement(
  root: Document | ShadowRoot | null | undefined,
): Element | null {
  const initial: unknown = activeElementIn(root);
  if (!isUsableActiveElement(initial)) return null;
  let active: Element = initial;
  while (true) {
    let shadowRoot: ShadowRoot | null;
    try {
      shadowRoot = active.shadowRoot;
    } catch {
      return null;
    }
    if (!shadowRoot) return active;
    const nested: unknown = activeElementIn(shadowRoot);
    if (nested === null) return active;
    if (!isUsableActiveElement(nested)) return null;
    active = nested;
  }
}

/** A genuine candidate can still become detached between the guard and native containment. */
function safelyContainsActive(container: Element, candidate: unknown): boolean {
  if (!isUsableActiveElement(candidate)) return false;
  try {
    return container.contains(candidate);
  } catch {
    return false;
  }
}

/** How a timeline distributes its items along the main axis. */
export type LyraTimelineScale = 'flow' | 'time';

const normalizeTimelineScale = (value: unknown): LyraTimelineScale =>
  value === 'time' ? 'time' : 'flow';

/** How `scale="time"` handles items that land on (nearly) the same position. */
export type LyraTimelineCollision = 'overlap' | 'stack' | 'cluster';

const normalizeTimelineCollision = (value: unknown): LyraTimelineCollision =>
  value === 'stack' || value === 'cluster' ? value : 'overlap';

export interface LyraTimelineClusterActivateDetail {
  /** The clustered `<lr-timeline-item>` elements, as a frozen snapshot in document order. */
  readonly items: readonly LyraTimelineItem[];
}

export interface LyraTimelineEventMap {
  'lr-cluster-activate': CustomEvent<LyraTimelineClusterActivateDetail>;
}

interface TimelineCluster {
  readonly offset: number;
  readonly items: readonly LyraTimelineItem[];
}

const EMPTY_TIMELINE_CLUSTERS: readonly TimelineCluster[] = Object.freeze([]);
const CLUSTER_HIDDEN_ATTRIBUTE = 'data-lr-timeline-cluster-hidden';

/**
 * Minimum axis fraction within which two time-scaled items collide.
 *
 * Expressed against the axis rather than in pixels because the axis extent is a themeable token
 * (`--lr-timeline-time-extent`). 1.5% of a 20rem axis is ~5px, close enough that two ordinary
 * markers genuinely overlap. Cluster mode widens this minimum to the rendered count button's
 * footprint divided by the currently allocated axis, so adjacent interactive hit areas cannot
 * overlap as the allocation or themed action size changes.
 */
const TIMELINE_COLLISION_THRESHOLD = 0.015;

/** Epoch milliseconds for a timeline timestamp, or `null` when it is absent or invalid. */
function timelineEpochMs(
  raw: Date | string | number | null | undefined
): number | null {
  if (raw == null) return null;
  const date =
    raw instanceof Date ? raw : typeof raw === 'number' ? new Date(raw) : new Date(String(raw));
  const ms = date.getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Epoch milliseconds for one item's `timestamp`, or `null` when it has none this component can
 * place. Accepts the same `Date | string | number` union `<lr-timeline-item>` itself takes, so a
 * consumer never has to reformat data for the axis. A `timestamp` slot override is deliberately NOT
 * consulted: arbitrary slotted content carries no machine-readable instant.
 */
function itemEpochMs(element: Element): number | null {
  return timelineEpochMs(
    (element as { timestamp?: Date | string | number }).timestamp
  );
}

/**
 * `<lr-timeline>` — an ordered, connected sequence of past-event rows (an audit trail, an agent
 * action history, a changelog) composed from `<lr-timeline-item>` light-DOM children, joined by a
 * continuous connecting rail. First-party invention: no Web Awesome/Shoelace counterpart exists, so
 * this follows the library's own established conventions rather than mirroring an upstream API.
 *
 * A read-only declarative display by default — same zero-interaction shape as `<lr-badge>`/
 * `<lr-avatar>`/`<lr-skeleton>`. The opt-in `scale="time" collision="cluster"` presentation is the
 * one exception: overlapping events collapse behind a native count button and activation emits
 * their exact element identities so the consumer can open its own popover, dialog, or detail
 * view. The component does not select, expand, reorder, or mutate the content of those items.
 *
 * No roving-tabindex or per-event selection model is introduced. Timeline items remain passive;
 * each cluster marker is an independent native `<button>` in the normal Tab sequence, so pointer,
 * Enter, and Space activation require no custom keyboard model. Not a form-associated control —
 * no value to submit, no label/hint/error chrome.
 *
 * The first member in document order represents a cluster: its ordinary shadow row is temporarily
 * replaced by the count action while the remaining members are hidden. This preserves the author's
 * list and Tab order instead of appending visually positioned controls after the slot. The action
 * exposes `cluster` and `cluster-count` parts on that representative `<lr-timeline-item>`.
 *
 * @customElement lr-timeline
 * @slot - `<lr-timeline-item>` children, in display order.
 * @event lr-cluster-activate - A `collision="cluster"` count marker was activated by pointer,
 *   Enter, or Space. `detail: { items }` contains a fresh frozen snapshot of the member
 *   `<lr-timeline-item>` elements in document order. Non-cancelable notification; the timeline has
 *   no built-in expansion or selection action to veto.
 * @csspart base - The root wrapper. `role="list"` lives here directly (a timeline isn't a navigation
 *   landmark, so it doesn't need a two-layer `base`+`list` split). Flex container: `flex-direction:
 *   column` in `vertical` orientation (the default), `flex-direction: row` (with `overflow-x: auto`,
 *   `overflow-y: hidden`, and an edge-fade `mask-image` applied only while the strip actually
 *   overflows) in `horizontal` orientation.
 * @cssprop [--lr-timeline-gap=var(--lr-space-l)] - Spacing between consecutive items along the
 *   timeline's main axis; also the length each item's own rail visually bridges to reach the next
 *   item's marker. Declared here but actually consumed inside each `<lr-timeline-item>`'s own
 *   stylesheet, via ordinary CSS custom-property inheritance across the slot boundary.
 * @cssprop [--lr-timeline-collision-offset=var(--lr-space-l)] - Cross-axis step between items
 *   stacked by `collision="stack"`. Each collision lane is indented one step further, so a wider
 *   marker can claim more room without the lanes overlapping again. Ignored unless both
 *   `scale="time"` and `collision="stack"` are set.
 * @cssprop [--lr-timeline-cluster-size=var(--lr-size-2rem)] - Minimum inline and block size of the
 *   painted count pill. Its containing button retains the shared 40px minimum action surface.
 * @cssprop [--lr-timeline-cluster-bg=var(--lr-color-brand)] - Cluster count pill background.
 * @cssprop [--lr-timeline-cluster-color=var(--lr-color-on-brand)] - Cluster count pill foreground.
 * @cssprop [--lr-timeline-time-extent=var(--lr-size-20rem)] - Distance the `scale="time"` axis
 *   distributes items along: `block-size` when vertical, `inline-size` when horizontal. Time-scaled
 *   items are absolutely positioned, and a percentage offset against an auto-sized track resolves
 *   to zero, so the axis needs a definite extent. Horizontal overlap and stack modes measure
 *   actual item/lane height independently and update it when content changes. Ignored in the
 *   default `scale="flow"`.
 * @cssprop [--lr-scroll-fade-size=2rem] - Inline size of each edge fade while a
 *   horizontal timeline overflows. Forced-colors mode disables the masks while retaining native
 *   scrolling.
 * @status stable
 * @since 4.0.0
 */
export class LyraTimeline extends LyraElement<LyraTimelineEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    timeline: LYRA_DEFAULT_timeline,
    timelineClusterCount: LYRA_DEFAULT_timelineClusterCount,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-cluster-activate',
  ]);

  protected static override readonly identityEventDetailProperties =
    Object.freeze({
      'lr-cluster-activate': Object.freeze(['items']),
    });

  static override styles = [LyraElement.styles, styles];

  /** `'vertical'` (the default) lays items out in a column, the primary/most-common use case — an
   *  audit trail or agent history reads top-to-bottom. `'horizontal'` lays them out in a row.
   *  Deliberately differs from `<lr-stepper>`'s `'horizontal'` default — don't copy that default by
   *  habit. */
  private _orientation: LyraOrientation = 'vertical';
  @property({ reflect: true })
  get orientation(): LyraOrientation {
    return this._orientation;
  }
  set orientation(value: LyraOrientation) {
    const normalized = normalizeTimelineOrientation(value);
    const previous = this._orientation;
    if (previous === normalized) {
      if (value !== normalized) this.requestUpdate('orientation', previous);
      return;
    }
    this._orientation = normalized;
    this.requestUpdate('orientation', previous);
  }

  /**
   * How items are distributed along the main axis.
   *
   * `'flow'` (the default) is today's behavior exactly: an evenly-spaced sequence, where
   * `timestamp` is rendered as text but carries no positional meaning. `'time'` positions each item
   * at its true proportion of the time range, so a gap of weeks and a gap of decades no longer look
   * identical — the shape of the history becomes visible.
   *
   * `'time'` needs a definite extent to distribute along, which comes from
   * `--lr-timeline-time-extent` (default `20rem` block-size when vertical, inline-size when
   * horizontal). Items are absolutely positioned within it. The `collision` property controls
   * whether nearby items overlap, fan into lanes, or collapse behind an activatable count marker.
   *
   * An item with no `timestamp` this component can parse (including one whose timestamp comes only
   * from the `timestamp` slot, which carries no machine-readable instant) keeps document order and
   * is distributed evenly, so a partially-timestamped list degrades rather than collapsing.
   */
  private _scale: LyraTimelineScale = 'flow';
  @property({ reflect: true })
  get scale(): LyraTimelineScale {
    return this._scale;
  }
  set scale(value: LyraTimelineScale) {
    const normalized = normalizeTimelineScale(value);
    const previous = this._scale;
    if (previous === normalized) {
      if (value !== normalized) this.requestUpdate('scale', previous);
      return;
    }
    this._scale = normalized;
    this.requestUpdate('scale', previous);
  }

  /**
   * What `scale="time"` does with items that land on (nearly) the same position.
   *
   * `'overlap'` (the default, and the only previous behavior) leaves them stacked on top of one
   * another. `'stack'` offsets each colliding item along the **cross** axis instead, so a dense
   * chronology with many same-period events stays readable. `'cluster'` represents each group of
   * overlapping items with one author-ordered member's count marker. Its collision window grows
   * from the ordinary 1.5%
   * floor to the rendered count button's footprint on the currently allocated axis, preventing
   * interactive markers from overlapping after an allocation or themed-size change. Activating it
   * emits `lr-cluster-activate` with the member elements but does not select or expand them. Ignored
   * unless `scale="time"`.
   */
  private _collision: LyraTimelineCollision = 'overlap';
  @property({ reflect: true })
  get collision(): LyraTimelineCollision {
    return this._collision;
  }
  set collision(value: LyraTimelineCollision) {
    const normalized = normalizeTimelineCollision(value);
    const previous = this._collision;
    if (previous === normalized) {
      if (value !== normalized) this.requestUpdate('collision', previous);
      return;
    }
    this._collision = normalized;
    this.requestUpdate('collision', previous);
  }

  /** Pins the axis start instead of deriving it from the earliest item. Ignored unless
   *  `scale="time"`; a non-finite or reversed pair falls back to the derived range. */
  @property({ attribute: false }) rangeStart?: Date | string | number;
  /** Pins the axis end instead of deriving it from the latest item. Ignored unless
   *  `scale="time"`; a non-finite or reversed pair falls back to the derived range. */
  @property({ attribute: false }) rangeEnd?: Date | string | number;

  /** Host-level `aria-label` override for the list's accessible name — wins over the localized
   *  default `"Timeline"`. Needed because the `role="list"` element lives in the shadow root and
   *  never inherits a host attribute automatically — same reasoning as `<lr-breadcrumb>`'s
   *  identical property. Unset falls back to the localized default; an explicitly empty
   *  `aria-label` stays empty. */
  @property({ attribute: 'aria-label' }) accessibleLabel?: string;

  // Tracks the default slot's assigned-element count purely for the `itemCount` convenience getter
  // below -- copies <lr-source-list>'s sourceCount three-part technique (pre-count in willUpdate to
  // dodge a wasted second update, reconciled in firstUpdated via the authoritative slot-based count,
  // kept live afterward via slotchange) rather than re-deriving it.
  @state() private slottedCount = 0;
  @state() private collisionClusters: readonly TimelineCluster[] =
    EMPTY_TIMELINE_CLUSTERS;
  private readonly managedClusterHiddenItems = new Set<LyraTimelineItem>();
  private readonly managedClusterRepresentatives = new Set<LyraTimelineItem>();
  private readonly clusterActivations = new Map<LyraTimelineItem, () => void>();
  private readonly timestampObservedItems = new Set<LyraTimelineItem>();
  private clusterMeasurementFrame?: number;
  private clusterMeasurementView?: Window;
  private timeExtentFrame?: number;
  private timeExtentView?: Window;
  private focusRepairGeneration = 0;

  /** Gates the horizontal [part='base'] edge fade on the strip genuinely overflowing, with
   *  one-sided/RTL-aware logical-edge state -- see --lr-scroll-fade-size and timeline.styles.ts.
   *  Harmless in the vertical default, where the strip never scrolls inline and the attribute
   *  simply stays off. Stored (rather than a bare statement-expression call) so `updated()` can
   *  register each timeline item on the controller's own `ResizeObserver` via `observeExtra()`
   *  below -- an item's own intrinsic content (a longer title, an icon loading in) can grow
   *  scrollWidth without [part='base']'s own border box changing at all. */
  private scrollOverflow = observeScrollOverflow(
    this,
    () => this.renderRoot.querySelector('[part="base"]'),
    () => {
      this.scheduleTimeExtentMeasurement();
      if (this.scale === 'time' && this.collision === 'cluster') {
        this.scheduleClusterMeasurement();
      }
    }
  );

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) {
      this.scheduleAfterUpdate(
        () => this.applyTimeScale(),
        'timeline-clusters'
      );
    }
  }

  override disconnectedCallback(): void {
    this.cancelClusterMeasurement();
    this.cancelTimeExtentMeasurement();
    this.focusRepairGeneration += 1;
    this.restoreClusterPresentation();
    this.restoreClusterVisibility();
    this.syncTimestampObservers([]);
    if (this.collisionClusters.length > 0) {
      this.collisionClusters = EMPTY_TIMELINE_CLUSTERS;
    }
    super.disconnectedCallback();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.hasUpdated) {
      // Must count only children assigned to the *default* slot -- an explicit slot="" attribute
      // still assigns to the default slot per the HTML slot algorithm, so check the attribute's
      // value rather than its mere presence. Otherwise this pre-count could disagree with
      // firstUpdated's authoritative slot-based recount below and schedule a wasted second update.
      this.slottedCount = Array.from(this.children).filter(
        (element) => !element.getAttribute('slot') && element.localName === tag('timeline-item'),
      ).length;
    }
    if (!this.hasUpdated) {
      this.seedFirstRenderState(() => this.applyTimeScale());
    } else if (
      changed.has('scale') ||
      changed.has('collision') ||
      changed.has('rangeStart') ||
      changed.has('rangeEnd')
    ) {
      this.applyTimeScale();
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    // Each slotted item's own intrinsic geometry (a longer title, an icon loading in) can alter
    // scroll reachability without [part='base']'s own border box changing at all -- the primary
    // observer above only watches that one container, so every currently-slotted item rides along
    // on its single ResizeObserver instance instead of a second one of its own. Cluster actions
    // join that observer because their public size token can change without the fixed time axis's
    // own border box changing; their footprint directly controls collision membership.
    this.scrollOverflow.observeExtra(this.timelineItems());
    this.scheduleTimeExtentMeasurement();
    if (changed.has('orientation') && this.getAttribute('orientation') !== this.orientation) {
      this.setAttribute('orientation', this.orientation);
    }
    if (
      (changed.has('collisionClusters') || changed.has('orientation')) &&
      this.collisionClusters.length > 0
    ) {
      this.scheduleAfterUpdate(
        () => this.applyTimeScale(),
        'timeline-cluster-measurement'
      );
    }
    if (this.collisionClusters.length > 0) {
      this.syncClusterPresentations(this.collisionClusters);
    }
  }

  private countTimelineItems(slot: HTMLSlotElement): number {
    return slot.assignedElements({ flatten: true }).filter((element) => element.localName === tag('timeline-item')).length;
  }

  override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    // Fallback reconciliation for slot-forwarding / engines that don't fire `slotchange` for content
    // present at parse time.
    this.scheduleAfterUpdate(
      () =>
        this.updateBrowserDerivedState(() => {
          const slot = this.shadowRoot!.querySelector(
            'slot'
          ) as HTMLSlotElement;
          this.slottedCount = this.countTimelineItems(slot);
          this.applyTimeScale();
        }),
      'timeline-first-slot-reconciliation'
    );
  }

  /** Read-only, live-updated count of default-slot `<lr-timeline-item>` assignments, including
   *  flattened forwarding slots — handy for building a `"{count} events"` header without
   *  hand-counting DOM children. */
  get itemCount(): number {
    return this.slottedCount;
  }

  private onSlotChange = (e: Event): void => {
    this.updateBrowserDerivedState(() => {
      this.slottedCount = this.countTimelineItems(e.target as HTMLSlotElement);
      this.applyTimeScale();
    });
  };

  private onTimelineItemTimestampChange = (): void => {
    if (!this.isConnected) return;
    this.scheduleAfterUpdate(
      () => this.applyTimeScale(),
      'timeline-item-timestamps'
    );
  };

  private syncTimestampObservers(items: readonly LyraTimelineItem[]): void {
    const current = new Set(items);
    for (const item of this.timestampObservedItems) {
      if (current.has(item)) continue;
      if (isTimelineClusterItemContract(item)) {
        item[OBSERVE_TIMELINE_ITEM_TIMESTAMP](
          this.onTimelineItemTimestampChange,
          false
        );
      }
      this.timestampObservedItems.delete(item);
    }
    for (const item of current) {
      if (this.timestampObservedItems.has(item)) continue;
      if (!isTimelineClusterItemContract(item)) continue;
      item[OBSERVE_TIMELINE_ITEM_TIMESTAMP](
        this.onTimelineItemTimestampChange,
        true
      );
      this.timestampObservedItems.add(item);
    }
  }

  /** The slotted `<lr-timeline-item>` children, in document order. */
  private timelineItems(): LyraTimelineItem[] {
    const slot = this.shadowRoot?.querySelector('slot') as HTMLSlotElement | null;
    const elements = slot
      ? slot.assignedElements({ flatten: true })
      : Array.from(this.children).filter(
          (element) => !element.getAttribute('slot')
        );
    return elements
      .filter(
        (element): element is LyraTimelineItem =>
          element.localName === tag('timeline-item')
      );
  }

  /** The axis bounds: an explicitly pinned pair when both ends are finite and ordered, otherwise
   *  the earliest and latest parseable item timestamps. `null` when fewer than two distinct
   *  instants exist, since a zero-width range cannot be divided. */
  private timeRange(stamps: readonly (number | null)[]): [number, number] | null {
    const pinnedStart = timelineEpochMs(this.rangeStart);
    const pinnedEnd = timelineEpochMs(this.rangeEnd);
    if (pinnedStart !== null && pinnedEnd !== null && pinnedEnd > pinnedStart) {
      return [pinnedStart, pinnedEnd];
    }
    const finite = stamps.filter((value): value is number => value !== null);
    if (finite.length < 2) return null;
    const lo = Math.min(...finite);
    const hi = Math.max(...finite);
    return hi > lo ? [lo, hi] : null;
  }

  /**
   * Writes each item's position as a percentage into `--_lr-timeline-item-offset`, consumed by
   * timeline.styles.ts's `scale="time"` rules.
   *
   * Deliberately a style write on the light-DOM child rather than a wrapper element per item: the
   * component never mutates its children's content or structure. The private position properties
   * and cluster visibility marker are presentation-only and are removed when their modes end.
   */
  private applyTimeScale(): void {
    this.scheduleTimeExtentMeasurement();
    const items = this.timelineItems();
    this.syncTimestampObservers(items);
    if (this.scale !== 'time') {
      for (const item of items) {
        item.style.removeProperty('--_lr-timeline-item-offset');
        item.style.removeProperty('--_lr-timeline-item-lane');
      }
      this.applyCollisionClusters([]);
      return;
    }
    const stamps = items.map((item) => itemEpochMs(item));
    const range = this.timeRange(stamps);
    const lastIndex = Math.max(1, items.length - 1);
    const offsets = new Array<number>(items.length).fill(0);
    items.forEach((item, index) => {
      const stamp = stamps[index] ?? null;
      // An unparseable/absent timestamp keeps document order and is spread evenly, so a partially
      // timestamped list degrades instead of stacking every unknown at the origin.
      const ratio =
        range && stamp !== null
          ? (stamp - range[0]) / (range[1] - range[0])
          : this.collision === 'cluster' && stamp !== null
          ? 0
          : index / lastIndex;
      const clamped = Math.min(1, Math.max(0, ratio));
      offsets[index] = clamped;
      item.style.setProperty('--_lr-timeline-item-offset', `${clamped * 100}%`);
    });
    this.applyCollisionLanes(items, offsets);
    this.applyCollisionClusters(
      this.collision === 'cluster'
        ? this.buildCollisionClusters(
            items,
            offsets,
            this.clusterCollisionThreshold()
          )
        : []
    );
  }

  /**
   * Assigns each time-scaled item a cross-axis lane so coincident items stop covering each other.
   *
   * Walks items in ascending offset order and gives each the lowest lane not already taken by a
   * still-colliding earlier item, so a run of three same-year events occupies lanes 0/1/2 while an
   * isolated event later on returns to lane 0 rather than inheriting the run's depth. Lane 0 is
   * written as well as the others, so switching back to `'overlap'` (or leaving `'stack'` unset)
   * clears every lane rather than leaving stale offsets on some children.
   */
  private applyCollisionLanes(
    items: readonly LyraTimelineItem[],
    offsets: readonly number[]
  ): void {
    if (this.collision !== 'stack') {
      for (const item of items) item.style.removeProperty('--_lr-timeline-item-lane');
      return;
    }
    const order = items
      .map((_, index) => index)
      .sort((a, b) => (offsets[a] ?? 0) - (offsets[b] ?? 0));
    // Lane -> the offset of the last item placed in it. An item may reuse a lane once the previous
    // occupant is far enough away to no longer overlap.
    const laneTails: number[] = [];
    const lanes = new Array<number>(items.length).fill(0);
    for (const index of order) {
      const offset = offsets[index] ?? 0;
      let lane = laneTails.findIndex(
        (tail) => offset - tail >= TIMELINE_COLLISION_THRESHOLD,
      );
      if (lane === -1) lane = laneTails.length;
      laneTails[lane] = offset;
      lanes[index] = lane;
    }
    items.forEach((item, index) => {
      item.style.setProperty('--_lr-timeline-item-lane', String(lanes[index] ?? 0));
    });
  }

  /** Groups sorted offsets into bounded collision windows. Each window is anchored at its first
   * item rather than chained transitively through every adjacent neighbour, so a large uniformly
   * dense history becomes a sequence of useful count markers instead of one axis-wide group. */
  private buildCollisionClusters(
    items: readonly LyraTimelineItem[],
    offsets: readonly number[],
    threshold: number
  ): readonly TimelineCluster[] {
    const order = items
      .map((_, index) => index)
      .sort(
        (a, b) =>
          (offsets[a] ?? 0) - (offsets[b] ?? 0) || a - b
      );
    const clusters: TimelineCluster[] = [];
    let window: number[] = [];
    let windowStart = 0;

    const flush = (): void => {
      if (window.length < 2) {
        window = [];
        return;
      }
      const memberIndexes = [...window].sort((a, b) => a - b);
      clusters.push({
        offset: windowStart,
        items: memberIndexes.map((index) => items[index]!),
      });
      window = [];
    };

    for (const index of order) {
      const offset = offsets[index] ?? 0;
      if (
        window.length > 0 &&
        offset - windowStart >= threshold
      ) {
        flush();
      }
      if (window.length === 0) windowStart = offset;
      window.push(index);
    }
    flush();
    return clusters;
  }

  /** The minimum fraction shared with stack mode, widened when the rendered native actions need
   * more of the allocated axis to avoid overlapping hit targets. Re-evaluated after every cluster
   * render and by the existing owner-realm ResizeObserver attached to the base and actions. */
  private clusterCollisionThreshold(): number {
    const base = this.renderRoot.querySelector<HTMLElement>('[part="base"]');
    if (!base) return TIMELINE_COLLISION_THRESHOLD;
    const axisExtent =
      this.orientation === 'horizontal' ? base.clientWidth : base.clientHeight;
    if (!Number.isFinite(axisExtent) || axisExtent <= 0) {
      return TIMELINE_COLLISION_THRESHOLD;
    }
    let markerExtent = 0;
    for (const item of this.managedClusterRepresentatives) {
      const marker = item.shadowRoot?.querySelector<HTMLElement>(
        '[part="cluster"]'
      );
      if (!marker) continue;
      const rect = marker.getBoundingClientRect();
      markerExtent = Math.max(
        markerExtent,
        this.orientation === 'horizontal' ? rect.width : rect.height
      );
    }
    if (!Number.isFinite(markerExtent) || markerExtent <= 0) {
      return TIMELINE_COLLISION_THRESHOLD;
    }
    return Math.max(
      TIMELINE_COLLISION_THRESHOLD,
      markerExtent / axisExtent
    );
  }

  /** Absolute time items do not contribute intrinsic height. Measure their layout boxes and
   * lane offsets after layout, sharing the existing item ResizeObserver for later content changes. */
  private scheduleTimeExtentMeasurement(): void {
    const view = this.ownerDocument?.defaultView;
    if (!view) return;
    if (this.timeExtentFrame !== undefined && this.timeExtentView === view) return;
    this.cancelTimeExtentMeasurement();
    this.timeExtentView = view;
    this.timeExtentFrame = view.requestAnimationFrame(() => {
      this.timeExtentFrame = undefined;
      this.timeExtentView = undefined;
      if (!this.isConnected || this.ownerDocument.defaultView !== view) return;
      const base = this.renderRoot.querySelector<HTMLElement>('[part="base"]');
      if (!base) return;
      if (this.scale !== 'time' || this.orientation !== 'horizontal' || this.collision === 'cluster') {
        base.style.removeProperty('--_lr-timeline-content-height');
        return;
      }
      let extent = 0;
      for (const item of this.timelineItems()) {
        if (!item.getClientRects().length) continue;
        // Integer layout APIs avoid applying author transforms twice; one pixel covers their
        // rounding. Include native horizontal scrollbar space so clientHeight covers every item.
        extent = Math.max(extent, item.offsetTop + item.offsetHeight + 1);
      }
      const height = `${extent + Math.max(0, base.offsetHeight - base.clientHeight)}px`;
      if (base.style.getPropertyValue('--_lr-timeline-content-height') !== height) {
        base.style.setProperty('--_lr-timeline-content-height', height);
      }
    });
  }

  private cancelTimeExtentMeasurement(): void {
    if (this.timeExtentFrame !== undefined && this.timeExtentView) {
      this.timeExtentView.cancelAnimationFrame(this.timeExtentFrame);
    }
    this.timeExtentFrame = undefined;
    this.timeExtentView = undefined;
  }

  /** Coalesces ResizeObserver-driven membership writes into the next owner-realm frame. Updating
   * observed cluster actions synchronously inside their observer callback would create a resize
   * notification loop whenever a larger count changes the action's footprint. */
  private scheduleClusterMeasurement(): void {
    const view = this.ownerDocument.defaultView;
    if (!view) return;
    if (
      this.clusterMeasurementFrame !== undefined &&
      this.clusterMeasurementView === view
    ) {
      return;
    }
    this.cancelClusterMeasurement();
    this.clusterMeasurementView = view;
    this.clusterMeasurementFrame = view.requestAnimationFrame(() => {
      this.clusterMeasurementFrame = undefined;
      this.clusterMeasurementView = undefined;
      if (
        this.isConnected &&
        this.ownerDocument.defaultView === view &&
        this.scale === 'time' &&
        this.collision === 'cluster'
      ) {
        this.applyTimeScale();
      }
    });
  }

  private cancelClusterMeasurement(): void {
    if (
      this.clusterMeasurementFrame !== undefined &&
      this.clusterMeasurementView
    ) {
      this.clusterMeasurementView.cancelAnimationFrame(
        this.clusterMeasurementFrame
      );
    }
    this.clusterMeasurementFrame = undefined;
    this.clusterMeasurementView = undefined;
  }

  private sameClusters(
    left: readonly TimelineCluster[],
    right: readonly TimelineCluster[]
  ): boolean {
    return (
      left.length === right.length &&
      left.every(
        (cluster, index) =>
          cluster.offset === right[index]?.offset &&
          cluster.items.length === right[index]?.items.length &&
          cluster.items.every(
            (item, itemIndex) => item === right[index]?.items[itemIndex]
          )
      )
    );
  }

  private captureClusterFocusRepair(
    clusters: readonly TimelineCluster[]
  ):
    | {
        readonly item: LyraTimelineItem;
        readonly mode: 'cluster' | 'item';
        readonly snapshot: ComposedFocusRepairSnapshot;
      }
    | undefined {
    const active = safelyDeepActiveElement(this.ownerDocument);
    if (!active) return undefined;
    const focusedItem = this.timelineItems().find(
      (item) =>
        item === active ||
        safelyContainsActive(item, active) ||
        safelyDeepActiveElement(item.shadowRoot) === active
    );
    if (!focusedItem) return undefined;
    const wasRepresentative = this.managedClusterRepresentatives.has(focusedItem);
    const nextCluster = clusters.find((cluster) =>
      cluster.items.includes(focusedItem)
    );
    const nextRepresentative = nextCluster?.items[0];
    const mode = nextCluster ? 'cluster' : 'item';
    if (
      (mode === 'cluster' &&
        wasRepresentative &&
        nextRepresentative === focusedItem) ||
      (mode === 'item' && !wasRepresentative)
    ) {
      return undefined;
    }
    const base = this.renderRoot.querySelector<HTMLElement>('[part="base"]');
    let snapshot: ComposedFocusRepairSnapshot | null;
    try {
      snapshot = captureComposedFocusRepair(focusedItem, base);
    } catch {
      return undefined;
    }
    if (!snapshot) return undefined;
    return {
      item: mode === 'cluster' ? nextRepresentative! : focusedItem,
      mode,
      snapshot,
    };
  }

  private scheduleClusterFocusRepair(
    repair:
      | {
          readonly item: LyraTimelineItem;
          readonly mode: 'cluster' | 'item';
          readonly snapshot: ComposedFocusRepairSnapshot;
        }
      | undefined
  ): void {
    const generation = ++this.focusRepairGeneration;
    if (!repair) return;
    void repair.item.updateComplete.then(() => {
      if (generation !== this.focusRepairGeneration || !this.isConnected) return;
      const base = this.renderRoot.querySelector<HTMLElement>('[part="base"]');
      const target =
        repair.mode === 'cluster'
          ? repair.item.shadowRoot?.querySelector<HTMLElement>(
              '[part="cluster"]'
            ) ?? null
          : collectComposedFocusTargets(repair.item).elements[0] ?? base;
      try {
        applyComposedFocusRepair(repair.snapshot, target);
      } catch {
        // Focus ownership changed into an unreadable partial DOM after capture.
      }
    });
  }

  private applyCollisionClusters(clusters: readonly TimelineCluster[]): void {
    const frozen = Object.freeze(
      clusters.map((cluster) =>
        Object.freeze({
          offset: cluster.offset,
          items: Object.freeze([...cluster.items]),
        })
      )
    );
    const changed = !this.sameClusters(this.collisionClusters, frozen);
    const focusRepair = changed
      ? this.captureClusterFocusRepair(frozen)
      : undefined;
    const representatives = new Set(
      frozen.map((cluster) => cluster.items[0]!)
    );
    const hiddenItems = new Set(
      frozen.flatMap((cluster) =>
        cluster.items.filter((item) => !representatives.has(item))
      )
    );

    for (const item of this.managedClusterHiddenItems) {
      if (hiddenItems.has(item)) {
        if (!item.hasAttribute(CLUSTER_HIDDEN_ATTRIBUTE)) {
          item.setAttribute(CLUSTER_HIDDEN_ATTRIBUTE, '');
        }
        continue;
      }
      if (item.getAttribute(CLUSTER_HIDDEN_ATTRIBUTE) === '') {
        item.removeAttribute(CLUSTER_HIDDEN_ATTRIBUTE);
      }
      this.managedClusterHiddenItems.delete(item);
    }
    for (const item of hiddenItems) {
      if (this.managedClusterHiddenItems.has(item)) continue;
      if (!item.hasAttribute(CLUSTER_HIDDEN_ATTRIBUTE)) {
        item.setAttribute(CLUSTER_HIDDEN_ATTRIBUTE, '');
        this.managedClusterHiddenItems.add(item);
      }
    }

    if (changed) {
      this.restoreClusterPresentation();
      for (const cluster of frozen) {
        const representative = cluster.items[0]!;
        this.clusterActivations.set(representative, () =>
          this.activateCluster(cluster.items)
        );
        this.managedClusterRepresentatives.add(representative);
      }
      this.collisionClusters = frozen;
      this.syncClusterPresentations(frozen);
      this.scheduleClusterFocusRepair(focusRepair);
    }
    for (const cluster of frozen) {
      cluster.items[0]!.style.setProperty(
        '--_lr-timeline-item-offset',
        `${cluster.offset * 100}%`
      );
    }
  }

  private syncClusterPresentations(
    clusters: readonly TimelineCluster[]
  ): void {
    for (const cluster of clusters) {
      const representative = cluster.items[0]!;
      const activate = this.clusterActivations.get(representative);
      if (!activate) continue;
      const countText = getNumberFormat(this.effectiveLocale).format(
        cluster.items.length
      );
      if (!isTimelineClusterItemContract(representative)) continue;
      representative[SET_TIMELINE_CLUSTER_PRESENTATION]({
        accessibleLabel: this.localize(
          'timelineClusterCount',
          undefined,
          { count: countText }
        ),
        countText,
        activate,
      });
    }
  }

  private restoreClusterPresentation(): void {
    for (const item of this.managedClusterRepresentatives) {
      if (isTimelineClusterItemContract(item)) {
        item[SET_TIMELINE_CLUSTER_PRESENTATION](undefined);
      }
    }
    this.managedClusterRepresentatives.clear();
    this.clusterActivations.clear();
  }

  private restoreClusterVisibility(): void {
    for (const item of this.managedClusterHiddenItems) {
      if (item.getAttribute(CLUSTER_HIDDEN_ATTRIBUTE) === '') {
        item.removeAttribute(CLUSTER_HIDDEN_ATTRIBUTE);
      }
    }
    this.managedClusterHiddenItems.clear();
  }

  private activateCluster(items: readonly LyraTimelineItem[]): void {
    const snapshot = this.ownerDocument.defaultView?.Array.from(items) ?? [
      ...items,
    ];
    this.emit(
      'lr-cluster-activate',
      Object.freeze({ items: Object.freeze(snapshot) })
    );
  }

  override render(): TemplateResult {
    return html`
      <div part="base" role="list" tabindex="-1" aria-label=${this.accessibleLabel == null ? this.localize('timeline') : this.accessibleLabel}>
        <slot @slotchange=${this.onSlotChange}></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-timeline': LyraTimeline;
  }
}

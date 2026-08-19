import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import { observeScrollOverflow } from '../../../internal/scroll-overflow.js';
import type { LyraOrientation } from '../../../internal/shared-unions.js';
import { styles } from './timeline.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_timeline } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const normalizeTimelineOrientation = (value: unknown): LyraOrientation =>
  value === 'horizontal' ? 'horizontal' : 'vertical';

/** How a timeline distributes its items along the main axis. */
export type LyraTimelineScale = 'flow' | 'time';

const normalizeTimelineScale = (value: unknown): LyraTimelineScale =>
  value === 'time' ? 'time' : 'flow';

/** How `scale="time"` handles items that land on (nearly) the same position. */
export type LyraTimelineCollision = 'overlap' | 'stack';

const normalizeTimelineCollision = (value: unknown): LyraTimelineCollision =>
  value === 'stack' ? 'stack' : 'overlap';

/**
 * Two time-scaled items collide when their axis offsets are within this fraction of the axis.
 *
 * Expressed against the axis rather than in pixels because the axis extent is a themeable token
 * (`--lr-timeline-time-extent`) the component never measures; a pixel threshold would silently mean
 * something different at every extent. 1.5% of a 20rem axis is ~5px, close enough that two markers
 * genuinely overlap.
 */
const TIMELINE_COLLISION_THRESHOLD = 0.015;

/**
 * Epoch milliseconds for one item's `timestamp`, or `null` when it has none this component can
 * place. Accepts the same `Date | string | number` union `<lr-timeline-item>` itself takes, so a
 * consumer never has to reformat data for the axis. A `timestamp` slot override is deliberately NOT
 * consulted: arbitrary slotted content carries no machine-readable instant.
 */
function itemEpochMs(element: Element): number | null {
  const raw = (element as { timestamp?: Date | string | number }).timestamp;
  if (raw == null) return null;
  const date =
    raw instanceof Date ? raw : typeof raw === 'number' ? new Date(raw) : new Date(String(raw));
  const ms = date.getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * `<lr-timeline>` — an ordered, connected sequence of past-event rows (an audit trail, an agent
 * action history, a changelog) composed from `<lr-timeline-item>` light-DOM children, joined by a
 * continuous connecting rail. First-party invention: no Web Awesome/Shoelace counterpart exists, so
 * this follows the library's own established conventions rather than mirroring an upstream API.
 *
 * A pure, read-only, declarative display component — same zero-event shape as `<lr-badge>`/
 * `<lr-avatar>`/`<lr-skeleton>`. It never mutates its own children and fires no events; a
 * consumer who needs to react to item count changes already owns the mutation (they're the one
 * adding/removing `<lr-timeline-item>` children) and can listen to the native `slotchange` event
 * directly if truly needed.
 *
 * No keyboard navigation, roving-tabindex, or selection model of any kind — a deliberate scope
 * decision, not an oversight. A timeline is a passive record display, not a navigable widget; see
 * `<lr-timeline-item>`'s class doc for the full reasoning behind dropping an earlier
 * "interactive row" design. Not a form-associated control — no value to submit, no label/hint/error
 * chrome.
 *
 * @customElement lr-timeline
 * @slot - `<lr-timeline-item>` children, in display order.
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
 * @cssprop [--lr-timeline-time-extent=var(--lr-size-20rem)] - Distance the `scale="time"` axis
 *   distributes items along: `block-size` when vertical, `inline-size` when horizontal. Time-scaled
 *   items are absolutely positioned, and a percentage offset against an auto-sized track resolves
 *   to zero, so the axis needs a definite extent. Ignored in the default `scale="flow"`.
 * @cssprop [--lr-scroll-fade-size=2rem] - Inline size of each edge fade while a
 *   horizontal timeline overflows. Forced-colors mode disables the masks while retaining native
 *   scrolling.
 * @status stable
 * @since 4.0.0
 */
export class LyraTimeline extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    timeline: LYRA_DEFAULT_timeline,
  };
  // GENERATED DEFAULT-STRING SLICE: END

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
   * horizontal). Items are absolutely positioned within it, so two events sharing a date overlap
   * rather than being fanned into lanes; a dense dataset needing lane assignment, brushing, or
   * per-event selection is a different component than this deliberately passive one.
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
   * chronology stays readable — with ~1,800 events over ~330 years, same-period collisions are the
   * common case rather than the exception. Ignored unless `scale="time"`.
   *
   * There is deliberately no `'cluster'` mode. Collapsing coincident items into one marker with a
   * count that expands on interaction needs a selection model and click events, and this component
   * is documented as passive with neither; adding them here would change what `lr-timeline` is
   * rather than extend it.
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

  /** Gates the horizontal [part='base'] edge fade on the strip genuinely overflowing, with
   *  one-sided/RTL-aware logical-edge state -- see --lr-scroll-fade-size and timeline.styles.ts.
   *  Harmless in the vertical default, where the strip never scrolls inline and the attribute
   *  simply stays off. Stored (rather than a bare statement-expression call) so `updated()` can
   *  register each timeline item on the controller's own `ResizeObserver` via `observeExtra()`
   *  below -- an item's own intrinsic content (a longer title, an icon loading in) can grow
   *  scrollWidth without [part='base']'s own border box changing at all. */
  private scrollOverflow = observeScrollOverflow(this, () =>
    this.renderRoot.querySelector("[part='base']")
  );

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
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    // Each slotted item's own intrinsic geometry (a longer title, an icon loading in) can alter
    // scroll reachability without [part='base']'s own border box changing at all -- the primary
    // observer above only watches that one container, so every currently-slotted item rides along
    // on its single ResizeObserver instance instead of a second one of its own. Harmless in the
    // vertical default: observing an element the mask never reads from costs nothing.
    this.scrollOverflow.observeExtra(this.timelineItems());
    if (changed.has('orientation') && this.getAttribute('orientation') !== this.orientation) {
      this.setAttribute('orientation', this.orientation);
    }
    if (
      changed.has('scale') ||
      changed.has('collision') ||
      changed.has('rangeStart') ||
      changed.has('rangeEnd')
    ) {
      this.applyTimeScale();
    }
  }

  private countTimelineItems(slot: HTMLSlotElement): number {
    return slot.assignedElements({ flatten: true }).filter((element) => element.localName === tag('timeline-item')).length;
  }

  override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    // Fallback reconciliation for slot-forwarding / engines that don't fire `slotchange` for content
    // present at parse time.
    const slot = this.shadowRoot!.querySelector('slot') as HTMLSlotElement;
    this.slottedCount = this.countTimelineItems(slot);
    this.applyTimeScale();
  }

  /** Read-only, live-updated count of the currently-slotted `<lr-timeline-item>` children — handy
   *  for building a `"{count} events"` header without hand-counting DOM children. */
  get itemCount(): number {
    return this.slottedCount;
  }

  private onSlotChange = (e: Event): void => {
    this.slottedCount = this.countTimelineItems(e.target as HTMLSlotElement);
    this.applyTimeScale();
  };

  /** The slotted `<lr-timeline-item>` children, in document order. */
  private timelineItems(): HTMLElement[] {
    const slot = this.shadowRoot?.querySelector('slot') as HTMLSlotElement | null;
    if (!slot) return [];
    return slot
      .assignedElements({ flatten: true })
      .filter((element): element is HTMLElement => element.localName === tag('timeline-item'));
  }

  /** The axis bounds: an explicitly pinned pair when both ends are finite and ordered, otherwise
   *  the earliest and latest parseable item timestamps. `null` when fewer than two distinct
   *  instants exist, since a zero-width range cannot be divided. */
  private timeRange(stamps: readonly (number | null)[]): [number, number] | null {
    const pinnedStart = this.rangeStart == null ? null : itemEpochMs({ timestamp: this.rangeStart } as unknown as Element);
    const pinnedEnd = this.rangeEnd == null ? null : itemEpochMs({ timestamp: this.rangeEnd } as unknown as Element);
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
   * component's whole contract is that it never mutates its children's content or structure, and a
   * custom property is the one mutation that stays invisible to the consumer's own DOM shape. The
   * property is removed again in `'flow'`, so toggling back leaves no residue.
   */
  private applyTimeScale(): void {
    const items = this.timelineItems();
    if (this.scale !== 'time') {
      for (const item of items) {
        item.style.removeProperty('--_lr-timeline-item-offset');
        item.style.removeProperty('--_lr-timeline-item-lane');
      }
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
          : index / lastIndex;
      const clamped = Math.min(1, Math.max(0, ratio));
      offsets[index] = clamped;
      item.style.setProperty('--_lr-timeline-item-offset', `${clamped * 100}%`);
    });
    this.applyCollisionLanes(items, offsets);
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
  private applyCollisionLanes(items: readonly HTMLElement[], offsets: readonly number[]): void {
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

  override render(): TemplateResult {
    return html`
      <div part="base" role="list" aria-label=${this.accessibleLabel == null ? this.localize('timeline') : this.accessibleLabel}>
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

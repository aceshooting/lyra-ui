import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './timeline-item.styles.js';
import type { LyraMessageKey } from '../../../internal/localization-types.js';
import { getDateTimeFormat, getNumberFormat } from '../../../internal/intl-cache.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import type { LyraVariant } from '../../../internal/variants.js';
import {
  OBSERVE_TIMELINE_ITEM_TIMESTAMP,
  SET_TIMELINE_CLUSTER_PRESENTATION,
  SET_TIMELINE_ITEM_ORDINAL,
  TIMELINE_ITEM_ORDINAL_OF,
  isTimelineOrdinalOwner,
  type TimelineClusterPresentation,
  type TimelineTimestampObserver,
  timeValueChanged,
} from './timeline-cluster.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_timelineItemVariantBrand, LYRA_DEFAULT_timelineItemVariantWarning } from '../../../internal/default-strings/data.generated.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_statusError, LYRA_DEFAULT_statusSuccess } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const timelineItemVariantConverter = {
  fromAttribute(value: string | null): LyraVariant {
    return normalizeTimelineItemVariant(value);
  },
  toAttribute(value: LyraVariant): string | null {
    return value === 'neutral' ? null : value;
  },
};

const normalizeTimelineItemVariant = (value: unknown): LyraVariant =>
  value === 'brand' ||
  value === 'success' ||
  value === 'warning' ||
  value === 'danger'
    ? value
    : 'neutral';

const VARIANT_NAME_KEYS: Partial<Record<LyraVariant, LyraMessageKey>> = {
  brand: 'timelineItemVariantBrand',
  success: 'statusSuccess',
  warning: 'timelineItemVariantWarning',
  danger: 'statusError',
};

/**
 * `<lr-timeline-item>` — one marker + title + optional timestamp + optional description row inside
 * `<lr-timeline>`'s default slot. See that component's class doc for the overall shape; this class
 * doc covers the rail-connecting mechanism this item's own `[part="track"]`/`[part="rail"]`
 * implement.
 *
 * Each item owns and renders *its own trailing rail segment*, not the whole connecting line — think
 * of it as a linked list of line segments, one per item, each reaching toward the next item's marker.
 * `[part="track"]` (marker then rail) is a flex sibling of `[part="content"]` inside `[part="base"]`,
 * with `[part="base"]`'s default `align-items: stretch` left alone — so `[part="track"]`'s
 * cross-axis size automatically equals `[part="content"]`'s own size, including any content-driven
 * height from a long slotted description. `[part="rail"]` is `flex: 1 1 auto` inside `[part="track"]`,
 * so once the marker (fixed size) takes its share, the rail fills the rest — no JS measurement, no
 * `ResizeObserver`, no absolute positioning. `[part="content"]` carries a trailing logical padding
 * (block-end in vertical mode, inline-end in horizontal mode) equal to `<lr-timeline>`'s
 * `--lr-timeline-gap`, so the stretched rail visually reaches *into* the gap before the next item's
 * marker with no seam. The last item's rail is suppressed by `<lr-timeline>`'s own pure-CSS
 * `::slotted(:last-child)` rule (see that component's stylesheet) — no JS coordination between the
 * two components is needed anywhere in this mechanism.
 *
 * A pure display row by default: no events, no keyboard interaction, and no selection/expansion
 * state of its own — a deliberate scope decision, not an oversight. When a parent timeline opts
 * into collision clustering, the first item in each author-ordered group temporarily represents
 * that group with a native count button in this item's list position; activation still belongs to
 * the parent timeline and emits its `lr-cluster-activate` event. An earlier "interactive row"
 * design (mirroring
 * `<lr-conversation-item>`'s clickable `role="button"` row) was considered and dropped: this
 * component's `title` and `description` are slots that routinely contain focusable content of their
 * own (a link, a button) — wrapping them in an ancestor `role="button"` would trip axe's
 * `nested-interactive` rule the moment a consumer slots one in, unlike `<lr-conversation-item>`,
 * which keeps its own focusable content in a sibling `actions` slot specifically to avoid that. A
 * consumer who wants a clickable entry slots an actual interactive element inside `description`
 * themselves — `role="listitem"` places no restriction on focusable descendants. Not a
 * form-associated control — no value to submit, no label/hint/error chrome.
 *
 * @customElement lr-timeline-item
 * @slot - The item's primary heading/title content. Rich content allowed (inline code, a badge, a
 *   link) — nothing renders when this slot is empty, a valid if unusual usage.
 * @slot marker-icon - Marker/glyph override (e.g. a `<lr-icon>`, an emoji, a small avatar-like
 *   element). When empty, the marker falls back to a plain color-coded dot driven by `variant`.
 * @slot timestamp - Full override of the timestamp presentation (e.g.
 *   `<lr-format-date slot="timestamp">`, a custom string, a differently-configured
 *   `<lr-relative-time>`). Wins over the `timestamp` property whenever it has assigned content,
 *   even if `timestamp` is also set. Falls back to an internally-rendered `<lr-relative-time>`
 *   (driven by the `timestamp` property) wrapped in a `<time>`, or renders nothing at all
 *   (`[part="timestamp"]` hidden) when neither the slot nor a valid `timestamp` is present.
 * @slot description - Secondary/body content below the title (explanatory text, a diff snippet, a
 *   "view details" affordance). `[part="description"]` is hidden entirely when this slot is empty.
 * @csspart base - The root wrapper. Flex container; `flex-direction` is driven by the
 *   parent timeline's private cross-shadow orientation state -- `row` in vertical-timeline mode
 *   (marker beside content), `column` in horizontal-timeline mode (marker above content).
 * @csspart track - Wrapper around the marker and rail (the "spine"). Always the opposite axis from
 *   `[part="base"]` -- see the class doc's rail-mechanism note.
 * @csspart marker - The dot/icon circle. `aria-hidden="true"` -- purely decorative, the item's
 *   accessible content is its title/timestamp/description text -- except inside an `ordered`
 *   `<lr-timeline>`, where it is a ring (`--lr-timeline-marker-color` border, transparent fill)
 *   around `marker-number`, is exposed to assistive technology, and replaces the `marker-icon`
 *   slot. Its default size there is `--lr-size-1-5rem`, and it widens for a long number.
 * @csspart marker-number - The step number inside the marker, rendered only inside an `ordered`
 *   `<lr-timeline>`: real text formatted for the effective locale.
 * @csspart rail - The connecting line segment extending from this item's marker toward the next
 *   item's marker. Hidden (`visibility: hidden`, not removed) for the last item in a
 *   `<lr-timeline>` -- see the class doc.
 * @csspart content - Wrapper around `header` and `description`.
 * @csspart header - Flex row wrapping `title` and `timestamp`; wraps at narrow widths rather than
 *   truncating either.
 * @csspart title - Wrapper around the default (title) slot.
 * @csspart timestamp - Wrapper around the `timestamp` slot / the internally-rendered `<time>`
 *   fallback. Hidden entirely when there's nothing to show.
 * @csspart description - Wrapper around the `description` slot. Hidden entirely when the slot is
 *   empty.
 * @csspart cluster - The native count-marker button rendered while this item represents a parent
 *   timeline collision cluster; retains the shared 40px minimum action surface.
 * @csspart cluster-count - The painted count pill inside a representative cluster button.
 * @cssprop [--lr-timeline-marker-size=var(--lr-size-1-25rem)] - Diameter of the marker circle
 *   (both inline-size and block-size, so the default dot stays circular). Inherits from theme
 *   ancestors.
 * @cssprop [--lr-timeline-marker-number-color=var(--lr-color-text)] - Step-number colour inside an
 *   `ordered` timeline's marker ring.
 * @cssprop [--lr-timeline-rail-width=var(--lr-border-width-medium)] - Thickness of the
 *   connecting rail line. Inherits from theme ancestors.
 * @cssprop [--lr-timeline-rail-color=var(--lr-color-border-subtle)] - Color of the connecting rail
 *   line. A component-scoped property (not just inlining `var(--lr-color-border-subtle)` at every
 *   use site) so a consumer can retint just the rail without touching the library-wide border color
 *   elsewhere. Inherits from theme ancestors.
 * @cssprop [--lr-timeline-marker-color=var(--lr-color-text-quiet)] - Marker fill/accent color.
 *   Its private default changes per `variant` (see the class doc's variant table); a consumer can
 *   override it on an ancestor for a themed group or directly on one item, with the direct value
 *   winning via the normal cascade.
 * @cssprop [--lr-timeline-active-ring-color=var(--lr-timeline-marker-color)] - Static outline color
 *   for the current/in-progress marker. The outline remains visible when reduced motion disables
 *   the optional pulse animation.
 * @cssprop [--lr-timeline-cluster-size=var(--lr-size-2rem)] - Minimum inline and block size of the
 *   painted cluster count pill. Its containing button retains the shared 40px minimum action
 *   surface.
 * @cssprop [--lr-timeline-cluster-bg=var(--lr-color-brand)] - Cluster count pill background.
 * @cssprop [--lr-timeline-cluster-color=var(--lr-color-on-brand)] - Cluster count pill foreground.
 * @status stable
 * @since 4.0.0
 */
export class LyraTimelineItem extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    statusError: LYRA_DEFAULT_statusError,
    statusSuccess: LYRA_DEFAULT_statusSuccess,
    timelineItemVariantBrand: LYRA_DEFAULT_timelineItemVariantBrand,
    timelineItemVariantWarning: LYRA_DEFAULT_timelineItemVariantWarning,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** When this event happened. Accepts a `Date`, anything `new Date()` can parse (e.g. an ISO 8601
   *  string), or epoch milliseconds. Invalid/unparseable input normalizes to "unset" -- no timestamp
   *  UI renders, identical to `timestamp` never having been set at all. `attribute: false` since
   *  `Date` instances aren't attribute-serializable -- set via a property binding
   *  (`.timestamp=${...}`) or imperatively, never a plain HTML attribute. Ignored entirely when the
   *  `timestamp` slot has assigned content -- see the class doc / that slot's own description. */
  @property({ attribute: false, hasChanged: timeValueChanged }) timestamp?: Date | string | number;

  /** Forwarded 1:1 onto the internally-rendered `<lr-relative-time>`'s own `sync` property, so a
   *  live feed (e.g. streaming agent actions) can opt this item into auto-refreshing relative text
   *  ("just now" ticking to "1 minute ago"). Named to match `<lr-relative-time>`'s own `sync`
   *  property verbatim. Has no effect when the `timestamp` slot is populated -- there is no internal
   *  `<lr-relative-time>` to forward onto in that case. */
  @property({ type: Boolean }) sync = false;

  /** Tone of the marker. `'neutral'` (default) is a plain past event; `'brand'` is highlighted/
   *  informational; `'success'` is completed positively (e.g. a successful deploy); `'warning'` needs
   *  attention; `'danger'` is a failed/error event. The library-wide `LyraVariant` set. */
  private _variant: LyraVariant = 'neutral';
  @property({ reflect: true, converter: timelineItemVariantConverter })
  get variant(): LyraVariant {
    return this._variant;
  }
  set variant(value: LyraVariant) {
    const normalized = normalizeTimelineItemVariant(value);
    const raw = this.getAttribute('variant');
    if (raw !== null && raw !== normalized) {
      const reflected = timelineItemVariantConverter.toAttribute(normalized);
      if (reflected === null) this.removeAttribute('variant');
      else this.setAttribute('variant', reflected);
    }
    const previous = this._variant;
    if (previous === normalized) return;
    this._variant = normalized;
    this.requestUpdate('variant', previous);
  }

  /** Marks this as the current/in-progress item (e.g. "the agent is executing this step right now"),
   *  as opposed to a resolved past entry. Drives a pulsing marker (disabled under
   *  `prefers-reduced-motion: reduce`) and an explicit `aria-current` state on the host. */
  @property({ type: Boolean, reflect: true }) active = false;

  // Slot content replaces the internal timestamp/description/dot markup outright, so presence is
  // tracked in JS; the icon only suppresses the dot fill and keeps [part='marker'] visible.
  private readonly slotPresence = new SlotPresenceController(this);
  @state() private clusterPresentation?: TimelineClusterPresentation;
  /** Step number pushed by an `ordered` parent timeline; `undefined` renders the ordinary marker. */
  @state() private ordinal?: number;
  private readonly timestampObservers = new Set<TimelineTimestampObserver>();
  private timestampObserversReady = false;

  /** @internal */
  [SET_TIMELINE_CLUSTER_PRESENTATION](
    presentation: TimelineClusterPresentation | undefined
  ): void {
    const current = this.clusterPresentation;
    if (
      current === presentation ||
      (current !== undefined &&
        presentation !== undefined &&
        current.accessibleLabel === presentation.accessibleLabel &&
        current.countText === presentation.countText &&
        current.activate === presentation.activate)
    ) {
      return;
    }
    this.clusterPresentation = presentation;
  }

  /** @internal */
  [SET_TIMELINE_ITEM_ORDINAL](ordinal: number | undefined): void {
    this.ordinal = ordinal;
  }

  /** @internal */
  [OBSERVE_TIMELINE_ITEM_TIMESTAMP](
    observer: TimelineTimestampObserver,
    observe: boolean
  ): void {
    if (observe) this.timestampObservers.add(observer);
    else this.timestampObservers.delete(observer);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'listitem');
    // An item that upgrades after its ordered timeline last numbered its children reads its own
    // number once; the timeline pushes every later change.
    const owner = this.parentElement;
    if (this.ordinal === undefined && isTimelineOrdinalOwner(owner)) {
      this.ordinal = owner[TIMELINE_ITEM_ORDINAL_OF](this);
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    // aria-current lives on the host (role="listitem" does too -- see connectedCallback), so it's a
    // plain imperative attribute write here rather than part of render()'s shadow-DOM template.
    if (this.clusterPresentation) this.removeAttribute('aria-current');
    else this.setAttribute('aria-current', String(this.active));
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.timestampObserversReady && changed.has('timestamp')) {
      this.scheduleAfterUpdate(
        () => {
          for (const observer of [...this.timestampObservers]) observer();
        },
        'timeline-item-timestamp-observers'
      );
    }
    this.timestampObserversReady = true;
  }

  private get normalizedTimestamp(): Date | undefined {
    if (this.timestamp === undefined) return undefined;
    const date =
      this.timestamp instanceof Date
        ? this.timestamp
        : new Date(this.timestamp);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  override render(): TemplateResult {
    if (this.clusterPresentation) {
      return html`
        <button
          part="cluster"
          type="button"
          aria-label=${this.clusterPresentation.accessibleLabel}
          @click=${this.clusterPresentation.activate}
        >
          <span part="cluster-count" aria-hidden="true"
            >${this.clusterPresentation.countText}</span
          >
        </button>
      `;
    }
    const ts = this.normalizedTimestamp;
    const showTimestampFallback = !this.slotPresence.has('timestamp') && ts !== undefined;
    const showTimestamp = this.slotPresence.has('timestamp') || ts !== undefined;
    // Intl-formatted absolute date/time -- caller/data formatting exempt from localize() routing per
    // AGENTS.md's i18n carve-out for Intl-formatted dates. Never hand-rolled.
    const absolute = ts
      ? getDateTimeFormat(this.effectiveLocale || undefined, {
          dateStyle: 'long',
          timeStyle: 'short',
        }).format(ts)
      : '';

    const variantKey = VARIANT_NAME_KEYS[this._variant];
    return html`
      <div part="base">
        <div part="track">
          ${this.ordinal !== undefined
            ? html`<span part="marker" data-ordered
                ><span part="marker-number"
                  >${getNumberFormat(this.effectiveLocale || undefined, { useGrouping: false }).format(this.ordinal)}</span
                ></span
              >`
            : html`<span
                part="marker"
                aria-hidden="true"
                ?data-has-icon=${this.slotPresence.has('marker-icon')}
              >
                <slot
                  name="marker-icon"
                ></slot>
              </span>`}
          <span part="rail"></span>
        </div>
        <div part="content">
          <div part="header">
            <span part="title"
              >${variantKey
                ? html`<span class="sr-only" data-variant-name>${this.localize(variantKey)}: </span>`
                : nothing}<slot></slot
            ></span>
            <span part="timestamp" ?hidden=${!showTimestamp}>
              <slot
                name="timestamp"
              ></slot>
              ${showTimestampFallback
                ? html`<time datetime=${ts!.toISOString()} title=${absolute}>
                    <lr-relative-time
                      .date=${ts!}
                      .sync=${this.sync}
                    ></lr-relative-time>
                  </time>`
                : nothing}
            </span>
          </div>
          <span part="description" ?hidden=${!this.slotPresence.has('description')}>
            <slot
              name="description"
            ></slot>
          </span>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-timeline-item': LyraTimelineItem;
  }
}

import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './timeline-item.styles.js';
import { getDateTimeFormat } from '../../../internal/intl-cache.js';

export type TimelineItemVariant = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

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
 * A pure display row: no events, no keyboard interaction, and no selection/expansion state of its
 * own — a deliberate scope decision, not an oversight. An earlier "interactive row" design (mirroring
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
 * @slot icon - Leading marker/glyph override (e.g. a `<lr-icon>`, an emoji, a small avatar-like
 *   element). Falls back to a plain color-coded dot (driven by `variant`) when empty.
 * @slot timestamp - Full override of the timestamp presentation (e.g.
 *   `<lr-format-date slot="timestamp">`, a custom string, a differently-configured
 *   `<lr-relative-time>`). Wins over the `timestamp` property whenever it has assigned content,
 *   even if `timestamp` is also set. Falls back to an internally-rendered `<lr-relative-time>`
 *   (driven by the `timestamp` property) wrapped in a `<time>`, or renders nothing at all
 *   (`[part="timestamp"]` hidden) when neither the slot nor a valid `timestamp` is present.
 * @slot description - Secondary/body content below the title (explanatory text, a diff snippet, a
 *   "view details" affordance). `[part="description"]` is hidden entirely when this slot is empty.
 * @csspart base - The root wrapper. Flex container; `flex-direction` is driven by the
 *   `--lr-timeline-item-direction` custom property inherited from `<lr-timeline>`'s `:host` --
 *   `row` in vertical-timeline mode (marker beside content), `column` in horizontal-timeline mode
 *   (marker above content).
 * @csspart track - Wrapper around the marker and rail (the "spine"). Always the opposite axis from
 *   `[part="base"]` -- see the class doc's rail-mechanism note.
 * @csspart marker - The dot/icon circle. Always `aria-hidden="true"` -- purely decorative, the
 *   item's accessible content is its title/timestamp/description text.
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
 * @cssprop [--lr-timeline-marker-size=var(--lr-size-1-25rem)] - Diameter of the marker circle
 *   (both inline-size and block-size, so the default dot stays circular).
 * @cssprop [--lr-timeline-rail-width=var(--lr-border-width-medium)] - Thickness of the
 *   connecting rail line.
 * @cssprop [--lr-timeline-rail-color=var(--lr-color-border)] - Color of the connecting rail
 *   line. A component-scoped property (not just inlining `var(--lr-color-border)` at every use
 *   site) so a consumer can retint just the rail without touching the library-wide border color
 *   elsewhere.
 * @cssprop [--lr-timeline-marker-color=var(--lr-color-text-quiet)] - Marker fill/accent color.
 *   Swapped per `variant` (see the class doc's variant table); a consumer overriding this directly on
 *   one item wins over the variant default via normal CSS cascade/specificity.
 * @cssprop [--lr-timeline-item-direction=row] - Internal orientation plumbing, not a retheming
 *   knob: `[part="base"]`'s `flex-direction`, set by an ancestor `<lr-timeline>`'s `:host` and
 *   inherited across the slot boundary (`row` vertical, `column` horizontal). The `row` fallback
 *   applies when the item is used standalone.
 * @cssprop [--lr-timeline-item-track-direction=column] - Internal orientation plumbing, not a
 *   retheming knob: `[part="track"]`'s `flex-direction`, always the opposite axis from
 *   `--lr-timeline-item-direction` and set alongside it by `<lr-timeline>`.
 * @cssprop [--lr-timeline-item-gap-block-end=0] - Internal orientation plumbing, not a retheming
 *   knob: `[part="content"]`'s `padding-block-end`, set by a vertical `<lr-timeline>` so the rail
 *   reaches the next item's marker. `0` when standalone or horizontal; retheme
 *   `--lr-timeline-gap` on `<lr-timeline>` instead.
 * @cssprop [--lr-timeline-item-gap-inline-end=0] - Internal orientation plumbing, not a retheming
 *   knob: the inline-axis counterpart of `--lr-timeline-item-gap-block-end`, non-zero only under a
 *   horizontal `<lr-timeline>`.
 * @cssprop [--lr-timeline-item-rail-visibility=visible] - Internal plumbing, not a retheming knob:
 *   `[part="rail"]`'s `visibility`, set to `hidden` by `<lr-timeline>`'s
 *   `::slotted(:last-child)` rule so the final item has no trailing rail.
 */
export class LyraTimelineItem extends LyraElement {
  static override styles = [LyraElement.styles, styles];

  /** When this event happened. Accepts a `Date`, anything `new Date()` can parse (e.g. an ISO 8601
   *  string), or epoch milliseconds. Invalid/unparseable input normalizes to "unset" -- no timestamp
   *  UI renders, identical to `timestamp` never having been set at all. `attribute: false` since
   *  `Date` instances aren't attribute-serializable -- set via a property binding
   *  (`.timestamp=${...}`) or imperatively, never a plain HTML attribute. Ignored entirely when the
   *  `timestamp` slot has assigned content -- see the class doc / that slot's own description. */
  @property({ attribute: false }) timestamp?: Date | string | number;

  /** Forwarded 1:1 onto the internally-rendered `<lr-relative-time>`'s own `sync` property, so a
   *  live feed (e.g. streaming agent actions) can opt this item into auto-refreshing relative text
   *  ("just now" ticking to "1 minute ago"). Named to match `<lr-relative-time>`'s own `sync`
   *  property verbatim. Has no effect when the `timestamp` slot is populated -- there is no internal
   *  `<lr-relative-time>` to forward onto in that case. */
  @property({ type: Boolean }) sync = false;

  /** Tone of the marker. `'neutral'` (default) is a plain past event; `'brand'` is highlighted/
   *  informational; `'success'` is completed positively (e.g. a successful deploy); `'warning'` needs
   *  attention; `'danger'` is a failed/error event. Same five-value set as `BadgeVariant`/
   *  `CalloutVariant`. */
  @property() variant: TimelineItemVariant = 'neutral';

  /** Marks this as the current/in-progress item (e.g. "the agent is executing this step right now"),
   *  as opposed to a resolved past entry. Drives a pulsing marker (disabled under
   *  `prefers-reduced-motion: reduce`) and `aria-current="true"` on the host -- omitted entirely
   *  (not `"false"`) while inactive, matching `<lr-stepper>`'s identical `aria-current` handling. */
  @property({ type: Boolean, reflect: true }) active = false;

  // Tracked in JS rather than relying on native <slot> fallback content: the "slot wins outright"
  // precedence described in the class doc requires the internal <lr-relative-time>/default-dot
  // markup to be entirely absent from the render() output -- not merely visually superseded -- once
  // the corresponding slot has assigned content. Same [part][hidden]-not-:empty reasoning as
  // <lr-menu-item>'s hasIconSlot (a [part] containing a literal <slot> child never matches a bare
  // :empty selector) drives hasTimestampSlot/hasDescriptionSlot below; hasIconSlot itself can't
  // use [hidden] the same way -- [part='marker'] must stay visible either way to host the slotted
  // icon -- so it instead drives [part='marker'][data-has-icon] suppressing just the dot's
  // background fill (see timeline-item.styles.ts).
  @state() private hasIconSlot = false;
  @state() private hasTimestampSlot = false;
  @state() private hasDescriptionSlot = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'listitem');
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    // aria-current lives on the host (role="listitem" does too -- see connectedCallback), so it's a
    // plain imperative attribute write here rather than part of render()'s shadow-DOM template.
    // Removed entirely (not set to "false") while inactive -- omitting it loses no information since
    // aria-current's own ARIA-spec default value is already "false".
    if (this.active) this.setAttribute('aria-current', 'true');
    else this.removeAttribute('aria-current');
  }

  private get normalizedTimestamp(): Date | undefined {
    if (this.timestamp === undefined) return undefined;
    const date = this.timestamp instanceof Date ? this.timestamp : new Date(this.timestamp);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private onIconSlotChange = (e: Event): void => {
    this.hasIconSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onTimestampSlotChange = (e: Event): void => {
    this.hasTimestampSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onDescriptionSlotChange = (e: Event): void => {
    this.hasDescriptionSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  override render(): TemplateResult {
    const ts = this.normalizedTimestamp;
    const showTimestampFallback = !this.hasTimestampSlot && ts !== undefined;
    const showTimestamp = this.hasTimestampSlot || ts !== undefined;
    // Intl-formatted absolute date/time -- caller/data formatting exempt from localize() routing per
    // AGENTS.md's i18n carve-out for Intl-formatted dates. Never hand-rolled.
    const absolute = ts
      ? getDateTimeFormat(this.effectiveLocale || undefined, { dateStyle: 'long', timeStyle: 'short' }).format(
          ts,
        )
      : '';

    return html`
      <div part="base">
        <div part="track">
          <span part="marker" aria-hidden="true" ?data-has-icon=${this.hasIconSlot}>
            <slot name="icon" @slotchange=${this.onIconSlotChange}></slot>
          </span>
          <span part="rail"></span>
        </div>
        <div part="content">
          <div part="header">
            <span part="title"><slot></slot></span>
            <span part="timestamp" ?hidden=${!showTimestamp}>
              <slot name="timestamp" @slotchange=${this.onTimestampSlotChange}></slot>
              ${showTimestampFallback
                ? html`<time datetime=${ts!.toISOString()} title=${absolute}>
                    <lr-relative-time .date=${ts!} .sync=${this.sync}></lr-relative-time>
                  </time>`
                : nothing}
            </span>
          </div>
          <span part="description" ?hidden=${!this.hasDescriptionSlot}>
            <slot name="description" @slotchange=${this.onDescriptionSlotChange}></slot>
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

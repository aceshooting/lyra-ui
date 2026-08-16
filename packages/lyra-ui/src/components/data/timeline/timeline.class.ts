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

  constructor() {
    super();
    // Gates the horizontal [part='base'] edge fade on the strip genuinely overflowing -- see
    // --lr-scroll-fade-size and timeline.styles.ts. Harmless in the vertical default, where the
    // strip never scrolls inline and the attribute simply stays off.
    observeScrollOverflow(this, () => this.renderRoot.querySelector("[part='base']"));
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
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('orientation') && this.getAttribute('orientation') !== this.orientation) {
      this.setAttribute('orientation', this.orientation);
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
  }

  /** Read-only, live-updated count of the currently-slotted `<lr-timeline-item>` children — handy
   *  for building a `"{count} events"` header without hand-counting DOM children. */
  get itemCount(): number {
    return this.slottedCount;
  }

  private onSlotChange = (e: Event): void => {
    this.slottedCount = this.countTimelineItems(e.target as HTMLSlotElement);
  };

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

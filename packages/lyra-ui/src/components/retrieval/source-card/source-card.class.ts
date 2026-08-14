import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraFrame } from '../../../internal/variants.js';
import { nextId } from '../../../internal/a11y.js';
import { StripHostTitleAttribute } from '../../../internal/strip-host-title.js';
import { styles } from './source-card.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_showLess, LYRA_DEFAULT_showMore, LYRA_DEFAULT_sourcePageSuffix, LYRA_DEFAULT_untitledSource } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface SourceCardExpandDetail {
  sourceId: string;
  expanded: boolean;
}

export interface SourceCardOpenDetail {
  sourceId: string;
  href?: string;
}

/** Container treatment for `<lr-source-card>`'s root. The library-wide {@linkcode LyraFrame}
 *  vocabulary under this component's own export name. */
export type SourceCardAppearance = LyraFrame;

export interface LyraSourceCardEventMap {
  'lr-expand': CustomEvent<SourceCardExpandDetail>;
  'lr-open': CustomEvent<SourceCardOpenDetail>;
}

class LyraSourceCardBase extends LyraElement<LyraSourceCardEventMap> {}

/**
 * `<lr-source-card>` — one citation/source entry, meant to be a direct
 * light-DOM child of `<lr-source-list>` (though it renders and functions
 * fine standalone). Shows a title/page heading, an always-visible `excerpt`
 * slot, and an optional `full` slot revealed behind its own independent
 * "Show more" toggle — unrelated to the parent `<lr-source-list>`'s own
 * expand/collapse, which only ever hides/shows the *set* of cards, never a
 * single card's own content.
 *
 * `source-id` is this card's stable identity, meant to match a
 * `<lr-citation-badge>` (a sibling component) elsewhere on the page. This
 * component doesn't implement any scroll-to/highlight behavior itself — that
 * lives at the app level, wiring a citation badge's activation event to this
 * card's `id`/`source-id`. Let the browser's default scroll behavior apply,
 * or add application motion that respects reduced-motion preferences. See the
 * `@example` below.
 *
 * @customElement lr-source-card
 * @slot excerpt - A short preview. When left empty, the `excerpt` part
 * collapses away entirely rather than leaving an empty gap in the card.
 * @slot full - The complete source text/chunk, hidden behind the "Show
 * more"/"Show less" toggle. When left empty, no toggle renders at all — a
 * card with no `full` content simply has no expand affordance. Removing all
 * `full`-slotted content while expanded automatically collapses it back, and
 * announces that collapse through `lr-expand` like any other state change.
 * @event lr-expand - The card's expanded state changed — either the per-card
 * "Show more"/"Show less" toggle was activated, or all `full`-slotted content
 * was removed while expanded, collapsing the card automatically.
 * `detail: { sourceId, expanded }`.
 * @event lr-open - The title was activated. `detail: { sourceId, href }` —
 * `href` may be `undefined`. This component never navigates on its own
 * (staying a controlled component, the same convention
 * `<lr-tool-call-chip>`'s `lr-tool-call-chip-select` follows); a listener
 * decides what "open" means (open `href` in a new tab, open an in-app
 * viewer, etc).
 * @csspart base - The outer container.
 * @csspart title - The clickable title/page heading (`<button>`).
 * @csspart excerpt - The wrapper around the `excerpt` slot, `hidden` when the slot has no assigned content.
 * @csspart full - The wrapper around the `full` slot, `hidden` while collapsed.
 * @csspart toggle - The "Show more"/"Show less" button. Only rendered when the `full` slot has content.
 * @cssprop [--lr-source-card-compact-padding=var(--lr-space-xs)] - `[part="base"]` padding while
 * `compact`.
 * @cssprop [--lr-source-card-compact-gap=var(--lr-space-2xs)] - Gap between `[part="base"]`'s rows
 * while `compact`.
 *
 * @example
 * ```html
 * <lr-source-list label-plural="2 sources">
 *   <lr-source-card source-id="doc-1" title="annual_report.pdf" page="12">
 *     <span slot="excerpt">Revenue grew 12% year over year...</span>
 *     <span slot="full">Revenue grew 12% year over year, driven primarily by...</span>
 *   </lr-source-card>
 * </lr-source-list>
 * ```
 * ```js
 * // Elsewhere, a <lr-citation-badge>'s activation handler can scroll to
 * // and highlight the matching card -- this component needs no extra API
 * // surface for that, only its existing source-id to be targeted by:
 * document.addEventListener('lr-citation-activate', (e) => {
 *   const card = document.querySelector(`lr-source-card[source-id="${e.detail.sourceId}"]`);
 *   card?.scrollIntoView({ block: 'center' });
 *   card?.classList.add('is-highlighted'); // consumer-defined CSS, e.g. a brief background flash
 *   setTimeout(() => card?.classList.remove('is-highlighted'), 2000);
 * });
 * ```
 * @status stable
 * @since 4.0.0
 */
export class LyraSourceCard extends StripHostTitleAttribute(LyraSourceCardBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    showLess: LYRA_DEFAULT_showLess,
    showMore: LYRA_DEFAULT_showMore,
    sourcePageSuffix: LYRA_DEFAULT_sourcePageSuffix,
    untitledSource: LYRA_DEFAULT_untitledSource,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Stable identifier matching a `<lr-citation-badge>` elsewhere on the page. */
  @property({ attribute: 'source-id' }) sourceId = '';

  /** The source's display title, e.g. a filename. Rendered only as the
   *  title button's own text -- a bare host-level `title` attribute (the
   *  browser's global tooltip attribute) is actively stripped once Lit has
   *  synced it into this property, so the card never grows an unsolicited
   *  native tooltip repeating the same text. See `StripHostTitleAttribute`
   *  (`internal/strip-host-title.ts`). */
  @property() override title = '';

  /** Optional page reference, e.g. `12` or `"iv"` — rendered as-is (never
   *  parsed/validated as a number), so a non-numeric page label works too. */
  @property() page?: string | number;

  /** Optional URL, echoed back (unopened) in `lr-open`'s detail. */
  @property() href?: string;

  /** Tighter root padding and row gap, for the dense citation lists these cards usually render in
   *  -- same convention as `lr-empty`'s `compact`. Defaults to `false`, i.e. the full card
   *  padding. Purely a density knob: the border and background stay, so use `frame="plain"`
   *  to drop the chrome entirely. */
  @property({ type: Boolean, reflect: true }) compact = false;

  /** Container treatment, in the shared `LyraFrame` vocabulary. `'card'` (the default) keeps the
   *  bordered, filled, padded box. `'plain'` removes the border, background, padding and corner
   *  radius, so a card inside a `<lr-source-list>` (or any container already drawing its own
   *  border/dividers) doesn't double the frame. `plain` wins over `compact` when both are set
   *  (nothing left to tighten); the title and toggle keep their brand color and hover underline,
   *  which never depended on the card chrome. */
  @property({ reflect: true }) frame: LyraFrame = 'card';

  // See `<lr-widget>`'s `hasActionsSlot` for the identical
  // presence-tracking convention -- a `[part]` always contains a literal
  // `<slot>` child regardless of assigned content, so CSS `:empty` never
  // matches; real emptiness is tracked in JS instead.
  @state() private hasFullSlot = false;
  @state() private hasExcerptSlot = false;
  @state() private fullExpanded = false;

  private readonly fullId = nextId('source-card-full');

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.hasUpdated) {
      this.hasFullSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'full');
      this.hasExcerptSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'excerpt');
    }
  }

  override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    const fullSlot = this.shadowRoot!.querySelector('slot[name="full"]') as HTMLSlotElement;
    const fullCount = fullSlot.assignedElements({ flatten: true }).length;
    this.hasFullSlot = fullCount > 0;
    if (fullCount === 0) this.fullExpanded = false;

    const excerptSlot = this.shadowRoot!.querySelector('slot[name="excerpt"]') as HTMLSlotElement;
    this.hasExcerptSlot = excerptSlot.assignedElements({ flatten: true }).length > 0;
  }

  private onFullSlotChange = (e: Event): void => {
    const count = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length;
    this.hasFullSlot = count > 0;
    // Losing the slotted content collapses the card, which changes aria-expanded and the toggle
    // label exactly as a click would. A host tracking expansion off the event stream would silently
    // desync if only the manual toggle announced itself, so the automatic path emits too.
    if (count === 0 && this.fullExpanded) {
      this.fullExpanded = false;
      this.emit('lr-expand', { sourceId: this.sourceId, expanded: false });
    }
  };

  private onExcerptSlotChange = (e: Event): void => {
    this.hasExcerptSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private get titleText(): string {
    const base = this.title || this.localize('untitledSource');
    return this.page == null || this.page === ''
      ? base
      : this.localize('sourcePageSuffix', undefined, { base, page: this.page });
  }

  private onTitleClick = (): void => {
    this.emit('lr-open', { sourceId: this.sourceId, href: this.href });
  };

  private toggleFull = (): void => {
    this.fullExpanded = !this.fullExpanded;
    this.emit('lr-expand', { sourceId: this.sourceId, expanded: this.fullExpanded });
  };

  override render(): TemplateResult {
    return html`
      <div part="base">
        <button
          part="title"
          type="button"
          aria-label=${this.getAttribute('aria-label') || nothing}
          @click=${this.onTitleClick}
        >
          ${this.titleText}
        </button>
        <div part="excerpt" ?hidden=${!this.hasExcerptSlot}>
          <slot name="excerpt" @slotchange=${this.onExcerptSlotChange}></slot>
        </div>
        ${this.hasFullSlot
          ? html`<button
              part="toggle"
              type="button"
              aria-expanded=${this.fullExpanded ? 'true' : 'false'}
              aria-controls=${this.fullId}
              @click=${this.toggleFull}
            >
              ${this.localize(this.fullExpanded ? 'showLess' : 'showMore')}
            </button>`
          : nothing}
        <div part="full" id=${this.fullId} ?hidden=${!this.fullExpanded}>
          <slot name="full" @slotchange=${this.onFullSlotChange}></slot>
        </div>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-source-card': LyraSourceCard;
  }
}

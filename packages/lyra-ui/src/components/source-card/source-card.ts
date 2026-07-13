import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { nextId } from '../../internal/a11y.js';
import { styles } from './source-card.styles.js';

export interface SourceCardExpandDetail {
  sourceId: string;
  expanded: boolean;
}

export interface SourceCardOpenDetail {
  sourceId: string;
  href?: string;
}

/**
 * `<lyra-source-card>` — one citation/source entry, meant to be a direct
 * light-DOM child of `<lyra-source-list>` (though it renders and functions
 * fine standalone). Shows a title/page heading, an always-visible `excerpt`
 * slot, and an optional `full` slot revealed behind its own independent
 * "Show more" toggle — unrelated to the parent `<lyra-source-list>`'s own
 * expand/collapse, which only ever hides/shows the *set* of cards, never a
 * single card's own content.
 *
 * `source-id` is this card's stable identity, meant to match a
 * `<lyra-citation-badge>` (a sibling component) elsewhere on the page. This
 * component doesn't implement any scroll-to/highlight behavior itself — that
 * lives at the app level, wiring a citation badge's activation event to this
 * card's `id`/`source-id`. See the `@example` below.
 *
 * @customElement lyra-source-card
 * @slot excerpt - A short preview. When left empty, the `excerpt` part
 * collapses away entirely rather than leaving an empty gap in the card.
 * @slot full - The complete source text/chunk, hidden behind the "Show
 * more"/"Show less" toggle. When left empty, no toggle renders at all — a
 * card with no `full` content simply has no expand affordance. Removing all
 * `full`-slotted content while expanded automatically collapses it back.
 * @event lyra-expand - The per-card "Show more"/"Show less" toggle was
 * activated. `detail: { sourceId, expanded }`.
 * @event lyra-open - The title was activated. `detail: { sourceId, href }` —
 * `href` may be `undefined`. This component never navigates on its own
 * (staying a controlled component, the same convention
 * `<lyra-tool-call-chip>`'s `lyra-tool-chip-select` follows); a listener
 * decides what "open" means (open `href` in a new tab, open an in-app
 * viewer, etc).
 * @csspart base - The outer container.
 * @csspart title - The clickable title/page heading (`<button>`).
 * @csspart excerpt - The wrapper around the `excerpt` slot, `hidden` when the slot has no assigned content.
 * @csspart full - The wrapper around the `full` slot, `hidden` while collapsed.
 * @csspart toggle - The "Show more"/"Show less" button. Only rendered when the `full` slot has content.
 *
 * @example
 * ```html
 * <lyra-source-list label-plural="2 sources">
 *   <lyra-source-card source-id="doc-1" title="annual_report.pdf" page="12">
 *     <span slot="excerpt">Revenue grew 12% year over year...</span>
 *     <span slot="full">Revenue grew 12% year over year, driven primarily by...</span>
 *   </lyra-source-card>
 * </lyra-source-list>
 * ```
 * ```js
 * // Elsewhere, a <lyra-citation-badge>'s activation handler can scroll to
 * // and highlight the matching card -- this component needs no extra API
 * // surface for that, only its existing source-id to be targeted by:
 * document.addEventListener('lyra-citation-activate', (e) => {
 *   const card = document.querySelector(`lyra-source-card[source-id="${e.detail.sourceId}"]`);
 *   card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
 *   card?.classList.add('is-highlighted'); // consumer-defined CSS, e.g. a brief background flash
 *   setTimeout(() => card?.classList.remove('is-highlighted'), 2000);
 * });
 * ```
 */
export class LyraSourceCard extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** Stable identifier matching a `<lyra-citation-badge>` elsewhere on the page. */
  @property({ attribute: 'source-id' }) sourceId = '';

  /** The source's display title, e.g. a filename. Rendered only as the
   *  title button's own text -- a bare host-level `title` attribute (the
   *  browser's global tooltip attribute) is actively stripped once Lit has
   *  synced it into this property, so the card never grows an unsolicited
   *  native tooltip repeating the same text. See `attributeChangedCallback`
   *  and `updated` below. */
  @property() title = '';

  /** Optional page reference, e.g. `12` or `"iv"` — rendered as-is (never
   *  parsed/validated as a number), so a non-numeric page label works too. */
  @property() page?: string | number;

  /** Optional URL, echoed back (unopened) in `lyra-open`'s detail. */
  @property() href?: string;

  // See `<lyra-widget>`'s `hasActionsSlot` for the identical
  // presence-tracking convention -- a `[part]` always contains a literal
  // `<slot>` child regardless of assigned content, so CSS `:empty` never
  // matches; real emptiness is tracked in JS instead.
  @state() private hasFullSlot = false;
  @state() private hasExcerptSlot = false;
  @state() private fullExpanded = false;

  private readonly fullId = nextId('source-card-full');

  // Guards the `removeAttribute('title')` call in `updated()` below: removing
  // an observed attribute fires `attributeChangedCallback` synchronously just
  // like setting one does, and without this flag Lit would treat the removal
  // as a fresh (empty) attribute value and reset the `title` property right
  // back to `null`, losing the value it just finished syncing in.
  private stripHostTitleAttr = false;

  protected willUpdate(): void {
    if (!this.hasUpdated) {
      this.hasFullSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'full');
      this.hasExcerptSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'excerpt');
    }
  }

  firstUpdated(): void {
    const fullSlot = this.shadowRoot!.querySelector('slot[name="full"]') as HTMLSlotElement;
    const fullCount = fullSlot.assignedElements({ flatten: true }).length;
    this.hasFullSlot = fullCount > 0;
    if (fullCount === 0) this.fullExpanded = false;

    const excerptSlot = this.shadowRoot!.querySelector('slot[name="excerpt"]') as HTMLSlotElement;
    this.hasExcerptSlot = excerptSlot.assignedElements({ flatten: true }).length > 0;
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    if (name === 'title' && this.stripHostTitleAttr) return;
    super.attributeChangedCallback(name, old, value);
  }

  protected updated(changed: PropertyValues<this>): void {
    if (changed.has('title') && this.hasAttribute('title')) {
      // The attribute has already been converted into the `title` property
      // by this point (that's how it got here), so the DOM attribute itself
      // is now redundant -- and, left in place, would make the whole card
      // show a native tooltip repeating the title text on hover.
      this.stripHostTitleAttr = true;
      this.removeAttribute('title');
      this.stripHostTitleAttr = false;
    }
  }

  private onFullSlotChange = (e: Event): void => {
    const count = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length;
    this.hasFullSlot = count > 0;
    if (count === 0) this.fullExpanded = false;
  };

  private onExcerptSlotChange = (e: Event): void => {
    this.hasExcerptSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private get titleText(): string {
    const base = this.title || 'Untitled source';
    return this.page == null || this.page === '' ? base : `${base} — p. ${this.page}`;
  }

  private onTitleClick = (): void => {
    this.emit<SourceCardOpenDetail>('lyra-open', { sourceId: this.sourceId, href: this.href });
  };

  private toggleFull = (): void => {
    this.fullExpanded = !this.fullExpanded;
    this.emit<SourceCardExpandDetail>('lyra-expand', { sourceId: this.sourceId, expanded: this.fullExpanded });
  };

  render(): TemplateResult {
    return html`
      <div part="base">
        <button part="title" type="button" @click=${this.onTitleClick}>${this.titleText}</button>
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
              ${this.fullExpanded ? 'Show less' : 'Show more'}
            </button>`
          : nothing}
        <div part="full" id=${this.fullId} ?hidden=${!this.fullExpanded}>
          <slot name="full" @slotchange=${this.onFullSlotChange}></slot>
        </div>
      </div>
    `;
  }
}

defineElement('source-card', LyraSourceCard);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-source-card': LyraSourceCard;
  }
}

import { html, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import { chevronIcon } from '../../../internal/icons.js';
import { styles } from './source-list.styles.js';

export interface SourceListToggleDetail {
  expanded: boolean;
}

export interface LyraSourceListEventMap {
  'lr-toggle': CustomEvent<SourceListToggleDetail>;
}

/**
 * `<lr-source-list>` — a collapsible "Sources" panel for one chat message,
 * grouping a set of `<lr-source-card>` children (its default-slot light-DOM
 * children, plain composition — no `.items` array prop, the same shape
 * `<lr-split>`'s panels take) behind a single clickable header.
 *
 * This library has no built-in pluralization (see `<lr-empty>`'s plain
 * `description` prop for a similar stance), so anything beyond the final
 * fallback is entirely consumer-supplied: `label-plural` (e.g. `"3 sources"`)
 * wins when set, falling back to `label`, falling back to a localized
 * `"Sources"` (via `this.localize()`) — see each property's own doc.
 * `sourceCount` (a read-only, live-updated count of the currently-slotted
 * children) is exposed for a consumer who wants to build that string
 * reactively instead of hand-counting DOM children.
 *
 * The card list is removed from the accessibility tree (not just visually
 * hidden) while collapsed, via the native `hidden` attribute on
 * `[part="list"]` — a screen reader user tabbing past the header never lands
 * on off-screen source cards they can't currently see.
 *
 * @customElement lr-source-list
 * @slot - `<lr-source-card>` elements (or any content, though the card
 * pairing is the intended usage).
 * @event lr-toggle - The header was activated, expanding or collapsing the
 * list. `detail: { expanded }`.
 * @csspart base - The outer container.
 * @csspart header - The clickable header (`<button>`) toggling `expanded`.
 * @csspart toggle - The chevron indicator inside the header.
 * @csspart list - The wrapper around the default slot, `hidden` while collapsed.
 */
export class LyraSourceList extends LyraElement<LyraSourceListEventMap> {
  static styles = [LyraElement.styles, styles];

  /** Whether the card list is currently shown. Starts collapsed by default
   *  so a message's sources don't eat vertical space until asked for. */
  @property({ type: Boolean, reflect: true }) expanded = false;

  /** Header text used when `label-plural` isn't set, e.g. `"Sources"`. */
  @property() label = '';

  /** Fully consumer-built, already-pluralized header summary, e.g. `"3 sources"`
   *  or `"1 source"` — this component never counts or pluralizes on its own
   *  (see the class doc). Takes precedence over `label` when both are set. */
  @property({ attribute: 'label-plural' }) labelPlural = '';

  // Tracks the default slot's assigned-element count purely for the
  // `sourceCount` convenience getter below -- unlike `<lr-split>`'s
  // `panelCount` this never drives layout math, so it's plain @state rather
  // than something read back out of `updated()`.
  @state() private slottedCount = 0;

  private readonly listId = nextId('source-list-region');

  protected willUpdate(): void {
    if (!this.hasUpdated) {
      // Must count only children assigned to the *default* slot -- same rule
      // `firstUpdated`/`onSlotChange` apply via `assignedElements()` below --
      // otherwise a direct child carrying a foreign `slot` attribute makes
      // this pre-count disagree with the authoritative one, which schedules
      // a wasted second update (and Lit's dev-mode change-in-update warning).
      // An explicit `slot=""` still assigns to the default slot per the HTML
      // slot algorithm, so check the attribute's value rather than its mere
      // presence.
      this.slottedCount = Array.from(this.children).filter((el) => !el.getAttribute('slot')).length;
    }
  }

  firstUpdated(): void {
    // Fallback reconciliation for slot-forwarding / engines that don't fire
    // `slotchange` for content present at parse time -- same idiom as
    // `<lr-empty>`'s `firstUpdated`.
    const slot = this.shadowRoot!.querySelector('slot') as HTMLSlotElement;
    this.slottedCount = slot.assignedElements({ flatten: true }).length;
  }

  /** Read-only, live-updated count of the currently-slotted children —
   *  handy for building a `label-plural` string that stays in sync with
   *  what's actually slotted without hand-counting DOM children, e.g.
   *  `list.labelPlural = \`${list.sourceCount} sources\`;`. */
  get sourceCount(): number {
    return this.slottedCount;
  }

  private onSlotChange = (e: Event): void => {
    this.slottedCount = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length;
  };

  private toggle = (): void => {
    this.expanded = !this.expanded;
    this.emit<SourceListToggleDetail>('lr-toggle', { expanded: this.expanded });
  };

  render(): TemplateResult {
    const headerText =
      this.labelPlural || this.label || this.localize('sourceListDefaultLabel');

    return html`
      <div part="base">
        <button
          part="header"
          type="button"
          aria-expanded=${this.expanded ? 'true' : 'false'}
          aria-controls=${this.listId}
          @click=${this.toggle}
        >
          <span part="toggle" aria-hidden="true">${chevronIcon()}</span>
          <span>${headerText}</span>
        </button>
        <div part="list" id=${this.listId} ?hidden=${!this.expanded}>
          <slot @slotchange=${this.onSlotChange}></slot>
        </div>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-source-list': LyraSourceList;
  }
}


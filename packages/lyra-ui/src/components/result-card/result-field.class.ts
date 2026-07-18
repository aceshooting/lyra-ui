import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { hasRealContent } from '../../internal/a11y.js';
import { styles } from './result-field.styles.js';

/**
 * `<lr-result-field>` — a single label/value row, meant for use inside a
 * `<lr-result-card>` body (though it works standalone too). Renders as a
 * dense "label: value" line by default — e.g. "Status: 200 OK" or
 * "Duration: 340ms" — matching the compact, small-card presentation this
 * pair exists for.
 *
 * @customElement lr-result-field
 * @slot - Rich value content (e.g. a `<lr-chip>` status badge, or a plain
 * text override), taking precedence over the `value` prop whenever it has
 * any assigned content.
 * @csspart base - The row container.
 * @csspart label - The label text (including its trailing colon).
 * @csspart value - The wrapper around the value — either the slotted
 * content or the plain `value` prop text.
 */
export class LyraResultField extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** The field name, e.g. "Status". Leave unset to render a value with no label. */
  @property() label = '';

  /** Plain-text value, e.g. "200 OK". Ignored once the default slot carries
   *  real content — see the `@slot` doc. */
  @property() value = '';

  @state() private hasValueSlot = false;

  protected willUpdate(): void {
    if (!this.hasUpdated) {
      this.hasValueSlot = hasRealContent(Array.from(this.childNodes));
    }
  }

  firstUpdated(): void {
    // Fallback reconciliation against the fully-resolved slot assignment,
    // the same belt-and-suspenders pass lr-source-card's hasFullSlot and
    // lr-empty's hasIcon/hasActions take -- a no-op in the common case
    // since willUpdate already seeded the correct value above.
    const slot = this.shadowRoot!.querySelector('slot') as HTMLSlotElement;
    this.hasValueSlot = hasRealContent(slot.assignedNodes({ flatten: true }));
  }

  private onSlotChange = (e: Event): void => {
    this.hasValueSlot = hasRealContent((e.target as HTMLSlotElement).assignedNodes({ flatten: true }));
  };

  render(): TemplateResult {
    const hasLabel = this.label.length > 0;
    return html`
      <div part="base">
        ${hasLabel ? html`<span part="label">${this.label}:</span>` : nothing}
        <span part="value"
          >${this.hasValueSlot ? nothing : this.value}<slot @slotchange=${this.onSlotChange}></slot
        ></span>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-result-field': LyraResultField;
  }
}


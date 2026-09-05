import type { PropertyValues } from 'lit';
import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { hasRealContent } from '../../../internal/a11y.js';
import { styles } from './result-field.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_resultFieldLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


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
 * @status stable
 * @since 4.0.0
 */
export class LyraResultField extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    resultFieldLabel: LYRA_DEFAULT_resultFieldLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** The field name, e.g. "Status". Leave unset or remove the attribute to render a value with no label. */
  @property() label = '';

  /** Plain-text value, e.g. "200 OK". Ignored once the default slot carries
   *  real content — see the `@slot` doc. */
  @property() value = '';

  @state() private hasValueSlot = false;

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.hasUpdated) {
      this.seedFirstRenderState(() => {
        this.hasValueSlot = hasRealContent(Array.from(this.childNodes));
      });
    }
  }

  private onSlotChange = (e: Event): void => {
    // Do not flatten here: when no light-DOM node is assigned, the flattened list contains this
    // slot's own `value` fallback. Treating that fallback as assigned content would alternately
    // remove and restore itself on every update.
    this.hasValueSlot = hasRealContent((e.target as HTMLSlotElement).assignedNodes());
  };

  override render(): TemplateResult {
    const hasLabel = (this.label ?? '').length > 0;
    return html`
      <div part="base">
        ${hasLabel
          ? html`<span part="label">${this.localize('resultFieldLabel', undefined, { label: this.label })}</span>`
          : nothing}
        <span part="value"><slot @slotchange=${this.onSlotChange}
          >${this.hasValueSlot ? nothing : this.value}</slot
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

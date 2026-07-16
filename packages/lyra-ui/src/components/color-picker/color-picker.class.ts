import { html, nothing, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { FormAssociated } from '../../internal/form-associated.js';
import { styles } from './color-picker.styles.js';

export interface LyraColorPickerEventMap {
  input: CustomEvent<undefined>;
  change: CustomEvent<undefined>;
  'lyra-change': CustomEvent<{ value: string }>;
}
class ColorPickerBase extends LyraElement<LyraColorPickerEventMap> {}

/**
 * `<lyra-color-picker>` — a form-associated native color picker with label and hint chrome.
 *
 * @customElement lyra-color-picker
 * @slot label - Custom label content.
 * @slot hint - Supporting text.
 * @event input - Native-style composed color input event.
 * @event change - Native-style composed color change event.
 * @event lyra-change - Change detail with the selected hex value.
 * @csspart form-control - The field wrapper.
 * @csspart label - The label.
 * @csspart input - The native color input.
 * @csspart hint - Supporting text.
 */
export class LyraColorPicker extends FormAssociated(ColorPickerBase) {
  static styles = [LyraElement.styles, styles];
  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  @state() private hasLabel = false;
  @state() private hasHint = false;
  @query('input') private inputEl?: HTMLInputElement;
  private onInput = (): void => {
    if (!this.inputEl) return;
    this.value = this.inputEl.value;
    this.emit('input');
    this.emit('lyra-change', { value: this.value });
  };
  private onChange = (): void => { this.emit('change'); };
  private onNativeFocus = (): void => { this.emit('focus'); };
  private onNativeBlur = (): void => { this.emit('blur'); };
  private onSlotChange = (event: Event): void => {
    const slot = event.target as HTMLSlotElement;
    if (slot.name === 'label') this.hasLabel = slot.assignedElements({ flatten: true }).length > 0;
    if (slot.name === 'hint') this.hasHint = slot.assignedElements({ flatten: true }).length > 0;
  };
  render(): TemplateResult {
    const hasLabel = this.hasLabel || Boolean(this.label);
    const name = this.accessibleLabel || (hasLabel ? nothing : this.localize('colorPicker'));
    return html`<div part="form-control">
      <label part="label" for="color" ?hidden=${!hasLabel}>${this.label}<slot name="label" @slotchange=${this.onSlotChange}></slot></label>
      <input id="color" part="input" type="color" .value=${this.value || '#000000'} aria-label=${name} @input=${this.onInput} @change=${this.onChange} @focus=${this.onNativeFocus} @blur=${this.onNativeBlur} ?disabled=${this.effectiveDisabled} />
      <div part="hint" ?hidden=${!this.hint && !this.hasHint}>${this.hint}<slot name="hint" @slotchange=${this.onSlotChange}></slot></div>
    </div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lyra-color-picker': LyraColorPicker; } }

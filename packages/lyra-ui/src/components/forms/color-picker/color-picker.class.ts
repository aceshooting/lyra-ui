import { html, nothing, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { FormAssociated } from '../../../internal/form-associated.js';
import { nextId } from '../../../internal/a11y.js';
import { styles } from './color-picker.styles.js';

export type LyraColorPickerSize = '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl';

export interface LyraColorPickerEventMap {
  input: CustomEvent<undefined>;
  change: CustomEvent<undefined>;
  blur: CustomEvent<undefined>;
  focus: CustomEvent<undefined>;
  'lr-change': CustomEvent<{ value: string }>;
}
class ColorPickerBase extends LyraElement<LyraColorPickerEventMap> {}

/**
 * `<lr-color-picker>` — a form-associated native color picker with label, hint and error chrome.
 *
 * @customElement lr-color-picker
 * @slot label - Custom label content.
 * @slot hint - Supporting text.
 * @slot error - Custom validation-error content.
 * @event input - Native-style composed color input event.
 * @event change - Native-style composed color change event.
 * @event lr-change - Change detail with the selected hex value.
 * @event focus - Re-dispatched from the internal `<input>`'s own `focus`, bubbling and composed
 *   unlike the native event.
 * @event blur - Re-dispatched from the internal `<input>`'s own `blur`, for the same reason as `focus`.
 * @csspart form-control - The field wrapper.
 * @csspart form-control-label - The label. Also carries the `label` part token for back-compat.
 * @csspart label - Alias of `form-control-label`, kept for back-compat.
 * @csspart input - The native color input.
 * @csspart hint - Supporting text.
 * @csspart error - The validation message.
 * @cssprop --lr-color-picker-swatch-size - The swatch's inline and block size, scaled by `size`.
 */
export class LyraColorPicker extends FormAssociated(ColorPickerBase) {
  static override styles = [LyraElement.styles, styles];
  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  /** Visual size — same `2xs`–`xl` scale as `lr-input`/`lr-select`'s own `size`. */
  @property({ reflect: true }) size: LyraColorPickerSize = 'm';
  @state() private hasLabel = false;
  @state() private hasHint = false;
  @state() private hasError = false;
  @state() private touched = false;
  private hintId = nextId('color-picker-hint');
  private errorId = nextId('color-picker-error');
  @query('input') private inputEl?: HTMLInputElement;
  private onInput = (): void => {
    if (!this.inputEl) return;
    this.value = this.inputEl.value;
    this.emit('input');
    this.emit('lr-change', { value: this.value });
  };
  private onChange = (): void => { this.emit('change'); };
  private onNativeFocus = (): void => { this.emit('focus'); };
  private onNativeBlur = (): void => {
    this.touched = true;
    this.emit('blur');
  };
  private onSlotChange = (event: Event): void => {
    const slot = event.target as HTMLSlotElement;
    if (slot.name === 'label') this.hasLabel = slot.assignedElements({ flatten: true }).length > 0;
    if (slot.name === 'hint') this.hasHint = slot.assignedElements({ flatten: true }).length > 0;
    if (slot.name === 'error') this.hasError = slot.assignedElements({ flatten: true }).length > 0;
  };
  override render(): TemplateResult {
    const hasLabel = this.hasLabel || Boolean(this.label);
    const hasHint = this.hasHint || Boolean(this.hint);
    const hasError = this.hasError || Boolean(this.errorText);
    const name = this.accessibleLabel || (hasLabel ? nothing : this.localize('colorPicker'));
    const invalid = this.touched && !this.internals.validity.valid;
    const describedBy = [hasError ? this.errorId : '', hasHint ? this.hintId : ''].filter(Boolean).join(' ');
    return html`<div part="form-control">
      <label part="label form-control-label" for="color" ?hidden=${!hasLabel}>${this.label}<slot name="label" @slotchange=${this.onSlotChange}></slot></label>
      <input
        id="color"
        part="input"
        type="color"
        .value=${this.value || '#000000'}
        aria-label=${name}
        aria-describedby=${describedBy || nothing}
        aria-required=${this.required ? 'true' : 'false'}
        aria-invalid=${invalid ? 'true' : 'false'}
        @input=${this.onInput}
        @change=${this.onChange}
        @focus=${this.onNativeFocus}
        @blur=${this.onNativeBlur}
        ?disabled=${this.effectiveDisabled}
      />
      <div id=${this.errorId} part="error" ?hidden=${!hasError}>${this.errorText}<slot name="error" @slotchange=${this.onSlotChange}></slot></div>
      <div id=${this.hintId} part="hint" ?hidden=${!hasHint}>${this.hint}<slot name="hint" @slotchange=${this.onSlotChange}></slot></div>
    </div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-color-picker': LyraColorPicker; } }

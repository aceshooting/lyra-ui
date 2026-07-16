import { html, nothing, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../internal/anchored-validity.js';
import { nextId } from '../../internal/a11y.js';
import { closeIcon } from '../../internal/icons.js';
import { styles } from './token-input.styles.js';

export interface LyraTokenInputEventMap {
  input: CustomEvent<{ value: string[] }>;
  change: CustomEvent<{ value: string[] }>;
  'lyra-add': CustomEvent<{ value: string }>;
  'lyra-remove': CustomEvent<{ value: string; index: number }>;
}

/** `<lyra-token-input>` — an editable, form-associated list of removable tokens.
 * @customElement lyra-token-input
 * @slot label - Visible label content.
 * @slot hint - Supporting text.
 * @slot error - Validation message.
 * @event lyra-add - A token was added; detail is `{ value }`.
 * @event lyra-remove - A token was removed; detail is `{ value, index }`.
 * @csspart form-control - Outer control wrapper.
 * @csspart form-control-label - Label.
 * @csspart input-wrapper - Token and input row.
 * @csspart token - Individual token.
 * @csspart remove - Token remove button.
 * @csspart input - Native text input.
 * @csspart hint - Supporting text.
 * @csspart error - Validation message.
 */
export class LyraTokenInput extends LyraElement<LyraTokenInputEventMap> {
  static formAssociated = true;
  static styles = [LyraElement.styles, styles];
  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property() placeholder = '';
  @property({ reflect: true }) name = '';
  @property({ type: Boolean, reflect: true }) required = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  @property({ attribute: 'allow-duplicates', type: Boolean }) allowDuplicates = false;
  @property({ attribute: 'delimiter' }) delimiter = ',';
  @state() private draft = '';
  @state() private touched = false;
  @query('input') private inputEl?: HTMLInputElement;
  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  private labelId = nextId('token-input-label');
  private hintId = nextId('token-input-hint');
  private errorId = nextId('token-input-error');
  private _value: string[] = [];

  @property({ attribute: false })
  get value(): string[] { return this._value; }
  set value(next: string[]) { const old = this._value; this._value = Array.isArray(next) ? [...next] : []; this.requestUpdate('value', old); if (this.internals) this.syncValidity(); }

  constructor() { super(); this.internals = this.attachInternals(); this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]()); }
  connectedCallback(): void { super.connectedCallback(); this.syncValidity(); }
  get form(): HTMLFormElement | null { return this.internals.form; }
  get validity(): ValidityState { return this.internals.validity; }
  get validationMessage(): string { return this.internals.validationMessage; }
  get willValidate(): boolean { return this.internals.willValidate; }
  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | null { return this.inputEl ?? this.renderRoot.querySelector('[part="input-wrapper"]'); }
  checkValidity(): boolean { return this.internals.checkValidity(); }
  reportValidity(): boolean { return this.internals.reportValidity(); }
  override focus(options?: FocusOptions): void { this.inputEl?.focus(options); }
  override blur(): void { this.inputEl?.blur(); }

  private syncValidity(): void {
    const missing = this.required && this.value.length === 0;
    this.validityController.setValidity(missing ? { valueMissing: true } : {}, missing ? this.localize('tokenInputRequired') : '');
    this.toggleAttribute('data-invalid', this.touched && !this.internals.validity.valid);
    const data = new FormData();
    if (this.name) this.value.forEach((token) => data.append(this.name, token));
    this.internals.setFormValue(this.name ? data : null);
  }
  private updateValue(next: string[], event?: 'add' | 'remove'): void {
    this.value = next;
    this.syncValidity();
    this.emit('input', { value: this.value });
    this.emit('change', { value: this.value });
    if (event === 'add') this.emit('lyra-add', { value: next[next.length - 1] });
  }
  private addDraft(): void {
    if (this.disabled) return;
    const candidates = this.draft.split(this.delimiter).map((token) => token.trim()).filter(Boolean);
    for (const token of candidates) {
      if (!this.allowDuplicates && this.value.includes(token)) continue;
      this.updateValue([...this.value, token], 'add');
    }
    this.draft = '';
  }
  private removeToken(index: number): void {
    const removed = this.value[index];
    this.updateValue(this.value.filter((_token, i) => i !== index));
    this.emit('lyra-remove', { value: removed, index });
  }
  private onInput = (event: Event): void => { this.draft = (event.target as HTMLInputElement).value; };
  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.disabled) return;
    if (event.key === 'Enter' || event.key === this.delimiter || event.key === 'Tab') { if (this.draft.trim()) { event.preventDefault(); this.addDraft(); } }
    else if (event.key === 'Backspace' && !this.draft && this.value.length) { this.removeToken(this.value.length - 1); }
  };
  private onBlur = (): void => { if (this.draft.trim()) this.addDraft(); this.touched = true; this.syncValidity(); this.emit('blur'); };
  private onFocus = (): void => { this.emit('focus'); };
  formResetCallback(): void { this.value = []; this.draft = ''; this.touched = false; this.syncValidity(); }
  render(): TemplateResult {
    const described = [this.hint ? this.hintId : '', this.errorText ? this.errorId : ''].filter(Boolean).join(' ') || nothing;
    return html`<div part="form-control">
      <label part="form-control-label" ?hidden=${!this.label} for="input" id=${this.labelId}>${this.label}${this.required ? html`<span aria-hidden="true">*</span>` : nothing}</label>
      <div part="input-wrapper" role="group" aria-labelledby=${this.accessibleLabel ? nothing : this.label ? this.labelId : nothing} aria-label=${this.accessibleLabel || nothing} aria-describedby=${described}>
        ${this.value.map((token, index) => html`<span part="token"><span>${token}</span><button part="remove" type="button" aria-label=${this.localize('removeWithContext', undefined, { context: token })} ?disabled=${this.disabled} @click=${() => this.removeToken(index)}>${closeIcon()}</button></span>`)}
        <input id="input" part="input" .value=${this.draft} placeholder=${this.placeholder} ?disabled=${this.disabled} aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'} @input=${this.onInput} @keydown=${this.onKeyDown} @blur=${this.onBlur} @focus=${this.onFocus} />
      </div>
      <div part="hint" id=${this.hintId} ?hidden=${!this.hint}>${this.hint}</div>
      <div part="error" id=${this.errorId} ?hidden=${!this.errorText}>${this.errorText}</div>
    </div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lyra-token-input': LyraTokenInput; } }

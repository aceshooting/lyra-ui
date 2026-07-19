import { html, nothing, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { nextId } from '../../../internal/a11y.js';
import { closeIcon } from '../../../internal/icons.js';
import { styles } from './token-input.styles.js';

export interface LyraTokenInputEventMap {
  input: CustomEvent<{ value: string[] }>;
  change: CustomEvent<{ value: string[] }>;
  'lr-add': CustomEvent<{ value: string }>;
  'lr-remove': CustomEvent<{ value: string; index: number }>;
}

/** `<lr-token-input>` — an editable, form-associated list of removable tokens.
 * @customElement lr-token-input
 * @slot label - Visible label content.
 * @slot hint - Supporting text.
 * @slot error - Validation message.
 * @event lr-add - A token was added; detail is `{ value }`.
 * @event lr-remove - A token was removed; detail is `{ value, index }`.
 * @csspart form-control - Outer control wrapper.
 * @csspart form-control-label - Label.
 * @csspart input-wrapper - Token and input row.
 * @csspart token - Individual token.
 * @csspart remove - Token remove button.
 * @csspart input - Native text input.
 * @csspart hint - Supporting text.
 * @csspart error - Validation message.
 * @cssprop [--lr-token-input-input-inline-size=var(--lr-size-8rem)] - `flex-basis` of the native text input within the token row.
 * @cssprop [--lr-token-input-min-input-inline-size=var(--lr-size-4rem)] - Inline-size floor of the native text input, so it stays usable once tokens wrap.
 */
export class LyraTokenInput extends LyraElement<LyraTokenInputEventMap> {
  static formAssociated = true;
  static styles = [LyraElement.styles, styles];

  static properties = {
    name: { reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
  };

  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property() placeholder = '';
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  @property({ attribute: 'allow-duplicates', type: Boolean }) allowDuplicates = false;
  @property({ attribute: 'delimiter' }) delimiter = ',';
  @state() private draft = '';
  @state() private touched = false;
  // `[part]:empty` never matches -- the part always contains a literal
  // `<slot>` child element regardless of assigned content -- so real
  // emptiness is tracked in JS instead (mirrors lr-select's identical
  // hasLabelSlot/hasHintSlot/hasErrorSlot) and reflected via `hidden`.
  @state() private hasLabelSlot = false;
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  @query('input') private inputEl?: HTMLInputElement;
  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  private labelId = nextId('token-input-label');
  private hintId = nextId('token-input-hint');
  private errorId = nextId('token-input-error');
  private _value: string[] = [];
  // Tracked separately from the consumer's own `disabled` -- a fieldset
  // cascade must never mutate that IDL property/attribute itself (mirrors
  // lr-select's/lr-combobox's identical `_fieldsetDisabled`/
  // `effectiveDisabled` pattern), only the combined getter below.
  private _fieldsetDisabled = false;
  private _name = '';
  private _required = false;
  private _disabled = false;

  @property({ attribute: false })
  get value(): string[] { return this._value; }
  set value(next: string[]) { const old = this._value; this._value = Array.isArray(next) ? [...next] : []; this.requestUpdate('value', old); if (this.internals) this.syncValidity(); }

  /** The form submission key, reflected synchronously for native form APIs.
   *  This control keys its `FormData` entries directly off `name` (see
   *  `syncValidity()`), so a rename must rebuild that `FormData` in the same
   *  tick -- mirrors `<lr-combobox>`'s identical `name` setter. */
  get name(): string { return this._name; }
  set name(next: string) {
    const old = this._name;
    this._name = next ?? '';
    if (this._name) {
      this.setAttribute('name', this._name);
    } else {
      this.removeAttribute('name');
    }
    this.syncValidity();
    this.requestUpdate('name', old);
  }

  get required(): boolean { return this._required; }
  set required(next: boolean) {
    const old = this._required;
    this._required = Boolean(next);
    this.toggleAttribute('required', this._required);
    this.syncValidity();
    this.requestUpdate('required', old);
  }

  get disabled(): boolean { return this._disabled; }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    this.requestUpdate('disabled', old);
  }

  constructor() { super(); this.internals = this.attachInternals(); this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]()); }
  connectedCallback(): void { super.connectedCallback(); this.syncValidity(); }
  get form(): HTMLFormElement | null { return this.internals.form; }
  get validity(): ValidityState { return this.internals.validity; }
  get validationMessage(): string { return this.internals.validationMessage; }
  get willValidate(): boolean { return this.internals.willValidate; }
  /** Effective disabled state: this element's own `disabled` OR an ancestor
   *  `<fieldset disabled>`'s inherited state -- mirrors native `<input>`, whose
   *  own `disabled` IDL property/attribute is never mutated by a fieldset. */
  get effectiveDisabled(): boolean { return this.disabled || this._fieldsetDisabled; }
  /**
   * Called by the browser when an ancestor `<fieldset disabled>` toggles.
   * Tracked separately from the consumer's own `disabled` (see
   * `effectiveDisabled`) so a consumer's explicit `disabled` survives the
   * fieldset re-enabling instead of being permanently overwritten.
   */
  formDisabledCallback(disabled: boolean): void { this._fieldsetDisabled = disabled; this.requestUpdate(); }
  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | null { return this.inputEl ?? this.renderRoot?.querySelector('[part="input-wrapper"]') ?? null; }
  checkValidity(): boolean { return this.internals.checkValidity(); }
  reportValidity(): boolean { return this.internals.reportValidity(); }
  override focus(options?: FocusOptions): void { this.inputEl?.focus(options); }
  override blur(): void { this.inputEl?.blur(); }
  protected willUpdate(): void {
    if (!this.hasUpdated) {
      this.hasLabelSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'label');
      this.hasHintSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'hint');
      this.hasErrorSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'error');
    }
  }

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
    if (event === 'add') this.emit('lr-add', { value: next[next.length - 1] });
  }
  private addDraft(): void {
    if (this.effectiveDisabled) return;
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
    this.emit('lr-remove', { value: removed, index });
  }
  private onInput = (event: Event): void => { this.draft = (event.target as HTMLInputElement).value; };
  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.effectiveDisabled) return;
    if (event.key === 'Enter' || event.key === this.delimiter) { if (this.draft.trim()) { event.preventDefault(); this.addDraft(); } }
    else if (event.key === 'Tab') { if (this.draft.trim()) this.addDraft(); }
    else if (event.key === 'Backspace' && !this.draft && this.value.length) { this.removeToken(this.value.length - 1); }
  };
  private onBlur = (): void => { if (this.draft.trim()) this.addDraft(); this.touched = true; this.syncValidity(); this.emit('blur'); };
  private onFocus = (): void => { this.emit('focus'); };
  private onLabelSlotChange = (e: Event): void => { this.hasLabelSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0; };
  private onHintSlotChange = (e: Event): void => { this.hasHintSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0; };
  private onErrorSlotChange = (e: Event): void => { this.hasErrorSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0; };
  formResetCallback(): void { this.value = []; this.draft = ''; this.touched = false; this.syncValidity(); }
  render(): TemplateResult {
    const hasLabel = this.hasLabelSlot || this.label.length > 0;
    const hasHint = this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const described = [hasHint ? this.hintId : '', hasError ? this.errorId : ''].filter(Boolean).join(' ') || nothing;
    return html`<div part="form-control">
      <label part="form-control-label" ?hidden=${!hasLabel} for="input" id=${this.labelId}>${this.label}<slot name="label" @slotchange=${this.onLabelSlotChange}></slot>${this.required ? html`<span aria-hidden="true">*</span>` : nothing}</label>
      <div part="input-wrapper" role="group" aria-labelledby=${this.accessibleLabel ? nothing : hasLabel ? this.labelId : nothing} aria-label=${this.accessibleLabel || nothing} aria-describedby=${described}>
        ${this.value.map((token, index) => html`<span part="token"><span>${token}</span><button part="remove" type="button" aria-label=${this.localize('removeWithContext', undefined, { label: token })} ?disabled=${this.effectiveDisabled} @click=${() => this.removeToken(index)}>${closeIcon()}</button></span>`)}
        <input id="input" part="input" .value=${this.draft} placeholder=${this.placeholder} ?disabled=${this.effectiveDisabled} aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'} @input=${this.onInput} @keydown=${this.onKeyDown} @blur=${this.onBlur} @focus=${this.onFocus} />
      </div>
      <div part="hint" id=${this.hintId} ?hidden=${!hasHint}>${this.hint}<slot name="hint" @slotchange=${this.onHintSlotChange}></slot></div>
      <div part="error" id=${this.errorId} ?hidden=${!hasError}>${this.errorText}<slot name="error" @slotchange=${this.onErrorSlotChange}></slot></div>
    </div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-token-input': LyraTokenInput; } }

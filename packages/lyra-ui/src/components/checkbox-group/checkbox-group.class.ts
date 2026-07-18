import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../internal/anchored-validity.js';
import { nextId } from '../../internal/a11y.js';
import { styles } from './checkbox-group.styles.js';
import type { LyraCheckbox } from '../checkbox/checkbox.class.js';

export interface LyraCheckboxGroupEventMap {
  input: CustomEvent<{ value: string[] }>;
  change: CustomEvent<{ value: string[] }>;
  'lyra-change': CustomEvent<{ value: string[] }>;
}

/**
 * `<lyra-checkbox-group>` — a form-associated group of `<lyra-checkbox>` elements.
 *
 * @customElement lyra-checkbox-group
 * @slot - `<lyra-checkbox>` children.
 * @slot label - Visible group label.
 * @slot hint - Supporting text.
 * @slot error - Custom validation message.
 * @event input - User selection changed.
 * @event change - User selection changed.
 * @event lyra-change - User selection changed; detail is `{ value: string[] }`.
 * @csspart form-control - Group wrapper.
 * @csspart form-control-label - Label.
 * @csspart options - Checkbox collection.
 * @csspart hint - Supporting text.
 * @csspart error - Validation message.
 */
export class LyraCheckboxGroup extends LyraElement<LyraCheckboxGroupEventMap> {
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
  @property({ attribute: false }) value: string[] = [];
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  @state() private touched = false;
  @state() private hasLabelSlot = false;
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  private labelId = nextId('checkbox-group-label');
  private hintId = nextId('checkbox-group-hint');
  private errorId = nextId('checkbox-group-error');
  // Inherited from an ancestor `<fieldset disabled>` via `formDisabledCallback()`.
  // Tracked separately from the consumer's own `disabled` (see `effectiveDisabled`)
  // so a consumer's explicit `disabled` survives the fieldset re-enabling instead
  // of being permanently overwritten -- mirrors `<lyra-checkbox>`'s identical
  // `_fieldsetDisabled`/`effectiveDisabled` pattern.
  private _fieldsetDisabled = false;
  private _name = '';
  private _required = false;
  private _disabled = false;

  /** The form submission key each checked child checkbox's value is grouped under in the group's
   *  own `FormData` entry (see `sync()`). Reflected synchronously for native form APIs; renaming
   *  rebuilds that `FormData` in the same tick -- mirrors `<lyra-token-input>`'s identical `name` setter. */
  get name(): string { return this._name; }
  set name(next: string) {
    const old = this._name;
    this._name = next ?? '';
    if (this._name) this.setAttribute('name', this._name);
    else this.removeAttribute('name');
    this.sync();
    this.requestUpdate('name', old);
  }

  get required(): boolean { return this._required; }
  set required(next: boolean) {
    const old = this._required;
    this._required = Boolean(next);
    this.toggleAttribute('required', this._required);
    this.sync();
    this.requestUpdate('required', old);
  }

  get disabled(): boolean { return this._disabled; }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    this.propagateDisabled();
    this.requestUpdate('disabled', old);
  }

  constructor() {
    super();
    this.internals = this.attachInternals();
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
  }

  private get boxes(): LyraCheckbox[] {
    return Array.from(this.querySelectorAll('lyra-checkbox')) as unknown as LyraCheckbox[];
  }

  /** Whether the group is disabled explicitly or by an ancestor fieldset. */
  get effectiveDisabled(): boolean {
    return this.disabled || this._fieldsetDisabled;
  }

  // Propagates this group's effective (explicit-or-inherited) disabled state
  // to every child `<lyra-checkbox>` through its internal `setGroupDisabled()`
  // channel -- never the child's own public `disabled` property/attribute,
  // which would permanently corrupt an explicitly-disabled child once the
  // group (or an ancestor fieldset) re-enables. Mirrors `<lyra-radio-group>`'s
  // identical `setGroupDisabled()` propagation to `<lyra-radio>`.
  private propagateDisabled(): void {
    const effective = this.effectiveDisabled;
    this.boxes.forEach((box) => box.setGroupDisabled?.(effective));
  }

  private readValue(): string[] {
    return this.boxes.filter((box) => box.checked).map((box) => box.value ?? 'on');
  }

  private sync(): void {
    const next = this.readValue();
    this.value = next;
    const data = new FormData();
    if (this.name) next.forEach((value) => data.append(this.name, value));
    this.internals.setFormValue(this.name ? data : null);
    if (this.required && next.length === 0) this.validityController.setValidity({ valueMissing: true }, this.localize('checkboxGroupRequired'));
    else this.validityController.setValidity({});
    this.toggleAttribute('data-invalid', this.touched && !this.internals.validity.valid);
  }

  private emitChange = (event?: Event): void => {
    if (this.effectiveDisabled || event?.target === this) return;
    this.sync();
    this.emit('input', { value: this.value });
    this.emit('change', { value: this.value });
    this.emit('lyra-change', { value: this.value });
  };

  private onSlotChange = (): void => {
    this.hasLabelSlot = !!this.querySelector('[slot="label"]');
    this.hasHintSlot = !!this.querySelector('[slot="hint"]');
    this.hasErrorSlot = !!this.querySelector('[slot="error"]');
    this.sync();
    this.propagateDisabled();
  };

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('change', this.emitChange as EventListener);
    queueMicrotask(() => this.onSlotChange());
  }

  disconnectedCallback(): void {
    this.removeEventListener('change', this.emitChange as EventListener);
    super.disconnectedCallback();
  }

  protected firstUpdated(): void {
    this.onSlotChange();
    this.addEventListener('blur', () => { this.touched = true; this.sync(); }, true);
  }

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | null { return this.renderRoot?.querySelector('[part="options"]') ?? null; }
  get form(): HTMLFormElement | null { return this.internals.form; }
  get validity(): ValidityState { return this.internals.validity; }
  get validationMessage(): string { return this.internals.validationMessage; }
  get willValidate(): boolean { return this.internals.willValidate; }
  checkValidity(): boolean { return this.internals.checkValidity(); }
  reportValidity(): boolean { return this.internals.reportValidity(); }
  formResetCallback(): void { this.boxes.forEach((box) => { box.checked = box.hasAttribute('checked'); }); this.touched = false; this.sync(); }
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    this.propagateDisabled();
    this.requestUpdate();
  }

  render(): TemplateResult {
    const described = [this.hasHintSlot || this.hint ? this.hintId : '', this.hasErrorSlot || this.errorText ? this.errorId : ''].filter(Boolean).join(' ') || nothing;
    return html`<fieldset part="form-control" ?disabled=${this.effectiveDisabled} aria-describedby=${described}>
      <legend part="form-control-label" id=${this.labelId} ?hidden=${!this.label && !this.hasLabelSlot}>${this.label}<slot name="label" @slotchange=${this.onSlotChange}></slot>${this.required ? html`<span aria-hidden="true">*</span>` : nothing}</legend>
      <div part="options" role="group" aria-label=${this.accessibleLabel || nothing} aria-labelledby=${this.accessibleLabel ? nothing : this.labelId} aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}>
        <slot @slotchange=${this.onSlotChange}></slot>
      </div>
      <div part="hint" id=${this.hintId} ?hidden=${!this.hint && !this.hasHintSlot}><slot name="hint" @slotchange=${this.onSlotChange}>${this.hint}</slot></div>
      <div part="error" id=${this.errorId} ?hidden=${!this.errorText && !this.hasErrorSlot}><slot name="error" @slotchange=${this.onSlotChange}>${this.errorText}</slot></div>
    </fieldset>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lyra-checkbox-group': LyraCheckboxGroup; } }

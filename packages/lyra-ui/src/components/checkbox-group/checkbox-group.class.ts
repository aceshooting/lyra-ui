import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../internal/anchored-validity.js';
import { nextId } from '../../internal/a11y.js';
import { styles } from './checkbox-group.styles.js';

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

  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property({ attribute: false }) value: string[] = [];
  @property({ reflect: true }) name = '';
  @property({ type: Boolean, reflect: true }) required = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
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

  constructor() {
    super();
    this.internals = this.attachInternals();
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
  }

  private get boxes(): HTMLElement[] {
    return Array.from(this.querySelectorAll('lyra-checkbox')) as HTMLElement[];
  }

  private readValue(): string[] {
    return this.boxes.filter((box) => (box as { checked?: boolean }).checked).map((box) => (box as { value?: string }).value ?? 'on');
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
    if (this.disabled || event?.target === this) return;
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
  [VALIDITY_ANCHOR](): HTMLElement | null { return this.renderRoot.querySelector('[part="options"]'); }
  get form(): HTMLFormElement | null { return this.internals.form; }
  get validity(): ValidityState { return this.internals.validity; }
  get validationMessage(): string { return this.internals.validationMessage; }
  get willValidate(): boolean { return this.internals.willValidate; }
  checkValidity(): boolean { return this.internals.checkValidity(); }
  reportValidity(): boolean { return this.internals.reportValidity(); }
  formResetCallback(): void { this.boxes.forEach((box) => { (box as { checked?: boolean }).checked = box.hasAttribute('checked'); }); this.touched = false; this.sync(); }
  formDisabledCallback(disabled: boolean): void { this.boxes.forEach((box) => { (box as { disabled?: boolean }).disabled = disabled || this.disabled; }); }

  render(): TemplateResult {
    const described = [this.hasHintSlot || this.hint ? this.hintId : '', this.hasErrorSlot || this.errorText ? this.errorId : ''].filter(Boolean).join(' ') || nothing;
    return html`<fieldset part="form-control" ?disabled=${this.disabled} aria-describedby=${described}>
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

import { html, nothing, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { tag } from '../../../internal/prefix.js';
import { styles } from './radio.styles.js';

export interface LyraRadioEventMap {
  input: CustomEvent<undefined>;
  change: CustomEvent<undefined>;
  'lr-change': CustomEvent<{ checked: boolean; value: string }>;
  focus: CustomEvent<undefined>;
  blur: CustomEvent<undefined>;
}

/**
 * `<lr-radio>` — a form-associated single-choice control. Radios can be used
 * alone or inside `<lr-radio-group>`.
 *
 * Deliberately no hint/error chrome of its own -- the default slot already carries real, visible
 * label text (see `@slot` below), so a labeled-field frame built around `label`/`hint`/`errorText`
 * props has nothing to add here. A consumer needing shared hint/error messaging for a set of
 * options composes it once on the owning `<lr-radio-group>` (which does carry `hint`/`errorText`),
 * the same way a native radio `<fieldset>`/`<legend>` pairs with one externally-owned error node
 * shared across all its `<input type="radio">` children rather than one per option.
 *
 * @customElement lr-radio
 * @slot - Label text.
 * @event input - The user selected this radio.
 * @event change - The user selected this radio.
 * @event lr-change - The selection changed. `detail: { checked, value }`.
 * @csspart base - The interactive radio control.
 * @csspart circle - The circular radio indicator.
 * @csspart dot - The selected indicator.
 * @csspart label - The default slot wrapper.
 * @cssprop [--lr-radio-label-indent=calc(min(var(--lr-icon-button-size), 1.75rem) + var(--lr-space-s))] -
 * The inline distance from the control's start edge to the start of the label text, i.e. the
 * circle's own floor plus the gap next to it. Published so a consumer composing per-option hint text
 * under the label can align it without re-deriving that formula from the shadow styles, and used as
 * the source of the real gap so the two cannot drift. Setting it on the element (or on `lr-radio` in
 * your own stylesheet) moves the label; because custom properties inherit down and not sideways, it
 * is *not* readable from a sibling node in your tree — align a sibling by computing the same formula
 * from `--lr-theme-icon-button-size` and `--lr-theme-space-s`, which you control.
 */
export class LyraRadio extends LyraElement<LyraRadioEventMap> {
  static styles = [LyraElement.styles, styles];
  static formAssociated = true;

  static properties = {
    checked: { type: Boolean, reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    name: { reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    value: { reflect: true, noAccessor: true },
  };

  @state() private hasLabel = false;
  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  private _checked = false;
  private _disabled = false;
  private _required = false;
  private _name = '';
  private _value = 'on';
  private _fieldsetDisabled = false;
  private _groupDisabled = false;
  private _groupRequired = false;
  private _tabbable = true;
  // What `form.reset()` restores to — captured once from the declarative
  // `checked` content attribute at first connect, mirroring
  // `<lr-checkbox>`'s identical `_defaultChecked`/`_defaultCaptured` pair.
  private _defaultChecked = false;
  private _defaultCaptured = false;

  get checked(): boolean { return this._checked; }
  set checked(value: boolean) {
    const old = this._checked;
    this._checked = Boolean(value);
    this.syncFormState();
    this.requestUpdate('checked', old);
  }
  get disabled(): boolean { return this._disabled; }
  set disabled(value: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(value);
    this.toggleAttribute('disabled', this._disabled);
    this.requestUpdate('disabled', old);
  }
  get required(): boolean { return this._required; }
  set required(value: boolean) {
    const old = this._required;
    this._required = Boolean(value);
    this.toggleAttribute('required', this._required);
    this.updateValidity();
    this.requestUpdate('required', old);
  }
  get name(): string { return this._name; }
  set name(value: string) {
    const old = this._name;
    this._name = value ?? '';
    this.toggleAttribute('name', Boolean(this._name));
    if (this._name) this.setAttribute('name', this._name);
    this.requestUpdate('name', old);
  }
  get value(): string { return this._value; }
  set value(value: string) {
    const old = this._value;
    this._value = value ?? 'on';
    this.toggleAttribute('value', Boolean(this._value));
    if (this._value) this.setAttribute('value', this._value);
    this.syncFormState();
    this.requestUpdate('value', old);
  }
  get effectiveDisabled(): boolean { return this.disabled || this._fieldsetDisabled || this._groupDisabled; }
  get effectiveRequired(): boolean { return this.required || this._groupRequired; }
  get form(): HTMLFormElement | null { return this.internals.form; }
  get validity(): ValidityState { return this.internals.validity; }
  get validationMessage(): string { return this.internals.validationMessage; }
  get willValidate(): boolean { return this.internals.willValidate; }

  constructor() {
    super();
    this.internals = this.safeAttachInternals();
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    this.syncFormState();
  }

  /** `attachInternals()` throws in any environment without a real `ElementInternals`
   *  implementation (e.g. a downstream consumer's happy-dom test suite) -- merely constructing
   *  (or importing) this component must not hard-crash there. Falls back to an inert stand-in:
   *  form participation and validity reporting are unavailable in that environment (there is no
   *  polyfillable substitute), but rendering and every non-form-associated feature keep working.
   *  Mirrors lr-graph-query-builder's identical guard. */
  private safeAttachInternals(): ElementInternals {
    if (typeof (globalThis as { ElementInternals?: unknown }).ElementInternals === 'undefined') {
      return this.inertInternals();
    }
    try {
      return this.attachInternals();
    } catch {
      return this.inertInternals();
    }
  }

  private inertInternals(): ElementInternals {
    return {
      form: null,
      labels: [] as unknown as NodeList,
      validity: {} as ValidityState,
      validationMessage: '',
      willValidate: false,
      setFormValue: () => {},
      setValidity: () => {},
      checkValidity: () => true,
      reportValidity: () => true,
      states: new Set<string>(),
    } as unknown as ElementInternals;
  }

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | null {
    return this.renderRoot?.querySelector('[part="base"]') ?? null;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.hasLabel = Array.from(this.childNodes).some((node) => (node.textContent ?? '').trim().length > 0);
    if (!this._defaultCaptured) {
      this._defaultCaptured = true;
      this._defaultChecked = this.hasAttribute('checked');
    }
    this.updateValidity();
  }

  formResetCallback(): void {
    this.checked = this._defaultChecked;
  }
  formStateRestoreCallback(
    state: string | File | FormData | null,
    _mode?: 'restore' | 'autocomplete',
  ): void {
    const old = this._checked;
    this._checked = state === 'checked';
    this.syncFormState();
    this.requestUpdate('checked', old);
  }
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    this.requestUpdate();
  }

  private updateValidity(): void {
    this.validityController.setValidity(
      this.effectiveRequired && !this.checked ? { valueMissing: true } : {},
      this.localize('radioRequired'),
    );
  }
  /** @internal Driven by an owning `<lr-radio-group>`; released when the radio leaves the group's control. */
  setGroupDisabled(value: boolean): void {
    if (this._groupDisabled === value) return;
    this._groupDisabled = value;
    this.requestUpdate();
  }
  /** @internal Driven by an owning `<lr-radio-group>`; released when the radio leaves the group's control. */
  setGroupRequired(value: boolean): void {
    if (this._groupRequired === value) return;
    this._groupRequired = value;
    this.updateValidity();
    this.requestUpdate();
  }
  /** @internal Roving-tabindex state driven by an owning `<lr-radio-group>`. */
  setGroupTabbable(value: boolean): void {
    if (this._tabbable === value) return;
    this._tabbable = value;
    this.requestUpdate();
  }
  override click(): void {
    this[VALIDITY_ANCHOR]()?.click();
  }
  override focus(options?: FocusOptions): void {
    this[VALIDITY_ANCHOR]()?.focus(options);
  }
  override blur(): void {
    this[VALIDITY_ANCHOR]()?.blur();
  }
  private syncFormState(): void {
    this.internals.setFormValue(this.checked ? this.value : null, this.checked ? 'checked' : 'unchecked');
    this.updateValidity();
  }
  private group(): HTMLElement | null {
    return this.closest(tag('radio-group')) as HTMLElement | null;
  }
  private select(): void {
    if (this.effectiveDisabled || this.checked) return;
    const group = this.group() as { selectRadio?: (radio: LyraRadio) => void } | null;
    if (group?.selectRadio) group.selectRadio(this);
    else this.checked = true;
    this.emit('input');
    this.emit('change');
    this.emit('lr-change', { checked: true, value: this.value });
  }
  private onClick = (): void => this.select();
  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.effectiveDisabled) return;
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      this.select();
    }
  };
  private onFocus = (): void => { this.emit('focus'); };
  private onBlur = (): void => { this.emit('blur'); };
  private onSlotChange = (event: Event): void => {
    this.hasLabel = (event.target as HTMLSlotElement).assignedNodes({ flatten: true })
      .some((node) => (node.textContent ?? '').trim().length > 0);
  };

  render(): TemplateResult {
    return html`
      <span part="base" role="radio" tabindex=${this.effectiveDisabled || !this._tabbable ? '-1' : '0'}
        aria-checked=${this.checked ? 'true' : 'false'}
        aria-disabled=${this.effectiveDisabled ? 'true' : 'false'}
        aria-required=${this.effectiveRequired ? 'true' : 'false'}
        aria-label=${this.getAttribute('aria-label') || nothing}
        @click=${this.onClick} @keydown=${this.onKeyDown} @focus=${this.onFocus} @blur=${this.onBlur}>
        <span part="circle">${this.checked ? html`<span part="dot"></span>` : nothing}</span>
        <span part="label" ?hidden=${!this.hasLabel}><slot @slotchange=${this.onSlotChange}></slot></span>
      </span>
    `;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-radio': LyraRadio; } }

import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { styles } from './switch.styles.js';

export interface LyraSwitchEventMap {
  'lr-change': CustomEvent<{ checked: boolean }>;
  focus: CustomEvent<undefined>;
  blur: CustomEvent<undefined>;
}
/**
 * `<lr-switch>` — a boolean toggle-switch form control. Structurally the
 * same idea as a checkbox (form-associated via `ElementInternals`, click and
 * Space/Enter both toggle) but with switch semantics: `role="switch"` +
 * `aria-checked` read to assistive tech as an on/off state rather than a
 * checked/unchecked one, and there is no indeterminate state.
 *
 * `checked` is not a plain string, so this attaches `ElementInternals`
 * directly and implements its own `updateValidity()` rather than using the
 * `FormAssociated` mixin (that mixin's `value` accessor assumes a string —
 * see `<lr-combobox>` for the same direct-`ElementInternals` shape with a
 * non-string value).
 *
 * Ships an opt-in `hint`/`errorText` form-control chrome (props + matching named slots +
 * `hint`/`error` CSS parts), mirroring `<lr-select>`'s pattern for those two pieces -- left
 * unset, neither renders. Deliberately no separate top-of-field `label` prop/slot/part mirroring
 * `<lr-select>`'s `form-control-label`: the default slot already *is* this control's visible,
 * clickable label (same as `<lr-checkbox>`), so a second label surface would be redundant.
 *
 * @customElement lr-switch
 * @slot - Label text, rendered next to the track. Clicking it toggles the
 * switch, the same as clicking a checkbox's associated `<label>`. If left
 * empty, set `aria-label` on the host so the control still has an
 * accessible name.
 * @slot hint - Custom hint content.
 * @slot error - Custom error content.
 * @event lr-change - The user toggled the switch (click or Space/Enter). `detail: { checked }`.
 * @event focus - The internal switch control received focus. Bridges the internal element's
 * non-bubbling native `focus`, re-dispatched as bubbling and composed.
 * @event blur - The internal switch control lost focus. Bridges the internal element's
 * non-bubbling native `blur`, re-dispatched as bubbling and composed.
 * @csspart form-control - The outer wrapper around the switch, error and hint.
 * @csspart base - The whole interactive control (`role="switch"`); wraps the track and label.
 * @csspart track - The pill-shaped background.
 * @csspart thumb - The circular knob that slides across the track.
 * @csspart label - The wrapper around the default slot.
 * @csspart hint - The hint message.
 * @csspart error - The error message.
 */
export class LyraSwitch extends LyraElement<LyraSwitchEventMap> {
  static styles = [LyraElement.styles, styles];
  static formAssociated = true;

  static properties = {
    checked: { type: Boolean, reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    name: { reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    value: { noAccessor: true },
  };

  /** Hint text below the switch. Unset: no hint chrome renders. */
  @property() hint = '';
  /** Error text below the switch (overridden by slotted `error` content). Unset: no error chrome
   *  renders. */
  @property({ attribute: 'error-text' }) errorText = '';

  // Tracks whether the default slot carries any real (non-whitespace)
  // content, so the label wrapper — and the `gap` next to the track — can
  // collapse to nothing for an icon-only/aria-label-only switch instead of
  // leaving a stray empty gap. See combobox/date-input's `hasHintSlot`-style
  // state fields; this one checks `assignedNodes` rather than
  // `assignedElements` because a plain slotted text label (the expected
  // common case here, e.g. `<lr-switch>Enable notifications</lr-switch>`)
  // is a text node, which `assignedElements` would silently ignore.
  @state() private hasLabelSlot = false;
  // `[part]:empty` never matches here -- the parts always contain a literal `<slot>` child element
  // regardless of assigned/text content -- so real emptiness is tracked in JS instead (same fix as
  // `hasLabelSlot` above, and as `<lr-select>`'s identical hint/error parts) and reflected via
  // the `hidden` attribute.
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  // Set on the control's first `blur`; gates the `aria-invalid` reflection
  // below so validity styling never flashes on first render, mirroring
  // `<lr-checkbox>`'s/`<lr-combobox>`'s identical `touched` field.
  @state() private touched = false;

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  // What `form.reset()` restores to — captured once from the declarative
  // `checked` content attribute at first connect. A pre-connect `.checked`
  // property assignment changes live state but not the reset default, matching
  // native `checked`/`defaultChecked` semantics. `checked` reflects, so unlike
  // `FormAssociated`'s non-reflecting `value` this can't be captured from
  // `attributeChangedCallback` alone — that would also fire (and wrongly
  // redefine the default) every time the property setter itself reflects a
  // later user toggle back into the attribute. Guarding with a one-shot flag
  // instead mirrors `<lr-combobox>`'s `_defaultCaptured`/`_defaultSelected`.
  private _defaultChecked = false;
  private _defaultCaptured = false;
  private _fieldsetDisabled = false;
  private _name = '';
  private _checked = false;
  private _disabled = false;
  private _required = false;
  private _value = 'on';

  /** Whether the control is disabled explicitly or by an ancestor fieldset. */
  get effectiveDisabled(): boolean {
    return this.disabled || this._fieldsetDisabled;
  }

  get checked(): boolean {
    return this._checked;
  }
  set checked(next: boolean) {
    const old = this._checked;
    this._checked = Boolean(next);
    this.syncFormState();
    this.requestUpdate('checked', old);
  }

  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    this.requestUpdate('disabled', old);
  }

  /** The form submission key, reflected synchronously for native form APIs. */
  get name(): string {
    return this._name;
  }
  set name(next: string) {
    const old = this._name;
    this._name = next ?? '';
    if (this._name) {
      this.setAttribute('name', this._name);
    } else {
      this.removeAttribute('name');
    }
    this.requestUpdate('name', old);
  }

  get required(): boolean {
    return this._required;
  }
  set required(next: boolean) {
    const old = this._required;
    this._required = Boolean(next);
    this.toggleAttribute('required', this._required);
    this.updateValidity();
    this.requestUpdate('required', old);
  }

  get value(): string {
    return this._value;
  }
  set value(next: string) {
    const old = this._value;
    this._value = next ?? 'on';
    this.syncFormState();
    this.requestUpdate('value', old);
  }

  constructor() {
    super();
    this.internals = this.attachInternals();
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    this.syncFormState();
  }

  get form(): HTMLFormElement | null {
    return this.internals.form;
  }
  get labels(): NodeList {
    return this.internals.labels;
  }
  get validity(): ValidityState {
    return this.internals.validity;
  }
  get validationMessage(): string {
    return this.internals.validationMessage;
  }
  get willValidate(): boolean {
    return this.internals.willValidate;
  }

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | null {
    return this.renderRoot?.querySelector('[part="base"]') ?? null;
  }

  /** Moves focus to the internal switch control. */
  override focus(options?: FocusOptions): void {
    this[VALIDITY_ANCHOR]()?.focus(options);
  }

  /** Removes focus from the internal switch control. */
  override blur(): void {
    this[VALIDITY_ANCHOR]()?.blur();
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (!this._defaultCaptured) {
      this._defaultCaptured = true;
      this._defaultChecked = this.hasAttribute('checked');
    }
    this.updateValidity();
  }

  protected willUpdate(): void {
    // Seed `hasLabelSlot`/`hasHintSlot`/`hasErrorSlot` from the light-DOM children synchronously
    // before the very first render (same `!hasUpdated` guard as combobox/date-input's
    // `hasHintSlot` etc.) so declaratively-provided label/hint/error content doesn't flash hidden
    // for one frame while waiting on the first `slotchange` event.
    if (!this.hasUpdated) {
      // Excludes element children explicitly assigned to the named `hint`/`error` slots -- those
      // are real childNodes of the host too, and without this filter their own textContent would
      // wrongly count as default-slot label content (e.g. a bare `<lr-switch><span
      // slot="hint">...</span></lr-switch>` with no actual label text).
      this.hasLabelSlot = Array.from(this.childNodes).some(
        (n) => !(n instanceof Element && n.slot) && (n.textContent ?? '').trim().length > 0,
      );
      this.hasHintSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'hint');
      this.hasErrorSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'error');
    }
  }

  private updateValidity(): void {
    if (this.required && !this.checked) {
      this.validityController.setValidity(
        { valueMissing: true },
        this.localize('switchRequired'),
      );
    } else {
      this.validityController.setValidity({});
    }
  }

  private syncFormState(): void {
    this.internals.setFormValue(this.checked ? this.value : null, this.checked ? 'checked' : 'unchecked');
    this.updateValidity();
  }

  formResetCallback(): void {
    this.touched = false;
    this.checked = this._defaultChecked;
  }
  formStateRestoreCallback(
    state: string | File | FormData | null,
    _mode?: 'restore' | 'autocomplete',
  ): void {
    this.checked = state === 'checked';
  }
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    this.requestUpdate();
  }
  checkValidity(): boolean {
    return this.internals.checkValidity();
  }
  reportValidity(): boolean {
    return this.internals.reportValidity();
  }

  private toggle(): void {
    if (this.effectiveDisabled) return;
    this.checked = !this.checked;
    this.emit('lr-change', { checked: this.checked });
  }

  private onClick = (): void => {
    this.toggle();
  };

  private onBlur = (): void => {
    this.touched = true;
    this.emit('blur');
  };

  private onFocus = (): void => {
    this.emit('focus');
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.effectiveDisabled) return;
    // Space/Enter both activate, matching `<lr-table>`'s sortable
    // header/row convention (`table.ts`'s `onHeaderKeyDown`/`onRowKeyDown`)
    // for role-based clickable elements — bound to `keydown` rather than
    // `keyup`/native `click`-forwarding like the rest of this library.
    if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
      e.preventDefault();
      this.toggle();
    }
  };

  private onSlotChange = (e: Event): void => {
    const nodes = (e.target as HTMLSlotElement).assignedNodes({ flatten: true });
    this.hasLabelSlot = nodes.some((n) => (n.textContent ?? '').trim().length > 0);
  };

  private onHintSlotChange = (e: Event): void => {
    this.hasHintSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onErrorSlotChange = (e: Event): void => {
    this.hasErrorSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  render(): TemplateResult {
    const hasHint = this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const describedBy = [hasError ? 'switch-error' : '', hasHint ? 'switch-hint' : '']
      .filter(Boolean)
      .join(' ');
    return html`
      <div part="form-control">
        <span
          part="base"
          role="switch"
          tabindex=${this.effectiveDisabled ? '-1' : '0'}
          aria-checked=${this.checked ? 'true' : 'false'}
          aria-required=${this.required ? 'true' : 'false'}
          aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
          aria-disabled=${this.effectiveDisabled ? 'true' : 'false'}
          aria-label=${this.getAttribute('aria-label') || nothing}
          aria-describedby=${describedBy || nothing}
          @click=${this.onClick}
          @keydown=${this.onKeyDown}
          @focus=${this.onFocus}
          @blur=${this.onBlur}
        >
          <span part="track">
            <span part="thumb"></span>
          </span>
          <span part="label" ?hidden=${!this.hasLabelSlot}>
            <slot @slotchange=${this.onSlotChange}></slot>
          </span>
        </span>
        <div id="switch-error" part="error" ?hidden=${!hasError}>
          ${this.errorText}<slot name="error" @slotchange=${this.onErrorSlotChange}></slot>
        </div>
        <div id="switch-hint" part="hint" ?hidden=${!hasHint}>
          ${this.hint}<slot name="hint" @slotchange=${this.onHintSlotChange}></slot>
        </div>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-switch': LyraSwitch;
  }
}

import { html, svg, nothing, type TemplateResult, type SVGTemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../internal/anchored-validity.js';
import { styles } from './checkbox.styles.js';

// Mirrors the shared icon set's viewBox/stroke conventions
// (internal/icons.ts's chevronIcon()/closeIcon()/etc.) without importing
// that module — it's off limits here — so the glyph still reads as part of
// the same visual language as the rest of the library's inline icons.
const GLYPH_VIEW_BOX = '0 0 24 24';
const GLYPH_STROKE_WIDTH = '1.75';

function checkmarkGlyph(): SVGTemplateResult {
  return svg`
    <svg
      part="checkmark"
      width="1em"
      height="1em"
      viewBox=${GLYPH_VIEW_BOX}
      fill="none"
      stroke="currentColor"
      stroke-width=${GLYPH_STROKE_WIDTH}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    ><polyline points="5 12.5 10 17.5 19 6.5"></polyline></svg>
  `;
}

/** The indeterminate/mixed-state dash — takes priority over the checkmark. */
function indeterminateGlyph(): SVGTemplateResult {
  return svg`
    <svg
      part="checkmark"
      width="1em"
      height="1em"
      viewBox=${GLYPH_VIEW_BOX}
      fill="none"
      stroke="currentColor"
      stroke-width=${GLYPH_STROKE_WIDTH}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    ><line x1="5" y1="12" x2="19" y2="12"></line></svg>
  `;
}

export interface LyraCheckboxEventMap {
  input: CustomEvent<undefined>;
  change: CustomEvent<undefined>;
  'lyra-change': CustomEvent<{ checked: boolean }>;
  focus: CustomEvent<undefined>;
  blur: CustomEvent<undefined>;
}
/**
 * `<lyra-checkbox>` — a boolean form control. Structurally the same idea as
 * `<lyra-switch>` (form-associated via `ElementInternals`, click and
 * Space both toggle) but with checkbox semantics: `role="checkbox"` +
 * an `aria-checked` that can also be `"mixed"`, and a visual box/checkmark
 * instead of a track/thumb.
 *
 * `checked` is not a plain string, so this attaches `ElementInternals`
 * directly and implements its own `updateValidity()` rather than using the
 * `FormAssociated` mixin — see `<lyra-combobox>` for the same
 * direct-`ElementInternals` shape with a non-string value.
 *
 * Deliberately no hint/error chrome of its own -- the default slot already carries real, visible
 * label text (see `@slot` below), so a labeled-field frame built around `label`/`hint`/`errorText`
 * props has nothing to add here. A consumer needing hint/error messaging composes it in their own
 * wrapper (e.g. `<lyra-tool-param-form>` folds a boolean field's validation error into adjacent
 * description text / `aria-label` rather than a `<lyra-checkbox>`-owned slot), the same way a
 * native `<input type="checkbox">` plus `<label>` pairs with an externally-owned error node.
 *
 * @customElement lyra-checkbox
 * @slot - Label text, rendered next to the box. Clicking it toggles the
 * checkbox, the same as clicking a native checkbox's associated `<label>`.
 * If left empty, set `aria-label` on the host so the control still has an
 * accessible name.
 * @event input - The user toggled the checkbox; bubbling and composed like a native form event.
 * @event change - Fired immediately after `input` for the same user toggle.
 * @event lyra-change - Compatibility alias fired after `input` and `change` (click or Space).
 * `detail: { checked }`. Not fired for a programmatic `.checked` assignment.
 * @event focus - Re-dispatched from the internal control as a bubbling, composed event.
 * @event blur - Re-dispatched from the internal control as a bubbling, composed event.
 * @csspart base - The whole interactive control (`role="checkbox"`); wraps the box and label.
 * @csspart box - The small square that shows the checkmark/indeterminate dash.
 * @csspart checkmark - The checkmark (or indeterminate dash) glyph inside the box.
 * @csspart label - The wrapper around the default slot.
 */
export class LyraCheckbox extends LyraElement<LyraCheckboxEventMap> {
  static styles = [LyraElement.styles, styles];
  static formAssociated = true;

  static properties = {
    checked: { type: Boolean, reflect: true, noAccessor: true },
    indeterminate: { type: Boolean, reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    name: { reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    value: { noAccessor: true },
  };

  // Visual-only mixed state, matching native `<input type="checkbox">`
  // semantics: it does not affect `checked`'s own value, and a user
  // interaction (click/keyboard) clears it back to `false`, exactly like the
  // native control does.
  // Tracks whether the default slot carries any real (non-whitespace)
  // content, so the label wrapper — and the gap next to the box — can
  // collapse to nothing for an icon-only/aria-label-only checkbox instead of
  // leaving a stray empty gap. See lyra-switch's identical field for why
  // `assignedNodes` (not `assignedElements`) is checked — the common case is
  // a bare slotted text label, e.g. `<lyra-checkbox>Accept terms</lyra-checkbox>`.
  @state() private hasLabelSlot = false;
  // Set on the control's first `blur`; gates the `data-invalid`/`aria-invalid`
  // reflection below so validity styling never flashes on first render,
  // mirroring `<lyra-combobox>`/`<lyra-select>`'s identical `touched` field.
  @state() private touched = false;

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  // `slotchange` only fires when the *set* of distributed nodes changes, not
  // when an already-slotted element mutates its own text content in place
  // (e.g. a consumer filling in a previously-empty `<span>` label) — so
  // without this, `hasLabelSlot` could stay wrongly `false` forever once a
  // label starts empty and text is added afterward. Mirrors
  // `<lyra-option>`'s identical `labelObserver`.
  private labelObserver?: MutationObserver;
  // What `form.reset()` restores to — captured once from the declarative
  // `checked` content attribute at first connect. A pre-connect `.checked`
  // property assignment changes live state but not the reset default, matching
  // native `checked`/`defaultChecked` semantics. `checked` reflects, so unlike `FormAssociated`'s
  // non-reflecting `value` this can't be captured from
  // `attributeChangedCallback` alone — that would also fire (and wrongly
  // redefine the default) every time the property setter reflects a later
  // user toggle back into the attribute. Guarding with a one-shot flag
  // instead mirrors `<lyra-combobox>`'s `_defaultCaptured`/`_defaultSelected`
  // and `<lyra-switch>`'s identical `_defaultChecked`.
  private _defaultChecked = false;
  private _defaultCaptured = false;
  private _fieldsetDisabled = false;
  private _name = '';
  private _checked = false;
  private _indeterminate = false;
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

  get indeterminate(): boolean {
    return this._indeterminate;
  }
  set indeterminate(next: boolean) {
    const old = this._indeterminate;
    this._indeterminate = Boolean(next);
    this.syncFormState();
    this.requestUpdate('indeterminate', old);
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

  connectedCallback(): void {
    super.connectedCallback();
    if (!this._defaultCaptured) {
      this._defaultCaptured = true;
      this._defaultChecked = this.hasAttribute('checked');
    }
    this.updateValidity();
    this.labelObserver = new MutationObserver(() => this.recomputeHasLabelSlot());
    this.labelObserver.observe(this, { childList: true, subtree: true, characterData: true });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.labelObserver?.disconnect();
    this.labelObserver = undefined;
  }

  protected willUpdate(): void {
    // Seed `hasLabelSlot` from the light-DOM children synchronously before
    // the very first render (same `!hasUpdated` guard as combobox/date-input's
    // `hasHintSlot` etc.) so declaratively-provided label text doesn't flash
    // hidden for one frame while waiting on the first `slotchange` event.
    if (!this.hasUpdated) {
      this.hasLabelSlot = Array.from(this.childNodes).some((n) => (n.textContent ?? '').trim().length > 0);
    }
  }

  private updateValidity(): void {
    if (this.required && !this.checked) {
      this.validityController.setValidity({ valueMissing: true }, this.localize('checkboxRequired'));
    } else {
      this.validityController.setValidity({});
    }
    this.reflectInvalid();
  }

  // Keeps `data-invalid` (styling hook) in lockstep with `aria-invalid`
  // (rendered from the same expression in `render()`) any time validity
  // could have changed, rather than waiting on Lit's async `updated()` --
  // consistent with this component's already-synchronous
  // `syncFormState()`/setter shape.
  private reflectInvalid(): void {
    this.toggleAttribute('data-invalid', this.touched && !this.internals.validity.valid);
  }

  private syncFormState(): void {
    // A native checkbox submits its `value` content attribute (default
    // "on") only while checked, and contributes nothing at all — not even
    // an empty string — while unchecked.
    const state = `${this.checked ? 'checked' : 'unchecked'}${this.indeterminate ? '/indeterminate' : ''}`;
    this.internals.setFormValue(this.checked ? this.value : null, state);
    this.updateValidity();
  }

  formResetCallback(): void {
    this.checked = this._defaultChecked;
    this.touched = false;
    this.reflectInvalid();
  }
  formStateRestoreCallback(
    state: string | File | FormData | null,
    _mode?: 'restore' | 'autocomplete',
  ): void {
    const oldChecked = this._checked;
    const oldIndeterminate = this._indeterminate;
    this._checked = state === 'checked' || state === 'checked/indeterminate';
    this._indeterminate = state === 'checked/indeterminate' || state === 'unchecked/indeterminate';
    this.syncFormState();
    this.requestUpdate('checked', oldChecked);
    this.requestUpdate('indeterminate', oldIndeterminate);
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

  /** Moves focus to the internal checkbox control. */
  override focus(options?: FocusOptions): void {
    this[VALIDITY_ANCHOR]()?.focus(options);
  }

  /** Removes focus from the internal checkbox control. */
  override blur(): void {
    this[VALIDITY_ANCHOR]()?.blur();
  }

  private toggle(): void {
    if (this.effectiveDisabled) return;
    this.checked = !this.checked;
    this.indeterminate = false;
    this.emit('input');
    this.emit('change');
    this.emit('lyra-change', { checked: this.checked });
  }

  private onClick = (): void => {
    this.toggle();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.effectiveDisabled) return;
    // Native checkboxes toggle with Space. Enter remains available to the
    // surrounding form's own keyboard behavior.
    if (e.key === ' ' || e.key === 'Spacebar') {
      // Space would otherwise scroll the page, same as a native checkbox.
      e.preventDefault();
      this.toggle();
    }
  };

  private onSlotChange = (): void => {
    this.recomputeHasLabelSlot();
  };

  // Shared by `onSlotChange` (the "set of distributed nodes changed" case)
  // and `labelObserver` (the "an already-slotted node mutated in place"
  // case) so both paths agree on what counts as real label content.
  private recomputeHasLabelSlot(): void {
    const slot = this.renderRoot.querySelector('slot');
    if (!slot) return;
    const nodes = (slot as HTMLSlotElement).assignedNodes({ flatten: true });
    this.hasLabelSlot = nodes.some((n) => (n.textContent ?? '').trim().length > 0);
  }

  private onBlur = (): void => {
    this.touched = true;
    this.reflectInvalid();
    this.emit('blur');
  };

  private onFocus = (): void => {
    this.emit('focus');
  };

  render(): TemplateResult {
    const mixed = this.indeterminate;
    return html`
      <span
        part="base"
        role="checkbox"
        tabindex=${this.effectiveDisabled ? '-1' : '0'}
        aria-checked=${mixed ? 'mixed' : this.checked ? 'true' : 'false'}
        aria-required=${this.required ? 'true' : 'false'}
        aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
        aria-disabled=${this.effectiveDisabled ? 'true' : 'false'}
        aria-label=${this.getAttribute('aria-label') || nothing}
        @click=${this.onClick}
        @keydown=${this.onKeyDown}
        @focus=${this.onFocus}
        @blur=${this.onBlur}
      >
        <span part="box"> ${mixed ? indeterminateGlyph() : this.checked ? checkmarkGlyph() : nothing} </span>
        <span part="label" ?hidden=${!this.hasLabelSlot}>
          <slot @slotchange=${this.onSlotChange}></slot>
        </span>
      </span>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-checkbox': LyraCheckbox;
  }
}

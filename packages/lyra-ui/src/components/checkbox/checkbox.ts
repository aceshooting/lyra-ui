import { html, svg, nothing, type TemplateResult, type SVGTemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
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

/**
 * `<lyra-checkbox>` — a boolean form control. Structurally the same idea as
 * `<lyra-switch>` (form-associated via `ElementInternals`, click and
 * Space/Enter both toggle) but with checkbox semantics: `role="checkbox"` +
 * an `aria-checked` that can also be `"mixed"`, and a visual box/checkmark
 * instead of a track/thumb.
 *
 * `checked` is not a plain string, so this attaches `ElementInternals`
 * directly and implements its own `updateValidity()` rather than using the
 * `FormAssociated` mixin — see `<lyra-combobox>` for the same
 * direct-`ElementInternals` shape with a non-string value.
 *
 * @customElement lyra-checkbox
 * @slot - Label text, rendered next to the box. Clicking it toggles the
 * checkbox, the same as clicking a native checkbox's associated `<label>`.
 * If left empty, set `aria-label` on the host so the control still has an
 * accessible name.
 * @event lyra-change - The user toggled the checkbox (click or Space/Enter).
 * `detail: { checked }`. Not fired for a programmatic `.checked` assignment.
 * @csspart base - The whole interactive control (`role="checkbox"`); wraps the box and label.
 * @csspart box - The small square that shows the checkmark/indeterminate dash.
 * @csspart checkmark - The checkmark (or indeterminate dash) glyph inside the box.
 * @csspart label - The wrapper around the default slot.
 */
export class LyraCheckbox extends LyraElement {
  static styles = [LyraElement.styles, styles];
  static formAssociated = true;

  static properties = {
    checked: { type: Boolean, reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    name: { reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    value: { noAccessor: true },
  };

  // Visual-only mixed state, matching native `<input type="checkbox">`
  // semantics: it does not affect `checked`'s own value, and a user
  // interaction (click/keyboard) clears it back to `false`, exactly like the
  // native control does.
  @property({ type: Boolean, reflect: true }) indeterminate = false;

  // Tracks whether the default slot carries any real (non-whitespace)
  // content, so the label wrapper — and the gap next to the box — can
  // collapse to nothing for an icon-only/aria-label-only checkbox instead of
  // leaving a stray empty gap. See lyra-switch's identical field for why
  // `assignedNodes` (not `assignedElements`) is checked — the common case is
  // a bare slotted text label, e.g. `<lyra-checkbox>Accept terms</lyra-checkbox>`.
  @state() private hasLabelSlot = false;

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
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
      this.validityController.setValidity(
        { valueMissing: true },
        'Please check this box if you want to continue.',
      );
    } else {
      this.validityController.setValidity({});
    }
  }

  private syncFormState(): void {
    // A native checkbox submits its `value` content attribute (default
    // "on") only while checked, and contributes nothing at all — not even
    // an empty string — while unchecked.
    this.internals.setFormValue(this.checked ? this.value : null);
    this.updateValidity();
  }

  formResetCallback(): void {
    this.checked = this._defaultChecked;
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
    this.indeterminate = false;
    this.emit('lyra-change', { checked: this.checked });
  }

  private onClick = (): void => {
    this.toggle();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.effectiveDisabled) return;
    // Space/Enter both activate, matching lyra-switch's onKeyDown (and
    // lyra-table's sortable-header/row convention) for role-based clickable
    // elements — bound to keydown, not keyup/native click-forwarding.
    if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
      // Space would otherwise scroll the page, same as a native checkbox.
      e.preventDefault();
      this.toggle();
    }
  };

  private onSlotChange = (e: Event): void => {
    const nodes = (e.target as HTMLSlotElement).assignedNodes({ flatten: true });
    this.hasLabelSlot = nodes.some((n) => (n.textContent ?? '').trim().length > 0);
  };

  render(): TemplateResult {
    const mixed = this.indeterminate;
    return html`
      <span
        part="base"
        role="checkbox"
        tabindex=${this.effectiveDisabled ? '-1' : '0'}
        aria-checked=${mixed ? 'mixed' : this.checked ? 'true' : 'false'}
        aria-required=${this.required ? 'true' : nothing}
        aria-disabled=${this.effectiveDisabled ? 'true' : nothing}
        aria-label=${this.getAttribute('aria-label') || nothing}
        @click=${this.onClick}
        @keydown=${this.onKeyDown}
      >
        <span part="box"> ${mixed ? indeterminateGlyph() : this.checked ? checkmarkGlyph() : nothing} </span>
        <span part="label" ?hidden=${!this.hasLabelSlot}>
          <slot @slotchange=${this.onSlotChange}></slot>
        </span>
      </span>
    `;
  }
}

defineElement('checkbox', LyraCheckbox);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-checkbox': LyraCheckbox;
  }
}

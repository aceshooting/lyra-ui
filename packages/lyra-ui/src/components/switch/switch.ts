import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './switch.styles.js';

/**
 * `<lyra-switch>` — a boolean toggle-switch form control. Structurally the
 * same idea as a checkbox (form-associated via `ElementInternals`, click and
 * Space/Enter both toggle) but with switch semantics: `role="switch"` +
 * `aria-checked` read to assistive tech as an on/off state rather than a
 * checked/unchecked one, and there is no indeterminate state.
 *
 * `checked` is not a plain string, so this attaches `ElementInternals`
 * directly and implements its own `updateValidity()` rather than using the
 * `FormAssociated` mixin (that mixin's `value` accessor assumes a string —
 * see `<lyra-combobox>` for the same direct-`ElementInternals` shape with a
 * non-string value).
 *
 * @customElement lyra-switch
 * @slot - Label text, rendered next to the track. Clicking it toggles the
 * switch, the same as clicking a checkbox's associated `<label>`. If left
 * empty, set `aria-label` on the host so the control still has an
 * accessible name.
 * @event lyra-change - The user toggled the switch (click or Space/Enter). `detail: { checked }`.
 * @csspart base - The whole interactive control (`role="switch"`); wraps the track and label.
 * @csspart track - The pill-shaped background.
 * @csspart thumb - The circular knob that slides across the track.
 * @csspart label - The wrapper around the default slot.
 */
export class LyraSwitch extends LyraElement {
  static styles = [LyraElement.styles, styles];
  static formAssociated = true;

  @property({ type: Boolean, reflect: true }) checked = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: Boolean, reflect: true }) required = false;
  @property() name = '';
  @property() value = 'on';

  // Tracks whether the default slot carries any real (non-whitespace)
  // content, so the label wrapper — and the `gap` next to the track — can
  // collapse to nothing for an icon-only/aria-label-only switch instead of
  // leaving a stray empty gap. See combobox/date-input's `hasHintSlot`-style
  // state fields; this one checks `assignedNodes` rather than
  // `assignedElements` because a plain slotted text label (the expected
  // common case here, e.g. `<lyra-switch>Enable notifications</lyra-switch>`)
  // is a text node, which `assignedElements` would silently ignore.
  @state() private hasLabelSlot = false;

  private internals: ElementInternals;
  // What `form.reset()` restores to — captured once, from whatever the
  // `checked` property reads at first connect (i.e. whatever the declarative
  // `checked` attribute parsed to, since attribute parsing happens before
  // `connectedCallback`). `checked` reflects, so unlike
  // `FormAssociated`'s non-reflecting `value` this can't be captured from
  // `attributeChangedCallback` alone — that would also fire (and wrongly
  // redefine the default) every time the property setter itself reflects a
  // later user toggle back into the attribute. Guarding with a one-shot flag
  // instead mirrors `<lyra-combobox>`'s `_defaultCaptured`/`_defaultSelected`.
  private _defaultChecked = false;
  private _defaultCaptured = false;

  constructor() {
    super();
    this.internals = this.attachInternals();
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (!this._defaultCaptured) {
      this._defaultCaptured = true;
      this._defaultChecked = this.checked;
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
      this.internals.setValidity({ valueMissing: true }, 'Please turn this on.');
    } else {
      this.internals.setValidity({});
    }
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('checked') || changed.has('value')) {
      this.internals.setFormValue(this.checked ? this.value : null);
    }
    if (changed.has('checked') || changed.has('required')) {
      this.updateValidity();
    }
  }

  formResetCallback(): void {
    this.checked = this._defaultChecked;
  }
  formDisabledCallback(disabled: boolean): void {
    this.disabled = disabled;
  }
  checkValidity(): boolean {
    return this.internals.checkValidity();
  }
  reportValidity(): boolean {
    return this.internals.reportValidity();
  }

  private toggle(): void {
    if (this.disabled) return;
    this.checked = !this.checked;
    this.emit('lyra-change', { checked: this.checked });
  }

  private onClick = (): void => {
    this.toggle();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.disabled) return;
    // Space/Enter both activate, matching `<lyra-table>`'s sortable
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

  render(): TemplateResult {
    return html`
      <span
        part="base"
        role="switch"
        tabindex=${this.disabled ? '-1' : '0'}
        aria-checked=${this.checked ? 'true' : 'false'}
        aria-required=${this.required ? 'true' : nothing}
        aria-disabled=${this.disabled ? 'true' : nothing}
        aria-label=${this.getAttribute('aria-label') || nothing}
        @click=${this.onClick}
        @keydown=${this.onKeyDown}
      >
        <span part="track">
          <span part="thumb"></span>
        </span>
        <span part="label" ?hidden=${!this.hasLabelSlot}>
          <slot @slotchange=${this.onSlotChange}></slot>
        </span>
      </span>
    `;
  }
}

defineElement('switch', LyraSwitch);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-switch': LyraSwitch;
  }
}

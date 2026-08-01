import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { syncValidityStates } from '../../../internal/custom-states.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraSize } from '../../../internal/variants.js';
import { styles } from './switch.styles.js';

/** A no-op stand-in for `ElementInternals`, used only when the host environment has no real
 *  implementation of it (e.g. a downstream consumer's Vitest + happy-dom test suite) --
 *  `attachInternals()` is browser-only, and calling it unconditionally in the constructor would
 *  otherwise throw before any test assertion runs, merely from constructing or importing this
 *  component. Every member here is either an inert value or a no-op: native `<form>`
 *  participation is unavailable in that environment, but that's an acceptable degradation rather
 *  than a hard failure -- same fix as `<lr-checkbox>`'s/`<lr-tool-param-form>`'s identical
 *  `createInternalsSafely`/`createNoopInternals` pair. */
function createInternalsSafely(host: HTMLElement): ElementInternals {
  if (typeof host.attachInternals !== 'function') return createNoopInternals();
  try {
    return host.attachInternals();
  } catch {
    return createNoopInternals();
  }
}

function createNoopInternals(): ElementInternals {
  return {
    form: null,
    labels: [] as unknown as NodeList,
    validity: {} as ValidityState,
    validationMessage: '',
    willValidate: false,
    setFormValue(): void {},
    setValidity(): void {},
    checkValidity(): boolean {
      return true;
    },
    reportValidity(): boolean {
      return true;
    },
  } as unknown as ElementInternals;
}

export interface LyraSwitchEventMap {
  input: CustomEvent<undefined>;
  change: CustomEvent<undefined>;
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
 * @event input - The user toggled the switch; bubbling and composed like a native form event.
 * @event change - Fired immediately after `input` for the same user toggle, matching the native
 * checkbox/radio contract a form library expects from a boolean control.
 * @event lr-change - Compatibility alias fired after `input` and `change` (click, Space/Enter, or
 * the programmatic `click()` activation path). `detail: { checked }`. Not fired for a plain
 * `.checked` property assignment, `form.reset()`, or session-state restoration.
 * @event focus - The internal switch control received focus. Bridges the internal element's
 * non-bubbling native `focus`, re-dispatched as bubbling and composed.
 * @event blur - The internal switch control lost focus. Bridges the internal element's
 * non-bubbling native `blur`, re-dispatched as bubbling and composed.
 * @cssstate required - Matches while `required` is set. Style with `lr-switch:state(required)`.
 * @cssstate optional - Matches while `required` is not set — the complement of `required`.
 * @cssstate valid - Matches while the control satisfies its constraints, including any
 * `setCustomValidity()` error.
 * @cssstate invalid - Matches while it does not — from the very first render, before the user has
 * touched anything.
 * @cssstate user-valid - `valid`, but only after the user has interacted: a toggle, a blur, or a
 * `reportValidity()` call (which is what a submit attempt runs).
 * @cssstate user-invalid - `invalid` after that same interaction. Style validation errors with this
 * rather than `invalid`: a pristine required switch is genuinely invalid, but colouring it red
 * before the user has done anything is hostile.
 * @csspart form-control - The outer wrapper around the switch, error and hint.
 * @csspart base - The whole interactive control (`role="switch"`); wraps the track and label.
 * @csspart track - The pill-shaped background.
 * @csspart thumb - The circular knob that slides across the track.
 * @csspart label - The wrapper around the default slot.
 * @csspart hint - The hint message.
 * @csspart error - The error message.
 * @cssprop [--lr-switch-track-inline-size=calc(var(--lr-switch-track-block-size) * 1.8)] - Inline
 *   size of the track, and (with the block size) the distance the thumb travels when checked.
 *   Derived from the block size, so re-sizing the track keeps its aspect ratio.
 * @cssprop [--lr-switch-track-block-size=calc(var(--lr-form-control-height) * 0.5)] - Block size of
 *   the track, half the `size` tier's shared control height; the thumb's diameter is derived from
 *   it minus twice `--lr-switch-thumb-offset`.
 * @cssprop [--lr-switch-thumb-offset=var(--lr-size-2px)] - Inset of the thumb from the track's
 *   edges.
 * @cssprop [--lr-switch-track-fill=var(--lr-color-border)] - Resting fill of `[part='track']`,
 *   re-pointed at `var(--lr-color-brand)` while `checked`. The hover and press states mix away from
 *   whichever of the two is current, so retinting this retints all four renderings at once.
 */
export class LyraSwitch extends LyraElement<LyraSwitchEventMap> {
  static override styles = [LyraElement.styles, sizes, styles];
  static formAssociated = true;

  static override properties = {
    checked: { type: Boolean, reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    name: { reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    size: { reflect: true },
    value: { noAccessor: true },
  };

  /**
   * Control size, on the library's shared ladder. Accepts both spellings of every tier —
   * `2xs`/`xs`/`s`/`m`/`l`/`xl` and Web Awesome's `small`/`medium`/`large` — so migrating either way
   * is a tag rename. Scales the track and thumb off the same `--lr-form-control-*` values
   * `<lr-input>`/`<lr-select>`/`<lr-button>` use, so controls of one `size` line up in a row. The
   * slotted label keeps the library's standard control-label type size at every tier; restyle it
   * through `::part(label)` if you want it to track the control.
   */
  size: LyraSize = 'm';

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
  /** Whether the user has acted on this control yet, which is what gates the `user-valid`/
   *  `user-invalid` custom states. Deliberately separate from `touched` (which drives the visible
   *  `data-invalid`/`aria-invalid` pair and is set on blur alone): a toggle is an interaction the
   *  instant it happens, and `reportValidity()` — what a submit attempt runs — counts as one too,
   *  exactly as it does for native `:user-invalid`. Not `@state`: nothing in `render()` reads it. */
  private hasInteracted = false;

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
    this.internals = createInternalsSafely(this);
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

  /** Activates the internal switch control, toggling it the same as a real click -- mirrors
   *  `<lr-checkbox>`'s identical `override click()`. Without this, `HTMLElement.prototype.click()`
   *  on the host is a no-op: the real click handler is bound only to the internal
   *  `[part="base"]` control, not the host itself. */
  override click(): void {
    this[VALIDITY_ANCHOR]()?.click();
  }

  /** Moves focus to the internal switch control. */
  override focus(options?: FocusOptions): void {
    this[VALIDITY_ANCHOR]()?.focus(options);
  }

  /** Removes focus from the internal switch control. */
  override blur(): void {
    this[VALIDITY_ANCHOR]()?.blur();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this._defaultCaptured) {
      this._defaultCaptured = true;
      this._defaultChecked = this.hasAttribute('checked');
    }
    this.updateValidity();
  }

  protected override willUpdate(changed: PropertyValues): void {
    // A future mixin layered under LyraSwitch (e.g. a shared behavior applied the same way
    // FormAssociated is layered under lr-textarea) would otherwise silently never run its own
    // willUpdate() -- mirrors csv-viewer.ts's/docx-viewer.ts's identical super call.
    super.willUpdate(changed);
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
    this.reflectValidityStates();
  }

  /** Republishes the six validity custom states (`required`/`optional`, `valid`/`invalid`,
   *  `user-valid`/`user-invalid`) from whatever `ElementInternals` currently holds. Called from
   *  every path that can move either validity or the interaction flag. */
  private reflectValidityStates(): void {
    syncValidityStates(this.internals, { required: this.required, hasInteracted: this.hasInteracted });
  }

  private syncFormState(): void {
    this.internals.setFormValue(this.checked ? this.value : null, this.checked ? 'checked' : 'unchecked');
    this.updateValidity();
  }

  formResetCallback(): void {
    this.touched = false;
    this.hasInteracted = false;
    this.checked = this._defaultChecked;
    this.reflectValidityStates();
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
    // A submit attempt runs this, and native `:user-invalid` starts matching at exactly that
    // point, so it counts as interaction for the `user-*` custom states. `checkValidity()`
    // deliberately does not: it is the silent query.
    this.hasInteracted = true;
    this.reflectValidityStates();
    return this.internals.reportValidity();
  }

  /**
   * Sets or clears a consumer-supplied validation error — the standard channel for a server-side
   * rejection ("notifications are disabled for your plan") that no client-side constraint can
   * express. A non-empty `message` raises `customError` and becomes `validationMessage`, so the
   * control fails `checkValidity()`, blocks form submission, and matches `:state(invalid)`; `''`
   * clears it.
   *
   * Clearing restores the control's own computed validity rather than forcing it valid: a
   * required-and-unchecked switch whose custom error is cleared stays `valueMissing`. The custom
   * error also survives every intrinsic recomputation in between (each toggle re-runs
   * `updateValidity()`) and a form reset, exactly like a native control — only another
   * `setCustomValidity('')` clears it.
   *
   * The message is caller-supplied content, so it is used verbatim and never localized here.
   */
  setCustomValidity(message: string): void {
    this.validityController.setCustomValidity(message ?? '');
    this.reflectValidityStates();
    // `aria-invalid` is rendered from `internals.validity`, which the call above just moved.
    this.requestUpdate();
  }

  private toggle(): void {
    if (this.effectiveDisabled) return;
    this.hasInteracted = true;
    this.checked = !this.checked;
    // Native `input` then `change`, then the library alias -- the same order (and the same
    // rationale) as `<lr-checkbox>`'s `toggle()`. A boolean control that emitted only the
    // `lr-`-prefixed alias is invisible to every form library, validation helper, and
    // `<form>`-level `change` listener that binds the native names, which is the ordinary way a
    // consumer observes a control they did not write.
    this.emit('input');
    this.emit('change');
    this.emit('lr-change', { checked: this.checked });
  }

  private onClick = (): void => {
    this.toggle();
  };

  private onBlur = (): void => {
    this.touched = true;
    this.hasInteracted = true;
    this.reflectValidityStates();
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

  override render(): TemplateResult {
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

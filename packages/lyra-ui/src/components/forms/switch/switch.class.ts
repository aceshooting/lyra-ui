import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { setCustomState, syncValidityStates } from '../../../internal/custom-states.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraSize } from '../../../internal/variants.js';
import { styles } from './switch.styles.js';
import {
  dispatchNativeEvent,
  dispatchNativeInputEvent,
  relayNativeEvent,
} from '../../../internal/native-event-relay.js';
import { installInvalidEventAlias } from '../../../internal/invalid-event-alias.js';
import { omittedEmptyStringConverter } from '../../../internal/converters.js';
import { hasRealContent } from '../../../internal/a11y.js';
import { isActionableElement } from '../../../internal/focus-navigation.js';
import {
  attachInternalsSafely,
  getFormOwner,
  installCustomErrorProperty,
  isBarredFromValidation,
  setFormOwner,
  type FormOwnerValue,
} from '../../../internal/form-associated.js';
import { currentValidityValidator, type LyraFormValidator } from '../form-validator.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_switchRequired } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface LyraSwitchEventMap {
  input: InputEvent;
  change: Event;
  'lr-input': CustomEvent<{ checked: boolean }>;
  'lr-change': CustomEvent<{ checked: boolean }>;
  focus: FocusEvent;
  blur: FocusEvent;
  'lr-focus': CustomEvent<null>;
  'lr-blur': CustomEvent<null>;
  'lr-invalid': CustomEvent<null>;
}
/**
 * `<lr-switch>` — a boolean toggle-switch form control. Structurally the
 * same idea as a checkbox (form-associated via `ElementInternals`, click and
 * Space toggle) but with switch semantics: `role="switch"` +
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
 * Its wrapper follows flattened rendered assignment and updates through forwarding slots. Visual
 * elements, including decorative `aria-hidden` icons, retain the wrapper independently of their
 * accessibility-tree contribution.
 *
 * @customElement lr-switch
 * @slot - Label text, rendered next to the track. Clicking it toggles the
 * switch, the same as clicking a checkbox's associated `<label>`. If left
 * empty, set `aria-label` on the host so the control still has an accessible name. Host
 * `aria-label` is forwarded by presence, including an explicitly empty value.
 * @slot hint - Custom hint content.
 * @slot help-text - Shoelace alias for `hint`.
 * @slot error - Custom error content.
 * @event {InputEvent} input - The user toggled the switch; bubbling and composed like a native form event.
 * @event lr-input - Prefixed compatibility alias for `input`; `detail: { checked }`.
 * @event {Event} change - Fired immediately after `input` for the same user toggle, matching the native
 * checkbox/radio contract a form library expects from a boolean control.
 * @event lr-change - Compatibility alias fired after `input` and `change` (click, Space, logical
 * ArrowLeft/ArrowRight, or
 * the programmatic `click()` activation path). `detail: { checked }`. Not fired for a plain
 * `.checked` property assignment, `form.reset()`, or session-state restoration.
 * @event focus - The internal switch control received focus. Bridges the internal element's
 * non-bubbling native `focus`, re-dispatched as bubbling and composed.
 * @event blur - The internal switch control lost focus. Bridges the internal element's
 * non-bubbling native `blur`, re-dispatched as bubbling and composed.
 * @event lr-focus - Prefixed compatibility alias for `focus`.
 * @event lr-blur - Prefixed compatibility alias for `blur`.
 * @event lr-invalid - The switch failed a validity check. Cancelable: calling
 * `preventDefault()` also cancels the native `invalid` event behind it, suppressing the
 * browser's own validation bubble so an app can present the failure its own way.
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
 * @cssstate checked - Matches while the live switch state is on.
 * @cssstate disabled - Matches while disabled directly or by an ancestor fieldset.
 * @csspart form-control - The outer wrapper around the switch, error and hint.
 * @csspart wrapper - Compatibility name on the semantic switch owner.
 * @csspart base - Compatibility name for the semantic switch owner; use `switch`.
 * @csspart switch - The interactive `role="switch"` owner around the track, with the rich default
 *   label as a sibling so nested actions remain valid focus stops.
 * @csspart track - The pill-shaped background.
 * @csspart control - WA/Shoelace name for the same pill-shaped background.
 * @csspart thumb - The circular knob that slides across the track.
 * @csspart label - The wrapper around the default slot.
 * @csspart hint - The hint message.
 * @csspart form-control-help-text - Shoelace name for the same hint message.
 * @csspart error - The error message.
 * @cssprop [--lr-switch-gap=var(--lr-space-s)] - Gap between the track and label.
 * @cssprop [--lr-switch-track-inline-size=calc(var(--lr-switch-track-block-size) * 1.8)] - Inline
 *   size of the track, and (with the block size) the distance the thumb travels when checked.
 *   Derived from the block size, so re-sizing the track keeps its aspect ratio.
 * @cssprop [--lr-switch-track-block-size=calc(var(--lr-form-control-height) * 0.5)] - Block size of
 *   the track, half the `size` tier's shared control height; the thumb's diameter is derived from
 *   it minus twice `--lr-switch-thumb-offset`.
 * @cssprop [--lr-switch-thumb-offset=var(--lr-size-2px)] - Inset of the thumb from the track's
 *   edges.
 * @cssprop [--lr-switch-track-fill=var(--lr-color-border)] - Resting fill of `[part='track']`,
 *   used as the source for the hover and press fallbacks.
 * @cssprop [--lr-switch-checked-track-fill=var(--lr-color-brand)] - Track fill while checked.
 * @cssprop [--lr-switch-track-hover-fill=color-mix(...)] - Track fill while hovered.
 * @cssprop [--lr-switch-track-active-fill=color-mix(...)] - Track fill while pressed.
 * @cssprop [--lr-switch-thumb-fill=var(--lr-color-surface)] - Thumb fill in either checked state.
 * @cssprop [--width=var(--lr-switch-track-inline-size)] - WA/Shoelace alias for the track's inline
 * size.
 * @cssprop [--height=var(--lr-switch-track-block-size)] - WA/Shoelace alias for the track's block
 * size.
 * @cssprop [--thumb-size=calc(var(--height, var(--lr-switch-track-block-size)) - (var(--lr-switch-thumb-offset) * 2))] - WA/Shoelace thumb diameter alias.
 * @status stable
 * @since 4.0.0
 */
export class LyraSwitch extends LyraElement<LyraSwitchEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    switchRequired: LYRA_DEFAULT_switchRequired,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  /** Public WA-compatible intrinsic validator catalog. */
  static get validators(): LyraFormValidator<LyraSwitch>[] {
    return [currentValidityValidator('required', 'disabled', 'checked', 'value')];
  }
  static override styles = [LyraElement.styles, sizes, styles];
  static formAssociated = true;

  static override properties = {
    customError: { attribute: 'custom-error', reflect: true, noAccessor: true },
    checked: { attribute: false, noAccessor: true },
    defaultChecked: {
      attribute: 'checked',
      type: Boolean,
      reflect: true,
      useDefault: true,
      noAccessor: true,
    },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    name: { reflect: true, noAccessor: true, converter: omittedEmptyStringConverter },
    required: { type: Boolean, reflect: true, noAccessor: true },
    size: { reflect: true },
    // Hand-reflected by the accessor so a null write can restore the absent default while an
    // explicit non-null `'on'` write remains observably present as `value="on"`.
    value: { reflect: true, noAccessor: true },
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
  /** Shoelace alias for {@link hint}. `hint` wins when both are supplied. */
  @property({ attribute: 'help-text' }) helpText = '';
  /** WA SSR slot-presence hint used before light-DOM assignment can be inspected. */
  @property({ type: Boolean, attribute: 'with-hint' }) withHint = false;
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
  @state() private hasHelpTextSlot = false;
  @state() private hasErrorSlot = false;
  private labelObserver?: MutationObserver;
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
  /** Consumer-supplied validation message reflected through `custom-error`. */
  declare customError: string | null;
  private _defaultChecked = false;
  private _checkedDirty = false;
  private settingDefaultChecked = false;
  private reflectingDefaultChecked = false;
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
    if (!this.settingDefaultChecked) this._checkedDirty = true;
    this._checked = Boolean(next);
    this.syncFormState();
    this.requestUpdate('checked', old);
  }
  /** Reflected current reset default; changing it never overwrites dirty live `checked` state. */
  get defaultChecked(): boolean { return this._defaultChecked; }
  set defaultChecked(next: boolean) {
    if (this.reflectingDefaultChecked) return;
    const old = this._defaultChecked;
    this._defaultChecked = Boolean(next);
    this.reflectingDefaultChecked = true;
    try { this.toggleAttribute('checked', this._defaultChecked); }
    finally { this.reflectingDefaultChecked = false; }
    if (!this._checkedDirty) this.restoreCheckedFromDefault();
    this.requestUpdate('defaultChecked', old);
  }

  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    // Disabling bars constraint validation, so the violation itself is recomputed here -- not just
    // the states republished.
    this.updateValidity();
    this.requestUpdate('disabled', old);
  }

  /** The form submission key, reflected synchronously for native form APIs. */
  get name(): string {
    return this._name;
  }
  set name(next: string | null) {
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
  set value(next: string | null) {
    const old = this._value;
    this._value = next ?? 'on';
    if (next == null) {
      if (this.hasAttribute('value')) this.removeAttribute('value');
    } else if (this.getAttribute('value') !== this._value) {
      this.setAttribute('value', this._value);
    }
    this.syncFormState();
    // Reflection is synchronous and source-sensitive above. Keep Lit's public reflection metadata,
    // but never queue a second reflection that could turn a same-tick null reset back into `on`.
    this.requestUpdate('value', old, { reflect: false });
  }

  constructor() {
    super();
    installInvalidEventAlias(this, (init: { cancelable: true }) =>
      this.emit('lr-invalid', null, init));
    this.internals = attachInternalsSafely(this);
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    installCustomErrorProperty(this, () => this.validityController.customValidityMessage);
    this.syncFormState();
  }

  get form(): HTMLFormElement | null {
    return getFormOwner(this.internals);
  }
  set form(owner: FormOwnerValue) { setFormOwner(this, owner); }
  getForm(): HTMLFormElement | null { return getFormOwner(this.internals); }
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
    return this.renderRoot?.querySelector('.switch-owner') ?? null;
  }

  /** Reads both component state and the UA's synchronous fieldset cascade before public actions. */
  private get liveDisabled(): boolean {
    return this.effectiveDisabled || this.matches(':disabled');
  }

  /** Activates the internal switch control, toggling it the same as a real click -- mirrors
   *  `<lr-checkbox>`'s identical `override click()`. Without this, `HTMLElement.prototype.click()`
   *  on the host is a no-op: the real click handler is bound only to the internal
   *  `[part~="base"]` control, not the host itself. */
  override click(): void {
    if (!this.liveDisabled) this[VALIDITY_ANCHOR]()?.click();
  }

  /** Moves focus to the internal switch control. */
  override focus(options?: FocusOptions): void {
    if (!this.liveDisabled) this[VALIDITY_ANCHOR]()?.focus(options);
  }

  /** Removes focus from the internal switch control. */
  override blur(): void {
    this[VALIDITY_ANCHOR]()?.blur();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.updateValidity();
    const MutationObserverCtor = this.ownerDocument.defaultView?.MutationObserver;
    this.labelObserver = MutationObserverCtor
      ? new MutationObserverCtor(() => {
          this.bindLabelObserverTargets();
          this.recomputeHasLabelSlot();
        })
      : undefined;
    this.addEventListener('slotchange', this.onLabelSlotChange);
    this.bindLabelObserverTargets();
    if (this.hasUpdated) {
      // A reconnect is no longer a hydration boundary, so refresh immediately from the new tree.
      this.recomputeLightDomSlotState();
    } else {
      // Browser-only mounts still seed before their first paint. During hydration the base helper
      // defers this browser-only light-DOM sample until the server render has been reproduced.
      this.seedFirstRenderState(() => this.recomputeLightDomSlotState());
    }
  }

  override disconnectedCallback(): void {
    this.removeEventListener('slotchange', this.onLabelSlotChange);
    this.labelObserver?.disconnect();
    this.labelObserver = undefined;
    super.disconnectedCallback();
  }

  protected override willUpdate(changed: PropertyValues): void {
    // A future mixin layered under LyraSwitch (e.g. a shared behavior applied the same way
    // FormAssociated is layered under lr-textarea) would otherwise silently never run its own
    // willUpdate() -- mirrors csv-viewer.ts's/docx-viewer.ts's identical super call.
    super.willUpdate(changed);
  }

  /** Shared with every other form control: disabled (own or fieldset-cascaded) bars validation. */
  private get barredFromValidation(): boolean {
    return isBarredFromValidation(this, this.internals);
  }

  private updateValidity(): void {
    if (this.barredFromValidation) {
      // A barred control reports no violation at all, exactly like a native disabled checkbox --
      // leaving `valueMissing` raised is what leaked `:state(invalid)` onto disabled required
      // switches, and with it the documented `:state(user-invalid)` error styling.
      this.validityController.setValidity({});
    } else if (this.required && !this.checked) {
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
    syncValidityStates(this.internals, {
      required: this.required,
      hasInteracted: this.hasInteracted,
      barred: this.barredFromValidation,
    });
    setCustomState(this.internals, 'checked', this.checked);
    setCustomState(this.internals, 'disabled', this.effectiveDisabled);
  }

  private syncFormState(): void {
    this.internals.setFormValue(this.checked ? this.value : null, this.checked ? 'checked' : 'unchecked');
    this.updateValidity();
  }

  formResetCallback(): void {
    this.touched = false;
    this.hasInteracted = false;
    this.restoreCheckedFromDefault();
    this.reflectValidityStates();
  }
  formStateRestoreCallback(
    state: string | File | FormData | null,
    reason: 'autocomplete' | 'restore',
  ): void {
    void reason;
    this.checked = state === 'checked';
  }
  private restoreCheckedFromDefault(): void {
    this.settingDefaultChecked = true;
    try { this.checked = this._defaultChecked; }
    finally { this.settingDefaultChecked = false; }
    this._checkedDirty = false;
  }
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    // Cascaded disablement bars constraint validation exactly like the control's own `disabled`.
    this.updateValidity();
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

  /** Clears consumer-supplied validity and restores the current required/checked constraint. */
  resetValidity(): void {
    this.setCustomValidity('');
  }

  private setFromUser(next: boolean): void {
    if (this.liveDisabled) return;
    if (this.checked === next) return;
    this.hasInteracted = true;
    this.checked = next;
    // Native `input` then `change`, then the library alias -- the same order (and the same
    // rationale) as `<lr-checkbox>`'s `toggle()`. A boolean control that emitted only the
    // `lr-`-prefixed alias is invisible to every form library, validation helper, and
    // `<form>`-level `change` listener that binds the native names, which is the ordinary way a
    // consumer observes a control they did not write.
    dispatchNativeInputEvent(this);
    this.emit('lr-input', { checked: this.checked });
    dispatchNativeEvent(this, 'change');
    this.emit('lr-change', { checked: this.checked });
  }

  private onClick = (event: MouseEvent): void => {
    const owner = this[VALIDITY_ANCHOR]();
    for (const target of event.composedPath()) {
      if (target === event.currentTarget) break;
      if (
        target &&
        typeof target === 'object' &&
        (target as Node).nodeType === 1 &&
        target !== owner &&
        isActionableElement(target as Element)
      ) return;
    }
    this.setFromUser(!this.checked);
  };

  private onBlur = (event: FocusEvent): void => {
    // `<lr-switch>` is form-associated (`static formAssociated = true`), so setting the host's
    // `disabled` attribute (the `disabled` setter's `toggleAttribute()` call) makes the browser's
    // native form-associated-custom-element machinery treat the host as "actually disabled"
    // synchronously -- and that runs its own unfocusing steps against whatever inside the shadow
    // tree currently holds focus, firing a real `blur` on the internal `[part~="base"]` span
    // *before* Lit's own async re-render has even reached its `tabindex` attribute. Confirmed via
    // a captured marker showing the `blur` firing synchronously inside the `disabled` property
    // setter, with the span's `tabIndex` still `0` at that point -- the exact same observable race
    // as `<lr-input>`'s `onBlur`, just reached through the FACE
    // disabled-state's forced blur rather than a native `<input disabled>`'s. That is not a user
    // interaction: marking `touched` for it could reenter an in-flight Lit update and trip Lit's
    // dev-mode "scheduled an update after an update completed" warning, and would otherwise let a
    // later re-enable flash `user-invalid` styling for an interaction the user never actually had.
    if (!this.liveDisabled) {
      this.touched = true;
      this.hasInteracted = true;
      this.reflectValidityStates();
    }
    relayNativeEvent(this, event);
    this.emit('lr-blur');
  };

  private onFocus = (event: FocusEvent): void => {
    if (this.liveDisabled) {
      event.stopPropagation();
      return;
    }
    relayNativeEvent(this, event);
    this.emit('lr-focus');
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.liveDisabled) return;
    if (e.repeat) return;
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      this.setFromUser(!this.checked);
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const turnsOn = this.effectiveDirection === 'rtl'
        ? e.key === 'ArrowLeft'
        : e.key === 'ArrowRight';
      this.setFromUser(turnsOn);
    }
  };

  private isDefaultLabelNode(node: Node): boolean {
    if (node.nodeType !== 1) return true;
    const slotName = (node as Element).getAttribute('slot');
    return slotName === null || slotName === '';
  }

  private labelForwardingSlots(): HTMLSlotElement[] {
    return Array.from(this.querySelectorAll<HTMLSlotElement>('slot')).filter((slot) => {
      let top: Node = slot;
      while (top.parentNode && top.parentNode !== this) top = top.parentNode;
      return top.parentNode === this && this.isDefaultLabelNode(top);
    });
  }

  private observeLabelNode(node: Node): void {
    if (!this.labelObserver) return;
    if (node.nodeType === 3) {
      this.labelObserver.observe(node, { characterData: true });
      return;
    }
    if (node.nodeType !== 1) return;
    this.labelObserver.observe(node, {
      attributes: true,
      attributeFilter: ['aria-hidden', 'aria-label', 'class', 'hidden', 'inert', 'slot', 'style'],
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  private bindLabelObserverTargets(): void {
    if (!this.labelObserver) return;
    this.labelObserver.disconnect();
    this.observeLabelNode(this);
    for (const slot of this.labelForwardingSlots()) {
      if (slot.assignedNodes().length === 0) continue;
      for (const assigned of slot.assignedNodes({ flatten: true })) this.observeLabelNode(assigned);
    }
  }

  private recomputeHasLabelSlot(): void {
    const renderRoot = this.renderRoot as ParentNode | undefined;
    const childNodes = (this as unknown as { childNodes?: NodeListOf<ChildNode> }).childNodes;
    if (!renderRoot || !childNodes) return;
    const slot = renderRoot.querySelector<HTMLSlotElement>('slot:not([name])');
    const nodes: Node[] = slot
      ? slot.assignedNodes({ flatten: true })
      : Array.from(childNodes)
          .filter((node) => this.isDefaultLabelNode(node))
          .flatMap((node) => {
            if (node.nodeType !== 1 || (node as Element).localName !== 'slot') return [node];
            const forwardingSlot = node as HTMLSlotElement;
            return forwardingSlot.assignedNodes().length > 0
              ? forwardingSlot.assignedNodes({ flatten: true })
              : Array.from(forwardingSlot.childNodes);
          });
    this.hasLabelSlot = hasRealContent(nodes);
  }

  private recomputeLightDomSlotState(): void {
    this.recomputeHasLabelSlot();
    const children = (this as unknown as { children?: HTMLCollection }).children;
    if (!children) return;
    this.hasHintSlot = Array.from(children).some(
      (element) => element.getAttribute('slot') === 'hint',
    );
    this.hasHelpTextSlot = Array.from(children).some(
      (element) => element.getAttribute('slot') === 'help-text',
    );
    this.hasErrorSlot = Array.from(children).some(
      (element) => element.getAttribute('slot') === 'error',
    );
  }

  private handleLabelSlotChange(event: Event): void {
    const target = event.target as Element | null;
    if (target?.nodeType !== 1 || target.localName !== 'slot') return;
    if (
      target.getRootNode() !== this.renderRoot &&
      !this.labelForwardingSlots().includes(target as HTMLSlotElement)
    ) return;
    this.bindLabelObserverTargets();
    this.recomputeHasLabelSlot();
  }

  private onLabelSlotChange = (event: Event): void => this.handleLabelSlotChange(event);
  private onSlotChange = (event: Event): void => this.handleLabelSlotChange(event);

  private onHintSlotChange = (e: Event): void => {
    this.hasHintSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onHelpTextSlotChange = (e: Event): void => {
    this.hasHelpTextSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onErrorSlotChange = (e: Event): void => {
    this.hasErrorSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  override render(): TemplateResult {
    const hasHint = this.withHint || this.hasHintSlot || this.hasHelpTextSlot ||
      this.hint.length > 0 || this.helpText.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const describedBy = [hasError ? 'switch-error' : '', hasHint ? 'switch-hint' : '']
      .filter(Boolean)
      .join(' ');
    return html`
      <div part="form-control">
        <span class="switch-layout" @click=${this.onClick}>
          <span
            class="switch-owner"
            part="base switch wrapper"
            role="switch"
            tabindex=${this.effectiveDisabled ? '-1' : '0'}
            aria-checked=${this.checked ? 'true' : 'false'}
            aria-required=${this.required ? 'true' : 'false'}
            aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
            aria-disabled=${this.effectiveDisabled ? 'true' : 'false'}
            aria-label=${this.getAttribute('aria-label') ?? nothing}
            aria-labelledby=${this.hasAttribute('aria-label') || !this.hasLabelSlot
              ? nothing
              : 'switch-label'}
            aria-describedby=${describedBy || nothing}
            @keydown=${this.onKeyDown}
            @focus=${this.onFocus}
            @blur=${this.onBlur}
          >
            <span part=${this.checked ? 'track control checked' : 'track control'}>
              <span part="thumb"></span>
            </span>
          </span>
          <span id="switch-label" part="label" ?hidden=${!this.hasLabelSlot}>
            <slot @slotchange=${this.onSlotChange}></slot>
          </span>
        </span>
        <div id="switch-error" part="error" ?hidden=${!hasError}>
          ${this.errorText}<slot name="error" @slotchange=${this.onErrorSlotChange}></slot>
        </div>
        <div id="switch-hint" part="hint form-control-help-text" ?hidden=${!hasHint}>
          ${this.hint || this.helpText}<slot name="hint" @slotchange=${this.onHintSlotChange}></slot
          ><slot name="help-text" @slotchange=${this.onHelpTextSlotChange}></slot>
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

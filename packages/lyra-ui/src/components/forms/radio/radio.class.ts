import { acquireResolvedAriaRelationship, type ResolvedAriaRelationshipLease } from '../../../internal/aria-controls.js';
import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { installFormControlLabelSupport } from '../../../internal/form-control-labels.js';
installFormControlLabelSupport();
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { setCustomState, syncValidityStates } from '../../../internal/custom-states.js';
import { tag } from '../../../internal/prefix.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraSize } from '../../../internal/variants.js';
import { styles } from './radio.styles.js';
import { appearanceStyles } from './radio-button.styles.js';
import { dispatchNativeEvent, relayNativeEvent } from '../../../internal/native-event-relay.js';
import {
  getFormOwner,
  installCustomErrorProperty,
  isBarredFromValidation,
  setFormOwner,
  type FormOwnerValue,
} from '../../../internal/form-associated.js';
import { installInvalidEventAlias } from '../../../internal/invalid-event-alias.js';
import {
  declaredDefaultConverter,
  omittedEmptyStringConverter } from '../../../internal/converters.js';
import { hasRealContent } from '../../../internal/a11y.js';
import { isActionableElement } from '../../../internal/focus-navigation.js';
import { currentValidityValidator, type LyraFormValidator } from '../form-validator.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_radioRequired } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface LyraRadioEventMap {
  'lr-invalid': CustomEvent<null>;
  input: Event;
  change: Event;
  'lr-input': CustomEvent<{ checked: boolean; value: string }>;
  'lr-change': CustomEvent<{ checked: boolean; value: string }>;
  focus: FocusEvent;
  blur: FocusEvent;
}

interface RadioGroupController {
  disabled: boolean;
  readonly name?: string;
  readonly size?: LyraSize;
  readonly customError?: string | null;
  setCustomValidity?: (message: string) => void;
  ownsRadio?: (radio: LyraRadio) => boolean;
  radioCheckedChanged?: (radio: LyraRadio) => void;
  reconcileRadio?: (radio: LyraRadio) => boolean;
  releaseRadio?: (radio: LyraRadio) => void;
  selectRadio?: (radio: LyraRadio) => boolean;
}

export type RadioAppearance = 'default' | 'button';
type RadioButtonRunPosition = 'standalone' | 'start' | 'middle' | 'end';

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
 * Flattened forwarding-slot changes keep the visual label wrapper synchronized; element-only and
 * decorative `aria-hidden` visuals still count as visual content. A host `aria-label` retains
 * accessible-name precedence by presence, including an explicitly empty value.
 * A standalone radio is bounded by its allocation: an unbroken default label wraps within the
 * available inline size in both LTR and RTL while the circular indicator remains fixed.
 * In `appearance="button"`, the same `start`/`prefix` and `end`/`suffix` adornment aliases as
 * `<lr-radio-button>` render around the label. Empty leading, label, and trailing wrappers stay
 * hidden so only present content contributes the button's flex gaps.
 *
 * Host `aria-describedby` references resolve onto the internal radio, including button appearance,
 * and track live target changes, reconnect and document adoption. Explicit `checked` assignments
 * mark live state dirty even when unchanged; later default changes affect live state only after reset.
 *
 * @customElement lr-radio
 * @slot - Label content, including forwarded or element-only visuals.
 * @slot start - Leading content in `appearance="button"`, typically an icon.
 * @slot prefix - Shoelace-compatible alias for `start` in `appearance="button"`.
 * @slot end - Trailing content in `appearance="button"`.
 * @slot suffix - Shoelace-compatible alias for `end` in `appearance="button"`.
 * @event input - A standalone radio was selected; native-style and composed.
 * @event lr-input - Standalone prefixed compatibility alias for `input`.
 *   `detail: { checked, value }`.
 * @event change - A standalone radio was selected; native-style and composed.
 * @event lr-change - Standalone prefixed compatibility alias for `change`.
 *   `detail: { checked, value }`. An owning radio group emits its aggregate value-event sequence
 *   instead of any child value events.
 * @event focus - The internal radio received focus.
 * @event blur - The internal radio lost focus.
 * @event lr-invalid - The standalone radio failed a validity check. Aggregate groups emit their
 *   own alias instead. Cancelable: calling `preventDefault()` also cancels the native `invalid`
 *   event behind it, suppressing the browser's own validation bubble so an app can present the
 *   failure its own way.
 * @cssstate required - Matches while the radio is required, either by its own `required` attribute
 * or by an owning `<lr-radio-group required>`. Style with `lr-radio:state(required)`.
 * @cssstate optional - Matches while it is neither — the complement of `required`.
 * @cssstate valid - Matches while the control satisfies its constraints, including any
 * `setCustomValidity()` error.
 * @cssstate invalid - Matches while it does not — from the very first render, before the user has
 * touched anything.
 * @cssstate user-valid - `valid`, but only after the user has interacted with this radio: selecting
 * it, blurring it, or a `reportValidity()` call (which is what a submit attempt runs).
 * @cssstate user-invalid - `invalid` after that same interaction. Style validation errors with this
 * rather than `invalid`: a pristine required radio is genuinely invalid, but colouring it red
 * before the user has done anything is hostile.
 * @cssstate checked - Matches while this option is selected.
 * @cssstate disabled - Matches while disabled directly, by a group, or by an ancestor fieldset.
 * @csspart base - The interactive radio control.
 * @csspart circle - The circular radio indicator.
 * @csspart control - WA/Shoelace name for the indicator, or the interactive button in
 * `appearance="button"`.
 * @csspart control--checked - Shoelace state alias on the selected indicator.
 * @csspart dot - The selected indicator.
 * @csspart checked-icon - WA/Shoelace name for the same selected indicator.
 * @csspart button - Shoelace button-chrome alias in `appearance="button"` mode.
 * @csspart button--checked - Shoelace selected-button state alias.
 * @csspart start - The `appearance="button"` leading-content wrapper; hidden while empty.
 * @csspart prefix - Shoelace-compatible alias on the same leading-content wrapper.
 * @csspart label - The default slot wrapper; hidden while it has no real content.
 * @csspart end - The `appearance="button"` trailing-content wrapper; hidden while empty.
 * @csspart suffix - Shoelace-compatible alias on the same trailing-content wrapper.
 * @cssprop [--lr-radio-label-indent=calc(var(--lr-radio-circle-size) + var(--lr-space-s))] -
 * The inline distance from the control's start edge to the start of the label text, i.e. the
 * circle's own floor plus the gap next to it — so it tracks `size` along with the circle. Published
 * so a consumer composing per-option hint text under the label can align it without re-deriving that
 * formula from the shadow styles, and used as the source of the real gap so the two cannot drift.
 * Setting it on the element (or on `lr-radio` in your own stylesheet) moves the label; because
 * custom properties inherit down and not sideways, it is *not* readable from a sibling node in your
 * tree — align a sibling by computing the same formula from `--lr-theme-icon-button-size`,
 * `--lr-theme-form-control-height-*` and `--lr-theme-space-s`, which you control.
 * @cssprop [--lr-radio-checked-border-color=var(--lr-color-brand)] - Border color of `[part='circle']`
 * while `checked`. Retint just this control's checked ring without touching the shared
 * `--lr-color-brand` token every other component also reads.
 * @cssprop [--lr-radio-checked-dot-color=var(--lr-color-brand)] - Background of `[part='dot']`
 * while `checked`.
 * @cssprop [--lr-radio-hover-border-color=var(--lr-color-brand)] - Indicator border while the
 * interactive row is hovered.
 * @cssprop [--lr-radio-active-border-color=var(--lr-radio-hover-border-color)] - Indicator border
 * while the interactive row is pressed.
 * @cssprop [--lr-radio-active-ring-color=var(--lr-color-brand-quiet)] - Indicator ring while the
 * interactive row is pressed.
 * @cssprop [--checked-icon-color=var(--lr-radio-checked-dot-color)] - WA-compatible selected-glyph
 * color alias.
 * @cssprop [--checked-icon-scale=1] - WA-compatible selected-glyph scale alias.
 * @cssprop [--lr-radio-circle-size=min(var(--lr-icon-button-size), calc(var(--lr-form-control-height) * 0.7))] -
 * Edge length of `[part='circle']`. Derived from the `size` tier's shared control height so a radio
 * lines up with an `<lr-input>`/`<lr-select>`/`<lr-button>` of the same `size`.
 * @cssprop [--lr-radio-dot-size=min(calc(var(--lr-radio-circle-size) * 0.5), calc(var(--lr-form-control-height) * 0.3))] -
 * Edge length of `[part='dot']`, capped at half the circle so it can never outgrow its ring.
 * @cssprop [--lr-radio-radius=var(--lr-radius-pill)] - Corner radius of the control's own chrome.
 * A circular indicator is fully round at every setting; `<lr-radio-button>` re-points this knob at
 * the shared control radius and swaps it for a pill when `pill` is set.
 * @cssprop [--lr-radio-button-gap=var(--lr-space-xs)] - Gap between the present start/prefix,
 * label, and end/suffix wrappers in `appearance="button"`.
 * @status stable
 * @since 4.0.0
 */
export class LyraRadio extends LyraElement<LyraRadioEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    radioRequired: LYRA_DEFAULT_radioRequired,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  /** Public WA-compatible intrinsic validator catalog, inherited by radio-button. */
  static get validators(): LyraFormValidator<LyraRadio>[] {
    return [currentValidityValidator('required', 'disabled', 'checked', 'value')];
  }
  static override styles = [LyraElement.styles, sizes, styles, appearanceStyles];
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
    appearance: { reflect: true,
      converter: declaredDefaultConverter<RadioAppearance>('default'),
    },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    name: { reflect: true, noAccessor: true, converter: omittedEmptyStringConverter },
    pill: { type: Boolean, reflect: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    size: { reflect: true, converter: declaredDefaultConverter<LyraSize>('m') },
    value: { reflect: true, noAccessor: true },
  };

  /**
   * Control size, on the library's shared ladder. Accepts both spellings of every tier —
   * `2xs`/`xs`/`s`/`m`/`l`/`xl` and Web Awesome's `small`/`medium`/`large` — so migrating either way
   * is a tag rename. Scales the indicator off the same `--lr-form-control-*` values
   * `<lr-input>`/`<lr-select>`/`<lr-button>` use, so controls of one `size` line up in a row. The
   * slotted label keeps the library's standard control-label type size at every tier; restyle it
   * through `::part(label)` if you want it to track the control. An owning group exposes its
   * projected tier through `effectiveSize` without overwriting this authored property; likewise,
   * `effectiveName` reports aggregate name authority without rewriting `name`.
   */
  size: LyraSize = 'm';

  /** WA-compatible visual mode. `button` keeps the same radio semantics and group ownership. */
  appearance: RadioAppearance = 'default';

  /**
   * Rounds the control's own chrome into a pill instead of the shared control radius. A plain
   * `<lr-radio>`'s indicator is a circle at every setting, so this is visible on
   * `<lr-radio-button>`, which inherits this class and renders rectangular chrome; it is declared
   * here so both tags carry one property with one meaning.
   */
  pill = false;

  @state() private hasLabel = false;
  @state() private hasStart = false;
  @state() private hasEnd = false;
  private labelObserver?: MutationObserver;
  /** Whether the user has acted on this radio yet, which is what gates the `user-valid`/
   *  `user-invalid` custom states: a selection or a blur. A pristine required radio is genuinely
   *  invalid, but styling it as an error before the user has done anything is hostile, which is the
   *  entire reason the `user-*` pair exists. Not `@state`: nothing in `render()` reads it. */
  private hasInteracted = false;
  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  /** Consumer-supplied validation message reflected through `custom-error`. */
  declare customError: string | null;
  private _checked = false;
  private _disabled = false;
  private _required = false;
  private _name = '';
  private _value = 'on';
  private _fieldsetDisabled = false;
  private _groupDisabled = false;
  private _groupRequired = false;
  private _groupSize: LyraSize | null = null;
  private _tabbable = true;
  private _buttonRunPosition: RadioButtonRunPosition = 'standalone';
  private groupOwner: RadioGroupController | null = null;
  private _defaultChecked = false;
  private _checkedDirty = false;
  private settingDefaultChecked = false;
  private reflectingDefaultChecked = false;

  get checked(): boolean { return this._checked; }
  set checked(value: boolean) {
    const old = this._checked;
    const next = Boolean(value);
    if (!this.settingDefaultChecked) this._checkedDirty = true;
    if (old === next) return;
    this._checked = next;
    this.syncFormState();
    this.requestUpdate('checked', old);
    if (this.isConnected) this.group()?.radioCheckedChanged?.(this);
  }
  /** Reflected current reset default; changing it never overwrites dirty live `checked` state. */
  get defaultChecked(): boolean { return this._defaultChecked; }
  set defaultChecked(value: boolean) {
    if (this.reflectingDefaultChecked) return;
    const old = this._defaultChecked;
    this._defaultChecked = Boolean(value);
    this.reflectingDefaultChecked = true;
    try { this.toggleAttribute('checked', this._defaultChecked); }
    finally { this.reflectingDefaultChecked = false; }
    if (!this._checkedDirty) this.restoreCheckedFromDefault();
    this.requestUpdate('defaultChecked', old);
  }
  get disabled(): boolean { return this._disabled; }
  set disabled(value: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(value);
    this.toggleAttribute('disabled', this._disabled);
    // Disabling bars constraint validation, so the violation itself is recomputed here -- not just
    // the states republished.
    this.updateValidity();
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
  set name(value: string | null) {
    const old = this._name;
    const next = value ?? '';
    if (old === next) {
      if (!next && this.hasAttribute('name')) this.removeAttribute('name');
      return;
    }
    this._name = next;
    if (next) {
      if (this.getAttribute('name') !== next) this.setAttribute('name', next);
    } else if (this.hasAttribute('name')) {
      this.removeAttribute('name');
    }
    this.requestUpdate('name', old);
  }
  get value(): string { return this._value; }
  set value(value: string) {
    const old = this._value;
    const next = value ?? 'on';
    if (old === next) return;
    this._value = next;
    if (value == null) {
      if (this.hasAttribute('value')) this.removeAttribute('value');
    } else if (this.getAttribute('value') !== next) {
      this.setAttribute('value', next);
    }
    this.syncFormState();
    this.requestUpdate('value', old);
  }
  get effectiveDisabled(): boolean {
    return (
      this.disabled || this._fieldsetDisabled ||
      (Boolean(this.currentGroup()) && this._groupDisabled)
    );
  }
  get effectiveRequired(): boolean {
    return this.required || (this.currentGroup() ? this._groupRequired : false);
  }
  /** Name used by the owning aggregate group without rewriting this option's authored `name`. */
  get effectiveName(): string {
    return this.currentGroup()?.name || this.name;
  }
  /** Size projected by the owning group without rewriting this option's authored `size`. */
  get effectiveSize(): LyraSize {
    return this.currentGroup()?.size ?? this._groupSize ?? this.size;
  }
  get form(): HTMLFormElement | null { return getFormOwner(this.internals); }
  set form(owner: FormOwnerValue) { setFormOwner(this, owner); }
  getForm(): HTMLFormElement | null { return getFormOwner(this.internals); }
  get labels(): NodeList { return this.internals.labels; }
  get validity(): ValidityState { return this.internals.validity; }
  get validationMessage(): string { return this.internals.validationMessage; }
  get willValidate(): boolean { return this.internals.willValidate; }

  constructor() {
    super();
    this.internals = this.safeAttachInternals();
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    installCustomErrorProperty(
      this,
      () => this.currentGroup()?.customError ?? this.validityController.customValidityMessage,
    );
    installInvalidEventAlias(this, (init: { cancelable: true }) =>
      this.emit('lr-invalid', null, init));
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

  /** @internal Matches on a part *token*, not the whole attribute: `<lr-radio-button>` encodes
   *  `checked`/`disabled` into the same part name (state after `::part()` never matches, so it has
   *  to live there), and an exact `[part="base"]` would silently stop finding the anchor the moment
   *  a second token appeared -- taking `click()`, `focus()` and validity anchoring with it. */
  [VALIDITY_ANCHOR](): HTMLElement | null {
    return this.renderRoot?.querySelector('[part~="base"]') ?? null;
  }

  private externalDescriptionLease?: ResolvedAriaRelationshipLease;

  private syncExternalDescription(): void {
    if (!this.isConnected) return;
    const target = this[VALIDITY_ANCHOR]();
    if (!target) return;
    if (this.externalDescriptionLease) this.externalDescriptionLease.update(target);
    else this.externalDescriptionLease = acquireResolvedAriaRelationship(this, target, 'aria-describedby');
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.syncExternalDescription();
  }

  private releaseExternalDescription(): void {
    this.externalDescriptionLease?.release();
    this.externalDescriptionLease = undefined;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.syncExternalDescription();
    const MutationObserverCtor = this.ownerDocument.defaultView?.MutationObserver;
    this.labelObserver = MutationObserverCtor
      ? new MutationObserverCtor(() => {
          this.bindLabelObserverTargets();
          this.recomputeHasLabel();
          this.recomputeButtonAdornments();
        })
      : undefined;
    this.addEventListener('slotchange', this.onLabelSlotChange);
    this.addEventListener('slotchange', this.onAdornmentSlotChange);
    this.bindLabelObserverTargets();
    this.recomputeHasLabel();
    this.recomputeButtonAdornments();
    this.updateValidity();
    this.group();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.releaseExternalDescription();
    if (this.hasUpdated) this.syncExternalDescription();
  }

  override disconnectedCallback(): void {
    this.releaseExternalDescription();
    this.removeEventListener('slotchange', this.onLabelSlotChange);
    this.removeEventListener('slotchange', this.onAdornmentSlotChange);
    this.labelObserver?.disconnect();
    this.labelObserver = undefined;
    super.disconnectedCallback();
  }

  formResetCallback(): void {
    // An owning radio group is the aggregate FACE/reset authority. Every radio is itself
    // form-associated, so the browser also invokes this callback on each child during the same
    // form reset; letting those child callbacks participate would overwrite the selection the
    // group has just restored (or is about to restore) from its own default value.
    if (this.currentGroup()) return;
    this.hasInteracted = false;
    this.restoreCheckedFromDefault();
    this.reflectValidityStates();
  }
  /** @internal Aggregate groups restore every owned option in one synchronous normalization pass. */
  resetFromGroup(): void {
    this.hasInteracted = false;
    this.restoreCheckedFromDefault();
  }
  private restoreCheckedFromDefault(): void {
    this.settingDefaultChecked = true;
    try { this.checked = this._defaultChecked; }
    finally { this.settingDefaultChecked = false; }
    this._checkedDirty = false;
  }
  formStateRestoreCallback(
    state: string | File | FormData | null,
    reason: 'autocomplete' | 'restore',
  ): void {
    void reason;
    if (this.currentGroup()) return;
    const old = this._checked;
    this._checked = state === 'checked';
    this._checkedDirty = true;
    this.syncFormState();
    this.requestUpdate('checked', old);
    if (this.isConnected) this.group()?.radioCheckedChanged?.(this);
  }
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    // Cascaded disablement bars constraint validation exactly like the radio's own `disabled`.
    this.updateValidity();
    this.requestUpdate();
  }

  /** Shared with every other form control: disabled (own, fieldset, or group) bars validation. */
  private get barredFromValidation(): boolean {
    return isBarredFromValidation(this, this.internals);
  }

  private updateValidity(): void {
    const owned = Boolean(this.currentGroup());
    // A barred control reports no violation at all, exactly like a native disabled radio --
    // leaving `valueMissing` raised is what leaked `:state(invalid)` onto disabled required radios.
    const violates =
      !this.barredFromValidation && !owned && this.effectiveRequired && !this.checked;
    this.validityController.setValidity(
      violates ? { valueMissing: true } : {},
      this.localize('radioRequired'),
    );
    this.reflectValidityStates();
  }

  /** Republishes the six validity custom states (`required`/`optional`, `valid`/`invalid`,
   *  `user-valid`/`user-invalid`) from whatever `ElementInternals` currently holds. `required`
   *  here is the EFFECTIVE one -- a radio inside a `required` `<lr-radio-group>` is required even
   *  with no attribute of its own, and that is what its validity is already computed from. */
  private reflectValidityStates(): void {
    syncValidityStates(this.internals, {
      required: this.effectiveRequired,
      hasInteracted: this.hasInteracted,
      barred: this.barredFromValidation,
    });
    setCustomState(this.internals, 'checked', this.checked);
    setCustomState(this.internals, 'disabled', this.effectiveDisabled);
  }
  /** @internal Driven by an owning `<lr-radio-group>`; released when the radio leaves the group's control. */
  setGroupDisabled(value: boolean): void {
    if (this._groupDisabled === value) return;
    this._groupDisabled = value;
    // Group disablement bars constraint validation exactly like the radio's own `disabled`.
    this.updateValidity();
    this.requestUpdate();
  }
  /** @internal Driven by an owning `<lr-radio-group>`; released when the radio leaves the group's control. */
  setGroupRequired(value: boolean): void {
    if (this._groupRequired === value) return;
    this._groupRequired = value;
    this.updateValidity();
    this.requestUpdate();
  }
  /** @internal Projects aggregate size while preserving the authored public property/attribute. */
  setGroupSize(value: LyraSize | null): void {
    if (this._groupSize === value) return;
    this._groupSize = value;
    this.toggleAttribute('data-lr-group-size', value !== null);
    this.requestUpdate();
  }
  /** @internal Roving-tabindex state driven by an owning `<lr-radio-group>`. */
  setGroupTabbable(value: boolean): void {
    if (this._tabbable === value) return;
    this._tabbable = value;
    this.requestUpdate();
  }
  /** @internal Actual visual-run position projected by an owning group after layout. */
  setButtonRunPosition(value: RadioButtonRunPosition): void {
    if (this._buttonRunPosition === value) return;
    this._buttonRunPosition = value;
    this.requestUpdate();
  }
  /** @internal Claims this radio for one owning `<lr-radio-group>`. */
  setGroupOwner(owner: RadioGroupController): void {
    if (this.groupOwner === owner) return;
    this.groupOwner?.releaseRadio?.(this);
    const standaloneCustomError = this.validityController.customValidityMessage;
    this.groupOwner = owner;
    if (standaloneCustomError && owner.setCustomValidity) {
      owner.setCustomValidity(standaloneCustomError);
      this.validityController.setCustomValidity('');
    }
    this.syncFormState();
  }
  /** @internal Releases state imposed by the specified owning `<lr-radio-group>`. */
  releaseGroupOwner(owner: RadioGroupController): void {
    if (this.groupOwner !== owner) return;
    this.groupOwner = null;
    this.setGroupRequired(false);
    this.setGroupDisabled(false);
    this.setGroupSize(null);
    this.setGroupTabbable(true);
    this.setButtonRunPosition('standalone');
    const reflectedCustomError = this.getAttribute('custom-error') ?? '';
    if (reflectedCustomError) this.validityController.setCustomValidity(reflectedCustomError);
    this.syncFormState();
  }

  /** Whether the radio currently satisfies its constraints — the silent query, so it deliberately
   *  does not count as interaction for the `user-*` custom states. */
  checkValidity(): boolean {
    return this.internals.checkValidity();
  }

  /** `checkValidity()`, plus the browser's own validation UI on failure. */
  reportValidity(): boolean {
    // A submit attempt runs this, and native `:user-invalid` starts matching at exactly that
    // point, so it counts as interaction for the `user-*` custom states.
    this.hasInteracted = true;
    this.reflectValidityStates();
    return this.internals.reportValidity();
  }

  /**
   * Sets or clears a consumer-supplied validation error — the standard channel for a server-side
   * rejection ("that plan is no longer available") that no client-side constraint can express. A
   * non-empty `message` raises `customError` and becomes `validationMessage`, so the control fails
   * `checkValidity()`, blocks form submission, and matches `:state(invalid)`; `''` clears it.
   *
   * Clearing restores the control's own computed validity rather than forcing it valid: a
   * required-and-unselected radio whose custom error is cleared stays `valueMissing`. The custom
   * error also survives every intrinsic recomputation in between (each selection, and every
   * group-driven `required` change, re-runs `updateValidity()`) and a form reset, exactly like a
   * native control — only another `setCustomValidity('')` clears it.
   *
   * A standalone radio owns this validity. Inside `<lr-radio-group>`, the group is the aggregate
   * form-associated owner, so this method delegates the consumer error to the group.
   *
   * The message is caller-supplied content, so it is used verbatim and never localized here.
   */
  setCustomValidity(message: string): void {
    const group = this.currentGroup();
    if (group?.setCustomValidity) {
      group.setCustomValidity(message ?? '');
      return;
    }
    this.validityController.setCustomValidity(message ?? '');
    this.reflectValidityStates();
    this.requestUpdate();
  }

  /** Clears consumer-supplied validity on the standalone radio or its owning group. */
  resetValidity(): void {
    this.setCustomValidity('');
  }

  override click(): void {
    if (!this.effectiveDisabled) this[VALIDITY_ANCHOR]()?.click();
  }
  override focus(options?: FocusOptions): void {
    if (!this.effectiveDisabled) this[VALIDITY_ANCHOR]()?.focus(options);
  }
  override blur(): void {
    this[VALIDITY_ANCHOR]()?.blur();
  }
  private syncFormState(): void {
    const owned = Boolean(this.currentGroup());
    if (owned) this.internals.setFormValue(null);
    else this.internals.setFormValue(this.checked ? this.value : null, this.checked ? 'checked' : 'unchecked');
    this.updateValidity();
  }
  private currentGroup(): RadioGroupController | null {
    // Construction and nested Lit SSR happen before usable light-DOM ancestry exists. Defer
    // ownership discovery until connection, and tolerate partial DOM shims with no `closest()`.
    if (!this.isConnected) return null;
    const closest = (this as unknown as { closest?: (selector: string) => Element | null }).closest;
    if (typeof closest !== 'function') return null;
    const group = closest.call(this, tag('radio-group')) as
      | (HTMLElement & RadioGroupController) | null;
    return group?.isConnected && group.ownsRadio?.(this) ? group : null;
  }
  private group(): RadioGroupController | null {
    const group = this.currentGroup();
    if (!group) {
      this.groupOwner?.releaseRadio?.(this);
      return null;
    }
    this.setGroupOwner(group);
    group.reconcileRadio?.(this);
    return group;
  }
  /** @internal Group-driven activation (arrow keys). Shares the click/Space path so every
   *  modality emits the same native/prefixed value-event sequence from the owning group. */
  activateFromGroup(): void {
    this.select();
  }

  private select(): void {
    const group = this.group();
    if (this.effectiveDisabled || this.checked) return;
    this.hasInteracted = true;
    if (group) {
      if (!group.selectRadio?.(this)) return;
      return;
    }
    this.checked = true;
    dispatchNativeEvent(this, 'input');
    this.emit('lr-input', { checked: true, value: this.value });
    dispatchNativeEvent(this, 'change');
    this.emit('lr-change', { checked: true, value: this.value });
  }
  /** Roving-tabindex state an owning group imposes; `<lr-radio-button>` reads it for its own
   *  `tabindex`, which is the only reason it is not private. */
  protected get groupTabbable(): boolean { return this._tabbable; }
  /** Actual contiguous button-run position. Standalone and non-adjacent controls stay rounded. */
  protected get buttonRunPosition(): RadioButtonRunPosition { return this._buttonRunPosition; }

  // Protected rather than private so `<lr-radio-button>` can render different chrome around the
  // identical activation contract instead of reimplementing (and drifting from) it.
  private isNestedInteractiveEvent(event: Event): boolean {
    const currentTarget = event.currentTarget;
    for (const entry of event.composedPath()) {
      if (entry === currentTarget) break;
      if (
        entry &&
        typeof entry === 'object' &&
        (entry as Node).nodeType === 1 &&
        isActionableElement(entry as Element)
      ) return true;
    }
    return false;
  }

  protected onClick: () => void = (event?: MouseEvent): void => {
    if (event && this.isNestedInteractiveEvent(event)) {
      event.stopPropagation();
      return;
    }
    this.select();
  };
  protected onKeyDown = (event: KeyboardEvent): void => {
    if (this.isNestedInteractiveEvent(event)) {
      event.stopPropagation();
      return;
    }
    if (this.effectiveDisabled) return;
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      this.select();
    }
  };
  protected onFocus = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
  };
  protected onBlur = (event: FocusEvent): void => {
    if (!this.effectiveDisabled) {
      this.hasInteracted = true;
      this.reflectValidityStates();
    }
    relayNativeEvent(this, event);
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

  private adornmentForwardingSlots(): HTMLSlotElement[] {
    const names = ['start', 'prefix', 'end', 'suffix'];
    return Array.from(this.querySelectorAll<HTMLSlotElement>('slot')).filter((slot) => {
      let top: Node = slot;
      while (top.parentNode && top.parentNode !== this) top = top.parentNode;
      return (
        top === slot &&
        top.parentNode === this &&
        names.includes(slot.getAttribute('slot') ?? '')
      );
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
    for (const slot of this.adornmentForwardingSlots()) {
      if (slot.assignedNodes().length === 0) continue;
      for (const assigned of slot.assignedNodes({ flatten: true })) this.observeLabelNode(assigned);
    }
  }

  private recomputeHasLabel(): void {
    const slot = this.renderRoot.querySelector<HTMLSlotElement>('slot:not([name])');
    const nodes: Node[] = slot
      ? slot.assignedNodes({ flatten: true })
      : Array.from(this.childNodes ?? [])
          .filter((node) => this.isDefaultLabelNode(node))
          .flatMap((node) => {
            if (node.nodeType !== 1 || (node as Element).localName !== 'slot') return [node];
            const forwardingSlot = node as HTMLSlotElement;
            return forwardingSlot.assignedNodes().length > 0
              ? forwardingSlot.assignedNodes({ flatten: true })
              : Array.from(forwardingSlot.childNodes);
          });
    this.hasLabel = hasRealContent(nodes);
  }

  private assignedAdornmentNodes(names: readonly string[]): Node[] {
    const slots = names
      .map((name) => this.renderRoot.querySelector<HTMLSlotElement>(`slot[name="${name}"]`))
      .filter((slot): slot is HTMLSlotElement => Boolean(slot));
    if (slots.length > 0) {
      return slots.flatMap((slot) => slot.assignedNodes({ flatten: true }));
    }
    const children = (this as unknown as { children?: HTMLCollection }).children;
    return (children ? Array.from(children) : [])
      .filter((element) => names.includes(element.getAttribute('slot') ?? ''))
      .flatMap((element) => {
        if (element.localName !== 'slot') return [element];
        const forwardingSlot = element as HTMLSlotElement;
        return forwardingSlot.assignedNodes().length > 0
          ? forwardingSlot.assignedNodes({ flatten: true })
          : Array.from(forwardingSlot.childNodes);
      });
  }

  private recomputeButtonAdornments(): void {
    this.hasStart = hasRealContent(this.assignedAdornmentNodes(['start', 'prefix']));
    this.hasEnd = hasRealContent(this.assignedAdornmentNodes(['end', 'suffix']));
  }

  private handleLabelSlotChange(event: Event): void {
    const target = event.target as Element | null;
    if (target?.nodeType !== 1 || target.localName !== 'slot') return;
    if (
      target.getRootNode() !== this.renderRoot &&
      !this.labelForwardingSlots().includes(target as HTMLSlotElement)
    ) return;
    this.bindLabelObserverTargets();
    this.recomputeHasLabel();
  }

  private onLabelSlotChange = (event: Event): void => this.handleLabelSlotChange(event);
  private onSlotChange = (event: Event): void => this.handleLabelSlotChange(event);
  private onAdornmentSlotChange = (): void => {
    this.bindLabelObserverTargets();
    this.recomputeButtonAdornments();
  };

  /** @internal Shared button-slot projection for `<lr-radio>` and `<lr-radio-button>`. */
  protected renderButtonContent(): TemplateResult {
    return html`
      <span part="start prefix" ?hidden=${!this.hasStart}>
        <slot name="start" @slotchange=${this.onAdornmentSlotChange}></slot>
        <slot name="prefix" @slotchange=${this.onAdornmentSlotChange}></slot>
      </span>
      <span part="label" ?hidden=${!this.hasLabel}
        ><slot @slotchange=${this.onSlotChange}></slot
      ></span>
      <span part="end suffix" ?hidden=${!this.hasEnd}>
        <slot name="end" @slotchange=${this.onAdornmentSlotChange}></slot>
        <slot name="suffix" @slotchange=${this.onAdornmentSlotChange}></slot>
      </span>
    `;
  }

  override render(): TemplateResult {
    if (this.appearance === 'button') {
      const parts = [
        'base',
        'button',
        'control',
        this.checked ? 'checked button--checked' : '',
        this.effectiveDisabled ? 'disabled' : '',
      ].filter(Boolean).join(' ');
      return html`
        <span part=${parts} data-run=${this.buttonRunPosition} role="radio"
          tabindex=${this.effectiveDisabled || !this._tabbable ? '-1' : '0'}
          aria-checked=${this.checked ? 'true' : 'false'}
          aria-disabled=${this.effectiveDisabled ? 'true' : 'false'}
          aria-required=${this.effectiveRequired ? 'true' : 'false'}
          aria-label=${this.getAttribute('aria-label') ?? nothing}
          @click=${this.onClick} @keydown=${this.onKeyDown} @focus=${this.onFocus} @blur=${this.onBlur}>
          ${this.renderButtonContent()}
        </span>
      `;
    }
    const controlParts = [
      'circle',
      'control',
      this.checked ? 'checked control--checked' : '',
    ].filter(Boolean).join(' ');
    const baseParts = ['base', this.effectiveDisabled ? 'disabled' : ''].filter(Boolean).join(' ');
    return html`
      <span part=${baseParts} role="radio" tabindex=${this.effectiveDisabled || !this._tabbable ? '-1' : '0'}
        aria-checked=${this.checked ? 'true' : 'false'}
        aria-disabled=${this.effectiveDisabled ? 'true' : 'false'}
        aria-required=${this.effectiveRequired ? 'true' : 'false'}
        aria-label=${this.getAttribute('aria-label') ?? nothing}
        @click=${this.onClick} @keydown=${this.onKeyDown} @focus=${this.onFocus} @blur=${this.onBlur}>
        <span part=${controlParts}>${this.checked ? html`<span part="dot checked-icon"></span>` : nothing}</span>
        <span part="label" ?hidden=${!this.hasLabel}><slot @slotchange=${this.onSlotChange}></slot></span>
      </span>
    `;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-radio': LyraRadio; } }

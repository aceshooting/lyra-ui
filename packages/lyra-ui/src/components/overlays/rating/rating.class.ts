import { html, svg, type PropertyValues, type SVGTemplateResult, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteCount, finiteNumber, finiteRange } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import {
  attachInternalsSafely,
  getFormOwner,
  installCustomErrorProperty,
  isBarredFromValidation,
  setFormOwner,
  type FormOwnerValue,
} from '../../../internal/form-associated.js';
import { syncValidityStates } from '../../../internal/custom-states.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { normalizeSize, type LyraSize, type LyraSizeStep } from '../../../internal/variants.js';
import { styles } from './rating.styles.js';
import { dispatchNativeEvent } from '../../../internal/native-event-relay.js';
import { installInvalidEventAlias } from '../../../internal/invalid-event-alias.js';
import { omittedEmptyStringConverter } from '../../../internal/converters.js';
import {
  EXTERNAL_LABEL_HOST_SEMANTICS,
  type ExternalLabelHostSemanticOperation,
} from '../../../internal/form-control-labels.js';
import { currentValidityValidator, type LyraFormValidator } from '../../forms/form-validator.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_rating } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const DEFAULT_MAX = 5;
/** No real-world star rating needs more stars than this; caps an untrusted `max` so it can't turn
 *  `render()`'s `Array.from({ length: count })` below into an unbounded allocation. */
const MAX_STARS = 100;
const DEFAULT_PRECISION = 1;
const MANAGED_ARIA_LABEL_ATTRIBUTE = 'data-lr-rating-managed-label';
/** A `<= 0` precision would divide-by-zero when `setValue` snaps `next / precision`; keep it
 *  comfortably positive and no coarser than the star count itself. */
const MIN_PRECISION = 0.01;

/** Visual density of the rendered symbols, on the library's one size ladder. */
export type LyraRatingSize = LyraSize;

/** Which point of a hover gesture an `lr-hover` event describes. */
export type LyraRatingHoverPhase = 'start' | 'move' | 'end';

/**
 * Renders one symbol. Called twice per position — once for the empty backdrop (`selected` false)
 * and once for the overlay clipped to that position's filled fraction (`selected` true) — so a
 * fractional `precision` still renders a partial fill. Output is decorative presentation: it is
 * inert and pointer-transparent, so pointer and keyboard selection stay on the rating control.
 * Return any Lit-renderable value; a plain string renders as text, never as markup.
 */
export type LyraRatingSymbolRenderer = (value: number, selected: boolean) => unknown;

export interface LyraRatingEventMap {
  change: Event;
  'lr-change': CustomEvent<{ value: number }>;
  'lr-hover': CustomEvent<{ phase: LyraRatingHoverPhase; value: number }>;
  focus: FocusEvent;
  blur: FocusEvent;
  'lr-focus': CustomEvent<null>;
  'lr-blur': CustomEvent<null>;
  'lr-invalid': CustomEvent<null>;
}

// A five-point star, sharing internal/icons.ts's 24x24 viewBox / 1em sizing
// contract so it reads as part of the same visual language, without adding a
// rating-only shape to that shared module. Rendered as two stacked copies per
// star -- a `currentColor`-stroked outline (the empty backdrop) and a
// `currentColor`-filled solid clipped to the filled fraction -- so a
// fractional `precision` (e.g. `0.5`) can render a partial fill instead of
// only ever snapping to the nearest whole star.
const STAR_POINTS = '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2';
function starOutline(): SVGTemplateResult {
  return svg`<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" aria-hidden="true" focusable="false"><polygon points=${STAR_POINTS}></polygon></svg>`;
}
function starSolid(): SVGTemplateResult {
  return svg`<svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true" focusable="false"><polygon points=${STAR_POINTS}></polygon></svg>`;
}

/**
 * `<lr-rating>` — a keyboard-accessible star rating control. Pointer position within a symbol is
 * mirrored under RTL and snapped to `precision`, matching keyboard/value fractional selection.
 *
 * Form-associated through `ElementInternals` directly rather than through the shared
 * `FormAssociated` mixin: this control's `value` is a number, not the plain string that mixin's
 * contract assumes, so the mixin would force every consumer through string round-tripping for what
 * is natively a numeric score. The submitted entry is the clamped value stringified (`"0"` while
 * unrated), and `required` reports `valueMissing` until a rating above zero is set. As with a
 * native range-like controls and both mirrored rating elements, the `value` content attribute and
 * IDL property control the live score. `defaultValue` / `default-value` independently own the form
 * reset target, so changing `value` never silently rewrites what `form.reset()` restores.
 *
 * The host is the single focusable `role="slider"` owner and carries its value/name/state ARIA.
 * The shadow symbol row is presentational chrome, so host ARIA customization cannot create a
 * second competing slider.
 *
 * Deliberately no label/hint/error chrome: `label` here is an accessible-name override, not visible
 * label text. A rating is a row of symbols with no field frame of its own, so a consumer wanting a
 * labeled field wraps this element in their own layout, exactly as `<lr-slider>` does.
 *
 * @customElement lr-rating
 * @event change - Bubbling, composed native `Event` emitted when a user commits a new value,
 * immediately before `lr-change`. Programmatic writes and no-op gestures are silent.
 * @event lr-change - The rating changed. `detail: { value }`.
 * @event lr-hover - The pointer entered, moved across, or left the symbols while the rating is
 * settable. `detail: { phase, value }`, where `value` is the rating that committing the current
 * pointer position would produce — enough to render a live description of what is being hovered.
 * @event focus - The native focus event from the host-owned slider.
 * @event blur - The native blur event from the host-owned slider.
 * @event lr-focus - Prefixed compatibility alias for `focus`.
 * @event lr-blur - Prefixed compatibility alias for `blur`.
 * @event lr-invalid - The rating failed a validity check. Cancelable: calling
 * `preventDefault()` also cancels the native `invalid` event behind it, suppressing the
 * browser's own validation bubble so an app can present the failure its own way.
 * @method focus - Focuses the host-owned slider.
 * @method blur - Blurs the host-owned slider.
 * @method click - Activates the host unless disabled.
 * @method checkValidity - Returns whether the control currently satisfies its constraints.
 * @method reportValidity - Same as `checkValidity`, additionally showing the browser's validation UI.
 * @method setCustomValidity - Sets (or, with `''`, clears) a consumer-supplied validation error.
 * Survives intrinsic revalidation and a form reset; clearing it restores the computed validity
 * rather than forcing the control valid.
 * @csspart base - Compatibility name for the presentational symbol row; use `rating`.
 * @csspart rating - The presentational symbol row. It is the same node as `base`.
 * @csspart star - Each visual symbol.
 * @csspart star-fill - The filled overlay inside each symbol, clipped to that
 * symbol's filled fraction (0%, a partial percentage under a fractional
 * `precision`, or 100%).
 * @cssprop [--lr-rating-fill=var(--lr-color-warning)] - Filled-symbol color.
 * @cssprop [--lr-rating-empty-color=var(--lr-color-border)] - Unfilled-symbol color, retained during
 * hover preview.
 * @cssprop [--lr-rating-size=var(--lr-font-size-xl)] - Symbol size. Each `size` step rewrites it;
 * the `m` default reproduces the treatment this component had before `size` existed.
 * @cssprop [--lr-rating-gap=var(--symbol-spacing,var(--lr-space-xs))] - Gap between symbols. It
 * takes precedence over the `--symbol-spacing` compatibility hook while preserving that hook and
 * the shared spacing token as fallbacks.
 * @cssprop [--lr-rating-active-color=color-mix(in oklab, var(--lr-rating-empty-color, var(--symbol-color, var(--lr-color-border-strong))), var(--lr-color-mix-partner) var(--lr-color-mix-active))] - Pressed-symbol color. Set it independently of
 *   `--lr-rating-empty-color` to recolor the pressed state without changing resting or hover
 *   symbols.
 * @cssprop [--symbol-color=var(--lr-rating-empty-color,var(--lr-color-border))] - Compatibility
 * alias for the inactive symbol color. `--lr-rating-empty-color` wins when both are set.
 * @cssprop [--symbol-color-active=var(--lr-rating-fill,var(--lr-color-warning))] - Compatibility
 * alias for the active symbol color. `--lr-rating-fill` wins when both are set.
 * @cssprop --symbol-size - Shoelace-compatible symbol size. It feeds the current `size` step when
 * `--lr-rating-size` is unset; the Lyra-prefixed property wins when both are set.
 * @cssprop [--symbol-spacing=var(--lr-space-xs)] - Compatibility spacing around symbols.
 * @cssstate required - A rating above zero is required. Style with `lr-rating:state(required)`.
 * @cssstate optional - No rating is required.
 * @cssstate valid - The control currently satisfies its constraints.
 * @cssstate invalid - The control currently fails its constraints — true for a pristine
 * `required` rating that has never been set, which is why validation styling should key off
 * `user-invalid` instead.
 * @cssstate user-valid - Valid, and the user has interacted: rated it, blurred it, or triggered
 * validation (a submit attempt runs `reportValidity()`).
 * @cssstate user-invalid - Invalid, and the user has interacted. This is the state to paint red;
 * a form reset returns the control to pristine and drops it again.
 * @status stable
 * @since 4.0.0
 */
export class LyraRating extends LyraElement<LyraRatingEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    rating: LYRA_DEFAULT_rating,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  /** Public WA-compatible intrinsic validator catalog. */
  static get validators(): LyraFormValidator<LyraRating>[] {
    return [currentValidityValidator('required', 'disabled', 'readonly', 'value', 'max')];
  }

  static formAssociated = true;
  static override styles = [LyraElement.styles, styles];

  static override get observedAttributes(): string[] {
    return [...new Set([...super.observedAttributes, 'role'])];
  }

  // Hand-written accessors (rather than plain reactive fields) so the host attribute, the
  // ElementInternals submission value, and validity are all recomputed synchronously on
  // assignment: native form APIs (`new FormData(form)`, `form.checkValidity()`) read them in the
  // same tick, long before Lit's async update cycle would have run.
  static override properties = {
    customError: { attribute: 'custom-error', reflect: true, noAccessor: true },
    value: { attribute: 'value', type: Number, noAccessor: true },
    defaultValue: {
      attribute: false,
      noAccessor: true,
    },
    max: { type: Number, noAccessor: true },
    name: { reflect: true, noAccessor: true, converter: omittedEmptyStringConverter },
    required: { type: Boolean, reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
  };

  @property({ type: Number }) precision = 1;
  @property({ type: Boolean, reflect: true }) readonly = false;
  /** Accessible-name property override. A host `aria-label` attribute has higher priority, and an
   * explicitly empty host attribute is preserved instead of restoring a fallback name. */
  @property({ attribute: false }) accessibleLabel = '';
  /** Accessible name for the whole control, used when the host carries no `aria-label`. Not
   *  rendered as visible text — a rating has no field frame of its own. */
  @property() label = '';
  /** Visual density; rewrites `--lr-rating-size`. Valid upstream long-form sizes remain observable
   * verbatim rather than being reflected back as a different token. */
  @property({ reflect: true }) size: LyraRatingSize = 'm';
  private get effectiveSize(): LyraSizeStep {
    const value = this.size as string;
    if (!['2xs', 'xs', 's', 'm', 'l', 'xl', 'small', 'medium', 'large'].includes(value)) return 'm';
    return normalizeSize(value as LyraSize);
  }
  /** Renders a consumer-supplied decorative symbol per position instead of the built-in star.
   * Its output cannot become a second focus or pointer target; interact with the rating control
   * itself to select a value. */
  @property({ attribute: false }) getSymbol?: LyraRatingSymbolRenderer;
  /** Internal reactive adapter for the public `default-value` compatibility attribute. The
   * supported JS property remains `defaultValue`; this accessor is not public API.
   * @internal
   * @default 0 */
  @property({ attribute: 'default-value', type: Number })
  get defaultValueAlias(): number {
    return this.defaultValue;
  }
  set defaultValueAlias(next: number | null) {
    this.defaultValue = finiteNumber(next ?? 0, 0);
  }

  /** The rating the current pointer position would commit; only meaningful while `hovering`. */
  @state() private hoverValue = 0;
  @state() private hovering = false;

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  /** Consumer-supplied validation message reflected through `custom-error`. */
  declare customError: string | null;
  private _value = 0;
  private _max = DEFAULT_MAX;
  private _name = '';
  private _required = false;
  private _disabled = false;
  private _fieldsetDisabled = false;
  private _defaultValue = 0;
  private _valueDirty = false;
  private settingDefaultValue = false;
  private reflectingDefaultValue = false;
  /** Whether the user has driven this control yet — rated it, blurred it, or triggered validation.
   *  Gates the `user-valid`/`user-invalid` custom states: a pristine `required` rating IS invalid,
   *  but painting it red before anyone has touched it is hostile. Mirrors the `FormAssociated`
   *  mixin's own flag; this control drives `ElementInternals` directly (its value is a number, not
   *  the string that mixin assumes) so it has to track the flag itself. */
  private _hasInteracted = false;
  private authorAriaLabel: string | null = null;
  private syncingHostSemantics = false;
  private externalLabelNameActive = false;

  /** Live presentational symbol row, or `null` before the render root is populated. */
  get rating(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('[part~="rating"]');
  }

  constructor() {
    super();
    installInvalidEventAlias(this, (init: { cancelable: true }) =>
      this.emit('lr-invalid', null, init));
    // Shares the mixin's attach-or-degrade helper so both paths handle a missing *and* a throwing
    // `attachInternals()` (SSR/test DOMs, partial polyfills) without breaking construction.
    this.internals = attachInternalsSafely(this);
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    installCustomErrorProperty(this, () => this.validityController.customValidityMessage);
    this.internals.setFormValue('0');
    // Retain `focusout` as an interaction signal for delegated/synthetic integration flows. The
    // host's own native `blur` listener below marks real focus transitions directly. Registered
    // once, in the constructor, so a disconnect/reconnect cycle cannot stack duplicates.
    this.addEventListener('focusout', this.markInteracted);
    this.addEventListener('keydown', this.onHostKeyDown as EventListener);
    this.addEventListener('focus', this.onFocus);
    this.addEventListener('blur', this.onBlur);
    this.syncValidityStates();
  }

  override attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {
    if (this.syncingHostSemantics && (name === 'aria-label' || name === 'role')) return;
    super.attributeChangedCallback(name, oldValue, value);
    if (name === 'aria-label') {
      const managed = this.getAttribute(MANAGED_ARIA_LABEL_ATTRIBUTE);
      const rehydratedManagedName = oldValue === null && managed !== null && managed === value;
      this.authorAriaLabel = rehydratedManagedName ? null : value;
      if (!rehydratedManagedName) {
        this.syncingHostSemantics = true;
        try {
          this.removeAttribute(MANAGED_ARIA_LABEL_ATTRIBUTE);
        } finally {
          this.syncingHostSemantics = false;
        }
      }
    }
    if (name === 'role' && value !== 'slider') {
      this.syncingHostSemantics = true;
      try {
        this.setAttribute('role', 'slider');
      } finally {
        this.syncingHostSemantics = false;
      }
    }
  }

  /** @internal Guarded label-name transactions for the host-owned role/focus surface. */
  [EXTERNAL_LABEL_HOST_SEMANTICS](operation: ExternalLabelHostSemanticOperation): boolean | void {
    if (operation.type === 'has-authored-name') return this.authorAriaLabel !== null;
    if (operation.type === 'apply') {
      this.externalLabelNameActive = true;
      this.syncingHostSemantics = true;
      try {
        this.setAttribute(MANAGED_ARIA_LABEL_ATTRIBUTE, operation.name);
        if (this.getAttribute('aria-label') !== operation.name) {
          this.setAttribute('aria-label', operation.name);
        }
      } finally {
        this.syncingHostSemantics = false;
      }
      return;
    }

    this.externalLabelNameActive = false;
    this.syncingHostSemantics = true;
    try {
      if (this.getAttribute('aria-label') === operation.appliedName) {
        if (operation.hadPrevious) {
          const previous = operation.previous ?? '';
          this.setAttribute(MANAGED_ARIA_LABEL_ATTRIBUTE, previous);
          this.setAttribute('aria-label', previous);
        } else {
          this.removeAttribute(MANAGED_ARIA_LABEL_ATTRIBUTE);
          this.removeAttribute('aria-label');
        }
      }
    } finally {
      this.syncingHostSemantics = false;
    }
    if (this.authorAriaLabel === null) this.syncHostSemantics();
  }

  /** The current rating. Clamped to `[0, max]` wherever it is read; the raw assignment is kept so
   *  a value set before `max` arrives from markup isn't silently truncated. */
  get value(): number {
    return this._value;
  }
  set value(next: number) {
    const old = this._value;
    if (!this.settingDefaultValue) this._valueDirty = true;
    this._value = typeof next === 'number' ? next : Number(next);
    this.syncFormValue();
    this.requestUpdate('value', old);
  }
  /** Current reset default; changing it never overwrites a dirty live rating. The independently
   * reflected `default-value` compatibility attribute reaches this same property.
   * @default 0 */
  get defaultValue(): number { return this._defaultValue; }
  set defaultValue(next: number | null) {
    if (this.reflectingDefaultValue) return;
    const old = this._defaultValue;
    this._defaultValue = next == null ? 0 : (typeof next === 'number' ? next : Number(next));
    this.reflectingDefaultValue = true;
    try {
      if (next == null) this.removeAttribute('default-value');
      else this.setAttribute('default-value', String(this._defaultValue));
    } finally {
      this.reflectingDefaultValue = false;
    }
    if (!this._valueDirty) this.restoreLiveValueFromDefault();
    this.requestUpdate('defaultValue', old);
  }

  /** The highest rating to show, i.e. the number of symbols rendered. */
  get max(): number {
    return this._max;
  }
  set max(next: number) {
    const old = this._max;
    this._max = typeof next === 'number' ? next : Number(next);
    // `safeValue` is clamped to `max`, so the submitted entry changes with it.
    this.syncFormValue();
    this.requestUpdate('max', old);
  }

  /** Submitted as the name half of the form-data name/value pair. */
  get name(): string {
    return this._name;
  }
  set name(next: string | null) {
    const old = this._name;
    this._name = next ?? '';
    if (this._name) this.setAttribute('name', this._name);
    else this.removeAttribute('name');
    this.requestUpdate('name', old);
  }

  /** Blocks form submission until a rating above zero is set. */
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

  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    // Reflected synchronously: `:disabled` and constraint-validation barring are both driven by
    // the live host attribute, which same-tick form APIs read.
    this.toggleAttribute('disabled', this._disabled);
    if (this._disabled) this.resetHover();
    // Disabling bars constraint validation, so the violation itself is recomputed here -- not just
    // the states republished.
    this.updateValidity();
    this.requestUpdate('disabled', old);
  }

  /** Whether the control is disabled explicitly or by an ancestor `<fieldset disabled>`. */
  get effectiveDisabled(): boolean {
    return this.disabled || this._fieldsetDisabled;
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
    return this.renderRoot?.querySelector('[part~="base"]') ?? null;
  }

  checkValidity(): boolean {
    this.updateValidity();
    return this.internals.checkValidity();
  }

  reportValidity(): boolean {
    this.updateValidity();
    // Reporting is what a submit attempt does, and a failed submit is precisely when native
    // `:user-invalid` starts matching — so it counts as interaction here too.
    this.markInteracted();
    return this.internals.reportValidity();
  }

  /**
   * Sets or clears a consumer-supplied validation error — the standard channel for a rejection no
   * client-side constraint can express ("you have already rated this item"). A non-empty `message`
   * raises `customError` and becomes `validationMessage`, so the control fails `checkValidity()`,
   * blocks submission, and matches `:state(invalid)`; `''` clears it.
   *
   * Clearing restores the control's own computed validity rather than forcing it valid: a
   * `required` control that is still unrated stays `valueMissing`. The custom error also survives
   * every intrinsic recomputation in between (each rating/`max`/`required` change re-runs
   * `updateValidity()`) and a `form.reset()` — matching a native control, where only another
   * `setCustomValidity('')` clears it.
   *
   * The message is caller-supplied content, so it is used verbatim and never localized here.
   */
  setCustomValidity(message: string): void {
    this.validityController.setCustomValidity(message ?? '');
    this.syncValidityStates();
  }

  /** Clears consumer-supplied validity and restores the current required/value constraint. */
  resetValidity(): void {
    this.setCustomValidity('');
  }

  formResetCallback(): void {
    this.resetHover();
    this.restoreLiveValueFromDefault();
    // A reset form is pristine again: drop the interaction flag so the `user-*` states stop
    // matching, even though a required-and-unrated control is still `invalid`.
    this._hasInteracted = false;
    this.syncValidityStates();
  }

  formStateRestoreCallback(
    state: string | File | FormData | null,
    reason: 'autocomplete' | 'restore',
  ): void {
    void reason;
    this.value = typeof state === 'string' ? finiteNumber(Number(state), 0) : 0;
  }

  private restoreLiveValueFromDefault(): void {
    this.settingDefaultValue = true;
    try { this.value = this._defaultValue; }
    finally { this.settingDefaultValue = false; }
    this._valueDirty = false;
  }

  formDisabledCallback(fieldsetDisabled: boolean): void {
    this._fieldsetDisabled = fieldsetDisabled;
    if (fieldsetDisabled) this.resetHover();
    this.updateValidity();
    this.requestUpdate();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // `required`/`value` may already have arrived from markup; reflect validity from the start
    // rather than only after the first assignment.
    this.updateValidity();
    this.syncHostSemantics();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    // A disconnect/reconnect cycle (drag-drop reparenting, list virtualization) never delivers the
    // pointerleave that would otherwise end the gesture, so the preview would resume frozen.
    this.resetHover();
  }

  /** `max`, normalized to a finite non-negative integer count and capped at `MAX_STARS` so an
   *  untrusted attribute can't blow up the star count rendered below. */
  private get safeMax(): number {
    return finiteCount(this.max, DEFAULT_MAX, MAX_STARS);
  }

  /** `value`, normalized to a finite number clamped to `[0, safeMax]`. */
  private get safeValue(): number {
    return finiteRange(this.value, 0, 0, this.safeMax);
  }

  /** `precision`, normalized to a finite number and kept within `[MIN_PRECISION, safeMax]` — a
   *  `<= 0` precision would otherwise divide-by-zero in `setValue`'s `next / precision` step. */
  private get safePrecision(): number {
    const precision = finiteRange(this.precision, DEFAULT_PRECISION, MIN_PRECISION, this.safeMax);
    return precision > 0 ? precision : DEFAULT_PRECISION;
  }

  /** Whether pointer/keyboard input can currently change the value. */
  private get interactive(): boolean {
    return !this.effectiveDisabled && !this.readonly;
  }

  private syncFormValue(): void {
    // Runs from property setters, which can fire before the constructor body under a DOM shim.
    if (!this.internals) return;
    this.internals.setFormValue(String(this.safeValue));
    this.updateValidity();
  }

  /**
   * Shared with every other form control: own `disabled`, a `<fieldset disabled>` ancestor, and
   * `readonly` all bar constraint validation. `readonly` used to be missing here -- every other
   * read-only-capable control barred on it, so `<lr-rating required readonly>` reported
   * `valueMissing` while `<lr-otp-input required readonly>` did not.
   */
  private get barredFromValidation(): boolean {
    return isBarredFromValidation(this, this.internals);
  }

  private updateValidity(): void {
    if (!this.validityController) return;
    if (this.barredFromValidation) {
      this.validityController.setValidity({});
    } else if (this.required && this.safeValue <= 0) {
      this.validityController.setValidity({ valueMissing: true }, this.localize('fieldRequired'));
    } else {
      this.validityController.setValidity({});
    }
    this.syncValidityStates();
  }

  /**
   * Publishes the six validity custom states. The implementation lives in
   * `internal/custom-states.ts` and is shared with the `FormAssociated` mixin, so a consumer's
   * `lr-rating:state(user-invalid)` rule behaves identically to the same rule on `lr-input`.
   */
  private syncValidityStates(): void {
    syncValidityStates(this.internals, {
      required: this.required,
      hasInteracted: this._hasInteracted,
      barred: this.barredFromValidation,
    });
  }

  /** Idempotent, and an arrow so it can be handed straight to `addEventListener`. */
  private markInteracted = (): void => {
    if (this._hasInteracted) return;
    this._hasInteracted = true;
    this.syncValidityStates();
  };

  private setValue(next: number): void {
    if (!this.interactive) return;
    // Reached only from the click and keydown handlers, so any call here is a user gesture —
    // marked before the no-op guard below, since clicking the star already selected is still
    // interaction even though it changes nothing.
    this.markInteracted();
    const precision = this.safePrecision;
    const clamped = Math.max(0, Math.min(this.safeMax, Math.round(next / precision) * precision));
    if (clamped === this.value) return;
    this.value = clamped;
    dispatchNativeEvent(this, 'change');
    this.emit('lr-change', { value: this.value });
  }

  /**
   * The rating the pointer is currently over, snapped up to `precision`, or `null` when the
   * pointer is between symbols (the gap) rather than on one. Resolved from the symbol's own box
   * rather than the control's, since the symbols are centred inside a hit-area floor that is
   * usually wider than they are.
   */
  private pointerValue(event: MouseEvent): number | null {
    const target = (event.target as HTMLElement | null)?.closest?.('[data-value]') as HTMLElement | null;
    if (!target) return null;
    const star = Number(target.dataset['value']);
    if (!Number.isFinite(star)) return null;
    const rect = target.getBoundingClientRect();
    const precision = this.safePrecision;
    if (rect.width <= 0) return Math.max(0, Math.min(this.safeMax, star));
    const physicalFraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const logicalFraction = this.effectiveDirection === 'rtl' ? 1 - physicalFraction : physicalFraction;
    const rawValue = star - 1 + logicalFraction;
    return Math.max(precision, Math.min(this.safeMax, Math.ceil(rawValue / precision) * precision));
  }

  private onClick = (event: MouseEvent): void => {
    const next = this.pointerValue(event);
    if (next === null) return;
    this.setValue(next);
  };

  private onPointerEnter = (event: PointerEvent): void => {
    if (!this.interactive) return;
    this.hovering = true;
    this.hoverValue = this.pointerValue(event) ?? this.hoverValue;
    this.emit('lr-hover', { phase: 'start', value: this.hoverValue });
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.interactive) return;
    const next = this.pointerValue(event);
    if (next === null) return;
    if (!this.hovering) {
      // A pointer can reach the symbols without a pointerenter the component saw (it re-rendered
      // under a stationary pointer, or the gesture began on a neighbouring element).
      this.hovering = true;
      this.hoverValue = next;
      this.emit('lr-hover', { phase: 'start', value: next });
      return;
    }
    if (next === this.hoverValue) return;
    this.hoverValue = next;
    this.emit('lr-hover', { phase: 'move', value: next });
  };

  /** Ends the gesture on pointerleave and on pointercancel alike — a touch drag taken over by
   *  scrolling, or palm rejection, ends with `pointercancel` and no `pointerleave` at all. */
  private onPointerEnd = (): void => {
    if (!this.hovering) return;
    this.hovering = false;
    this.emit('lr-hover', { phase: 'end', value: this.hoverValue });
  };

  /** Drops the preview without announcing an end phase, for teardown paths the user didn't drive. */
  private resetHover(): void {
    this.hovering = false;
    this.hoverValue = 0;
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    const forwardKey = this.effectiveDirection === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = this.effectiveDirection === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    if (event.key === forwardKey || event.key === 'ArrowUp') { event.preventDefault(); this.setValue(this.safeValue + this.safePrecision); }
    if (event.key === backwardKey || event.key === 'ArrowDown') { event.preventDefault(); this.setValue(this.safeValue - this.safePrecision); }
    if (event.key === 'Home') { event.preventDefault(); this.setValue(0); }
    if (event.key === 'End') { event.preventDefault(); this.setValue(this.safeMax); }
  };

  /** Real keyboard input targets the host semantic owner. Keeping the same handler on the
   * presentational base supports synthetic integration events without handling a composed native
   * event twice as it crosses the shadow boundary. */
  private onHostKeyDown = (event: KeyboardEvent): void => {
    if (event.composedPath()[0] === this) this.onKeyDown(event);
  };

  override focus(options?: FocusOptions): void {
    if (!this.effectiveDisabled) super.focus(options);
  }

  override blur(): void {
    super.blur();
  }

  override click(): void {
    if (!this.effectiveDisabled) super.click();
  }

  private onFocus = (event: FocusEvent): void => {
    if (event.target === this) this.emit('lr-focus');
  };

  private onBlur = (event: FocusEvent): void => {
    if (event.target !== this) return;
    this.markInteracted();
    this.emit('lr-blur');
  };

  /**
   * Captures a serialized author name before the managed fallback can replace it. Lit's browser
   * upgrade invokes `attributeChangedCallback()` for an authored `aria-label`, but its server
   * element renderer seeds template attributes on its host facade without that callback. The
   * private marker is therefore the durable provenance signal shared by both paths: matching
   * marker/text is our managed fallback, while unmarked (or mismatched) text belongs to the
   * author, including an explicitly empty string.
   */
  private captureHostNameProvenance(): void {
    if (this.externalLabelNameActive || this.authorAriaLabel !== null) return;
    const current = this.getAttribute('aria-label');
    if (current === null) return;
    const managed = this.getAttribute(MANAGED_ARIA_LABEL_ATTRIBUTE);
    if (managed === current) return;

    this.authorAriaLabel = current;
    if (managed === null) return;
    this.syncingHostSemantics = true;
    try {
      this.removeAttribute(MANAGED_ARIA_LABEL_ATTRIBUTE);
    } finally {
      this.syncingHostSemantics = false;
    }
  }

  private syncHostSemantics(): void {
    this.captureHostNameProvenance();
    const safeMax = this.safeMax;
    const safeValue = this.safeValue;
    const generatedLabel = this.accessibleLabel || this.label || this.localize('rating');
    this.syncingHostSemantics = true;
    try {
      this.setAttribute('role', 'slider');
      this.setAttribute('tabindex', this.effectiveDisabled ? '-1' : '0');
      this.setAttribute('aria-valuemin', '0');
      this.setAttribute('aria-valuemax', String(safeMax));
      this.setAttribute('aria-valuenow', String(safeValue));
      this.setAttribute('aria-valuetext', getNumberFormat(this.effectiveLocale).format(safeValue));
      this.setAttribute('aria-disabled', this.effectiveDisabled ? 'true' : 'false');
      this.setAttribute('aria-readonly', this.readonly ? 'true' : 'false');
      this.setAttribute('aria-required', this.required ? 'true' : 'false');
      this.setAttribute('data-effective-size', this.effectiveSize);
      if (
        !this.externalLabelNameActive &&
        this.authorAriaLabel === null &&
        this.getAttribute('aria-label') !== generatedLabel
      ) {
        this.setAttribute(MANAGED_ARIA_LABEL_ATTRIBUTE, generatedLabel);
        this.setAttribute('aria-label', generatedLabel);
      } else if (!this.externalLabelNameActive && this.authorAriaLabel === null) {
        this.setAttribute(MANAGED_ARIA_LABEL_ATTRIBUTE, generatedLabel);
      }
    } finally {
      this.syncingHostSemantics = false;
    }
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    // `disabled` can only change through its own setter; the fieldset path goes through
    // `formDisabledCallback`, and `readonly` is a plain reactive property — so a rating that
    // becomes non-settable mid-hover drops its preview here.
    if (changed.has('readonly') && !this.interactive) this.resetHover();
    this.syncHostSemantics();
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    // `readonly` bars constraint validation, and unlike `disabled` it has no hand-written setter to
    // recompute from. It has to be recomputed *after* `update()` rather than in `willUpdate()`:
    // the platform reads the reflected `readonly` *attribute* when it answers
    // `internals.willValidate`, and that attribute is only current once reflection has run.
    if (changed.has('readonly')) this.updateValidity();
  }

  /** One symbol: the consumer's `getSymbol` when set, otherwise the built-in star. */
  private symbol(star: number, selected: boolean): unknown {
    if (this.getSymbol) return this.getSymbol(star, selected);
    return selected ? starSolid() : starOutline();
  }

  /** Wraps renderer output so a consumer-supplied control cannot compete with the one slider
   * interaction surface. The star remains the event target carrying `data-value`. */
  private renderSymbol(star: number, selected: boolean): TemplateResult {
    return html`<span aria-hidden="true" inert style="pointer-events: none">${this.symbol(star, selected)}</span>`;
  }

  override render(): TemplateResult {
    const safeMax = this.safeMax;
    const safeValue = this.safeValue;
    // The hover preview is never applied to a rating that can't be changed, and is clamped in case
    // `max` shrank below the hovered position while the pointer was still down.
    const displayValue = this.hovering && this.interactive ? Math.min(this.hoverValue, safeMax) : safeValue;
    const count = Math.round(safeMax);
    return html`<div part="base rating" aria-hidden="true"
      @click=${this.onClick} @keydown=${this.onKeyDown}
      @pointerenter=${this.onPointerEnter} @pointermove=${this.onPointerMove}
      @pointerleave=${this.onPointerEnd} @pointercancel=${this.onPointerEnd}>
      ${Array.from({ length: count }, (_, index) => {
        const star = index + 1;
        const fraction = Math.max(0, Math.min(1, displayValue - index));
        return html`<span part="star" data-value=${star} ?data-filled=${fraction >= 1} aria-hidden="true">
          ${this.renderSymbol(star, false)}
          <span part="star-fill" style=${`inline-size:${fraction * 100}%`}>${this.renderSymbol(star, true)}</span>
        </span>`;
      })}
    </div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-rating': LyraRating; } }

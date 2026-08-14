import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  attachInternalsSafely,
  getFormOwner,
  installCustomErrorProperty,
  isBarredFromValidation,
  setFormOwner,
  type FormOwnerValue,
} from '../../../internal/form-associated.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { syncValidityStates } from '../../../internal/custom-states.js';
import { installInvalidEventAlias } from '../../../internal/invalid-event-alias.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraSize } from '../../../internal/variants.js';
import { isRtl } from '../../../internal/rtl.js';
import {
  decimalPlaces,
  finiteInterpolate,
  finiteNumber,
  finiteRange,
  finiteRatio,
  isSliderKey,
} from '../../../internal/numbers.js';
import { styles } from './slider.styles.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import {
  dispatchNativeEvent,
  dispatchNativeInputEvent,
  relayNativeEvent,
} from '../../../internal/native-event-relay.js';
import { activeElementIn } from '../../../internal/active-element.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_rangeEnd, LYRA_DEFAULT_rangeStart, LYRA_DEFAULT_sliderLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** PageUp/PageDown move by a larger increment than a single Arrow step,
 *  matching the WAI-ARIA APG slider pattern's expected keyboard interactions
 *  (and native `<input type=range>`). Mirrors lr-time-range's identical
 *  constant. */
const PAGE_STEP_MULTIPLIER = 10;

function isFormDataValue(value: unknown): value is FormData {
  if (value === null || typeof value !== 'object') return false;
  try {
    const candidate = value as Partial<FormData>;
    return Object.prototype.toString.call(value) === '[object FormData]'
      && typeof candidate.append === 'function'
      && typeof candidate.values === 'function';
  } catch {
    return false;
  }
}

/** Upper bound on the number of `step` intervals `with-markers` will draw.
 *  A legitimate fractional step (`step="1e-7"` over `[0, 1]`) implies ten
 *  million ticks, which would be indistinguishable visually and would hang
 *  the page while it built the nodes — beyond this ceiling the tick grid is
 *  dropped entirely rather than half-drawn. */
const MAX_MARKER_INTERVALS = 100;

/** Presence boolean that also accepts the explicit HTML spelling `="false"`. */
const falseDefaultBooleanConverter = {
  fromAttribute: (value: string | null): boolean => value !== null && value !== 'false',
};

/** Shadow-root-scoped id of the rendered hint region, referenced by each
 *  handle's `aria-describedby`. Ids are scoped per shadow root, so a fixed
 *  one cannot collide across instances. */
const HINT_ID = 'slider-hint';
const ERROR_ID = 'slider-error';
const LABEL_ID = 'slider-label';

/** The value axis. `'horizontal'` maps values to the inline axis (mirroring
 *  under RTL), `'vertical'` to the block axis with the domain minimum at the
 *  block end. */
export type SliderOrientation = 'horizontal' | 'vertical';

/** Side of a handle used for its focus/drag tooltip. */
export type SliderTooltipPlacement = 'top' | 'right' | 'bottom' | 'left';

/** Which handle a value belongs to: the single thumb of a plain slider, or
 *  one of the two handles of a `range` slider. */
export type SliderHandle = 'value' | 'min' | 'max';

/** Formats a finite, clamped slider value for `aria-valuetext` (and for the
 *  `with-tooltip` bubble); return a nullish value to omit `aria-valuetext`
 *  for that handle. The second argument identifies which handle is being
 *  formatted — `'value'` for a single-handle slider. */
export type SliderValueFormatter = (
  value: number,
  handle: SliderHandle,
) => string | null | undefined;

/** Payload of `lr-input`/`lr-change`. `value` is the value of the handle that
 *  moved and `handle` says which one that was; `minValue`/`maxValue` always
 *  carry both range-handle positions. */
export interface LyraSliderChangeDetail {
  value: number;
  minValue: number;
  maxValue: number;
  handle: SliderHandle;
}

export interface LyraSliderEventMap {
  input: InputEvent;
  change: Event;
  'lr-input': CustomEvent<LyraSliderChangeDetail>;
  'lr-change': CustomEvent<LyraSliderChangeDetail>;
  focus: FocusEvent;
  blur: FocusEvent;
  'lr-focus': CustomEvent<undefined>;
  'lr-blur': CustomEvent<undefined>;
  'lr-invalid': CustomEvent<undefined>;
}

interface SliderDragState {
  handle: SliderHandle;
  changed: boolean;
  /** `[part="track"]`'s rect and the resolved direction, snapshotted once per
   *  gesture rather than re-read on every pointermove:
   *  getBoundingClientRect()/getComputedStyle() in a window-level pointermove
   *  handler force a synchronous layout/style flush interleaved with the
   *  previous move's own style writes, and neither value changes from this
   *  component's own updates mid-drag (the drag only moves the thumb and
   *  indicator, never the track's box). Re-measured at every gesture start,
   *  so any between-gesture layout change is always picked up. */
  rect: DOMRect | null;
  rtl: boolean;
}

class LyraSliderBase extends LyraElement<LyraSliderEventMap> {}

/**
 * `<lr-slider>` — a numeric range control (e.g. an LLM "temperature"
 * setting), form-associated. Its live `value` and reflected/reset `defaultValue` are numbers;
 * `valueAsNumber` remains a numeric alias and `valueAsString` preserves the library's former
 * string round-trip explicitly. A bare slider starts at `0`, matching the mapped contract rather
 * than silently choosing the domain midpoint.
 *
 * Clicking anywhere on the track (not just the 16px thumb) jumps the thumb
 * to that point and continues the same gesture as a drag, matching native
 * `<input type=range>` click-to-seek. In `range` mode the click moves
 * whichever handle is nearer the clicked position.
 *
 * `range` turns the control into a two-handle selection between `minValue` and `maxValue`, which
 * default to `0` and `50`. When one handle crosses the other it pushes its sibling instead of
 * stopping, so the active thumb always follows the user's pointer/key. A named range submits two
 * same-name `FormData` entries in lower/upper order; a single slider submits one numeric string.
 *
 * `label`/`hint`/`errorText` plus their slots render visible form context. `with-label`/`with-hint`
 * are SSR presence hints only: hydrated instances also detect populated content automatically.
 * Every handle references visible error content before hint content through `aria-describedby`.
 * The `reference` slot supplies endpoint/unit context in the `references` part. All four text
 * regions wrap unbroken content within the slider's allocation in LTR and RTL instead of widening
 * it.
 *
 * @customElement lr-slider
 * @event input - Native event fired continuously while a user moves a handle.
 * @event change - Native event fired when a handle interaction commits.
 * @event lr-input - Fired continuously during an active drag or a
 *   keyboard step (including OS key-repeat while a key is held), mirroring
 *   native `<input type=range>`'s own `input` event.
 *   `detail: { value, minValue, maxValue, handle }`.
 * @event lr-change - Fired once an interaction commits: on pointerup for a
 *   drag, or on keyup for a keyboard step — so a single Arrow/Home/End/
 *   PageUp/PageDown press fires both `lr-input` and `lr-change`,
 *   mirroring how native `<input type=range>` fires `change` on every
 *   committed step too. `detail: { value, minValue, maxValue, handle }`.
 * @event focus - Native focus relayed once from the focused thumb.
 * @event blur - Native blur relayed once from the thumb losing focus.
 * @event lr-focus - Prefixed compatibility alias for `focus`.
 * @event lr-blur - Prefixed compatibility alias for `blur`.
 * @event lr-invalid - The slider failed a validity check. Cancelable: calling `preventDefault()`
 * also cancels the native `invalid` event behind it, suppressing the browser's own validation
 * bubble so an app can present the failure its own way.
 * @slot label - Rich visible label content, appended after the plain `label` property.
 * @slot hint - Rich hint content, replacing the plain-text `hint` attribute.
 * @slot help-text - Shoelace-compatible alias for the `hint` slot.
 * @slot error - Rich error content, replacing the plain-text `errorText` property.
 * @slot reference - Endpoint or unit references rendered beside the track.
 * @csspart base - Compatibility name on the interactive track row; use `slider`.
 * @csspart slider - Interactive track row. It is the same node as `base`.
 * @csspart form-control - Shoelace-compatible name on the same interactive row.
 * @csspart form-control-label - Shoelace-compatible name on the visible label.
 * @csspart form-control-input - Shoelace-compatible name on the interactive track row.
 * @csspart form-control-help-text - Shoelace-compatible name on the hint region.
 * @csspart input - Shoelace-compatible name on the interactive track row.
 * @csspart label - Visible label content.
 * @csspart references - Wrapper for the `reference` slot.
 * @csspart control - The row wrapping the track and the optional value readout. Carries
 *   `role="group"` (named from `label`/`aria-label`) in `range` mode, so the two handles are
 *   announced as one control.
 * @csspart track - The full-length background line.
 * @csspart indicator - The filled portion of the track: from `min` up to the current value, or
 *   between the two handles in `range` mode.
 * @csspart markers - The tick-mark container rendered when `with-markers` is set.
 * @csspart marker - One `step`-grid tick mark.
 * @csspart thumb - A draggable handle (`role="slider"`). Present on every handle, including
 *   both range handles.
 * @csspart thumb-min - The lower handle in `range` mode (also carries `thumb`).
 * @csspart thumb-max - The upper handle in `range` mode (also carries `thumb`).
 * @csspart tooltip - The live value bubble rendered per handle when `with-tooltip` is set.
 * @csspart tooltip__tooltip - Upstream alias on the tooltip bubble.
 * @csspart tooltip__content - Tooltip text wrapper.
 * @csspart tooltip__arrow - Decorative tooltip arrow.
 * @csspart tooltip-visible - Added to `tooltip` while that handle is focused or being dragged.
 * @csspart value - The visible numeric readout, rendered when `show-value` is true.
 * @csspart error - The error region, hidden while neither `errorText` nor the `error` slot has content.
 * @csspart hint - The hint region, hidden while neither `hint` nor the `hint` slot has content.
 * @method focus - Focuses the first thumb, or the lower thumb in range mode.
 * @method blur - Blurs whichever thumb currently owns focus.
 * @method click - Activates the first thumb.
 * @method stepUp - Silently increments the focused thumb (or the single/lower thumb) by `step`.
 * @method stepDown - Silently decrements the focused thumb (or the single/lower thumb) by `step`.
 * @method getForm - Returns the resolved form owner.
 * @method checkValidity - Returns whether custom constraint validation currently passes.
 * @method reportValidity - Reports validity through the browser's validation UI.
 * @method setCustomValidity - Sets or clears a caller-supplied validation message.
 * @cssprop [--lr-slider-gap=var(--lr-space-s)] - Gap between the track row, value, label,
 * references, and hint as they wrap.
 * @cssprop [--lr-slider-track-length=var(--lr-size-10rem)] - Length of the track in
 *   `orientation="vertical"`; the horizontal track fills its container instead. Declared as an
 *   inline `var()` fallback (never on `:host`), so a consumer override at any ancestor wins.
 * @cssprop [--lr-slider-row-size=calc(var(--lr-form-control-height) * 0.6)] - Cross-axis extent of
 * the control's interactive row: its block size when horizontal, its inline size when vertical.
 * Scales off the shared form-control ladder, so a size tier moves it without a per-tier rule.
 * @cssprop [--lr-slider-thumb-size=calc(var(--lr-form-control-height) * 0.4)] - Diameter of each
 *   draggable handle, derived from the `size` tier's shared control height. The transparent drag
 *   area around it never drops below 1.75rem/28px, whatever this is set to.
 * @cssprop [--lr-slider-track-thickness=calc(var(--lr-slider-thumb-size) * 0.25)] - Thickness of
 *   the track, the filled indicator and (scaled from it) the `with-markers` ticks.
 * @cssprop [--lr-slider-thumb-bg=var(--lr-color-brand)] - Resting thumb background.
 * @cssprop [--lr-slider-thumb-border-color=var(--lr-color-surface)] - Resting thumb border.
 * @cssprop [--lr-slider-thumb-hover-ring-color=var(--lr-color-brand-quiet)] - Thumb ring while
 * hovered.
 * @cssprop [--lr-slider-thumb-active-ring-color=var(--lr-slider-thumb-hover-ring-color)] - Thumb
 * ring while pressed.
 * @cssprop --thumb-size - Shoelace alias setting both thumb dimensions.
 * @cssprop --thumb-width - Upstream thumb inline size.
 * @cssprop --thumb-height - Upstream thumb block size.
 * @cssprop --track-height - Shoelace alias for track thickness.
 * @cssprop --track-size - Web Awesome alias for track thickness.
 * @cssprop --track-color-active - Filled indicator color.
 * @cssprop --track-color-inactive - Resting track color.
 * @cssprop --track-active-offset - Additional indicator offset.
 * @cssprop --tooltip-offset - Shoelace tooltip distance alias.
 * @cssprop [--lr-slider-tooltip-distance=8] - Numeric CSS-pixel distance written by the
 *   `tooltipDistance` property for the internal tooltip-placement calculation.
 * @cssprop --marker-width - Marker inline size.
 * @cssprop --marker-height - Marker block size.
 * @cssprop [--lr-form-control-required-content=' *'] - The required marker appended to
 * `form-control-label` while `required` is set. Set it to `''` to suppress the marker, or to any
 * other quoted string (`' (required)'`, a localized word) to replace it.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Required-marker color,
 * themeable independently of error text and invalid borders.
 * @cssprop [--lr-form-control-required-offset=0] - Inline space between the label text and the
 * required marker.
 * @cssstate disabled - The control is disabled directly or by a fieldset.
 * @cssstate dragging - At least one pointer drag is active.
 * @cssstate focused - One of the thumbs owns focus.
 * @cssstate required - The `required` form flag is set.
 * @cssstate optional - The `required` form flag is not set.
 * @cssstate valid - The slider has no custom validity error.
 * @cssstate invalid - The slider has a custom validity error.
 * @cssstate user-valid - Valid after user interaction or an explicit validity report.
 * @cssstate user-invalid - Invalid after user interaction or an explicit validity report.
 * @status stable
 * @since 4.0.0
 */
export class LyraSlider extends LyraSliderBase {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    rangeEnd: LYRA_DEFAULT_rangeEnd,
    rangeStart: LYRA_DEFAULT_rangeStart,
    sliderLabel: LYRA_DEFAULT_sliderLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static formAssociated = true;
  static override styles = [LyraElement.styles, sizes, styles];

  // These accessors sanitize the live value synchronously when a range
  // setting changes. Keeping the properties `noAccessor` prevents Lit's
  // default async field setter from leaving `.value`, `.valueAsNumber`, and
  // ElementInternals' form value disagreeing until the next update flush.
  static override properties = {
    customError: { attribute: 'custom-error', reflect: true, noAccessor: true },
    value: { attribute: false, noAccessor: true },
    defaultValue: {
      attribute: 'value',
      type: Number,
      reflect: true,
      useDefault: true,
      noAccessor: true,
    },
    name: { reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    min: { type: Number, noAccessor: true },
    max: { type: Number, noAccessor: true },
    step: { type: Number, noAccessor: true },
    // Same reasoning: `range` decides whether this control contributes to
    // FormData at all, and `minValue`/`maxValue` are read back synchronously
    // by consumers right after assignment.
    range: { type: Boolean, reflect: true, noAccessor: true },
    minValue: { type: Number, attribute: 'min-value', noAccessor: true },
    maxValue: { type: Number, attribute: 'max-value', noAccessor: true },
    size: { reflect: true },
  };

  /**
   * Control size, on the library's shared ladder. Accepts both spellings of every tier —
   * `2xs`/`xs`/`s`/`m`/`l`/`xl` and Web Awesome's `small`/`medium`/`large` — so migrating either way
   * is a tag rename. Scales the track, the filled indicator, the tick marks and the handles off the
   * same `--lr-form-control-*` values `<lr-input>`/`<lr-select>`/`<lr-button>` use, so controls of
   * one `size` line up in a row. The handle's transparent drag area keeps its own 1.75rem/28px
   * floor at every tier, so a small slider is still a conformant pointer target.
   */
  size: LyraSize = 'm';

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  /** Caller-supplied constraint-validation message.
   * @default null */
  declare customError: string | null;
  private _value = 0;
  private _defaultValue = 0;
  private _valueDirty = false;
  private settingDefaultValue = false;
  private reflectingDefaultValue = false;
  private _name: string | null = null;
  private _required = false;
  private _disabled = false;
  private _fieldsetDisabled = false;
  private _hasInteracted = false;
  private _min = 0;
  private _max = 100;
  private _step = 1;
  private _range = false;
  private _minValue = 0;
  private _maxValue = 50;
  private _minValueDirty = false;
  private _maxValueDirty = false;
  private applyingRangeValueAttribute = false;
  private _defaultMinValue = 0;
  private _defaultMaxValue = 50;

  constructor() {
    super();
    this.internals = attachInternalsSafely(this);
    this.validityController = new AnchoredValidityController(
      this,
      this.internals,
      () => this[VALIDITY_ANCHOR](),
    );
    installCustomErrorProperty(this, () => this.validityController.customValidityMessage);
    installInvalidEventAlias(this, (init: { cancelable: true }) =>
      this.emit('lr-invalid', undefined, init));
    this.internals.setFormValue('0', '0');
    this.addEventListener('input', this.markInteracted);
    this.addEventListener('change', this.markInteracted);
    this.addEventListener('focusout', this.markFocusoutInteracted);
    this.syncValidityStates();
  }

  /** Live numeric value. String writes remain accepted as a source-compatible input path, but
   * reads are always finite numbers; use `valueAsString` when a string round-trip is desired.
   * @default 0 */
  get value(): number {
    return this._value;
  }
  set value(next: number | string) {
    const old = this._value;
    if (!this.settingDefaultValue) this._valueDirty = true;
    this._value = this.clampValue(finiteNumber(Number(next), this.defaultNumericValue()));
    this.syncFormValue();
    this.requestUpdate('value', old);
  }

  /** Reflected numeric reset default, sourced from the `value` content attribute.
   * @default 0 */
  get defaultValue(): number {
    return this._defaultValue;
  }
  set defaultValue(next: number | string | null) {
    if (this.reflectingDefaultValue) return;
    const old = this._defaultValue;
    this._defaultValue = next == null
      ? 0
      : finiteNumber(Number(next), 0);
    this.reflectingDefaultValue = true;
    try {
      if (next == null) this.removeAttribute('value');
      else this.setAttribute('value', String(this._defaultValue));
    } finally {
      this.reflectingDefaultValue = false;
    }
    if (!this._valueDirty) this.restoreLiveValueFromDefault();
    this.requestUpdate('defaultValue', old);
  }

  /** Numeric compatibility alias for `value`.
   * @default 0 */
  get valueAsNumber(): number {
    return this.value;
  }
  set valueAsNumber(next: number) {
    this.value = next;
  }

  /** Explicit string compatibility accessor retained for integrations that serialize eagerly.
   * @default '0' */
  get valueAsString(): string {
    return String(this.value);
  }
  set valueAsString(next: string) {
    this.value = next;
  }

  /** Submitted form-data key. A null/empty name omits the control from submission.
   * @default null */
  get name(): string | null {
    return this._name;
  }
  set name(next: string | null) {
    const old = this._name;
    this._name = next || null;
    if (this._name) this.setAttribute('name', this._name);
    else this.removeAttribute('name');
    this.syncFormValue();
    this.requestUpdate('name', old);
  }

  /** Whether the control participates in the required form-state vocabulary. A slider always
   * has a numeric value, so this flag does not by itself make the control invalid.
   * @default false */
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

  /** Prevents focus, user edits, and form submission.
   * @default false */
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    if (this._disabled) this.pendingKeyHandle = null;
    this.syncInteractionStates();
    // Disabling bars constraint validation, so the validity states are republished here rather than
    // left matching `:state(invalid)` on a control the browser will never enforce.
    this.syncValidityStates();
    this.requestUpdate('disabled', old);
  }

  get effectiveDisabled(): boolean {
    return this.disabled || this._fieldsetDisabled;
  }

  get form(): HTMLFormElement | null {
    return getFormOwner(this.internals);
  }
  set form(owner: FormOwnerValue) {
    setFormOwner(this, owner);
  }
  getForm(): HTMLFormElement | null {
    return getFormOwner(this.internals);
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

  /** Lower domain bound.
   * @default 0 */
  get min(): number {
    return this._min;
  }
  set min(next: number) {
    const old = this._min;
    this._min = finiteNumber(next, 0);
    this.requestUpdate('min', old);
    this.sanitizeCurrentValue();
  }

  /** Upper domain bound.
   * @default 100 */
  get max(): number {
    return this._max;
  }
  set max(next: number) {
    const old = this._max;
    this._max = finiteNumber(next, 100);
    this.requestUpdate('max', old);
    this.sanitizeCurrentValue();
  }

  /** Step-grid interval; non-positive values select the unstepped mode.
   * @default 1 */
  get step(): number {
    return this._step;
  }
  set step(next: number) {
    const old = this._step;
    // A zero/negative step is retained as an explicit "unstepped" mode;
    // invalid/non-finite input follows the same safe path without poisoning
    // the current value with NaN. Removing the attribute restores the mapped
    // default instead of being mistaken for an explicit zero.
    this._step = next == null ? 1 : finiteRange(next, 0, 0);
    this.requestUpdate('step', old);
    this.sanitizeCurrentValue();
  }

  /** Two-handle mode: the control selects the span between `minValue` and
   *  `maxValue` instead of a single number. See the class doc for what this
   *  means for form submission.
   * @default false */
  get range(): boolean {
    return this._range;
  }
  set range(next: boolean) {
    const old = this._range;
    this._range = Boolean(next);
    this.requestUpdate('range', old);
    this.syncFormValue();
  }

  /** Read-only upstream alias indicating whether two handles are active.
   * @default false */
  get isRange(): boolean {
    return this.range;
  }

  /** The lower handle's value in `range` mode. Crossing pushes the upper handle.
   * @default 0 */
  get minValue(): number {
    return this._minValue;
  }
  set minValue(next: number) {
    const old = this._minValue;
    if (!this.applyingRangeValueAttribute) this._minValueDirty = true;
    this._minValue = this.clampValue(finiteNumber(next, 0));
    if (this._minValue > this._maxValue) {
      const oldMax = this._maxValue;
      this._maxValue = this._minValue;
      if (!this.applyingRangeValueAttribute) this._maxValueDirty = true;
      this.requestUpdate('maxValue', oldMax);
    }
    this.syncFormValue();
    this.requestUpdate('minValue', old);
  }

  /** The upper handle's value in `range` mode. Crossing pushes the lower handle.
   * @default 50 */
  get maxValue(): number {
    return this._maxValue;
  }
  set maxValue(next: number) {
    const old = this._maxValue;
    if (!this.applyingRangeValueAttribute) this._maxValueDirty = true;
    this._maxValue = this.clampValue(finiteNumber(next, 50));
    if (this._maxValue < this._minValue) {
      const oldMin = this._minValue;
      this._minValue = this._maxValue;
      if (!this.applyingRangeValueAttribute) this._minValueDirty = true;
      this.requestUpdate('minValue', oldMin);
    }
    this.syncFormValue();
    this.requestUpdate('maxValue', old);
  }

  /** Accessible-name fallback for the slider when the host has no `aria-label`, used when no
   *  visible label context exists around it (e.g. no wrapping `<label>` or adjacent heading).
   *  The resolved name is set on the interactive `role="slider"` element — or, in `range` mode,
   *  on the `role="group"` wrapping both handles, since each handle then owns its own
   *  start/end name. A host attribute wins by presence, including an explicitly empty value that
   *  suppresses visible/property/localized fallbacks and visible-label linkage. With neither a
   *  host `aria-label` nor this property, the localized generic `sliderLabel` message applies so
   *  the focusable thumb is never nameless (the same pattern as `<lr-input>`/`<lr-textarea>`'s
   *  built-in generic labels). */
  @property() label = '';

  /** Plain-text description of what the slider controls, rendered below the track and wired to
   *  every handle through `aria-describedby`. Use the `hint` slot instead for rich content. */
  @property() hint = '';

  /** Shoelace-compatible spelling of `hint`; `hint` wins when both are supplied. */
  @property({ attribute: 'help-text' }) helpText = '';

  /** Plain-text error associated with every handle; rich content can use the `error` slot. */
  @property({ attribute: 'error-text' }) errorText = '';

  /** SSR presence hint for visible label chrome. Hydrated instances also inspect slot content. */
  @property({ type: Boolean, attribute: 'with-label' }) withLabel = false;

  /** SSR presence hint for hint chrome. Hydrated instances also inspect both hint slots. */
  @property({ type: Boolean, attribute: 'with-hint' }) withHint = false;

  /** Focuses the first thumb after the first client render. */
  @property({ type: Boolean }) override autofocus = false;

  /** Origin of the single-slider indicator. The fill spans between this value and `value`. */
  @property({ type: Number, attribute: 'indicator-offset' }) indicatorOffset?: number;

  /** Which axis carries the value. `'vertical'` also switches the primary keys to
   *  ArrowUp/ArrowDown and exposes `aria-orientation="vertical"`. */
  @property({ reflect: true }) orientation: SliderOrientation = 'horizontal';

  /** Whether the value is displayed but not changeable. Unlike `disabled`, a read-only slider
   *  stays focusable and fully legible, and still submits its value. */
  @property({ type: Boolean, reflect: true }) readonly = false;

  /** Whether to draw a tick mark at every `step` position along the track. */
  @property({ type: Boolean, attribute: 'with-markers' }) withMarkers = false;

  /** Whether to show a live value bubble beside each focused or dragged handle. */
  @property({ type: Boolean, attribute: 'with-tooltip' }) withTooltip = false;

  /** Physical side of the handle on which the tooltip is placed. */
  @property({ reflect: true, attribute: 'tooltip-placement' })
  tooltipPlacement: SliderTooltipPlacement = 'top';

  /** Gap between a handle and its tooltip, measured in CSS pixels. */
  @property({ type: Number, attribute: 'tooltip-distance' }) tooltipDistance = 8;

  /** Shoelace-compatible tooltip switch. `none` hides; top/bottom also set the placement. */
  @property() tooltip: 'top' | 'bottom' | 'none' = 'none';

  /** Optional human-readable formatter for a handle's `aria-valuetext` (and
   *  its `with-tooltip` bubble). It receives the same finite, clamped number
   *  exposed through `aria-valuenow` plus the handle it belongs to; leaving
   *  it unset preserves the existing numeric `aria-valuetext`. Return
   *  `null`/`undefined` to omit the attribute. */
  @property({ attribute: false }) valueFormatter?: SliderValueFormatter;

  /** Shoelace-compatible single-argument tooltip formatter. */
  @property({ attribute: false }) tooltipFormatter?: (value: number) => string;

  @property({ type: Boolean, attribute: 'show-value', converter: falseDefaultBooleanConverter }) showValue = false;

  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  @state() private hasLabelSlot = false;
  @state() private hasReferenceSlot = false;

  // Keyed by pointerId (a Map, not a single scalar) so two concurrent drags
  // — a two-finger touch, one per range handle — each keep tracking their
  // own handle instead of the second pointerdown hijacking the first.
  private drags = new Map<number, SliderDragState>();
  /** Exact realm carrying shared drag listeners, retained across adoption for symmetric cleanup. */
  private dragWindow?: Window;
  /** The owner realm and handle of the pending autofocus frame, if any. */
  private autofocusFrame?: { owner: Window; handle: number };
  /** The handle whose keyboard interaction has an uncommitted change pending,
   *  or `null`. Also names the handle the eventual `lr-change` reports. */
  private pendingKeyHandle: SliderHandle | null = null;
  /** The focused handle, tracked only to decide tooltip visibility. */
  private focusedHandle: SliderHandle | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    // Attribute reactions are not ordered consistently across engines while
    // a custom element upgrades. In WebKit the reflected `value` default can
    // be applied before `step`, which would snap `value="0.2"` to the initial
    // integer grid and leave it there after `step="0.1"` arrives. Once every
    // parsed attribute is available, re-derive an untouched live value from
    // its reset default on the final domain/grid. A script-written (dirty)
    // value is only re-clamped, so reconnecting never resets user state.
    if (this._valueDirty) this.sanitizeCurrentValue();
    else this.restoreLiveValueFromDefault();
    // Keep the raw range defaults until all domain/step attributes have
    // upgraded, for the same cross-engine ordering reason as scalar `value`.
    // Dirty handles survive reconnects; untouched handles are re-derived on
    // the final grid and therefore reset to the exact declarative numbers.
    if (!this._minValueDirty) this._minValue = this.clampValue(this._defaultMinValue);
    if (!this._maxValueDirty) this._maxValue = this.clampValue(this._defaultMaxValue);
    this.sanitizeHandles();
    const slots = Array.from(this.children, (child) => child.getAttribute('slot'));
    this.hasHintSlot = slots.some((slot) => slot === 'hint' || slot === 'help-text');
    this.hasErrorSlot = slots.includes('error');
    this.hasLabelSlot = slots.includes('label');
    this.hasReferenceSlot = slots.includes('reference');
    this.syncFormValue();
    this.updateValidity();
    this.syncInteractionStates();
  }

  /**
   * `readonly` is a plain reactive property, and the platform reads its reflected *attribute* when
   * it answers `internals.willValidate` — so the barred recomputation behind the validity custom
   * states can only be correct once reflection has run. `disabled` has a hand-written setter that
   * already republishes synchronously; this covers the other barring channel.
   */
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (!changed.has('readonly')) return;
    this.syncValidityStates();
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    if (!this.autofocus) return;
    const owner = this.ownerDocument.defaultView;
    if (!owner) return;
    const handle = owner.requestAnimationFrame(() => {
      if (this.autofocusFrame?.owner !== owner || this.autofocusFrame.handle !== handle) return;
      this.autofocusFrame = undefined;
      if (this.isConnected && this.ownerDocument.defaultView === owner && this.autofocus) this.focus();
    });
    this.autofocusFrame = { owner, handle };
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    // Mirror lr-split/lr-time-range's cleanup: if the element is removed
    // mid-drag (or a pointercancel/alt-tab means pointerup never reaches
    // `window`), these window-level listeners would otherwise leak. The
    // transient tooltip state is reset for the same reason a reconnected
    // popover must not resume open at a stale position.
    this.drags.clear();
    this.pendingKeyHandle = null;
    this.focusedHandle = null;
    this.syncInteractionStates();
    this.teardownDragWindow();
    this.cancelAutofocusFrame();
  }

  adoptedCallback(): void {
    // Adoption can happen while already disconnected, so do not rely on another disconnect to
    // retire work retained from the previous realm.
    this.drags.clear();
    this.pendingKeyHandle = null;
    this.focusedHandle = null;
    this.syncInteractionStates();
    this.teardownDragWindow();
    this.cancelAutofocusFrame();
  }

  private cancelAutofocusFrame(): void {
    const autofocusFrame = this.autofocusFrame;
    this.autofocusFrame = undefined;
    if (autofocusFrame) autofocusFrame.owner.cancelAnimationFrame(autofocusFrame.handle);
  }

  override attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    const isRangeValue = name === 'min-value' || name === 'max-value';
    if (isRangeValue) this.applyingRangeValueAttribute = true;
    try {
      super.attributeChangedCallback(name, old, value);
    } finally {
      if (isRangeValue) this.applyingRangeValueAttribute = false;
    }
    // Store the unsnapped content default. WebKit can deliver this reaction
    // before `step`; clamping here would permanently lose a fractional reset
    // value. connectedCallback()/formResetCallback() resolve it on the final
    // domain and grid instead.
    if (name === 'min-value') {
      this._defaultMinValue = value === null ? 0 : finiteNumber(Number(value), 0);
    }
    if (name === 'max-value') {
      this._defaultMaxValue = value === null ? 50 : finiteNumber(Number(value), 50);
    }
  }

  formDisabledCallback(fieldsetDisabled: boolean): void {
    this._fieldsetDisabled = fieldsetDisabled;
    if (fieldsetDisabled) this.pendingKeyHandle = null;
    this.syncInteractionStates();
    // Cascaded disablement bars constraint validation exactly like the slider's own `disabled`.
    this.syncValidityStates();
    this.requestUpdate();
  }

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | null {
    return this.firstThumb();
  }

  checkValidity(): boolean {
    return this.internals.checkValidity();
  }

  reportValidity(): boolean {
    this.markInteracted();
    return this.internals.reportValidity();
  }

  setCustomValidity(message: string): void {
    this.validityController.setCustomValidity(message ?? '');
    this.syncValidityStates();
  }

  /** Clears consumer-supplied validity and restores the current range constraints. */
  resetValidity(): void {
    this.setCustomValidity('');
  }

  formResetCallback(): void {
    this.restoreLiveValueFromDefault();
    this._minValue = this._defaultMinValue;
    this._maxValue = this._defaultMaxValue;
    this._minValueDirty = false;
    this._maxValueDirty = false;
    this.sanitizeHandles();
    this._hasInteracted = false;
    this.syncFormValue();
    this.syncValidityStates();
    this.requestUpdate();
  }

  formStateRestoreCallback(
    state: string | File | FormData | null,
    reason: 'autocomplete' | 'restore',
  ): void {
    void reason;
    if (isFormDataValue(state)) {
      const values = [...state.values()].filter((entry): entry is string => typeof entry === 'string');
      if (values.length >= 2) {
        this.minValue = finiteNumber(Number(values[0]), this._defaultMinValue);
        this.maxValue = finiteNumber(Number(values[1]), this._defaultMaxValue);
      }
      return;
    }
    this.value = typeof state === 'string' ? state : this._defaultValue;
  }

  private restoreLiveValueFromDefault(): void {
    this.settingDefaultValue = true;
    try {
      this.value = this._defaultValue;
    } finally {
      this.settingDefaultValue = false;
    }
    this._valueDirty = false;
  }

  private updateValidity(): void {
    this.validityController.setValidity({});
    this.syncValidityStates();
  }

  /** Shared with every other form control: disabled (own or fieldset-cascaded) and `readonly` bar
   *  validation, so neither `:state(invalid)` nor `:state(user-invalid)` may publish from one. */
  private get barredFromValidation(): boolean {
    return isBarredFromValidation(this, this.internals);
  }

  private syncValidityStates(): void {
    syncValidityStates(this.internals, {
      required: this.required,
      hasInteracted: this._hasInteracted,
      barred: this.barredFromValidation,
    });
  }

  private markInteracted = (): void => {
    if (this._hasInteracted) return;
    this._hasInteracted = true;
    this.syncValidityStates();
  };

  private markFocusoutInteracted = (): void => {
    if (this.effectiveDisabled) return;
    this.markInteracted();
  };

  private syncInteractionStates(): void {
    const states = this.internals.states;
    const set = (name: string, active: boolean): void => {
      if (active) states.add(name);
      else states.delete(name);
    };
    set('disabled', this.effectiveDisabled);
    set('dragging', this.drags.size > 0);
    set('focused', this.focusedHandle !== null);
  }

  /** Activates the first internal thumb control, mirroring `<lr-switch>`'s identical `override
   *  click()`. Without this, `HTMLElement.prototype.click()` on the host is a no-op: no click
   *  handler is bound to the host itself, only to `[part="base"]`/the thumbs. In `range` mode
   *  this targets the lower handle, matching `focus()` below; `blur()` instead follows whichever
   *  thumb currently owns focus. */
  override click(): void {
    if (!this.effectiveDisabled) this.firstThumb()?.click();
  }

  /** Moves focus to the first internal thumb control (the lower handle in `range` mode). */
  override focus(options?: FocusOptions): void {
    if (!this.effectiveDisabled) this.firstThumb()?.focus(options);
  }

  /** Removes focus from whichever internal thumb currently owns it. */
  override blur(): void {
    const active = activeElementIn(this.shadowRoot);
    if (
      active?.nodeType === 1
      && typeof (active as Partial<Element>).matches === 'function'
      && typeof (active as Partial<HTMLElement>).blur === 'function'
      && active.matches('[part~="thumb"]')
    ) (active as HTMLElement).blur();
    else this.firstThumb()?.blur();
  }

  /** Silently advances the focused handle, matching native range IDL semantics. */
  stepUp(steps: number = 1): void {
    this.stepBy(steps);
  }

  /** Silently retreats the focused handle, matching native range IDL semantics. */
  stepDown(steps: number = 1): void {
    this.stepBy(-steps);
  }

  private stepBy(steps: number): void {
    if (!this.interactive) return;
    const step = finiteRange(this.step, 0, 0);
    if (step <= 0) return;
    const count = Math.trunc(finiteNumber(steps, 1));
    if (count === 0) return;
    const handle = this.range && this.focusedHandle !== 'max' ? 'min' : this.focusedHandle ?? 'value';
    this.assignValueFor(handle, this.valueForHandle(handle) + step * count);
  }

  private firstThumb(): HTMLElement | null {
    return (this.renderRoot?.querySelector('[part~="thumb"]') as HTMLElement | null) ?? null;
  }

  private handleElement(handle: SliderHandle): HTMLElement | null {
    const selector = { value: '[part~="thumb"]', min: '[part~="thumb-min"]', max: '[part~="thumb-max"]' }[
      handle
    ];
    return (this.renderRoot?.querySelector(selector) as HTMLElement | null) ?? null;
  }

  /** Whether a user gesture is allowed to change a value right now. `readonly`
   *  differs from `disabled` in that the control stays focusable and opaque. */
  private get interactive(): boolean {
    return !this.effectiveDisabled && !this.readonly;
  }

  /** Re-sanitize an already assigned value immediately after range settings change. */
  private sanitizeCurrentValue(): void {
    this.sanitizeHandles();
    const old = this._value;
    this._value = this.clampValue(this._value);
    if (this._value !== old) this.requestUpdate('value', old);
    this.syncFormValue();
  }

  /** Re-clamp both range handles into the current domain and step grid. */
  private sanitizeHandles(): void {
    this._minValue = this.clampValue(this._minValue);
    this._maxValue = this.clampValue(this._maxValue);
    if (this._minValue > this._maxValue) this._maxValue = this._minValue;
  }

  /** Publish a scalar string, or two same-name entries for a range. */
  private syncFormValue(): void {
    if (!this.internals) return;
    if (!this.range) {
      const serialized = String(this.value);
      this.internals.setFormValue(serialized, serialized);
      this.updateValidity();
      return;
    }
    const FormDataCtor = this.ownerDocument?.defaultView?.FormData;
    if (!FormDataCtor) {
      this.internals.setFormValue(null);
      this.updateValidity();
      return;
    }
    const state = new FormDataCtor();
    const stateKey = this.name || 'value';
    state.append(stateKey, String(this.minValue));
    state.append(stateKey, String(this.maxValue));
    if (!this.name) {
      this.internals.setFormValue(null, state);
    } else {
      const submission = new FormDataCtor();
      submission.append(this.name, String(this.minValue));
      submission.append(this.name, String(this.maxValue));
      this.internals.setFormValue(submission, state);
    }
    this.updateValidity();
  }

  private domain(): { lo: number; hi: number } {
    // A caller-supplied min/max that fails Number attribute conversion
    // arrives here as NaN, and a literal `min="Infinity"`/`max="Infinity"`
    // arrives as +-Infinity; `isNaN(...)` alone only catches the former, so
    // test finiteness instead -- otherwise Infinity propagates into every
    // clampValue()/percentOf() caller.
    const min = finiteNumber(this.min, 0);
    const max = finiteNumber(this.max, 100);
    return { lo: Math.min(min, max), hi: Math.max(min, max) };
  }

  private defaultNumericValue(): number {
    return this.clampValue(0);
  }

  private percentOf(value: number): number {
    const { lo, hi } = this.domain();
    const safeValue = finiteRange(value, lo, lo, hi);
    return finiteRatio(safeValue, lo, hi) * 100;
  }

  private clampValue(raw: number): number {
    const { lo, hi } = this.domain();
    // A NaN/Infinity `raw` (e.g. `valueAsNumber = NaN`, or a `value` string
    // that fails Number conversion) would otherwise propagate straight
    // through the Math.round/Math.max/Math.min calls below and poison the
    // submitted form value with the literal "NaN"/"Infinity" —
    // resolve it to a real, finite, in-domain number instead.
    raw = finiteNumber(raw, lo);
    // A non-positive or non-finite step would otherwise divide by zero/NaN
    // below; treat it as "unstepped" instead of propagating NaN.
    const step = finiteRange(this.step, 0, 0);
    const hasStep = step > 0;
    let stepped = raw;
    if (hasStep) {
      // Anchor the step grid at the domain's own `lo` (matching native
      // `<input type=range>`) instead of absolute 0, and round back to
      // `step`'s own decimal precision so repeated steps land on exact
      // values like 0.7 instead of 0.7000000000000001.
      const stepsFromLo = Math.round((raw - lo) / step);
      if (Number.isFinite(stepsFromLo)) {
        const candidate = lo + stepsFromLo * step;
        const factor = 10 ** Math.min(decimalPlaces(step), 15);
        if (Number.isFinite(candidate)) {
          stepped = Number.isFinite(candidate * factor)
            ? Math.round(candidate * factor) / factor
            : candidate;
        }
      }
    }
    return Math.min(hi, Math.max(lo, stepped));
  }

  /** The live number a handle represents. */
  private valueForHandle(handle: SliderHandle): number {
    if (handle === 'min') return this.minValue;
    if (handle === 'max') return this.maxValue;
    return this.valueAsNumber;
  }

  /** Each active handle can reach the full domain because crossing pushes its sibling. */
  private reachableBounds(handle: SliderHandle): { min: number; max: number } {
    const { lo, hi } = this.domain();
    void handle;
    return { min: lo, max: hi };
  }

  private detailFor(handle: SliderHandle): LyraSliderChangeDetail {
    return {
      value: this.valueForHandle(handle),
      minValue: this.minValue,
      maxValue: this.maxValue,
      handle,
    };
  }

  private emitInput(handle: SliderHandle): void {
    dispatchNativeInputEvent(this);
    this.emit('lr-input', this.detailFor(handle));
  }

  private emitChange(handle: SliderHandle): void {
    dispatchNativeEvent(this, 'change');
    this.emit('lr-change', this.detailFor(handle));
  }

  /** Assign one handle silently. Crossing pushes the sibling to the same value. */
  private assignValueFor(handle: SliderHandle, raw: number): boolean {
    const previous = this.valueForHandle(handle);
    const stepped = this.clampValue(raw);
    if (stepped === previous) return false;
    if (handle === 'min') {
      this._minValueDirty = true;
      this._minValue = stepped;
      this.requestUpdate('minValue', previous);
      if (this._minValue > this._maxValue) {
        const previousMax = this._maxValue;
        this._maxValueDirty = true;
        this._maxValue = this._minValue;
        this.requestUpdate('maxValue', previousMax);
      }
    } else if (handle === 'max') {
      this._maxValueDirty = true;
      this._maxValue = stepped;
      this.requestUpdate('maxValue', previous);
      if (this._maxValue < this._minValue) {
        const previousMin = this._minValue;
        this._minValueDirty = true;
        this._minValue = this._maxValue;
        this.requestUpdate('minValue', previousMin);
      }
    } else {
      this.value = stepped;
    }
    if (handle !== 'value') this.syncFormValue();
    return true;
  }

  /** Assign one handle as a user edit and publish the matching event pairs. */
  private setValueFor(handle: SliderHandle, raw: number, commit: boolean): boolean {
    if (!this.assignValueFor(handle, raw)) return false;
    this.emitInput(handle);
    if (commit) this.emitChange(handle);
    return true;
  }

  private onKeyDown = (handle: SliderHandle, e: KeyboardEvent): void => {
    if (!this.interactive) return;
    const current = this.valueForHandle(handle);
    // Under RTL, physical ArrowRight moves toward inset-inline-start, i.e. a
    // lower value — swap which physical key counts as "forward", matching
    // lr-split/lr-time-range's onKeyDown/onPointerMove convention.
    // ArrowUp/ArrowDown are never swapped (direction only affects the
    // horizontal inline axis), which also makes them the stable primary keys
    // for orientation="vertical".
    const rtl = isRtl(this);
    const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    const bounds = this.reachableBounds(handle);
    const move = (next: number): void => {
      e.preventDefault();
      if (this.setValueFor(handle, next, false)) this.pendingKeyHandle = handle;
    };
    if (e.key === forwardKey || e.key === 'ArrowUp') move(current + this.step);
    else if (e.key === backwardKey || e.key === 'ArrowDown') move(current - this.step);
    else if (e.key === 'PageUp') move(current + this.step * PAGE_STEP_MULTIPLIER);
    else if (e.key === 'PageDown') move(current - this.step * PAGE_STEP_MULTIPLIER);
    else if (e.key === 'Home') move(bounds.min);
    else if (e.key === 'End') move(bounds.max);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    // Only commit on release of the keys onKeyDown acts on — releasing an
    // unrelated key (Tab, Shift, ...) while a thumb happens to be focused
    // must not emit a spurious lr-change. For a single discrete press this
    // pairs one onKeyDown (lr-input) with one onKeyUp (lr-change); OS
    // key-repeat while a key is held re-fires onKeyDown (and thus
    // lr-input) repeatedly but still commits only once, on the eventual
    // keyup — the same drag-like "continuous input, single final change"
    // shape a pointer drag has.
    if (!this.interactive || !isSliderKey(e.key)) return;
    const handle = this.pendingKeyHandle;
    if (handle === null) return;
    this.pendingKeyHandle = null;
    this.emitChange(handle);
  };

  /** Resolve a pointer position to a 0..1 position along the value axis. The
   *  inline axis mirrors under RTL (the track is positioned with
   *  inset-inline-start, so 0% sits at the visual right edge); the block axis
   *  never does, and runs bottom-to-top so "up" always means "more". */
  private ratioFromPointer(e: PointerEvent, rect: DOMRect, rtl: boolean): number {
    if (this.orientation === 'vertical') {
      const raw = rect.height === 0 ? 0 : (e.clientY - rect.top) / rect.height;
      return Math.min(1, Math.max(0, 1 - raw));
    }
    const raw = rect.width === 0 ? 0 : (e.clientX - rect.left) / rect.width;
    return Math.min(1, Math.max(0, rtl ? 1 - raw : raw));
  }

  /** Which range handle a track click should grab: the nearer one, breaking a
   *  tie (including both handles sitting on the same value) in favour of the
   *  handle that can actually travel toward the click. */
  private nearestHandle(target: number): SliderHandle {
    const toMin = Math.abs(target - this.minValue);
    const toMax = Math.abs(target - this.maxValue);
    if (toMin < toMax) return 'min';
    if (toMax < toMin) return 'max';
    return target < this.minValue ? 'min' : 'max';
  }

  /** Start tracking `pointerId` as a drag of `handle`, transferring pointer
   *  capture to `captureTarget` and wiring the shared window-level move/end
   *  listeners. Shared by a pointerdown that starts on a thumb itself and one
   *  that starts elsewhere on the track (see `onBasePointerDown`), so both
   *  gestures continue identically from here on. */
  private beginDrag(
    pointerId: number,
    handle: SliderHandle,
    captureTarget: HTMLElement,
    rect: DOMRect | null,
    rtl: boolean,
  ): SliderDragState | undefined {
    const dragWindow = captureTarget.ownerDocument.defaultView;
    if (!this.isConnected || !dragWindow) return undefined;
    const firstDrag = this.drags.size === 0;
    if (!firstDrag && this.dragWindow !== dragWindow) return undefined;
    captureTarget.setPointerCapture(pointerId);
    const drag: SliderDragState = { handle, changed: false, rect, rtl };
    this.drags.set(pointerId, drag);
    if (firstDrag) {
      this.dragWindow = dragWindow;
      dragWindow.addEventListener('pointermove', this.onPointerMove);
      dragWindow.addEventListener('pointerup', this.onPointerUp);
      dragWindow.addEventListener('pointercancel', this.onPointerUp);
      dragWindow.addEventListener('lostpointercapture', this.onPointerUp);
    }
    // A drag can end without a pointerup: a system gesture / palm rejection
    // can fire `pointercancel`, and losing capture (e.g. element removed)
    // fires `lostpointercapture` — both need the same teardown as pointerup.
    this.syncInteractionStates();
    this.requestUpdate();
    return drag;
  }

  private trackRect(): DOMRect | null {
    const track = this.renderRoot.querySelector('[part="track"]') as HTMLElement | null;
    return track?.getBoundingClientRect() ?? null;
  }

  private onPointerDown = (handle: SliderHandle, e: PointerEvent): void => {
    if (!this.interactive) return;
    this.beginDrag(e.pointerId, handle, e.target as HTMLElement, this.trackRect(), isRtl(this));
  };

  /** A pointerdown anywhere on `[part="base"]` other than a thumb itself (the
   *  vast majority of the control's clickable area) jumps to that point and
   *  continues the same gesture as a drag, mirroring native
   *  `<input type=range>` click-to-seek. A pointerdown that started on a thumb
   *  bubbles up to this same listener too — already fully handled by
   *  `onPointerDown` above, so it is ignored here. In `range` mode the click
   *  is resolved to whichever handle is nearer, since a two-handle track click
   *  is otherwise ambiguous. */
  private onBasePointerDown = (e: PointerEvent): void => {
    if (!this.interactive) return;
    const thumbs = Array.from(this.renderRoot.querySelectorAll('[part~="thumb"]')) as HTMLElement[];
    if (thumbs.length === 0 || thumbs.includes(e.target as HTMLElement)) return;
    const rect = this.trackRect();
    if (!rect) return;
    const rtl = isRtl(this);
    const { lo, hi } = this.domain();
    const target = finiteInterpolate(lo, hi, this.ratioFromPointer(e, rect, rtl));
    const handle: SliderHandle = this.range ? this.nearestHandle(target) : 'value';
    const thumb = this.handleElement(handle) ?? thumbs[0];
    if (!thumb) return;
    const drag = this.beginDrag(e.pointerId, handle, thumb, rect, rtl);
    if (!drag) return;
    if (this.setValueFor(handle, target, false)) drag.changed = true;
    // Keyboard interaction (arrow keys, Home/End, ...) can continue
    // seamlessly right after the click, exactly as if the user had tabbed to
    // that handle and started dragging it directly.
    thumb.focus();
  };

  private onPointerMove = (e: PointerEvent): void => {
    const drag = this.drags.get(e.pointerId);
    if (drag === undefined) return;
    if (!this.interactive) {
      // These are window-level listeners driven by setPointerCapture, so
      // they keep firing for this pointerId regardless of the `disabled`
      // reflection — a drag already in progress would otherwise keep
      // mutating the value (and emitting lr-input) after `disabled` flips
      // true mid-drag. Abort the drag instead of continuing to process it.
      this.endDrag(e.pointerId, false);
      return;
    }
    if (!drag.rect) return;
    const { lo, hi } = this.domain();
    const value = finiteInterpolate(lo, hi, this.ratioFromPointer(e, drag.rect, drag.rtl));
    if (this.setValueFor(drag.handle, value, false)) drag.changed = true;
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.endDrag(e.pointerId, e.type === 'pointerup');
  };

  /** Stop the drag owned by `pointerId`, optionally committing a final lr-change. */
  private endDrag(pointerId: number, commit: boolean): void {
    const drag = this.drags.get(pointerId);
    if (drag === undefined) return;
    this.drags.delete(pointerId);
    if (commit && drag.changed) this.emitChange(drag.handle);
    // Only the last concurrent drag to end tears down the shared window
    // listeners — an overlapping second pointer may still be down.
    if (this.drags.size === 0) {
      this.teardownDragWindow();
    }
    this.syncInteractionStates();
    this.requestUpdate();
  }

  private teardownDragWindow(): void {
    const dragWindow = this.dragWindow;
    this.dragWindow = undefined;
    dragWindow?.removeEventListener('pointermove', this.onPointerMove);
    dragWindow?.removeEventListener('pointerup', this.onPointerUp);
    dragWindow?.removeEventListener('pointercancel', this.onPointerUp);
    dragWindow?.removeEventListener('lostpointercapture', this.onPointerUp);
  }

  private onHandleFocus(handle: SliderHandle, event: FocusEvent): void {
    this.focusedHandle = handle;
    this.syncInteractionStates();
    this.requestUpdate();
    relayNativeEvent(this, event);
    this.emit('lr-focus');
  }

  private onHandleBlur(handle: SliderHandle, event: FocusEvent): void {
    if (this.focusedHandle === handle) {
      this.focusedHandle = null;
      this.syncInteractionStates();
      this.requestUpdate();
    }
    relayNativeEvent(this, event);
    this.emit('lr-blur');
  }

  private onSlotChange = (event: Event): void => {
    const slot = event.target as HTMLSlotElement;
    if (slot.name === 'hint' || slot.name === 'help-text') {
      this.hasHintSlot = this.slotsHaveContent(['hint', 'help-text']);
    }
    if (slot.name === 'error') this.hasErrorSlot = this.slotsHaveContent(['error']);
    if (slot.name === 'label') this.hasLabelSlot = this.slotsHaveContent(['label']);
    if (slot.name === 'reference') this.hasReferenceSlot = this.slotsHaveContent(['reference']);
  };

  private slotsHaveContent(names: readonly string[]): boolean {
    return names.some((name) => {
      const slot = this.renderRoot.querySelector<HTMLSlotElement>(`slot[name="${name}"]`);
      return slot?.assignedNodes({ flatten: true }).some((node) =>
        node.nodeType === 1 || Boolean(node.textContent?.trim()),
      ) ?? false;
    });
  }

  private formatValue(value: number): string {
    return getNumberFormat(this.effectiveLocale, { maximumFractionDigits: 20 }).format(value);
  }

  /** The visible readout: one number, or both handle values joined by an en
   *  dash. Both sides are `Intl`-formatted data, never translated copy. */
  private readoutText(): string {
    if (!this.range) return this.formatValue(this.valueAsNumber);
    return `${this.formatValue(this.minValue)}–${this.formatValue(this.maxValue)}`;
  }

  /** The accessible name of the control as a whole — the single thumb's own
   *  name, or the `role="group"` name wrapping both range handles. */
  private resolvedLabel(): string {
    const hostLabel = this.getAttribute('aria-label');
    return hostLabel !== null ? hostLabel : this.label || this.localize('sliderLabel');
  }

  /** Position one absolutely-placed child along the current value axis. */
  private offsetStyle(percent: number): string {
    return this.orientation === 'vertical'
      ? `inset-block-end:${percent}%`
      : `inset-inline-start:${percent}%`;
  }

  /** Tick positions (as percentages) for `with-markers`, or an empty list when
   *  the grid is unstepped or too dense to draw. */
  private markerPercents(): number[] {
    if (!this.withMarkers) return [];
    const step = finiteRange(this.step, 0, 0);
    if (step <= 0) return [];
    const { lo, hi } = this.domain();
    const span = hi - lo;
    if (!Number.isFinite(span) || span <= 0) return [];
    const intervals = Math.round(span / step);
    if (!Number.isFinite(intervals) || intervals < 1 || intervals > MAX_MARKER_INTERVALS) return [];
    return Array.from({ length: intervals + 1 }, (_unused, index) => (index / intervals) * 100);
  }

  private renderHandle(
    handle: SliderHandle,
    describedBy: string | undefined,
    labelledBy: string | undefined,
  ): TemplateResult {
    const value = this.valueForHandle(handle);
    const bounds = this.reachableBounds(handle);
    const percent = this.percentOf(value);
    const numeric = this.formatValue(value);
    const valueText = this.valueFormatter
      ? this.valueFormatter(value, handle)
      : this.tooltipFormatter
        ? this.tooltipFormatter(value)
        : numeric;
    const partName = { value: 'thumb', min: 'thumb thumb-min', max: 'thumb thumb-max' }[handle];
    const handleLabel = {
      value: this.resolvedLabel(),
      min: this.localize('rangeStart'),
      max: this.localize('rangeEnd'),
    }[handle];
    const tooltipShown =
      this.focusedHandle === handle ||
      Array.from(this.drags.values()).some((drag) => drag.handle === handle);
    const tooltipPart = tooltipShown
      ? 'tooltip tooltip__tooltip tooltip-visible'
      : 'tooltip tooltip__tooltip';
    const showTooltip = this.withTooltip || this.tooltip !== 'none';
    const placement = this.tooltip === 'none' ? this.tooltipPlacement : this.tooltip;
    const tooltipStyle = `${this.offsetStyle(percent)};--lr-slider-tooltip-distance:${finiteRange(
      this.tooltipDistance,
      8,
      0,
    )}`;
    return html`
      <div
        part=${partName}
        role="slider"
        tabindex=${this.effectiveDisabled ? '-1' : '0'}
        aria-orientation=${this.orientation}
        aria-valuemin=${bounds.min}
        aria-valuemax=${bounds.max}
        aria-valuenow=${value}
        aria-valuetext=${valueText ?? nothing}
        aria-label=${labelledBy && handle === 'value' ? nothing : handleLabel}
        aria-labelledby=${labelledBy && handle === 'value' ? labelledBy : nothing}
        aria-describedby=${describedBy ?? nothing}
        aria-disabled=${this.effectiveDisabled ? 'true' : 'false'}
        aria-readonly=${this.readonly ? 'true' : 'false'}
        style=${this.offsetStyle(percent)}
        @pointerdown=${(e: PointerEvent) => this.onPointerDown(handle, e)}
        @keydown=${(e: KeyboardEvent) => this.onKeyDown(handle, e)}
        @keyup=${this.onKeyUp}
        @focus=${(event: FocusEvent) => this.onHandleFocus(handle, event)}
        @blur=${(event: FocusEvent) => this.onHandleBlur(handle, event)}
      ></div>
      ${showTooltip
        ? html`<span
            part=${tooltipPart}
            data-placement=${placement}
            aria-hidden="true"
            style=${tooltipStyle}
          >
            <span part="tooltip__content">${valueText ?? numeric}</span>
            <span part="tooltip__arrow"></span>
          </span>`
        : nothing}
    `;
  }

  override render(): TemplateResult {
    const vertical = this.orientation === 'vertical';
    const hasHint = this.withHint || this.hasHintSlot || this.hint.length > 0 || this.helpText.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const hasLabel = this.withLabel || this.hasLabelSlot || this.label.length > 0;
    const hasReference = this.hasReferenceSlot;
    const describedBy = [hasError ? ERROR_ID : '', hasHint ? HINT_ID : ''].filter(Boolean).join(' ') || undefined;
    const labelledBy = hasLabel && !this.hasAttribute('aria-label') ? LABEL_ID : undefined;
    const valuePercent = this.percentOf(this.value);
    const offsetPercent = this.percentOf(
      this.indicatorOffset === undefined
        ? this.domain().lo
        : finiteNumber(this.indicatorOffset, this.domain().lo),
    );
    const startPercent = this.range
      ? this.percentOf(this.minValue)
      : Math.min(valuePercent, offsetPercent);
    const endPercent = this.range
      ? this.percentOf(this.maxValue)
      : Math.max(valuePercent, offsetPercent);
    const span = Math.max(0, endPercent - startPercent);
    const indicatorStyle = vertical
      ? `inset-block-end:${startPercent}%;block-size:${span}%`
      : `inset-inline-start:${startPercent}%;inline-size:${span}%`;
    const markers = this.markerPercents();
    return html`
      <div id=${LABEL_ID} part="label form-control-label" ?hidden=${!hasLabel}>
        ${this.label}<slot name="label" @slotchange=${this.onSlotChange}></slot>
      </div>
      <div part="references" ?hidden=${!hasReference}>
        <slot name="reference" @slotchange=${this.onSlotChange}></slot>
      </div>
      <div
        part="base slider form-control form-control-input input control"
        role=${this.range ? 'group' : nothing}
        aria-label=${this.range && !labelledBy ? this.resolvedLabel() : nothing}
        aria-labelledby=${this.range && labelledBy ? labelledBy : nothing}
        @pointerdown=${this.onBasePointerDown}
      >
        <div part="track"></div>
        <div part="indicator" style=${indicatorStyle}></div>
        ${markers.length > 0
          ? html`<div part="markers" aria-hidden="true">
              ${markers.map(
                (percent) => html`<span part="marker" style=${this.offsetStyle(percent)}></span>`,
              )}
            </div>`
          : nothing}
        ${this.range
          ? html`${this.renderHandle('min', describedBy, undefined)}${this.renderHandle(
              'max',
              describedBy,
              undefined,
            )}`
          : this.renderHandle('value', describedBy, labelledBy)}
      </div>
      ${this.showValue
        ? html`<span part="value" aria-hidden="true">${this.readoutText()}</span>`
        : nothing}
      <div id=${ERROR_ID} part="error" ?hidden=${!hasError}>
        ${this.hasErrorSlot ? nothing : this.errorText}<slot name="error" @slotchange=${this.onSlotChange}></slot>
      </div>
      <div id=${HINT_ID} part="hint form-control-help-text" ?hidden=${!hasHint}>
        ${this.hint || this.helpText}<slot name="hint" @slotchange=${this.onSlotChange}></slot
        ><slot name="help-text" @slotchange=${this.onSlotChange}></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-slider': LyraSlider;
  }
}

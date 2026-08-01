import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { FormAssociated } from '../../../internal/form-associated.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraSize } from '../../../internal/variants.js';
import { isRtl } from '../../../internal/rtl.js';
import {
  decimalPlaces,
  finiteInterpolate,
  finiteMidpoint,
  finiteNumber,
  finiteRange,
  finiteRatio,
  isSliderKey,
} from '../../../internal/numbers.js';
import { styles } from './slider.styles.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { dispatchNativeEvent, relayNativeEvent } from '../../../internal/native-event-relay.js';
import { activeElementIn } from '../../../internal/active-element.js';

/** PageUp/PageDown move by a larger increment than a single Arrow step,
 *  matching the WAI-ARIA APG slider pattern's expected keyboard interactions
 *  (and native `<input type=range>`). Mirrors lr-time-range's identical
 *  constant. */
const PAGE_STEP_MULTIPLIER = 10;

/** Upper bound on the number of `step` intervals `with-markers` will draw.
 *  A legitimate fractional step (`step="1e-7"` over `[0, 1]`) implies ten
 *  million ticks, which would be indistinguishable visually and would hang
 *  the page while it built the nodes — beyond this ceiling the tick grid is
 *  dropped entirely rather than half-drawn. */
const MAX_MARKER_INTERVALS = 100;

/** Shadow-root-scoped id of the rendered hint region, referenced by each
 *  handle's `aria-describedby`. Ids are scoped per shadow root, so a fixed
 *  one cannot collide across instances. */
const HINT_ID = 'slider-hint';

/** The value axis. `'horizontal'` maps values to the inline axis (mirroring
 *  under RTL), `'vertical'` to the block axis with the domain minimum at the
 *  block end. */
export type SliderOrientation = 'horizontal' | 'vertical';

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
  input: Event;
  change: Event;
  'lr-input': CustomEvent<LyraSliderChangeDetail>;
  'lr-change': CustomEvent<LyraSliderChangeDetail>;
  focus: FocusEvent;
  blur: FocusEvent;
  'lr-focus': CustomEvent<undefined>;
  'lr-blur': CustomEvent<undefined>;
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
 * setting), form-associated. Mirrors native `<input type="range">`
 * semantics: `value` is the string form-submitted via `FormAssociated`,
 * `valueAsNumber` is the ergonomic numeric accessor (mirroring the native
 * `<input type=range>` IDL attribute of the same name) kept in sync with it
 * in both directions — reads parse `value`, writes stringify back to it.
 *
 * Unlike the mixin's other consumers, an unset `value` is eagerly defaulted
 * — on connect, and again after `form.reset()` — to the midpoint of
 * `[min, max]` snapped to `step`, the same "range sanitization algorithm"
 * default a native range input applies. A slider always represents *some*
 * number, so `required` (inherited from `FormAssociated`) only has a window
 * to block submission before that default lands, matching how `required`
 * isn't a meaningful constraint on a native range input either.
 *
 * Clicking anywhere on the track (not just the 16px thumb) jumps the thumb
 * to that point and continues the same gesture as a drag, matching native
 * `<input type=range>` click-to-seek. In `range` mode the click moves
 * whichever handle is nearer the clicked position.
 *
 * `range` turns the control into a two-handle selection between `minValue`
 * and `maxValue`. Each handle is a separately focusable `role="slider"` with
 * its own localized accessible name, and each reports the *reachable*
 * sub-range through `aria-valuemin`/`aria-valuemax` — bounded by its sibling
 * rather than by the full domain, because the handles may meet but never
 * cross. When they meet, both report the same number, the indicator has zero
 * length, and each handle can still travel away from the meeting point in
 * its own direction.
 *
 * A range slider does not submit a value: a two-value control cannot be
 * expressed through the single-string `FormAssociated` contract, so while
 * `range` is set the control removes itself from its form's `FormData`
 * (matching `<lr-time-range>`, which is likewise form-associated only for
 * the `<fieldset disabled>` cascade). Read `minValue`/`maxValue`, or the
 * `lr-change` detail, instead. Turning `range` back off restores normal
 * single-value submission.
 *
 * Deliberately no label/error chrome -- `label` here is an accessible-name override, not
 * visible label text; a labeled-field consumer wraps this element in their own layout. `hint`
 * is the one exception, since a slider's units/meaning frequently need a written explanation
 * that has nowhere else to live.
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
 * @slot hint - Rich hint content, replacing the plain-text `hint` attribute.
 * @csspart base - The row wrapping the track and the optional value readout. Carries
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
 * @csspart tooltip-visible - Added to `tooltip` while that handle is focused or being dragged.
 * @csspart value - The visible numeric readout, rendered when `show-value` is true.
 * @csspart hint - The hint region, hidden while neither `hint` nor the `hint` slot has content.
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
 */
export class LyraSlider extends FormAssociated(LyraSliderBase) {
  static override styles = [LyraElement.styles, sizes, styles];

  // These accessors sanitize the live value synchronously when a range
  // setting changes. Keeping the properties `noAccessor` prevents Lit's
  // default async field setter from leaving `.value`, `.valueAsNumber`, and
  // ElementInternals' form value disagreeing until the next update flush.
  static override properties = {
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

  private _min = 0;
  private _max = 100;
  private _step = 1;
  private _range = false;
  // `undefined` means "never assigned", which resolves to the domain bound —
  // so an untouched range slider selects its whole domain whatever `min`/
  // `max` happen to be, instead of snapping to a fixed 0/100 pair.
  private _minValue: number | undefined;
  private _maxValue: number | undefined;
  private _defaultMinValue: number | undefined;
  private _defaultMaxValue: number | undefined;
  // HTML applies observed attributes before the element is connected. Keep a
  // declarative value until all min/max/step attributes have been delivered;
  // otherwise a value attribute encountered before step="..." would be
  // snapped using the old default step and lose the author's number.
  private pendingValue: string | undefined;

  get min(): number {
    return this._min;
  }
  set min(next: number) {
    const old = this._min;
    this._min = finiteNumber(next, 0);
    this.requestUpdate('min', old);
    this.sanitizeCurrentValue();
  }

  get max(): number {
    return this._max;
  }
  set max(next: number) {
    const old = this._max;
    this._max = finiteNumber(next, 100);
    this.requestUpdate('max', old);
    this.sanitizeCurrentValue();
  }

  get step(): number {
    return this._step;
  }
  set step(next: number) {
    const old = this._step;
    // A zero/negative step is retained as an explicit "unstepped" mode;
    // invalid/non-finite input follows the same safe path without poisoning
    // the current value with NaN.
    this._step = finiteRange(next, 0, 0);
    this.requestUpdate('step', old);
    this.sanitizeCurrentValue();
  }

  /** Two-handle mode: the control selects the span between `minValue` and
   *  `maxValue` instead of a single number. See the class doc for what this
   *  means for form submission. */
  get range(): boolean {
    return this._range;
  }
  set range(next: boolean) {
    const old = this._range;
    this._range = Boolean(next);
    this.requestUpdate('range', old);
    this.syncFormValue();
  }

  /** The lower handle's value in `range` mode. Unset, it resolves to `min`.
   *  Assigning past `maxValue` stops at `maxValue` — the handles meet
   *  rather than cross. */
  get minValue(): number {
    const { lo } = this.domain();
    return this._minValue === undefined ? lo : this._minValue;
  }
  set minValue(next: number) {
    const old = this._minValue;
    const { lo } = this.domain();
    this._minValue = Math.min(this.clampValue(finiteNumber(next, lo)), this.maxValue);
    this.requestUpdate('minValue', old);
  }

  /** The upper handle's value in `range` mode. Unset, it resolves to `max`.
   *  Assigning below `minValue` stops at `minValue`. */
  get maxValue(): number {
    const { hi } = this.domain();
    return this._maxValue === undefined ? hi : this._maxValue;
  }
  set maxValue(next: number) {
    const old = this._maxValue;
    const { hi } = this.domain();
    this._maxValue = Math.max(this.clampValue(finiteNumber(next, hi)), this.minValue);
    this.requestUpdate('maxValue', old);
  }

  /** Accessible-name fallback for the slider when the host has no `aria-label`, used when no
   *  visible label context exists around it (e.g. no wrapping `<label>` or adjacent heading).
   *  The resolved name is set on the interactive `role="slider"` element — or, in `range` mode,
   *  on the `role="group"` wrapping both handles, since each handle then owns its own
   *  start/end name. With neither a host `aria-label` nor this property, the localized generic
   *  `sliderLabel` message applies so the focusable thumb is never nameless (the same pattern as
   *  `<lr-input>`/`<lr-textarea>`'s built-in generic labels). */
  @property() label = '';

  /** Plain-text description of what the slider controls, rendered below the track and wired to
   *  every handle through `aria-describedby`. Use the `hint` slot instead for rich content. */
  @property() hint = '';

  /** Which axis carries the value. `'vertical'` also switches the primary keys to
   *  ArrowUp/ArrowDown and exposes `aria-orientation="vertical"`. */
  @property({ reflect: true }) orientation: SliderOrientation = 'horizontal';

  /** Whether the value is displayed but not changeable. Unlike `disabled`, a read-only slider
   *  stays focusable and fully legible, and still submits its value. */
  @property({ type: Boolean, reflect: true }) readonly = false;

  /** Whether to draw a tick mark at every `step` position along the track. */
  @property({ type: Boolean, reflect: true, attribute: 'with-markers' }) withMarkers = false;

  /** Whether to show a live value bubble above each handle while it is focused or dragged. */
  @property({ type: Boolean, reflect: true, attribute: 'with-tooltip' }) withTooltip = false;

  /** Optional human-readable formatter for a handle's `aria-valuetext` (and
   *  its `with-tooltip` bubble). It receives the same finite, clamped number
   *  exposed through `aria-valuenow` plus the handle it belongs to; leaving
   *  it unset preserves the existing numeric `aria-valuetext`. Return
   *  `null`/`undefined` to omit the attribute. */
  @property({ attribute: false }) valueFormatter?: SliderValueFormatter;

  @property({ type: Boolean, attribute: 'show-value', converter: trueDefaultBooleanConverter }) showValue = true;

  @state() private hasHintSlot = false;

  // Keyed by pointerId (a Map, not a single scalar) so two concurrent drags
  // — a two-finger touch, one per range handle — each keep tracking their
  // own handle instead of the second pointerdown hijacking the first.
  private drags = new Map<number, SliderDragState>();
  /** The handle whose keyboard interaction has an uncommitted change pending,
   *  or `null`. Also names the handle the eventual `lr-change` reports. */
  private pendingKeyHandle: SliderHandle | null = null;
  /** The focused handle, tracked only to decide tooltip visibility. */
  private focusedHandle: SliderHandle | null = null;

  override get disabled(): boolean {
    return super.disabled;
  }

  override set disabled(next: boolean) {
    super.disabled = next;
    if (next) this.pendingKeyHandle = null;
  }

  formDisabledCallback(disabled: boolean): void {
    const parent = Object.getPrototypeOf(LyraSlider.prototype) as {
      formDisabledCallback: (this: LyraSlider, disabled: boolean) => void;
    };
    parent.formDisabledCallback.call(this, disabled);
    if (disabled) this.pendingKeyHandle = null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.pendingValue !== undefined) {
      const pending = this.pendingValue;
      this.pendingValue = undefined;
      this.value = pending;
    } else {
      this.ensureValue();
    }
    // Attributes are delivered before connection and in document order, so a
    // `min-value` written before `min` was clamped against the *default*
    // domain; re-sanitize now that every declarative attribute has landed.
    this.sanitizeHandles();
    // A hint child present from the start never fires an initial slotchange
    // in every engine, so seed the flag from the light DOM too.
    this.hasHintSlot =
      this.hasHintSlot || Array.from(this.children).some((el) => el.getAttribute('slot') === 'hint');
    this.syncFormValue();
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
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('lostpointercapture', this.onPointerUp);
  }

  override attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    // What `form.reset()` restores the range handles to — the *content
    // attribute* only, exactly as `FormAssociated` tracks `value`'s own
    // default (a later property assignment must not become permanent).
    if (name === 'min-value') this._defaultMinValue = this._minValue;
    if (name === 'max-value') this._defaultMaxValue = this._maxValue;
  }

  /** The numeric counterpart of `value`, mirroring native `<input
   *  type=range>.valueAsNumber`. Reading always returns a finite, clamped,
   *  step-snapped number — even if `value` is momentarily `""` (e.g. right
   *  after `form.reset()` restores an undeclared default) — by falling back
   *  to the midpoint of `[min, max]`. Writing stringifies the clamped result
   *  back into `value`. */
  get valueAsNumber(): number {
    if (super.value === '') return this.defaultNumericValue();
    const n = Number(super.value);
    return Number.isFinite(n) ? this.clampValue(n) : this.defaultNumericValue();
  }

  set valueAsNumber(next: number) {
    this.value = String(Number.isFinite(next) ? this.clampValue(next) : this.defaultNumericValue());
  }

  /**
   * `FormAssociated` provides the form plumbing; this override adds the
   * slider's native-range sanitization at the IDL boundary so invalid direct
   * assignments cannot briefly submit a literal `NaN`/`Infinity`.
   */
  override get value(): string {
    return super.value;
  }

  override set value(next: string) {
    const raw = next ?? '';
    if (!this.isConnected) {
      this.pendingValue = raw;
      super.value = raw;
      this.syncFormValue();
      return;
    }
    const numeric = Number(raw);
    const sanitized = raw === '' || !Number.isFinite(numeric) ? this.defaultNumericValue() : this.clampValue(numeric);
    super.value = String(sanitized);
    this.syncFormValue();
  }

  override formResetCallback(): void {
    super.formResetCallback();
    this.value = String(this.valueAsNumber);
    this._minValue = this._defaultMinValue;
    this._maxValue = this._defaultMaxValue;
    this.sanitizeHandles();
    this.requestUpdate();
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
    if (active instanceof HTMLElement && active.matches('[part~="thumb"]')) active.blur();
    else this.firstThumb()?.blur();
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

  /** If `value` is still unset, seed it with the sanitized default — the
   *  midpoint of `[min, max]`, snapped to `step` — so `value`/`valueAsNumber`
   *  and rendering never have to treat "" as a real, distinct state. */
  private ensureValue(): void {
    if (this.value === '') this.value = String(this.defaultNumericValue());
  }

  /** Re-sanitize an already assigned value immediately after range settings change. */
  private sanitizeCurrentValue(): void {
    if (!this.isConnected) return;
    this.sanitizeHandles();
    const current = super.value;
    if (current === '') return;
    const sanitized = String(this.clampValue(Number(current)));
    if (sanitized !== current) this.value = sanitized;
  }

  /** Re-clamp both explicitly-assigned range handles into the current domain
   *  and step grid, keeping `minValue <= maxValue`. Unset handles need no work
   *  — they resolve to the domain bounds on read. */
  private sanitizeHandles(): void {
    if (this._minValue !== undefined) this._minValue = this.clampValue(this._minValue);
    if (this._maxValue !== undefined) this._maxValue = this.clampValue(this._maxValue);
    const { lo, hi } = this.domain();
    const rawMin = this._minValue ?? lo;
    const rawMax = this._maxValue ?? hi;
    if (rawMin > rawMax) {
      if (this._minValue !== undefined) this._minValue = Math.min(rawMin, rawMax);
      if (this._maxValue !== undefined) this._maxValue = Math.max(rawMin, rawMax);
    }
  }

  /** Publish (or withhold) this control's submission value. A `range` slider
   *  carries two numbers, which the single-string `FormAssociated` contract
   *  cannot express, so it withdraws from `FormData` entirely instead of
   *  submitting a value it isn't showing. */
  private syncFormValue(): void {
    if (this.range) this.internals?.setFormValue(null);
    else this.internals?.setFormValue(super.value);
  }

  private domain(): { lo: number; hi: number } {
    // A caller-supplied min/max that fails Number attribute conversion
    // arrives here as NaN, and a literal `min="Infinity"`/`max="Infinity"`
    // arrives as +-Infinity; `isNaN(...)` alone only catches the former, so
    // test finiteness instead -- otherwise Infinity propagates into every
    // clampValue()/percentOf() caller (e.g. the midpoint default computing
    // `0 + Infinity / 2`).
    const min = finiteNumber(this.min, 0);
    const max = finiteNumber(this.max, 100);
    return { lo: Math.min(min, max), hi: Math.max(min, max) };
  }

  private defaultNumericValue(): number {
    const { lo, hi } = this.domain();
    return this.clampValue(finiteMidpoint(lo, hi));
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
    // submitted FormAssociated value with the literal "NaN"/"Infinity" —
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

  /** A handle's actually reachable sub-range, bounded by its sibling the same
   *  way `setValueFor()` enforces it — used both for
   *  `aria-valuemin`/`aria-valuemax` and for Home/End's jump targets, rather
   *  than reporting the full `[min, max]` domain the sibling makes partly
   *  unreachable. */
  private reachableBounds(handle: SliderHandle): { min: number; max: number } {
    const { lo, hi } = this.domain();
    if (handle === 'min') return { min: lo, max: this.maxValue };
    if (handle === 'max') return { min: this.minValue, max: hi };
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
    dispatchNativeEvent(this, 'input');
    this.emit('lr-input', this.detailFor(handle));
  }

  private emitChange(handle: SliderHandle): void {
    dispatchNativeEvent(this, 'change');
    this.emit('lr-change', this.detailFor(handle));
  }

  /** Assign one handle, clamped to the domain, the step grid, and its sibling.
   *  Returns whether anything actually moved. */
  private setValueFor(handle: SliderHandle, raw: number, commit: boolean): boolean {
    const previous = this.valueForHandle(handle);
    const stepped = this.clampValue(raw);
    // The handles may meet but never cross: the moving one stops at its
    // sibling's current value.
    const clamped =
      handle === 'min'
        ? Math.min(stepped, this.maxValue)
        : handle === 'max'
          ? Math.max(stepped, this.minValue)
          : stepped;
    if (clamped === previous) return false;
    if (handle === 'min') {
      this._minValue = clamped;
      this.requestUpdate('minValue', previous);
    } else if (handle === 'max') {
      this._maxValue = clamped;
      this.requestUpdate('maxValue', previous);
    } else {
      this.value = String(clamped);
    }
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
  ): SliderDragState {
    const drag: SliderDragState = { handle, changed: false, rect, rtl };
    this.drags.set(pointerId, drag);
    captureTarget.setPointerCapture(pointerId);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    // A drag can end without a pointerup: a system gesture / palm rejection
    // can fire `pointercancel`, and losing capture (e.g. element removed)
    // fires `lostpointercapture` — both need the same teardown as pointerup.
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('lostpointercapture', this.onPointerUp);
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
      window.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerup', this.onPointerUp);
      window.removeEventListener('pointercancel', this.onPointerUp);
      window.removeEventListener('lostpointercapture', this.onPointerUp);
    }
    this.requestUpdate();
  }

  private onHandleFocus(handle: SliderHandle, event: FocusEvent): void {
    this.focusedHandle = handle;
    this.requestUpdate();
    relayNativeEvent(this, event);
    this.emit('lr-focus');
  }

  private onHandleBlur(handle: SliderHandle, event: FocusEvent): void {
    if (this.focusedHandle === handle) {
      this.focusedHandle = null;
      this.requestUpdate();
    }
    relayNativeEvent(this, event);
    this.emit('lr-blur');
  }

  private onHintSlotChange = (e: Event): void => {
    this.hasHintSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

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
    return this.getAttribute('aria-label') || this.label || this.localize('sliderLabel');
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

  private renderHandle(handle: SliderHandle, describedBy: string | undefined): TemplateResult {
    const value = this.valueForHandle(handle);
    const bounds = this.reachableBounds(handle);
    const percent = this.percentOf(value);
    const numeric = this.formatValue(value);
    const valueText = this.valueFormatter ? this.valueFormatter(value, handle) : numeric;
    const partName = { value: 'thumb', min: 'thumb thumb-min', max: 'thumb thumb-max' }[handle];
    const handleLabel = {
      value: this.resolvedLabel(),
      min: this.localize('rangeStart'),
      max: this.localize('rangeEnd'),
    }[handle];
    const tooltipShown =
      this.focusedHandle === handle ||
      Array.from(this.drags.values()).some((drag) => drag.handle === handle);
    const tooltipPart = tooltipShown ? 'tooltip tooltip-visible' : 'tooltip';
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
        aria-label=${handleLabel}
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
      ${this.withTooltip
        ? html`<span part=${tooltipPart} aria-hidden="true" style=${this.offsetStyle(percent)}
            >${valueText ?? numeric}</span
          >`
        : nothing}
    `;
  }

  override render(): TemplateResult {
    const vertical = this.orientation === 'vertical';
    const hasHint = this.hasHintSlot || this.hint.length > 0;
    const describedBy = hasHint ? HINT_ID : undefined;
    const startPercent = this.range ? this.percentOf(this.minValue) : 0;
    const endPercent = this.range
      ? this.percentOf(this.maxValue)
      : this.percentOf(this.valueAsNumber);
    const span = Math.max(0, endPercent - startPercent);
    const indicatorStyle = vertical
      ? `inset-block-end:${startPercent}%;block-size:${span}%`
      : `inset-inline-start:${startPercent}%;inline-size:${span}%`;
    const markers = this.markerPercents();
    return html`
      <div
        part="base"
        role=${this.range ? 'group' : nothing}
        aria-label=${this.range ? this.resolvedLabel() : nothing}
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
          ? html`${this.renderHandle('min', describedBy)}${this.renderHandle('max', describedBy)}`
          : this.renderHandle('value', describedBy)}
      </div>
      ${this.showValue
        ? html`<span part="value" aria-hidden="true">${this.readoutText()}</span>`
        : nothing}
      <div id=${HINT_ID} part="hint" ?hidden=${!hasHint}>
        ${this.hint}<slot name="hint" @slotchange=${this.onHintSlotChange}></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-slider': LyraSlider;
  }
}

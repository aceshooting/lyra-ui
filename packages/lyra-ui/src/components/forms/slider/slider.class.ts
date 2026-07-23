import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { FormAssociated } from '../../../internal/form-associated.js';
import { isRtl } from '../../../internal/rtl.js';
import { finiteNumber, finiteRange, isSliderKey, decimalPlaces } from '../../../internal/numbers.js';
import { styles } from './slider.styles.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';

/** PageUp/PageDown move by a larger increment than a single Arrow step,
 *  matching the WAI-ARIA APG slider pattern's expected keyboard interactions
 *  (and native `<input type=range>`). Mirrors lr-time-range's identical
 *  constant. */
const PAGE_STEP_MULTIPLIER = 10;

export interface LyraSliderEventMap {
  'lr-input': CustomEvent<{ value: number }>;
  'lr-change': CustomEvent<{ value: number }>;
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
 * `<input type=range>` click-to-seek.
 *
 * Deliberately no label/hint/error chrome -- `label` here is an accessible-name override, not
 * visible label text; a labeled-field consumer wraps this element in their own layout.
 *
 * @customElement lr-slider
 * @event lr-input - Fired continuously during an active drag or a
 *   keyboard step (including OS key-repeat while a key is held), mirroring
 *   native `<input type=range>`'s own `input` event. `detail: { value: number }`.
 * @event lr-change - Fired once an interaction commits: on pointerup for a
 *   drag, or on keyup for a keyboard step — so a single Arrow/Home/End/
 *   PageUp/PageDown press fires both `lr-input` and `lr-change`,
 *   mirroring how native `<input type=range>` fires `change` on every
 *   committed step too. `detail: { value: number }`.
 * @csspart base - The row wrapping the track and the optional value readout.
 * @csspart track - The full-width background line.
 * @csspart fill - The filled portion of the track from `min` up to the current value.
 * @csspart thumb - The draggable handle (`role="slider"`).
 * @csspart value - The visible numeric readout, rendered when `show-value` is true.
 */
export class LyraSlider extends FormAssociated(LyraSliderBase) {
  static override styles = [LyraElement.styles, styles];

  // These accessors sanitize the live value synchronously when a range
  // setting changes. Keeping the properties `noAccessor` prevents Lit's
  // default async field setter from leaving `.value`, `.valueAsNumber`, and
  // ElementInternals' form value disagreeing until the next update flush.
  static override properties = {
    min: { type: Number, noAccessor: true },
    max: { type: Number, noAccessor: true },
    step: { type: Number, noAccessor: true },
  };

  private _min = 0;
  private _max = 100;
  private _step = 1;
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
  /** Accessible name for the slider, used when no visible label context
   *  exists around it (e.g. no wrapping `<label>` or adjacent heading). Set
   *  as `aria-label` on the interactive `role="slider"` element. A plain
   *  `aria-label` attribute on the host itself is honored as a fallback when
   *  this is left unset, matching `<lr-checkbox>`/`<lr-switch>`; with
   *  neither, the localized generic `sliderLabel` message applies so the
   *  focusable thumb is never nameless (the same pattern as
   *  `<lr-input>`/`<lr-textarea>`'s built-in generic labels). */
  @property() label = '';
  
  @property({ type: Boolean, attribute: 'show-value', converter: trueDefaultBooleanConverter }) showValue = true;

  // Keyed by pointerId (a Set, not a single scalar) purely for
  // multi-touch/robustness parity with lr-split and lr-time-range, even
  // though a single thumb has no per-pointer state of its own to track.
  private activePointers = new Set<number>();
  private changedPointers = new Set<number>();
  private keyboardChanged = false;
  // `[part="track"]`'s rect and the resolved direction, snapshotted once per
  // gesture in beginDrag() rather than re-read on every pointermove:
  // getBoundingClientRect()/getComputedStyle() in a window-level pointermove
  // handler force a synchronous layout/style flush interleaved with the
  // previous move's own style writes, and neither value changes from this
  // component's own updates mid-drag (the drag only moves the thumb/fill,
  // never the track's box). Re-measured at every gesture start, so any
  // between-gesture layout change is always picked up.
  private dragTrackRect: DOMRect | null = null;
  private dragRtl = false;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.pendingValue !== undefined) {
      const pending = this.pendingValue;
      this.pendingValue = undefined;
      this.value = pending;
    } else {
      this.ensureValue();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    // Mirror lr-split/lr-time-range's cleanup: if the element is removed
    // mid-drag (or a pointercancel/alt-tab means pointerup never reaches
    // `window`), these window-level listeners would otherwise leak.
    this.activePointers.clear();
    this.changedPointers.clear();
    this.keyboardChanged = false;
    this.dragTrackRect = null;
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('lostpointercapture', this.onPointerUp);
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
      return;
    }
    const numeric = Number(raw);
    const sanitized = raw === '' || !Number.isFinite(numeric) ? this.defaultNumericValue() : this.clampValue(numeric);
    super.value = String(sanitized);
  }

  override formResetCallback(): void {
    super.formResetCallback();
    this.value = String(this.valueAsNumber);
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
    const current = super.value;
    if (current === '') return;
    const sanitized = String(this.clampValue(Number(current)));
    if (sanitized !== current) this.value = sanitized;
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
    return this.clampValue(lo + (hi - lo) / 2);
  }

  private percentOf(value: number): number {
    const { lo, hi } = this.domain();
    const safeValue = finiteRange(value, lo, lo, hi);
    const span = hi - lo || 1;
    return ((safeValue - lo) / span) * 100;
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
      const factor = 10 ** decimalPlaces(step);
      stepped = Math.round((lo + stepsFromLo * step) * factor) / factor;
    }
    return Math.min(hi, Math.max(lo, stepped));
  }

  private formatValue(v: number): string {
    return String(v);
  }

  private setValue(raw: number, commit: boolean): boolean {
    const previous = this.valueAsNumber;
    const clamped = this.clampValue(raw);
    if (clamped === previous) return false;
    this.value = String(clamped);
    this.emit('lr-input', { value: clamped });
    if (commit) this.emit('lr-change', { value: clamped });
    return true;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.effectiveDisabled) return;
    const current = this.valueAsNumber;
    // Under RTL, physical ArrowRight moves toward inset-inline-start, i.e. a
    // lower value — swap which physical key counts as "forward", matching
    // lr-split/lr-time-range's onKeyDown/onPointerMove convention.
    // ArrowUp/ArrowDown are never swapped (direction only affects the
    // horizontal inline axis).
    const rtl = isRtl(this);
    const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === forwardKey || e.key === 'ArrowUp') {
      e.preventDefault();
      this.keyboardChanged = this.setValue(current + this.step, false) || this.keyboardChanged;
    } else if (e.key === backwardKey || e.key === 'ArrowDown') {
      e.preventDefault();
      this.keyboardChanged = this.setValue(current - this.step, false) || this.keyboardChanged;
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      this.keyboardChanged =
        this.setValue(current + this.step * PAGE_STEP_MULTIPLIER, false) || this.keyboardChanged;
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      this.keyboardChanged =
        this.setValue(current - this.step * PAGE_STEP_MULTIPLIER, false) || this.keyboardChanged;
    } else if (e.key === 'Home') {
      e.preventDefault();
      this.keyboardChanged = this.setValue(this.domain().lo, false) || this.keyboardChanged;
    } else if (e.key === 'End') {
      e.preventDefault();
      this.keyboardChanged = this.setValue(this.domain().hi, false) || this.keyboardChanged;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    // Only commit on release of the keys onKeyDown acts on — releasing an
    // unrelated key (Tab, Shift, ...) while the thumb happens to be focused
    // must not emit a spurious lr-change. For a single discrete press this
    // pairs one onKeyDown (lr-input) with one onKeyUp (lr-change); OS
    // key-repeat while a key is held re-fires onKeyDown (and thus
    // lr-input) repeatedly but still commits only once, on the eventual
    // keyup — the same drag-like "continuous input, single final change"
    // shape a pointer drag has.
    if (this.effectiveDisabled || !isSliderKey(e.key)) return;
    if (this.keyboardChanged) {
      this.emit('lr-change', { value: this.valueAsNumber });
      this.keyboardChanged = false;
    }
  };

  /** Start tracking `pointerId` as an active drag, transferring pointer
   *  capture to `captureTarget` and wiring the shared window-level move/end
   *  listeners. Shared by a pointerdown that starts on the thumb itself and
   *  one that starts elsewhere on the track (see `onBasePointerDown`), so
   *  both gestures continue identically from here on. */
  private beginDrag(pointerId: number, captureTarget: HTMLElement): void {
    const track = this.renderRoot.querySelector('[part="track"]') as HTMLElement | null;
    this.dragTrackRect = track?.getBoundingClientRect() ?? null;
    this.dragRtl = isRtl(this);
    this.activePointers.add(pointerId);
    this.changedPointers.delete(pointerId);
    captureTarget.setPointerCapture(pointerId);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    // A drag can end without a pointerup: a system gesture / palm rejection
    // can fire `pointercancel`, and losing capture (e.g. element removed)
    // fires `lostpointercapture` — both need the same teardown as pointerup.
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('lostpointercapture', this.onPointerUp);
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (this.effectiveDisabled) return;
    this.beginDrag(e.pointerId, e.target as HTMLElement);
  };

  /** A pointerdown anywhere on `[part="base"]` other than the thumb itself
   *  (the vast majority of the control's clickable area) jumps the thumb to
   *  that point and continues the same gesture as a drag, mirroring native
   *  `<input type=range>` click-to-seek. A pointerdown that started on the
   *  thumb bubbles up to this same listener too — already fully handled by
   *  `onPointerDown` above, so it's ignored here via the `e.target === thumb`
   *  check. Unlike the two-handle `lr-time-range` (where a track click is
   *  ambiguous about which handle should move), a single thumb has no such
   *  ambiguity. */
  private onBasePointerDown = (e: PointerEvent): void => {
    if (this.effectiveDisabled) return;
    const thumb = this.renderRoot.querySelector('[part="thumb"]') as HTMLElement | null;
    if (!thumb || e.target === thumb) return;
    const track = this.renderRoot.querySelector('[part="track"]') as HTMLElement | null;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const raw = rect.width === 0 ? 0 : (e.clientX - rect.left) / rect.width;
    // Mirrors onPointerMove's own RTL handling below.
    const ratio = Math.min(1, Math.max(0, isRtl(this) ? 1 - raw : raw));
    const { lo, hi } = this.domain();
    if (this.setValue(lo + ratio * (hi - lo), false)) this.changedPointers.add(e.pointerId);
    this.beginDrag(e.pointerId, thumb);
    // Keyboard interaction (arrow keys, Home/End, ...) can continue
    // seamlessly right after the click, exactly as if the user had tabbed to
    // the thumb and started dragging it directly.
    thumb.focus();
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.activePointers.has(e.pointerId)) return;
    if (this.effectiveDisabled) {
      // These are window-level listeners driven by setPointerCapture, so
      // they keep firing for this pointerId regardless of the `disabled`
      // reflection — a drag already in progress would otherwise keep
      // mutating `value` (and emitting lr-input) after `disabled` flips
      // true mid-drag. Abort the drag instead of continuing to process it.
      this.endDrag(e.pointerId, false);
      return;
    }
    const rect = this.dragTrackRect;
    if (!rect) return;
    const raw = rect.width === 0 ? 0 : (e.clientX - rect.left) / rect.width;
    // The track is positioned with inset-inline-start (0% at the visual
    // right edge under RTL), so the pointer ratio has to mirror that or a
    // rightward drag would move the thumb the wrong way.
    const ratio = Math.min(1, Math.max(0, this.dragRtl ? 1 - raw : raw));
    const { lo, hi } = this.domain();
    if (this.setValue(lo + ratio * (hi - lo), false)) this.changedPointers.add(e.pointerId);
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.endDrag(e.pointerId, true);
  };

  /** Stop the drag owned by `pointerId`, optionally committing a final lr-change. */
  private endDrag(pointerId: number, commit: boolean): void {
    if (!this.activePointers.has(pointerId)) return;
    this.activePointers.delete(pointerId);
    const changed = this.changedPointers.delete(pointerId);
    if (commit && changed) this.emit('lr-change', { value: this.valueAsNumber });
    // Only the last concurrent drag to end tears down the shared window
    // listeners — an overlapping second pointer may still be down.
    if (this.activePointers.size === 0) {
      this.dragTrackRect = null;
      window.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerup', this.onPointerUp);
      window.removeEventListener('pointercancel', this.onPointerUp);
      window.removeEventListener('lostpointercapture', this.onPointerUp);
    }
  }

  override render(): TemplateResult {
    const num = this.valueAsNumber;
    const pct = this.percentOf(num);
    const text = this.formatValue(num);
    const { lo, hi } = this.domain();
    const ariaLabel = this.label || this.getAttribute('aria-label') || this.localize('sliderLabel');
    return html`
      <div part="base" @pointerdown=${this.onBasePointerDown}>
        <div part="track"></div>
        <div part="fill" style=${`inline-size:${pct}%`}></div>
        <div
          part="thumb"
          role="slider"
          tabindex=${this.effectiveDisabled ? '-1' : '0'}
          aria-valuemin=${lo}
          aria-valuemax=${hi}
          aria-valuenow=${num}
          aria-valuetext=${text}
          aria-label=${ariaLabel}
          aria-disabled=${this.effectiveDisabled ? 'true' : 'false'}
          style=${`inset-inline-start:${pct}%`}
          @pointerdown=${this.onPointerDown}
          @keydown=${this.onKeyDown}
          @keyup=${this.onKeyUp}
        ></div>
      </div>
      ${this.showValue ? html`<span part="value" aria-hidden="true">${text}</span>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-slider': LyraSlider;
  }
}

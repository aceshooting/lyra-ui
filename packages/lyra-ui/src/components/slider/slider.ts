import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { FormAssociated } from '../../internal/form-associated.js';
import { defineElement } from '../../internal/prefix.js';
import { isRtl } from '../../internal/rtl.js';
import { styles } from './slider.styles.js';

/** PageUp/PageDown move by a larger increment than a single Arrow step,
 *  matching the WAI-ARIA APG slider pattern's expected keyboard interactions
 *  (and native `<input type=range>`). Mirrors lyra-time-range's identical
 *  constant. */
const PAGE_STEP_MULTIPLIER = 10;

function isArrowKey(key: string): boolean {
  return key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowLeft' || key === 'ArrowDown';
}

/** Keys that onKeyDown acts on and onKeyUp commits after. */
function isSliderKey(key: string): boolean {
  return isArrowKey(key) || key === 'Home' || key === 'End' || key === 'PageUp' || key === 'PageDown';
}

/** Number of decimal digits in `n`'s shortest string representation, e.g.
 *  `0.1` -> 1, `5` -> 0. Used to round a stepped value back to the precision
 *  `step` itself implies, instead of leaving binary floating-point noise in
 *  place (e.g. `20.200000000000003`). Mirrors lyra-time-range's identical
 *  helper. */
function decimalPlaces(n: number): number {
  const str = n.toString();
  const dot = str.indexOf('.');
  return dot === -1 ? 0 : str.length - dot - 1;
}

/**
 * `<lyra-slider>` — a numeric range control (e.g. an LLM "temperature"
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
 * @customElement lyra-slider
 * @event lyra-input - Fired continuously during an active drag or a
 *   keyboard step (including OS key-repeat while a key is held), mirroring
 *   native `<input type=range>`'s own `input` event. `detail: { value: number }`.
 * @event lyra-change - Fired once an interaction commits: on pointerup for a
 *   drag, or on keyup for a keyboard step — so a single Arrow/Home/End/
 *   PageUp/PageDown press fires both `lyra-input` and `lyra-change`,
 *   mirroring how native `<input type=range>` fires `change` on every
 *   committed step too. `detail: { value: number }`.
 * @csspart base - The row wrapping the track and the optional value readout.
 * @csspart track - The full-width background line.
 * @csspart fill - The filled portion of the track from `min` up to the current value.
 * @csspart thumb - The draggable handle (`role="slider"`).
 * @csspart value - The visible numeric readout, rendered when `show-value` is true.
 */
export class LyraSlider extends FormAssociated(LyraElement) {
  static styles = [LyraElement.styles, styles];

  @property({ type: Number }) min = 0;
  @property({ type: Number }) max = 100;
  @property({ type: Number }) step = 1;
  /** Accessible name for the slider, used when no visible label context
   *  exists around it (e.g. no wrapping `<label>` or adjacent heading). Set
   *  as `aria-label` on the interactive `role="slider"` element. A plain
   *  `aria-label` attribute on the host itself is honored as a fallback when
   *  this is left unset, matching `<lyra-checkbox>`/`<lyra-switch>`. */
  @property() label = '';
  /** Whether to render the current numeric value as visible text next to
   *  the track. Like `<lyra-markdown>`'s `sanitize`/`gfm`, this is a plain
   *  `type: Boolean` property defaulting `true` — turn it off via the
   *  `.showValue=${false}` property binding (a bare `show-value="false"`
   *  content attribute is still truthy, since presence is all Lit's default
   *  boolean converter checks). */
  @property({ type: Boolean, attribute: 'show-value' }) showValue = true;

  // Keyed by pointerId (a Set, not a single scalar) purely for
  // multi-touch/robustness parity with lyra-split and lyra-time-range, even
  // though a single thumb has no per-pointer state of its own to track.
  private activePointers = new Set<number>();

  connectedCallback(): void {
    super.connectedCallback();
    this.ensureValue();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // Mirror lyra-split/lyra-time-range's cleanup: if the element is removed
    // mid-drag (or a pointercancel/alt-tab means pointerup never reaches
    // `window`), these window-level listeners would otherwise leak.
    this.activePointers.clear();
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
    if (this.value === '') return this.defaultNumericValue();
    const n = Number(this.value);
    return Number.isFinite(n) ? this.clampValue(n) : this.defaultNumericValue();
  }

  set valueAsNumber(next: number) {
    this.value = String(this.clampValue(next));
  }

  formResetCallback(): void {
    super.formResetCallback();
    this.value = String(this.valueAsNumber);
  }

  /** If `value` is still unset, seed it with the sanitized default — the
   *  midpoint of `[min, max]`, snapped to `step` — so `value`/`valueAsNumber`
   *  and rendering never have to treat "" as a real, distinct state. */
  private ensureValue(): void {
    if (this.value === '') this.value = String(this.defaultNumericValue());
  }

  private domain(): { lo: number; hi: number } {
    // A caller-supplied min/max that fails Number attribute conversion
    // arrives here as NaN; fall back to this property's own default rather
    // than propagating NaN into every clampValue()/percentOf() caller.
    const min = isNaN(this.min) ? 0 : this.min;
    const max = isNaN(this.max) ? 100 : this.max;
    return { lo: Math.min(min, max), hi: Math.max(min, max) };
  }

  private defaultNumericValue(): number {
    const { lo, hi } = this.domain();
    return this.clampValue(lo + (hi - lo) / 2);
  }

  private percentOf(value: number): number {
    if (isNaN(value)) return 0;
    const { lo, hi } = this.domain();
    const span = hi - lo || 1;
    return ((value - lo) / span) * 100;
  }

  private clampValue(raw: number): number {
    const { lo, hi } = this.domain();
    // A non-positive or non-finite step would otherwise divide by zero/NaN
    // below; treat it as "unstepped" instead of propagating NaN.
    const hasStep = Number.isFinite(this.step) && this.step > 0;
    let stepped = raw;
    if (hasStep) {
      // Anchor the step grid at the domain's own `lo` (matching native
      // `<input type=range>`) instead of absolute 0, and round back to
      // `step`'s own decimal precision so repeated steps land on exact
      // values like 0.7 instead of 0.7000000000000001.
      const stepsFromLo = Math.round((raw - lo) / this.step);
      const factor = 10 ** decimalPlaces(this.step);
      stepped = Math.round((lo + stepsFromLo * this.step) * factor) / factor;
    }
    return Math.min(hi, Math.max(lo, stepped));
  }

  private formatValue(v: number): string {
    return String(v);
  }

  private setValue(raw: number, commit: boolean): void {
    const clamped = this.clampValue(raw);
    this.value = String(clamped);
    this.emit('lyra-input', { value: clamped });
    if (commit) this.emit('lyra-change', { value: clamped });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.effectiveDisabled) return;
    const current = this.valueAsNumber;
    // Under RTL, physical ArrowRight moves toward inset-inline-start, i.e. a
    // lower value — swap which physical key counts as "forward", matching
    // lyra-split/lyra-time-range's onKeyDown/onPointerMove convention.
    // ArrowUp/ArrowDown are never swapped (direction only affects the
    // horizontal inline axis).
    const rtl = isRtl(this);
    const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === forwardKey || e.key === 'ArrowUp') {
      e.preventDefault();
      this.setValue(current + this.step, false);
    } else if (e.key === backwardKey || e.key === 'ArrowDown') {
      e.preventDefault();
      this.setValue(current - this.step, false);
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      this.setValue(current + this.step * PAGE_STEP_MULTIPLIER, false);
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      this.setValue(current - this.step * PAGE_STEP_MULTIPLIER, false);
    } else if (e.key === 'Home') {
      e.preventDefault();
      this.setValue(this.domain().lo, false);
    } else if (e.key === 'End') {
      e.preventDefault();
      this.setValue(this.domain().hi, false);
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    // Only commit on release of the keys onKeyDown acts on — releasing an
    // unrelated key (Tab, Shift, ...) while the thumb happens to be focused
    // must not emit a spurious lyra-change. For a single discrete press this
    // pairs one onKeyDown (lyra-input) with one onKeyUp (lyra-change); OS
    // key-repeat while a key is held re-fires onKeyDown (and thus
    // lyra-input) repeatedly but still commits only once, on the eventual
    // keyup — the same drag-like "continuous input, single final change"
    // shape a pointer drag has.
    if (this.effectiveDisabled || !isSliderKey(e.key)) return;
    this.emit('lyra-change', { value: this.valueAsNumber });
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (this.effectiveDisabled) return;
    this.activePointers.add(e.pointerId);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    // A drag can end without a pointerup: a system gesture / palm rejection
    // can fire `pointercancel`, and losing capture (e.g. element removed)
    // fires `lostpointercapture` — both need the same teardown as pointerup.
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('lostpointercapture', this.onPointerUp);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.activePointers.has(e.pointerId)) return;
    if (this.effectiveDisabled) {
      // These are window-level listeners driven by setPointerCapture, so
      // they keep firing for this pointerId regardless of the `disabled`
      // reflection — a drag already in progress would otherwise keep
      // mutating `value` (and emitting lyra-input) after `disabled` flips
      // true mid-drag. Abort the drag instead of continuing to process it.
      this.endDrag(e.pointerId, false);
      return;
    }
    const track = this.renderRoot.querySelector('[part="track"]') as HTMLElement | null;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const raw = rect.width === 0 ? 0 : (e.clientX - rect.left) / rect.width;
    // The track is positioned with inset-inline-start (0% at the visual
    // right edge under RTL), so the pointer ratio has to mirror that or a
    // rightward drag would move the thumb the wrong way.
    const ratio = Math.min(1, Math.max(0, isRtl(this) ? 1 - raw : raw));
    const { lo, hi } = this.domain();
    this.setValue(lo + ratio * (hi - lo), false);
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.endDrag(e.pointerId, true);
  };

  /** Stop the drag owned by `pointerId`, optionally committing a final lyra-change. */
  private endDrag(pointerId: number, commit: boolean): void {
    if (!this.activePointers.has(pointerId)) return;
    this.activePointers.delete(pointerId);
    if (commit) this.emit('lyra-change', { value: this.valueAsNumber });
    // Only the last concurrent drag to end tears down the shared window
    // listeners — an overlapping second pointer may still be down.
    if (this.activePointers.size === 0) {
      window.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerup', this.onPointerUp);
      window.removeEventListener('pointercancel', this.onPointerUp);
      window.removeEventListener('lostpointercapture', this.onPointerUp);
    }
  }

  protected willUpdate(changed: PropertyValues): void {
    // Keep direct empty-string assignments from becoming a persistent
    // slider state. form.reset() is handled synchronously above.
    if (changed.has('value') && this.value === '') {
      this.ensureValue();
      return;
    }
    if ((changed.has('min') || changed.has('max') || changed.has('step')) && this.value !== '') {
      // A narrowed/shifted domain (or a changed step grid) after mount must
      // not leave `value` — and the rendered thumb position it drives —
      // outside the current bounds or off the step grid. `min`/`max`/`step`
      // already hold their new values by this point, so the getter itself
      // (which clamps against the live domain) computes the corrected value.
      const next = String(this.valueAsNumber);
      if (next !== this.value) this.value = next;
    }
  }

  render(): TemplateResult {
    const num = this.valueAsNumber;
    const pct = this.percentOf(num);
    const text = this.formatValue(num);
    const { lo, hi } = this.domain();
    const ariaLabel = this.label || this.getAttribute('aria-label') || nothing;
    return html`
      <div part="base">
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
          aria-disabled=${this.effectiveDisabled ? 'true' : nothing}
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

defineElement('slider', LyraSlider);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-slider': LyraSlider;
  }
}

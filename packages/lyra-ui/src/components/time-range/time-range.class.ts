import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { isRtl } from '../../internal/rtl.js';
import { finiteNumber, finiteRange, isSliderKey, decimalPlaces } from '../../internal/numbers.js';
import { styles } from './time-range.styles.js';

type Handle = 'start' | 'end';

interface DragState {
  handle: Handle;
  /** `[part="base"]`'s rect and the resolved direction, snapshotted once in
   *  onPointerDown rather than re-read on every pointermove of the same
   *  gesture: getBoundingClientRect()/getComputedStyle() in a window-level
   *  pointermove handler force a synchronous layout/style flush interleaved
   *  with the previous move's own style writes, and neither value changes
   *  from this component's own updates mid-drag (the drag only moves the
   *  handles/fill, never the base's box). Re-measured at every gesture
   *  start, so any between-gesture layout change is always picked up.
   *  Mirrors lr-slider's identical snapshot. */
  rect: DOMRect;
  rtl: boolean;
}

/** PageUp/PageDown move by a larger increment than a single ArrowUp/Down
 *  step, matching the WAI-ARIA APG slider pattern's expected keyboard
 *  interactions (and native `<input type=range>`). */
const PAGE_STEP_MULTIPLIER = 10;

/** A single discrete-preset option for the `presets` property. */
export interface TimeRangePreset {
  label: string;
  start: number;
  end: number;
}

export interface LyraTimeRangeEventMap {
  'lr-input': CustomEvent<{ start: number; end: number }>;
  'lr-change': CustomEvent<{ start: number; end: number }>;
}
/**
 * `<lr-time-range>` — a two-handle brush/scrubber over a numeric domain.
 * Callers map their own time axis to `[min, max]`; no date logic lives here
 * (matches the no-date-library constraint used elsewhere in this library).
 *
 * Optionally paired with a row of discrete presets (`presets`) — e.g. "Last
 * 7 days" / "Last 30 days" — rendered above the track; picking one is just a
 * shortcut that sets both handles at once, the continuous brush underneath
 * is unaffected and both interaction modes coexist.
 *
 * Form-associated only for the `<fieldset disabled>` cascade, not for a
 * submitted value: it attaches `ElementInternals` (like `<lr-combobox>`'s
 * minimal pattern, rather than the single-string-value `FormAssociated`
 * mixin, which doesn't fit a two-handle range) purely so an ancestor
 * `<fieldset disabled>` disables both handles and every preset button
 * through `effectiveDisabled`, the same way it would a native `<input>`,
 * without touching the consumer-facing `disabled` property/attribute itself.
 * Unlike `<lr-combobox>`, it never calls `internals.setFormValue()` and
 * has no `name` — the selected range is not included in the owning form's
 * `FormData` on submit; read `start`/`end` directly (e.g. from `lr-change`)
 * instead of relying on native form submission.
 *
 * Deliberately no label/hint/error chrome -- `startLabel`/`endLabel` here are per-handle
 * accessible-name overrides, not visible label text, the same carve-out `<lr-slider>` states for
 * its own single-handle `label`; a labeled-field consumer wraps this element in their own layout.
 *
 * @customElement lr-time-range
 * @event lr-input - Fired continuously while dragging or on each arrow-key press. `detail: { start, end }`.
 * @event lr-change - Fired on release / keyup-commit, or when a preset button is clicked. `detail: { start, end }`.
 * @csspart base - The time-range wrapper.
 * @csspart track - The complete range track.
 * @csspart range - The selected range.
 * @csspart handle-start - The start handle.
 * @csspart handle-end - The end handle.
 * @csspart presets - The preset controls wrapper.
 * @csspart preset-button - A preset button.
 */
export class LyraTimeRange extends LyraElement<LyraTimeRangeEventMap> {
  static formAssociated = true;
  static styles = [LyraElement.styles, styles];

  static properties = {
    // Hand-written accessor (see the `get`/`set disabled` pair below)
    // instead of a plain `@property({ reflect: true })`: this element is
    // form-associated, and the browser invokes `formDisabledCallback`
    // synchronously for *this element's own* `disabled` attribute changes
    // too, not only for an ancestor `<fieldset disabled>` toggling. A plain
    // reflecting property defers its attribute write into the async Lit
    // update cycle, so that browser callback would otherwise fire nested
    // *inside* this same element's own in-progress update -- the
    // `requestUpdate()` it triggers (to pick up `_fieldsetDisabled`) then
    // races Lit's own scheduling and can resolve `updateComplete` before the
    // corrected value actually renders. Reflecting the attribute
    // synchronously, right in the setter (mirrors `<lr-combobox>`'s and
    // `FormAssociated`'s identical `disabled` accessor), makes the browser
    // invoke that callback *before* any Lit update even starts, so it never
    // interleaves with one.
    disabled: { type: Boolean, reflect: true, noAccessor: true },
  };

  @property({ type: Number }) min = 0;
  @property({ type: Number }) max = 100;
  @property({ type: Number }) start = 0;
  @property({ type: Number }) end = 100;
  @property({ type: Number }) step = 1;
  /** Accessible name for the start handle, used as its `aria-label`.
   *  Overridable for i18n/custom copy; defaults to the same literal text
   *  this component always rendered before the property existed. */
  @property({ attribute: 'start-label' }) startLabel = 'Range start';
  /** Accessible name for the end handle, used as its `aria-label`.
   *  Overridable for i18n/custom copy; defaults to the same literal text
   *  this component always rendered before the property existed. */
  @property({ attribute: 'end-label' }) endLabel = 'Range end';
  /**
   * Optional discrete presets rendered as a `[part="presets"]` button row
   * above the track. Purely additive: leaving this empty (the default)
   * renders nothing extra and leaves the continuous brush untouched.
   */
  @property({ attribute: false }) presets: TimeRangePreset[] = [];

  private internals: ElementInternals;
  private _disabled = false;
  // Tracked separately from the consumer's own `disabled` -- a fieldset
  // cascade must never mutate that IDL property/attribute itself (mirrors
  // combobox.ts's/slider.ts's identical `_fieldsetDisabled`/
  // `effectiveDisabled` pattern), only the combined getter below.
  private _fieldsetDisabled = false;

  // Keyed by pointerId rather than a single scalar so two concurrent drags
  // (e.g. a two-finger touch, one per handle) each keep tracking their own
  // handle instead of the second pointerdown hijacking which handle the
  // first pointer's subsequent moves apply to.
  private drags = new Map<number, DragState>();

  constructor() {
    super();
    this.internals = this.attachInternals();
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

  /** Effective disabled state: this element's own `disabled` OR an ancestor
   *  `<fieldset disabled>`'s inherited state -- mirrors native `<input>`,
   *  whose own `disabled` IDL property/attribute is never mutated by a
   *  fieldset. */
  get effectiveDisabled(): boolean {
    return this.disabled || this._fieldsetDisabled;
  }

  /**
   * Called by the browser when an ancestor `<fieldset disabled>` toggles.
   * Tracked separately from the consumer's own `disabled` (see
   * `effectiveDisabled`) so a consumer's explicit `disabled` survives the
   * fieldset re-enabling instead of being permanently overwritten.
   */
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    this.requestUpdate();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // Mirror lr-split's cleanup: if the element is removed mid-drag (or a
    // pointercancel/alt-tab means `pointerup` never reaches `window`), these
    // window-level listeners — and the closure keeping this instance alive —
    // would otherwise leak indefinitely.
    this.drags.clear();
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('lostpointercapture', this.onPointerUp);
  }

  // Both percentOf() and clamp() key off this same lo/hi pair — willUpdate()
  // already normalizes a caller-supplied `min > max` domain this way, so
  // rendering and interactive dragging must agree with it instead of
  // indexing off this.min/this.max directly (which inverts the visuals and
  // locks dragging to a fixed value when min > max).
  private domain(): { lo: number; hi: number } {
    // A caller-supplied min/max that fails Number attribute conversion (e.g.
    // `min="not-a-number"`) arrives here as NaN; Math.min/Math.max would
    // otherwise propagate that NaN into `lo`/`hi` and poison every
    // percentOf()/clamp() caller. Mirror lr-gauge's `ratio` getter, which
    // short-circuits on isNaN(...) instead, by falling back to this
    // property's own default.
    const min = finiteNumber(this.min, 0);
    const max = finiteNumber(this.max, 100);
    return { lo: Math.min(min, max), hi: Math.max(min, max) };
  }

  private percentOf(value: number): number {
    // A NaN `start`/`end` (e.g. an invalid `start` attribute) must not reach
    // the rendered `inset-inline-start:NaN%` — that's an invalid CSS value
    // the browser silently drops, leaving the handle stuck with no visible
    // recovery. 0% is at least a stable, well-defined position.
    const { lo, hi } = this.domain();
    const safeValue = finiteRange(value, lo, lo, hi);
    const span = hi - lo || 1;
    return ((safeValue - lo) / span) * 100;
  }

  /** Each handle's actual reachable sub-range, bounded by its sibling
   *  handle's current value the same way clamp() already enforces it — used
   *  both for aria-valuemin/aria-valuemax and for Home/End's jump targets,
   *  instead of reporting/jumping to the component's full [min, max] domain
   *  which the sibling handle may make partially unreachable. */
  private reachableBounds(handle: Handle): { min: number; max: number } {
    const { lo, hi } = this.domain();
    // A NaN sibling value (e.g. an invalid `end` attribute) must not leak
    // into the *other* handle's aria-valuemin/aria-valuemax as a literal
    // "NaN" — fall back to the domain bound it would otherwise report.
    const start = finiteRange(this.start, lo, lo, hi);
    const end = finiteRange(this.end, hi, lo, hi);
    return handle === 'start' ? { min: lo, max: end } : { min: start, max: hi };
  }

  private clamp(handle: Handle, value: number): number {
    const { lo, hi } = this.domain();
    // A non-positive or non-finite step (e.g. a transient `step={0}` while a
    // caller derives it as `(max-min)/tickCount`) would otherwise divide by
    // zero/NaN below and permanently poison start/end with NaN, since the
    // other handle's clamp cross-references this one's (already-NaN) value.
    // Treat it as "unstepped" instead of propagating NaN.
    // Anchor the step grid at the domain's own `lo` (matching native
    // `<input type=range>`) instead of absolute 0 — otherwise a `min` that
    // isn't itself a multiple of `step` makes the very first nudge off `min`
    // jump to the nearest multiple-of-step-from-zero instead of moving by
    // one `step`. Round the result back to `step`'s own decimal precision
    // (rather than leaving raw `value / step` binary-float noise in place)
    // so repeated steps land on exact values like 20.1 instead of
    // 20.200000000000003.
    let stepped = finiteNumber(value, lo);
    const step = finiteRange(this.step, 0, 0);
    if (Number.isFinite(step) && step > 0) {
      const stepsFromLo = Math.round((stepped - lo) / step);
      const factor = 10 ** decimalPlaces(step);
      stepped = Math.round((lo + stepsFromLo * step) * factor) / factor;
    }
    const bounded = Math.min(hi, Math.max(lo, stepped));
    if (handle === 'start') return Math.min(bounded, finiteRange(this.end, hi, lo, hi));
    return Math.max(bounded, finiteRange(this.start, lo, lo, hi));
  }

  private setValue(handle: Handle, value: number, commit: boolean): void {
    const clamped = this.clamp(handle, value);
    if (handle === 'start') this.start = clamped;
    else this.end = clamped;
    this.emit('lr-input', { start: this.start, end: this.end });
    if (commit) this.emit('lr-change', { start: this.start, end: this.end });
  }

  /**
   * Apply a discrete preset: sets both handles and emits the same
   * lr-input/lr-change pair a committed drag or keyboard step would.
   *
   * Deliberately bypasses `setValue()`/`clamp()` — a preset is an explicit
   * discrete jump to the caller's own exact numbers, not a stepped nudge, so
   * routing it through `clamp()`'s step-grid rounding would silently round
   * a preset's values away from what the caller specified (and desync the
   * active-button match in render(), which compares against these exact
   * numbers). Only the domain bounds and the start<=end invariant apply
   * here, not `step`. Both handles are also assigned before either event
   * fires — routing them through two sequential `setValue()` calls instead
   * would emit an extra lr-input whose detail still held the stale
   * pre-preset value for whichever handle hadn't been assigned yet.
   */
  private applyPreset(preset: TimeRangePreset): void {
    if (this.effectiveDisabled) return;
    const { lo, hi } = this.domain();
    const start = finiteRange(preset.start, lo, lo, hi);
    const end = finiteRange(preset.end, hi, lo, hi);
    this.start = Math.min(start, end);
    this.end = Math.max(start, end);
    this.emit('lr-input', { start: this.start, end: this.end });
    this.emit('lr-change', { start: this.start, end: this.end });
  }

  private onKeyDown = (handle: Handle, e: KeyboardEvent): void => {
    // A handle that already has focus when the component becomes disabled
    // must not still respond to arrow keys (new pointerdowns are already
    // blocked by the `if (this.effectiveDisabled) return;` guard in
    // onPointerDown, and disabled handles carry `tabindex="-1"`, but a
    // pre-existing focus can bypass both of those).
    if (this.effectiveDisabled) return;
    const current =
      handle === 'start'
        ? finiteRange(this.start, this.domain().lo)
        : finiteRange(this.end, this.domain().hi);
    // Mirror the same left/right swap as onPointerMove: under RTL, physical
    // ArrowRight moves toward inset-inline-start, i.e. a lower value.
    const rtl = isRtl(this);
    const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === forwardKey || e.key === 'ArrowUp') {
      e.preventDefault();
      this.setValue(handle, current + this.step, false);
    } else if (e.key === backwardKey || e.key === 'ArrowDown') {
      e.preventDefault();
      this.setValue(handle, current - this.step, false);
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      this.setValue(handle, current + this.step * PAGE_STEP_MULTIPLIER, false);
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      this.setValue(handle, current - this.step * PAGE_STEP_MULTIPLIER, false);
    } else if (e.key === 'Home') {
      e.preventDefault();
      this.setValue(handle, this.reachableBounds(handle).min, false);
    } else if (e.key === 'End') {
      e.preventDefault();
      this.setValue(handle, this.reachableBounds(handle).max, false);
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    // Only commit on release of the keys that onKeyDown acts on — releasing
    // an unrelated key (Tab, Shift, ...) while a handle happens to be
    // focused must not emit a spurious lr-change.
    if (this.effectiveDisabled || !isSliderKey(e.key)) return;
    this.emit('lr-change', { start: this.start, end: this.end });
  };

  private onPointerDown = (handle: Handle, e: PointerEvent): void => {
    if (this.effectiveDisabled) return;
    const base = this.renderRoot.querySelector('[part="base"]') as HTMLElement;
    this.drags.set(e.pointerId, { handle, rect: base.getBoundingClientRect(), rtl: isRtl(this) });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    // A drag can end without a pointerup: a system gesture / palm rejection
    // can fire `pointercancel`, and losing capture (e.g. element removed)
    // fires `lostpointercapture` — both need the same teardown as pointerup
    // or `this.drags` keeps a permanently-stale entry and these window
    // listeners (and the closure keeping this instance alive) never get
    // removed. Mirrors lr-split's identical fix.
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('lostpointercapture', this.onPointerUp);
  };

  private onPointerMove = (e: PointerEvent): void => {
    const drag = this.drags.get(e.pointerId);
    if (drag === undefined) return;
    if (this.effectiveDisabled) {
      // These are window-level listeners driven by setPointerCapture, so
      // they keep firing for this pointerId regardless of any CSS on the
      // host (this was already true even back when the host used
      // `pointer-events: none`, since that never governed an
      // already-captured window listener) — a drag already in progress
      // would otherwise keep mutating start/end (and emitting lr-input)
      // after `disabled` (or an ancestor fieldset) flips true mid-drag.
      // Abort the drag instead of continuing to process it.
      this.endDrag(e.pointerId, false);
      return;
    }
    const rect = drag.rect;
    const raw = (e.clientX - rect.left) / rect.width;
    // The track is positioned with inset-inline-start (0% at the visual
    // right edge under RTL), so the pointer ratio has to mirror that or a
    // rightward drag would move the handle the wrong way.
    const ratio = Math.min(1, Math.max(0, drag.rtl ? 1 - raw : raw));
    const { lo, hi } = this.domain();
    const value = lo + ratio * (hi - lo);
    this.setValue(drag.handle, value, false);
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.endDrag(e.pointerId, true);
  };

  /** Stop the drag owned by `pointerId`, optionally committing a final lr-change. */
  private endDrag(pointerId: number, commit: boolean): void {
    if (!this.drags.has(pointerId)) return;
    this.drags.delete(pointerId);
    if (commit) this.emit('lr-change', { start: this.start, end: this.end });
    // Only the last concurrent drag to end tears down the shared window
    // listeners — another pointer (e.g. the other finger of a two-finger
    // drag) may still be down.
    if (this.drags.size === 0) {
      window.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerup', this.onPointerUp);
      window.removeEventListener('pointercancel', this.onPointerUp);
      window.removeEventListener('lostpointercapture', this.onPointerUp);
    }
  }

  protected willUpdate(changed: PropertyValues): void {
    if (
      changed.has('start') ||
      changed.has('end') ||
      changed.has('min') ||
      changed.has('max')
    ) {
      // Clamp both handles into the current [min, max] domain first — a
      // caller narrowing the domain after mount (e.g. zooming the time
      // axis via `el.max = 50`) must not leave a handle rendered outside
      // the track, since percentOf() would otherwise produce <0%/>100%.
      // Guard against a caller passing min > max so the bounds themselves
      // stay well-formed.
      const { lo, hi } = this.domain();
      if (Number.isFinite(this.start)) this.start = finiteRange(this.start, lo, lo, hi);
      if (Number.isFinite(this.end)) this.end = finiteRange(this.end, hi, lo, hi);
    }
    // Keep start <= end regardless of which side changed (a controlled
    // caller may set only `end`, e.g. two-way-binding an external store).
    // The handle that just moved wins; the other side is pulled to meet it,
    // mirroring the direction `clamp()` already uses during interactive
    // dragging.
    if (
      (changed.has('start') || changed.has('min') || changed.has('max')) &&
      Number.isFinite(this.start) &&
      Number.isFinite(this.end)
    ) {
      this.start = Math.min(this.start, this.end);
    }
    if (
      (changed.has('end') || changed.has('min') || changed.has('max')) &&
      Number.isFinite(this.start) &&
      Number.isFinite(this.end)
    ) {
      this.end = Math.max(this.end, this.start);
    }
  }

  render(): TemplateResult {
    const startPct = this.percentOf(this.start);
    const endPct = this.percentOf(this.end);
    const startBounds = this.reachableBounds('start');
    const endBounds = this.reachableBounds('end');
    return html`
      ${this.presets.length > 0
        ? html`<div part="presets">
            ${this.presets.map((preset) => {
              const active = preset.start === this.start && preset.end === this.end;
              return html`<button
                part="preset-button"
                type="button"
                ?disabled=${this.effectiveDisabled}
                aria-pressed=${active ? 'true' : 'false'}
                ?data-active=${active}
                @click=${() => this.applyPreset(preset)}
              >
                ${preset.label}
              </button>`;
            })}
          </div>`
        : nothing}
      <div part="base">
        <div part="track"></div>
        <div
          part="range"
          style=${`inset-inline-start:${startPct}%;inline-size:${endPct - startPct}%`}
        ></div>
        <div
          part="handle-start"
          role="slider"
          tabindex=${this.effectiveDisabled ? '-1' : '0'}
          aria-label=${this.localize(
            'rangeStart',
            this.startLabel === 'Range start' ? undefined : this.startLabel,
          )}
          aria-disabled=${this.effectiveDisabled ? 'true' : 'false'}
          aria-valuemin=${startBounds.min}
          aria-valuemax=${startBounds.max}
          aria-valuenow=${Number.isFinite(this.start)
            ? finiteRange(this.start, startBounds.min, startBounds.min, startBounds.max)
            : nothing}
          style=${`inset-inline-start:${startPct}%`}
          @pointerdown=${(e: PointerEvent) => this.onPointerDown('start', e)}
          @keydown=${(e: KeyboardEvent) => this.onKeyDown('start', e)}
          @keyup=${(e: KeyboardEvent) => this.onKeyUp(e)}
        ></div>
        <div
          part="handle-end"
          role="slider"
          tabindex=${this.effectiveDisabled ? '-1' : '0'}
          aria-label=${this.localize(
            'rangeEnd',
            this.endLabel === 'Range end' ? undefined : this.endLabel,
          )}
          aria-disabled=${this.effectiveDisabled ? 'true' : 'false'}
          aria-valuemin=${endBounds.min}
          aria-valuemax=${endBounds.max}
          aria-valuenow=${Number.isFinite(this.end)
            ? finiteRange(this.end, endBounds.min, endBounds.min, endBounds.max)
            : nothing}
          style=${`inset-inline-start:${endPct}%`}
          @pointerdown=${(e: PointerEvent) => this.onPointerDown('end', e)}
          @keydown=${(e: KeyboardEvent) => this.onKeyDown('end', e)}
          @keyup=${(e: KeyboardEvent) => this.onKeyUp(e)}
        ></div>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-time-range': LyraTimeRange;
  }
}

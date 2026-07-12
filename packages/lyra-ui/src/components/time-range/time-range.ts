import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { isRtl } from '../../internal/rtl.js';
import { styles } from './time-range.styles.js';

type Handle = 'start' | 'end';

interface DragState {
  handle: Handle;
  /** `[part="base"]`, looked up once in onPointerDown rather than re-queried
   *  on every pointermove of the same gesture (mirrors lyra-split's
   *  DragState.base). */
  base: HTMLElement;
}

function isArrowKey(key: string): boolean {
  return key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowLeft' || key === 'ArrowDown';
}

/** Keys that onKeyDown acts on and onKeyUp commits after — arrow keys plus
 *  the WAI-ARIA APG slider pattern's Home/End/PageUp/PageDown shortcuts. */
function isSliderKey(key: string): boolean {
  return isArrowKey(key) || key === 'Home' || key === 'End' || key === 'PageUp' || key === 'PageDown';
}

/** PageUp/PageDown move by a larger increment than a single ArrowUp/Down
 *  step, matching the WAI-ARIA APG slider pattern's expected keyboard
 *  interactions (and native `<input type=range>`). */
const PAGE_STEP_MULTIPLIER = 10;

/** Number of decimal digits in `n`'s shortest string representation, e.g.
 *  `0.1` -> 1, `5` -> 0. Used to round a stepped value back to the precision
 *  the caller's `step` itself implies, instead of leaving it at whatever
 *  binary floating-point noise `value / step` happened to produce. */
function decimalPlaces(n: number): number {
  const str = n.toString();
  const dot = str.indexOf('.');
  return dot === -1 ? 0 : str.length - dot - 1;
}

/** A single discrete-preset option for the `presets` property. */
export interface TimeRangePreset {
  label: string;
  start: number;
  end: number;
}

/**
 * `<lyra-time-range>` — a two-handle brush/scrubber over a numeric domain.
 * Callers map their own time axis to `[min, max]`; no date logic lives here
 * (matches the no-date-library constraint used elsewhere in this library).
 *
 * Optionally paired with a row of discrete presets (`presets`) — e.g. "Last
 * 7 days" / "Last 30 days" — rendered above the track; picking one is just a
 * shortcut that sets both handles at once, the continuous brush underneath
 * is unaffected and both interaction modes coexist.
 *
 * @customElement lyra-time-range
 * @event lyra-input - Fired continuously while dragging or on each arrow-key press. `detail: { start, end }`.
 * @event lyra-change - Fired on release / keyup-commit, or when a preset button is clicked. `detail: { start, end }`.
 * @csspart base, track, range, handle-start, handle-end, presets, preset-button
 */
export class LyraTimeRange extends LyraElement {
  static styles = [LyraElement.styles, styles];

  @property({ type: Number }) min = 0;
  @property({ type: Number }) max = 100;
  @property({ type: Number }) start = 0;
  @property({ type: Number }) end = 100;
  @property({ type: Number }) step = 1;
  @property({ type: Boolean, reflect: true }) disabled = false;
  /**
   * Optional discrete presets rendered as a `[part="presets"]` button row
   * above the track. Purely additive: leaving this empty (the default)
   * renders nothing extra and leaves the continuous brush untouched.
   */
  @property({ attribute: false }) presets: TimeRangePreset[] = [];

  // Keyed by pointerId rather than a single scalar so two concurrent drags
  // (e.g. a two-finger touch, one per handle) each keep tracking their own
  // handle instead of the second pointerdown hijacking which handle the
  // first pointer's subsequent moves apply to.
  private drags = new Map<number, DragState>();

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // Mirror lyra-split's cleanup: if the element is removed mid-drag (or a
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
    // percentOf()/clamp() caller. Mirror lyra-gauge's `ratio` getter, which
    // short-circuits on isNaN(...) instead, by falling back to this
    // property's own default.
    const min = isNaN(this.min) ? 0 : this.min;
    const max = isNaN(this.max) ? 100 : this.max;
    return { lo: Math.min(min, max), hi: Math.max(min, max) };
  }

  private percentOf(value: number): number {
    // A NaN `start`/`end` (e.g. an invalid `start` attribute) must not reach
    // the rendered `inset-inline-start:NaN%` — that's an invalid CSS value
    // the browser silently drops, leaving the handle stuck with no visible
    // recovery. 0% is at least a stable, well-defined position.
    if (isNaN(value)) return 0;
    const { lo, hi } = this.domain();
    const span = hi - lo || 1;
    return ((value - lo) / span) * 100;
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
    const start = isNaN(this.start) ? lo : this.start;
    const end = isNaN(this.end) ? hi : this.end;
    return handle === 'start' ? { min: lo, max: end } : { min: start, max: hi };
  }

  private clamp(handle: Handle, value: number): number {
    const { lo, hi } = this.domain();
    // A non-positive or non-finite step (e.g. a transient `step={0}` while a
    // caller derives it as `(max-min)/tickCount`) would otherwise divide by
    // zero/NaN below and permanently poison start/end with NaN, since the
    // other handle's clamp cross-references this one's (already-NaN) value.
    // Treat it as "unstepped" instead of propagating NaN.
    const hasStep = Number.isFinite(this.step) && this.step > 0;
    // Anchor the step grid at the domain's own `lo` (matching native
    // `<input type=range>`) instead of absolute 0 — otherwise a `min` that
    // isn't itself a multiple of `step` makes the very first nudge off `min`
    // jump to the nearest multiple-of-step-from-zero instead of moving by
    // one `step`. Round the result back to `step`'s own decimal precision
    // (rather than leaving raw `value / step` binary-float noise in place)
    // so repeated steps land on exact values like 20.1 instead of
    // 20.200000000000003.
    let stepped = value;
    if (hasStep) {
      const stepsFromLo = Math.round((value - lo) / this.step);
      const factor = 10 ** decimalPlaces(this.step);
      stepped = Math.round((lo + stepsFromLo * this.step) * factor) / factor;
    }
    const bounded = Math.min(hi, Math.max(lo, stepped));
    if (handle === 'start') return Math.min(bounded, this.end);
    return Math.max(bounded, this.start);
  }

  private setValue(handle: Handle, value: number, commit: boolean): void {
    const clamped = this.clamp(handle, value);
    if (handle === 'start') this.start = clamped;
    else this.end = clamped;
    this.emit('lyra-input', { start: this.start, end: this.end });
    if (commit) this.emit('lyra-change', { start: this.start, end: this.end });
  }

  /**
   * Apply a discrete preset: sets both handles and emits the same
   * lyra-input/lyra-change pair a committed drag or keyboard step would.
   */
  private applyPreset(preset: TimeRangePreset): void {
    if (this.disabled) return;
    // clamp('start', v) pins to <= this.end and clamp('end', v) pins to >=
    // this.start, cross-referencing the *other* handle's current value. If
    // the preset shifts the whole range past the old end (or before the old
    // start), applying setValue() in either order straight away would let
    // that cross-reference clip the first handle against the stale sibling
    // before the second call updates it. Widen the working range first —
    // never narrows anything, just guarantees both setValue() calls below
    // land on the preset's exact values regardless of direction.
    this.start = Math.min(this.start, preset.start);
    this.end = Math.max(this.end, preset.end);
    this.setValue('start', preset.start, false);
    this.setValue('end', preset.end, true);
  }

  private onKeyDown = (handle: Handle, e: KeyboardEvent): void => {
    // A handle that already has focus when the component becomes disabled
    // must not still respond to arrow keys (new pointerdowns are already
    // blocked by the `if (this.disabled) return;` guard in onPointerDown,
    // and disabled handles carry `tabindex="-1"`, but a pre-existing focus
    // can bypass both of those).
    if (this.disabled) return;
    const current = handle === 'start' ? this.start : this.end;
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
    // focused must not emit a spurious lyra-change.
    if (this.disabled || !isSliderKey(e.key)) return;
    this.emit('lyra-change', { start: this.start, end: this.end });
  };

  private onPointerDown = (handle: Handle, e: PointerEvent): void => {
    if (this.disabled) return;
    const base = this.renderRoot.querySelector('[part="base"]') as HTMLElement;
    this.drags.set(e.pointerId, { handle, base });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    // A drag can end without a pointerup: a system gesture / palm rejection
    // can fire `pointercancel`, and losing capture (e.g. element removed)
    // fires `lostpointercapture` — both need the same teardown as pointerup
    // or `this.drags` keeps a permanently-stale entry and these window
    // listeners (and the closure keeping this instance alive) never get
    // removed. Mirrors lyra-split's identical fix.
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('lostpointercapture', this.onPointerUp);
  };

  private onPointerMove = (e: PointerEvent): void => {
    const drag = this.drags.get(e.pointerId);
    if (drag === undefined) return;
    if (this.disabled) {
      // These are window-level listeners driven by setPointerCapture, so
      // they keep firing for this pointerId regardless of any CSS on the
      // host (this was already true even back when the host used
      // `pointer-events: none`, since that never governed an
      // already-captured window listener) — a drag already in progress
      // would otherwise keep mutating start/end (and emitting lyra-input)
      // after `disabled` flips true mid-drag. Abort the drag instead of
      // continuing to process it.
      this.endDrag(e.pointerId, false);
      return;
    }
    const rect = drag.base.getBoundingClientRect();
    const raw = (e.clientX - rect.left) / rect.width;
    // The track is positioned with inset-inline-start (0% at the visual
    // right edge under RTL), so the pointer ratio has to mirror that or a
    // rightward drag would move the handle the wrong way.
    const ratio = Math.min(1, Math.max(0, isRtl(this) ? 1 - raw : raw));
    const value = this.min + ratio * (this.max - this.min);
    this.setValue(drag.handle, value, false);
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.endDrag(e.pointerId, true);
  };

  /** Stop the drag owned by `pointerId`, optionally committing a final lyra-change. */
  private endDrag(pointerId: number, commit: boolean): void {
    if (!this.drags.has(pointerId)) return;
    this.drags.delete(pointerId);
    if (commit) this.emit('lyra-change', { start: this.start, end: this.end });
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
      const lo = Math.min(this.min, this.max);
      const hi = Math.max(this.min, this.max);
      this.start = Math.min(hi, Math.max(lo, this.start));
      this.end = Math.min(hi, Math.max(lo, this.end));
    }
    // Keep start <= end regardless of which side changed (a controlled
    // caller may set only `end`, e.g. two-way-binding an external store).
    // The handle that just moved wins; the other side is pulled to meet it,
    // mirroring the direction `clamp()` already uses during interactive
    // dragging.
    if (changed.has('start') || changed.has('min') || changed.has('max')) {
      this.start = Math.min(this.start, this.end);
    }
    if (changed.has('end') || changed.has('min') || changed.has('max')) {
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
                ?disabled=${this.disabled}
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
          tabindex=${this.disabled ? '-1' : '0'}
          aria-label="Range start"
          aria-disabled=${this.disabled ? 'true' : nothing}
          aria-valuemin=${startBounds.min}
          aria-valuemax=${startBounds.max}
          aria-valuenow=${isNaN(this.start) ? nothing : this.start}
          style=${`inset-inline-start:${startPct}%`}
          @pointerdown=${(e: PointerEvent) => this.onPointerDown('start', e)}
          @keydown=${(e: KeyboardEvent) => this.onKeyDown('start', e)}
          @keyup=${(e: KeyboardEvent) => this.onKeyUp(e)}
        ></div>
        <div
          part="handle-end"
          role="slider"
          tabindex=${this.disabled ? '-1' : '0'}
          aria-label="Range end"
          aria-disabled=${this.disabled ? 'true' : nothing}
          aria-valuemin=${endBounds.min}
          aria-valuemax=${endBounds.max}
          aria-valuenow=${isNaN(this.end) ? nothing : this.end}
          style=${`inset-inline-start:${endPct}%`}
          @pointerdown=${(e: PointerEvent) => this.onPointerDown('end', e)}
          @keydown=${(e: KeyboardEvent) => this.onKeyDown('end', e)}
          @keyup=${(e: KeyboardEvent) => this.onKeyUp(e)}
        ></div>
      </div>
    `;
  }
}

defineElement('time-range', LyraTimeRange);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-time-range': LyraTimeRange;
  }
}

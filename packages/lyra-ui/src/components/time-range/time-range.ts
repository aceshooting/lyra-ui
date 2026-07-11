import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './time-range.styles.js';

type Handle = 'start' | 'end';

function isArrowKey(key: string): boolean {
  return key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowLeft' || key === 'ArrowDown';
}

/**
 * `<lyra-time-range>` — a two-handle brush/scrubber over a numeric domain.
 * Callers map their own time axis to `[min, max]`; no date logic lives here
 * (matches the no-date-library constraint used elsewhere in this library).
 *
 * @customElement lyra-time-range
 * @event lyra-input - Fired continuously while dragging. `detail: { start, end }`.
 * @event lyra-change - Fired on release / keyup-commit. `detail: { start, end }`.
 * @csspart base, track, range, handle-start, handle-end
 */
export class LyraTimeRange extends LyraElement {
  static styles = [LyraElement.styles, styles];

  @property({ type: Number }) min = 0;
  @property({ type: Number }) max = 100;
  @property({ type: Number }) start = 0;
  @property({ type: Number }) end = 100;
  @property({ type: Number }) step = 1;
  @property({ type: Boolean, reflect: true }) disabled = false;

  private dragging: Handle | null = null;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // Mirror lyra-split's cleanup: if the element is removed mid-drag (or a
    // pointercancel/alt-tab means `pointerup` never reaches `window`), these
    // window-level listeners — and the closure keeping this instance alive —
    // would otherwise leak indefinitely.
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
  }

  private percentOf(value: number): number {
    const span = this.max - this.min || 1;
    return ((value - this.min) / span) * 100;
  }

  private clamp(handle: Handle, value: number): number {
    const stepped = Math.round(value / this.step) * this.step;
    const bounded = Math.min(this.max, Math.max(this.min, stepped));
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

  private onKeyDown = (handle: Handle, e: KeyboardEvent): void => {
    // A handle that already has focus when the component becomes disabled
    // must not still respond to arrow keys (new pointerdowns are already
    // blocked by the `if (this.disabled) return;` guard in onPointerDown,
    // and disabled handles carry `tabindex="-1"`, but a pre-existing focus
    // can bypass both of those).
    if (this.disabled) return;
    const current = handle === 'start' ? this.start : this.end;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.setValue(handle, current + this.step, false);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      this.setValue(handle, current - this.step, false);
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    // Only commit on release of the arrow keys that onKeyDown acts on —
    // releasing an unrelated key (Tab, Shift, ...) while a handle happens
    // to be focused must not emit a spurious lyra-change.
    if (this.disabled || !isArrowKey(e.key)) return;
    this.emit('lyra-change', { start: this.start, end: this.end });
  };

  private onPointerDown = (handle: Handle, e: PointerEvent): void => {
    if (this.disabled) return;
    this.dragging = handle;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    if (this.disabled) {
      // These are window-level listeners driven by setPointerCapture, so
      // they keep firing for this pointerId regardless of any CSS on the
      // host (this was already true even back when the host used
      // `pointer-events: none`, since that never governed an
      // already-captured window listener) — a drag already in progress
      // would otherwise keep mutating start/end (and emitting lyra-input)
      // after `disabled` flips true mid-drag. Abort the drag instead of
      // continuing to process it.
      this.endDrag(false);
      return;
    }
    const base = this.renderRoot.querySelector('[part="base"]') as HTMLElement;
    const rect = base.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const value = this.min + ratio * (this.max - this.min);
    this.setValue(this.dragging, value, false);
  };

  private onPointerUp = (): void => {
    this.endDrag(true);
  };

  /** Stop an in-progress drag, optionally committing a final lyra-change. */
  private endDrag(commit: boolean): void {
    if (this.dragging && commit) this.emit('lyra-change', { start: this.start, end: this.end });
    this.dragging = null;
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
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
    return html`
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
          aria-valuemin=${this.min}
          aria-valuemax=${this.max}
          aria-valuenow=${this.start}
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
          aria-valuemin=${this.min}
          aria-valuemax=${this.max}
          aria-valuenow=${this.end}
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

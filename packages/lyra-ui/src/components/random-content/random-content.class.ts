import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { finiteDuration, finiteInteger } from '../../internal/numbers.js';
import { styles } from './random-content.styles.js';

export type LyraRandomContentAnimation = 'none' | 'fade' | 'fade-up' | 'fade-down' | 'fade-left' | 'fade-right';
export type LyraRandomContentMode = 'unique' | 'random' | 'sequence';

export interface LyraRandomContentEventMap {
  'lyra-content-change': CustomEvent<{ items: HTMLElement[] }>;
}

/**
 * `<lyra-random-content>` — displays a randomly (or sequentially) chosen
 * subset of its slotted children and hides the rest, for A/B copy testing,
 * testimonial/quote rotation, or varying marketing copy on each render or
 * interval without any custom JS beyond slotting the candidates.
 *
 * Not a form-associated control and has no textual chrome of its own — a
 * pure content-rotation primitive over caller-supplied children, so the
 * label/hint/error frame doesn't apply.
 *
 * The host renders `display: block` by default, like the rest of this
 * family. A consumer needing an inline text-fragment swap inside a sentence
 * can override `lyra-random-content { display: inline; }` from outside —
 * that isn't baked in here, since `display: contents` on the host risks
 * accessibility-tree inconsistencies across engines.
 *
 * There is no built-in trigger UI (no next/previous/shuffle button):
 * selection is driven only by `autoplay`/`autoplayInterval` and the public
 * `randomize()` method. Consequently there is no keyboard interaction and no
 * RTL-aware arrow-key handling to implement here — that guarantee only
 * applies to components with roving/arrow-key navigation, which this one
 * structurally lacks.
 *
 * `fade-left`/`fade-right` are physical-direction transforms (matching the
 * upstream naming this component mirrors), not "previous/next" navigational
 * semantics like a carousel chevron, so they are deliberately **not**
 * mirrored under `:host(:dir(rtl))`.
 *
 * @customElement lyra-random-content
 * @slot - The pool of candidate children. Only direct element children are eligible.
 * @event lyra-content-change - The displayed selection changed (first render, `randomize()`,
 * a slot-change-triggered reselection, or an autoplay tick). `detail: { items }` is the exact
 * array of elements now shown, in display order. Not emitted when the eligible pool is empty.
 * @csspart base - The wrapping element around the default slot.
 * @cssprop [--lyra-random-content-animation-duration=300ms] - Duration of the entrance animation.
 * @cssprop [--lyra-random-content-animation-easing=ease] - Easing function for the entrance animation.
 * @cssprop [--lyra-random-content-animation-translate=var(--lyra-size-0-5em)] - Translation distance for directional animations.
 */
export class LyraRandomContent extends LyraElement<LyraRandomContentEventMap> {
  static styles = [LyraElement.styles, styles];

  /** Entrance effect applied to a child the instant it becomes shown. */
  @property({ reflect: true }) animation: LyraRandomContentAnimation = 'none';

  /** Whether the displayed selection automatically re-rolls on an interval. */
  @property({ type: Boolean, reflect: true }) autoplay = false;

  /** Milliseconds between autoplay ticks. Clamped to a 1000ms floor. */
  @property({ type: Number, attribute: 'autoplay-interval' }) autoplayInterval = 3000;

  /** How many children are shown simultaneously -- a count, not the pool itself. NaN/negative/
   *  fractional/oversized all normalize through `finiteInteger`, clamped to at least 1 and at
   *  most the pool size -- see `clampedCount()`. */
  @property({ type: Number }) items = 1;

  /** Selection algorithm — see `randomize()`. */
  @property() mode: LyraRandomContentMode = 'unique';

  @query('slot') private slotEl?: HTMLSlotElement;

  private timer?: number;
  private reduceMotion = false;
  private mediaQuery?: MediaQueryList;
  private sequenceCursor = 0;
  private previousSelection?: HTMLElement[];
  private lastPool: HTMLElement[] = [];
  // Distinguishes a genuine later `updated()` pass from the very first one.
  // Lit reports every declared reactive property as "changed" on the first
  // update (including `items`, which otherwise would make `updated()` run a
  // redundant second selection right after `firstUpdated()` already ran one
  // -- doubling the emitted `lyra-content-change` event and, for
  // mode="sequence", double-advancing the cursor).
  private hasUpdatedOnce = false;

  connectedCallback(): void {
    super.connectedCallback();
    this.mediaQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : undefined;
    this.reduceMotion = this.mediaQuery?.matches ?? false;
    this.mediaQuery?.addEventListener('change', this.onMotionPreferenceChange);
    // `firstUpdated()` only ever runs once per element lifetime, but
    // `disconnectedCallback()` unconditionally stops the timer on every
    // disconnect -- without restarting here too, a disconnect/reconnect
    // cycle (e.g. a virtualized list reordering this element) would leave
    // autoplay permanently stopped. Harmless no-op before the shadow tree's
    // slot exists yet (`eligible()` returns `[]`, gated off below).
    this.restartAutoplay();
  }

  disconnectedCallback(): void {
    this.stopAutoplay();
    this.mediaQuery?.removeEventListener('change', this.onMotionPreferenceChange);
    this.mediaQuery = undefined;
    super.disconnectedCallback();
  }

  protected firstUpdated(): void {
    // Handles slotted content present at parse time: the slot's assigned
    // elements are already resolved synchronously once the shadow tree
    // renders, so this doesn't need to wait on the (async, and not
    // guaranteed-timed across engines) `slotchange` event just to read the
    // initial pool. `onSlotChange` below still exists for genuinely later
    // pool changes and as a fallback if `slotchange` is the only signal a
    // given engine ever fires for this content.
    this.reselect();
    this.restartAutoplay();
  }

  protected updated(changed: PropertyValues): void {
    if (this.hasUpdatedOnce) {
      if (changed.has('items')) this.reselect();
      if (changed.has('autoplay') || changed.has('autoplayInterval')) this.restartAutoplay();
    }
    this.hasUpdatedOnce = true;
  }

  private onMotionPreferenceChange = (event: MediaQueryListEvent): void => {
    this.reduceMotion = event.matches;
    this.restartAutoplay();
  };

  private eligible(): HTMLElement[] {
    return (this.slotEl?.assignedElements() ?? []).filter(
      (el): el is HTMLElement => el instanceof HTMLElement,
    );
  }

  private clampedCount(poolSize: number): number {
    // Only called with poolSize >= 1 (reselect() returns early for an empty pool), so a [1,
    // poolSize] clamp is always well-formed here.
    return finiteInteger(this.items, 1, 1, poolSize);
  }

  private poolsEqual(a: HTMLElement[], b: HTMLElement[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((el, index) => el === b[index]);
  }

  private shuffledPick(pool: HTMLElement[], count: number): HTMLElement[] {
    const arr = pool.slice();
    const n = Math.min(count, arr.length);
    for (let i = 0; i < n; i += 1) {
      const j = i + Math.floor(Math.random() * (arr.length - i));
      const swap = arr[i];
      arr[i] = arr[j];
      arr[j] = swap;
    }
    return arr.slice(0, n);
  }

  private sameAsPrevious(selection: HTMLElement[]): boolean {
    const previous = this.previousSelection;
    if (!previous || previous.length !== selection.length) return false;
    const previousSet = new Set(previous);
    return selection.every((el) => previousSet.has(el));
  }

  private selectUnique(pool: HTMLElement[], count: number): HTMLElement[] {
    let picked = this.shuffledPick(pool, count);
    if (pool.length > count) {
      let attempts = 0;
      while (attempts < 10 && this.sameAsPrevious(picked)) {
        picked = this.shuffledPick(pool, count);
        attempts += 1;
      }
    }
    return picked;
  }

  private selectSequence(pool: HTMLElement[], count: number): HTMLElement[] {
    const total = pool.length;
    const start = this.sequenceCursor % total;
    const picked: HTMLElement[] = [];
    for (let k = 0; k < count; k += 1) {
      picked.push(pool[(start + k) % total]);
    }
    this.sequenceCursor = (start + count) % total;
    return picked;
  }

  private computeSelectionForMode(pool: HTMLElement[], count: number): HTMLElement[] {
    switch (this.mode) {
      case 'sequence':
        return this.selectSequence(pool, count);
      case 'unique':
        return this.selectUnique(pool, count);
      case 'random':
      default:
        return this.shuffledPick(pool, count);
    }
  }

  private applySelection(pool: HTMLElement[], selected: HTMLElement[]): void {
    const selectedSet = new Set(selected);
    for (const el of pool) {
      const shown = selectedSet.has(el);
      el.toggleAttribute('hidden', !shown);
      el.setAttribute('aria-hidden', shown ? 'false' : 'true');
    }
  }

  private reselect(options: { resetPrevious?: boolean } = {}): HTMLElement[] {
    const pool = this.eligible();
    this.lastPool = pool;
    if (pool.length === 0) {
      this.previousSelection = undefined;
      return [];
    }
    if (options.resetPrevious) this.previousSelection = undefined;
    const count = this.clampedCount(pool.length);
    const selected = this.computeSelectionForMode(pool, count);
    this.applySelection(pool, selected);
    this.previousSelection = selected;
    this.emit('lyra-content-change', { items: selected });
    return selected;
  }

  private onSlotChange = (): void => {
    const pool = this.eligible();
    // A slot's first assignment of already-present light-DOM children can
    // itself dispatch an async `slotchange` shortly after `firstUpdated()`
    // already handled that same content synchronously above -- skip when
    // nothing about the pool actually changed to avoid double-emitting
    // `lyra-content-change` (and, for mode="sequence", double-advancing the
    // cursor) for a single real content change.
    if (this.poolsEqual(pool, this.lastPool)) return;
    this.reselect({ resetPrevious: true });
    this.restartAutoplay();
  };

  /**
   * Selects a new set of children using the current mode. Applies
   * `hidden`/`aria-hidden`, emits `lyra-content-change`, and returns the
   * elements now shown. Does not reset or restart the autoplay timer.
   */
  randomize = (): HTMLElement[] => this.reselect();

  private stopAutoplay(): void {
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.timer = undefined;
  }

  private restartAutoplay(): void {
    this.stopAutoplay();
    if (!this.autoplay || this.reduceMotion || this.eligible().length < 2) return;
    const interval = finiteDuration(this.autoplayInterval, 3000, 1000);
    this.timer = window.setInterval(() => {
      this.reselect();
    }, interval);
  }

  render(): TemplateResult {
    const hostLabel = this.getAttribute('aria-label');
    return html`<div
      part="base"
      role="status"
      aria-live=${this.autoplay ? 'off' : 'polite'}
      aria-atomic="true"
      aria-label=${hostLabel === null ? nothing : hostLabel}
    >
      <slot @slotchange=${this.onSlotChange}></slot>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-random-content': LyraRandomContent;
  }
}

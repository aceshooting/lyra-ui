import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { isRtl } from '../../internal/rtl.js';
import { styles } from './split.styles.js';

const KEYBOARD_STEP = 2;

// Sentinel fallbacks so a one-sided constraint (only `minPx` or only
// `maxPx`) can still be expressed as a 3-argument CSS `clamp()` in the
// static layout, instead of needing two different flex-basis shapes.
const NO_MIN_PX = 0;
const NO_MAX_PX = 1_000_000;

interface DragState {
  index: number;
  startPos: number;
  base: HTMLElement;
  /** Cumulative delta already folded into the live `sizes` so far this
   *  gesture — clamping against live sizes (see onPointerMove) means each
   *  move must apply only the *incremental* delta since the last move, not
   *  the total-since-drag-start delta a snapshot-based clamp would use. */
  appliedDelta: number;
}

/** A fixed-pixel-range constraint for one panel; index-aligned with `sizes`/
 *  `panelConstraints`. Either bound may be omitted to leave that side
 *  unconstrained (falls back to the component's percent-based `min`). */
export interface PanelConstraint {
  minPx?: number;
  maxPx?: number;
}

/**
 * `<lyra-split>` — resizable panels for dashboard layouts. Direct light-DOM
 * children are the panels; a divider is auto-inserted between each pair.
 *
 * @customElement lyra-split
 * @event lyra-resize - `detail: { sizes }`, fired on every drag step/release
 *   and every keyboard step.
 * @slot - Panels to arrange side by side (or stacked, when `orientation="vertical"`); each direct child becomes one resizable panel.
 * @csspart base, divider
 */
export class LyraSplit extends LyraElement {
  static styles = [LyraElement.styles, styles];

  @property({ attribute: false }) sizes: number[] = [];
  @property({ type: Number }) min = 10;
  @property({ reflect: true }) orientation: 'horizontal' | 'vertical' = 'horizontal';
  @property({ attribute: 'storage-key' }) storageKey?: string;
  /** Optional fixed-pixel min/max per panel, index-aligned with `sizes`. A
   *  `null`/missing entry leaves that panel purely percent-based (the
   *  existing `min`-only behavior). `sizes`, the `lyra-resize` payload, and
   *  localStorage persistence stay percent-based regardless — only the
   *  effective clamp bounds change for a constrained panel. */
  @property({ attribute: false }) panelConstraints: (PanelConstraint | null)[] = [];

  @state() private panelCount = 0;
  // Keyed by pointerId so an interrupted or concurrent (multi-touch) drag on
  // one divider never reads or clobbers another pointer's drag state.
  private drags = new Map<number, DragState>();
  // Panels `updated()` last applied inline flex/order styles to — tracked so
  // a panel removed from the slot (e.g. a DOM node later reused elsewhere)
  // gets those lyra-split-authored styles cleared instead of carrying them
  // around stale forever.
  private stylizedPanels = new Set<HTMLElement>();

  connectedCallback(): void {
    super.connectedCallback();
    this.panelCount = this.children.length;
    this.ensureSizes();
    this.loadPersisted();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // Clean up any remaining event listeners from an in-flight drag.
    this.drags.clear();
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('lostpointercapture', this.onPointerUp);
  }

  private get storageFullKey(): string | undefined {
    return this.storageKey ? `lyra-split:${this.storageKey}:${this.panelCount}` : undefined;
  }

  private loadPersisted(): void {
    const key = this.storageFullKey;
    if (!key) return;
    let raw: string | null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      /* localStorage unavailable (private browsing, sandboxed iframe, etc.) */
      return;
    }
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as number[];
      // A persisted layout can predate a since-raised `min`; reject it rather
      // than restoring sizes that are already stuck below the current floor.
      const isValid =
        Array.isArray(parsed) &&
        parsed.length === this.panelCount &&
        parsed.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= this.min);
      if (isValid) this.sizes = parsed;
    } catch {
      /* ignore malformed persisted state */
    }
  }

  private persist(): void {
    const key = this.storageFullKey;
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(this.sizes));
    } catch {
      /* ignore persistence failures (e.g. quota exceeded, private browsing) */
    }
  }

  private ensureSizes(): void {
    if (this.panelCount === this.sizes.length) return;
    if (this.panelCount <= 0) {
      this.sizes = [];
      return;
    }
    if (this.sizes.length === 0) {
      const equal = 100 / this.panelCount;
      this.sizes = Array.from({ length: this.panelCount }, () => equal);
      return;
    }
    // A panel was added or removed: rebalance the existing sizes
    // proportionally instead of discarding every panel's customized size,
    // so an unrelated panel-count change doesn't wipe the whole layout.
    const diff = this.panelCount - this.sizes.length;
    if (diff > 0) {
      const newShare = 100 / this.panelCount;
      const scale = (100 - newShare * diff) / 100;
      this.sizes = [
        ...this.sizes.map((s) => s * scale),
        ...Array.from({ length: diff }, () => newShare),
      ];
    } else {
      const kept = this.sizes.slice(0, this.panelCount);
      const removedTotal = this.sizes.slice(this.panelCount).reduce((sum, s) => sum + s, 0);
      const keptTotal = kept.reduce((sum, s) => sum + s, 0) || 1;
      this.sizes = kept.map((s) => s + (s / keptTotal) * removedTotal);
    }
  }

  private onSlotChange = (): void => {
    this.panelCount = this.children.length;
    this.ensureSizes();
  };

  /** The container extent (px) along the resize axis, read live so a
   *  container resize between calls is always picked up — same live read
   *  `onPointerMove` already does via `drag.base.clientWidth/clientHeight`. */
  private getContainerSize(): number {
    const base = this.renderRoot.querySelector('[part="base"]') as HTMLElement | null;
    if (!base) return 0;
    return this.orientation === 'vertical' ? base.clientHeight : base.clientWidth;
  }

  /** Resolves panel `index`'s effective percent min/max for this clamp pass:
   *  a `panelConstraints` entry's px bound converted against the live
   *  `containerSize`, or the component's plain percent `min` (no upper
   *  bound) when the panel carries no constraint for that side. */
  private percentBounds(index: number, containerSize: number): { min: number; max: number } {
    const constraint = this.panelConstraints[index];
    let min = this.min;
    let max = Infinity;
    if (constraint && containerSize > 0) {
      if (constraint.minPx != null) min = (constraint.minPx / containerSize) * 100;
      if (constraint.maxPx != null) max = (constraint.maxPx / containerSize) * 100;
    }
    return { min, max };
  }

  private clampPair(sizes: number[], i: number, delta: number, containerSize = 0): number[] {
    const next = [...sizes];
    const pairTotal = next[i] + next[i + 1];
    const a = this.percentBounds(i, containerSize);
    const b = this.percentBounds(i + 1, containerSize);
    // Panel i's own bounds, further narrowed by panel i+1's bounds (its
    // partner's min/max caps how much i can grow/shrink within the pair).
    const loRaw = Math.max(a.min, pairTotal - b.max);
    const hiRaw = Math.min(a.max, pairTotal - b.min);
    // Clamp *toward* the bound instead of rejecting the whole move when the
    // result is still outside it — otherwise a pair that starts under its
    // combined min (e.g. an equal split across many panels) can never be
    // moved at all, since every step recomputes the same rejected delta from
    // the same untouched starting sizes.
    const lo = Math.min(loRaw, pairTotal);
    const hi = Math.max(hiRaw, lo);
    const clampedA = Math.min(Math.max(next[i] + delta, lo), hi);
    next[i] = clampedA;
    next[i + 1] = pairTotal - clampedA;
    return next;
  }

  private applyDelta(index: number, delta: number, commit: boolean): void {
    this.sizes = this.clampPair(this.sizes, index, delta, this.getContainerSize());
    this.emit('lyra-resize', { sizes: [...this.sizes] });
    if (commit) this.persist();
  }

  private onPointerDown = (e: PointerEvent, index: number): void => {
    const base = this.renderRoot.querySelector('[part="base"]') as HTMLElement;
    this.drags.set(e.pointerId, {
      index,
      startPos: this.orientation === 'vertical' ? e.clientY : e.clientX,
      base,
      appliedDelta: 0,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    // A drag can end without a pointerup: a system gesture / palm rejection
    // can fire `pointercancel`, and losing capture (e.g. element removed)
    // fires `lostpointercapture` — both need the same teardown as pointerup
    // or the divider keeps "resizing" in response to unrelated movement.
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('lostpointercapture', this.onPointerUp);
  };

  private onPointerMove = (e: PointerEvent): void => {
    const drag = this.drags.get(e.pointerId);
    if (!drag) return;
    const total = this.orientation === 'vertical' ? drag.base.clientHeight : drag.base.clientWidth;
    const pos = this.orientation === 'vertical' ? e.clientY : e.clientX;
    let cumulativeDelta = ((pos - drag.startPos) / total) * 100;
    // Panels are ordered along the inline axis via CSS `order`, so under RTL
    // `flex-direction: row` already renders panel[i] to the *right* of
    // panel[i+1] — a physically-rightward drag has to shrink index instead
    // of growing it to keep matching the visible panel under the pointer.
    if (this.orientation === 'horizontal' && isRtl(this)) cumulativeDelta = -cumulativeDelta;
    // Clamp against the *current* live sizes, not this pointer's own drag-start
    // snapshot -- two adjacent dividers dragged concurrently share one panel
    // between them, and each clamp pass must see whatever the other pointer's
    // move has *just* written, or the two independently-clamped pairs can each
    // stay individually valid while their shared panel drifts past what either
    // pair alone would allow, letting the total exceed 100%. Since the clamp
    // basis is now the live, already-partially-applied `this.sizes` instead of
    // a fixed drag-start snapshot, only the *incremental* delta since the last
    // move may be applied here (not the cumulative-since-drag-start delta a
    // snapshot-based clamp would use).
    const incremental = cumulativeDelta - drag.appliedDelta;
    const priorValue = this.sizes[drag.index];
    const paired = this.clampPair(this.sizes, drag.index, incremental, total);
    // Accumulate this move's own *realized* increment (post-clamp) onto the
    // running total, rather than recomputing an absolute "total since
    // drag-start" diff against a fixed startSizes snapshot. clampPair can
    // cap the actual move short of what was requested (e.g. a drag
    // saturating a panel's min/panelConstraints bound), so the realized
    // portion still has to be tracked instead of the raw request -- that
    // part of round 1's fix stands. But an absolute since-start diff also
    // silently absorbs any change a DIFFERENT concurrent pointer's drag
    // makes to this same shared panel between this pointer's own moves
    // (adjacent dividers share one panel: divider i's index+1 panel is
    // divider i+1's index panel), corrupting this pointer's next incremental
    // calculation. Summing only this move's own delta (paired vs. the value
    // immediately prior to *this* clamp) avoids both bugs at once.
    drag.appliedDelta += paired[drag.index] - priorValue;
    // Merge only this drag's pair into the live sizes so a concurrent drag
    // on another divider (different pointerId) isn't clobbered.
    const next = [...this.sizes];
    next[drag.index] = paired[drag.index];
    next[drag.index + 1] = paired[drag.index + 1];
    this.sizes = next;
    this.emit('lyra-resize', { sizes: [...this.sizes] });
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.drags.has(e.pointerId)) return;
    this.drags.delete(e.pointerId);
    this.persist();
    if (this.drags.size === 0) {
      window.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerup', this.onPointerUp);
      window.removeEventListener('pointercancel', this.onPointerUp);
      window.removeEventListener('lostpointercapture', this.onPointerUp);
    }
  };

  private onDividerKeyDown = (e: KeyboardEvent, index: number): void => {
    // Mirror the same swap as onPointerMove for horizontal+RTL.
    const rtl = this.orientation === 'horizontal' && isRtl(this);
    const forwardKey = this.orientation === 'vertical' ? 'ArrowDown' : rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = this.orientation === 'vertical' ? 'ArrowUp' : rtl ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === forwardKey) {
      e.preventDefault();
      this.applyDelta(index, KEYBOARD_STEP, true);
    } else if (e.key === backwardKey) {
      e.preventDefault();
      this.applyDelta(index, -KEYBOARD_STEP, true);
    }
  };

  protected updated(changed: PropertyValues): void {
    if (changed.has('sizes') || this.sizes.length === 0) this.ensureSizes();
    const panels = [...this.children] as HTMLElement[];
    const current = new Set(panels);
    // A panel that dropped out of the slot (removed from the light DOM)
    // still carries whatever inline flex/order this method last applied to
    // it — clear those before that DOM node potentially gets reused
    // elsewhere (e.g. re-slotted into another split/container).
    for (const stale of this.stylizedPanels) {
      if (!current.has(stale)) {
        stale.style.removeProperty('flex');
        stale.style.removeProperty('order');
      }
    }
    panels.forEach((panel, i) => {
      const percent = this.sizes[i] ?? 0;
      const constraint = this.panelConstraints[i];
      // clamp() mixes units natively, so a constrained panel stays pinned
      // between its px bounds across container resizes with no extra
      // ResizeObserver — the browser re-evaluates it on every layout pass.
      panel.style.flex =
        constraint && (constraint.minPx != null || constraint.maxPx != null)
          ? `0 0 clamp(${constraint.minPx ?? NO_MIN_PX}px, ${percent}%, ${constraint.maxPx ?? NO_MAX_PX}px)`
          : `0 0 ${percent}%`;
      panel.style.order = String(i * 2);
    });
    this.stylizedPanels = current;
  }

  render(): TemplateResult {
    const dividers: TemplateResult[] = [];
    for (let i = 0; i < this.panelCount - 1; i++) {
      // The achievable max for this divider is bounded by its two adjacent
      // panels, not the whole track — pushing past it would starve a panel
      // further down the line even though this pair still has room.
      const valueMax = (this.sizes[i] ?? 0) + (this.sizes[i + 1] ?? 0) - this.min;
      dividers.push(html`<div
        part="divider"
        role="separator"
        aria-label="Resize divider between panel ${i + 1} and panel ${i + 2}"
        aria-orientation=${this.orientation === 'vertical' ? 'horizontal' : 'vertical'}
        aria-valuenow=${Math.round(this.sizes[i] ?? 0)}
        aria-valuemin=${this.min}
        aria-valuemax=${Math.round(valueMax)}
        tabindex="0"
        style=${`order:${i * 2 + 1}`}
        @pointerdown=${(e: PointerEvent) => this.onPointerDown(e, i)}
        @keydown=${(e: KeyboardEvent) => this.onDividerKeyDown(e, i)}
      ></div>`);
    }
    return html`<div part="base"><slot @slotchange=${this.onSlotChange}></slot>${dividers}</div>`;
  }
}

defineElement('split', LyraSplit);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-split': LyraSplit;
  }
}

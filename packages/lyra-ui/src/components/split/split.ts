import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './split.styles.js';

const KEYBOARD_STEP = 2;

/**
 * `<lyra-split>` — resizable panels for dashboard layouts. Direct light-DOM
 * children are the panels; a divider is auto-inserted between each pair.
 *
 * @customElement lyra-split
 * @event lyra-resize - `detail: { sizes }`, fired on every drag step/release
 *   and every keyboard step.
 * @csspart base, divider
 */
export class LyraSplit extends LyraElement {
  static styles = [LyraElement.styles, styles];

  @property({ attribute: false }) sizes: number[] = [];
  @property({ type: Number }) min = 10;
  @property({ reflect: true }) orientation: 'horizontal' | 'vertical' = 'horizontal';
  @property({ attribute: 'storage-key' }) storageKey?: string;

  @state() private panelCount = 0;
  private dragIndex = -1;
  private dragStartPos = 0;
  private dragStartSizes: number[] = [];

  connectedCallback(): void {
    super.connectedCallback();
    this.panelCount = this.children.length;
    this.ensureSizes();
    this.loadPersisted();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // Clean up any remaining event listeners
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
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
      if (Array.isArray(parsed) && parsed.length === this.panelCount) this.sizes = parsed;
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
    if (this.sizes.length === this.panelCount && this.panelCount > 0) return;
    const equal = 100 / Math.max(1, this.panelCount);
    this.sizes = Array.from({ length: this.panelCount }, () => equal);
  }

  private onSlotChange = (): void => {
    this.panelCount = this.children.length;
    this.ensureSizes();
  };

  private clampPair(sizes: number[], i: number, delta: number): number[] {
    const next = [...sizes];
    const a = next[i] + delta;
    const b = next[i + 1] - delta;
    if (a < this.min || b < this.min) return sizes;
    next[i] = a;
    next[i + 1] = b;
    return next;
  }

  private applyDelta(index: number, delta: number, commit: boolean): void {
    this.sizes = this.clampPair(this.sizes, index, delta);
    this.emit('lyra-resize', { sizes: [...this.sizes] });
    if (commit) this.persist();
  }

  private onPointerDown = (e: PointerEvent, index: number): void => {
    this.dragIndex = index;
    this.dragStartPos = this.orientation === 'vertical' ? e.clientY : e.clientX;
    this.dragStartSizes = [...this.sizes];
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.dragIndex < 0) return;
    const base = this.renderRoot.querySelector('[part="base"]') as HTMLElement;
    const total = this.orientation === 'vertical' ? base.clientHeight : base.clientWidth;
    const pos = this.orientation === 'vertical' ? e.clientY : e.clientX;
    const deltaPercent = ((pos - this.dragStartPos) / total) * 100;
    this.sizes = this.clampPair(this.dragStartSizes, this.dragIndex, deltaPercent);
    this.emit('lyra-resize', { sizes: [...this.sizes] });
  };

  private onPointerUp = (): void => {
    this.dragIndex = -1;
    this.persist();
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
  };

  private onDividerKeyDown = (e: KeyboardEvent, index: number): void => {
    const forwardKey = this.orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
    const backwardKey = this.orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
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
    panels.forEach((panel, i) => {
      panel.style.flex = `0 0 ${this.sizes[i] ?? 0}%`;
      panel.style.order = String(i * 2);
    });
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

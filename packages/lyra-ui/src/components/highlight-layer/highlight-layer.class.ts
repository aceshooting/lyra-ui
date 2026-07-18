import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import type { LyraHighlightTone, HighlightActivateDetail } from '../document-viewer/anchors.js';
import { styles } from './highlight-layer.styles.js';

const FLASH_DURATION_MS = 1800; // mirrors --lyra-transition-ambient's default duration

export interface HighlightLayerItem {
  id: string;
  /** Percent-of-box coordinates (the `region` anchor convention). One item may span multiple rects
   *  (a quote wrapping lines). */
  rects: { x: number; y: number; width: number; height: number }[];
  label?: string;
  tone?: LyraHighlightTone;
}

export interface LyraHighlightLayerEventMap {
  'lyra-highlight-activate': CustomEvent<HighlightActivateDetail>;
}

/**
 * `<lyra-highlight-layer>` — a presentational overlay that paints highlight rectangles
 * (percent-of-box coordinates) over positioned content and owns their activation, active/flash
 * styling, and keyboard access. `items` order is the caller's own reading order; the layer does not
 * re-sort geometrically. Fills its nearest positioned ancestor.
 *
 * @customElement lyra-highlight-layer
 * @event lyra-highlight-activate - A rect was activated (click, or Enter/Space while focused).
 *   `detail: { id }`.
 * @csspart base - The absolutely-positioned overlay (inset 0).
 * @csspart rect - One highlight rectangle (`data-tone`/`data-active`/`data-flash` state attributes).
 */
export class LyraHighlightLayer extends LyraElement<LyraHighlightLayerEventMap> {
  static styles = [LyraElement.styles, styles];

  @property({ attribute: false }) items: HighlightLayerItem[] = [];
  @property({ attribute: 'active-id' }) activeId: string | null = null;
  /** `false` = pure paint: `pointer-events: none`, no tab stop, no role. Default-true, matching
   *  markdown's `sanitize` stance. */
  @property({ type: Boolean, reflect: true }) interactive = true;

  @state() private focusedId: string | null = null;
  @state() private flashingId: string | null = null;
  private flashTimer?: ReturnType<typeof setTimeout>;

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('items') && this.focusedId && !this.items.some((i) => i.id === this.focusedId)) {
      this.focusedId = null;
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.flashTimer);
  }

  /** Applies a one-shot emphasis flash to the item `id`. Reduced-motion is handled purely in CSS
   *  (`[data-flash]` + the media query) -- no separate JS branch needed here. */
  flash(id: string): void {
    clearTimeout(this.flashTimer);
    this.flashingId = id;
    this.flashTimer = setTimeout(() => {
      this.flashingId = null;
    }, FLASH_DURATION_MS);
  }

  private tabStopId(): string | null {
    if (this.items.length === 0) return null;
    if (this.focusedId && this.items.some((i) => i.id === this.focusedId)) return this.focusedId;
    if (this.activeId && this.items.some((i) => i.id === this.activeId)) return this.activeId;
    return this.items[0].id;
  }

  private onRectClick(id: string): void {
    this.emit<HighlightActivateDetail>('lyra-highlight-activate', { id });
  }

  private onRectFocus(id: string): void {
    this.focusedId = id;
  }

  private focusRect(id: string): void {
    (this.renderRoot.querySelector(`[part="rect"][data-id="${id}"]`) as HTMLElement | null)?.focus();
  }

  private onRectKeyDown(e: KeyboardEvent, index: number): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.onRectClick(this.items[index].id);
      return;
    }
    const rtl = this.effectiveDirection === 'rtl';
    const forward = e.key === 'ArrowDown' || (rtl ? e.key === 'ArrowLeft' : e.key === 'ArrowRight');
    const backward = e.key === 'ArrowUp' || (rtl ? e.key === 'ArrowRight' : e.key === 'ArrowLeft');
    let nextIndex: number | undefined;
    if (forward) nextIndex = Math.min(this.items.length - 1, index + 1);
    else if (backward) nextIndex = Math.max(0, index - 1);
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = this.items.length - 1;
    if (nextIndex === undefined || nextIndex === index) return;
    e.preventDefault();
    const nextId = this.items[nextIndex].id;
    this.focusedId = nextId;
    this.scheduleAfterUpdate(() => this.focusRect(nextId));
  }

  private rectLabel(item: HighlightLayerItem, index: number): string {
    return item.label
      ? this.localize('highlightWithLabel', undefined, { label: item.label })
      : this.localize('highlightOfTotal', undefined, { index: index + 1, total: this.items.length });
  }

  render(): TemplateResult | typeof nothing {
    if (this.items.length === 0) return nothing;
    const tabStop = this.tabStopId();
    return html`
      <div part="base" role="group" aria-label=${this.localize('highlightLayerLabel')}>
        ${this.items.map((item, index) => {
          const isActive = this.activeId === item.id;
          const isFlash = this.flashingId === item.id;
          // Rect coordinates are physical percent-of-box over content that never mirrors (a
          // rendered image/page), so position with physical left/top -- logical
          // inset-inline-start would flip the overlay under RTL while the content stays put.
          return item.rects.map(
            (rect) => html`
              <span
                part="rect"
                data-id=${item.id}
                data-tone=${item.tone ?? 'accent'}
                ?data-active=${isActive}
                ?data-flash=${isFlash}
                aria-current=${isActive ? 'true' : nothing}
                role=${this.interactive ? 'button' : nothing}
                tabindex=${this.interactive ? (tabStop === item.id ? '0' : '-1') : nothing}
                aria-label=${this.interactive ? this.rectLabel(item, index) : nothing}
                style="left:${rect.x}%; top:${rect.y}%; width:${rect.width}%; height:${rect.height}%"
                @click=${this.interactive ? () => this.onRectClick(item.id) : nothing}
                @focus=${this.interactive ? () => this.onRectFocus(item.id) : nothing}
                @keydown=${this.interactive ? (e: KeyboardEvent) => this.onRectKeyDown(e, index) : nothing}
              ></span>
            `,
          );
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-highlight-layer': LyraHighlightLayer;
  }
}

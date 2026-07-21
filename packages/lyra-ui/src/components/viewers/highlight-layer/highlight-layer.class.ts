import { html, nothing, type ComplexAttributeConverter, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraHighlightTone, HighlightActivateDetail } from '../document-viewer/anchors.js';
import { styles } from './highlight-layer.styles.js';

/** `true`-defaulting boolean attribute converter -- Lit's default presence-based `type: Boolean`
 *  can never be set back to `false` from a plain-HTML attribute once a property's own default is
 *  `true` (removing an attribute that was never present fires no `attributeChangedCallback`), so
 *  `fromAttribute` checks the literal string instead. Duplicated locally rather than imported,
 *  matching this exact converter's repeated per-component convention elsewhere in this library
 *  (see e.g. `<lr-attachment-chip>`'s own `trueDefaultBooleanConverter`). */
const trueDefaultBooleanConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute(value): boolean {
    return value !== 'false';
  },
  toAttribute(value): string | null {
    return value ? null : 'false';
  },
};

const FLASH_DURATION_MS = 1800; // mirrors --lr-transition-ambient's default duration

export interface HighlightLayerItem {
  id: string;
  /** Percent-of-box coordinates (the `region` anchor convention). One item may span multiple rects
   *  (a quote wrapping lines). */
  rects: { x: number; y: number; width: number; height: number }[];
  label?: string;
  tone?: LyraHighlightTone;
}

export interface LyraHighlightLayerEventMap {
  'lr-highlight-activate': CustomEvent<HighlightActivateDetail>;
}

/**
 * `<lr-highlight-layer>` — a presentational overlay that paints highlight rectangles
 * (percent-of-box coordinates) over positioned content and owns their activation, active/flash
 * styling, and keyboard access. `items` order is the caller's own reading order; the layer does not
 * re-sort geometrically. Fills its nearest positioned ancestor.
 *
 * @customElement lr-highlight-layer
 * @event lr-highlight-activate - A rect was activated (click, or Enter/Space while focused).
 *   `detail: { id }`.
 * @csspart base - The absolutely-positioned overlay (inset 0).
 * @csspart rect - One highlight rectangle (`data-tone`/`data-active`/`data-flash` state attributes).
 */
export class LyraHighlightLayer extends LyraElement<LyraHighlightLayerEventMap> {
  static override styles = [LyraElement.styles, styles];

  @property({ attribute: false }) items: HighlightLayerItem[] = [];
  @property({ attribute: 'active-id' }) activeId: string | null = null;
  /** `false` = pure paint: `pointer-events: none`, no tab stop, no role. Default-true, matching
   *  markdown's `sanitize` stance. */
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) interactive = true;

  @state() private focusedId: string | null = null;
  @state() private flashingId: string | null = null;
  private flashTimer?: ReturnType<typeof setTimeout>;

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('items') && this.focusedId && !this.items.some((i) => i.id === this.focusedId)) {
      this.focusedId = null;
    }
  }

  override disconnectedCallback(): void {
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
    this.emit<HighlightActivateDetail>('lr-highlight-activate', { id });
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

  override render(): TemplateResult | typeof nothing {
    if (this.items.length === 0) return nothing;
    const tabStop = this.tabStopId();
    const ariaLabel = this.getAttribute('aria-label') || this.localize('highlightLayerLabel');
    return html`
      <div part="base" role="group" aria-label=${ariaLabel}>
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
    'lr-highlight-layer': LyraHighlightLayer;
  }
}

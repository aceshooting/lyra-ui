import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraHighlightTone, HighlightActivateDetail } from '../document-viewer/anchors.js';
import { styles } from './highlight-layer.styles.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { maxPairedAnimationEndMs } from './highlight-layer-timing.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';

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
 * @csspart rect-target - Transparent activation geometry around a rectangle, with a minimum
 *   pointer/focus area independent of the caller-supplied visual coordinates.
 * @csspart highlight-actions - Non-overlapping actions used when more than one logical highlight
 *   would otherwise create ambiguous minimum hit areas.
 * @csspart highlight-action - One action in the non-overlapping highlight action list.
 * @cssprop --lr-highlight-layer-accent-background - Accent highlight background.
 * @cssprop --lr-highlight-layer-accent-outline - Accent highlight outline.
 * @cssprop --lr-highlight-layer-success-background - Success highlight background.
 * @cssprop --lr-highlight-layer-success-outline - Success highlight outline.
 * @cssprop --lr-highlight-layer-warning-background - Warning highlight background.
 * @cssprop --lr-highlight-layer-warning-outline - Warning highlight outline.
 * @cssprop --lr-highlight-layer-danger-background - Danger highlight background.
 * @cssprop --lr-highlight-layer-danger-outline - Danger highlight outline.
 * @cssprop --lr-highlight-layer-neutral-background - Neutral highlight background.
 * @cssprop --lr-highlight-layer-neutral-outline - Neutral highlight outline.
 * @cssprop --lr-highlight-layer-flash-background - Flash-state background.
 */
export class LyraHighlightLayer extends LyraElement<LyraHighlightLayerEventMap> {
  static override styles = [LyraElement.styles, styles];

  @property({ attribute: false }) items: HighlightLayerItem[] = [];
  @property({ attribute: 'active-id' }) activeId: string | null = null;
  /** `false` = pure paint: `pointer-events: none`, no tab stop, no role. Default-true, matching
   *  markdown's `sanitize` stance. */
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) interactive = true;

  @state() private focusedItem: HighlightLayerItem | null = null;
  @state() private flashingItem: HighlightLayerItem | null = null;
  private flashTimer?: ReturnType<typeof setTimeout>;
  private flashGeneration = 0;
  private pendingFocusItem: HighlightLayerItem | null = null;

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('items')) {
      if (this.focusedItem && !this.items.includes(this.focusedItem)) {
        const previousItems = changed.get('items') as HighlightLayerItem[] | undefined;
        const previousIndex = previousItems?.indexOf(this.focusedItem) ?? -1;
        const renderedIndexes = this.itemIndexesWithRects();
        const nextIndex = renderedIndexes.reduce<number | null>((nearest, index) => {
          if (nearest === null) return index;
          return Math.abs(index - previousIndex) < Math.abs(nearest - previousIndex) ? index : nearest;
        }, null);
        const nextItem = nextIndex === null ? null : this.items[nextIndex]!;
        const activeElement = this.shadowRoot?.activeElement as HTMLElement | null;
        const shouldTransferFocus = activeElement?.matches('[data-item-action]') ?? false;
        if (shouldTransferFocus && nextItem) {
          const previousTargetIndex = previousItems?.indexOf(nextItem) ?? -1;
          if (previousTargetIndex >= 0) this.primaryTarget(previousTargetIndex)?.focus();
          this.pendingFocusItem = nextItem;
        }
        this.focusedItem = nextItem;
      }
      if (changed.get('items') !== undefined) this.clearFlash();
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const pending = this.pendingFocusItem;
    this.pendingFocusItem = null;
    if (!pending) return;
    const index = this.items.indexOf(pending);
    if (index >= 0) this.focusRect(index);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.focusedItem = null;
    this.pendingFocusItem = null;
    this.clearFlash();
  }

  /** Applies a one-shot emphasis flash to the first item matching `id`. Its lifetime follows the
   *  rendered animation duration, including theme and reduced-motion overrides. */
  flash(id: string): void {
    this.clearFlash();
    const item = this.items.find((candidate) => candidate.id === id);
    if (!item) return;
    this.flashingItem = item;
    const generation = this.flashGeneration;
    void this.updateComplete.then(() => {
      if (generation !== this.flashGeneration || this.flashingItem !== item || !this.isConnected) return;
      const itemIndex = this.items.indexOf(item);
      const rect = this.primaryVisualRect(itemIndex);
      if (!rect) {
        this.flashingItem = null;
        return;
      }
      const computed = getComputedStyle(rect);
      const durationMs = maxPairedAnimationEndMs(
        computed.animationName,
        computed.animationDuration,
        computed.animationDelay,
      );
      this.flashTimer = setTimeout(() => {
        if (generation === this.flashGeneration) this.flashingItem = null;
      }, durationMs);
    });
  }

  private clearFlash(): void {
    clearTimeout(this.flashTimer);
    this.flashTimer = undefined;
    this.flashGeneration += 1;
    this.flashingItem = null;
  }

  private itemIndexesWithRects(): number[] {
    const indexes: number[] = [];
    this.items.forEach((item, index) => {
      if (item.rects.length > 0) indexes.push(index);
    });
    return indexes;
  }

  private tabStopIndex(): number | null {
    const renderedIndexes = this.itemIndexesWithRects();
    if (renderedIndexes.length === 0) return null;
    if (this.focusedItem) {
      const focusedIndex = this.items.indexOf(this.focusedItem);
      if (renderedIndexes.includes(focusedIndex)) return focusedIndex;
    }
    if (this.activeId) {
      const activeIndex = this.items.findIndex((item) => item.id === this.activeId && item.rects.length > 0);
      if (activeIndex >= 0) return activeIndex;
    }
    return renderedIndexes[0]!;
  }

  private onRectClick(id: string): void {
    this.emit<HighlightActivateDetail>('lr-highlight-activate', { id });
  }

  private onRectFocus(item: HighlightLayerItem): void {
    this.focusedItem = item;
  }

  private primaryTarget(itemIndex: number): HTMLElement | null {
    return (
      [...this.renderRoot.querySelectorAll<HTMLElement>('[data-item-action]')].find(
        (target) => target.dataset['itemIndex'] === String(itemIndex),
      ) ?? null
    );
  }

  private primaryVisualRect(itemIndex: number): HTMLElement | null {
    return (
      [...this.renderRoot.querySelectorAll<HTMLElement>('[part="rect"][data-primary]')].find(
        (rect) => rect.dataset['itemIndex'] === String(itemIndex),
      ) ?? null
    );
  }

  private focusRect(itemIndex: number): void {
    this.primaryTarget(itemIndex)?.focus();
  }

  private onRectKeyDown(e: KeyboardEvent, itemIndex: number): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.onRectClick(this.items[itemIndex]!.id);
      return;
    }
    const rtl = this.effectiveDirection === 'rtl';
    const forward = e.key === 'ArrowDown' || (rtl ? e.key === 'ArrowLeft' : e.key === 'ArrowRight');
    const backward = e.key === 'ArrowUp' || (rtl ? e.key === 'ArrowRight' : e.key === 'ArrowLeft');
    const renderedIndexes = this.itemIndexesWithRects();
    const position = renderedIndexes.indexOf(itemIndex);
    let nextIndex: number | undefined;
    if (forward) nextIndex = renderedIndexes[Math.min(renderedIndexes.length - 1, position + 1)];
    else if (backward) nextIndex = renderedIndexes[Math.max(0, position - 1)];
    else if (e.key === 'Home') nextIndex = renderedIndexes[0];
    else if (e.key === 'End') nextIndex = renderedIndexes.at(-1);
    if (nextIndex === undefined || nextIndex === itemIndex) return;
    e.preventDefault();
    this.focusedItem = this.items[nextIndex]!;
    this.scheduleAfterUpdate(() => this.focusRect(nextIndex));
  }

  private rectLabel(item: HighlightLayerItem, index: number): string {
    const numberFormat = getNumberFormat(this.effectiveLocale);
    return item.label
      ? this.localize('highlightWithLabel', undefined, { label: item.label })
      : this.localize('highlightOfTotal', undefined, {
          index: numberFormat.format(index + 1),
          total: numberFormat.format(this.items.length),
        });
  }

  override render(): TemplateResult | typeof nothing {
    if (this.items.length === 0) return nothing;
    const tabStop = this.tabStopIndex();
    const activeIndex = this.activeId
      ? this.items.findIndex((item) => item.id === this.activeId && item.rects.length > 0)
      : -1;
    const renderedIndexes = this.itemIndexesWithRects();
    const useActionList = this.interactive && renderedIndexes.length > 1;
    const ariaLabel = this.getAttribute('aria-label') || this.localize('highlightLayerLabel');
    return html`
      <div part="base" role="group" aria-label=${ariaLabel}>
        ${this.items.map((item, index) => {
          const isActive = activeIndex === index;
          const isFlash = this.flashingItem === item;
          // Rect coordinates are physical percent-of-box over content that never mirrors (a
          // rendered image/page), so position with physical left/top -- logical
          // inset-inline-start would flip the overlay under RTL while the content stays put.
          return item.rects.map((rect, rectIndex) => {
            const isPrimary = rectIndex === 0;
            return html`
              ${this.interactive
                ? !useActionList
                  ? html`
                    <span
                      part="rect-target"
                      data-id=${item.id}
                      data-item-index=${index}
                      ?data-primary=${isPrimary}
                      ?data-item-action=${isPrimary}
                      aria-current=${isPrimary ? String(isActive) : nothing}
                      aria-hidden=${!isPrimary ? 'true' : nothing}
                      role=${isPrimary ? 'button' : nothing}
                      tabindex=${isPrimary ? (tabStop === index ? '0' : '-1') : nothing}
                      aria-label=${isPrimary ? this.rectLabel(item, index) : nothing}
                      style="left:calc(${rect.x}% + ${rect.width / 2}%);
                        top:calc(${rect.y}% + ${rect.height / 2}%);
                        width:max(${rect.width}%, var(--lr-icon-button-size));
                        height:max(${rect.height}%, var(--lr-icon-button-size))"
                      @click=${() => this.onRectClick(item.id)}
                      @focus=${isPrimary ? () => this.onRectFocus(item) : nothing}
                      @keydown=${isPrimary ? (e: KeyboardEvent) => this.onRectKeyDown(e, index) : nothing}
                    ></span>
                  `
                  : nothing
                : nothing}
              <span
                part="rect"
                data-id=${item.id}
                data-item-index=${index}
                ?data-primary=${isPrimary}
                data-tone=${item.tone ?? 'accent'}
                ?data-active=${isActive}
                ?data-flash=${isFlash}
                aria-hidden="true"
                style="left:${rect.x}%; top:${rect.y}%; width:${rect.width}%; height:${rect.height}%"
              ></span>
            `;
          });
        })}
        ${useActionList
          ? html`
              <div part="highlight-actions">
                ${renderedIndexes.map((index) => {
                  const item = this.items[index]!;
                  const label = this.rectLabel(item, index);
                  return html`
                    <button
                      part="highlight-action"
                      type="button"
                      data-id=${item.id}
                      data-item-index=${index}
                      data-item-action
                      aria-current=${String(activeIndex === index)}
                      tabindex=${tabStop === index ? '0' : '-1'}
                      aria-label=${label}
                      @click=${() => this.onRectClick(item.id)}
                      @focus=${() => this.onRectFocus(item)}
                      @keydown=${(e: KeyboardEvent) => this.onRectKeyDown(e, index)}
                    >
                      ${label}
                    </button>
                  `;
                })}
              </div>
            `
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-highlight-layer': LyraHighlightLayer;
  }
}

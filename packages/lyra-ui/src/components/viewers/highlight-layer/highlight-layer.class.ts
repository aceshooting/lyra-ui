import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraHighlightTone, HighlightActivateDetail } from '../document-viewer/anchors.js';
import { styles } from './highlight-layer.styles.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { maxPairedAnimationEndMs } from './highlight-layer-timing.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { sanitizePercentRect, type SafePercentRect } from '../../../internal/safe-css.js';
import { activeElementIn } from '../../../internal/active-element.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_highlightLayerLabel, LYRA_DEFAULT_highlightOfTotal, LYRA_DEFAULT_highlightWithLabel, LYRA_DEFAULT_items, LYRA_DEFAULT_open } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface HighlightLayerItem {
  id: string;
  /** Finite percent-of-box coordinates (the `region` anchor convention). One item may span
   * multiple rects (a quote wrapping lines); invalid coordinates and negative sizes are omitted. */
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
 * @status stable
 * @since 4.0.0
 */
export class LyraHighlightLayer extends LyraElement<LyraHighlightLayerEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    highlightLayerLabel: LYRA_DEFAULT_highlightLayerLabel,
    highlightOfTotal: LYRA_DEFAULT_highlightOfTotal,
    highlightWithLabel: LYRA_DEFAULT_highlightWithLabel,
    items: LYRA_DEFAULT_items,
    open: LYRA_DEFAULT_open,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  @property({ attribute: false }) items: HighlightLayerItem[] = [];
  @property({ attribute: 'active-id' }) activeId: string | null = null;
  /** `false` = pure paint: `pointer-events: none`, no tab stop, no role. Default-true, matching
   *  markdown's `sanitize` stance. */
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) interactive = true;

  @state() private focusedItem: HighlightLayerItem | null = null;
  @state() private flashingItem: HighlightLayerItem | null = null;
  private flashTimer?: number;
  private flashTimerWindow?: Window;
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
        const activeElement = activeElementIn(this.shadowRoot) as HTMLElement | null;
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

  adoptedCallback(): void {
    this.clearFlash();
  }

  /** Applies a one-shot emphasis flash to the first item matching `id`. Its lifetime follows the
   *  rendered animation duration, including theme and reduced-motion overrides. */
  flash(id: string): void {
    this.clearFlash();
    if (!this.isConnected) return;
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
      const ownerWindow = rect.ownerDocument.defaultView;
      if (!ownerWindow) {
        this.flashingItem = null;
        return;
      }
      const computed = ownerWindow.getComputedStyle(rect);
      const durationMs = maxPairedAnimationEndMs(
        computed.animationName,
        computed.animationDuration,
        computed.animationDelay,
      );
      this.flashTimerWindow = ownerWindow;
      this.flashTimer = ownerWindow.setTimeout(() => {
        if (generation !== this.flashGeneration || this.flashTimerWindow !== ownerWindow) return;
        this.flashTimer = undefined;
        this.flashTimerWindow = undefined;
        this.flashingItem = null;
      }, durationMs);
    });
  }

  private clearFlash(): void {
    if (this.flashTimer !== undefined) this.flashTimerWindow?.clearTimeout(this.flashTimer);
    this.flashTimer = undefined;
    this.flashTimerWindow = undefined;
    this.flashGeneration += 1;
    this.flashingItem = null;
  }

  private safeRects(item: HighlightLayerItem): SafePercentRect[] {
    return item.rects
      .map(sanitizePercentRect)
      .filter((rect): rect is SafePercentRect => rect !== undefined);
  }

  private itemIndexesWithRects(): number[] {
    const indexes: number[] = [];
    this.items.forEach((item, index) => {
      if (this.safeRects(item).length > 0) indexes.push(index);
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
      const activeIndex = this.items.findIndex(
        (item) => item.id === this.activeId && this.safeRects(item).length > 0,
      );
      if (activeIndex >= 0) return activeIndex;
    }
    return renderedIndexes[0]!;
  }

  private onRectClick(id: string): void {
    this.emit('lr-highlight-activate', { id });
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

  private rectLabel(item: HighlightLayerItem, index: number, total: number): string {
    const numberFormat = getNumberFormat(this.effectiveLocale);
    return item.label
      ? this.localize('highlightWithLabel', undefined, { label: item.label })
      : this.localize('highlightOfTotal', undefined, {
          index: numberFormat.format(index + 1),
          total: numberFormat.format(total),
        });
  }

  override render(): TemplateResult | typeof nothing {
    if (this.items.length === 0) return nothing;
    const tabStop = this.tabStopIndex();
    const activeIndex = this.activeId
      ? this.items.findIndex(
          (item) => item.id === this.activeId && this.safeRects(item).length > 0,
        )
      : -1;
    const renderedIndexes = this.itemIndexesWithRects();
    const renderedPosition = new Map(renderedIndexes.map((itemIndex, position) => [itemIndex, position]));
    const useActionList = this.interactive && renderedIndexes.length > 1;
    const ariaLabel = hostAriaLabel(this) ?? this.localize('highlightLayerLabel');
    return html`
      <div part="base" role="group" aria-label=${ariaLabel}>
        ${this.items.map((item, index) => {
          const isActive = activeIndex === index;
          const isFlash = this.flashingItem === item;
          // Rect coordinates are physical percent-of-box over content that never mirrors (a
          // rendered image/page), so position with physical left/top -- logical
          // inset-inline-start would flip the overlay under RTL while the content stays put.
          return this.safeRects(item).map((rect, rectIndex) => {
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
                      aria-label=${isPrimary
                        ? this.rectLabel(item, renderedPosition.get(index) ?? 0, renderedIndexes.length)
                        : nothing}
                      style=${styleMap({
                        left: `calc(${rect.x}% + ${rect.width / 2}%)`,
                        top: `calc(${rect.y}% + ${rect.height / 2}%)`,
                        width: `max(${rect.width}%, var(--lr-icon-button-size))`,
                        height: `max(${rect.height}%, var(--lr-icon-button-size))`,
                      })}
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
                style=${styleMap({
                  left: `${rect.x}%`,
                  top: `${rect.y}%`,
                  width: `${rect.width}%`,
                  height: `${rect.height}%`,
                })}
              ></span>
            `;
          });
        })}
        ${useActionList
          ? html`
              <div part="highlight-actions">
                ${renderedIndexes.map((index) => {
                  const item = this.items[index]!;
                  const label = this.rectLabel(item, renderedPosition.get(index) ?? 0, renderedIndexes.length);
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

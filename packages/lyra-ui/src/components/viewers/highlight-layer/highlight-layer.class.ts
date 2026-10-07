import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraHighlightTone, HighlightActivateDetail } from '../document-viewer/anchors.js';
import { styles } from './highlight-layer.styles.js';
import { maxPairedAnimationEndMs } from './highlight-layer-timing.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { sanitizePercentRect, type SafePercentRect } from '../../../internal/safe-css.js';
import { activeElementIn } from '../../../internal/active-element.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { resolveCssTokenLength } from '../../../internal/css-token-length.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_highlightLayerLabel, LYRA_DEFAULT_highlightOfTotal, LYRA_DEFAULT_highlightWithLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface HighlightLayerItem {
  readonly id: string;
  /** Finite percent-of-box coordinates (the `region` anchor convention). One item may span
   * multiple rects (a quote wrapping lines); invalid coordinates and negative sizes are omitted. */
  readonly rects: readonly Readonly<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>[];
  readonly label?: string;
  readonly tone?: LyraHighlightTone;
}

function snapshotItems(value: unknown): readonly HighlightLayerItem[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  const output: HighlightLayerItem[] = [];
  const seenIds = new Set<string>();
  const length = Math.min(value.length, 10_000);
  for (let index = 0; index < length; index += 1) {
    try {
      const candidate: unknown = value[index];
      if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
      const rawId = (candidate as { id?: unknown }).id;
      if (typeof rawId !== 'string') continue;
      const id = rawId.trim();
      if (id.length === 0 || seenIds.has(id)) continue;
      if (!Array.isArray((candidate as { rects?: unknown }).rects)) continue;
      seenIds.add(id);
      output.push(rawId === id ? candidate as HighlightLayerItem : { ...candidate, id } as HighlightLayerItem);
    } catch {
      // A malformed record must not prevent later valid highlights from rendering.
    }
  }
  return Object.freeze(output);
}

export interface LyraHighlightLayerEventMap {
  'lr-highlight-activate': CustomEvent<HighlightActivateDetail>;
}

/**
 * `<lr-highlight-layer>` — a presentational overlay that paints highlight rectangles
 * (percent-of-box coordinates) over positioned content and owns their activation, active/flash
 * styling, and keyboard access. `items` order is the caller's own reading order; the layer does not
 * re-sort geometrically. Fills its nearest positioned ancestor. With `without-interaction`, the
 * overlay remains pure paint (`aria-hidden`, no group owner or controls). If no item has a valid
 * rectangle, the component renders no subtree at all.
 *
 * @customElement lr-highlight-layer
 * @event lr-highlight-activate - A rect was activated (click, or Enter/Space while focused).
 *   `detail: { highlightId }`.
 * @csspart base - The absolutely-positioned overlay (inset 0).
 * @csspart rect - One highlight rectangle (`data-tone`/`data-active`/`data-flash` state attributes).
 * @csspart rect-target - Transparent activation geometry around a rectangle, with a minimum
 *   pointer/focus area independent of the caller-supplied visual coordinates.
 * @csspart highlight-actions - Non-overlapping actions used instead of in-place targets when the
 *   minimum hit areas of different highlights would overlap; at most half the box tall, scrolling.
 * @csspart highlight-action - One action in the non-overlapping highlight action list.
 * @cssprop --lr-highlight-layer-accent-bg - Accent highlight background.
 * @cssprop --lr-highlight-layer-accent-outline - Accent highlight outline.
 * @cssprop --lr-highlight-layer-success-bg - Success highlight background.
 * @cssprop --lr-highlight-layer-success-outline - Success highlight outline.
 * @cssprop --lr-highlight-layer-warning-bg - Warning highlight background.
 * @cssprop --lr-highlight-layer-warning-outline - Warning highlight outline.
 * @cssprop --lr-highlight-layer-danger-bg - Danger highlight background.
 * @cssprop --lr-highlight-layer-danger-outline - Danger highlight outline.
 * @cssprop --lr-highlight-layer-neutral-bg - Neutral highlight background.
 * @cssprop --lr-highlight-layer-neutral-outline - Neutral highlight outline.
 * @cssprop --lr-highlight-layer-flash-bg - Flash-state background.
 * @status stable
 * @since 4.0.0
 */
export class LyraHighlightLayer extends LyraElement<LyraHighlightLayerEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    highlightLayerLabel: LYRA_DEFAULT_highlightLayerLabel,
    highlightOfTotal: LYRA_DEFAULT_highlightOfTotal,
    highlightWithLabel: LYRA_DEFAULT_highlightWithLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'items',
  ]);

  static override styles = [LyraElement.styles, styles];


  private _items: readonly HighlightLayerItem[] = Object.freeze([]);
  /** Highlight records in caller reading order. IDs are trimmed and must be nonempty; the first
   * record for an ID is retained and blank or later duplicate records are ignored. */
  @property({ attribute: false })
  get items(): readonly HighlightLayerItem[] { return this._items; }
  set items(value: readonly HighlightLayerItem[]) {
    const previous = this._items;
    this._items = snapshotItems(value);
    this.requestUpdate('items', previous);
  }
  /** Domain identity of the currently active highlight. */
  @property({ attribute: 'active-highlight-id' }) activeHighlightId: string | null = null;
  /** Pure paint: `pointer-events: none`, no tab stop, no role. By default the rectangles are
   *  interactive, matching markdown's `sanitize` stance. */
  @property({ type: Boolean, attribute: 'without-interaction', reflect: true })
  withoutInteraction = false;
  // Ids, not item objects: every assignment is re-snapshotted, so object identity never survives.
  @state() private focusedId: string | null = null;
  @state() private flashingId: string | null = null;
  /** The latest observed box; a resize re-measures the overlap of minimum hit areas. */
  @state() private boxSize?: DOMRectReadOnly;
  private actionList = false;
  private sizeObserver?: ResizeObserver;
  private flashTimer?: number;
  private flashTimerWindow?: Window;
  private flashGeneration = 0;
  private pendingFocusId: string | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    const Observer = this.ownerDocument.defaultView?.ResizeObserver;
    this.sizeObserver = Observer
      ? new Observer((entries) => {
          this.boxSize = entries.at(-1)?.contentRect ?? this.boxSize;
        })
      : undefined;
    this.sizeObserver?.observe(this);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const refocus = this.hasFocusedAction();
    if (changed.has('items')) {
      const positionOf = (items: readonly HighlightLayerItem[] | undefined, id: string | null): number =>
        items?.findIndex((item) => item.id === id) ?? -1;
      const previousItems = changed.get('items') as readonly HighlightLayerItem[] | undefined;
      if (this.focusedId !== null && positionOf(this.items, this.focusedId) < 0) {
        const previousIndex = positionOf(previousItems, this.focusedId);
        const renderedIndexes = this.itemIndexesWithRects(
          this.items.map((item) => this.safeRects(item)),
        );
        const nextIndex = renderedIndexes.reduce<number | null>((nearest, index) => {
          if (nearest === null) return index;
          return Math.abs(index - previousIndex) < Math.abs(nearest - previousIndex) ? index : nearest;
        }, null);
        this.focusedId = nextIndex === null ? null : this.items[nextIndex]!.id;
        const previousTargetIndex = positionOf(previousItems, this.focusedId);
        if (refocus && previousTargetIndex >= 0) this.primaryTarget(previousTargetIndex)?.focus();
      }
      if (changed.get('items') !== undefined) this.clearFlash();
    }
    if (changed.has('items') || changed.has('boxSize') || changed.has('withoutInteraction')) {
      this.actionList = !this.withoutInteraction && this.hitAreasOverlap();
      // Targets are reused by position or swapped for actions, so focus follows the focused id.
      if (refocus) this.pendingFocusId = this.focusedId;
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const pending = this.pendingFocusId;
    this.pendingFocusId = null;
    if (pending === null) return;
    const index = this.items.findIndex((item) => item.id === pending);
    if (index >= 0) this.focusRect(index);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.sizeObserver?.disconnect();
    this.focusedId = null;
    this.pendingFocusId = null;
    this.clearFlash();
  }

  private hasFocusedAction(): boolean {
    return (activeElementIn(this.shadowRoot) as HTMLElement | null)?.matches('[data-item-action]') ?? false;
  }

  /** Whether the minimum-size hit areas (as `[part="rect-target"]` sizes them) of different
   *  highlights intersect. */
  private hitAreasOverlap(): boolean {
    const view = this.ownerDocument.defaultView;
    if (!view) return false;
    const { width, height } = this.boxSize ?? this.getBoundingClientRect();
    const min = resolveCssTokenLength(
      view.getComputedStyle(this).getPropertyValue('--lr-icon-button-size').trim(),
      { host: this },
    ) ?? 0;
    const boxes = this.items
      .flatMap((item, index) => this.safeRects(item).map((rect) => {
        const boxWidth = Math.max((rect.width / 100) * width, min);
        const boxHeight = Math.max((rect.height / 100) * height, min);
        const left = ((rect.x + rect.width / 2) / 100) * width - boxWidth / 2;
        const top = ((rect.y + rect.height / 2) / 100) * height - boxHeight / 2;
        return { index, left, top, right: left + boxWidth, bottom: top + boxHeight };
      }))
      .sort((first, second) => first.left - second.left);
    for (let first = 0; first < boxes.length; first++) {
      const a = boxes[first]!;
      for (let second = first + 1; second < boxes.length && boxes[second]!.left < a.right; second++) {
        const b = boxes[second]!;
        if (b.index !== a.index && b.top < a.bottom && a.top < b.bottom) return true;
      }
    }
    return false;
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.clearFlash();
  }

  /** Applies a one-shot emphasis flash to the first item matching `id`. Its lifetime follows the
   *  rendered animation duration, including theme and reduced-motion overrides. */
  flash(id: string): void {
    this.clearFlash();
    if (!this.isConnected) return;
    if (!this.items.some((candidate) => candidate.id === id)) return;
    this.flashingId = id;
    const generation = this.flashGeneration;
    void this.updateComplete.then(() => {
      if (generation !== this.flashGeneration || this.flashingId !== id || !this.isConnected) return;
      const rect = this.primaryVisualRect(this.items.findIndex((candidate) => candidate.id === id));
      if (!rect) {
        this.flashingId = null;
        return;
      }
      const ownerWindow = rect.ownerDocument.defaultView;
      if (!ownerWindow) {
        this.flashingId = null;
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
        this.flashingId = null;
      }, durationMs);
    });
  }

  private clearFlash(): void {
    if (this.flashTimer !== undefined) this.flashTimerWindow?.clearTimeout(this.flashTimer);
    this.flashTimer = undefined;
    this.flashTimerWindow = undefined;
    this.flashGeneration += 1;
    this.flashingId = null;
  }

  private safeRects(item: HighlightLayerItem): SafePercentRect[] {
    return item.rects
      .map(sanitizePercentRect)
      .filter((rect): rect is SafePercentRect => rect !== undefined);
  }

  private itemIndexesWithRects(rectsByItem: readonly SafePercentRect[][]): number[] {
    const indexes: number[] = [];
    rectsByItem.forEach((rects, index) => {
      if (rects.length > 0) indexes.push(index);
    });
    return indexes;
  }

  private tabStopIndex(rectsByItem: readonly SafePercentRect[][]): number | null {
    const renderedIndexes = this.itemIndexesWithRects(rectsByItem);
    if (renderedIndexes.length === 0) return null;
    if (this.focusedId !== null) {
      const focusedIndex = this.items.findIndex((item) => item.id === this.focusedId);
      if (renderedIndexes.includes(focusedIndex)) return focusedIndex;
    }
    if (this.activeHighlightId) {
      const activeIndex = this.items.findIndex(
        (item, index) => item.id === this.activeHighlightId && rectsByItem[index]!.length > 0,
      );
      if (activeIndex >= 0) return activeIndex;
    }
    return renderedIndexes[0]!;
  }

  private onRectClick(id: string): void {
    this.emit('lr-highlight-activate', { highlightId: id });
  }

  private onRectFocus(item: HighlightLayerItem): void {
    this.focusedId = item.id;
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
    const renderedIndexes = this.itemIndexesWithRects(
      this.items.map((item) => this.safeRects(item)),
    );
    const position = renderedIndexes.indexOf(itemIndex);
    let nextIndex: number | undefined;
    if (forward) nextIndex = renderedIndexes[Math.min(renderedIndexes.length - 1, position + 1)];
    else if (backward) nextIndex = renderedIndexes[Math.max(0, position - 1)];
    else if (e.key === 'Home') nextIndex = renderedIndexes[0];
    else if (e.key === 'End') nextIndex = renderedIndexes.at(-1);
    if (nextIndex === undefined || nextIndex === itemIndex) return;
    e.preventDefault();
    this.focusedId = this.items[nextIndex]!.id;
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
    const rectsByItem = this.items.map((item) => this.safeRects(item));
    const renderedIndexes = this.itemIndexesWithRects(rectsByItem);
    if (renderedIndexes.length === 0) return nothing;
    const tabStop = this.tabStopIndex(rectsByItem);
    const activeIndex = this.activeHighlightId
      ? this.items.findIndex(
          (item, index) => item.id === this.activeHighlightId && rectsByItem[index]!.length > 0,
        )
      : -1;
    const renderedPosition = new Map(renderedIndexes.map((itemIndex, position) => [itemIndex, position]));
    const interactive = !this.withoutInteraction;
    const useActionList = interactive && this.actionList;
    const ariaLabel = interactive
      ? hostAriaLabel(this) ?? this.localize('highlightLayerLabel')
      : undefined;
    return html`
      <div
        part="base"
        role=${interactive ? 'group' : nothing}
        aria-label=${ariaLabel ?? nothing}
        aria-hidden=${!interactive ? 'true' : nothing}
      >
        ${this.items.map((item, index) => {
          const isActive = activeIndex === index;
          const isFlash = this.flashingId === item.id;
          // Rect coordinates are physical percent-of-box over content that never mirrors (a
          // rendered image/page), so position with physical left/top -- logical
          // inset-inline-start would flip the overlay under RTL while the content stays put.
          return rectsByItem[index]!.map((rect, rectIndex) => {
            const isPrimary = rectIndex === 0;
            return html`
              ${interactive
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

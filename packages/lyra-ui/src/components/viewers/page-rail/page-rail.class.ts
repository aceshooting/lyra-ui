import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { ref } from 'lit/directives/ref.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteCount, finiteInteger, finiteRange } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import type { LyraHighlight, LyraHighlightTone } from '../document-viewer/anchors.js';
import { styles } from './page-rail.styles.js';

const DIGIT_BUFFER_MS = 500;
const MAX_PAGE_COUNT = 100_000;
const DEFAULT_ALLOCATION_WIDTH = 320;

/** What `<lr-page-rail>` needs from a wired viewer -- a page-addressed viewer satisfies this
 *  structurally: a live `page` property plus `renderPageThumbnail()`, and the
 *  `lr-load`/`lr-page-change` events every anchor-target page-shaped viewer already emits. */
export interface PageThumbnailSource extends EventTarget {
  page: number;
  renderPageThumbnail(page: number, canvas: HTMLCanvasElement, options?: { width?: number }): Promise<boolean>;
}

export interface LyraPageRailEventMap {
  'lr-page-select': CustomEvent<{ page: number }>;
}

type ThumbnailState = 'pending' | 'ready' | 'unavailable';

/**
 * `<lr-page-rail>` — a virtualized vertical thumbnail rail for page-addressed documents, with
 * per-page highlight heat markers. Two modes: **wired** (`viewer`/`for` supply a live
 * `PageThumbnailSource`, e.g. `lr-pdf-viewer` -- thumbnails render lazily as rows materialize, and
 * the rail tracks page/count from the viewer's own events) and **mediated** (`page-count`/`page` are
 * host-bound directly, rows render a placeholder glyph -- still a fully functional pager). In wired
 * mode the viewer's `page` is the single source of truth.
 *
 * @customElement lr-page-rail
 * @event lr-page-select - A page row was activated (click, or Enter/Space on a focused row).
 *   `detail: { page }`. In wired mode the rail also sets `viewer.page` itself.
 * @csspart base - The rail.
 * @csspart pages - The embedded `lr-virtual-list`.
 * @csspart page - One page button.
 * @csspart page-current - The page button for the current `page` (also carries `page`).
 * @csspart thumbnail - The thumbnail canvas wrapper.
 * @csspart page-number - The visible page number.
 * @csspart heat - The heat-marker cluster.
 * @csspart heat-dot - One tone-colored heat marker (or the `+n` overflow marker).
 * @csspart heat-dot-accent - An accent-tone heat marker (also carries `heat-dot`).
 * @csspart heat-dot-success - A success-tone heat marker (also carries `heat-dot`).
 * @csspart heat-dot-warning - A warning-tone heat marker (also carries `heat-dot`).
 * @csspart heat-dot-danger - A danger-tone heat marker (also carries `heat-dot`).
 * @csspart heat-dot-neutral - A neutral-tone heat marker (also carries `heat-dot`).
 * @csspart heat-dot-overflow - The `+n` overflow marker (also carries `heat-dot`).
 * @cssprop [--lr-page-rail-height=var(--lr-size-24rem)] - Block size of the virtualized rail.
 * @cssprop [--lr-page-rail-current-bg=var(--lr-color-brand-quiet)] - Background of the
 *   `[part="page-current"]` button for the current `page`.
 */
export class LyraPageRail extends LyraElement<LyraPageRailEventMap> {
  static override styles = [LyraElement.styles, styles];

  @property({ attribute: false }) viewer: PageThumbnailSource | null = null;
  /** Id of a `PageThumbnailSource` in the same root, the label/`htmlFor`-style alternative to
   *  `viewer`. */
  @property() for = '';
  /** Mediated-mode page count. Ignored while a viewer is wired (`viewer` or a resolved `for`). */
  @property({ type: Number, attribute: 'page-count' }) pageCount = 0;
  /** Current page: auto-tracked in wired mode, host-bound in mediated mode. */
  @property({ type: Number, reflect: true }) page = 1;
  @property({ attribute: false }) highlights: LyraHighlight[] = [];
  /** Thumbnail CSS-px width, clamped to the container (320px-safe). */
  @property({ type: Number, attribute: 'thumb-width' }) thumbWidth = 96;
  /** Overrides the computed accessible name. */
  @property() label = '';

  @state() private resolvedPageCount = 0;
  @state() private thumbnailStates = new Map<number, ThumbnailState>();
  @state() private allocationWidth = DEFAULT_ALLOCATION_WIDTH;

  private readonly canvasRefs = new Map<number, (el: Element | undefined) => void>();
  private readonly canvases = new Map<number, HTMLCanvasElement>();
  private boundViewer: PageThumbnailSource | null = null;
  private digitBuffer = '';
  private digitTimer?: ReturnType<typeof setTimeout>;
  private thumbnailGeneration = 0;
  private resizeObserver?: ResizeObserver;
  private targetObserver?: MutationObserver;

  private readonly onViewerLoad = (e: Event): void => {
    this.resolvedPageCount = finiteCount(
      (e as CustomEvent<{ pageCount: number }>).detail?.pageCount ?? 0,
      0,
      MAX_PAGE_COUNT,
    );
    // `lr-load` describes a fresh document even when the source object and page count are unchanged.
    // Replace each canvas so older peer work can finish only into detached render targets.
    this.invalidateThumbnails();
  };

  private readonly onViewerPageChange = (e: Event): void => {
    this.page = (e as CustomEvent<{ page: number }>).detail.page;
  };

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.hasUpdated || changed.has('viewer') || changed.has('for')) {
      this.resolveViewer();
      this.observeForTarget();
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver((entries) => {
        const width = finiteRange(
          entries.at(-1)?.contentRect.width ?? DEFAULT_ALLOCATION_WIDTH,
          DEFAULT_ALLOCATION_WIDTH,
          0,
        );
        if (width === this.allocationWidth) return;
        this.allocationWidth = width;
        this.invalidateThumbnails();
      });
      this.resizeObserver.observe(this);
    }
    this.observeForTarget();
    // disconnectedCallback unbinds the wired viewer on every disconnect, but willUpdate only
    // rebinds on the first update or when `viewer`/`for` themselves change -- a bare reconnect
    // (e.g. a reparent) schedules no update and changes neither property, so rebind here or the
    // rail stays permanently unbound (page tracking stops; wired mode renders an empty rail).
    if (this.hasUpdated) this.resolveViewer();
  }

  override disconnectedCallback(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.targetObserver?.disconnect();
    this.targetObserver = undefined;
    this.unbindViewer();
    this.thumbnailGeneration++;
    clearTimeout(this.digitTimer);
    super.disconnectedCallback();
  }

  private resolveViewer(): void {
    const next = this.viewer ?? this.lookupFor();
    if (next === this.boundViewer) return;
    this.unbindViewer();
    this.resolvedPageCount = 0;
    this.invalidateThumbnails();
    this.boundViewer = next;
    if (!next) return;
    this.page = next.page || this.page;
    next.addEventListener('lr-load', this.onViewerLoad);
    next.addEventListener('lr-page-change', this.onViewerPageChange);
  }

  private observeForTarget(): void {
    this.targetObserver?.disconnect();
    this.targetObserver = undefined;
    if (!this.isConnected || !this.for || typeof MutationObserver === 'undefined') return;
    this.targetObserver = new MutationObserver(() => this.resolveViewer());
    this.targetObserver.observe(this.getRootNode(), {
      attributes: true,
      attributeFilter: ['id'],
      childList: true,
      subtree: true,
    });
  }

  private unbindViewer(): void {
    this.boundViewer?.removeEventListener('lr-load', this.onViewerLoad);
    this.boundViewer?.removeEventListener('lr-page-change', this.onViewerPageChange);
    this.boundViewer = null;
  }

  private lookupFor(): PageThumbnailSource | null {
    if (!this.for) return null;
    const root = this.getRootNode() as Document | ShadowRoot;
    return (root.getElementById?.(this.for) as unknown as PageThumbnailSource | null) ?? null;
  }

  /** `pageCount` normalized to a finite, non-negative integer before `effectivePageCount()`'s
   *  mediated-mode fallback -- an invalid attribute value would otherwise reach `render()`'s
   *  `Array.from({ length: count }, ...)` (a negative/NaN length throws) and every page-bounds
   *  check derived from it. */
  private get safePageCount(): number {
    return finiteCount(this.pageCount, 0, MAX_PAGE_COUNT);
  }

  /** `page` normalized to a finite integer clamped into `[1, effectivePageCount()]` (or held at the
   *  `1` default while no page count is known yet) -- guards `renderPageItem()`'s `aria-current`
   *  comparison and the `lr-virtual-list` `active-id` binding from an out-of-range/NaN value, e.g.
   *  a consumer setting a stale mediated-mode `page` before also updating `page-count`. */
  private get safePage(): number {
    const count = this.effectivePageCount();
    return finiteInteger(this.page, 1, 1, Math.max(1, count));
  }

  /** `thumbWidth` normalized to a finite, non-negative CSS px width before it reaches
   *  `renderPageThumbnail()`'s `{ width }` option -- an invalid attribute value would otherwise ask
   *  a wired viewer to rasterize a `NaN`/negative-width thumbnail. */
  private get safeThumbWidth(): number {
    return Math.min(
      finiteRange(this.thumbWidth, 96, 0),
      finiteRange(this.allocationWidth, DEFAULT_ALLOCATION_WIDTH, 0),
    );
  }

  private effectivePageCount(): number {
    return this.boundViewer ? this.resolvedPageCount : this.safePageCount;
  }

  private canvasRef(pageNumber: number): (el: Element | undefined) => void {
    let cb = this.canvasRefs.get(pageNumber);
    if (!cb) {
      cb = (el) => {
        if (!el) {
          this.canvases.delete(pageNumber);
          return;
        }
        this.canvases.set(pageNumber, el as HTMLCanvasElement);
        void this.loadThumbnail(pageNumber, el as HTMLCanvasElement);
      };
      this.canvasRefs.set(pageNumber, cb);
    }
    return cb;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('thumbWidth') && changed.get('thumbWidth') !== undefined) this.invalidateThumbnails();
  }

  private invalidateThumbnails(): void {
    this.thumbnailGeneration++;
    this.thumbnailStates = new Map();
  }

  private async loadThumbnail(pageNumber: number, canvas: HTMLCanvasElement): Promise<void> {
    const viewer = this.boundViewer;
    if (!viewer) return;
    const generation = this.thumbnailGeneration;
    const width = this.safeThumbWidth;
    const pending = new Map(this.thumbnailStates);
    pending.set(pageNumber, 'pending');
    this.thumbnailStates = pending;
    let ok: boolean;
    try {
      ok = await viewer.renderPageThumbnail(pageNumber, canvas, { width });
    } catch {
      // A rejected renderPageThumbnail() (decode error, detached canvas, resource exhaustion, ...)
      // is otherwise an unhandled rejection that leaves this page's skeleton spinning forever --
      // treat it the same as the documented `resolves(false)` case, falling back to the file-icon
      // placeholder instead.
      ok = false;
    }
    if (
      generation !== this.thumbnailGeneration ||
      viewer !== this.boundViewer ||
      width !== this.safeThumbWidth ||
      this.canvases.get(pageNumber) !== canvas
    ) return;
    const settled = new Map(this.thumbnailStates);
    settled.set(pageNumber, ok ? 'ready' : 'unavailable');
    this.thumbnailStates = settled;
  }

  private pageHighlightSummary(pageNumber: number): { count: number; tones: LyraHighlightTone[] } {
    const tones: LyraHighlightTone[] = [];
    for (const highlight of this.highlights) {
      const anchor = highlight.anchor;
      const anchorPage =
        anchor.kind === 'page' ? anchor.page : anchor.kind === 'text-quote' || anchor.kind === 'region' ? anchor.page : undefined;
      if (anchorPage === pageNumber) tones.push(highlight.tone ?? 'accent');
    }
    return { count: tones.length, tones };
  }

  private onPageActivate(pageNumber: number): void {
    if (this.boundViewer) this.boundViewer.page = pageNumber;
    this.emit<{ page: number }>('lr-page-select', { page: pageNumber });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!/^[0-9]$/.test(e.key)) return;
    this.digitBuffer += e.key;
    clearTimeout(this.digitTimer);
    this.digitTimer = setTimeout(() => {
      this.digitBuffer = '';
    }, DIGIT_BUFFER_MS);
    const target = Number(this.digitBuffer);
    const count = this.effectivePageCount();
    if (target >= 1 && target <= count) {
      if (this.boundViewer) this.onPageActivate(target);
      else this.page = target;
    }
  };

  private renderPageItem = (pageNumber: unknown): TemplateResult => {
    const number = pageNumber as number;
    const numberFormat = getNumberFormat(this.effectiveLocale);
    const { count, tones } = this.pageHighlightSummary(number);
    const thumbState = this.thumbnailStates.get(number);
    const name =
      count === 0
        ? this.localize('pageRailPage', undefined, { page: numberFormat.format(number) })
        : this.localize(count === 1 ? 'pageRailPageHighlighted' : 'pageRailPageHighlightedPlural', undefined, {
            page: numberFormat.format(number),
            count: numberFormat.format(count),
          });
    const shownTones = tones.slice(0, 3);
    const overflow = tones.length - shownTones.length;
    const isCurrent = this.safePage === number;
    return html`
      <button
        part=${isCurrent ? 'page page-current' : 'page'}
        type="button"
        aria-label=${name}
        aria-current=${isCurrent ? 'true' : 'false'}
        @click=${() => this.onPageActivate(number)}
      >
        <span part="thumbnail">
          ${this.boundViewer
            ? thumbState === 'unavailable'
              ? html`<lr-file-icon decorative></lr-file-icon>`
              : html`${keyed(
                  this.thumbnailGeneration,
                  html`<canvas aria-hidden="true" ${ref(this.canvasRef(number))}></canvas>`,
                )}${thumbState !== 'ready' ? html`<lr-skeleton variant="rect" aria-hidden="true"></lr-skeleton>` : nothing}`
            : html`<lr-file-icon decorative></lr-file-icon>`}
        </span>
        <span part="page-number" aria-hidden="true">${numberFormat.format(number)}</span>
        ${count > 0
          ? html`<span part="heat" aria-hidden="true">
              ${shownTones.map((tone) => html`<span part="heat-dot heat-dot-${tone}" data-tone=${tone}></span>`)}
              ${overflow > 0 ? html`<span part="heat-dot heat-dot-overflow" data-overflow="true">+${numberFormat.format(overflow)}</span>` : nothing}
            </span>`
          : nothing}
      </button>
    `;
  };

  private stopVirtualListEvent(event: Event): void {
    event.stopPropagation();
  }

  override render(): TemplateResult {
    const count = this.effectivePageCount();
    const items = Array.from({ length: count }, (_unused, i) => i + 1);
    return html`
      <div
        part="base"
        role="navigation"
        @keydown=${this.onKeyDown}
        aria-label=${this.getAttribute('aria-label') || this.label || this.localize('pageRailLabel')}
      >
        <lr-virtual-list
          part="pages"
          exportparts="page:page, page-current:page-current, thumbnail:thumbnail, page-number:page-number, heat:heat, heat-dot:heat-dot, heat-dot-accent:heat-dot-accent, heat-dot-success:heat-dot-success, heat-dot-warning:heat-dot-warning, heat-dot-danger:heat-dot-danger, heat-dot-neutral:heat-dot-neutral, heat-dot-overflow:heat-dot-overflow"
          .items=${items}
          .renderItem=${this.renderPageItem}
          .keyFunction=${(item: unknown) => item as number}
          .activeId=${this.safePage}
          @lr-visible-range-changed=${this.stopVirtualListEvent}
        ></lr-virtual-list>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-page-rail': LyraPageRail;
  }
}

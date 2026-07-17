import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ref } from 'lit/directives/ref.js';
import { LyraElement } from '../../internal/lyra-element.js';
import type { LyraHighlight, LyraHighlightTone } from '../document-viewer/anchors.js';
import '../virtual-list/virtual-list.js';
import '../skeleton/skeleton.js';
import '../file-icon/file-icon.js';
import { styles } from './page-rail.styles.js';

const DIGIT_BUFFER_MS = 500;

/** What `<lyra-page-rail>` needs from a wired viewer -- a page-addressed viewer satisfies this
 *  structurally: a live `page` property plus `renderPageThumbnail()`, and the
 *  `lyra-load`/`lyra-page-change` events every anchor-target page-shaped viewer already emits. */
export interface PageThumbnailSource extends EventTarget {
  page: number;
  renderPageThumbnail(page: number, canvas: HTMLCanvasElement, options?: { width?: number }): Promise<boolean>;
}

export interface LyraPageRailEventMap {
  'lyra-page-select': CustomEvent<{ page: number }>;
}

type ThumbnailState = 'pending' | 'ready' | 'unavailable';

/**
 * `<lyra-page-rail>` — a virtualized vertical thumbnail rail for page-addressed documents, with
 * per-page highlight heat markers. Two modes: **wired** (`viewer`/`for` supply a live
 * `PageThumbnailSource`, e.g. `lyra-pdf-viewer` -- thumbnails render lazily as rows materialize, and
 * the rail tracks page/count from the viewer's own events) and **mediated** (`page-count`/`page` are
 * host-bound directly, rows render a placeholder glyph -- still a fully functional pager). In wired
 * mode the viewer's `page` is the single source of truth.
 *
 * @customElement lyra-page-rail
 * @event lyra-page-select - A page row was activated (click, or Enter/Space on a focused row).
 *   `detail: { page }`. In wired mode the rail also sets `viewer.page` itself.
 * @csspart base - The rail.
 * @csspart pages - The embedded `lyra-virtual-list`.
 * @csspart page - One page button.
 * @csspart thumbnail - The thumbnail canvas wrapper.
 * @csspart page-number - The visible page number.
 * @csspart heat - The heat-marker cluster.
 * @csspart heat-dot - One tone-colored heat marker (or the `+n` overflow marker).
 * @cssprop [--lyra-page-rail-height=var(--lyra-size-24rem)] - Block size of the virtualized rail.
 */
export class LyraPageRail extends LyraElement<LyraPageRailEventMap> {
  static styles = [LyraElement.styles, styles];

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

  private readonly canvasRefs = new Map<number, (el: Element | undefined) => void>();
  private readonly canvases = new Map<number, HTMLCanvasElement>();
  private boundViewer: PageThumbnailSource | null = null;
  private digitBuffer = '';
  private digitTimer?: ReturnType<typeof setTimeout>;

  private readonly onViewerLoad = (e: Event): void => {
    this.resolvedPageCount = (e as CustomEvent<{ pageCount: number }>).detail.pageCount;
  };

  private readonly onViewerPageChange = (e: Event): void => {
    this.page = (e as CustomEvent<{ page: number }>).detail.page;
  };

  protected willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated || changed.has('viewer') || changed.has('for')) this.resolveViewer();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unbindViewer();
    clearTimeout(this.digitTimer);
  }

  private resolveViewer(): void {
    const next = this.viewer ?? this.lookupFor();
    if (next === this.boundViewer) return;
    this.unbindViewer();
    this.boundViewer = next;
    if (!next) return;
    this.page = next.page || this.page;
    next.addEventListener('lyra-load', this.onViewerLoad);
    next.addEventListener('lyra-page-change', this.onViewerPageChange);
  }

  private unbindViewer(): void {
    this.boundViewer?.removeEventListener('lyra-load', this.onViewerLoad);
    this.boundViewer?.removeEventListener('lyra-page-change', this.onViewerPageChange);
    this.boundViewer = null;
  }

  private lookupFor(): PageThumbnailSource | null {
    if (!this.for) return null;
    const root = this.getRootNode() as Document | ShadowRoot;
    return (root.getElementById?.(this.for) as unknown as PageThumbnailSource | null) ?? null;
  }

  private effectivePageCount(): number {
    return this.boundViewer ? this.resolvedPageCount : this.pageCount;
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

  private async loadThumbnail(pageNumber: number, canvas: HTMLCanvasElement): Promise<void> {
    const viewer = this.boundViewer;
    if (!viewer) return;
    this.thumbnailStates.set(pageNumber, 'pending');
    this.requestUpdate();
    let ok: boolean;
    try {
      ok = await viewer.renderPageThumbnail(pageNumber, canvas, { width: this.thumbWidth });
    } catch {
      // A rejected renderPageThumbnail() (decode error, detached canvas, resource exhaustion, ...)
      // is otherwise an unhandled rejection that leaves this page's skeleton spinning forever --
      // treat it the same as the documented `resolves(false)` case, falling back to the file-icon
      // placeholder instead.
      ok = false;
    }
    if (this.canvases.get(pageNumber) !== canvas) return;
    this.thumbnailStates.set(pageNumber, ok ? 'ready' : 'unavailable');
    this.requestUpdate();
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
    this.emit<{ page: number }>('lyra-page-select', { page: pageNumber });
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
    if (target >= 1 && target <= count) this.page = target;
  };

  private renderPageItem = (pageNumber: unknown): TemplateResult => {
    const number = pageNumber as number;
    const { count, tones } = this.pageHighlightSummary(number);
    const thumbState = this.thumbnailStates.get(number);
    const name =
      count === 0
        ? this.localize('pageRailPage', undefined, { page: number })
        : this.localize(count === 1 ? 'pageRailPageHighlighted' : 'pageRailPageHighlightedPlural', undefined, {
            page: number,
            count,
          });
    const shownTones = tones.slice(0, 3);
    const overflow = tones.length - shownTones.length;
    return html`
      <button
        part="page"
        type="button"
        aria-label=${name}
        aria-current=${this.page === number ? 'true' : nothing}
        @click=${() => this.onPageActivate(number)}
      >
        <span part="thumbnail">
          ${this.boundViewer
            ? thumbState === 'unavailable'
              ? html`<lyra-file-icon decorative></lyra-file-icon>`
              : html`<canvas aria-hidden="true" ${ref(this.canvasRef(number))}></canvas>${thumbState !== 'ready'
                  ? html`<lyra-skeleton variant="rect" aria-hidden="true"></lyra-skeleton>`
                  : nothing}`
            : html`<lyra-file-icon decorative></lyra-file-icon>`}
        </span>
        <span part="page-number" aria-hidden="true">${number}</span>
        ${count > 0
          ? html`<span part="heat" aria-hidden="true">
              ${shownTones.map((tone) => html`<span part="heat-dot" data-tone=${tone}></span>`)}
              ${overflow > 0 ? html`<span part="heat-dot" data-overflow="true">+${overflow}</span>` : nothing}
            </span>`
          : nothing}
      </button>
    `;
  };

  render(): TemplateResult {
    const count = this.effectivePageCount();
    const items = Array.from({ length: count }, (_unused, i) => i + 1);
    return html`
      <div part="base" @keydown=${this.onKeyDown} aria-label=${this.label || this.localize('pageRailLabel')}>
        <lyra-virtual-list
          part="pages"
          .items=${items}
          .renderItem=${this.renderPageItem}
          .keyFunction=${(item: unknown) => item as number}
          .activeId=${this.page}
        ></lyra-virtual-list>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-page-rail': LyraPageRail;
  }
}

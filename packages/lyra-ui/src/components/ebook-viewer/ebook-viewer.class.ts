import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { safeFetchUrl } from '../../internal/safe-url.js';
import { chevronIcon } from '../../internal/icons.js';
import { getEpubJs, type EpubBook, type EpubRendition } from './ebook-loader.js';
import { styles } from './ebook-viewer.styles.js';

type EbookState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string };

export interface LyraEbookViewerEventMap {
  'lyra-render-error': CustomEvent<{ error: unknown }>;
}

/**
 * Renders an EPUB with the optional `epubjs` peer. The mount element is kept
 * stable because epub.js imperatively owns it and renders chapters in iframes.
 *
 * @customElement lyra-ebook-viewer
 * @event lyra-render-error - Fired when fetching, opening, or rendering fails.
 * @csspart base - The viewer container.
 * @csspart toolbar - Previous and next chapter controls.
 * @csspart previous-button - The previous chapter button.
 * @csspart next-button - The next chapter button.
 * @csspart previous-icon - The previous button icon.
 * @csspart next-icon - The next button icon.
 * @csspart mount - The stable element epub.js renders into.
 * @csspart error - The error message region.
 */
export class LyraEbookViewer extends LyraElement<LyraEbookViewerEventMap> {
  static styles = [LyraElement.styles, styles];

  /** URL fetched as an ArrayBuffer and rendered as an EPUB. */
  @property() src = '';
  /** Display name used as the reading region's accessible-name fallback. */
  @property() name = '';
  /** Host `aria-label` override for the internal reading region. */
  @property({ attribute: 'aria-label' }) accessibleLabel = '';

  @state() private ebookState: EbookState = { kind: 'idle' };
  private readonly mountRef: Ref<HTMLDivElement> = createRef();
  private book?: EpubBook;
  private rendition?: EpubRendition;
  private generation = 0;

  protected firstUpdated(): void { void this.load(); }

  protected willUpdate(changed: PropertyValues): void {
    if (this.hasUpdated && changed.has('src')) void this.load();
  }

  disconnectedCallback(): void {
    this.generation++;
    this.teardown();
    super.disconnectedCallback();
  }

  private teardown(): void {
    this.book?.destroy();
    this.book = undefined;
    this.rendition = undefined;
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    this.teardown();
    if (!this.src.trim()) {
      this.ebookState = { kind: 'idle' };
      return;
    }
    const url = safeFetchUrl(this.src);
    if (!url) {
      this.ebookState = { kind: 'error', message: this.localize('documentPreviewUrlNotAllowed') };
      return;
    }
    this.ebookState = { kind: 'loading' };
    let data: ArrayBuffer;
    let factory: ((data: ArrayBuffer) => EpubBook) | null;
    try {
      [data, factory] = await Promise.all([
        fetch(url).then((response) => {
          if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
          return response.arrayBuffer();
        }),
        getEpubJs(),
      ]);
    } catch (error) {
      if (generation !== this.generation) return;
      this.ebookState = { kind: 'error', message: this.localize('documentPreviewFailedToLoad') };
      this.emit('lyra-render-error', { error });
      return;
    }
    if (generation !== this.generation) return;
    if (!factory) {
      this.ebookState = { kind: 'error', message: this.localize('ebookViewerLoadError') };
      return;
    }
    const mount = this.mountRef.value;
    if (!mount) {
      this.ebookState = { kind: 'error', message: this.localize('ebookViewerLoadError') };
      return;
    }
    try {
      const book = factory(data);
      const rendition = book.renderTo(mount, { width: '100%', height: '100%' }) as EpubRendition;
      await book.ready;
      await rendition.display();
      if (generation !== this.generation) {
        book.destroy();
        return;
      }
      this.book = book;
      this.rendition = rendition;
      this.ebookState = { kind: 'ready' };
    } catch (error) {
      if (generation !== this.generation) return;
      this.ebookState = { kind: 'error', message: this.localize('ebookViewerLoadError') };
      this.emit('lyra-render-error', { error });
    }
  }

  private previous = (): void => { void this.rendition?.prev(); };
  private next = (): void => { void this.rendition?.next(); };

  private renderStatus(): TemplateResult | typeof nothing {
    if (this.ebookState.kind === 'loading') return html`<p class="status-note">${this.localize('loadingDocument')}</p>`;
    if (this.ebookState.kind === 'error') return html`<div part="error" role="alert">${this.ebookState.message}</div>`;
    if (this.ebookState.kind === 'idle') {
      return html`<p class="status-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeDocument') })}</p>`;
    }
    return nothing;
  }

  render(): TemplateResult {
    const disabled = this.ebookState.kind !== 'ready';
    return html`
      <div part="base">
        <div part="toolbar">
          <button part="previous-button" type="button" aria-label=${this.localize('previous')} ?disabled=${disabled} @click=${this.previous}>
            <span part="previous-icon" aria-hidden="true">${chevronIcon()}</span>
          </button>
          <button part="next-button" type="button" aria-label=${this.localize('next')} ?disabled=${disabled} @click=${this.next}>
            <span part="next-icon" aria-hidden="true">${chevronIcon()}</span>
          </button>
        </div>
        <div part="mount" role="region" aria-label=${this.accessibleLabel || this.name || this.localize('ebookViewerRegionLabel')} ${ref(this.mountRef)}></div>
        ${this.renderStatus()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'lyra-ebook-viewer': LyraEbookViewer; }
}

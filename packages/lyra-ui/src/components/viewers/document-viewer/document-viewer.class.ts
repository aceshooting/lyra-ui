import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { safeDownloadHref } from '../../../internal/safe-url.js';
import type { DialogCloseReason } from '../../overlays/dialog/dialog.class.js';
import {
  findDocumentRenderer,
  getDefaultDocumentRendererRegistry,
  loadDocumentRenderer,
  type DocumentFile,
  type DocumentRendererDefinition,
  type DocumentRendererRegistry,
} from './registry.js';
import type { AnchorResultDetail, LyraAnchor, LyraHighlight } from './anchors.js';
import type { LyraDocumentPreview } from '../document-preview/document-preview.class.js';
import { styles } from './document-viewer.styles.js';

export type DocumentViewerCloseReason = DialogCloseReason;

export interface LyraDocumentViewerEventMap {
  'lr-close': CustomEvent<DocumentViewerCloseReason>;
  'lr-download': CustomEvent<{ src: string; filename: string }>;
  'lr-anchor-result': CustomEvent<AnchorResultDetail>;
}

/**
 * A dialog-hosted document viewer with a pluggable MIME-type renderer registry.
 * A registered renderer receives the current file; files without a matching
 * renderer use `<lr-document-preview>` as a safe built-in fallback.
 *
 * @customElement lr-document-viewer
 * @event lr-close - Fired when the nested dialog dismisses the viewer. The
 *   detail is the dialog close reason.
 * @event lr-download - Fired when the viewer's safe download action is
 *   activated. The browser download itself is handled by the native link.
 * @event lr-anchor-result - Fired once per applied `anchor`. An incapable resolved renderer
 *   produces `{ found: false }`; the `<lr-document-preview>` fallback reports its actual anchor
 *   result. An anchor-capable renderer reports its own jump result through its embedded
 *   `DocumentAnchorTarget` mixin, which composes up through this element unchanged.
 * @csspart body - Wrapper around the active renderer or fallback preview.
 * @csspart download-link - The native download action shown when `src` is safe.
 * @cssprop [--lr-document-viewer-max-height=70vh] - Maximum block size of the dialog body before it scrolls internally.
 */
export class LyraDocumentViewer extends LyraElement<LyraDocumentViewerEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** Whether the viewer is open. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** Display name passed to the renderer and shown as the dialog heading. */
  @property() name = '';

  /** MIME type used for renderer dispatch. */
  @property({ attribute: 'mime-type' }) mimeType = '';

  /** Source URL passed to the renderer or fallback preview. */
  @property() src = '';

  /** Optional per-instance registry; the default registry is used when unset. */
  @property({ attribute: false }) registry?: DocumentRendererRegistry;

  /** Declarative scroll-to-anchor target, forwarded to the resolved renderer. A string is a
   *  highlight id in `highlights`. `hasChanged: () => true` so re-assigning the same value (e.g.
   *  re-clicking the same citation badge) still re-fires, mirroring the anchor-target mixin's
   *  identical property. */
  @property({ attribute: false, hasChanged: () => true }) anchor: LyraAnchor | string | null = null;

  /** Highlights forwarded to the resolved renderer. */
  @property({ attribute: false }) highlights: LyraHighlight[] = [];

  /** Media alt text forwarded to the resolved renderer, for image-like renderers. */
  @property() alt = '';

  @state()
  private renderState:
    | { kind: 'fallback' }
    | { kind: 'loading' }
    | { kind: 'rendered'; template: unknown }
    | { kind: 'error' } = { kind: 'fallback' };

  private generation = 0;
  private resolvedLazy?: { def: DocumentRendererDefinition; resolved: DocumentRendererDefinition };
  @query('lr-document-preview') private fallbackPreviewEl?: LyraDocumentPreview;

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.open) {
      if (changed.has('open')) {
        this.generation++;
        this.renderState = { kind: 'fallback' };
      }
      return;
    }
    if (
      !this.hasUpdated ||
      changed.has('open') ||
      changed.has('name') ||
      changed.has('mimeType') ||
      changed.has('src') ||
      changed.has('registry') ||
      changed.has('anchor') ||
      changed.has('highlights') ||
      changed.has('alt')
    ) {
      void this.resolve();
    }
  }

  private currentFile(): DocumentFile {
    return {
      name: this.name,
      mimeType: this.mimeType,
      src: this.src,
      anchor: this.anchor ?? undefined,
      highlights: this.highlights,
      alt: this.alt || undefined,
    };
  }

  private async resolve(): Promise<void> {
    const generation = ++this.generation;
    const file = this.currentFile();
    const registry = this.registry ?? getDefaultDocumentRendererRegistry();
    const def = findDocumentRenderer(file, registry);

    if (!def) {
      this.resolvedLazy = undefined;
      this.renderState = { kind: 'fallback' };
      this.finishAnchorResult(undefined, file, generation);
      return;
    }

    if (this.resolvedLazy?.def === def) {
      this.renderWith(this.resolvedLazy.resolved, file);
      this.finishAnchorResult(this.resolvedLazy.resolved, file, generation);
      return;
    }

    if (!def.load) {
      this.resolvedLazy = { def, resolved: def };
      this.renderWith(def, file);
      this.finishAnchorResult(def, file, generation);
      return;
    }

    this.renderState = { kind: 'loading' };
    let resolved: DocumentRendererDefinition;
    try {
      resolved = await loadDocumentRenderer(def);
    } catch {
      if (generation === this.generation) {
        this.renderState = { kind: 'error' };
        this.finishAnchorResult(undefined, file, generation);
      }
      return;
    }
    if (generation !== this.generation) return;
    this.resolvedLazy = { def, resolved };
    this.renderWith(resolved, file);
    this.finishAnchorResult(resolved, file, generation);
  }

  /** Delegates to the fallback preview and emits its actual anchor result when there is no resolved
   *  renderer. Otherwise the shell emits `lr-anchor-result { found: false }` when the renderer
   *  cannot honor `file.anchor`'s kind (or, for a highlight-id anchor, declares no anchor
   *  capability at all). A capable embedded viewer's own `DocumentAnchorTarget` mixin emits after
   *  its scroll attempt and that composed event surfaces through this element unchanged, so the
   *  shell must not also emit in that case. */
  private finishAnchorResult(def: DocumentRendererDefinition | undefined, file: DocumentFile, generation: number): void {
    if (file.anchor == null) return;
    if (generation !== this.generation) return;
    if (!def) {
      this.scheduleAfterUpdate(() => {
        void (async () => {
          const found = (await this.fallbackPreviewEl?.scrollToAnchor(file.anchor!)) ?? false;
          if (generation !== this.generation) return;
          this.emit<AnchorResultDetail>('lr-anchor-result', { found });
        })();
      });
      return;
    }
    if (this.isAnchorCapable(def, file.anchor)) return;
    this.scheduleAfterUpdate(() => {
      if (generation !== this.generation) return;
      this.emit<AnchorResultDetail>('lr-anchor-result', { found: false });
    });
  }

  private isAnchorCapable(def: DocumentRendererDefinition | undefined, anchor: LyraAnchor | string): boolean {
    const anchors = def?.capabilities?.anchors;
    if (!anchors || anchors.length === 0) return false;
    if (typeof anchor === 'string') return true; // highlight id -- any declared anchor kind implies highlight support
    return anchors.includes(anchor.kind);
  }

  private renderWith(def: DocumentRendererDefinition, file: DocumentFile): void {
    if (!def.render) {
      this.renderState = { kind: 'error' };
      return;
    }
    this.renderState = { kind: 'rendered', template: def.render(file) };
  }

  private onDialogClose = (event: CustomEvent<DialogCloseReason>): void => {
    event.stopPropagation();
    this.open = false;
    this.emit<DocumentViewerCloseReason>('lr-close', event.detail);
  };

  private onDownload = (): void => {
    this.emit('lr-download', { src: this.src, filename: this.name });
  };

  private renderBody(): unknown {
    switch (this.renderState.kind) {
      case 'rendered':
        return this.renderState.template;
      case 'loading':
        return html`<p>${this.localize('loadingDocument')}</p>`;
      case 'error':
        return html`<div role="alert">${this.localize('documentPreviewGenericError')}</div>`;
      case 'fallback':
      default:
        return html`
          <lr-document-preview
            src=${this.src}
            mime-type=${this.mimeType}
            filename=${this.name}
            .alt=${this.alt}
            .highlights=${this.highlights}
            .suppressDownload=${true}
          ></lr-document-preview>
        `;
    }
  }

  override render(): TemplateResult {
    const downloadHref = safeDownloadHref(this.src);
    return html`
      <lr-dialog
        ?open=${this.open}
        heading=${this.name || nothing}
        label=${this.localize('documentViewerLabel')}
        closable
        @lr-dialog-close=${this.onDialogClose}
      >
        <div part="body">${this.open ? this.renderBody() : nothing}</div>
        ${downloadHref
          ? html`
              <a
                slot="footer"
                part="download-link"
                href=${downloadHref}
                download=${this.name || nothing}
                @click=${this.onDownload}
              >${this.localize('download')}</a>
            `
          : nothing}
      </lr-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-document-viewer': LyraDocumentViewer;
  }
}

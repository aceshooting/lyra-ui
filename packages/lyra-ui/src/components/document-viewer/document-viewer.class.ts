import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import type { DialogCloseReason } from '../dialog/dialog.class.js';
import {
  findDocumentRenderer,
  getDefaultDocumentRendererRegistry,
  loadDocumentRenderer,
  type DocumentFile,
  type DocumentRendererDefinition,
  type DocumentRendererRegistry,
} from './registry.js';
import { styles } from './document-viewer.styles.js';

export type DocumentViewerCloseReason = DialogCloseReason;

export interface LyraDocumentViewerEventMap {
  'lyra-close': CustomEvent<DocumentViewerCloseReason>;
}

/**
 * A dialog-hosted document viewer with a pluggable MIME-type renderer registry.
 * A registered renderer receives the current file; files without a matching
 * renderer use `<lyra-document-preview>` as a safe built-in fallback.
 *
 * @customElement lyra-document-viewer
 * @event lyra-close - Fired when the nested dialog dismisses the viewer. The
 *   detail is the dialog close reason.
 * @csspart body - Wrapper around the active renderer or fallback preview.
 */
export class LyraDocumentViewer extends LyraElement<LyraDocumentViewerEventMap> {
  static styles = [LyraElement.styles, styles];

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

  @state()
  private renderState:
    | { kind: 'fallback' }
    | { kind: 'loading' }
    | { kind: 'rendered'; template: unknown }
    | { kind: 'error' } = { kind: 'fallback' };

  private generation = 0;
  private resolvedLazy?: { def: DocumentRendererDefinition; resolved: DocumentRendererDefinition };

  protected willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated || changed.has('name') || changed.has('mimeType') || changed.has('src') || changed.has('registry')) {
      void this.resolve();
    }
  }

  private currentFile(): DocumentFile {
    return { name: this.name, mimeType: this.mimeType, src: this.src };
  }

  private async resolve(): Promise<void> {
    const generation = ++this.generation;
    const file = this.currentFile();
    const registry = this.registry ?? getDefaultDocumentRendererRegistry();
    const def = findDocumentRenderer(file, registry);

    if (!def) {
      this.resolvedLazy = undefined;
      this.renderState = { kind: 'fallback' };
      return;
    }

    if (this.resolvedLazy?.def === def) {
      this.renderWith(this.resolvedLazy.resolved, file);
      return;
    }

    if (!def.load) {
      this.resolvedLazy = { def, resolved: def };
      this.renderWith(def, file);
      return;
    }

    this.renderState = { kind: 'loading' };
    let resolved: DocumentRendererDefinition;
    try {
      resolved = await loadDocumentRenderer(def);
    } catch {
      if (generation === this.generation) this.renderState = { kind: 'error' };
      return;
    }
    if (generation !== this.generation) return;
    this.resolvedLazy = { def, resolved };
    this.renderWith(resolved, file);
  }

  private renderWith(def: DocumentRendererDefinition, file: DocumentFile): void {
    if (!def.render) {
      this.renderState = { kind: 'error' };
      return;
    }
    this.renderState = { kind: 'rendered', template: def.render(file) };
  }

  private onDialogClose = (event: CustomEvent<DialogCloseReason>): void => {
    this.open = false;
    this.emit<DocumentViewerCloseReason>('lyra-close', event.detail);
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
          <lyra-document-preview
            src=${this.src}
            mime-type=${this.mimeType}
            filename=${this.name}
          ></lyra-document-preview>
        `;
    }
  }

  render(): TemplateResult {
    return html`
      <lyra-dialog
        ?open=${this.open}
        heading=${this.name || nothing}
        label=${this.localize('documentViewerLabel')}
        closable
        @lyra-dialog-close=${this.onDialogClose}
      >
        <div part="body">${this.renderBody()}</div>
      </lyra-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-document-viewer': LyraDocumentViewer;
  }
}

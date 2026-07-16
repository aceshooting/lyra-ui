import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { srOnly } from '../../internal/a11y.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { safeFetchUrl } from '../../internal/safe-url.js';
import { isAbortError, isResourceLimitError, readResponseArrayBuffer } from '../../internal/resource-loader.js';
import { formatFileSize } from '../attachment-chip/attachment-chip.class.js';
import { loadEmailDeps } from './email-loader.js';
import { styles } from './email-viewer.styles.js';

export interface ParsedEmailAttachment { filename: string; mimeType: string; size: number; }
export interface ParsedEmail { from: string; to: string; subject: string; date: string; bodyHtml: string | null; bodyText: string | null; attachments: ParsedEmailAttachment[]; }
type EmailFetchState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'loaded'; email: ParsedEmail } | { kind: 'error'; message: string };

export interface LyraEmailViewerEventMap { 'lyra-render-error': CustomEvent<{ error: unknown }>; }

interface Address { name?: string; address?: string; group?: Address[]; }
function formatAddress(value: Address | undefined): string {
  if (!value) return '';
  if (value.group) return value.group.map(formatAddress).filter(Boolean).join(', ');
  if (value.name && value.address) return `${value.name} <${value.address}>`;
  return value.address ?? value.name ?? '';
}
function formatAddresses(values: Address[] | undefined): string { return (values ?? []).map(formatAddress).filter(Boolean).join(', '); }

/**
 * Parses `.eml` messages with the optional `postal-mime` peer and renders
 * their HTML body only after DOMPurify sanitization. Plain-text messages remain
 * useful without DOMPurify; attachments are listed as metadata, never opened.
 *
 * @customElement lyra-email-viewer
 * @event lyra-render-error - Fired when fetching or parsing the message fails.
 * @csspart base - The root container.
 * @csspart headers - Message metadata.
 * @csspart from-label - The localized sender label.
 * @csspart from - The sender address.
 * @csspart to-label - The localized recipient label.
 * @csspart to - The recipient addresses.
 * @csspart subject-label - The localized subject label.
 * @csspart subject - The message subject.
 * @csspart date-label - The localized date label.
 * @csspart date - The message date.
 * @csspart body - The scrollable message body.
 * @csspart body-html - The sanitized HTML body.
 * @csspart body-text - The plain-text body.
 * @csspart attachments - The attachment region.
 * @csspart attachments-label - The localized attachment heading.
 * @csspart attachment-list - The attachment list.
 * @csspart attachment-item - An attachment metadata item.
 * @csspart error - The error region.
 * @csspart spinner - The loading region.
 */
export class LyraEmailViewer extends LyraElement<LyraEmailViewerEventMap> {
  static styles = [LyraElement.styles, styles, srOnly];
  /** URL to fetch and parse as an RFC 822 message. */
  @property() src = '';
  /** Display name associated with the message. */
  @property() name = '';
  /** CSS length that caps the scrollable body. */
  @property({ attribute: 'max-height' }) maxHeight = '';
  @state() private fetchState: EmailFetchState = { kind: 'idle' };
  private generation = 0;

  protected updated(changed: PropertyValues): void {
    if (changed.has('src')) this.scheduleAfterUpdate(() => { void this.load(); });
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    const signal = this.beginAbortableLoad();
    if (!this.src) { this.fetchState = { kind: 'idle' }; return; }
    const url = safeFetchUrl(this.src);
    if (!url) { this.fetchState = { kind: 'error', message: this.localize('documentPreviewUrlNotAllowed') }; return; }
    this.fetchState = { kind: 'loading' };
    try {
      const response = await fetch(url, signal ? { signal } : undefined);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const email = await this.parse(await readResponseArrayBuffer(response));
      if (generation === this.generation) this.fetchState = { kind: 'loaded', email };
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.fetchState = { kind: 'error', message: this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad') };
      this.emit('lyra-render-error', { error });
    }
  }

  private async parse(buffer: ArrayBuffer): Promise<ParsedEmail> {
    const { PostalMime, DOMPurify } = await loadEmailDeps();
    if (!PostalMime) throw new Error(this.localize('emailViewerMissingParser'));
    const parsed = await PostalMime.parse(buffer);
    const bodyHtml = parsed.html && DOMPurify ? (DOMPurify.sanitize(parsed.html) as string) : null;
    const content = parsed.attachments ?? [];
    return {
      from: formatAddress(parsed.from),
      to: formatAddresses(parsed.to),
      subject: parsed.subject ?? '',
      date: parsed.date ?? '',
      bodyHtml,
      bodyText: bodyHtml ? null : (parsed.text ?? null),
      attachments: content.map((attachment: { filename?: string | null; mimeType?: string; content: ArrayBuffer | Uint8Array | string }) => ({
        filename: attachment.filename || this.localize('documentPreviewGenericFile'),
        mimeType: attachment.mimeType ?? '',
        size: attachment.content instanceof ArrayBuffer || attachment.content instanceof Uint8Array ? attachment.content.byteLength : attachment.content.length,
      })),
    };
  }

  private renderHeaders(email: ParsedEmail): TemplateResult {
    return html`<div part="headers">
      <span part="from-label">${this.localize('emailViewerFrom')}</span><span part="from">${email.from}</span>
      <span part="to-label">${this.localize('emailViewerTo')}</span><span part="to">${email.to}</span>
      <span part="subject-label">${this.localize('emailViewerSubject')}</span><span part="subject">${email.subject || this.localize('emailViewerNoSubject')}</span>
      <span part="date-label">${this.localize('emailViewerDate')}</span><span part="date">${email.date}</span>
    </div>`;
  }

  private renderAttachments(attachments: ParsedEmailAttachment[]): TemplateResult | typeof nothing {
    if (!attachments.length) return nothing;
    return html`<div part="attachments"><span part="attachments-label">${this.localize('emailViewerAttachments')}</span><ul part="attachment-list">
      ${attachments.map((attachment) => html`<li part="attachment-item"><span>${attachment.filename}</span><span>${formatFileSize(attachment.size)}</span></li>`)}
    </ul></div>`;
  }

  private renderBody(): TemplateResult {
    switch (this.fetchState.kind) {
      case 'loaded': return html`${this.renderHeaders(this.fetchState.email)}<div part="body">${this.fetchState.email.bodyHtml !== null ? html`<div part="body-html">${unsafeHTML(this.fetchState.email.bodyHtml)}</div>` : html`<pre part="body-text">${this.fetchState.email.bodyText ?? ''}</pre>`}</div>${this.renderAttachments(this.fetchState.email.attachments)}`;
      case 'loading': return html`<div part="spinner" role="status"><span class="sr-only">${this.localize('loadingDocument')}</span></div>`;
      case 'error': return html`<div part="error" role="alert">${this.fetchState.message}</div>`;
      case 'idle': default: return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeEmail') })}</p>`;
    }
  }

  render(): TemplateResult { return html`<div part="base" style=${this.maxHeight ? `--lyra-email-viewer-max-height:${this.maxHeight}` : nothing}>${this.renderBody()}</div>`; }
}

declare global { interface HTMLElementTagNameMap { 'lyra-email-viewer': LyraEmailViewer; } }

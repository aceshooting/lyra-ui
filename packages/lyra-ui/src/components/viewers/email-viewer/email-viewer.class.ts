import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { srOnly } from '../../../internal/a11y.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { safeFetchUrl } from '../../../internal/safe-url.js';
import { isAbortError, isResourceLimitError, LyraUserFacingError, readResponseArrayBuffer } from '../../../internal/resource-loader.js';
import { formatFileSize, FILE_SIZE_UNIT_KEYS } from '../../media/attachment-chip/attachment-chip.class.js';
import { loadEmailDeps } from './email-loader.js';
import { styles } from './email-viewer.styles.js';

export interface ParsedEmailAttachment { filename: string; mimeType: string; size: number; content?: Uint8Array; }
export interface ParsedEmail { from: string; to: string; subject: string; date: string; bodyHtml: string | null; bodyText: string | null; attachments: ParsedEmailAttachment[]; }
type EmailFetchState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'loaded'; email: ParsedEmail } | { kind: 'error'; message: string };

export interface LyraEmailViewerEventMap {
  'lr-render-error': CustomEvent<{ error: unknown }>;
  'lr-attachment-open': CustomEvent<{ attachment: { filename: string; mimeType: string; content?: Uint8Array } }>;
}

interface Address { name?: string; address?: string; group?: Address[]; }
function formatAddress(value: Address | undefined): string {
  if (!value) return '';
  if (value.group) return value.group.map(formatAddress).filter(Boolean).join(', ');
  if (value.name && value.address) return `${value.name} <${value.address}>`;
  return value.address ?? value.name ?? '';
}
function formatAddresses(values: Address[] | undefined): string { return (values ?? []).map(formatAddress).filter(Boolean).join(', '); }

function normalizeAttachmentContent(content: ArrayBuffer | Uint8Array | string): Uint8Array {
  if (content instanceof Uint8Array) return content;
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  return new TextEncoder().encode(content);
}

/** The maximal trailing run of lines that are empty or start with `>`, split off only when that
 *  run contains at least 3 actual `>`-quoted lines (a short quote-looking tail -- padded by blank
 *  separator lines to a longer raw run -- is left inline; blank lines alone never count toward the
 *  threshold since they carry no quoted content). */
function splitTrailingQuoteBlock(text: string): { visible: string; quoted: string } | null {
  const lines = text.split(/\r\n|\r|\n/);
  let start = lines.length;
  let quotedLineCount = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i]!.trimStart().startsWith('>')) { start = i; quotedLineCount++; }
    else if (lines[i]!.trim() === '') start = i;
    else break;
  }
  if (quotedLineCount < 3) return null;
  return { visible: lines.slice(0, start).join('\n'), quoted: lines.slice(start).join('\n') };
}

const QUOTE_SELECTOR = 'blockquote[type="cite" i], div.gmail_quote, div.yahoo_quoted, div[id^="divRplyFwdMsg"]';

/** Marks top-level gmail/Outlook/yahoo-shaped quote blocks in an already-sanitized HTML body as
 *  hidden and inserts a localized toggle button before each one. */
function foldHtmlQuotes(html: string, localize: (key: string) => string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks = doc.body.querySelectorAll(QUOTE_SELECTOR);
  blocks.forEach((block, index) => {
    block.setAttribute('part', 'quoted');
    block.setAttribute('hidden', '');
    block.setAttribute('data-quote-index', String(index));
    const button = doc.createElement('button');
    button.type = 'button';
    button.setAttribute('part', 'quote-toggle');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('data-quote-toggle', String(index));
    button.textContent = localize('emailViewerShowQuoted');
    block.before(button);
  });
  return doc.body.innerHTML;
}

/**
 * Parses `.eml` messages with the optional `postal-mime` peer and renders
 * their HTML body only after DOMPurify sanitization. Plain-text messages remain
 * useful without DOMPurify. Attachment rows are real buttons that emit
 * `lr-attachment-open` with the attachment's decoded bytes -- this component itself never
 * opens, downloads, or object-URLs the content; a host routes the event into e.g.
 * `URL.createObjectURL(new Blob([content], { type: mimeType }))` -> `lr-document-viewer` ->
 * revoke on `lr-close`. `fold-quotes` collapses trailing quoted-reply text/HTML behind a
 * localized toggle.
 *
 * @customElement lr-email-viewer
 * @event lr-render-error - Fired when fetching or parsing the message fails.
 * @event lr-attachment-open - An attachment button was activated. `detail: { attachment:
 *   { filename, mimeType, content? } }`. This component never opens, downloads, or object-URLs the
 *   content itself — see the class doc's composition recipe.
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
 * @csspart attachment-button - An attachment's open button.
 * @csspart attachment-name - An attachment's filename, inside `attachment-button`.
 * @csspart attachment-size - An attachment's formatted file size, inside `attachment-button`.
 * @csspart quoted - A folded quoted-text block (hidden until expanded).
 * @csspart quote-toggle - The show/hide-quoted-text toggle button.
 * @csspart error - The error region.
 * @csspart spinner - The loading region.
 * @cssprop [--lr-email-viewer-max-height=none] - Maximum block size of `[part="body"]` before it
 *   scrolls internally. The `maxHeight` property sets this token inline on `[part="base"]`.
 */
export class LyraEmailViewer extends LyraElement<LyraEmailViewerEventMap> {
  static override styles = [LyraElement.styles, styles, srOnly];
  /** URL to fetch and parse as an RFC 822 message. */
  @property() src = '';
  /** Display name associated with the message. Used as the accessible name
   *  of `[part='base']`, falling back to a host `aria-label` and then the
   *  localized `emailViewerLabel` default, matching the `csvViewerLabel`-
   *  style sibling document viewers. */
  @property() name = '';
  /** CSS length that caps the scrollable body. */
  @property({ attribute: 'max-height' }) maxHeight = '';
  /** Collapses trailing quoted-reply text/HTML behind a localized toggle. `false` (the default)
   *  preserves today's exact body rendering. */
  @property({ type: Boolean, attribute: 'fold-quotes' }) foldQuotes = false;
  @state() private fetchState: EmailFetchState = { kind: 'idle' };
  @state() private textQuoteExpanded = false;
  private generation = 0;

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
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
      this.fetchState = { kind: 'error', message: error instanceof LyraUserFacingError ? error.message : this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad') };
      this.emit('lr-render-error', { error });
    }
  }

  private async parse(buffer: ArrayBuffer): Promise<ParsedEmail> {
    const { PostalMime, DOMPurify } = await loadEmailDeps();
    if (!PostalMime) throw new LyraUserFacingError(this.localize('emailViewerMissingParser'));
    const parsed = await PostalMime.parse(buffer);
    const bodyHtml = parsed.html && DOMPurify ? (DOMPurify.sanitize(parsed.html) as string) : null;
    if (parsed.html && !bodyHtml && !parsed.text) {
      // An HTML-only message (no text/plain alternative) with the optional
      // `dompurify` peer unavailable would otherwise fall through to an empty
      // body with no diagnostic -- surface the same "install the optional
      // peer" message the other sanitizer-dependent viewers already show
      // (`<lr-html-viewer>`, `<lr-svg-viewer>`) instead of silently
      // dropping the only content the message has.
      throw new LyraUserFacingError(this.localize('documentViewerMissingSanitizer'));
    }
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
        content: normalizeAttachmentContent(attachment.content),
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
      ${attachments.map((attachment) => html`<li part="attachment-item"><button
        type="button"
        part="attachment-button"
        aria-label=${this.localize('emailViewerOpenAttachment', undefined, { filename: attachment.filename })}
        @click=${() => this.emit('lr-attachment-open', { attachment: { filename: attachment.filename, mimeType: attachment.mimeType, content: attachment.content } })}
      ><span part="attachment-name">${attachment.filename}</span><span part="attachment-size">${formatFileSize(attachment.size, (unit) => this.localize(FILE_SIZE_UNIT_KEYS[unit]))}</span></button></li>`)}
    </ul></div>`;
  }

  private renderTextBody(text: string): TemplateResult {
    const split = this.foldQuotes ? splitTrailingQuoteBlock(text) : null;
    if (!split) return html`<pre part="body-text">${text}</pre>`;
    return html`
      <pre part="body-text">${split.visible}</pre>
      <button
        type="button"
        part="quote-toggle"
        aria-expanded=${this.textQuoteExpanded ? 'true' : 'false'}
        @click=${() => { this.textQuoteExpanded = !this.textQuoteExpanded; }}
      >${this.localize(this.textQuoteExpanded ? 'emailViewerHideQuoted' : 'emailViewerShowQuoted')}</button>
      <pre part="quoted" ?hidden=${!this.textQuoteExpanded}>${split.quoted}</pre>
    `;
  }

  private onBodyClick = (e: MouseEvent): void => {
    const target = e.composedPath().find((el): el is HTMLElement => el instanceof HTMLElement && el.hasAttribute('data-quote-toggle'));
    if (!target) return;
    const index = target.getAttribute('data-quote-toggle');
    const block = this.renderRoot.querySelector<HTMLElement>(`[data-quote-index="${index}"]`);
    if (!block) return;
    const willExpand = block.hasAttribute('hidden');
    if (willExpand) block.removeAttribute('hidden');
    else block.setAttribute('hidden', '');
    target.setAttribute('aria-expanded', String(willExpand));
    target.textContent = this.localize(willExpand ? 'emailViewerHideQuoted' : 'emailViewerShowQuoted');
  };

  private renderBody(): TemplateResult {
    switch (this.fetchState.kind) {
      case 'loaded': return html`${this.renderHeaders(this.fetchState.email)}<div part="body">${this.fetchState.email.bodyHtml !== null ? html`<div part="body-html" @click=${this.onBodyClick}>${unsafeHTML(this.foldQuotes ? foldHtmlQuotes(this.fetchState.email.bodyHtml, this.localize.bind(this)) : this.fetchState.email.bodyHtml)}</div>` : this.renderTextBody(this.fetchState.email.bodyText ?? '')}</div>${this.renderAttachments(this.fetchState.email.attachments)}`;
      case 'loading': return html`<div part="spinner" role="status"><span class="sr-only">${this.localize('loadingDocument')}</span></div>`;
      case 'error': return html`<div part="error" role="alert">${this.fetchState.message}</div>`;
      case 'idle': default: return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeEmail') })}</p>`;
    }
  }

  override render(): TemplateResult { return html`<div part="base" style=${this.maxHeight ? `--lr-email-viewer-max-height:${this.maxHeight}` : nothing} aria-label=${this.name || this.getAttribute('aria-label') || this.localize('emailViewerLabel')}>${this.renderBody()}</div>`; }
}

declare global { interface HTMLElementTagNameMap { 'lr-email-viewer': LyraEmailViewer; } }

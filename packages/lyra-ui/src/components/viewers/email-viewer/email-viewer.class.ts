import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { hostAriaLabel, srOnly } from '../../../internal/a11y.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { TextViewerTarget, type LyraTextViewerTargetEventMap } from '../../../internal/text-viewer-target.js';
import {
  isAbortError,
  isResourceLimitError,
  LyraUserFacingError,
  readResponseArrayBuffer,
  resolveOwnerFetchTarget,
} from '../../../internal/resource-loader.js';
import { getDateTimeFormat, getListFormat, getNumberFormat } from '../../../internal/intl-cache.js';
import { formatFileSize, FILE_SIZE_UNIT_KEYS } from '../../media/attachment-chip/attachment-chip.class.js';
import { loadEmailDeps } from './email-loader.js';
import { styles } from './email-viewer.styles.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
import { activeElementIn } from '../../../internal/active-element.js';
import { ViewerAnnouncementController } from '../viewer-announcements.js';
import { renderViewerLoading, viewerLoadingStyles } from '../viewer-loading.js';
import type { AnchorResultDetail, TextSelectDetail } from '../document-viewer/anchors.js';
import { sanitizePassiveMarkup } from '../passive-markup.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_documentPreviewEmpty, LYRA_DEFAULT_documentPreviewFailedToLoad, LYRA_DEFAULT_documentPreviewGenericFile, LYRA_DEFAULT_documentPreviewResourceTooLarge, LYRA_DEFAULT_documentPreviewTypeEmail, LYRA_DEFAULT_documentPreviewUrlNotAllowed, LYRA_DEFAULT_documentViewerMissingSanitizer, LYRA_DEFAULT_download, LYRA_DEFAULT_emailViewerAttachments, LYRA_DEFAULT_emailViewerDate, LYRA_DEFAULT_emailViewerFrom, LYRA_DEFAULT_emailViewerGroupAddress, LYRA_DEFAULT_emailViewerHideQuoted, LYRA_DEFAULT_emailViewerLabel, LYRA_DEFAULT_emailViewerMissingParser, LYRA_DEFAULT_emailViewerNoSubject, LYRA_DEFAULT_emailViewerOpenAttachment, LYRA_DEFAULT_emailViewerShowQuoted, LYRA_DEFAULT_emailViewerSubject, LYRA_DEFAULT_emailViewerTo, LYRA_DEFAULT_fileSizeUnitB, LYRA_DEFAULT_fileSizeUnitGb, LYRA_DEFAULT_fileSizeUnitKb, LYRA_DEFAULT_fileSizeUnitMb, LYRA_DEFAULT_fileSizeUnitTb, LYRA_DEFAULT_loading, LYRA_DEFAULT_loadingDocument, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_popover, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface ParsedEmailAttachment { filename: string; mimeType: string; size: number; content?: Uint8Array; }
export interface ParsedEmail { from: string; to: string; subject: string; date: string; bodyHtml: string | null; bodyText: string | null; attachments: ParsedEmailAttachment[]; }
type EmailFetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; email: ParsedEmail; fromAddress?: Address; toAddresses?: Address[] }
  | { kind: 'error'; message: string };

export interface LyraEmailViewerEventMap extends LyraTextViewerTargetEventMap {
  'lr-render-error': CustomEvent<{ error: unknown }>;
  'lr-attachment-open': CustomEvent<{ attachment: { filename: string; mimeType: string; content?: Uint8Array } }>;
  'lr-search-change': CustomEvent<{ query: string; matchCount: number; activeIndex: number }>;
  'lr-anchor-result': CustomEvent<AnchorResultDetail>;
  'lr-text-select': CustomEvent<TextSelectDetail>;
}

interface Address { name?: string; address?: string; group?: Address[]; }

function normalizeAttachmentContent(content: ArrayBuffer | Uint8Array | string): Uint8Array {
  if (content instanceof Uint8Array) return content;
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  return new TextEncoder().encode(content);
}

class LyraEmailViewerBase extends LyraElement<LyraEmailViewerEventMap> {}

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
function parseHtmlDocument(html: string, ownerDocument: Document): Document | null {
  const DOMParserCtor = ownerDocument.defaultView?.DOMParser;
  return DOMParserCtor ? new DOMParserCtor().parseFromString(html, 'text/html') : null;
}

function foldHtmlQuotes(
  html: string,
  localize: (key: string) => string,
  expandedIndices: readonly number[],
  ownerDocument: Document,
): string {
  const doc = parseHtmlDocument(html, ownerDocument);
  // Server/inert documents have no parsing realm. The body was already sanitized, so retaining it
  // unfolded is the safe deterministic fallback until the element connects to a browser document.
  if (!doc) return html;
  const blocks = doc.body.querySelectorAll(QUOTE_SELECTOR);
  blocks.forEach((block, index) => {
    const expanded = expandedIndices.includes(index);
    block.setAttribute('part', 'quoted');
    if (!expanded) block.setAttribute('hidden', '');
    block.setAttribute('data-quote-index', String(index));
    const button = doc.createElement('button');
    button.type = 'button';
    button.setAttribute('part', 'quote-toggle');
    button.setAttribute('aria-expanded', String(expanded));
    button.setAttribute('data-quote-toggle', String(index));
    button.textContent = localize(expanded ? 'emailViewerHideQuoted' : 'emailViewerShowQuoted');
    block.before(button);
  });
  return doc.body.innerHTML;
}

function isQuoteToggleElement(target: EventTarget): target is Element {
  const candidate = target as Element;
  return candidate.nodeType === 1
    && typeof candidate.hasAttribute === 'function'
    && candidate.hasAttribute('data-quote-toggle');
}

/**
 * Parses `.eml` messages with the optional `postal-mime` peer and renders
 * their HTML body only after DOMPurify sanitization and inside a paint-contained surface.
 * Plain-text messages remain useful without DOMPurify. Attachment rows are real buttons that emit
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
 * @event {CustomEvent<{ query: string; matchCount: number; activeIndex: number }>} lr-search-change -
 *   Fired whenever search state changes. `detail: { query: string; matchCount: number;
 *   activeIndex: number }`. Bubbling, composed, and non-cancelable.
 * @event {CustomEvent<AnchorResultDetail>} lr-anchor-result - Fired after an `anchor` assignment or
 *   `scrollToAnchor()` call is applied. `detail: { found: boolean }`. Bubbling, composed, and
 *   non-cancelable.
 * @event {CustomEvent<TextSelectDetail>} lr-text-select - Fired after a selection ends inside the
 *   rendered message. `detail: { text: string; anchor: LyraAnchor | null; rects: DOMRect[] }`.
 *   Bubbling, composed, and non-cancelable.
 * @csspart base - The root container with explicit `aria-busy` loading state.
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
 * @csspart spinner - The visible tokenized loading treatment and ordinary text label.
 * @cssprop [--lr-email-viewer-max-height=none] - Maximum block size of `[part="body"]` before it
 *   scrolls internally. The `maxHeight` property sets this token inline on `[part="base"]`.
 * @status stable
 * @since 4.0.0
 */
export class LyraEmailViewer extends TextViewerTarget(LyraEmailViewerBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    anchorJumped: LYRA_DEFAULT_anchorJumped,
    anchorJumpedToPage: LYRA_DEFAULT_anchorJumpedToPage,
    anchorNotFound: LYRA_DEFAULT_anchorNotFound,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    documentPreviewEmpty: LYRA_DEFAULT_documentPreviewEmpty,
    documentPreviewFailedToLoad: LYRA_DEFAULT_documentPreviewFailedToLoad,
    documentPreviewGenericFile: LYRA_DEFAULT_documentPreviewGenericFile,
    documentPreviewResourceTooLarge: LYRA_DEFAULT_documentPreviewResourceTooLarge,
    documentPreviewTypeEmail: LYRA_DEFAULT_documentPreviewTypeEmail,
    documentPreviewUrlNotAllowed: LYRA_DEFAULT_documentPreviewUrlNotAllowed,
    documentViewerMissingSanitizer: LYRA_DEFAULT_documentViewerMissingSanitizer,
    download: LYRA_DEFAULT_download,
    emailViewerAttachments: LYRA_DEFAULT_emailViewerAttachments,
    emailViewerDate: LYRA_DEFAULT_emailViewerDate,
    emailViewerFrom: LYRA_DEFAULT_emailViewerFrom,
    emailViewerGroupAddress: LYRA_DEFAULT_emailViewerGroupAddress,
    emailViewerHideQuoted: LYRA_DEFAULT_emailViewerHideQuoted,
    emailViewerLabel: LYRA_DEFAULT_emailViewerLabel,
    emailViewerMissingParser: LYRA_DEFAULT_emailViewerMissingParser,
    emailViewerNoSubject: LYRA_DEFAULT_emailViewerNoSubject,
    emailViewerOpenAttachment: LYRA_DEFAULT_emailViewerOpenAttachment,
    emailViewerShowQuoted: LYRA_DEFAULT_emailViewerShowQuoted,
    emailViewerSubject: LYRA_DEFAULT_emailViewerSubject,
    emailViewerTo: LYRA_DEFAULT_emailViewerTo,
    fileSizeUnitB: LYRA_DEFAULT_fileSizeUnitB,
    fileSizeUnitGb: LYRA_DEFAULT_fileSizeUnitGb,
    fileSizeUnitKb: LYRA_DEFAULT_fileSizeUnitKb,
    fileSizeUnitMb: LYRA_DEFAULT_fileSizeUnitMb,
    fileSizeUnitTb: LYRA_DEFAULT_fileSizeUnitTb,
    loading: LYRA_DEFAULT_loading,
    loadingDocument: LYRA_DEFAULT_loadingDocument,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    popover: LYRA_DEFAULT_popover,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly, viewerLoadingStyles];
  /** URL to fetch and parse as an RFC 822 message. */
  @property() src = '';
  /** Display name associated with the message. Used as the accessible name
   *  of `[part='base']` when the host has no `aria-label`, and before the
   *  localized `emailViewerLabel` default, matching the `csvViewerLabel`-
   *  style sibling document viewers. Host `aria-label` wins by attribute
   *  presence, including an empty value. */
  @property() name = '';
  /** CSS length that caps the scrollable body. */
  /** A CSS `max-height`; invalid values are ignored. */
  @property({ attribute: 'max-height' }) maxHeight = '';
  /** Collapses trailing quoted-reply text/HTML behind a localized toggle. `false` (the default)
   *  preserves today's exact body rendering. */
  @property({ type: Boolean, attribute: 'fold-quotes' }) foldQuotes = false;
  /** Shared text search and anchor-target API for message headers/body text. Searching for text
   * inside a folded quote reveals every matching quote before navigating the active match. */
  override async search(query: string): Promise<number> {
    if (this.foldQuotes && this.fetchState.kind === 'loaded' && query.trim()) {
      const normalizedQuery = query.toLocaleLowerCase(this.effectiveLocale);
      const { bodyHtml, bodyText } = this.fetchState.email;
      if (bodyHtml !== null) {
        const doc = parseHtmlDocument(bodyHtml, this.ownerDocument);
        const next = new Set(this.expandedHtmlQuoteIndices);
        doc?.body.querySelectorAll(QUOTE_SELECTOR).forEach((block, index) => {
          if ((block.textContent ?? '').toLocaleLowerCase(this.effectiveLocale).includes(normalizedQuery)) {
            next.add(index);
          }
        });
        const expanded = [...next];
        if (
          expanded.length !== this.expandedHtmlQuoteIndices.length
          || expanded.some((value, index) => value !== this.expandedHtmlQuoteIndices[index])
        ) {
          this.expandedHtmlQuoteIndices = expanded;
          await this.updateComplete;
        }
      } else if (bodyText !== null) {
        const split = splitTrailingQuoteBlock(bodyText);
        if (
          split
          && split.quoted.toLocaleLowerCase(this.effectiveLocale).includes(normalizedQuery)
          && !this.textQuoteExpanded
        ) {
          this.textQuoteExpanded = true;
          await this.updateComplete;
        }
      }
    }
    return super.search(query);
  }
  override async searchNext(): Promise<boolean> { return super.searchNext(); }
  override async searchPrevious(): Promise<boolean> { return super.searchPrevious(); }
  override clearSearch(): void { super.clearSearch(); }
  @state() private fetchState: EmailFetchState = { kind: 'idle' };
  @state() private textQuoteExpanded = false;
  @state() private expandedHtmlQuoteIndices: number[] = [];
  private generation = 0;
  private lastLoadSrc = '';
  private readonly announcements = new ViewerAnnouncementController(this);
  /** Memoizes {@link foldHtmlQuotes}'s output so an unrelated re-render (any `@state`/`@property`
   *  write that isn't `bodyHtml` or the expanded-index set -- `name`, an announcement, a locale
   *  broadcast, ...) reuses the last folded string instead of re-parsing and re-walking the whole
   *  sanitized body on every render. Keyed on the two toggle-label strings too: a locale/`.strings`
   *  change alone (no `bodyHtml`/index change) still flips the "Show/Hide quoted text" button text
   *  that {@link foldHtmlQuotes} bakes into the returned markup, so the cache must miss when either
   *  label would render differently. */
  private foldedHtmlCache: {
    bodyHtml: string;
    expandedKey: string;
    showLabel: string;
    hideLabel: string;
    result: string;
  } | null = null;

  protected textContentRoot(): Element | null {
    return this.renderRoot.querySelector('[data-email-text-content]');
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.announcements.connect();
    if (this.hasUpdated && this.src.trim() && this.src === this.lastLoadSrc) {
      this.scheduleAfterUpdate(() => { void this.load(); });
    }
  }

  override disconnectedCallback(): void {
    this.generation++;
    this.textQuoteExpanded = false;
    this.expandedHtmlQuoteIndices = [];
    this.foldedHtmlCache = null;
    this.announcements.disconnect();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.announcements.adopted();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('src') || changed.has('foldQuotes')) {
      this.textQuoteExpanded = false;
      this.expandedHtmlQuoteIndices = [];
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.announcements.transition(
      'load',
      this.fetchState.kind,
      this.fetchState.kind === 'error' ? this.fetchState.message : this.localize('loadingDocument'),
    );
    if (changed.has('src')) this.scheduleAfterUpdate(() => { void this.load(); });
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    const signal = this.beginAbortableLoad();
    this.lastLoadSrc = this.src;
    if (!this.src) { this.fetchState = { kind: 'idle' }; return; }
    const fetchTarget = resolveOwnerFetchTarget(this, this.src);
    if (!fetchTarget) {
      this.failWithLocalizedMessage(this.localize('documentPreviewUrlNotAllowed'));
      return;
    }
    this.fetchState = { kind: 'loading' };
    try {
      const response = await fetchTarget.view.fetch(fetchTarget.url, signal ? { signal } : undefined);
      if (
        !this.isConnected ||
        generation !== this.generation ||
        this.ownerDocument.defaultView !== fetchTarget.view
      ) return;
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const buffer = await readResponseArrayBuffer(response);
      if (
        !this.isConnected ||
        generation !== this.generation ||
        this.ownerDocument.defaultView !== fetchTarget.view
      ) return;
      const result = await this.parse(buffer, generation);
      if (result && this.isConnected && generation === this.generation) this.fetchState = { kind: 'loaded', ...result };
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.fetchState = { kind: 'error', message: error instanceof LyraUserFacingError ? error.message : this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad') };
      this.emit('lr-render-error', { error });
    }
  }

  private failWithLocalizedMessage(message: string): void {
    const error = new LyraUserFacingError(message);
    this.fetchState = { kind: 'error', message };
    this.emit('lr-render-error', { error });
  }

  private async parse(
    buffer: ArrayBuffer,
    generation: number,
  ): Promise<{ email: ParsedEmail; fromAddress?: Address; toAddresses?: Address[] } | null> {
    const { PostalMime, DOMPurify } = await loadEmailDeps();
    if (!this.isConnected || generation !== this.generation) return null;
    if (!PostalMime) throw new LyraUserFacingError(this.localize('emailViewerMissingParser'));
    const parsed = await PostalMime.parse(buffer);
    if (!this.isConnected || generation !== this.generation) return null;
    const bodyHtml = parsed.html && DOMPurify
      ? sanitizePassiveMarkup(DOMPurify, parsed.html, this.ownerDocument, 'passive-document')
      : null;
    if (!this.isConnected || generation !== this.generation) return null;
    if (parsed.html && !DOMPurify && !parsed.text) {
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
      fromAddress: parsed.from,
      toAddresses: parsed.to,
      email: {
        from: this.formatAddress(parsed.from),
        to: this.formatAddresses(parsed.to),
        subject: parsed.subject ?? '',
        date: parsed.date ?? '',
        bodyHtml,
        bodyText: bodyHtml ? null : (parsed.text ?? null),
        attachments: content.map((attachment: { filename?: string | null; mimeType?: string; content: ArrayBuffer | Uint8Array | string }) => {
          const normalized = normalizeAttachmentContent(attachment.content);
          return {
            filename: attachment.filename || this.localize('documentPreviewGenericFile'),
            mimeType: attachment.mimeType ?? '',
            size: normalized.byteLength,
            content: normalized,
          };
        }),
      },
    };
  }

  private formatAddress(value: Address | undefined): string {
    if (!value) return '';
    if (value.group) {
      const members = getListFormat(this.effectiveLocale, { style: 'long', type: 'conjunction' })
        .format(value.group.map((entry) => this.formatAddress(entry)).filter(Boolean));
      return value.name
        ? this.localize('emailViewerGroupAddress', undefined, { name: value.name, members })
        : members;
    }
    if (value.name && value.address) {
      return getListFormat(this.effectiveLocale, { style: 'long', type: 'unit' }).format([value.name, value.address]);
    }
    return value.address ?? value.name ?? '';
  }

  private formatAddresses(values: Address[] | undefined): string {
    return getListFormat(this.effectiveLocale, { style: 'long', type: 'conjunction' })
      .format((values ?? []).map((value) => this.formatAddress(value)).filter(Boolean));
  }

  private formatDate(value: string): string {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : getDateTimeFormat(this.effectiveLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  private renderHeaders(email: ParsedEmail, fromAddress?: Address, toAddresses?: Address[]): TemplateResult {
    return html`<div part="headers">
      <span part="from-label">${this.localize('emailViewerFrom')}</span><span part="from">${fromAddress ? this.formatAddress(fromAddress) : email.from}</span>
      <span part="to-label">${this.localize('emailViewerTo')}</span><span part="to">${toAddresses ? this.formatAddresses(toAddresses) : email.to}</span>
      <span part="subject-label">${this.localize('emailViewerSubject')}</span><span part="subject">${email.subject || this.localize('emailViewerNoSubject')}</span>
      <span part="date-label">${this.localize('emailViewerDate')}</span><span part="date">${this.formatDate(email.date)}</span>
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
      ><span part="attachment-name">${attachment.filename}</span><span part="attachment-size">${formatFileSize(
        attachment.size,
        (unit) => this.localize(FILE_SIZE_UNIT_KEYS[unit]),
        (value, fractionDigits) => getNumberFormat(this.effectiveLocale, {
          minimumFractionDigits: fractionDigits,
          maximumFractionDigits: fractionDigits,
        }).format(value),
      )}</span></button></li>`)}
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
    const target = e.composedPath().find(isQuoteToggleElement);
    if (!target) return;
    const index = target.getAttribute('data-quote-toggle');
    const block = this.renderRoot.querySelector<HTMLElement>(`[data-quote-index="${index}"]`);
    const numericIndex = Number(index);
    if (!block || !Number.isInteger(numericIndex) || numericIndex < 0) return;
    const restoreFocus = activeElementIn(this.shadowRoot) === target;
    this.expandedHtmlQuoteIndices = this.expandedHtmlQuoteIndices.includes(numericIndex)
      ? this.expandedHtmlQuoteIndices.filter((value) => value !== numericIndex)
      : [...this.expandedHtmlQuoteIndices, numericIndex];
    if (restoreFocus) {
      this.scheduleAfterUpdate(() => {
        this.renderRoot
          .querySelector<HTMLElement>(`[data-quote-toggle="${numericIndex}"]`)
          ?.focus();
      });
    }
  };

  /** Cached wrapper around {@link foldHtmlQuotes} -- see {@link foldedHtmlCache}'s doc comment for
   *  what the cache key covers and why. A cache hit skips the `DOMParser().parseFromString()` +
   *  `QUOTE_SELECTOR` walk + `.innerHTML` re-serialization entirely, which otherwise re-ran on
   *  every render while `fold-quotes` is on, including renders triggered by toggling a single
   *  quote block (a `expandedHtmlQuoteIndices` write re-renders the whole component, not just the
   *  clicked block). */
  private getFoldedHtml(bodyHtml: string): string {
    const showLabel = this.localize('emailViewerShowQuoted');
    const hideLabel = this.localize('emailViewerHideQuoted');
    const expandedKey = this.expandedHtmlQuoteIndices.join(',');
    const cache = this.foldedHtmlCache;
    if (
      cache
      && cache.bodyHtml === bodyHtml
      && cache.expandedKey === expandedKey
      && cache.showLabel === showLabel
      && cache.hideLabel === hideLabel
    ) {
      return cache.result;
    }
    const result = foldHtmlQuotes(bodyHtml, this.localize.bind(this), this.expandedHtmlQuoteIndices, this.ownerDocument);
    this.foldedHtmlCache = { bodyHtml, expandedKey, showLabel, hideLabel, result };
    return result;
  }

  private renderBody(): TemplateResult {
    switch (this.fetchState.kind) {
      case 'loaded': return html`<div data-email-text-content>${this.renderHeaders(this.fetchState.email, this.fetchState.fromAddress, this.fetchState.toAddresses)}<div part="body">${this.fetchState.email.bodyHtml !== null ? html`<div part="body-html" @click=${this.onBodyClick}>${unsafeHTML(this.foldQuotes ? this.getFoldedHtml(this.fetchState.email.bodyHtml) : this.fetchState.email.bodyHtml)}</div>` : this.renderTextBody(this.fetchState.email.bodyText ?? '')}</div></div>${this.renderAttachments(this.fetchState.email.attachments)}`;
      case 'loading': return renderViewerLoading(this.localize('loadingDocument'));
      case 'error': return html`<div part="error">${this.fetchState.message}</div>`;
      case 'idle': default: return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeEmail') })}</p>`;
    }
  }

  override render(): TemplateResult {
    const maxHeight = sanitizeCssLength(this.maxHeight);
    return html`<div part="base" role="region" style=${maxHeight ? styleMap({ '--lr-email-viewer-max-height': maxHeight }) : nothing} aria-label=${hostAriaLabel(this) ?? (this.name || this.localize('emailViewerLabel'))} aria-busy=${this.fetchState.kind === 'loading' ? 'true' : 'false'}>${this.renderBody()}${this.renderAnchorLiveRegion()}</div>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-email-viewer': LyraEmailViewer; } }

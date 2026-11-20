import { normalizeLabel } from '../../../internal/accessible-name.js';
import { splitLines } from '../../../internal/text-lines.js';
import { makeScrollRegionFocusable } from '../../../internal/scroll-region.js';
import { ViewerSourceController, ViewerSourceUrlNotAllowedError, type ViewerSourceToken } from '../../../internal/viewer-source-controller.js';
import { bdi } from '../../../internal/bidi.js';
import { eventCollectionSupport } from '../../../internal/collection-snapshot.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { templateContent } from 'lit/directives/template-content.js';
import { srOnly } from '../../../internal/a11y.js';
import { LyraElement, type LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { TextViewerTarget, type LyraSearchChangeDetail, type LyraTextViewerTargetEventMap } from '../../../internal/text-viewer-target.js';
import { scopeFromElement, TEXT_QUOTE_LIMITS } from '../../../internal/text-quote.js';
import { createTextQuoteIndex } from '../../../internal/text-quote-index.js';
import {
  LyraUserFacingError,
} from '../../../internal/resource-loader.js';
import { viewerFailureMessage } from '../../../internal/viewer-failure-message.js';
import { getDateTimeFormat, getListFormat } from '../../../internal/intl-cache.js';
import { formatFileSize } from '../../../internal/bytes.js';
import { loadEmailDeps, type EmailDeps, type PostalMimeApi } from './email-loader.js';
import { styles } from './email-viewer.styles.js';
import { viewerFrameStyles } from '../viewer-frame.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
import { ViewerAnnouncementController } from '../viewer-announcements.js';
import { renderViewerLoading, viewerLoadingStyles } from '../viewer-loading.js';
import type { AnchorResultDetail, TextSelectDetail } from '../../../internal/document-anchors.js';
import { sanitizePassiveMarkupFragment } from '../../../internal/passive-markup.js';
import { viewerSemanticLabel, viewerSemanticRole } from '../viewer-semantic-owner.js';
import { DeferredTeardown } from '../../../internal/deferred-teardown.js';
import { isRuntimeArray } from '../../../internal/object-guards.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_documentPreviewEmpty, LYRA_DEFAULT_promptQueueAttachmentLimit, LYRA_DEFAULT_scrollerLabel, LYRA_DEFAULT_showMoreCollapsed } from '../../../internal/default-strings/shared.generated.js';
import { LYRA_DEFAULT_documentPreviewFailedToLoad, LYRA_DEFAULT_documentPreviewResourceTooLarge, LYRA_DEFAULT_documentPreviewTypeEmail, LYRA_DEFAULT_documentPreviewUrlNotAllowed, LYRA_DEFAULT_documentViewerMissingSanitizer, LYRA_DEFAULT_emailViewerAttachments, LYRA_DEFAULT_emailViewerDate, LYRA_DEFAULT_emailViewerEmptyBody, LYRA_DEFAULT_emailViewerFrom, LYRA_DEFAULT_emailViewerGroupAddress, LYRA_DEFAULT_emailViewerLabel, LYRA_DEFAULT_emailViewerMissingParser, LYRA_DEFAULT_emailViewerNoSubject, LYRA_DEFAULT_emailViewerOpenAttachment, LYRA_DEFAULT_emailViewerQuotedText, LYRA_DEFAULT_emailViewerSubject, LYRA_DEFAULT_emailViewerTo, LYRA_DEFAULT_emailViewerUnnamedAttachment, LYRA_DEFAULT_loadingDocument } from '../../../internal/default-strings/viewers.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface ParsedEmailAttachment { filename: string; mimeType: string; size: number; content?: Uint8Array; }
export interface ParsedEmail { from: string; to: string; subject: string; date: string; bodyHtml: string | null; bodyText: string | null; attachments: ParsedEmailAttachment[]; }
export interface LyraEmailAttachmentOpenDetail {
  readonly attachment: Readonly<{
    filename: string;
    mimeType: string;
    /** Immutable binary snapshot. Read bytes with `arrayBuffer()`; no object URL is created. */
    content?: Blob;
  }>;
}
interface EmailHtml {
  template: HTMLTemplateElement;
  folded?: { nodes: ChildNode[]; toggles: { button: HTMLButtonElement; block: Element }[] };
}

type EmailFetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; email: ParsedEmail; htmlBody?: EmailHtml; fromAddress?: Address; toAddresses?: readonly Address[]; omittedRecipients?: number }
  | { kind: 'error'; message: () => string };

export interface LyraEmailViewerEventMap extends LyraTextViewerTargetEventMap {
  'lr-load': CustomEvent<Record<string, never>>;
  'lr-render-error': CustomEvent<{ error: unknown }>;
  'lr-attachment-open': CustomEvent<LyraEventDetailSnapshot<LyraEmailAttachmentOpenDetail>>;
  'lr-search-change': CustomEvent<LyraSearchChangeDetail>;
  'lr-anchor-result': CustomEvent<AnchorResultDetail>;
  'lr-text-select': CustomEvent<TextSelectDetail>;
}

interface Address { name?: string; address?: string; group?: readonly Address[]; }

const MAX_EMAIL_RECIPIENT_POSITIONS = 10_000;
const MAX_EMAIL_RECIPIENT_DEPTH = 100;
const MAX_EMAIL_ATTACHMENT_POSITIONS = 10_000;
/** Attachment rows rendered at once; `[part="attachments-limit"]` discloses the rest. */
const MAX_RENDERED_EMAIL_ATTACHMENTS = 200;

interface RecipientProjectionBudget {
  positions: number;
  /** Recipient-list positions dropped by the position ceiling. */
  omitted: number;
  nodes: number;
  readonly seen: WeakSet<object>;
}

interface NormalizedParsedEmail {
  readonly html?: string;
  readonly text?: string;
  readonly from?: Address;
  readonly to: readonly Address[];
  readonly omittedRecipients: number;
  readonly subject?: string;
  readonly date?: string;
  readonly attachments: readonly ParsedEmailAttachment[];
}

/** Accept ordinary/null-prototype peer records while rejecting collections, custom instances,
 * revoked proxies, and reflection-failing values before any fields are inspected. */
function isSafeRecord(value: unknown): value is object {
  if (value === null || typeof value !== 'object' || isRuntimeArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || Object.getPrototypeOf(prototype) === null;
  } catch {
    return false;
  }
}

function optionalOwnString(value: object, key: string): string | undefined {
  const descriptor = getOwnDataDescriptor(value, key);
  return descriptor !== MISSING_OWN_DATA_DESCRIPTOR
    && descriptor !== UNSAFE_OWN_DATA_DESCRIPTOR
    && typeof descriptor.value === 'string'
    ? descriptor.value
    : undefined;
}

function optionalOwnValue(value: object, key: string): unknown {
  const descriptor = getOwnDataDescriptor(value, key);
  return descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
    ? undefined
    : descriptor.value;
}

function projectAddressList(
  value: unknown,
  budget: RecipientProjectionBudget,
  depth: number,
): Address[] {
  if (!isRuntimeArray(value)) return [];
  const length = getOwnDataDescriptor(value, 'length');
  if (
    length === MISSING_OWN_DATA_DESCRIPTOR
    || length === UNSAFE_OWN_DATA_DESCRIPTOR
    || typeof length.value !== 'number'
    || !Number.isSafeInteger(length.value)
    || length.value < 0
  )
    return [];
  const addresses: Address[] = [];
  const count = Math.min(length.value, Math.max(0, MAX_EMAIL_RECIPIENT_POSITIONS - budget.positions));
  budget.omitted += length.value - count;
  for (let index = 0; index < count; index += 1) {
    budget.positions += 1;
    const descriptor = getOwnDataDescriptor(value, String(index));
    if (descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) continue;
    const address = projectAddress(descriptor.value, budget, depth);
    if (address) addresses.push(address);
  }
  return addresses;
}

/** Projects optional sender/recipient records without walking getters, cycles, or an unbounded
 * nested group. A malformed optional field simply disappears; a valid sibling remains useful. */
function projectAddress(
  value: unknown,
  budget: RecipientProjectionBudget,
  depth: number,
): Address | undefined {
  if (
    depth > MAX_EMAIL_RECIPIENT_DEPTH
    || budget.nodes >= MAX_EMAIL_RECIPIENT_POSITIONS
    || !isSafeRecord(value)
    || budget.seen.has(value)
  )
    return undefined;
  budget.seen.add(value);
  budget.nodes += 1;
  const name = optionalOwnString(value, 'name');
  const address = optionalOwnString(value, 'address');
  const groupValue = optionalOwnValue(value, 'group');
  const group = groupValue === undefined
    ? []
    : projectAddressList(groupValue, budget, depth + 1);
  if (name === undefined && address === undefined && group.length === 0) return undefined;
  return Object.freeze({
    ...(name === undefined ? {} : { name }),
    ...(address === undefined ? {} : { address }),
    ...(group.length === 0 ? {} : { group: Object.freeze(group) }),
  });
}

/** Clones admitted attachment bytes immediately so later peer/caller mutation cannot alter the
 * rendered size or a future public attachment snapshot. */
function normalizeAttachmentContent(content: unknown): Uint8Array | undefined {
  try {
    if (typeof content === 'string') return new TextEncoder().encode(content);
    if (content instanceof Uint8Array) return new Uint8Array(content);
    if (content instanceof ArrayBuffer) return new Uint8Array(content.slice(0));
  } catch {
    return undefined;
  }
  return undefined;
}

function projectAttachments(value: unknown): readonly ParsedEmailAttachment[] {
  if (!isRuntimeArray(value)) return Object.freeze([]);
  const length = getOwnDataDescriptor(value, 'length');
  if (
    length === MISSING_OWN_DATA_DESCRIPTOR
    || length === UNSAFE_OWN_DATA_DESCRIPTOR
    || typeof length.value !== 'number'
    || !Number.isSafeInteger(length.value)
    || length.value < 0
  )
    return Object.freeze([]);
  const attachments: ParsedEmailAttachment[] = [];
  const count = Math.min(length.value, MAX_EMAIL_ATTACHMENT_POSITIONS);
  for (let index = 0; index < count; index += 1) {
    const entry = getOwnDataDescriptor(value, String(index));
    if (
      entry === MISSING_OWN_DATA_DESCRIPTOR
      || entry === UNSAFE_OWN_DATA_DESCRIPTOR
      || !isSafeRecord(entry.value)
    )
      continue;
    const content = normalizeAttachmentContent(optionalOwnValue(entry.value, 'content'));
    if (!content) continue;
    const filename = optionalOwnString(entry.value, 'filename') ?? '';
    const mimeType = optionalOwnString(entry.value, 'mimeType') ?? '';
    attachments.push(Object.freeze({ filename, mimeType, size: content.byteLength, content }));
  }
  return Object.freeze(attachments);
}

/** Retains a descriptor-safe, detached subset of a postal-mime result. Its optional fields are
 * independently recoverable so one malformed address or attachment cannot discard valid text. */
function normalizeParsedEmail(value: unknown): NormalizedParsedEmail | null {
  if (!isSafeRecord(value)) return null;
  const budget: RecipientProjectionBudget = { positions: 0, omitted: 0, nodes: 0, seen: new WeakSet() };
  const htmlValue = optionalOwnValue(value, 'html');
  const textValue = optionalOwnValue(value, 'text');
  const subjectValue = optionalOwnValue(value, 'subject');
  const dateValue = optionalOwnValue(value, 'date');
  const html = typeof htmlValue === 'string' ? htmlValue : undefined;
  const text = typeof textValue === 'string' ? textValue : undefined;
  const subject = typeof subjectValue === 'string' ? subjectValue : undefined;
  const date = typeof dateValue === 'string' ? dateValue : undefined;
  const from = projectAddress(optionalOwnValue(value, 'from'), budget, 0);
  const to = projectAddressList(optionalOwnValue(value, 'to'), budget, 0);
  return Object.freeze({
    ...(html === undefined ? {} : { html }),
    ...(text === undefined ? {} : { text }),
    ...(from === undefined ? {} : { from }),
    to: Object.freeze(to),
    omittedRecipients: budget.omitted,
    ...(subject === undefined ? {} : { subject }),
    ...(date === undefined ? {} : { date }),
    attachments: projectAttachments(optionalOwnValue(value, 'attachments')),
  });
}

function immutableAttachmentBlob(content: Uint8Array, mimeType: string): Blob {
  const copied = new Uint8Array(content.byteLength);
  copied.set(content);
  return new Blob([copied], { type: mimeType });
}

class LyraEmailViewerBase extends LyraElement<LyraEmailViewerEventMap> {
  protected static override collectionSupport = eventCollectionSupport;
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-attachment-open',
    'lr-text-select',
  ]);
}

/** The maximal trailing run of lines that are empty or start with `>`, split off only when that
 *  run contains at least 3 actual `>`-quoted lines (a short quote-looking tail -- padded by blank
 *  separator lines to a longer raw run -- is left inline; blank lines alone never count toward the
 *  threshold since they carry no quoted content). */
function splitTrailingQuoteBlock(text: string): { visible: string; quoted: string } | null {
  const lines = splitLines(text);
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

function foldHtmlQuotes(
  body: EmailHtml,
  expandedIndices: readonly number[],
  label: string,
): ChildNode[] {
  if (!body.folded) {
    const template = body.template.cloneNode(true) as HTMLTemplateElement;
    for (const element of template.content.querySelectorAll('[data-quote-toggle], [data-quote-index], [data-email-chrome]')) {
      element.removeAttribute('data-quote-toggle');
      element.removeAttribute('data-quote-index');
      element.removeAttribute('data-email-chrome');
    }
    const toggles = Array.from(template.content.querySelectorAll(QUOTE_SELECTOR), (block, index) => {
      const button = template.ownerDocument.createElement('button');
      button.type = 'button';
      button.setAttribute('part', 'quote-toggle');
      button.setAttribute('data-email-chrome', 'quote-toggle');
      button.setAttribute('data-quote-toggle', String(index));
      block.setAttribute('part', 'quoted');
      block.setAttribute('data-quote-index', String(index));
      block.before(button);
      return { button, block };
    });
    body.folded = { nodes: Array.from(template.content.childNodes), toggles };
  }
  const expanded = new Set(expandedIndices);
  body.folded.toggles.forEach(({ button, block }, index) => {
    const open = expanded.has(index);
    block.toggleAttribute('hidden', !open);
    button.setAttribute('aria-expanded', String(open));
    button.textContent = label;
  });
  return body.folded.nodes;
}

/** Sanitized message markup never contains buttons, so only Lyra's toggles match. */
function isQuoteToggleElement(target: EventTarget): target is Element {
  const candidate = target as Element;
  return candidate.nodeType === 1
    && candidate.localName === 'button'
    && candidate.hasAttribute('data-quote-toggle');
}

/**
 * Parses `.eml` messages with the optional `postal-mime` peer and renders
 * their HTML body only after DOMPurify sanitization and inside a paint-contained surface.
 * Sanitized HTML uses the passive-document profile: anchors, form controls, and custom elements
 * are unwrapped to ordinary text/children where safe, remote navigation/resource attributes are
 * removed, and an `<a>` itself never remains. Images render only inline base64 GIF, JPEG, PNG, or
 * WebP data; same-document SVG fragment references may remain.
 * Plain-text messages remain useful without DOMPurify. Attachment rows are real buttons that emit
 * `lr-attachment-open` with an immutable Blob snapshot of the decoded bytes -- this component
 * never opens, downloads, or object-URLs the content; a host routes the Blob into e.g.
 * `URL.createObjectURL(content)` -> `lr-document-viewer` ->
 * revoke on `lr-close`. `fold-quotes` collapses trailing quoted-reply text/HTML behind a
 * localized toggle. A missing attachment filename uses the localized
 * `emailViewerUnnamedAttachment` fallback in both visible and accessible names, resolved while
 * rendering so a later locale or `strings` change updates an already-parsed message.
 * A nonempty host `aria-label` makes the host the sole named semantic owner; otherwise the shadow
 * region owns the explicit-empty, `name`, or localized fallback label.
 * Fragment anchors perform an exact DOM `id` lookup. Lyra generates no fragment ids for message
 * headers or plain-text bodies; an HTML message can resolve only an id retained from its sanitized
 * body. Text-quote anchors remain available across all rendered message text.
 *
 * @customElement lr-email-viewer
 * @event lr-load - Fired after rendering a successfully parsed document. Bubbles and is composed with empty detail.
 * @event lr-render-error - Fired when fetching or parsing the message fails.
 * @event lr-attachment-open - An attachment button was activated. Recursively frozen `detail:
 *   { attachment: { filename, mimeType, content?: Blob } }`; read bytes with `arrayBuffer()`.
 * @event {CustomEvent<LyraSearchChangeDetail>} lr-search-change -
 *   Fired whenever search state changes. `matchCountExact=false` makes the retained count a lower
 *   bound. Bubbling, composed, and non-cancelable.
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
 * @csspart to - The recipient addresses, followed by a localized `+N` count of any recipients past
 *   the 10,000-position ceiling.
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
 * @csspart attachments-limit - Localized note when more than the first 200 retained attachments exist.
 * @csspart quoted - A folded quoted-text block (hidden until expanded).
 * @csspart quote-toggle - The quoted-text disclosure button: one constant visible name
 *   (`emailViewerQuotedText`) in both states, with `aria-expanded` carrying the state.
 * @csspart error - The error region.
 * @csspart spinner - The visible tokenized loading treatment and ordinary text label.
 * @cssprop --lr-email-viewer-action-background - Resting background of viewer actions.
 * @cssprop --lr-email-viewer-action-hover-background - Hover background of viewer actions.
 * @cssprop --lr-email-viewer-action-active-background - Pressed background of viewer actions.
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
    documentPreviewEmpty: LYRA_DEFAULT_documentPreviewEmpty,
    documentPreviewFailedToLoad: LYRA_DEFAULT_documentPreviewFailedToLoad,
    documentPreviewResourceTooLarge: LYRA_DEFAULT_documentPreviewResourceTooLarge,
    documentPreviewTypeEmail: LYRA_DEFAULT_documentPreviewTypeEmail,
    documentPreviewUrlNotAllowed: LYRA_DEFAULT_documentPreviewUrlNotAllowed,
    documentViewerMissingSanitizer: LYRA_DEFAULT_documentViewerMissingSanitizer,
    emailViewerAttachments: LYRA_DEFAULT_emailViewerAttachments,
    emailViewerDate: LYRA_DEFAULT_emailViewerDate,
    emailViewerEmptyBody: LYRA_DEFAULT_emailViewerEmptyBody,
    emailViewerFrom: LYRA_DEFAULT_emailViewerFrom,
    emailViewerGroupAddress: LYRA_DEFAULT_emailViewerGroupAddress,
    emailViewerLabel: LYRA_DEFAULT_emailViewerLabel,
    emailViewerMissingParser: LYRA_DEFAULT_emailViewerMissingParser,
    emailViewerNoSubject: LYRA_DEFAULT_emailViewerNoSubject,
    emailViewerOpenAttachment: LYRA_DEFAULT_emailViewerOpenAttachment,
    emailViewerQuotedText: LYRA_DEFAULT_emailViewerQuotedText,
    emailViewerSubject: LYRA_DEFAULT_emailViewerSubject,
    emailViewerTo: LYRA_DEFAULT_emailViewerTo,
    emailViewerUnnamedAttachment: LYRA_DEFAULT_emailViewerUnnamedAttachment,
    loadingDocument: LYRA_DEFAULT_loadingDocument,
    promptQueueAttachmentLimit: LYRA_DEFAULT_promptQueueAttachmentLimit,
    scrollerLabel: LYRA_DEFAULT_scrollerLabel,
    showMoreCollapsed: LYRA_DEFAULT_showMoreCollapsed,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, viewerFrameStyles, srOnly, viewerLoadingStyles];
  /** URL to fetch and parse as an RFC 822 message. */
  @property() src = '';
  /** Display name associated with the message. Used as the accessible name
   *  of `[part='base']` when the host has no `aria-label`, and before the
   *  localized `emailViewerLabel` default, matching the `csvViewerLabel`-
   *  style sibling document viewers. Host `aria-label` wins by attribute
   *  presence, including an empty value. */
  @property() name = '';
  /** CSS length that caps the scrollable body; invalid values are ignored. */
  @property({ attribute: 'max-height' }) maxHeight = '';
  /** Collapses trailing quoted-reply text/HTML behind a localized toggle. `false` (the default)
   *  renders the whole body unfolded. */
  @property({ type: Boolean, attribute: 'fold-quotes' }) foldQuotes = false;
  /** Shared text search and anchor-target API for message body text. Searching for text
   * inside a folded quote reveals matching quotes before navigating the active match, using the
   * same bounded Unicode/whitespace normalization and locale matching as the shared text index. */
  override async search(query: string): Promise<number> {
    if (this.foldQuotes && this.fetchState.kind === 'loaded' && query.trim()
      && query.length <= TEXT_QUOTE_LIMITS.maxQueryCodeUnits) {
      const budget = { remainingCodeUnits: TEXT_QUOTE_LIMITS.maxSearchWorkCodeUnits };
      const matchesQuote = (block: Element): boolean =>
        createTextQuoteIndex(scopeFromElement(block), this.effectiveLocale).search(query, budget).length > 0;
      const { bodyText } = this.fetchState.email;
      const { htmlBody } = this.fetchState;
      if (htmlBody) {
        const next = new Set(this.expandedHtmlQuoteIndices);
        htmlBody.template.content.querySelectorAll(QUOTE_SELECTOR).forEach((block, index) => {
          if (!next.has(index) && matchesQuote(block)) next.add(index);
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
        const quote = this.ownerDocument.createElement('pre');
        quote.textContent = split?.quoted ?? '';
        if (split && !this.textQuoteExpanded && matchesQuote(quote)) {
          this.textQuoteExpanded = true;
          await this.updateComplete;
        }
      }
    }
    return super.search(query);
  }
  @state() private fetchState: EmailFetchState = { kind: 'idle' };
  @state() private textQuoteExpanded = false;
  @state() private expandedHtmlQuoteIndices: number[] = [];
  private readonly transport = new ViewerSourceController(this, {
    retainAcrossMove: () => !this.acquiringMessage,
    load: (response, token) => this.readDocument(response, token),
    onError: error => {
      this.acquiringMessage = false;
      const failure = error instanceof ViewerSourceUrlNotAllowedError
        ? new LyraUserFacingError(this.localize('documentPreviewUrlNotAllowed'), localize => localize('documentPreviewUrlNotAllowed'))
        : error;
      this.fetchState = { kind: 'error', message: viewerFailureMessage(failure, this.localize.bind(this)) };
      this.emit('lr-render-error', { error: failure });
    },
  });
  private acquiringMessage = false;
  private lastLoadSrc = '';
  private readonly announcements = new ViewerAnnouncementController(this);
  private foldedHtmlCache: {
    body: EmailHtml;
    expanded: readonly number[];
    label: string;
    result: ChildNode[];
  } | null = null;

  protected override textContentRoot(): Element | null {
    return this.renderRoot.querySelector('[part="body"]');
  }

  protected override buildTextScope(root: Element): ReturnType<typeof scopeFromElement> {
    return scopeFromElement(root, undefined, (element) =>
      this.foldQuotes && element.localName === 'button' && element.getAttribute('data-email-chrome') === 'quote-toggle');
  }

  private releaseScrollRegion?: () => void;

  private syncScrollRegion(): void {
    this.releaseScrollRegion?.();
    const body = this.renderRoot.querySelector<HTMLElement>('[part="body"]');
    this.releaseScrollRegion = body && this.isConnected
      ? makeScrollRegionFocusable(body, this.localize('scrollerLabel'))
      : undefined;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.syncScrollRegion();
    this.announcements.connect();
    const moved = this.detached.cancel();
    if (moved && !this.acquiringMessage) return;
    if (this.hasUpdated && this.src.trim() && this.src === this.lastLoadSrc) {
      this.scheduleAfterUpdate(() => { void this.load(); });
    }
  }

  /** A same-task DOM move keeps the loaded message; a genuine disconnect drops load and fold state. */
  private readonly detached = new DeferredTeardown(() => {
    this.transport.cancel();
    this.textQuoteExpanded = false;
    this.expandedHtmlQuoteIndices = [];
    this.foldedHtmlCache = null;
  });

  override disconnectedCallback(): void {
    this.announcements.disconnect();
    this.releaseScrollRegion?.();
    this.releaseScrollRegion = undefined;
    super.disconnectedCallback();
    this.detached.schedule();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.detached.flush();
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
    this.syncScrollRegion();
    this.announcements.transition(
      'load',
      this.fetchState.kind,
      this.fetchState.kind === 'error' ? this.fetchState.message() : this.localize('loadingDocument'),
    );
    if (changed.has('src')) this.scheduleAfterUpdate(() => { void this.load(); });
    if (this.isConnected && changed.has('fetchState') && this.fetchState.kind === 'loaded') this.emit('lr-load', {});
  }

  private async load(): Promise<void> {
    this.acquiringMessage = Boolean(this.src);
    this.lastLoadSrc = this.src;
    this.fetchState = this.src ? { kind: 'loading' } : { kind: 'idle' };
    await this.transport.begin(this.src);
  }

  private async readDocument(response: Response, token: ViewerSourceToken): Promise<void> {
    const { PostalMime, DOMPurify } = await loadEmailDeps();
    if (this.transport.isStale(token)) return;
    if (!PostalMime) {
      throw new LyraUserFacingError(
        this.localize('emailViewerMissingParser'),
        (localize) => localize('emailViewerMissingParser'),
      );
    }
    const buffer = await this.transport.readArrayBuffer(response);
    if (this.transport.isStale(token)) return;
    this.acquiringMessage = false;
    const result = await this.parse(buffer, token, PostalMime, DOMPurify);
    if (result && !this.transport.isStale(token)) {
      this.fetchState = { kind: 'loaded', ...result };
    }
  }

  private async parse(
    buffer: ArrayBuffer,
    token: ViewerSourceToken,
    PostalMime: PostalMimeApi,
    DOMPurify: EmailDeps['DOMPurify'],
  ): Promise<{ email: ParsedEmail; htmlBody?: EmailHtml; fromAddress?: Address; toAddresses?: readonly Address[]; omittedRecipients?: number } | null> {
    const rawParsed = await PostalMime.parse(buffer);
    if (this.transport.isStale(token)) return null;
    const parsed = normalizeParsedEmail(rawParsed);
    if (!parsed) {
      throw new LyraUserFacingError(
        this.localize('documentPreviewFailedToLoad'),
        (localize) => localize('documentPreviewFailedToLoad'),
      );
    }
    let htmlBody: EmailHtml | undefined;
    let bodyHtml: string | null = null;
    if (parsed.html !== undefined && DOMPurify) {
      const template = this.ownerDocument.createElement('template');
      template.content.append(sanitizePassiveMarkupFragment(DOMPurify, parsed.html, this.ownerDocument, 'passive-document'));
      const markup = template.innerHTML;
      if (markup.trim()) {
        bodyHtml = markup;
        htmlBody = { template };
      }
    }
    if (this.transport.isStale(token)) return null;
    if (parsed.html && !DOMPurify && !parsed.text) {
      throw new LyraUserFacingError(
        this.localize('documentViewerMissingSanitizer'),
        (localize) => localize('documentViewerMissingSanitizer'),
      );
    }
    return {
      ...(parsed.from === undefined ? {} : { fromAddress: parsed.from }),
      toAddresses: parsed.to,
      omittedRecipients: parsed.omittedRecipients,
      htmlBody,
      email: {
        from: this.formatAddress(parsed.from),
        to: this.formatAddresses(parsed.to),
        subject: parsed.subject ?? '',
        date: parsed.date ?? '',
        bodyHtml,
        bodyText: bodyHtml ? null : (parsed.text ?? null),
        attachments: [...parsed.attachments],
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

  private formatAddresses(values: readonly Address[] | undefined): string {
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

  private renderHeaders(email: ParsedEmail, fromAddress?: Address, toAddresses?: readonly Address[], omittedRecipients = 0): TemplateResult {
    const omitted = omittedRecipients > 0
      ? ` ${this.localize('showMoreCollapsed', undefined, { count: this.formatLocaleNumber(omittedRecipients) })}`
      : '';
    return html`<div part="headers">
      <span part="from-label">${this.localize('emailViewerFrom')}</span><span part="from">${bdi(fromAddress ? this.formatAddress(fromAddress) : email.from)}</span>
      <span part="to-label">${this.localize('emailViewerTo')}</span><span part="to">${bdi(toAddresses ? this.formatAddresses(toAddresses) : email.to)}${omitted}</span>
      <span part="subject-label">${this.localize('emailViewerSubject')}</span><span part="subject">${bdi(email.subject || this.localize('emailViewerNoSubject'))}</span>
      <span part="date-label">${this.localize('emailViewerDate')}</span><span part="date">${bdi(this.formatDate(email.date))}</span>
    </div>`;
  }

  private renderAttachments(attachments: ParsedEmailAttachment[]): TemplateResult | typeof nothing {
    if (!attachments.length) return nothing;
    const shown = attachments.length > MAX_RENDERED_EMAIL_ATTACHMENTS ? attachments.slice(0, MAX_RENDERED_EMAIL_ATTACHMENTS) : attachments;
    return html`<div part="attachments"><span part="attachments-label">${this.localize('emailViewerAttachments')}</span><ul part="attachment-list">
      ${shown.map((attachment) => {
        const filename = attachment.filename || this.localize('emailViewerUnnamedAttachment');
        const size = formatFileSize(attachment.size, this.effectiveLocale);
        return html`<li part="attachment-item"><button
          type="button"
          part="attachment-button"
          aria-label=${this.localize('emailViewerOpenAttachment', undefined, { filename: `${filename} ${size}` })}
          @click=${() => this.emit('lr-attachment-open', {
            attachment: {
              filename,
              mimeType: attachment.mimeType,
              content: attachment.content
                ? immutableAttachmentBlob(attachment.content, attachment.mimeType)
                : undefined,
            },
          })}
        ><span part="attachment-name">${bdi(filename)}</span> <span part="attachment-size">${size}</span></button></li>`;
      })}
    </ul>${shown.length < attachments.length
      ? html`<p part="attachments-limit" role="note">${this.localize('promptQueueAttachmentLimit', undefined, {
          shown: this.formatLocaleNumber(shown.length),
          total: this.formatLocaleNumber(attachments.length),
        })}</p>`
      : nothing}</div>`;
  }

  private renderTextBody(text: string): TemplateResult {
    const split = this.foldQuotes ? splitTrailingQuoteBlock(text) : null;
    if (!split) return html`<pre part="body-text" dir="auto">${text}</pre>`;
    return html`
      <pre part="body-text" dir="auto">${split.visible}</pre>
      <button
        type="button"
        part="quote-toggle"
        data-email-chrome="quote-toggle"
        aria-expanded=${this.textQuoteExpanded ? 'true' : 'false'}
        @click=${() => { this.textQuoteExpanded = !this.textQuoteExpanded; }}
      >${this.localize('emailViewerQuotedText')}</button>
      <pre part="quoted" dir="auto" ?hidden=${!this.textQuoteExpanded}>${split.quoted}</pre>
    `;
  }

  private onBodyClick = (e: MouseEvent): void => {
    const target = e.composedPath().find(isQuoteToggleElement);
    if (!target) return;
    const index = target.getAttribute('data-quote-toggle');
    const block = this.renderRoot.querySelector<HTMLElement>(`[data-quote-index="${index}"]`);
    const numericIndex = Number(index);
    if (!block || !Number.isInteger(numericIndex) || numericIndex < 0) return;
    this.expandedHtmlQuoteIndices = this.expandedHtmlQuoteIndices.includes(numericIndex)
      ? this.expandedHtmlQuoteIndices.filter((value) => value !== numericIndex)
      : [...this.expandedHtmlQuoteIndices, numericIndex];
  };

  private getFoldedHtml(body: EmailHtml): ChildNode[] {
    const label = this.localize('emailViewerQuotedText');
    const expanded = this.expandedHtmlQuoteIndices;
    const cache = this.foldedHtmlCache;
    if (
      cache
      && cache.body === body
      && cache.expanded === expanded
      && cache.label === label
    ) {
      return cache.result;
    }
    const result = foldHtmlQuotes(body, expanded, label);
    this.foldedHtmlCache = { body, expanded, label, result };
    return result;
  }

  private renderBody(): TemplateResult {
    switch (this.fetchState.kind) {
      case 'loaded': {
        const { email, htmlBody, fromAddress, toAddresses, omittedRecipients } = this.fetchState;
        return html`<div>${this.renderHeaders(email, fromAddress, toAddresses, omittedRecipients)}<div part="body">${htmlBody
          ? html`<div part="body-html" @click=${this.onBodyClick}>${this.foldQuotes ? this.getFoldedHtml(htmlBody) : templateContent(htmlBody.template)}</div>`
          : email.bodyText?.trim()
            ? this.renderTextBody(email.bodyText)
            : html`<p class="empty-note">${this.localize('emailViewerEmptyBody')}</p>`}</div></div>${this.renderAttachments(email.attachments)}`;
      }
      case 'loading': return renderViewerLoading(this.localize('loadingDocument'));
      case 'error': return html`<div part="error">${this.fetchState.message()}</div>`;
      case 'idle': default: return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeEmail') })}</p>`;
    }
  }

  override render(): TemplateResult {
    const maxHeight = sanitizeCssLength(this.maxHeight);
    return html`<div part="base" role=${viewerSemanticRole(this, 'region') ?? nothing} style=${maxHeight ? styleMap({ '--lr-email-viewer-max-height': maxHeight }) : nothing} aria-label=${viewerSemanticLabel(this, normalizeLabel(this.name) ?? this.localize('emailViewerLabel')) ?? nothing} aria-busy=${this.fetchState.kind === 'loading' ? 'true' : 'false'}>${this.renderBody()}${this.renderAnchorLiveRegion()}</div>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-email-viewer': LyraEmailViewer; } }

import { normalizeLabel } from '../../../internal/accessible-name.js';
import { makeScrollRegionFocusable } from '../../../internal/scroll-region.js';
import { splitLines } from '../../../internal/text-lines.js';
import { bdi } from '../../../internal/bidi.js';
import { resolveLocalizedParts } from '../../../internal/localization-runtime.js';
import { ViewerSourceController, ViewerSourceUrlNotAllowedError, type ViewerSourceToken } from '../../../internal/viewer-source-controller.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { TextViewerTarget, type LyraSearchChangeDetail, type LyraTextViewerTargetEventMap } from '../../../internal/text-viewer-target.js';
import { LyraUserFacingError } from '../../../internal/resource-loader.js';
import { viewerFailureMessage } from '../../../internal/viewer-failure-message.js';
import { srOnly } from '../../../internal/a11y.js';
import { getListFormat } from '../../../internal/intl-cache.js';
import { resolveHeadingLevel, type LyraHeadingLevel } from '../../../internal/heading-level.js';
import { parseContactDocument, type VCardAddress, type VCardContact } from './vcard.js';
import { styles } from './contact-viewer.styles.js';
import { viewerFrameStyles } from '../viewer-frame.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
import { ViewerAnnouncementController } from '../viewer-announcements.js';
import { renderViewerLoading, viewerLoadingStyles } from '../viewer-loading.js';
import { viewerSemanticLabel, viewerSemanticRole } from '../viewer-semantic-owner.js';
import type { AnchorResultDetail, TextSelectDetail } from '../../../internal/document-anchors.js';
import { DeferredTeardown } from '../../../internal/deferred-teardown.js';
import { blankNumberConverter } from '../../../internal/converters.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_documentPreviewEmpty, LYRA_DEFAULT_scrollerLabel } from '../../../internal/default-strings/shared.generated.js';
import { LYRA_DEFAULT_contactViewerAddressFormat, LYRA_DEFAULT_contactViewerAddressLabel, LYRA_DEFAULT_contactViewerEmailLabel, LYRA_DEFAULT_contactViewerLabel, LYRA_DEFAULT_contactViewerNoContacts, LYRA_DEFAULT_contactViewerOrganization, LYRA_DEFAULT_contactViewerPhoneLabel, LYRA_DEFAULT_contactViewerTypeCell, LYRA_DEFAULT_contactViewerTypeFax, LYRA_DEFAULT_contactViewerTypeHome, LYRA_DEFAULT_contactViewerTypeInternet, LYRA_DEFAULT_contactViewerTypePreferred, LYRA_DEFAULT_contactViewerTypeVoice, LYRA_DEFAULT_contactViewerTypeWork, LYRA_DEFAULT_contactViewerTypedValue, LYRA_DEFAULT_contactViewerUnnamedContact, LYRA_DEFAULT_documentPreviewFailedToLoad, LYRA_DEFAULT_documentPreviewResourceTooLarge, LYRA_DEFAULT_documentPreviewTypeContact, LYRA_DEFAULT_documentPreviewUrlNotAllowed, LYRA_DEFAULT_loadingDocument } from '../../../internal/default-strings/viewers.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


type ContactFetchState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'loaded'; contacts: VCardContact[] } | { kind: 'empty' } | { kind: 'error'; message: () => string };
export interface LyraContactViewerEventMap extends LyraTextViewerTargetEventMap {
  'lr-load': CustomEvent<Record<string, never>>;
  'lr-render-error': CustomEvent<{ error: unknown }>;
  'lr-search-change': CustomEvent<LyraSearchChangeDetail>;
  'lr-anchor-result': CustomEvent<AnchorResultDetail>;
  'lr-text-select': CustomEvent<TextSelectDetail>;
}

class LyraContactViewerBase extends LyraElement<LyraContactViewerEventMap> {}

/**
 * Fetches a vCard document and renders one accessible card per contact. Contact names retain
 * level-three heading semantics by default; set `heading-level` from `1`–`6` to fit the surrounding
 * outline, or `none` for visual-only names. By default, at most 250 contacts and 2 MiB of rendered contact text
 * are accepted so eager DOM remains bounded while search, selection and text-quote anchors cover
 * every accepted contact. The inherited fragment path performs an exact DOM `id` lookup, but
 * generated contact cards have no fragment ids; such a jump reports `found: false`.
 *
 * @customElement lr-contact-viewer
 * @event lr-load - Fired after rendering a successfully parsed document. Bubbles and is composed with empty detail.
 * @event lr-render-error - Fired when fetching or parsing the document fails.
 * @event {CustomEvent<LyraSearchChangeDetail>} lr-search-change -
 *   Fired whenever search state changes. `matchCountExact=false` makes the retained count a lower
 *   bound. Bubbling, composed, and non-cancelable.
 * @event {CustomEvent<AnchorResultDetail>} lr-anchor-result - Fired after an `anchor` assignment or
 *   `scrollToAnchor()` call is applied. `detail: { found: boolean }`. Bubbling, composed, and
 *   non-cancelable.
 * @event {CustomEvent<TextSelectDetail>} lr-text-select - Fired after a selection ends inside the
 *   rendered contacts. `detail: { text: string; anchor: LyraAnchor | null; rects: DOMRect[] }`.
 *   Bubbling, composed, and non-cancelable.
 * @csspart base - The root container with explicit `aria-busy` loading state.
 * @csspart body - The wrapper around the fetched-state content.
 * @csspart contact - One rendered contact card.
 * @csspart contact-name - A contact's name heading at the configured semantic level.
 * @csspart contact-org - A contact's organization line, when present.
 * @csspart contact-tel - A contact's phone number list, when present.
 * @csspart contact-email - A contact's email list, when present.
 * @csspart contact-adr - A contact's address list, when present.
 * @csspart spinner - The visible tokenized loading treatment and ordinary text label.
 * @csspart error - The error region.
 * @cssprop [--lr-contact-viewer-max-height=none] - Maximum block size of the scrollable body before it scrolls internally. Also settable via the `max-height` property.
 * @status stable
 * @since 4.0.0
 */
export class LyraContactViewer extends TextViewerTarget(LyraContactViewerBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    anchorJumped: LYRA_DEFAULT_anchorJumped,
    anchorJumpedToPage: LYRA_DEFAULT_anchorJumpedToPage,
    anchorNotFound: LYRA_DEFAULT_anchorNotFound,
    contactViewerAddressFormat: LYRA_DEFAULT_contactViewerAddressFormat,
    contactViewerAddressLabel: LYRA_DEFAULT_contactViewerAddressLabel,
    contactViewerEmailLabel: LYRA_DEFAULT_contactViewerEmailLabel,
    contactViewerLabel: LYRA_DEFAULT_contactViewerLabel,
    contactViewerNoContacts: LYRA_DEFAULT_contactViewerNoContacts,
    contactViewerOrganization: LYRA_DEFAULT_contactViewerOrganization,
    contactViewerPhoneLabel: LYRA_DEFAULT_contactViewerPhoneLabel,
    contactViewerTypeCell: LYRA_DEFAULT_contactViewerTypeCell,
    contactViewerTypeFax: LYRA_DEFAULT_contactViewerTypeFax,
    contactViewerTypeHome: LYRA_DEFAULT_contactViewerTypeHome,
    contactViewerTypeInternet: LYRA_DEFAULT_contactViewerTypeInternet,
    contactViewerTypePreferred: LYRA_DEFAULT_contactViewerTypePreferred,
    contactViewerTypeVoice: LYRA_DEFAULT_contactViewerTypeVoice,
    contactViewerTypeWork: LYRA_DEFAULT_contactViewerTypeWork,
    contactViewerTypedValue: LYRA_DEFAULT_contactViewerTypedValue,
    contactViewerUnnamedContact: LYRA_DEFAULT_contactViewerUnnamedContact,
    documentPreviewEmpty: LYRA_DEFAULT_documentPreviewEmpty,
    documentPreviewFailedToLoad: LYRA_DEFAULT_documentPreviewFailedToLoad,
    documentPreviewResourceTooLarge: LYRA_DEFAULT_documentPreviewResourceTooLarge,
    documentPreviewTypeContact: LYRA_DEFAULT_documentPreviewTypeContact,
    documentPreviewUrlNotAllowed: LYRA_DEFAULT_documentPreviewUrlNotAllowed,
    loadingDocument: LYRA_DEFAULT_loadingDocument,
    scrollerLabel: LYRA_DEFAULT_scrollerLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, viewerFrameStyles, srOnly, viewerLoadingStyles];
  /** URL to fetch and parse as vCard text. */
  @property() src = '';
  /** Maximum admitted contacts (0–2,500, default 250). A larger document shows the resource-limit message. */
  // numeric-guard-exempt: parseContactDocument bounds this limit with finiteCount before parsing.
  @property({ converter: blankNumberConverter(250), attribute: 'max-contacts' }) maxContacts = 250;
  /** Optional display name for the source document. It names `[part='base']` when host
   *  `aria-label` is absent, before the localized fallback. A non-empty host label remains on the
   *  host; an explicitly empty one is preserved on the shadow owner. */
  @property() name = '';
  /** Semantic level of each rendered contact name. Use `none` for visual-only names; invalid
   *  untyped values use level 3. */
  @property({ attribute: 'heading-level', reflect: true })
  headingLevel: LyraHeadingLevel = '3';
  /** CSS length that caps the scrollable body; invalid values are ignored. */
  @property({ attribute: 'max-height' }) maxHeight = '';
  @state() private fetchState: ContactFetchState = { kind: 'idle' };
  private readonly transport = new ViewerSourceController(this, {
    load: (response, token) => this.readDocument(response, token),
    onError: error => {
      const failure = error instanceof ViewerSourceUrlNotAllowedError
        ? new LyraUserFacingError(this.localize('documentPreviewUrlNotAllowed'), localize => localize('documentPreviewUrlNotAllowed'))
        : error;
      this.fetchState = { kind: 'error', message: viewerFailureMessage(failure, this.localize.bind(this)) };
      this.emit('lr-render-error', { error: failure });
    },
  });
  private lastLoadSrc = '';
  private readonly announcements = new ViewerAnnouncementController(this);

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
    if (this.detached.cancel() && this.fetchState.kind !== 'loading') return;
    if (this.hasUpdated && this.src) {
      this.requestUpdate();
      if (this.src === this.lastLoadSrc) this.scheduleAfterUpdate(() => { void this.load(); });
    }
  }

  /** A same-task DOM move keeps the loaded document; a genuine disconnect invalidates its load. */
  private readonly detached = new DeferredTeardown(() => this.transport.cancel());

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

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.syncScrollRegion();
    this.announcements.transition(
      'load',
      this.fetchState.kind,
      this.fetchState.kind === 'error' ? this.fetchState.message() : this.localize('loadingDocument'),
    );
    if (changed.has('src') || changed.has('maxContacts')) this.scheduleAfterUpdate(() => { void this.load(); });
    if (this.isConnected && changed.has('fetchState') && (this.fetchState.kind === 'loaded' || this.fetchState.kind === 'empty')) this.emit('lr-load', {});
  }

  private load(): Promise<void> {
    this.lastLoadSrc = this.src;
    this.fetchState = this.src ? { kind: 'loading' } : { kind: 'idle' };
    return this.transport.begin(this.src);
  }

  private async readDocument(response: Response, token: ViewerSourceToken): Promise<void> {
    const source = await this.transport.readText(response);
    if (this.transport.isStale(token)) return;
    const contacts = parseContactDocument(source, this.maxContacts);
    this.fetchState = contacts.length ? { kind: 'loaded', contacts } : { kind: 'empty' };
  }

  private formatList(values: string[]): string {
    return getListFormat(this.effectiveLocale, { style: 'long', type: 'conjunction' }).format(values);
  }

  private formatAddress(address: VCardAddress): string {
    return splitLines(this.localize('contactViewerAddressFormat', undefined, {
      poBox: address.poBox,
      extendedAddress: address.extendedAddress,
      streetAddress: address.streetAddress,
      locality: address.locality,
      region: address.region,
      postalCode: address.postalCode,
      country: address.country,
    }))
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
  }

  private formatType(type: string): string {
    const key = {
      home: 'contactViewerTypeHome',
      work: 'contactViewerTypeWork',
      cell: 'contactViewerTypeCell',
      voice: 'contactViewerTypeVoice',
      fax: 'contactViewerTypeFax',
      internet: 'contactViewerTypeInternet',
      pref: 'contactViewerTypePreferred',
      preferred: 'contactViewerTypePreferred',
    }[type.toLowerCase()];
    return key ? this.localize(key) : type;
  }

  /** The caller value isolated inside the localized typed-value template, so its own direction
   *  cannot reorder the translated type list or its punctuation. */
  private renderTypedValue(value: string, types: string[]): TemplateResult {
    if (!types.length) return bdi(value);
    return this.renderIsolatedValue('contactViewerTypedValue', value, {
      types: this.formatList(types.map((type) => this.formatType(type))),
    });
  }

  private renderIsolatedValue(key: 'contactViewerTypedValue' | 'contactViewerOrganization', value: string,
    values: Record<string, string> = {}): TemplateResult {
    const pieces = resolveLocalizedParts(this.localize(key), (marker) =>
      this.localize(key, undefined, { ...values, value: marker }));
    return html`${pieces.map((piece, index) => index < pieces.length - 1 ? html`${piece}${bdi(value)}` : piece)}`;
  }

  private renderContact(contact: VCardContact): TemplateResult {
    const headingLevel = resolveHeadingLevel(this.headingLevel);
    return html`<article part="contact">
      <div
        part="contact-name"
        role=${headingLevel ? 'heading' : nothing}
        aria-level=${headingLevel ?? nothing}
      >${bdi(contact.fn || this.localize('contactViewerUnnamedContact'))}</div>
      ${contact.org.length ? html`<p part="contact-org">${this.renderIsolatedValue('contactViewerOrganization', this.formatList(contact.org))}</p>` : nothing}
      ${contact.tel.length ? html`<ul part="contact-tel" aria-label=${this.localize('contactViewerPhoneLabel')}>${contact.tel.map((tel) => html`<li>${this.renderTypedValue(tel.value, tel.types)}</li>`)}</ul>` : nothing}
      ${contact.email.length ? html`<ul part="contact-email" aria-label=${this.localize('contactViewerEmailLabel')}>${contact.email.map((email) => html`<li>${this.renderTypedValue(email.value, email.types)}</li>`)}</ul>` : nothing}
      ${contact.adr.length ? html`<ul part="contact-adr" aria-label=${this.localize('contactViewerAddressLabel')}>${contact.adr.map((address) => html`<li>${this.renderTypedValue(this.formatAddress(address), address.types)}</li>`)}</ul>` : nothing}
    </article>`;
  }

  private renderBody(): TemplateResult {
    switch (this.fetchState.kind) {
      case 'loaded': return html`${this.fetchState.contacts.map((contact) => this.renderContact(contact))}`;
      case 'loading': return renderViewerLoading(this.localize('loadingDocument'));
      // A well-formed vCard document with zero VCARD records is a distinct, non-error state --
      // it must not be funneled into the same error chrome/assertive announcement as a genuine fetch/parse
      // failure (matching <lr-calendar-viewer>'s identical zero-events handling).
      case 'empty': return html`<p class="empty-note">${this.localize('contactViewerNoContacts')}</p>`;
      case 'error': return html`<div part="error">${this.fetchState.message()}</div>`;
      case 'idle':
      default: return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeContact') })}</p>`;
    }
  }

  /** Only the loaded content is searchable and quotable, never the empty-note, spinner or error text. */
  protected override textContentRoot(): Element | null {
    return this.fetchState.kind === 'loaded' ? super.textContentRoot() : null;
  }

  override render(): TemplateResult {
    const maxHeight = sanitizeCssLength(this.maxHeight);
    return html`<div part="base" role=${viewerSemanticRole(this, 'region') ?? nothing} style=${maxHeight ? styleMap({ '--lr-contact-viewer-max-height': maxHeight }) : nothing} aria-label=${viewerSemanticLabel(this, normalizeLabel(this.name) ?? this.localize('contactViewerLabel')) ?? nothing} aria-busy=${this.fetchState.kind === 'loading' ? 'true' : 'false'}><div part="body">${this.renderBody()}</div>${this.renderAnchorLiveRegion()}</div>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-contact-viewer': LyraContactViewer; } }

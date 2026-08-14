import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { TextViewerTarget, type LyraTextViewerTargetEventMap } from '../../../internal/text-viewer-target.js';
import { isAbortError, isResourceLimitError, LyraUserFacingError, readResponseText, resolveOwnerFetchTarget } from '../../../internal/resource-loader.js';
import { hostAriaLabel, srOnly } from '../../../internal/a11y.js';
import { getListFormat } from '../../../internal/intl-cache.js';
import { resolveHeadingLevel, type LyraHeadingLevel } from '../../../internal/heading-level.js';
import { parseVCards, type VCardAddress, type VCardContact } from './vcard.js';
import { styles } from './contact-viewer.styles.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
import { ViewerAnnouncementController } from '../viewer-announcements.js';
import type { AnchorResultDetail, TextSelectDetail } from '../document-viewer/anchors.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_collapse, LYRA_DEFAULT_contactViewerAddressFormat, LYRA_DEFAULT_contactViewerAddressLabel, LYRA_DEFAULT_contactViewerEmailLabel, LYRA_DEFAULT_contactViewerLabel, LYRA_DEFAULT_contactViewerNoContacts, LYRA_DEFAULT_contactViewerOrganization, LYRA_DEFAULT_contactViewerPhoneLabel, LYRA_DEFAULT_contactViewerTypeCell, LYRA_DEFAULT_contactViewerTypeFax, LYRA_DEFAULT_contactViewerTypeHome, LYRA_DEFAULT_contactViewerTypeInternet, LYRA_DEFAULT_contactViewerTypePreferred, LYRA_DEFAULT_contactViewerTypeVoice, LYRA_DEFAULT_contactViewerTypeWork, LYRA_DEFAULT_contactViewerTypedValue, LYRA_DEFAULT_contactViewerUnnamedContact, LYRA_DEFAULT_details, LYRA_DEFAULT_documentPreviewEmpty, LYRA_DEFAULT_documentPreviewFailedToLoad, LYRA_DEFAULT_documentPreviewResourceTooLarge, LYRA_DEFAULT_documentPreviewTypeContact, LYRA_DEFAULT_documentPreviewUrlNotAllowed, LYRA_DEFAULT_loading, LYRA_DEFAULT_loadingDocument, LYRA_DEFAULT_open } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


type ContactFetchState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'loaded'; contacts: VCardContact[] } | { kind: 'empty' } | { kind: 'error'; message: string };
export interface LyraContactViewerEventMap extends LyraTextViewerTargetEventMap {
  'lr-render-error': CustomEvent<{ error: unknown }>;
  'lr-search-change': CustomEvent<{ query: string; matchCount: number; activeIndex: number }>;
  'lr-anchor-result': CustomEvent<AnchorResultDetail>;
  'lr-text-select': CustomEvent<TextSelectDetail>;
}

class LyraContactViewerBase extends LyraElement<LyraContactViewerEventMap> {}

/**
 * Fetches a vCard document and renders one accessible card per contact. Contact names retain
 * level-three heading semantics by default; set `heading-level` from `1`–`6` to fit the surrounding
 * outline, or `none` for visual-only names.
 *
 * @customElement lr-contact-viewer
 * @event lr-render-error - Fired when fetching or parsing the document fails.
 * @event {CustomEvent<{ query: string; matchCount: number; activeIndex: number }>} lr-search-change -
 *   Fired whenever search state changes. `detail: { query: string; matchCount: number;
 *   activeIndex: number }`. Bubbling, composed, and non-cancelable.
 * @event {CustomEvent<AnchorResultDetail>} lr-anchor-result - Fired after an `anchor` assignment or
 *   `scrollToAnchor()` call is applied. `detail: { found: boolean }`. Bubbling, composed, and
 *   non-cancelable.
 * @event {CustomEvent<TextSelectDetail>} lr-text-select - Fired after a selection ends inside the
 *   rendered contacts. `detail: { text: string; anchor: LyraAnchor | null; rects: DOMRect[] }`.
 *   Bubbling, composed, and non-cancelable.
 * @csspart base - The root container.
 * @csspart body - The wrapper around the fetched-state content.
 * @csspart contact - One rendered contact card.
 * @csspart contact-name - A contact's name heading at the configured semantic level.
 * @csspart contact-org - A contact's organization line, when present.
 * @csspart contact-tel - A contact's phone number list, when present.
 * @csspart contact-email - A contact's email list, when present.
 * @csspart contact-adr - A contact's address list, when present.
 * @csspart spinner - The loading region.
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
    collapse: LYRA_DEFAULT_collapse,
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
    details: LYRA_DEFAULT_details,
    documentPreviewEmpty: LYRA_DEFAULT_documentPreviewEmpty,
    documentPreviewFailedToLoad: LYRA_DEFAULT_documentPreviewFailedToLoad,
    documentPreviewResourceTooLarge: LYRA_DEFAULT_documentPreviewResourceTooLarge,
    documentPreviewTypeContact: LYRA_DEFAULT_documentPreviewTypeContact,
    documentPreviewUrlNotAllowed: LYRA_DEFAULT_documentPreviewUrlNotAllowed,
    loading: LYRA_DEFAULT_loading,
    loadingDocument: LYRA_DEFAULT_loadingDocument,
    open: LYRA_DEFAULT_open,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];
  /** URL to fetch and parse as vCard text. */
  @property() src = '';
  /** Optional display name for the source document. Used as the accessible name of
   *  `[part='base']` when the host has no `aria-label`, and before the localized
   *  `contactViewerLabel` default. Host `aria-label` wins by attribute presence, including an
   *  empty value. */
  @property() name = '';
  /** Semantic level of each rendered contact name. Use `none` for visual-only names; invalid
   *  untyped values use level 3. */
  @property({ attribute: 'heading-level', reflect: true })
  headingLevel: LyraHeadingLevel = '3';
  /** CSS length that caps the scrollable body. */
  /** A CSS `max-height`; invalid values are ignored. */
  @property({ attribute: 'max-height' }) maxHeight = '';
  /** Shared text search and anchor-target API for the rendered contact cards. */
  override async search(query: string): Promise<number> { return super.search(query); }
  override async searchNext(): Promise<boolean> { return super.searchNext(); }
  override async searchPrevious(): Promise<boolean> { return super.searchPrevious(); }
  override clearSearch(): void { super.clearSearch(); }
  @state() private fetchState: ContactFetchState = { kind: 'idle' };
  private generation = 0;
  private lastLoadSrc = '';
  private readonly announcements = new ViewerAnnouncementController(this);

  override connectedCallback(): void {
    super.connectedCallback();
    this.announcements.connect();
    if (this.hasUpdated && this.src) {
      this.requestUpdate();
      if (this.src === this.lastLoadSrc) this.scheduleAfterUpdate(() => { void this.load(); });
    }
  }

  override disconnectedCallback(): void {
    this.generation++;
    this.announcements.disconnect();
    super.disconnectedCallback();
  }

  adoptedCallback(): void {
    this.announcements.adopted();
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
    this.lastLoadSrc = this.src;
    const generation = ++this.generation;
    const signal = this.beginAbortableLoad();
    if (!this.src) { this.fetchState = { kind: 'idle' }; return; }
    const fetchTarget = resolveOwnerFetchTarget(this, this.src);
    if (!fetchTarget) {
      const error = new LyraUserFacingError(this.localize('documentPreviewUrlNotAllowed'));
      this.fetchState = { kind: 'error', message: error.message };
      this.emit('lr-render-error', { error });
      return;
    }
    this.fetchState = { kind: 'loading' };
    try {
      const response = await fetchTarget.view.fetch(fetchTarget.url, signal ? { signal } : undefined);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const source = await readResponseText(response);
      if (!this.isConnected || generation !== this.generation) return;
      const contacts = parseVCards(source);
      if (generation === this.generation) this.fetchState = contacts.length ? { kind: 'loaded', contacts } : { kind: 'empty' };
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.fetchState = { kind: 'error', message: error instanceof LyraUserFacingError ? error.message : this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad') };
      this.emit('lr-render-error', { error });
    }
  }

  private formatList(values: string[]): string {
    return getListFormat(this.effectiveLocale, { style: 'long', type: 'conjunction' }).format(values);
  }

  private formatAddress(address: VCardAddress): string {
    return this.localize('contactViewerAddressFormat', undefined, {
      poBox: address.poBox,
      extendedAddress: address.extendedAddress,
      streetAddress: address.streetAddress,
      locality: address.locality,
      region: address.region,
      postalCode: address.postalCode,
      country: address.country,
    })
      .split(/\r\n|\r|\n/)
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

  private formatTypedValue(value: string, types: string[]): string {
    if (!types.length) return value;
    return this.localize('contactViewerTypedValue', undefined, {
      value,
      types: this.formatList(types.map((type) => this.formatType(type))),
    });
  }

  private renderContact(contact: VCardContact): TemplateResult {
    const headingLevel = resolveHeadingLevel(this.headingLevel);
    return html`<article part="contact">
      <div
        part="contact-name"
        role=${headingLevel ? 'heading' : nothing}
        aria-level=${headingLevel ?? nothing}
      >${contact.fn || this.localize('contactViewerUnnamedContact')}</div>
      ${contact.org.length ? html`<p part="contact-org">${this.localize('contactViewerOrganization', undefined, { value: this.formatList(contact.org) })}</p>` : nothing}
      ${contact.tel.length ? html`<ul part="contact-tel" aria-label=${this.localize('contactViewerPhoneLabel')}>${contact.tel.map((tel) => html`<li>${this.formatTypedValue(tel.value, tel.types)}</li>`)}</ul>` : nothing}
      ${contact.email.length ? html`<ul part="contact-email" aria-label=${this.localize('contactViewerEmailLabel')}>${contact.email.map((email) => html`<li>${this.formatTypedValue(email.value, email.types)}</li>`)}</ul>` : nothing}
      ${contact.adr.length ? html`<ul part="contact-adr" aria-label=${this.localize('contactViewerAddressLabel')}>${contact.adr.map((address) => html`<li>${this.formatTypedValue(this.formatAddress(address), address.types)}</li>`)}</ul>` : nothing}
    </article>`;
  }

  private renderBody(): TemplateResult {
    switch (this.fetchState.kind) {
      case 'loaded': return html`${this.fetchState.contacts.map((contact) => this.renderContact(contact))}`;
      case 'loading': return html`<div part="spinner"><span class="sr-only">${this.localize('loadingDocument')}</span></div>`;
      // A well-formed vCard document with zero VCARD records is a distinct, non-error state --
      // it must not be funneled into the same error chrome/assertive announcement as a genuine fetch/parse
      // failure (matching <lr-calendar-viewer>'s identical zero-events handling).
      case 'empty': return html`<p class="empty-note">${this.localize('contactViewerNoContacts')}</p>`;
      case 'error': return html`<div part="error">${this.fetchState.message}</div>`;
      case 'idle':
      default: return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeContact') })}</p>`;
    }
  }

  override render(): TemplateResult {
    const maxHeight = sanitizeCssLength(this.maxHeight);
    return html`<div part="base" role="region" style=${maxHeight ? styleMap({ '--lr-contact-viewer-max-height': maxHeight }) : nothing} aria-label=${hostAriaLabel(this) ?? (this.name || this.localize('contactViewerLabel'))}><div part="body">${this.renderBody()}</div>${this.renderAnchorLiveRegion()}</div>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-contact-viewer': LyraContactViewer; } }

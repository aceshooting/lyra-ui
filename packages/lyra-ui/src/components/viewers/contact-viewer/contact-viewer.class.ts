import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { TextViewerTarget, type LyraTextViewerTargetEventMap } from '../../../internal/text-viewer-target.js';
import { safeFetchUrl } from '../../../internal/safe-url.js';
import { isAbortError, isResourceLimitError, LyraUserFacingError, readResponseText } from '../../../internal/resource-loader.js';
import { srOnly } from '../../../internal/a11y.js';
import { getListFormat } from '../../../internal/intl-cache.js';
import { parseVCards, type VCardAddress, type VCardContact } from './vcard.js';
import { styles } from './contact-viewer.styles.js';

type ContactFetchState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'loaded'; contacts: VCardContact[] } | { kind: 'empty' } | { kind: 'error'; message: string };
export interface LyraContactViewerEventMap extends LyraTextViewerTargetEventMap { 'lr-render-error': CustomEvent<{ error: unknown }>; }

class LyraContactViewerBase extends LyraElement<LyraContactViewerEventMap> {}

/**
 * Fetches a vCard document and renders one accessible card per contact.
 *
 * @customElement lr-contact-viewer
 * @event lr-render-error - Fired when fetching or parsing the document fails.
 * @csspart base - The root container.
 * @csspart body - The wrapper around the fetched-state content.
 * @csspart contact - One rendered contact card.
 * @csspart contact-name - A contact's name heading.
 * @csspart contact-org - A contact's organization line, when present.
 * @csspart contact-tel - A contact's phone number list, when present.
 * @csspart contact-email - A contact's email list, when present.
 * @csspart contact-adr - A contact's address list, when present.
 * @csspart spinner - The loading region.
 * @csspart error - The error region.
 * @cssprop [--lr-contact-viewer-max-height=none] - Maximum block size of the scrollable body before it scrolls internally. Also settable via the `max-height` property.
 */
export class LyraContactViewer extends TextViewerTarget(LyraContactViewerBase) {
  static override styles = [LyraElement.styles, styles, srOnly];
  /** URL to fetch and parse as vCard text. */
  @property() src = '';
  /** Optional display name for the source document. Used as the accessible
   *  name of `[part='base']` after a host `aria-label`, and before
   *  the localized `contactViewerLabel` default, matching the
   *  `csvViewerLabel`-style sibling document viewers. */
  @property() name = '';
  /** CSS length that caps the scrollable body. */
  @property({ attribute: 'max-height' }) maxHeight = '';
  /** Shared text search and anchor-target API for the rendered contact cards. */
  override async search(query: string): Promise<number> { return super.search(query); }
  override async searchNext(): Promise<boolean> { return super.searchNext(); }
  override async searchPrevious(): Promise<boolean> { return super.searchPrevious(); }
  override clearSearch(): void { super.clearSearch(); }
  @state() private fetchState: ContactFetchState = { kind: 'idle' };
  private generation = 0;
  private lastLoadSrc = '';

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated && this.src) {
      this.requestUpdate();
      if (this.src === this.lastLoadSrc) this.scheduleAfterUpdate(() => { void this.load(); });
    }
  }

  override disconnectedCallback(): void {
    this.generation++;
    super.disconnectedCallback();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('src')) this.scheduleAfterUpdate(() => { void this.load(); });
  }

  private async load(): Promise<void> {
    this.lastLoadSrc = this.src;
    const generation = ++this.generation;
    const signal = this.beginAbortableLoad();
    if (!this.src) { this.fetchState = { kind: 'idle' }; return; }
    const url = safeFetchUrl(this.src);
    if (!url) {
      const error = new LyraUserFacingError(this.localize('documentPreviewUrlNotAllowed'));
      this.fetchState = { kind: 'error', message: error.message };
      this.emit('lr-render-error', { error });
      return;
    }
    this.fetchState = { kind: 'loading' };
    try {
      const response = await fetch(url, signal ? { signal } : undefined);
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
    return html`<article part="contact">
      <h3 part="contact-name">${contact.fn || this.localize('contactViewerUnnamedContact')}</h3>
      ${contact.org.length ? html`<p part="contact-org">${this.localize('contactViewerOrganization', undefined, { value: this.formatList(contact.org) })}</p>` : nothing}
      ${contact.tel.length ? html`<ul part="contact-tel" aria-label=${this.localize('contactViewerPhoneLabel')}>${contact.tel.map((tel) => html`<li>${this.formatTypedValue(tel.value, tel.types)}</li>`)}</ul>` : nothing}
      ${contact.email.length ? html`<ul part="contact-email" aria-label=${this.localize('contactViewerEmailLabel')}>${contact.email.map((email) => html`<li>${this.formatTypedValue(email.value, email.types)}</li>`)}</ul>` : nothing}
      ${contact.adr.length ? html`<ul part="contact-adr" aria-label=${this.localize('contactViewerAddressLabel')}>${contact.adr.map((address) => html`<li>${this.formatTypedValue(this.formatAddress(address), address.types)}</li>`)}</ul>` : nothing}
    </article>`;
  }

  private renderBody(): TemplateResult {
    switch (this.fetchState.kind) {
      case 'loaded': return html`${this.fetchState.contacts.map((contact) => this.renderContact(contact))}`;
      case 'loading': return html`<div part="spinner" role="status"><span class="sr-only">${this.localize('loadingDocument')}</span></div>`;
      // A well-formed vCard document with zero VCARD records is a distinct, non-error state --
      // it must not be funneled into the same role="alert" chrome as a genuine fetch/parse
      // failure (matching <lr-calendar-viewer>'s identical zero-events handling).
      case 'empty': return html`<p class="empty-note">${this.localize('contactViewerNoContacts')}</p>`;
      case 'error': return html`<div part="error" role="alert">${this.fetchState.message}</div>`;
      case 'idle':
      default: return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeContact') })}</p>`;
    }
  }

  override render(): TemplateResult { return html`<div part="base" role="region" style=${this.maxHeight ? `--lr-contact-viewer-max-height:${this.maxHeight}` : nothing} aria-label=${this.getAttribute('aria-label') || this.name || this.localize('contactViewerLabel')}><div part="body">${this.renderBody()}</div>${this.renderAnchorLiveRegion()}</div>`; }
}

declare global { interface HTMLElementTagNameMap { 'lr-contact-viewer': LyraContactViewer; } }

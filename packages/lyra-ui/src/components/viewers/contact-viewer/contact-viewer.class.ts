import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { TextViewerTarget, type LyraTextViewerTargetEventMap } from '../../../internal/text-viewer-target.js';
import { safeFetchUrl } from '../../../internal/safe-url.js';
import { isAbortError, isResourceLimitError, LyraUserFacingError, readResponseText } from '../../../internal/resource-loader.js';
import { srOnly } from '../../../internal/a11y.js';
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
   *  name of `[part='base']`, falling back to a host `aria-label` and then
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
      const contacts = parseVCards(await readResponseText(response));
      if (generation === this.generation) this.fetchState = contacts.length ? { kind: 'loaded', contacts } : { kind: 'empty' };
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.fetchState = { kind: 'error', message: error instanceof LyraUserFacingError ? error.message : this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad') };
      this.emit('lr-render-error', { error });
    }
  }

  private formatAddress(address: VCardAddress): string { return [address.streetAddress, address.locality, address.region, address.postalCode, address.country].filter(Boolean).join(', '); }

  private renderContact(contact: VCardContact): TemplateResult {
    return html`<article part="contact">
      <h3 part="contact-name">${contact.fn || this.localize('contactViewerUnnamedContact')}</h3>
      ${contact.org.length ? html`<p part="contact-org"><span class="field-label">${this.localize('contactViewerOrganizationLabel')} </span>${contact.org.join(', ')}</p>` : nothing}
      ${contact.tel.length ? html`<ul part="contact-tel" aria-label=${this.localize('contactViewerPhoneLabel')}>${contact.tel.map((tel) => html`<li>${tel.value}${tel.types.length ? html` <span class="type">(${tel.types.join(', ')})</span>` : nothing}</li>`)}</ul>` : nothing}
      ${contact.email.length ? html`<ul part="contact-email" aria-label=${this.localize('contactViewerEmailLabel')}>${contact.email.map((email) => html`<li>${email.value}${email.types.length ? html` <span class="type">(${email.types.join(', ')})</span>` : nothing}</li>`)}</ul>` : nothing}
      ${contact.adr.length ? html`<ul part="contact-adr" aria-label=${this.localize('contactViewerAddressLabel')}>${contact.adr.map((address) => html`<li>${this.formatAddress(address)}</li>`)}</ul>` : nothing}
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

  override render(): TemplateResult { return html`<div part="base" style=${this.maxHeight ? `--lr-contact-viewer-max-height:${this.maxHeight}` : nothing} aria-label=${this.getAttribute('aria-label') || this.name || this.localize('contactViewerLabel')}><div part="body">${this.renderBody()}</div>${this.renderAnchorLiveRegion()}</div>`; }
}

declare global { interface HTMLElementTagNameMap { 'lr-contact-viewer': LyraContactViewer; } }

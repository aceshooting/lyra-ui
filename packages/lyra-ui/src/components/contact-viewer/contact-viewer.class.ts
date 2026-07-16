import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { safeFetchUrl } from '../../internal/safe-url.js';
import { isAbortError, isResourceLimitError, LyraUserFacingError, readResponseText } from '../../internal/resource-loader.js';
import { srOnly } from '../../internal/a11y.js';
import { parseVCards, type VCardAddress, type VCardContact } from './vcard.js';
import { styles } from './contact-viewer.styles.js';

type ContactFetchState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'loaded'; contacts: VCardContact[] } | { kind: 'error'; message: string };
export interface LyraContactViewerEventMap { 'lyra-render-error': CustomEvent<{ error: unknown }>; }

/** Fetches a vCard document and renders one accessible card per contact. */
export class LyraContactViewer extends LyraElement<LyraContactViewerEventMap> {
  static styles = [LyraElement.styles, styles, srOnly];
  /** URL to fetch and parse as vCard text. */
  @property() src = '';
  /** Optional display name for the source document. */
  @property() name = '';
  /** CSS length that caps the scrollable body. */
  @property({ attribute: 'max-height' }) maxHeight = '';
  @state() private fetchState: ContactFetchState = { kind: 'idle' };
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
      const contacts = parseVCards(await readResponseText(response));
      if (!contacts.length) throw new LyraUserFacingError(this.localize('contactViewerNoContacts'));
      if (generation === this.generation) this.fetchState = { kind: 'loaded', contacts };
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.fetchState = { kind: 'error', message: error instanceof LyraUserFacingError ? error.message : this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad') };
      this.emit('lyra-render-error', { error });
    }
  }

  private formatAddress(address: VCardAddress): string { return [address.streetAddress, address.locality, address.region, address.postalCode, address.country].filter(Boolean).join(', '); }

  private renderContact(contact: VCardContact): TemplateResult {
    return html`<article part="contact">
      <h3 part="contact-name">${contact.fn || this.localize('contactViewerUnnamedContact')}</h3>
      ${contact.org.length ? html`<p part="contact-org"><span class="field-label">${this.localize('contactViewerOrganizationLabel')}: </span>${contact.org.join(', ')}</p>` : nothing}
      ${contact.tel.length ? html`<ul part="contact-tel" aria-label=${this.localize('contactViewerPhoneLabel')}>${contact.tel.map((tel) => html`<li>${tel.value}${tel.types.length ? html` <span class="type">(${tel.types.join(', ')})</span>` : nothing}</li>`)}</ul>` : nothing}
      ${contact.email.length ? html`<ul part="contact-email" aria-label=${this.localize('contactViewerEmailLabel')}>${contact.email.map((email) => html`<li>${email.value}${email.types.length ? html` <span class="type">(${email.types.join(', ')})</span>` : nothing}</li>`)}</ul>` : nothing}
      ${contact.adr.length ? html`<ul part="contact-adr" aria-label=${this.localize('contactViewerAddressLabel')}>${contact.adr.map((address) => html`<li>${this.formatAddress(address)}</li>`)}</ul>` : nothing}
    </article>`;
  }

  private renderBody(): TemplateResult {
    switch (this.fetchState.kind) {
      case 'loaded': return html`${this.fetchState.contacts.map((contact) => this.renderContact(contact))}`;
      case 'loading': return html`<div part="spinner" role="status"><span class="sr-only">${this.localize('loadingDocument')}</span></div>`;
      case 'error': return html`<div part="error" role="alert">${this.fetchState.message}</div>`;
      case 'idle':
      default: return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeContact') })}</p>`;
    }
  }

  render(): TemplateResult { return html`<div part="base" style=${this.maxHeight ? `--lyra-contact-viewer-max-height:${this.maxHeight}` : nothing}><div part="body">${this.renderBody()}</div></div>`; }
}

declare global { interface HTMLElementTagNameMap { 'lyra-contact-viewer': LyraContactViewer; } }

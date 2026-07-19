import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import './contact-viewer.js';
import type { LyraContactViewer } from './contact-viewer.js';

const CARD = ['BEGIN:VCARD', 'VERSION:4.0', 'FN:John Q. Public', 'ORG:ABC, Inc.', 'TEL;TYPE=work:+1-404', 'EMAIL;TYPE=work:john@example.com', 'ADR;TYPE=work:;;Main Street;Town;CA;123;USA', 'END:VCARD'].join('\r\n');
function response(body: string): Response { return { ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve(body) } as Response; }

describe('lr-contact-viewer', () => {
  it('renders a localized empty state by default', async () => {
    const el = (await fixture(html`<lr-contact-viewer></lr-contact-viewer>`)) as LyraContactViewer;
    expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('No contact to display.');
  });
  it('renders contact fields and multiple cards', async () => {
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response(`${CARD}\r\nBEGIN:VCARD\r\nFN:Second\r\nEND:VCARD`))) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lr-contact-viewer src="https://example.test/a.vcf"></lr-contact-viewer>`)) as LyraContactViewer;
      await aTimeout(20);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="contact"]') !== null);
      await el.updateComplete;
      expect(el.shadowRoot!.querySelectorAll('[part="contact"]')).to.have.length(2);
      expect(el.shadowRoot!.querySelector('[part="contact-name"]')!.textContent).to.equal('John Q. Public');
      expect(el.shadowRoot!.querySelector('[part="contact-org"]')!.textContent).to.contain('ABC, Inc.');
      expect(el.shadowRoot!.querySelector('[part="contact-tel"]')!.textContent).to.contain('+1-404');
      expect(el.shadowRoot!.querySelector('[part="contact-email"]')!.textContent).to.contain('john@example.com');
      expect(el.shadowRoot!.querySelector('[part="contact-adr"]')!.textContent).to.contain('Main Street');
    } finally { window.fetch = original; }
  });
  it('shows the no-contact error for invalid content', async () => {
    const original = window.fetch; window.fetch = (() => Promise.resolve(response('not vcard'))) as typeof window.fetch;
    try { const el = (await fixture(html`<lr-contact-viewer src="https://example.test/a.vcf"></lr-contact-viewer>`)) as LyraContactViewer; await aTimeout(20); await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null); await el.updateComplete; expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('No contacts found in this file.'); } finally { window.fetch = original; }
  });
  it('is accessible', async () => { const el = await fixture(html`<lr-contact-viewer></lr-contact-viewer>`); await expect(el).to.be.accessible(); });
  it('uses name as the accessible name, falling back to a host aria-label and then a localized default', async () => {
    const named = (await fixture(html`<lr-contact-viewer name="contacts.vcf"></lr-contact-viewer>`)) as LyraContactViewer;
    expect(named.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('contacts.vcf');
    const labeled = (await fixture(html`<lr-contact-viewer aria-label="Team contacts"></lr-contact-viewer>`)) as LyraContactViewer;
    expect(labeled.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Team contacts');
    const unnamed = (await fixture(html`<lr-contact-viewer></lr-contact-viewer>`)) as LyraContactViewer;
    expect(unnamed.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Contact viewer');
  });
  it('supports a .strings override for the contactViewerLabel fallback', async () => {
    const el = (await fixture(html`<lr-contact-viewer .strings=${{ contactViewerLabel: 'Visionneuse de contacts' }}></lr-contact-viewer>`)) as LyraContactViewer;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Visionneuse de contacts');
  });
});

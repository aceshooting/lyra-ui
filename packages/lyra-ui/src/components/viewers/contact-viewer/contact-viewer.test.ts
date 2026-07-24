import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './contact-viewer.js';
import type { LyraContactViewer } from './contact-viewer.js';
import { getDefaultDocumentRendererRegistry } from '../document-viewer/registry.js';
import type { LyraHighlight } from '../document-viewer/anchors.js';

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
  it('formats organization, type, and address lists with the effective locale', async () => {
    const original = window.fetch;
    const source = ['BEGIN:VCARD', 'VERSION:4.0', 'FN:Ada', 'ORG:Research;Analysis', 'TEL;TYPE=work,voice:+352', 'ADR:;;Street;Town;Region;123;Country', 'END:VCARD'].join('\r\n');
    window.fetch = (() => Promise.resolve(response(source))) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lr-contact-viewer lang="en" src="https://example.test/a.vcf"></lr-contact-viewer>`)) as LyraContactViewer;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="contact"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="contact-org"]')!.textContent).to.contain('Research and Analysis');
      expect(el.shadowRoot!.querySelector('[part="contact-tel"]')!.textContent).to.equal('+352 (Work and Voice)');
      expect(el.shadowRoot!.querySelector('[part="contact-adr"]')!.textContent).to.contain('Street\nTown Region 123\nCountry');
    } finally { window.fetch = original; }
  });
  it('lets whole-message overrides reorder postal fields and typed values', async () => {
    const original = window.fetch;
    const source = ['BEGIN:VCARD', 'VERSION:4.0', 'FN:Ada', 'ORG:Research;Analysis', 'TEL;TYPE=work,custom:+352', 'ADR;TYPE=work:PO 9;Building A;Street;Town;Region;123;Country', 'END:VCARD'].join('\r\n');
    window.fetch = (() => Promise.resolve(response(source))) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lr-contact-viewer
        src="https://example.test/a.vcf"
        .strings=${{
          contactViewerOrganization: '{value} — organisation',
          contactViewerTypedValue: '{types}: {value}',
          contactViewerAddressFormat: '{country}\n{postalCode} {locality}\n{streetAddress}\n{extendedAddress}\n{poBox}',
          contactViewerTypeWork: 'Travail',
        }}
      ></lr-contact-viewer>`)) as LyraContactViewer;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="contact"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="contact-org"]')!.textContent).to.equal('Research and Analysis — organisation');
      expect(el.shadowRoot!.querySelector('[part="contact-tel"]')!.textContent).to.equal('Travail and custom: +352');
      expect(el.shadowRoot!.querySelector('[part="contact-adr"]')!.textContent).to.equal(
        'Travail: Country\n123 Town\nStreet\nBuilding A\nPO 9',
      );
    } finally { window.fetch = original; }
  });
  it('shows a neutral empty-note, not the role="alert" error chrome, for a vCard with zero contacts', async () => {
    // Regression test: a syntactically valid (or merely content-free) vCard document with zero
    // VCARD records used to throw the same LyraUserFacingError funneled through the generic catch
    // block into `case 'error'` -- role="alert" and error-styled chrome for a state that isn't
    // actually a failure (matching <lr-calendar-viewer>'s identical zero-events handling).
    const original = window.fetch; window.fetch = (() => Promise.resolve(response('not vcard'))) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lr-contact-viewer></lr-contact-viewer>`)) as LyraContactViewer;
      let renderErrors = 0;
      el.addEventListener('lr-render-error', () => { renderErrors++; });
      el.src = 'https://example.test/a.vcf';
      await aTimeout(20);
      await waitUntil(() => el.shadowRoot!.querySelector('.empty-note') !== null);
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('No contacts found in this file.');
      expect(el.shadowRoot!.querySelectorAll('[part="error"]')).to.have.lengthOf(0);
      expect(renderErrors).to.equal(0);
    } finally { window.fetch = original; }
  });
  it('is accessible', async () => { const el = await fixture(html`<lr-contact-viewer></lr-contact-viewer>`); await expect(el).to.be.accessible(); });
  it('is accessible with contact cards populated, not only the bare empty default', async () => {
    // The default-render axe check above only ever mounts the bare idle state -- a regression in
    // the actually-rendered contact cards (name/org/tel/email/adr lists and their aria-labels)
    // would be invisible to it.
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response(`${CARD}\r\nBEGIN:VCARD\r\nFN:Second\r\nEND:VCARD`))) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lr-contact-viewer src="https://example.test/a.vcf"></lr-contact-viewer>`)) as LyraContactViewer;
      await aTimeout(20);
      await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="contact"]').length === 2);
      await el.updateComplete;
      await expect(el).to.be.accessible();
    } finally { window.fetch = original; }
  });
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
  it('emits exactly one render error for an unsafe URL', async () => {
    const el = (await fixture(html`<lr-contact-viewer></lr-contact-viewer>`)) as LyraContactViewer;
    let count = 0;
    el.addEventListener('lr-render-error', () => { count++; });
    const event = oneEvent(el, 'lr-render-error');
    el.src = 'javascript:alert(1)';
    await event;
    await aTimeout(0);
    expect(count).to.equal(1);
  });
  it('reloads after reconnect and exposes its accessible name on a region', async () => {
    const original = window.fetch;
    let calls = 0;
    window.fetch = (() => { calls++; return Promise.resolve(response(CARD)); }) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lr-contact-viewer src="https://example.test/a.vcf"></lr-contact-viewer>`)) as LyraContactViewer;
      await waitUntil(() => calls === 1 && el.shadowRoot!.querySelector('[part="contact"]') !== null);
      const parent = el.parentElement!;
      el.remove();
      parent.append(el);
      await waitUntil(() => calls === 2);
      expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')).to.equal('region');
    } finally { window.fetch = original; }
  });
  it('forwards document anchors/highlights and advertises its text contracts', () => {
    const definition = getDefaultDocumentRendererRegistry().get('text/vcard')!;
    const highlights: LyraHighlight[] = [{ id: 'contact', anchor: { kind: 'text-quote', exact: 'Ada' } }];
    const anchor = { kind: 'fragment' as const, id: 'contact' };
    const rendered = definition.render!({
      name: 'team.vcf',
      mimeType: 'text/vcard',
      src: 'https://example.test/team.vcf',
      anchor,
      highlights,
    }) as LyraContactViewer;
    expect(rendered.anchor).to.equal(anchor);
    expect(rendered.highlights).to.equal(highlights);
    expect(definition.capabilities).to.deep.equal({
      anchors: ['text-quote', 'fragment'],
      search: true,
      textSelect: true,
    });
  });
});

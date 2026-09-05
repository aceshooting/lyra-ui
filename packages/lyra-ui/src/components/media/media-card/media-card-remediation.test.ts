import { expect, fixture, html } from '@open-wc/testing';
import './media-card.js';

it('treats removed mime-type as absent without changing null readback and recovers auto detection', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-media-card']>(html`<lr-media-card src="about:blank" mime-type="image/png"></lr-media-card>`);
  // A safe downloadable relative URL also exercises the file fallback's real anchor.
  el.src = '/file';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="media"]')?.localName).to.equal('img');
  el.removeAttribute('mime-type');
  await el.updateComplete;
  expect(el.mimeType).to.equal(null);
  expect(el.shadowRoot!.querySelector('[part="base"]')!.localName).to.equal('a');
  el.setAttribute('mime-type', '');
  await el.updateComplete;
  expect(el.mimeType).to.equal('');
  expect(el.shadowRoot!.querySelector('[part="base"]')!.localName).to.equal('a');
  el.setAttribute('mime-type', 'image/png');
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="media"]')?.localName).to.equal('img');
});

it('names the real file anchor through a reactive property-only label while retaining split host ownership', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-media-card']>(html`<lr-media-card src="/file" .strings=${{ mediaCardOpenFileAttachment: 'Open attachment' }}></lr-media-card>`);
  const action = el.shadowRoot!.querySelector('a')!;
  el.accessibleLabel = 'Download report';
  await el.updateComplete;
  expect(el.hasAttribute('aria-label')).to.equal(false);
  expect(action.getAttribute('aria-label')).to.equal('Download report');
  el.accessibleLabel = 'Updated action';
  await el.updateComplete;
  expect(action.getAttribute('aria-label')).to.equal('Updated action');
  el.accessibleLabel = '';
  await el.updateComplete;
  expect(action.getAttribute('aria-label')).to.equal('Open attachment');
  el.setAttribute('aria-label', 'Host label');
  await el.updateComplete;
  expect(action.getAttribute('aria-label')).to.equal('Open attachment');
  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(action.getAttribute('aria-label')).to.equal('Open attachment');
  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(action.getAttribute('aria-label')).to.equal('Open attachment');
});

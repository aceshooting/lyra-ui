import { expect, fixture, html } from '@open-wc/testing';
import './document-library.js';
import type { LyraDocumentLibrary } from './document-library.class.js';

it('registers the tag facet combobox only when the first tagged document appears', async () => {
  const library = await fixture<LyraDocumentLibrary>(html`<lr-document-library
    .documents=${[{ id: 'a', name: 'Untagged.pdf', mimeType: 'application/pdf' }]}
  ></lr-document-library>`);
  expect(Boolean(customElements.get('lr-table'))).to.equal(true);
  expect(Boolean(customElements.get('lr-combobox'))).to.equal(false);
  library.documents = [{ id: 'b', name: 'Tagged.pdf', mimeType: 'application/pdf', tags: ['ops'] }];
  await library.updateComplete;
  const facet = library.shadowRoot!.querySelector('[part="tag-filter"]');
  const Combobox = customElements.get('lr-combobox');
  expect(Boolean(Combobox && facet instanceof Combobox)).to.equal(true);
});

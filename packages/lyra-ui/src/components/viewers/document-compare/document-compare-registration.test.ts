import { expect, fixture, html } from '@open-wc/testing';
import './document-compare.js';
import type { LyraDocumentCompare } from './document-compare.class.js';

it('registers the side-by-side previews only when that view first renders', async () => {
  const compare = await fixture<LyraDocumentCompare>(html`<lr-document-compare
    .oldVersion=${{ id: 'v1', name: 'v1', text: 'alpha' }}
    .newVersion=${{ id: 'v2', name: 'v2', text: 'beta' }}
  ></lr-document-compare>`);
  expect(Boolean(customElements.get('lr-diff-view'))).to.equal(true);
  expect(Boolean(customElements.get('lr-document-preview'))).to.equal(false);
  compare.view = 'side-by-side';
  await compare.updateComplete;
  const previews = [...compare.shadowRoot!.querySelectorAll('lr-document-preview')];
  const Preview = customElements.get('lr-document-preview');
  expect(previews.length).to.equal(2);
  expect(previews.every(preview => Boolean(Preview && preview instanceof Preview))).to.equal(true);
});

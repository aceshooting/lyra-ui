import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-eval-dataset.js';
import type { LyraEvalDataset } from './eval-dataset.class.js';

it('registers the search field only when the dataset first becomes searchable', async () => {
  const dataset = await fixture<LyraEvalDataset>(html`<lr-eval-dataset></lr-eval-dataset>`);
  expect(Boolean(customElements.get('lr-input'))).to.equal(false);
  dataset.searchable = true;
  await dataset.updateComplete;
  const field = dataset.shadowRoot!.querySelector('[part="search-input"]');
  const Input = customElements.get('lr-input');
  expect(Boolean(Input && field instanceof Input)).to.equal(true);
});

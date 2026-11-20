import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-rag-answer.js';
import type { LyraRagAnswer } from './rag-answer.class.js';

it('registers the grounding summary only when an answer first carries an assessment', async () => {
  const answer = await fixture<LyraRagAnswer>(html`<lr-rag-answer answer="Grounded text."></lr-rag-answer>`);
  expect(Boolean(customElements.get('lr-grounding-summary'))).to.equal(false);
  answer.assessment = { supportedClaims: 1, unsupportedClaims: 0, coverage: 1 };
  await answer.updateComplete;
  const summary = answer.shadowRoot!.querySelector('lr-grounding-summary');
  const Summary = customElements.get('lr-grounding-summary');
  expect(Boolean(Summary && summary instanceof Summary)).to.equal(true);
});

it('registers the empty-state element with its own entry', async () => {
  const answer = await fixture<LyraRagAnswer>(html`<lr-rag-answer></lr-rag-answer>`);
  const empty = answer.shadowRoot!.querySelector('lr-empty');
  const Empty = customElements.get('lr-empty');
  expect(Boolean(empty), 'empty state rendered').to.equal(true);
  expect(Boolean(Empty && empty instanceof Empty), 'empty state upgraded').to.equal(true);
});

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

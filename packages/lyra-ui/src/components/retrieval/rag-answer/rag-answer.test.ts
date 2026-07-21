import { fixture, expect, html } from '@open-wc/testing';
import './rag-answer.js';
import type { LyraRagAnswer } from './rag-answer.class.js';
describe('lr-rag-answer', () => {
  it('renders answer evidence and sources', async () => {
    const el = (await fixture(html`<lr-rag-answer .strings=${{ ragAnswerLabel: 'Answer' }} answer="Answer" .citations=${[{ id: 'c1', sourceId: 'd1' }]} .sources=${[{ id: 'd1', name: 'guide.md' }]} .assessment=${{ supportedClaims: 1, unsupportedClaims: 0, coverage: 1 }}></lr-rag-answer>`)) as LyraRagAnswer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('lr-markdown')).to.exist;
    expect(el.shadowRoot!.querySelector('lr-grounding-summary')).to.exist;
    expect(el.shadowRoot!.querySelector('lr-citation-badge')).to.exist;
    expect(el.shadowRoot!.querySelector('lr-source-list')).to.exist;
  });
  it('is accessible in loading and populated states', async () => {
    await expect((await fixture(html`<lr-rag-answer loading></lr-rag-answer>`)) as LyraRagAnswer).to.be.accessible();
    await expect((await fixture(html`<lr-rag-answer answer="Answer"></lr-rag-answer>`)) as LyraRagAnswer).to.be.accessible();
  });
});

import { fixture, expect, html, oneEvent } from '@open-wc/testing';
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
  it('forwards claim-level visibility to its grounding summary', async () => {
    const assessment = {
      supportedClaims: 1,
      unsupportedClaims: 0,
      coverage: 1,
      claims: [{ id: 'claim-1', text: 'Supported', status: 'supported' as const, citationIds: [] }],
    };
    const el = (await fixture(
      html`<lr-rag-answer .assessment=${assessment} .showClaims=${false}></lr-rag-answer>`,
    )) as LyraRagAnswer;
    const summary = el.shadowRoot!.querySelector('lr-grounding-summary') as HTMLElement & { showClaims: boolean };
    expect(summary.showClaims).to.be.false;
  });
  it('emits lr-retry from the underlying button click contract', async () => {
    const el = (await fixture(
      html`<lr-rag-answer error="Retrieval failed"></lr-rag-answer>`,
    )) as LyraRagAnswer;
    const pending = oneEvent(el, 'lr-retry');
    (el.shadowRoot!.querySelector('[part="retry"]') as HTMLElement).shadowRoot!
      .querySelector('button')!
      .click();
    expect((await pending).type).to.equal('lr-retry');
  });
});

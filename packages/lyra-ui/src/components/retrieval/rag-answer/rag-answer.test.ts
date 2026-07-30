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
  it('forwards late host aria-label changes and removal to the loading spinner semantic owner', async () => {
    const el = (await fixture(
      html`<lr-rag-answer loading label="Grounded response"></lr-rag-answer>`,
    )) as LyraRagAnswer;
    const spinnerLabel = () =>
      el.shadowRoot!.querySelector('lr-spinner')!.shadowRoot!.querySelector('[role="status"]')!.getAttribute('aria-label');

    expect(spinnerLabel()).to.equal('Grounded response');
    el.setAttribute('aria-label', 'Loading quarterly evidence');
    await el.updateComplete;
    expect(spinnerLabel()).to.equal('Loading quarterly evidence');

    el.removeAttribute('aria-label');
    await el.updateComplete;
    expect(spinnerLabel()).to.equal('Grounded response');
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

  it('re-emits an activated citation as lr-citation-select, and swallows the child event', async () => {
    const citations = [
      { id: 'c1', sourceId: 'd1', label: 'First' },
      { id: 'c2', sourceId: 'd2', label: 'Second' },
    ];
    const el = (await fixture(html`<lr-rag-answer
      answer="Answer"
      .citations=${citations}
      .sources=${[{ id: 'd1', name: 'guide.md' }, { id: 'd2', name: 'spec.md' }]}
    ></lr-rag-answer>`)) as LyraRagAnswer;
    await el.updateComplete;
    const badges = [...el.shadowRoot!.querySelectorAll('lr-citation-badge')];
    expect(badges.length).to.equal(2);

    let leaked = 0;
    el.addEventListener('lr-citation-activate', () => leaked++);
    const pending = oneEvent(el, 'lr-citation-select');
    // The badge's own index is 1-based, so index 2 resolves to citations[1].
    badges[1]!.dispatchEvent(
      new CustomEvent('lr-citation-activate', { detail: { index: 2 }, bubbles: true, composed: true }),
    );
    const event = await pending;
    expect((event.detail as { citation: { id: string } }).citation.id).to.equal('c2');
    expect(leaked, "the child's own event does not escape the host").to.equal(0);
  });

  it('ignores an activation whose index falls outside the citation list', async () => {
    const el = (await fixture(html`<lr-rag-answer
      answer="Answer"
      .citations=${[{ id: 'c1', sourceId: 'd1' }]}
      .sources=${[{ id: 'd1', name: 'guide.md' }]}
    ></lr-rag-answer>`)) as LyraRagAnswer;
    await el.updateComplete;
    let selected = 0;
    el.addEventListener('lr-citation-select', () => selected++);
    el.shadowRoot!.querySelector('lr-citation-badge')!.dispatchEvent(
      new CustomEvent('lr-citation-activate', { detail: { index: 99 }, bubbles: true, composed: true }),
    );
    await el.updateComplete;
    expect(selected).to.equal(0);
  });
});

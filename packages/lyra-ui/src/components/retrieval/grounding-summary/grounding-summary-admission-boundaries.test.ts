import { expect, fixture, html } from '@open-wc/testing';
import './grounding-summary.js';
import type { LyraGroundingSummary } from './grounding-summary.class.js';
import type { LyraClaimEvidence } from '../claim-evidence/claim-evidence.class.js';
import type { Citation, GroundingAssessment } from '../../../ai/types.js';

const assessment: GroundingAssessment = {
  supportedClaims: 1, unsupportedClaims: 0, coverage: 1,
  claims: [{ id: 'claim', text: 'Supported claim', status: 'supported', citationIds: ['citation'] }],
};
const statValues = (el: LyraGroundingSummary) => [...el.shadowRoot!.querySelectorAll('lr-stat')]
  .map(stat => stat.getAttribute('value'));

describe('grounding summary admission boundaries', () => {
  it('normalizes nonnumeric counts to zero while preserving usable evidence and a single named owner', async () => {
    const el = await fixture<LyraGroundingSummary>(html`<lr-grounding-summary aria-label="Answer evidence"
      .assessment=${{ supportedClaims: '1', unsupportedClaims: null, coverage: false, warnings: ['Review source'] }}
      .citations=${[{ id: 'citation', label: 'Source' }]}></lr-grounding-summary>`);
    expect(statValues(el)).to.deep.equal(['0', '0', '0%']);
    expect(el.shadowRoot!.querySelector('[part="warning"]')!.textContent).to.equal('Review source');
    expect(el.shadowRoot!.querySelectorAll('[part="evidence-item"]').length).to.equal(1);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.hasAttribute('aria-label')).to.equal(false);
    expect(base.hasAttribute('role')).to.equal(false);
    expect(el.getAttribute('aria-label')).to.equal('Answer evidence');
    el.removeAttribute('aria-label');
    await el.updateComplete;
    expect(base.getAttribute('role')).to.equal('group');
    expect((base.getAttribute('aria-label') ?? '').length).to.be.greaterThan(0);
  });

  it('rejects an array assessment and recovers when a complete record replaces it', async () => {
    const el = await fixture<LyraGroundingSummary>(html`<lr-grounding-summary .assessment=${[]}></lr-grounding-summary>`);
    expect(el.shadowRoot!.querySelectorAll('lr-empty').length).to.equal(1);
    expect(statValues(el)).to.deep.equal([]);
    el.assessment = assessment;
    await el.updateComplete;
    expect(statValues(el)).to.deep.equal(['1', '0', '100%']);
    expect(el.shadowRoot!.querySelectorAll('lr-empty').length).to.equal(0);
  });

  it('rejects accessor-backed assessment fields without invoking them and admits a fresh safe record', async () => {
    let reads = 0;
    const invalid = { ...assessment };
    Object.defineProperty(invalid, 'coverage', { get() { reads++; return 1; } });
    const el = await fixture<LyraGroundingSummary>(html`<lr-grounding-summary .assessment=${invalid}></lr-grounding-summary>`);
    expect(reads).to.equal(0);
    expect(statValues(el)).to.deep.equal([]);
    expect(el.shadowRoot!.querySelectorAll('lr-empty').length).to.equal(1);
    el.assessment = assessment;
    await el.updateComplete;
    expect(reads).to.equal(0);
    expect(statValues(el)).to.deep.equal(['1', '0', '100%']);
  });

  it('omits malformed citations and unreadable citation fields while preserving a later valid identity', async () => {
    let reads = 0;
    const unreadable = { id: 'unreadable' };
    Object.defineProperty(unreadable, 'quote', { get() { reads++; return 'Do not read'; } });
    const citation: Citation = { id: 'citation', label: 'Admitted source' };
    const el = await fixture<LyraGroundingSummary>(html`<lr-grounding-summary .assessment=${assessment}
      .citations=${[null, 1, [], unreadable, citation]}></lr-grounding-summary>`);
    expect(reads).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="evidence-item"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelector('[part="evidence-label"]')!.textContent).to.equal('Admitted source');
    let selected: unknown;
    el.addEventListener('lr-citation-select', event => { selected = event.detail.citation; });
    const badge = el.shadowRoot!.querySelector('lr-citation-badge')!;
    await badge.updateComplete;
    badge.shadowRoot!.querySelector<HTMLButtonElement>('button')!.click();
    expect(selected === citation).to.equal(true);
    expect(reads).to.equal(0);
  });

  it('drops an accessor span but retains the citation and forwards admitted chunk and quote data to claims', async () => {
    let reads = 0;
    const span = { end: 9 };
    Object.defineProperty(span, 'start', { get() { reads++; return 2; } });
    const citation = { id: 'citation', chunkId: 'chunk', sourceId: 'source', label: 'Evidence', quote: 'Source quotation', span };
    const el = await fixture<LyraGroundingSummary>(html`<lr-grounding-summary .assessment=${assessment}
      .citations=${[citation]}></lr-grounding-summary>`);
    expect(reads).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="evidence-span"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="evidence-item"]').length).to.equal(1);
    const claims = el.shadowRoot!.querySelector<LyraClaimEvidence>('lr-claim-evidence')!;
    await claims.updateComplete;
    expect(claims.citations).to.deep.equal([{ id: 'citation', chunkId: 'chunk', sourceId: 'source', label: 'Evidence', quote: 'Source quotation' }]);
    expect(claims.shadowRoot!.textContent).to.include('Supported claim');
  });

  it('contains primitive nested event payloads and still forwards a later real citation activation', async () => {
    const citation: Citation = { id: 'citation', sourceId: 'source' };
    const el = await fixture<LyraGroundingSummary>(html`<lr-grounding-summary .assessment=${assessment}
      .citations=${[citation]}></lr-grounding-summary>`);
    const claims = el.shadowRoot!.querySelector<LyraClaimEvidence>('lr-claim-evidence')!;
    await claims.updateComplete;
    const selections: unknown[] = [];
    el.addEventListener('lr-citation-select', event => selections.push(event.detail.citation));
    el.addEventListener('lr-claim-select', event => selections.push(event.detail.claim));
    for (const detail of [null, false, 12, 'citation']) {
      for (const name of ['lr-citation-select', 'lr-claim-select']) {
        claims.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
      }
    }
    expect(selections).to.deep.equal([]);
    const badge = claims.shadowRoot!.querySelector('lr-citation-badge')!;
    await badge.updateComplete;
    badge.shadowRoot!.querySelector<HTMLButtonElement>('button')!.click();
    expect(selections.length).to.equal(1);
    expect(selections[0] === citation).to.equal(true);
  });
});

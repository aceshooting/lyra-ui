import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import type { Citation, GroundedClaim } from '../../../ai/types.js';
import './claim-evidence.js';
import type { LyraClaimEvidence } from './claim-evidence.js';

const claims: GroundedClaim[] = [
  {
    id: 'claim-1',
    text: 'Lyra is built with Lit.',
    status: 'supported',
    citationIds: ['cite-1'],
    confidence: 0.96,
  },
  {
    id: 'claim-2',
    text: 'Every claim is supported.',
    status: 'unsupported',
    citationIds: ['missing'],
    explanation: 'No matching source was found.',
  },
];

const citations: Citation[] = [
  { id: 'cite-1', sourceId: 'doc-1', label: 'Architecture', quote: 'Lyra components extend Lit.' },
];

it('renders claim status, confidence, and only evidence that resolves', async () => {
  const el = (await fixture(html`<lr-claim-evidence .claims=${claims} .citations=${citations}></lr-claim-evidence>`)) as LyraClaimEvidence;
  expect(el.shadowRoot!.querySelectorAll('[part~="claim"]').length).to.equal(2);
  expect(el.shadowRoot!.querySelector('[part="confidence"]')!.textContent).to.contain('96%');
  expect(el.shadowRoot!.querySelectorAll('lr-citation-badge').length).to.equal(1);
  expect(el.shadowRoot!.textContent).to.contain('No matching source was found.');
});

it('emits controlled claim and citation selection events with complete records', async () => {
  const el = (await fixture(html`<lr-claim-evidence .claims=${claims} .citations=${citations}></lr-claim-evidence>`)) as LyraClaimEvidence;
  const claimEvent = oneEvent(el, 'lr-claim-select');
  (el.shadowRoot!.querySelector('[part="claim-trigger"]') as HTMLButtonElement).click();
  expect((await claimEvent).detail).to.deep.equal({ claim: claims[0] });

  const citationEvent = oneEvent(el, 'lr-citation-select');
  (el.shadowRoot!.querySelector('lr-citation-badge')!.shadowRoot!.querySelector('button') as HTMLButtonElement).click();
  expect((await citationEvent).detail).to.deep.equal({ citation: citations[0] });
});

it('applies per-instance strings to claim status', async () => {
  const el = (await fixture(
    html`<lr-claim-evidence
      .claims=${claims.slice(0, 1)}
      .strings=${{ claimEvidenceSupported: 'Pris en charge' }}
    ></lr-claim-evidence>`,
  )) as LyraClaimEvidence;
  expect(el.shadowRoot!.querySelector('[part="status"]')?.textContent?.trim()).to.equal(
    'Pris en charge',
  );
});

it('uses the host aria-label and exposes selected state without changing the controlled id', async () => {
  const el = (await fixture(
    html`<lr-claim-evidence aria-label="Evidence audit" selected-claim-id="claim-2" .claims=${claims}></lr-claim-evidence>`,
  )) as LyraClaimEvidence;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Evidence audit');
  expect(el.shadowRoot!.querySelector('[part~="claim-selected"]')!.getAttribute('aria-current')).to.equal('true');
  expect(el.selectedClaimId).to.equal('claim-2');
  await expect(el).shadowDom.to.be.accessible();
});

it('applies per-instance strings to the evidence region label', async () => {
  const el = (await fixture(html`<lr-claim-evidence
    .strings=${{ claimEvidenceLabel: 'Localized evidence review' }}
  ></lr-claim-evidence>`)) as LyraClaimEvidence;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
    'Localized evidence review',
  );
});

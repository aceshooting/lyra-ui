import { expect, fixture, html } from '@open-wc/testing';
import './grounding-summary.js';
import type { LyraGroundingSummary } from './grounding-summary.js';
import type { Citation, GroundedClaim, GroundingAssessment } from '../../../ai/types.js';

function revoked<T extends object>(target: T): T {
  const result = Proxy.revocable(target, {});
  result.revoke();
  return result.proxy;
}

const assessment: GroundingAssessment = {
  supportedClaims: 1, unsupportedClaims: 0, coverage: 1,
  warnings: ['Review the evidence'],
};

describe('grounding summary schema projection', () => {
  for (const level of ['1', '4', '5', '6'] as const) {
    it(`renders evidence and warning headings at the requested level ${level}`, async () => {
      const summary = await fixture<LyraGroundingSummary>(html`<lr-grounding-summary
        heading-level=${level} .assessment=${assessment}
        .citations=${[{ id: 'citation', label: 'Evidence' }]}
      ></lr-grounding-summary>`);
      for (const part of ['warnings-heading', 'evidence-heading']) {
        const heading = summary.shadowRoot!.querySelector(`[part="${part}"]`)!;
        expect(heading.localName).to.equal(`h${level}`);
        expect(heading.textContent?.trim().length).to.be.greaterThan(0);
      }
      await expect(summary).to.be.accessible();
    });
  }

  it('preserves a valid claim confidence independently of the aggregate confidence', async () => {
    const summary = await fixture<LyraGroundingSummary>(html`<lr-grounding-summary
      .assessment=${{ ...assessment, claims: [{ id: 'claim', text: 'Confirmed', status: 'supported', citationIds: [], confidence: 0.9 }] }}
    ></lr-grounding-summary>`);
    const claims = summary.shadowRoot!.querySelector('lr-claim-evidence') as HTMLElement & { claims: readonly GroundedClaim[] };
    expect(claims.claims[0]?.confidence).to.equal(0.9);
    expect(summary.shadowRoot!.querySelectorAll('lr-stat')).to.have.length(3);
  });

  it('fails closed for a revoked assessment and for a revoked warnings collection', async () => {
    const summary = await fixture<LyraGroundingSummary>(html`<lr-grounding-summary></lr-grounding-summary>`);
    summary.assessment = revoked({ ...assessment });
    await summary.updateComplete;
    expect(summary.shadowRoot!.querySelector('lr-empty') !== null).to.equal(true);
    summary.assessment = { ...assessment, warnings: revoked(['unreadable']) };
    await summary.updateComplete;
    expect(summary.shadowRoot!.querySelectorAll('lr-stat')).to.have.length(3);
    expect(summary.shadowRoot!.querySelector('[part="warnings"]') === null).to.equal(true);
  });

  it('omits revoked claim rows while preserving valid later claims', async () => {
    const valid: GroundedClaim = { id: 'valid', text: 'Confirmed', status: 'supported', citationIds: [] };
    const summary = await fixture<LyraGroundingSummary>(html`<lr-grounding-summary
      .assessment=${{ ...assessment, claims: [revoked({ ...valid, id: 'bad' }), valid] }}
    ></lr-grounding-summary>`);
    const claims = summary.shadowRoot!.querySelector('lr-claim-evidence') as HTMLElement & { claims: readonly GroundedClaim[] };
    expect(claims.claims.map(claim => claim.id)).to.deep.equal(['valid']);
    summary.assessment = { ...assessment, claims: revoked([valid]) };
    await summary.updateComplete;
    expect(summary.shadowRoot!.querySelector('lr-claim-evidence') === null).to.equal(true);
  });

  it('omits revoked citations and unreadable spans without suppressing other evidence', async () => {
    const invalidSpan: Citation = { id: 'span', span: revoked({ start: 1, end: 3 }) };
    const valid: Citation = { id: 'valid', label: 'Readable evidence' };
    const summary = await fixture<LyraGroundingSummary>(html`<lr-grounding-summary
      .assessment=${assessment} .citations=${[revoked({ id: 'bad' }), invalidSpan, valid]}
    ></lr-grounding-summary>`);
    expect(summary.shadowRoot!.querySelectorAll('[part="evidence-item"]')).to.have.length(1);
    expect(summary.shadowRoot!.querySelector('[part="evidence-label"]')?.textContent).to.contain('Readable evidence');
    expect(summary.shadowRoot!.querySelector('[part="evidence-span"]') === null).to.equal(true);
  });
});

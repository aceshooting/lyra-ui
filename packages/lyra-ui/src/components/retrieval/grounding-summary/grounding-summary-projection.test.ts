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
    expect(summary.shadowRoot!.querySelectorAll('[part="evidence-item"]')).to.have.length(2);
    expect(summary.shadowRoot!.querySelector('[part="evidence-label"]')?.textContent).to.contain('Readable evidence');
    expect(summary.shadowRoot!.querySelector('[part="evidence-span"]') === null).to.equal(true);
  });

  it('keeps a citation whose span is null or malformed, without a span, and numbers the list through it', async () => {
    const citations = [
      { id: 'a', label: 'Null span', span: null },
      { id: 'b', label: 'Half span', span: { start: 3 } },
      { id: 'c', label: 'Good span', span: { start: 1, end: 2 } },
    ] as unknown as Citation[];
    const summary = await fixture<LyraGroundingSummary>(html`<lr-grounding-summary
      .assessment=${assessment} .citations=${citations}
    ></lr-grounding-summary>`);
    const badges = [...summary.shadowRoot!.querySelectorAll('lr-citation-badge')];
    expect(badges.map((badge) => badge.getAttribute('index'))).to.deep.equal(['1', '2', '3']);
    expect(summary.shadowRoot!.querySelectorAll('[part="evidence-span"]')).to.have.length(1);
  });

  async function dblclick(badge: Element): Promise<void> {
    const button = badge.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    button.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
  }

  it('reports an evidence badge open as its own lr-citation-open carrying the citation record', async () => {
    const citations = [{ id: 'a', span: null }, { id: 'b', label: 'Second' }] as unknown as Citation[];
    const summary = await fixture<LyraGroundingSummary>(html`<lr-grounding-summary
      .assessment=${assessment} .citations=${citations}
    ></lr-grounding-summary>`);
    const seen: unknown[] = [];
    summary.addEventListener('lr-citation-open', (event) => seen.push((event as CustomEvent).detail));
    await dblclick(summary.shadowRoot!.querySelectorAll('lr-citation-badge')[1]!);
    expect(seen).to.have.length(1);
    expect((seen[0] as { citation: unknown; index?: number }).citation === citations[1]).to.equal(true);
    expect((seen[0] as { index?: number }).index).to.equal(undefined);
  });

  it('reports a nested claim badge open with the citation record', async () => {
    const citation: Citation = { id: 'cite', label: 'Source' };
    const claims = [{ id: 'k', text: 'Claim', status: 'supported' as const, citationIds: ['cite'] }];
    const summary = await fixture<LyraGroundingSummary>(html`<lr-grounding-summary
      .assessment=${{ ...assessment, claims }} .citations=${[citation]}
    ></lr-grounding-summary>`);
    const evidence = summary.shadowRoot!.querySelector('lr-claim-evidence')! as HTMLElement & { updateComplete: Promise<unknown> };
    await evidence.updateComplete;
    const seen: unknown[] = [];
    summary.addEventListener('lr-citation-open', (event) => seen.push((event as CustomEvent).detail));
    await dblclick(evidence.shadowRoot!.querySelector('lr-citation-badge')!);
    expect(seen).to.have.length(1);
    expect((seen[0] as { citation: unknown }).citation === citation).to.equal(true);
  });

  it('keeps the claim evidence inputs across an unrelated update', async () => {
    const claims = [{ id: 'k', text: 'Claim', status: 'supported' as const, citationIds: [] }];
    const summary = await fixture<LyraGroundingSummary>(html`<lr-grounding-summary
      .assessment=${{ ...assessment, claims }} .citations=${[{ id: 'c' }]}
    ></lr-grounding-summary>`);
    const evidence = summary.shadowRoot!.querySelector('lr-claim-evidence')! as HTMLElement & { claims: unknown; citations: unknown };
    const before = [evidence.claims, evidence.citations];
    summary.thresholds = { high: 0.9, medium: 0.4 };
    await summary.updateComplete;
    expect(evidence.claims === before[0] && evidence.citations === before[1]).to.equal(true);
  });

  it('does not repeat the visible label and span in the badge preview', async () => {
    const summary = await fixture<LyraGroundingSummary>(html`<lr-grounding-summary
      .assessment=${assessment} .citations=${[{ id: 'a', label: 'Annual report', span: { start: 1, end: 2 } }]}
    ></lr-grounding-summary>`);
    const badge = summary.shadowRoot!.querySelector('lr-citation-badge')!;
    expect(badge.children.length).to.equal(0);
    expect(badge.shadowRoot!.querySelector('[part="base"]')!.hasAttribute('aria-describedby')).to.equal(false);
  });

  it('falls back to the default tones when thresholds is not an object', async () => {
    const summary = await fixture<LyraGroundingSummary>(html`<lr-grounding-summary .assessment=${assessment}></lr-grounding-summary>`);
    (summary as unknown as { thresholds: unknown }).thresholds = undefined;
    await summary.updateComplete;
    expect(summary.shadowRoot!.querySelectorAll('lr-stat')[2]!.getAttribute('variant')).to.equal('success');
  });

  it('puts each section count on the heading line', async () => {
    const summary = await fixture<LyraGroundingSummary>(html`<lr-grounding-summary
      .assessment=${assessment} .citations=${[{ id: 'a', label: 'Evidence' }]}
    ></lr-grounding-summary>`);
    for (const [heading, count] of [['warnings-heading', 'warnings-count'], ['evidence-heading', 'evidence-count']] as const) {
      const top = (part: string): number => summary.shadowRoot!.querySelector(`[part="${part}"]`)!.getBoundingClientRect().top;
      expect(Math.abs(top(heading) - top(count)), heading).to.be.lessThan(8);
    }
  });
});

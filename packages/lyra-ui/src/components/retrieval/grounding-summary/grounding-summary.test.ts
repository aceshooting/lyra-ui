import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './grounding-summary.js';
import type { LyraGroundingSummary } from './grounding-summary.js';
import type { Citation, GroundingAssessment } from '../../../ai/types.js';

const ASSESSMENT: GroundingAssessment = {
  supportedClaims: 8,
  unsupportedClaims: 1,
  coverage: 0.89,
  confidence: 0.72,
  warnings: ['One claim could not be matched to a source.'],
};

const CITATIONS: Citation[] = [
  { id: 'cite-1', sourceId: 'doc-1', label: '[1]', span: { start: 0, end: 42 } },
  { id: 'cite-2', sourceId: 'doc-2' },
];

function stats(el: LyraGroundingSummary): HTMLElement[] {
  return [...el.shadowRoot!.querySelectorAll('lr-stat')] as HTMLElement[];
}

it('renders the groundingSummaryEmpty state when assessment is null (the default)', async () => {
  const el = (await fixture(html`<lr-grounding-summary></lr-grounding-summary>`)) as LyraGroundingSummary;
  expect(el.assessment).to.equal(null);
  expect(el.shadowRoot!.querySelector('lr-empty')).to.exist;
  expect(el.shadowRoot!.querySelectorAll('lr-stat').length).to.equal(0);
});

it('renders supported/unsupported/coverage as lr-stat, omitting confidence when unset', async () => {
  const el = (await fixture(html`<lr-grounding-summary></lr-grounding-summary>`)) as LyraGroundingSummary;
  el.assessment = { supportedClaims: 8, unsupportedClaims: 1, coverage: 0.89 };
  await el.updateComplete;

  const rows = stats(el);
  expect(rows.length).to.equal(3);
  expect(rows[0]!.getAttribute('value')).to.equal('8');
  expect(rows[1]!.getAttribute('value')).to.equal('1');
  expect(rows[2]!.getAttribute('value')).to.equal('89%');
});

it('renders a fourth confidence lr-stat when assessment.confidence is set', async () => {
  const el = (await fixture(html`<lr-grounding-summary></lr-grounding-summary>`)) as LyraGroundingSummary;
  el.assessment = ASSESSMENT;
  await el.updateComplete;

  const rows = stats(el);
  expect(rows.length).to.equal(4);
  expect(rows[3]!.getAttribute('value')).to.equal('72%');
});

it('renders claim-level evidence when claims are supplied and allows it to be hidden explicitly', async () => {
  const el = (await fixture(html`<lr-grounding-summary></lr-grounding-summary>`)) as LyraGroundingSummary;
  el.assessment = {
    supportedClaims: 1,
    unsupportedClaims: 0,
    coverage: 1,
    claims: [{ id: 'claim-1', text: 'A supported claim', status: 'supported', citationIds: ['cite-1'] }],
  };
  el.citations = CITATIONS;
  await el.updateComplete;
  const claims = el.shadowRoot!.querySelector('lr-claim-evidence') as HTMLElement & { claims: unknown[] };
  expect(claims).to.exist;
  expect(claims.claims.length).to.equal(1);

  el.showClaims = false;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('lr-claim-evidence')).to.not.exist;
});

it('formats large claim counts through the effective locale', async () => {
  const el = (await fixture(html`<lr-grounding-summary locale="de-DE"></lr-grounding-summary>`)) as LyraGroundingSummary;
  el.assessment = { supportedClaims: 1234, unsupportedClaims: 0, coverage: 0.5 };
  await el.updateComplete;

  expect(stats(el)[0]!.getAttribute('value')).to.equal('1.234');
});

it('tones the supported/unsupported stats success/danger only when their count is positive, neutral at zero', async () => {
  const el = (await fixture(html`<lr-grounding-summary></lr-grounding-summary>`)) as LyraGroundingSummary;
  el.assessment = { supportedClaims: 0, unsupportedClaims: 0, coverage: 0.9 };
  await el.updateComplete;
  let rows = stats(el);
  expect(rows[0]!.getAttribute('variant')).to.equal('neutral');
  expect(rows[1]!.getAttribute('variant')).to.equal('neutral');

  el.assessment = { supportedClaims: 3, unsupportedClaims: 2, coverage: 0.9 };
  await el.updateComplete;
  rows = stats(el);
  expect(rows[0]!.getAttribute('variant')).to.equal('success');
  expect(rows[1]!.getAttribute('variant')).to.equal('danger');
});

it('tones coverage/confidence via thresholds: >= high is success, >= medium is warning, below is danger', async () => {
  const el = (await fixture(html`<lr-grounding-summary></lr-grounding-summary>`)) as LyraGroundingSummary;
  el.assessment = { supportedClaims: 1, unsupportedClaims: 0, coverage: 0.85, confidence: 0.6 };
  await el.updateComplete;
  let rows = stats(el);
  expect(rows[2]!.getAttribute('variant')).to.equal('success'); // coverage 0.85 >= default high 0.8
  expect(rows[3]!.getAttribute('variant')).to.equal('warning'); // confidence 0.6 >= default medium 0.5

  el.assessment = { supportedClaims: 1, unsupportedClaims: 0, coverage: 0.2, confidence: 0.2 };
  await el.updateComplete;
  rows = stats(el);
  expect(rows[2]!.getAttribute('variant')).to.equal('danger');
  expect(rows[3]!.getAttribute('variant')).to.equal('danger');
});

it('applies a custom thresholds override to the coverage/confidence tone', async () => {
  const el = (await fixture(html`<lr-grounding-summary></lr-grounding-summary>`)) as LyraGroundingSummary;
  el.thresholds = { high: 0.95, medium: 0.9 };
  el.assessment = { supportedClaims: 1, unsupportedClaims: 0, coverage: 0.92 };
  await el.updateComplete;
  expect(stats(el)[2]!.getAttribute('variant')).to.equal('warning');
});

it('clamps negative/NaN claim counts and an out-of-range coverage instead of rendering invalid output', async () => {
  const el = (await fixture(html`<lr-grounding-summary></lr-grounding-summary>`)) as LyraGroundingSummary;
  el.assessment = { supportedClaims: -5, unsupportedClaims: NaN, coverage: 1.5 };
  await el.updateComplete;
  const rows = stats(el);
  expect(rows[0]!.getAttribute('value')).to.equal('0');
  expect(rows[1]!.getAttribute('value')).to.equal('0');
  expect(rows[2]!.getAttribute('value')).to.equal('100%');
});

it('omits the warnings section when there are none, and renders each warning verbatim (as caller data, not localized) when present', async () => {
  const el = (await fixture(html`<lr-grounding-summary></lr-grounding-summary>`)) as LyraGroundingSummary;
  el.assessment = { supportedClaims: 1, unsupportedClaims: 0, coverage: 1 };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="warnings"]')).to.not.exist;

  el.assessment = ASSESSMENT;
  await el.updateComplete;
  const warningsEl = el.shadowRoot!.querySelector('[part="warnings"]')!;
  expect(warningsEl).to.exist;
  expect(el.shadowRoot!.querySelector('[part="warnings-count"]')!.textContent).to.equal('1');
  const items = el.shadowRoot!.querySelectorAll('[part="warning"]');
  expect(items.length).to.equal(1);
  expect(items[0]!.textContent).to.equal('One claim could not be matched to a source.');
});

it('omits the evidence section when citations is empty, and renders one lr-citation-badge per citation, 1-indexed, with source-id carried through', async () => {
  const el = (await fixture(html`<lr-grounding-summary></lr-grounding-summary>`)) as LyraGroundingSummary;
  el.assessment = ASSESSMENT;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="evidence"]')).to.not.exist;

  el.citations = CITATIONS;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="evidence-count"]')!.textContent).to.equal('2');
  const badges = el.shadowRoot!.querySelectorAll('lr-citation-badge');
  expect(badges.length).to.equal(2);
  expect(badges[0]!.getAttribute('index')).to.equal('1');
  expect(badges[0]!.getAttribute('source-id')).to.equal('doc-1');
  expect(badges[1]!.getAttribute('index')).to.equal('2');
  expect(badges[1]!.getAttribute('source-id')).to.equal('doc-2');
});

it('renders a citation\'s label and formatted span next to its badge, omitting evidence-span when span is unset', async () => {
  const el = (await fixture(html`<lr-grounding-summary></lr-grounding-summary>`)) as LyraGroundingSummary;
  el.assessment = ASSESSMENT;
  el.citations = CITATIONS;
  await el.updateComplete;

  const labels = el.shadowRoot!.querySelectorAll('[part="evidence-label"]');
  const spans = el.shadowRoot!.querySelectorAll('[part="evidence-span"]');
  expect(labels.length).to.equal(1);
  expect(labels[0]!.textContent).to.equal('[1]');
  expect(spans.length).to.equal(1);
  expect(spans[0]!.textContent).to.equal('Characters 0–42');
});

it('emits lr-citation-select with the full Citation (including span) when a badge is activated, alongside the raw lr-citation-activate still bubbling unmodified', async () => {
  const el = (await fixture(html`<lr-grounding-summary></lr-grounding-summary>`)) as LyraGroundingSummary;
  el.assessment = ASSESSMENT;
  el.citations = CITATIONS;
  await el.updateComplete;

  const activateListener = oneEvent(el, 'lr-citation-activate');
  const selectListener = oneEvent(el, 'lr-citation-select');
  const badge = el.shadowRoot!.querySelector('lr-citation-badge')!.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
  badge.click();

  const activateEvent = await activateListener;
  expect(activateEvent.detail).to.deep.equal({ sourceId: 'doc-1', index: 1 });

  const selectEvent = await selectListener;
  expect(selectEvent.detail).to.deep.equal({ citation: CITATIONS[0] });
});

it('prefixes the group aria-label with a host aria-label override, then the label property, then the localized default', async () => {
  const withDefault = (await fixture(html`<lr-grounding-summary></lr-grounding-summary>`)) as LyraGroundingSummary;
  expect(withDefault.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Grounding summary');

  const withLabel = (await fixture(html`<lr-grounding-summary label="Answer grounding"></lr-grounding-summary>`)) as LyraGroundingSummary;
  expect(withLabel.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Answer grounding');

  const withAria = (await fixture(
    html`<lr-grounding-summary aria-label="Custom" label="Answer grounding"></lr-grounding-summary>`,
  )) as LyraGroundingSummary;
  expect(withAria.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Custom');
});

describe('localization', () => {
  it('localizes the empty-state heading via .strings overriding groundingSummaryEmpty', async () => {
    const el = (await fixture(
      html`<lr-grounding-summary .strings=${{ groundingSummaryEmpty: 'Rien à afficher' }}></lr-grounding-summary>`,
    )) as LyraGroundingSummary;
    expect(el.shadowRoot!.querySelector('lr-empty')!.getAttribute('heading')).to.equal('Rien à afficher');
  });

  it('localizes stat labels via .strings overriding groundingSummarySupportedLabel/groundingSummaryUnsupportedLabel/groundingSummaryCoverageLabel', async () => {
    const el = (await fixture(html`
      <lr-grounding-summary
        .strings=${{
          groundingSummarySupportedLabel: 'Réclamations étayées',
          groundingSummaryUnsupportedLabel: 'Réclamations non étayées',
          groundingSummaryCoverageLabel: 'Couverture des citations',
        }}
      ></lr-grounding-summary>
    `)) as LyraGroundingSummary;
    el.assessment = { supportedClaims: 1, unsupportedClaims: 0, coverage: 1 };
    await el.updateComplete;
    const rows = stats(el);
    expect(rows[0]!.getAttribute('label')).to.equal('Réclamations étayées');
    expect(rows[1]!.getAttribute('label')).to.equal('Réclamations non étayées');
    expect(rows[2]!.getAttribute('label')).to.equal('Couverture des citations');
  });

  it('localizes the warnings heading via .strings overriding groundingSummaryWarningsHeading', async () => {
    const el = (await fixture(
      html`<lr-grounding-summary .strings=${{ groundingSummaryWarningsHeading: 'Avertissements' }}></lr-grounding-summary>`,
    )) as LyraGroundingSummary;
    el.assessment = ASSESSMENT;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="warnings-heading"]')!.textContent).to.equal('Avertissements');
  });

  it('localizes the evidence span template via .strings overriding groundingSummaryEvidenceSpan, reordering its placeholders', async () => {
    const el = (await fixture(
      html`<lr-grounding-summary .strings=${{ groundingSummaryEvidenceSpan: '{end}–{start} sipnoc' }}></lr-grounding-summary>`,
    )) as LyraGroundingSummary;
    el.assessment = ASSESSMENT;
    el.citations = CITATIONS;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="evidence-span"]')!.textContent).to.equal('42–0 sipnoc');
  });
});

it('is accessible in the empty state', async () => {
  const el = (await fixture(html`<lr-grounding-summary></lr-grounding-summary>`)) as LyraGroundingSummary;
  await expect(el).to.be.accessible();
});

it('is accessible fully populated with stats, warnings, and evidence', async () => {
  const el = (await fixture(html`<lr-grounding-summary></lr-grounding-summary>`)) as LyraGroundingSummary;
  el.assessment = ASSESSMENT;
  el.citations = CITATIONS;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('renders correctly under dir="rtl" fully populated, with no leftover physical-side styling assumptions', async () => {
  const el = (await fixture(html`<lr-grounding-summary dir="rtl"></lr-grounding-summary>`)) as LyraGroundingSummary;
  el.assessment = ASSESSMENT;
  el.citations = CITATIONS;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="base"]')).to.exist;
  expect(el.shadowRoot!.querySelectorAll('lr-stat').length).to.equal(4);
  expect(el.shadowRoot!.querySelectorAll('lr-citation-badge').length).to.equal(2);
  await expect(el).to.be.accessible();
});

it('can shrink to a 320px allocation fully populated', async () => {
  const wrapper = await fixture(html`
    <div style="display: flex; inline-size: 320px;">
      <lr-grounding-summary></lr-grounding-summary>
    </div>
  `);
  const el = wrapper.querySelector('lr-grounding-summary') as LyraGroundingSummary;
  el.assessment = ASSESSMENT;
  el.citations = CITATIONS;
  await el.updateComplete;

  expect(getComputedStyle(el).minInlineSize).to.equal('0px');
  expect(el.getBoundingClientRect().width).to.be.at.most(320);
});

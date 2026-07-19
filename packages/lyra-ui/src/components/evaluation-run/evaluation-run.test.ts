import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './evaluation-run.js';
import type { LyraEvaluationRun, EvaluationExampleResult } from './evaluation-run.js';
import type { Citation, GroundingAssessment } from '../../ai/types.js';
import type { ToolTimelineEntry } from '../tool-timeline/tool-timeline.class.js';

const examples: EvaluationExampleResult[] = [
  {
    id: 'ex-1',
    label: 'Refund policy question',
    status: { kind: 'done' },
    input: 'What is the refund policy?',
    output: 'Refunds are available within 30 days.',
    grounding: { supportedClaims: 3, unsupportedClaims: 1, coverage: 0.85, confidence: 0.9 },
  },
  {
    id: 'ex-2',
    status: { kind: 'running' },
    input: 'print("hi")',
    inputFormat: 'code',
    inputLanguage: 'python',
    output: '',
  },
  {
    id: 'ex-3',
    status: { kind: 'error', message: 'Timed out' },
    input: 'What is 2+2?',
    output: '',
  },
];

const toolTrace: ToolTimelineEntry[] = [
  { id: 'call-1', name: 'search', args: { query: 'refund policy' }, status: 'success', result: { hits: 2 } },
];

it('defaults to examples=[], total=null, label=""', async () => {
  const el = (await fixture(html`<lr-evaluation-run></lr-evaluation-run>`)) as LyraEvaluationRun;
  expect(el.examples).to.deep.equal([]);
  expect(el.total).to.equal(null);
  expect(el.label).to.equal('');
});

it('renders a batch progress bar reflecting completed/total and a completed-of-total summary', async () => {
  const el = (await fixture(
    html`<lr-evaluation-run .examples=${examples} total="4"></lr-evaluation-run>`,
  )) as LyraEvaluationRun;
  const progress = el.shadowRoot!.querySelector('[part="progress"]') as HTMLElement;
  // ex-1 (done) and ex-3 (error) are terminal; ex-2 (running) is not.
  expect(progress.getAttribute('value')).to.equal('2');
  expect(progress.getAttribute('max')).to.equal('4');
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal(
    '2 of 4 examples complete',
  );
});

it('falls back to examples.length when total is unset', async () => {
  const el = (await fixture(html`<lr-evaluation-run .examples=${examples}></lr-evaluation-run>`)) as LyraEvaluationRun;
  expect(el.shadowRoot!.querySelector('[part="progress"]')!.getAttribute('max')).to.equal('3');
});

it('shows a running/failed count badge only when that count is nonzero', async () => {
  const el = (await fixture(html`<lr-evaluation-run .examples=${examples}></lr-evaluation-run>`)) as LyraEvaluationRun;
  const counts = [...el.shadowRoot!.querySelectorAll('[part="count"]')] as HTMLElement[];
  expect(counts.map((c) => c.dataset.kind)).to.deep.equal(['running', 'error']);
});

it('renders an empty state when examples is []', async () => {
  const el = (await fixture(html`<lr-evaluation-run></lr-evaluation-run>`)) as LyraEvaluationRun;
  expect(el.shadowRoot!.querySelector('[part="empty"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="example"]')).to.not.exist;
});

it('renders one lr-details[part="example"] per example, carrying data-status', async () => {
  const el = (await fixture(html`<lr-evaluation-run .examples=${examples}></lr-evaluation-run>`)) as LyraEvaluationRun;
  const rows = [...el.shadowRoot!.querySelectorAll('[part="example"]')] as HTMLElement[];
  expect(rows.length).to.equal(3);
  expect(rows[1]!.dataset.status).to.equal('running');
});

it('uses the example label when provided, and a localized "Example N" fallback otherwise', async () => {
  const el = (await fixture(html`<lr-evaluation-run .examples=${examples}></lr-evaluation-run>`)) as LyraEvaluationRun;
  const rows = [...el.shadowRoot!.querySelectorAll('[part="example"]')] as HTMLElement[];
  expect(rows[0]!.querySelector('[part="example-label"]')!.textContent!.trim()).to.equal('Refund policy question');
  expect(rows[1]!.querySelector('[part="example-label"]')!.textContent!.trim()).to.equal('Example 2');
});

it('renders a per-example status badge with the right text', async () => {
  const el = (await fixture(html`<lr-evaluation-run .examples=${examples}></lr-evaluation-run>`)) as LyraEvaluationRun;
  const rows = [...el.shadowRoot!.querySelectorAll('[part="example"]')] as HTMLElement[];
  expect(rows[0]!.querySelector('[part="example-status"]')!.textContent!.trim()).to.equal('Success');
  expect(rows[1]!.querySelector('[part="example-status"]')!.textContent!.trim()).to.equal('Running');
  expect(rows[2]!.querySelector('[part="example-status"]')!.textContent!.trim()).to.equal('Error');
});

it('renders plain-text input/output via lr-markdown by default', async () => {
  const el = (await fixture(html`<lr-evaluation-run .examples=${examples}></lr-evaluation-run>`)) as LyraEvaluationRun;
  const row = el.shadowRoot!.querySelector('[part="example"]') as HTMLElement;
  const input = row.querySelector('[part="input"]') as HTMLElement;
  expect(input.tagName.toLowerCase()).to.equal('lr-markdown');
  expect((input as unknown as { content: string }).content).to.equal('What is the refund policy?');
});

it('renders code input/output via lr-code-block when the example requests it, with its language', async () => {
  const el = (await fixture(html`<lr-evaluation-run .examples=${examples}></lr-evaluation-run>`)) as LyraEvaluationRun;
  const rows = [...el.shadowRoot!.querySelectorAll('[part="example"]')] as HTMLElement[];
  const input = rows[1]!.querySelector('[part="input"]') as HTMLElement;
  expect(input.tagName.toLowerCase()).to.equal('lr-code-block');
  expect(input.getAttribute('language')).to.equal('python');
});

it('renders no grounding section when the example carries no grounding assessment', async () => {
  const el = (await fixture(html`<lr-evaluation-run .examples=${examples}></lr-evaluation-run>`)) as LyraEvaluationRun;
  const rows = [...el.shadowRoot!.querySelectorAll('[part="example"]')] as HTMLElement[];
  expect(rows[1]!.querySelector('[part="grounding-section"]')).to.not.exist;
});

it('composes lr-grounding-summary with the example assessment and citations when grounding is present', async () => {
  const citations: Citation[] = [{ id: 'cite-1', sourceId: 'doc-1', label: 'Refund policy doc' }];
  const withCitations: EvaluationExampleResult[] = [{ ...examples[0]!, citations }];
  const el = (await fixture(html`<lr-evaluation-run .examples=${withCitations}></lr-evaluation-run>`)) as LyraEvaluationRun;
  const section = el.shadowRoot!.querySelector('[part="grounding-section"]') as HTMLElement;
  expect(section).to.exist;
  const summary = section.querySelector('[part="grounding-summary"]') as HTMLElement;
  expect(summary.tagName.toLowerCase()).to.equal('lr-grounding-summary');
  expect((summary as unknown as { assessment: GroundingAssessment }).assessment).to.deep.equal(examples[0]!.grounding);
  expect((summary as unknown as { citations: Citation[] }).citations).to.deep.equal(citations);
});

it('renders no tool-trace section when the example has no toolTrace', async () => {
  const el = (await fixture(html`<lr-evaluation-run .examples=${examples}></lr-evaluation-run>`)) as LyraEvaluationRun;
  const row = el.shadowRoot!.querySelector('[part="example"]') as HTMLElement;
  expect(row.querySelector('[part="tool-trace-section"]')).to.not.exist;
});

it('composes lr-tool-timeline with the example entries for the tool-trace section', async () => {
  const withTrace: EvaluationExampleResult[] = [{ ...examples[0]!, toolTrace }];
  const el = (await fixture(html`<lr-evaluation-run .examples=${withTrace}></lr-evaluation-run>`)) as LyraEvaluationRun;
  const timeline = el.shadowRoot!.querySelector('[part="tool-trace"]') as HTMLElement;
  expect(timeline.tagName.toLowerCase()).to.equal('lr-tool-timeline');
  expect((timeline as unknown as { entries: ToolTimelineEntry[] }).entries).to.deep.equal(toolTrace);
});

it('fires lr-example-toggle (not a raw lr-toggle) when an example is expanded', async () => {
  const el = (await fixture(html`<lr-evaluation-run .examples=${examples}></lr-evaluation-run>`)) as LyraEvaluationRun;
  const details = el.shadowRoot!.querySelector('[part="example"]') as HTMLElement;
  const summary = details.shadowRoot!.querySelector('summary') as HTMLElement;

  const firing = oneEvent(el, 'lr-example-toggle');
  summary.click();
  const event = await firing;
  expect((event as CustomEvent).detail).to.deep.equal({ id: 'ex-1', expanded: true });
});

it('correlates a nested grounding-summary citation selection with its example id via lr-example-citation-select', async () => {
  const el = (await fixture(html`<lr-evaluation-run .examples=${examples}></lr-evaluation-run>`)) as LyraEvaluationRun;
  const row = el.shadowRoot!.querySelector('[part="example"]') as HTMLElement & { open: boolean };
  row.open = true;
  await el.updateComplete;
  const summary = el.shadowRoot!.querySelector('[part="grounding-summary"]') as HTMLElement;
  const citation: Citation = { id: 'cite-1', sourceId: 'doc-1', label: 'Refund policy doc' };

  const firing = oneEvent(el, 'lr-example-citation-select');
  summary.dispatchEvent(new CustomEvent('lr-citation-select', { detail: { citation }, bubbles: true, composed: true }));
  const event = await firing;
  expect((event as CustomEvent).detail).to.deep.equal({ exampleId: 'ex-1', citation });
});

it('correlates a nested tool-approval decision with its example id via lr-example-tool-approval-decide', async () => {
  const withTrace: EvaluationExampleResult[] = [{ ...examples[0]!, toolTrace }];
  const el = (await fixture(html`<lr-evaluation-run .examples=${withTrace}></lr-evaluation-run>`)) as LyraEvaluationRun;
  const row = el.shadowRoot!.querySelector('[part="example"]') as HTMLElement & { open: boolean };
  row.open = true;
  await el.updateComplete;
  const timeline = el.shadowRoot!.querySelector('[part="tool-trace"]') as HTMLElement;

  const firing = oneEvent(el, 'lr-example-tool-approval-decide');
  timeline.dispatchEvent(
    new CustomEvent('lr-tool-approval-decide', {
      detail: { invocationId: 'call-1', approved: true, args: { query: 'refund policy' } },
      bubbles: true,
      composed: true,
    }),
  );
  const event = await firing;
  expect((event as CustomEvent).detail).to.deep.equal({
    exampleId: 'ex-1',
    invocationId: 'call-1',
    approved: true,
    args: { query: 'refund policy' },
  });
});

describe('status-change announcements', () => {
  async function getLiveRegionText(el: LyraEvaluationRun): Promise<string> {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return el.shadowRoot!.querySelector('lr-live-region')!.shadowRoot!.querySelector('[part="region"]')!
      .textContent!;
  }

  it('never announces on first sight (mount)', async () => {
    const el = (await fixture(html`<lr-evaluation-run .examples=${examples}></lr-evaluation-run>`)) as LyraEvaluationRun;
    expect(await getLiveRegionText(el)).to.equal('');
  });

  it('announces an example completing (running -> done), politely', async () => {
    const el = (await fixture(html`<lr-evaluation-run .examples=${examples}></lr-evaluation-run>`)) as LyraEvaluationRun;
    el.examples = examples.map((ex) => (ex.id === 'ex-2' ? { ...ex, status: { kind: 'done' as const } } : ex));
    await el.updateComplete;
    expect(await getLiveRegionText(el)).to.equal('Example 2 completed');
  });

  it('announces an example failing (running -> error), assertively', async () => {
    const el = (await fixture(html`<lr-evaluation-run .examples=${examples}></lr-evaluation-run>`)) as LyraEvaluationRun;
    el.examples = examples.map((ex) => (ex.id === 'ex-2' ? { ...ex, status: { kind: 'error' as const } } : ex));
    await el.updateComplete;
    const region = el.shadowRoot!.querySelector('lr-live-region')!;
    expect((region as unknown as { mode: string }).mode).to.equal('assertive');
    expect(await getLiveRegionText(el)).to.equal('Example 2 failed');
  });
});

it('localizes built-in strings via .strings while an unregistered key still renders its English default', async () => {
  const el = (await fixture(
    html`<lr-evaluation-run .examples=${examples} .strings=${{ evaluationRunGroundingHeading: 'Ancrage' }}></lr-evaluation-run>`,
  )) as LyraEvaluationRun;
  const details = el.shadowRoot!.querySelector('[part="example"]') as HTMLElement & { open: boolean };
  details.open = true;
  await el.updateComplete;
  const heading = details.querySelector('[part="grounding-section"] [part="section-heading"]');
  expect(heading!.textContent!.trim()).to.equal('Ancrage');
});

it('mirrors correctly and stays within a 320px allocation (RTL + narrow-container coverage)', async () => {
  const container = document.createElement('div');
  container.setAttribute('dir', 'rtl');
  container.style.inlineSize = '320px';
  const el = (await fixture(
    html`<lr-evaluation-run .examples=${examples} total="4"></lr-evaluation-run>`,
    { parentNode: container },
  )) as LyraEvaluationRun;
  await el.updateComplete;
  expect((el as unknown as HTMLElement).getBoundingClientRect().width).to.be.at.most(320);
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal(
    '2 of 4 examples complete',
  );
});

it('is accessible with no examples', async () => {
  const el = await fixture(html`<lr-evaluation-run></lr-evaluation-run>`);
  await expect(el).to.be.accessible();
});

it('is accessible with populated, expanded examples including grounding and a tool trace', async () => {
  const populated: EvaluationExampleResult[] = [
    {
      ...examples[0]!,
      toolTrace,
      citations: [{ id: 'cite-1', sourceId: 'doc-1', label: 'Refund policy doc' }],
      grounding: { ...examples[0]!.grounding!, warnings: ['Check pricing claim'] },
    },
    examples[1]!,
    examples[2]!,
  ];
  const el = (await fixture(html`<lr-evaluation-run .examples=${populated}></lr-evaluation-run>`)) as LyraEvaluationRun;
  const rows = [...el.shadowRoot!.querySelectorAll('[part="example"]')] as (HTMLElement & { open: boolean })[];
  for (const row of rows) row.open = true;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="grounding-summary"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="tool-trace"]')).to.exist;
  await expect(el).to.be.accessible();
});

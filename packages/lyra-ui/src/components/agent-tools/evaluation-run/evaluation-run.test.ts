import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './evaluation-run.js';
import type { LyraEvaluationRun, EvaluationExampleResult } from './evaluation-run.js';
import type { Citation, GroundingAssessment } from '../../../ai/types.js';
import type { LyraToolTimeline, ToolTimelineEntry } from '../tool-timeline/tool-timeline.class.js';
import type { LyraToolApprovalDialog } from '../tool-approval-dialog/tool-approval-dialog.class.js';

const examples: EvaluationExampleResult[] = [
  {
    id: 'ex-1',
    label: 'Refund policy question',
    status: { kind: 'done' },
    input: { text: 'What is the refund policy?' },
    output: { text: 'Refunds are available within 30 days.' },
    grounding: { supportedClaims: 3, unsupportedClaims: 1, coverage: 0.85, confidence: 0.9 },
  },
  {
    id: 'ex-2',
    status: { kind: 'running' },
    input: { text: 'print("hi")', format: 'code', language: 'python' },
    output: { text: '' },
  },
  {
    id: 'ex-3',
    status: { kind: 'error', message: 'Timed out' },
    input: { text: 'What is 2+2?' },
    output: { text: '' },
  },
];

const toolTrace: ToolTimelineEntry[] = [
  { id: 'call-1', name: 'search', args: { query: 'refund policy' }, status: 'success', result: { hits: 2 } },
];

async function expandExample(el: LyraEvaluationRun, index = 0): Promise<HTMLElement> {
  const row = el.shadowRoot!.querySelectorAll('[part="example"]')[index] as HTMLElement;
  row.dispatchEvent(new CustomEvent('lr-toggle', {
    bubbles: true,
    composed: true,
    detail: { open: true },
  }));
  await el.updateComplete;
  return el.shadowRoot!.querySelectorAll('[part="example"]')[index] as HTMLElement;
}

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

it('never reports an explicit total below the observed example count', async () => {
  const el = (await fixture(
    html`<lr-evaluation-run .examples=${examples} total="1"></lr-evaluation-run>`,
  )) as LyraEvaluationRun;
  const progress = el.shadowRoot!.querySelector('[part="progress"]') as HTMLElement;
  expect(progress.getAttribute('max')).to.equal('3');
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal(
    '2 of 3 examples complete',
  );
});

it('formats generated example, progress, and status counts with the effective locale', async () => {
  const el = (await fixture(
    html`<lr-evaluation-run lang="ar-EG" .examples=${examples} total="4"></lr-evaluation-run>`,
  )) as LyraEvaluationRun;
  const number = new Intl.NumberFormat('ar-EG');
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent).to.include(number.format(2));
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent).to.include(number.format(4));
  expect(el.shadowRoot!.querySelectorAll('[part="example-label"]')[1]!.textContent).to.include(number.format(2));
  expect([...el.shadowRoot!.querySelectorAll('[part="count"]')].every((node) =>
    node.textContent?.includes(number.format(1)))).to.be.true;
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
  expect((el.shadowRoot!.querySelector('[part="example"]')) == null).to.be.true;
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

it('renders caller status presentation and counts a custom terminal kind as complete', async () => {
  const custom: EvaluationExampleResult[] = [{
    id: 'custom',
    status: {
      kind: 'provider-complete',
      label: 'Archived',
      variant: 'success',
      terminal: true,
      message: 'Stored by the provider',
    },
    input: { text: 'input' },
    output: { text: 'output' },
  }];
  const el = await fixture<LyraEvaluationRun>(html`<lr-evaluation-run .examples=${custom}></lr-evaluation-run>`);
  const badge = el.shadowRoot!.querySelector('lr-badge[part="example-status"]') as HTMLElement & { variant: string };
  expect(badge.textContent!.trim()).to.equal('Archived');
  expect(badge.variant).to.equal('success');
  expect(el.shadowRoot!.querySelector('[part="example-status-message"]')!.textContent).to.equal('Stored by the provider');
  expect(el.shadowRoot!.querySelector('[part="progress"]')!.getAttribute('value')).to.equal('1');
});

it('renders plain-text input/output via lr-markdown by default', async () => {
  const el = (await fixture(html`<lr-evaluation-run .examples=${examples}></lr-evaluation-run>`)) as LyraEvaluationRun;
  const row = await expandExample(el);
  const input = row.querySelector('[part="input"]') as HTMLElement;
  expect(input.tagName.toLowerCase()).to.equal('lr-markdown');
  expect((input as unknown as { content: string }).content).to.equal('What is the refund policy?');
});

it('renders code input/output via lr-code-block when the example requests it, with its language', async () => {
  const el = (await fixture(html`<lr-evaluation-run .examples=${examples}></lr-evaluation-run>`)) as LyraEvaluationRun;
  const row = await expandExample(el, 1);
  const input = row.querySelector('[part="input"]') as HTMLElement;
  expect(input.tagName.toLowerCase()).to.equal('lr-code-block');
  expect(input.getAttribute('language')).to.equal('python');
});

it('renders no grounding section when the example carries no grounding assessment', async () => {
  const el = (await fixture(html`<lr-evaluation-run .examples=${examples}></lr-evaluation-run>`)) as LyraEvaluationRun;
  const row = await expandExample(el, 1);
  expect((row.querySelector('[part="grounding-section"]')) == null).to.be.true;
});

it('composes lr-grounding-summary with the example assessment and citations when grounding is present', async () => {
  const citations: Citation[] = [{ id: 'cite-1', sourceId: 'doc-1', label: 'Refund policy doc' }];
  const withCitations: EvaluationExampleResult[] = [{ ...examples[0]!, citations }];
  const el = (await fixture(html`<lr-evaluation-run .examples=${withCitations}></lr-evaluation-run>`)) as LyraEvaluationRun;
  const row = await expandExample(el);
  const section = row.querySelector('[part="grounding-section"]') as HTMLElement;
  expect((section) != null).to.equal(true);
  const summary = section.querySelector('[part="grounding-summary"]') as HTMLElement;
  expect(summary.tagName.toLowerCase()).to.equal('lr-grounding-summary');
  expect((summary as unknown as { assessment: GroundingAssessment }).assessment).to.deep.equal(examples[0]!.grounding);
  expect((summary as unknown as { citations: Citation[] }).citations).to.deep.equal(citations);
});

it('renders every non-primary status label, including a title-cased fallback for an unrecognized kind', async () => {
  const statusExamples: EvaluationExampleResult[] = [
    { id: 's-idle', status: { kind: 'idle' }, input: { text: 'a' }, output: { text: '' } },
    { id: 's-wi', status: { kind: 'waiting-input' }, input: { text: 'b' }, output: { text: '' } },
    { id: 's-wa', status: { kind: 'waiting-approval' }, input: { text: 'c' }, output: { text: '' } },
    { id: 's-cancel', status: { kind: 'cancelled' }, input: { text: 'd' }, output: { text: '' } },
    { id: 's-unknown', status: { kind: 'custom_state-x' }, input: { text: 'e' }, output: { text: '' } },
  ];
  const el = (await fixture(html`<lr-evaluation-run .examples=${statusExamples}></lr-evaluation-run>`)) as LyraEvaluationRun;
  const rows = [...el.shadowRoot!.querySelectorAll('[part="example"]')] as HTMLElement[];
  const texts = rows.map((row) => row.querySelector('[part="example-status"]')!.textContent!.trim());
  expect(texts).to.deep.equal([
    'Idle',
    'Waiting for input',
    'Waiting for approval',
    'Cancelled',
    'Custom State X',
  ]);
});

it('falls back to an empty language attribute when a code-formatted example omits its language', async () => {
  const noLanguage: EvaluationExampleResult[] = [
    { id: 'ex-nolang', status: { kind: 'done' }, input: { text: 'x = 1', format: 'code' }, output: { text: '' } },
  ];
  const el = (await fixture(html`<lr-evaluation-run .examples=${noLanguage}></lr-evaluation-run>`)) as LyraEvaluationRun;
  const row = await expandExample(el);
  const input = row.querySelector('[part="input"]') as HTMLElement;
  expect(input.tagName.toLowerCase()).to.equal('lr-code-block');
  expect(input.getAttribute('language')).to.equal('');
});

it('deletes the id from expandedIds (and reports expanded: false) when an example is collapsed', async () => {
  const el = (await fixture(html`<lr-evaluation-run .examples=${examples}></lr-evaluation-run>`)) as LyraEvaluationRun;
  const details = el.shadowRoot!.querySelector('[part="example"]') as HTMLElement & { open: boolean };
  details.open = true;
  await el.updateComplete;
  const summary = details.shadowRoot!.querySelector('summary') as HTMLElement;

  const firing = oneEvent(el, 'lr-example-toggle');
  summary.click(); // was open -> collapses
  const event = await firing;
  expect((event as CustomEvent).detail).to.deep.equal({ exampleId: 'ex-1', expanded: false });
});

it('forgets an expanded example id once that example is removed', async () => {
  const el = (await fixture(html`<lr-evaluation-run .examples=${examples}></lr-evaluation-run>`)) as LyraEvaluationRun;
  await expandExample(el);
  el.examples = examples.slice(1);
  await el.updateComplete;
  el.examples = [examples[0]!];
  await el.updateComplete;
  const restored = el.shadowRoot!.querySelector('[part="example"]') as HTMLElement & { open: boolean };
  expect(restored.open).to.be.false;
});

it('renders no tool-trace section when the example has no toolTrace', async () => {
  const el = (await fixture(html`<lr-evaluation-run .examples=${examples}></lr-evaluation-run>`)) as LyraEvaluationRun;
  const row = await expandExample(el);
  expect((row.querySelector('[part="tool-trace-section"]')) == null).to.be.true;
});

it('composes lr-tool-timeline with the example entries for the tool-trace section', async () => {
  const withTrace: EvaluationExampleResult[] = [{ ...examples[0]!, toolTrace }];
  const el = (await fixture(html`<lr-evaluation-run .examples=${withTrace}></lr-evaluation-run>`)) as LyraEvaluationRun;
  const row = await expandExample(el);
  const timeline = row.querySelector('[part="tool-trace"]') as HTMLElement;
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
  expect((event as CustomEvent).detail).to.deep.equal({ exampleId: 'ex-1', expanded: true });
});

it('correlates a nested grounding-summary citation selection with its example id via lr-example-citation-select', async () => {
  const el = (await fixture(html`<lr-evaluation-run .examples=${examples}></lr-evaluation-run>`)) as LyraEvaluationRun;
  const row = await expandExample(el);
  const summary = row.querySelector('[part="grounding-summary"]') as HTMLElement;
  const citation: Citation = { id: 'cite-1', sourceId: 'doc-1', label: 'Refund policy doc' };

  const firing = oneEvent(el, 'lr-example-citation-select');
  summary.dispatchEvent(new CustomEvent('lr-citation-select', { detail: { citation }, bubbles: true, composed: true }));
  const event = await firing;
  expect((event as CustomEvent).detail).to.deep.equal({ exampleId: 'ex-1', citation });
});

it('correlates a nested tool-approval decision with its example id via lr-example-tool-approval-decide', async () => {
  const withTrace: EvaluationExampleResult[] = [{ ...examples[0]!, toolTrace }];
  const el = (await fixture(html`<lr-evaluation-run .examples=${withTrace}></lr-evaluation-run>`)) as LyraEvaluationRun;
  const row = await expandExample(el);
  const timeline = row.querySelector('[part="tool-trace"]') as HTMLElement;

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

it('contains nested lifecycle/tool events and correlates the second example at its boundary', async () => {
  const withTwoTraces: EvaluationExampleResult[] = [
    { ...examples[0]!, toolTrace },
    { ...examples[1]!, toolTrace: [{ ...toolTrace[0]!, id: 'call-2', sourceKey: 'run-b' }] },
  ];
  const el = await fixture<LyraEvaluationRun>(html`
    <lr-evaluation-run .examples=${withTwoTraces}></lr-evaluation-run>
  `);
  let rawShows = 0;
  let rawActivations = 0;
  let rawRenderErrors = 0;
  el.addEventListener('lr-show', () => rawShows++);
  el.addEventListener('lr-tool-activate', () => rawActivations++);
  el.addEventListener('lr-tool-render-error', () => rawRenderErrors++);
  const second = await expandExample(el, 1);
  expect(rawShows).to.equal(0);
  const timeline = second.querySelector('lr-tool-timeline')!;

  const activated = oneEvent(el, 'lr-example-tool-activate');
  timeline.dispatchEvent(new CustomEvent('lr-tool-activate', {
    bubbles: true,
    composed: true,
    detail: { invocationId: 'call-2', sourceKey: 'run-b' },
  }));
  expect((await activated).detail).to.deep.equal({
    exampleId: 'ex-2',
    invocationId: 'call-2',
    sourceKey: 'run-b',
  });

  const failed = oneEvent(el, 'lr-example-tool-render-error');
  timeline.dispatchEvent(new CustomEvent('lr-tool-render-error', {
    bubbles: true,
    composed: true,
    detail: { invocationId: 'call-2', sourceKey: 'run-b', toolName: 'search', error: 'failed' },
  }));
  expect((await failed).detail).to.deep.equal({
    exampleId: 'ex-2',
    invocationId: 'call-2',
    sourceKey: 'run-b',
    toolName: 'search',
    error: 'failed',
  });
  expect([rawActivations, rawRenderErrors]).to.deep.equal([0, 0]);
});

it('keeps the real nested approval pending when the correlated wrapper decision is vetoed', async () => {
  const pendingTrace: ToolTimelineEntry[] = [
    {
      id: 'call-pending',
      name: 'search',
      args: { query: 'refund policy' },
      status: 'pending',
      needsApproval: true,
    },
  ];
  const withTrace: EvaluationExampleResult[] = [{ ...examples[0]!, toolTrace: pendingTrace }];
  const el = (await fixture(html`<lr-evaluation-run .examples=${withTrace}></lr-evaluation-run>`)) as LyraEvaluationRun;
  const row = await expandExample(el);
  const timeline = row.querySelector<LyraToolTimeline>('[part="tool-trace"]')!;
  const chip = timeline.shadowRoot!.querySelector('lr-tool-call-chip')!;

  chip.dispatchEvent(new CustomEvent('lr-tool-call-chip-select', { bubbles: true, composed: true }));
  await timeline.updateComplete;
  const dialog = timeline.shadowRoot!.querySelector<LyraToolApprovalDialog>('lr-tool-approval-dialog')!;
  expect(dialog.open).to.be.true;

  let wrapperCancelable = false;
  el.addEventListener('lr-example-tool-approval-decide', (event) => {
    wrapperCancelable = event.cancelable;
    event.preventDefault();
  }, { once: true });
  dialog.shadowRoot!.querySelector<HTMLElement>('[part="approve-button"]')!.click();
  await dialog.updateComplete;

  expect(wrapperCancelable).to.be.true;
  expect(dialog.open).to.be.true;
  expect(dialog.pending).to.equal('approve');
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

  it('announces an example starting (idle -> running), politely', async () => {
    const startingExamples = examples.map((ex) => (ex.id === 'ex-2' ? { ...ex, status: { kind: 'idle' as const } } : ex));
    const el = (await fixture(html`<lr-evaluation-run .examples=${startingExamples}></lr-evaluation-run>`)) as LyraEvaluationRun;
    el.examples = examples; // ex-2 idle -> running
    await el.updateComplete;
    const region = el.shadowRoot!.querySelector('lr-live-region')!;
    expect((region as unknown as { mode: string }).mode).to.equal('polite');
    expect(await getLiveRegionText(el)).to.equal('Example 2 started');
  });

  it('announces an example being cancelled (running -> cancelled), politely', async () => {
    const el = (await fixture(html`<lr-evaluation-run .examples=${examples}></lr-evaluation-run>`)) as LyraEvaluationRun;
    el.examples = examples.map((ex) => (ex.id === 'ex-2' ? { ...ex, status: { kind: 'cancelled' as const } } : ex));
    await el.updateComplete;
    expect(await getLiveRegionText(el)).to.equal('Example 2 cancelled');
  });

  it('announces an example needing input (running -> waiting-input), politely', async () => {
    const el = (await fixture(html`<lr-evaluation-run .examples=${examples}></lr-evaluation-run>`)) as LyraEvaluationRun;
    el.examples = examples.map((ex) => (ex.id === 'ex-2' ? { ...ex, status: { kind: 'waiting-input' as const } } : ex));
    await el.updateComplete;
    expect(await getLiveRegionText(el)).to.equal('Example 2 needs input');
  });

  it('announces an example needing approval (running -> waiting-approval), politely', async () => {
    const el = (await fixture(html`<lr-evaluation-run .examples=${examples}></lr-evaluation-run>`)) as LyraEvaluationRun;
    el.examples = examples.map((ex) => (ex.id === 'ex-2' ? { ...ex, status: { kind: 'waiting-approval' as const } } : ex));
    await el.updateComplete;
    expect(await getLiveRegionText(el)).to.equal('Example 2 needs approval');
  });

  it('does not announce a transition to idle (a no-op status, unlike the other terminal/waiting kinds)', async () => {
    const el = (await fixture(html`<lr-evaluation-run .examples=${examples}></lr-evaluation-run>`)) as LyraEvaluationRun;
    el.examples = examples.map((ex) => (ex.id === 'ex-2' ? { ...ex, status: { kind: 'idle' as const } } : ex));
    await el.updateComplete;
    expect(await getLiveRegionText(el)).to.equal('');
  });
});

it('localizes built-in strings via .strings while an unregistered key still renders its English default', async () => {
  const el = (await fixture(
    html`<lr-evaluation-run .examples=${examples} .strings=${{ evaluationRunGroundingHeading: 'Ancrage' }}></lr-evaluation-run>`,
  )) as LyraEvaluationRun;
  const details = await expandExample(el);
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
  await expandExample(el);
  expect(el.shadowRoot!.querySelector('[part="grounding-summary"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="tool-trace"]')).to.exist;
  await expect(el).to.be.accessible();
});

it('localizes queued and collecting statuses with the existing agent status keys', async () => {
  const el = (await fixture(html`
    <lr-evaluation-run
      .strings=${{
        agentRunStatusQueued: 'Dans la file',
        agentRunStatusCollecting: 'Collecte',
      }}
      .examples=${[
        { ...examples[0], status: { kind: 'queued' } },
        { ...examples[1], status: { kind: 'collecting' } },
      ]}
    ></lr-evaluation-run>
  `)) as LyraEvaluationRun;
  const labels = [...el.shadowRoot!.querySelectorAll('[part="example-status"]')].map((node) => node.textContent!.trim());
  expect(labels).to.deep.equal(['Dans la file', 'Collecte']);
});

it('does not mount heavy example bodies until their disclosure opens', async () => {
  const el = (await fixture(html`<lr-evaluation-run .examples=${examples}></lr-evaluation-run>`)) as LyraEvaluationRun;
  expect(el.shadowRoot!.querySelectorAll('lr-markdown').length).to.equal(0);
  const first = el.shadowRoot!.querySelector('[part="example"]') as HTMLElement & { open: boolean };
  first.open = true;
  first.dispatchEvent(new CustomEvent('lr-toggle', { bubbles: true, composed: true, detail: { open: true } }));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('lr-markdown').length).to.equal(2);
});

it('normalizes duplicate example ids first-wins before progress and disclosures', async () => {
  const el = await fixture<LyraEvaluationRun>(html`
    <lr-evaluation-run .examples=${[
      { id: 'same', label: 'First example', status: { kind: 'done' }, input: { text: 'first' }, output: { text: 'first' } },
      { id: 'same', label: 'Later example', status: { kind: 'error' }, input: { text: 'later' }, output: { text: 'later' } },
    ]}></lr-evaluation-run>
  `);
  const rows = el.shadowRoot!.querySelectorAll('[part="example"]');
  expect(rows).to.have.length(1);
  expect(rows[0]!.textContent).to.contain('First example');
  expect(rows[0]!.textContent).not.to.contain('Later example');
});

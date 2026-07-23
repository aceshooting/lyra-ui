import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './rag-eval-dashboard.js';
import type { LyraRagEvalDashboard, RagEvaluationMetric, RagEvaluationRun } from './rag-eval-dashboard.js';

const metrics: RagEvaluationMetric[] = [
  { id: 'mrr', label: 'MRR', category: 'retrieval', format: 'number' },
  { id: 'groundedness', label: 'Groundedness', category: 'generation', format: 'percent' },
];
const runs: RagEvaluationRun[] = [
  { id: 'run-1', label: 'Baseline', slice: 'all', metrics: { mrr: 0.62, groundedness: 0.8 } },
  { id: 'run-2', label: 'Reranker', slice: 'all', metrics: { mrr: 0.74, groundedness: 0.91 } },
  { id: 'run-3', label: 'Legal', slice: 'legal', metrics: { mrr: 0.7, groundedness: 0.88 } },
];

it('renders latest metric cards, a selected trend, and filters runs by slice', async () => {
  const el = (await fixture(
    html`<lr-rag-eval-dashboard .metrics=${metrics} .runs=${runs} metric-id="groundedness" slice="all"></lr-rag-eval-dashboard>`,
  )) as LyraRagEvalDashboard;
  expect(el.shadowRoot!.querySelectorAll('lr-stat').length).to.equal(2);
  expect(el.shadowRoot!.querySelectorAll('[part="run"]').length).to.equal(2);
  const chart = el.shadowRoot!.querySelector('lr-lite-chart') as HTMLElement & { datasets: unknown[] };
  expect(chart).to.exist;
  expect(chart.datasets).to.deep.equal([{ label: 'Groundedness', data: [0.8, 0.91] }]);
});

it('emits controlled metric, slice, and run selection events', async () => {
  const el = (await fixture(
    html`<lr-rag-eval-dashboard .metrics=${metrics} .runs=${runs} metric-id="mrr"></lr-rag-eval-dashboard>`,
  )) as LyraRagEvalDashboard;

  const metricPending = oneEvent(el, 'lr-metric-change');
  (el.shadowRoot!.querySelector('[data-metric-id="groundedness"]') as HTMLButtonElement).click();
  expect((await metricPending).detail).to.deep.equal({ metricId: 'groundedness' });

  const slicePending = oneEvent(el, 'lr-slice-change');
  (el.shadowRoot!.querySelector('[data-slice="legal"]') as HTMLButtonElement).click();
  expect((await slicePending).detail).to.deep.equal({ slice: 'legal' });

  const runPending = oneEvent(el, 'lr-run-select');
  (el.shadowRoot!.querySelector('[part="run"]') as HTMLButtonElement).click();
  expect((await runPending).detail).to.deep.equal({ run: runs[0] });
});

it('has a localized empty state and a named populated region', async () => {
  const empty = (await fixture(
    html`<lr-rag-eval-dashboard
      .strings=${{ ragEvalDashboardEmpty: 'Aucune évaluation disponible' }}
    ></lr-rag-eval-dashboard>`,
  )) as LyraRagEvalDashboard;
  expect(empty.shadowRoot!.querySelector('lr-empty')?.getAttribute('heading')).to.equal(
    'Aucune évaluation disponible',
  );
  const populated = (await fixture(
    html`<lr-rag-eval-dashboard aria-label="RAG quality" .metrics=${metrics} .runs=${runs}></lr-rag-eval-dashboard>`,
  )) as LyraRagEvalDashboard;
  expect(populated.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('RAG quality');
  await expect(populated).shadowDom.to.be.accessible();
});

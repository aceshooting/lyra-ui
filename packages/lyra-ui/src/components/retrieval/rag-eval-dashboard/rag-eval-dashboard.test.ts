import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './rag-eval-dashboard.js';
import type { LyraRagEvalDashboard, LyraRagEvaluationMetric, LyraRagEvaluationRun } from './rag-eval-dashboard.js';
import type { LyraStat } from '../../data/stat/stat.class.js';

const metrics: LyraRagEvaluationMetric[] = [
  { id: 'mrr', label: 'MRR', category: 'retrieval', format: 'number' },
  { id: 'groundedness', label: 'Groundedness', category: 'generation', format: 'percent' },
];
const runs: LyraRagEvaluationRun[] = [
  { id: 'run-1', label: 'Baseline', slice: 'all', metrics: { mrr: 0.62, groundedness: 0.8 } },
  { id: 'run-2', label: 'Reranker', slice: 'all', metrics: { mrr: 0.74, groundedness: 0.91 } },
  { id: 'run-3', label: 'Legal', slice: 'legal', metrics: { mrr: 0.7, groundedness: 0.88 } },
];

it('renders latest metric cards, a selected trend, and filters runs by slice', async () => {
  const el = (await fixture(
    html`<lr-rag-eval-dashboard .metrics=${metrics} .runs=${runs} metric-id="groundedness" slice="all"></lr-rag-eval-dashboard>`,
  )) as LyraRagEvalDashboard;
  const stats = [...el.shadowRoot!.querySelectorAll('lr-stat')] as LyraStat[];
  expect(stats.length).to.equal(2);
  for (const stat of stats) {
    await stat.updateComplete;
    const chrome = getComputedStyle(stat.shadowRoot!.querySelector('[part="base"]') as HTMLElement);
    expect(stat.frame).to.equal('plain');
    expect(chrome.borderTopWidth).to.equal('0px');
    expect(chrome.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    expect(chrome.paddingTop).to.equal('0px');
  }
  expect(el.shadowRoot!.querySelectorAll('[part="run"]').length).to.equal(2);
  const chart = el.shadowRoot!.querySelector('lr-lite-chart') as HTMLElement & { datasets: unknown[] };
  expect((chart) != null).to.equal(true);
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

it('emits the canonical lr-run-change alongside the legacy lr-run-select alias, both exactly once with identical detail', async () => {
  const el = (await fixture(
    html`<lr-rag-eval-dashboard .metrics=${metrics} .runs=${runs} metric-id="mrr"></lr-rag-eval-dashboard>`,
  )) as LyraRagEvalDashboard;

  let canonicalCount = 0;
  let legacyCount = 0;
  const canonicalPending = oneEvent(el, 'lr-run-change');
  const legacyPending = oneEvent(el, 'lr-run-select');
  el.addEventListener('lr-run-change', () => canonicalCount++);
  el.addEventListener('lr-run-select', () => legacyCount++);

  (el.shadowRoot!.querySelector('[part="run"]') as HTMLButtonElement).click();
  const [canonical, legacy] = await Promise.all([canonicalPending, legacyPending]);

  expect(canonical.detail).to.deep.equal({ run: runs[0] });
  expect(legacy.detail).to.deep.equal(canonical.detail);
  expect(canonicalCount, 'canonical name fires exactly once').to.equal(1);
  expect(legacyCount, 'legacy alias fires exactly once').to.equal(1);
});

it('has a localized empty state and one populated overall owner', async () => {
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
  expect(populated.getAttribute('aria-label')).to.equal('RAG quality');
  expect(populated.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(null);
  expect(populated.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')).to.equal(null);
  populated.setAttribute('aria-label', '');
  await populated.updateComplete;
  expect(populated.getAttribute('aria-label')).to.equal('');
  expect(populated.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('');
  expect(populated.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')).to.equal('region');
  populated.setAttribute('aria-label', 'Revised RAG quality');
  await populated.updateComplete;
  expect(populated.getAttribute('aria-label')).to.equal('Revised RAG quality');
  expect(populated.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(null);
  expect(populated.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')).to.equal(null);
  await expect(populated).shadowDom.to.be.accessible();
});

it('applies per-instance strings to the evaluation region label', async () => {
  const el = (await fixture(html`<lr-rag-eval-dashboard
    .strings=${{ ragEvalDashboardLabel: 'Localized RAG evaluation' }}
  ></lr-rag-eval-dashboard>`)) as LyraRagEvalDashboard;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
    'Localized RAG evaluation',
  );
});

it('honors an explicitly empty label as genuinely empty, distinct from omitting it', async () => {
  const el = (await fixture(
    html`<lr-rag-eval-dashboard .metrics=${metrics} .runs=${runs}></lr-rag-eval-dashboard>`,
  )) as LyraRagEvalDashboard;
  expect(el.label).to.equal(undefined);
  expect(el.shadowRoot!.querySelector('[part="heading"]')!.textContent).to.equal(
    'RAG evaluation dashboard',
  );
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
    'RAG evaluation dashboard',
  );

  el.label = '';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="heading"]')!.textContent).to.equal('');
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('');
});

it('preserves an unavailable controlled slice and renders a localized unavailable-filter state', async () => {
  const el = (await fixture(html`
    <lr-rag-eval-dashboard
      slice="missing"
      .metrics=${metrics}
      .runs=${runs}
      .strings=${{ ragEvalDashboardSliceUnavailable: 'Aucune exécution pour {slice}.' }}
    ></lr-rag-eval-dashboard>
  `)) as LyraRagEvalDashboard;

  expect(el.slice).to.equal('missing');
  expect(el.shadowRoot!.querySelectorAll('[part~="slice"][aria-pressed="true"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="empty"]')?.getAttribute('heading')).to.equal(
    'Aucune exécution pour missing.',
  );
  expect(el.shadowRoot!.querySelectorAll('[part="run"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelectorAll('lr-stat').length).to.equal(0);
  expect(el.shadowRoot!.querySelector('lr-lite-chart') === null).to.equal(true);
});

it('omits the trend chart when show-chart is disabled', async () => {
  const el = (await fixture(
    html`<lr-rag-eval-dashboard .metrics=${metrics} .runs=${runs} metric-id="groundedness" slice="all"></lr-rag-eval-dashboard>`,
  )) as LyraRagEvalDashboard;
  expect(el.shadowRoot!.querySelector('[part="chart"]') === null).to.equal(false);

  el.showChart = false;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="chart"]') === null).to.equal(true);
  expect(el.shadowRoot!.querySelector('lr-lite-chart') === null).to.equal(true);
});

it('omits blank and later duplicate metric and run ids before fallback, filters, rendering, and actions', async () => {
  const firstMetric: LyraRagEvaluationMetric = {
    id: 'metric-1',
    label: 'First metric',
    category: 'retrieval',
  };
  const firstRun: LyraRagEvaluationRun = {
    id: 'run-1',
    label: 'First run',
    slice: 'first-slice',
    metrics: { 'metric-1': 0.5 },
  };
  const el = (await fixture(html`
    <lr-rag-eval-dashboard
      .metrics=${[
        { ...firstMetric, id: '' },
        firstMetric,
        { ...firstMetric, label: 'Later metric' },
      ]}
      .runs=${[
        { ...firstRun, id: ' ' },
        firstRun,
        { ...firstRun, label: 'Later run', slice: 'later-slice' },
      ]}
    ></lr-rag-eval-dashboard>
  `)) as LyraRagEvalDashboard;

  expect(el.shadowRoot!.querySelectorAll('[part~="metric"]').length).to.equal(1);
  expect(el.shadowRoot!.querySelectorAll('[part="run"]').length).to.equal(1);
  expect(
    (el.shadowRoot!.querySelector('lr-stat') as LyraStat).label
  ).to.equal(firstMetric.label);
  expect(el.shadowRoot!.querySelector('[data-slice="later-slice"]') === null).to.be.true;

  const metricSelected = oneEvent(el, 'lr-metric-change');
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="metric"]')!.click();
  expect((await metricSelected).detail).to.deep.equal({ metricId: firstMetric.id });

  const runSelected = oneEvent(el, 'lr-run-select');
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="run"]')!.click();
  expect((await runSelected).detail).to.deep.equal({ run: firstRun });
});

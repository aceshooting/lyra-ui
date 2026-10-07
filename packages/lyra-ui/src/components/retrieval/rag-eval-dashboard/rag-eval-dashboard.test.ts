import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './rag-eval-dashboard.js';
import type {
  LyraRagEvalDashboard,
  LyraRagEvaluationMetric,
  LyraRagEvaluationRun,
} from './rag-eval-dashboard.js';
import type { LyraStat } from '../../data/stat/stat.class.js';
import { setForcedColors } from '../../../../test/wtr-media.js';
import {
  captureDeprecationWarnings,
  type DeprecatedUsage,
} from '../../../../test/expected-deprecations.js';

const metrics: LyraRagEvaluationMetric[] = [
  { id: 'mrr', label: 'MRR', category: 'retrieval', format: 'number' },
  {
    id: 'groundedness',
    label: 'Groundedness',
    category: 'generation',
    format: 'percent',
  },
];
const runs: LyraRagEvaluationRun[] = [
  {
    id: 'run-1',
    label: 'Baseline',
    slice: 'all',
    metrics: { mrr: 0.62, groundedness: 0.8 },
  },
  {
    id: 'run-2',
    label: 'Reranker',
    slice: 'all',
    metrics: { mrr: 0.74, groundedness: 0.91 },
  },
  {
    id: 'run-3',
    label: 'Legal',
    slice: 'legal',
    metrics: { mrr: 0.7, groundedness: 0.88 },
  },
];

it('renders latest metric cards, a selected trend, and filters runs by slice', async () => {
  const el = (await fixture(
    html`<lr-rag-eval-dashboard
      .metrics=${metrics}
      .runs=${runs}
      metric-id="groundedness"
      slice="all"
    ></lr-rag-eval-dashboard>`
  )) as LyraRagEvalDashboard;
  const stats = [...el.shadowRoot!.querySelectorAll('lr-stat')] as LyraStat[];
  expect(stats.length).to.equal(2);
  for (const stat of stats) {
    await stat.updateComplete;
    const chrome = getComputedStyle(
      stat.shadowRoot!.querySelector('[part="base"]') as HTMLElement
    );
    expect(stat.frame).to.equal('plain');
    expect(chrome.borderTopWidth).to.equal('0px');
    expect(chrome.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    expect(chrome.paddingTop).to.equal('0px');
  }
  expect(el.shadowRoot!.querySelectorAll('[part="run"]').length).to.equal(2);
  const chart = el.shadowRoot!.querySelector('lr-lite-chart')!;
  expect(chart.datasets).to.deep.equal([
    { label: 'Groundedness', data: [0.8, 0.91] },
  ]);
});

it('renders each required metric category as visible card metadata', async () => {
  const el = await fixture<LyraRagEvalDashboard>(html`
    <lr-rag-eval-dashboard
      .metrics=${metrics}
      .runs=${runs}
    ></lr-rag-eval-dashboard>
  `);
  expect(
    [...el.shadowRoot!.querySelectorAll('[part="metric-category"]')].map(
      (category) => category.textContent?.trim()
    )
  ).to.deep.equal(['retrieval', 'generation']);
});

it('exposes the selected slice and metric border through a component-scoped token', async () => {
  const el = await fixture<LyraRagEvalDashboard>(html`
    <lr-rag-eval-dashboard
      metric-id="mrr"
      slice="all"
      style="--lr-rag-eval-dashboard-selected-border-color: rgb(12, 34, 56)"
      .metrics=${metrics}
      .runs=${runs}
    ></lr-rag-eval-dashboard>
  `);
  for (const selected of el.shadowRoot!.querySelectorAll<HTMLElement>(
    '[part~="slice-selected"], [part~="metric-selected"]'
  )) {
    expect(getComputedStyle(selected).borderTopColor).to.equal(
      'rgb(12, 34, 56)'
    );
  }
});

it('omits valid-id runs whose metrics record is malformed', async () => {
  const el = (await fixture(
    html`<lr-rag-eval-dashboard
      .metrics=${metrics}
      .runs=${[{ id: 'bad', label: 'Malformed' }, runs[0]]}
    ></lr-rag-eval-dashboard>`
  )) as LyraRagEvalDashboard;

  expect(el.shadowRoot!.querySelectorAll('[part="run"]')).to.have.length(1);
  expect(el.shadowRoot!.textContent).to.contain('Baseline');
  expect(el.shadowRoot!.textContent).to.not.contain('Malformed');
});

it('emits controlled metric, slice, and run selection events', async () => {
  const el = (await fixture(
    html`<lr-rag-eval-dashboard
      .metrics=${metrics}
      .runs=${runs}
      metric-id="mrr"
    ></lr-rag-eval-dashboard>`
  )) as LyraRagEvalDashboard;

  const metricPending = oneEvent(el, 'lr-metric-change');
  (
    el.shadowRoot!.querySelector(
      '[data-metric-id="groundedness"]'
    ) as HTMLButtonElement
  ).click();
  expect((await metricPending).detail).to.deep.equal({
    metricId: 'groundedness',
  });

  const slicePending = oneEvent(el, 'lr-slice-change');
  (
    el.shadowRoot!.querySelector('[data-slice="legal"]') as HTMLButtonElement
  ).click();
  expect((await slicePending).detail).to.deep.equal({ slice: 'legal' });

  const runPending = oneEvent(el, 'lr-run-change');
  (el.shadowRoot!.querySelector('[part="run"]') as HTMLButtonElement).click();
  expect((await runPending).detail).to.deep.equal({ run: runs[0] });
});

it('has a localized empty state and one populated overall owner', async () => {
  const empty = (await fixture(
    html`<lr-rag-eval-dashboard
      .strings=${{ ragEvalDashboardEmpty: 'Aucune évaluation disponible' }}
    ></lr-rag-eval-dashboard>`
  )) as LyraRagEvalDashboard;
  expect(
    empty.shadowRoot!.querySelector('lr-empty')?.getAttribute('heading')
  ).to.equal('Aucune évaluation disponible');
  empty.setAttribute('aria-label', 'Empty RAG quality');
  await empty.updateComplete;
  expect(
    empty.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')
  ).to.equal(null);
  expect(
    empty.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')
  ).to.equal(null);
  const populated = (await fixture(
    html`<lr-rag-eval-dashboard
      aria-label="RAG quality"
      .metrics=${metrics}
      .runs=${runs}
    ></lr-rag-eval-dashboard>`
  )) as LyraRagEvalDashboard;
  expect(populated.getAttribute('aria-label')).to.equal('RAG quality');
  expect(
    populated
      .shadowRoot!.querySelector('[part="base"]')!
      .getAttribute('aria-label')
  ).to.equal(null);
  expect(
    populated.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')
  ).to.equal(null);
  populated.setAttribute('aria-label', '');
  await populated.updateComplete;
  expect(populated.getAttribute('aria-label')).to.equal('');
  expect(
    populated
      .shadowRoot!.querySelector('[part="base"]')!
      .getAttribute('aria-label')
  ).to.equal('');
  expect(
    populated.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')
  ).to.equal('region');
  populated.setAttribute('aria-label', 'Revised RAG quality');
  await populated.updateComplete;
  expect(populated.getAttribute('aria-label')).to.equal('Revised RAG quality');
  expect(
    populated
      .shadowRoot!.querySelector('[part="base"]')!
      .getAttribute('aria-label')
  ).to.equal(null);
  expect(
    populated.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')
  ).to.equal(null);
  await expect(populated).shadowDom.to.be.accessible();
});

it('applies per-instance strings to the evaluation region label', async () => {
  const el = (await fixture(html`<lr-rag-eval-dashboard
    .strings=${{ ragEvalDashboardLabel: 'Localized RAG evaluation' }}
  ></lr-rag-eval-dashboard>`)) as LyraRagEvalDashboard;
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')
  ).to.equal('Localized RAG evaluation');
});

it('honors an explicitly empty label as genuinely empty, distinct from omitting it', async () => {
  const el = (await fixture(
    html`<lr-rag-eval-dashboard
      .metrics=${metrics}
      .runs=${runs}
    ></lr-rag-eval-dashboard>`
  )) as LyraRagEvalDashboard;
  expect(el.label).to.equal(undefined);
  expect(
    el.shadowRoot!.querySelector('[part="heading"]')!.textContent
  ).to.equal('RAG evaluation dashboard');
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')
  ).to.equal('RAG evaluation dashboard');

  el.label = '';
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="heading"]')!.textContent
  ).to.equal('');
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')
  ).to.equal('');
});

it('preserves an unavailable controlled slice and renders a localized unavailable-filter state', async () => {
  const el = (await fixture(html`
    <lr-rag-eval-dashboard
      aria-label="Unavailable RAG slice"
      slice="missing"
      .metrics=${metrics}
      .runs=${runs}
      .strings=${{
        ragEvalDashboardSliceUnavailable: 'Aucune exécution pour {slice}.',
      }}
    ></lr-rag-eval-dashboard>
  `)) as LyraRagEvalDashboard;

  expect(el.slice).to.equal('missing');
  expect(
    el.shadowRoot!.querySelectorAll('[part~="slice"][aria-pressed="true"]')
      .length
  ).to.equal(0);
  expect(
    el.shadowRoot!.querySelector('[part="empty"]')?.getAttribute('heading')
  ).to.equal('Aucune exécution pour missing.');
  expect(el.shadowRoot!.querySelectorAll('[part="run"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelectorAll('lr-stat').length).to.equal(0);
  expect(el.shadowRoot!.querySelector('lr-lite-chart') === null).to.equal(true);
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')
  ).to.equal(null);
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')
  ).to.equal(null);
});

it('omits the trend chart when without-chart is set', async () => {
  const el = (await fixture(
    html`<lr-rag-eval-dashboard
      .metrics=${metrics}
      .runs=${runs}
      metric-id="groundedness"
      slice="all"
    ></lr-rag-eval-dashboard>`
  )) as LyraRagEvalDashboard;
  expect(el.shadowRoot!.querySelector('[part="chart"]') === null).to.equal(
    false
  );

  el.withoutChart = true;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="chart"]') === null).to.equal(
    true
  );
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

  expect(el.shadowRoot!.querySelectorAll('[part~="metric"]').length).to.equal(
    1
  );
  expect(el.shadowRoot!.querySelectorAll('[part="run"]').length).to.equal(1);
  expect((el.shadowRoot!.querySelector('lr-stat') as LyraStat).label).to.equal(
    firstMetric.label
  );
  expect(el.shadowRoot!.querySelector('[data-slice="later-slice"]') === null).to
    .be.true;

  const metricSelected = oneEvent(el, 'lr-metric-change');
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="metric"]')!.click();
  expect((await metricSelected).detail).to.deep.equal({
    metricId: firstMetric.id,
  });

  const runSelected = oneEvent(el, 'lr-run-change');
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="run"]')!.click();
  expect((await runSelected).detail).to.deep.equal({ run: firstRun });
});

it('renders runs without metric definitions or slices as bounded history only', async () => {
  const el = (await fixture(html`
    <lr-rag-eval-dashboard
      .metrics=${[]}
      .runs=${[{ id: 'run-only', label: 'Unscored run', metrics: {} }]}
    ></lr-rag-eval-dashboard>
  `)) as LyraRagEvalDashboard;

  expect(el.shadowRoot!.querySelector('[part="slices"]') === null).to.equal(
    true
  );
  expect(el.shadowRoot!.querySelector('[part="chart"]') === null).to.equal(
    true
  );
  expect(el.shadowRoot!.querySelectorAll('[part="metric"]').length).to.equal(0);
  expect(
    el.shadowRoot!.querySelector('[part="run"]')!.textContent!.trim()
  ).to.equal('Unscored run');
});

it('normalizes non-array collections and non-finite metric values', async () => {
  const el = (await fixture(html`
    <lr-rag-eval-dashboard
      .metrics=${[{ id: 'score', label: 'Score', category: 'retrieval' }]}
      .runs=${[
        {
          id: 'bad',
          label: 'Unavailable score',
          metrics: { score: Number.NaN },
        },
      ]}
    ></lr-rag-eval-dashboard>
  `)) as LyraRagEvalDashboard;
  const stat = el.shadowRoot!.querySelector('lr-stat') as LyraStat;
  expect(stat.value).to.equal('0');
  expect(
    el.shadowRoot!.querySelector('[part="run"]')!.querySelectorAll('span')
      .length
  ).to.equal(1);
  expect(
    el.shadowRoot!.querySelector('lr-lite-chart')!.datasets
  ).to.deep.equal([{ label: 'Score', data: [null] }]);

  el.metrics = null as unknown as readonly LyraRagEvaluationMetric[];
  el.runs = null as unknown as readonly LyraRagEvaluationRun[];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="empty"]')).to.exist;
});

it('never falsely marks metrics[0] selected for an unmatched controlled metricId (regression)', async () => {
  const el = (await fixture(html`
    <lr-rag-eval-dashboard
      .metrics=${metrics}
      .runs=${runs}
      metric-id="does-not-exist"
    ></lr-rag-eval-dashboard>
  `)) as LyraRagEvalDashboard;
  // The host's own readback must still report exactly what was authored -- this is never in
  // question, but stated for contrast with the rendered state below.
  expect(el.metricId).to.equal('does-not-exist');
  // No metric may render as selected: silently substituting metrics[0] as "selected" while the
  // host reads back a different, unmatched metricId is the defect (contrast with the sibling
  // `slice` property, which renders its own explicit unavailable state for the identical shape).
  const selected = el.shadowRoot!.querySelectorAll('[part~="metric-selected"]');
  expect(selected.length).to.equal(0);
  for (const button of el.shadowRoot!.querySelectorAll('[part~="metric"]')) {
    expect(button.getAttribute('aria-pressed')).to.equal('false');
  }
  // No chart is fabricated from the wrong metric's data either.
  expect(el.shadowRoot!.querySelector('lr-lite-chart') === null).to.be.true;
});

describe('lr-rag-eval-dashboard render cap', () => {
  it('caps rendered run rows at 500 and shows a localized truncation notice', async () => {
    const manyRuns: LyraRagEvaluationRun[] = Array.from(
      { length: 520 },
      (_unused, index) => ({
        id: `run-${index}`,
        label: `Run ${index}`,
        metrics: { mrr: 0.5 },
      })
    );
    const el = (await fixture(html`
      <lr-rag-eval-dashboard .metrics=${metrics} .runs=${manyRuns}></lr-rag-eval-dashboard>
    `)) as LyraRagEvalDashboard;
    expect(
      el.shadowRoot!.querySelectorAll('[part="run"]').length,
      'the run-history projection stays capped'
    ).to.equal(500);
    const limit = el.shadowRoot!.querySelector('[part="limit"]');
    expect(limit, 'a localized truncation notice is shown').to.exist;
    expect(limit!.textContent).to.contain('500');
  });

  it('renders no truncation notice at or under the render cap', async () => {
    const el = (await fixture(html`
      <lr-rag-eval-dashboard .metrics=${metrics} .runs=${runs}></lr-rag-eval-dashboard>
    `)) as LyraRagEvalDashboard;
    expect(el.shadowRoot!.querySelector('[part="limit"]') === null).to.equal(true);
  });
});

describe('lr-rag-eval-dashboard retired show-chart alias', () => {
  const ALIAS: DeprecatedUsage[] = [{ tag: 'lr-rag-eval-dashboard', kind: 'property', name: 'showChart' }];
  const observe = (el: LyraRagEvalDashboard): string => String(el.shadowRoot!.querySelector('[part="chart"]') !== null);
  const mount = (markup: ReturnType<typeof html>) => fixture<LyraRagEvalDashboard>(markup);

  it('applies without-chart with canonical defaults and no deprecation warning', async () => {
    let canonical = '';
    let plain = '';
    const warnings = await captureDeprecationWarnings(ALIAS, async () => {
      canonical = observe(await mount(html`<lr-rag-eval-dashboard .metrics=${metrics} .runs=${runs} metric-id="groundedness" slice="all" without-chart></lr-rag-eval-dashboard>`));
      plain = observe(await mount(html`<lr-rag-eval-dashboard .metrics=${metrics} .runs=${runs} metric-id="groundedness" slice="all"></lr-rag-eval-dashboard>`));
    });
    expect(canonical).to.not.equal(plain);
    expect(warnings).to.have.length(0);
  });
});

describe('lr-rag-eval-dashboard review fixes', () => {
  const series = (count: number): LyraRagEvaluationRun[] =>
    Array.from({ length: count }, (_unused, index) => ({ id: `run-${index}`, label: `Run ${index}`, metrics: { mrr: index / 1000 } }));

  it('keeps the most recent runs in the chart and history, ending where the metric cards do', async () => {
    const el = await fixture<LyraRagEvalDashboard>(html`<lr-rag-eval-dashboard .metrics=${metrics} .runs=${series(600)}></lr-rag-eval-dashboard>`);
    const labels = [...el.shadowRoot!.querySelectorAll('[part="run"] > span:first-child')].map((node) => node.textContent);
    expect(labels[0]).to.equal('Run 100');
    expect(labels.at(-1)).to.equal('Run 599');
    const chart = el.shadowRoot!.querySelector('lr-lite-chart') as unknown as { labels: string[] };
    expect(chart.labels[0]).to.equal('Run 100');
    expect(chart.labels.at(-1)).to.equal('Run 599');
    expect((el.shadowRoot!.querySelector('lr-stat') as LyraStat).value).to.equal('0.599');
  });

  it('hands the chart the same inputs across an unrelated update', async () => {
    const el = await fixture<LyraRagEvalDashboard>(html`<lr-rag-eval-dashboard .metrics=${metrics} .runs=${runs}></lr-rag-eval-dashboard>`);
    const chart = el.shadowRoot!.querySelector('lr-lite-chart') as HTMLElement & { labels: unknown; datasets: unknown };
    const before = [chart.labels, chart.datasets];
    el.label = 'Evaluation';
    await el.updateComplete;
    expect(chart.labels === before[0] && chart.datasets === before[1]).to.equal(true);
  });

  it('reports a metric, slice or run pick as a request event, then the deprecated change event', async () => {
    const el = await fixture<LyraRagEvalDashboard>(html`<lr-rag-eval-dashboard .metrics=${metrics} .runs=${runs} metric-id="mrr"></lr-rag-eval-dashboard>`);
    const seen: string[] = [];
    for (const name of ['lr-metric-change-request', 'lr-metric-change', 'lr-slice-change-request', 'lr-slice-change', 'lr-run-activate', 'lr-run-change'])
      el.addEventListener(name, (event) => seen.push(`${name}:${JSON.stringify((event as CustomEvent).detail)}`));
    el.shadowRoot!.querySelector<HTMLElement>('[data-metric-id="groundedness"]')!.click();
    el.shadowRoot!.querySelector<HTMLElement>('[data-slice="legal"]')!.click();
    el.shadowRoot!.querySelector<HTMLElement>('[part="run"]')!.click();
    expect(seen).to.deep.equal([
      'lr-metric-change-request:{"metricId":"groundedness"}',
      'lr-metric-change:{"metricId":"groundedness"}',
      'lr-slice-change-request:{"slice":"legal"}',
      'lr-slice-change:{"slice":"legal"}',
      `lr-run-activate:${JSON.stringify({ runId: runs[0]!.id, run: runs[0] })}`,
      `lr-run-change:${JSON.stringify({ run: runs[0] })}`,
    ]);
  });

  it('marks the selected slice and metric with an outline under forced colors', async () => {
    const el = await fixture<LyraRagEvalDashboard>(html`<lr-rag-eval-dashboard .metrics=${metrics} .runs=${runs} metric-id="mrr" slice="all"></lr-rag-eval-dashboard>`);
    const selected = ['slice-selected', 'metric-selected'].map((part) => el.shadowRoot!.querySelector(`[part~="${part}"]`)!);
    expect(selected.map((node) => getComputedStyle(node).outlineStyle)).to.deep.equal(['none', 'none']);
    try {
      await setForcedColors('active');
      expect(selected.map((node) => getComputedStyle(node).outlineStyle)).to.deep.equal(['solid', 'solid']);
    } finally {
      await setForcedColors('none');
    }
  });
});

describe('lr-rag-eval-dashboard heading level', () => {
  it('keeps level 2 with the run history one level below, takes heading-level, and drops semantics for none', async () => {
    const el = await fixture<LyraRagEvalDashboard>(html`<lr-rag-eval-dashboard .metrics=${metrics} .runs=${runs}></lr-rag-eval-dashboard>`);
    const levels = (): (string | null)[] => ['heading', 'runs-heading'].map((part) => el.shadowRoot!.querySelector(`[part="${part}"]`)!.getAttribute('aria-level'));
    expect(levels()).to.deep.equal(['2', '3']);
    el.setAttribute('heading-level', '4');
    await el.updateComplete;
    expect(levels()).to.deep.equal(['4', '5']);
    el.setAttribute('heading-level', 'none');
    await el.updateComplete;
    expect(levels()).to.deep.equal([null, null]);
  });
});

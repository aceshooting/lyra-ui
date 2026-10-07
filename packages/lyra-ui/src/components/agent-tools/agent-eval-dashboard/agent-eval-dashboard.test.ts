import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import './agent-eval-dashboard.js';
import type { LyraAgentEvalDashboard } from './agent-eval-dashboard.class.js';
import type { LyraStat } from '../../data/stat/stat.class.js';
import type { LyraLiteChart } from '../../charts/chart/lite-chart.class.js';
// These locale-formatting fixtures intentionally retain English messages.
expectLocaleFallback('de-DE', [
  'evaluationDashboardLabel',
  'chartValueLabel',
  'evaluationDashboardNoRuns',
  'durationSeconds',
  'trendUnchanged',
]);
describe('lr-agent-eval-dashboard', () => {
  it('renders metrics, trend, and runs', async () => { const el = (await fixture(html`<lr-agent-eval-dashboard .strings=${{ evaluationDashboardLabel: 'Evaluation overview' }} .metrics=${[{ id: 'pass', label: 'Pass rate', value: 0.9, format: 'percent' }]} .runs=${[{ id: 'r1', label: 'Run 1', status: 'done', metrics: { pass: 0.9 } }]}></lr-agent-eval-dashboard>`)) as LyraAgentEvalDashboard; await el.updateComplete; expect(el.shadowRoot!.querySelector('lr-lite-chart')).to.exist; expect(el.shadowRoot!.querySelectorAll('[part="run"]').length).to.equal(1); });

  it('keeps a run row and a metric card on their own entry when the host prepends one', async () => {
    const metrics = [{ id: 'a', label: 'A', value: 1 }, { id: 'b', label: 'B', value: 2 }];
    const runs = [{ id: 'r1', label: 'Run 1', status: 'done', metrics: { a: 1 } }, { id: 'r2', label: 'Run 2', status: 'done', metrics: { a: 2 } }];
    const el = await fixture<LyraAgentEvalDashboard>(html`<lr-agent-eval-dashboard .metrics=${metrics} .runs=${runs}></lr-agent-eval-dashboard>`);
    const row = el.shadowRoot!.querySelectorAll('[part="run"]')[1];
    const card = el.shadowRoot!.querySelectorAll('[part="metric"]')[1];
    el.runs = [{ id: 'r0', label: 'Run 0', status: 'done' }, ...runs];
    el.metrics = [{ id: 'z', label: 'Z', value: 0 }, ...metrics];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="run"]')[2] === row).to.equal(true);
    expect(el.shadowRoot!.querySelectorAll('[part="metric"]')[2] === card).to.equal(true);
  });

  it('suppresses the chart when without-chart is set', async () => {
    const props = {
      metrics: [{ id: 'pass', label: 'Pass rate', value: 0.9, format: 'percent' }],
      runs: [{ id: 'r1', label: 'Run 1', status: 'done', metrics: { pass: 0.9 } }],
    };
    const el = await fixture<LyraAgentEvalDashboard>(html`
      <lr-agent-eval-dashboard .metrics=${props.metrics} .runs=${props.runs}></lr-agent-eval-dashboard>
    `);
    expect(el.withoutChart).to.equal(false);
    expect(el.shadowRoot!.querySelector('lr-lite-chart')).to.exist;

    el.setAttribute('without-chart', '');
    await el.updateComplete;
    expect(el.withoutChart).to.equal(true);
    expect(el.shadowRoot!.querySelector('lr-lite-chart') === null).to.be.true;

    el.withoutChart = false;
    await el.updateComplete;
    expect(el.hasAttribute('without-chart')).to.equal(false);
    expect(el.shadowRoot!.querySelector('lr-lite-chart')).to.exist;
  });

  it('defaults a missing runtime run status to idle without losing the dashboard', async () => {
    const el = await fixture<LyraAgentEvalDashboard>(html`
      <lr-agent-eval-dashboard
        .metrics=${[{ id: 'pass', label: 'Pass', value: 0.9, format: 'percent' }]}
        .runs=${[{ id: 'r1', label: 'Run 1' }] as never}
      ></lr-agent-eval-dashboard>
    `);

    expect(el.shadowRoot!.querySelectorAll('lr-lite-chart')).to.have.length(1);
    expect(el.shadowRoot!.querySelectorAll('[part="run"]')).to.have.length(1);
    expect(el.shadowRoot!.querySelector('[part="run-status"]')!.textContent!.trim()).to.equal('Idle');
  });

  it('bounds both the chart and rendered history to max-rendered-runs', async () => {
    const runs = Array.from({ length: 140 }, (_, index) => ({
      id: `r-${index}`,
      label: `Run ${index}`,
      status: 'done' as const,
      metrics: { score: index },
    }));
    const el = await fixture<LyraAgentEvalDashboard>(html`
      <lr-agent-eval-dashboard
        max-rendered-runs="12"
        .metrics=${[{ id: 'score', label: 'Score', value: 139 }]}
        .runs=${runs}
      ></lr-agent-eval-dashboard>
    `);
    expect(el.shadowRoot!.querySelectorAll('[part="run"]')).to.have.length(12);
    const chart = el.shadowRoot!.querySelector<LyraLiteChart>('lr-lite-chart');
    if (!chart) throw new Error('Expected the evaluation history chart to render.');
    expect(chart.labels).to.have.length(12);
    expect(chart.labels[0]).to.equal('Run 0');
  });

  it('preserves caller status label, variant, and message for extensible kinds', async () => {
    const el = await fixture<LyraAgentEvalDashboard>(html`
      <lr-agent-eval-dashboard .runs=${[{
        id: 'r-custom',
        label: 'Provider run',
        status: { kind: 'rate-limited', label: 'Throttled', variant: 'warning', message: 'Retry in 30 seconds' },
      }]}></lr-agent-eval-dashboard>
    `);
    const badge = el.shadowRoot!.querySelector('lr-badge') as HTMLElement & { variant: string };
    expect(badge.textContent!.trim()).to.equal('Throttled');
    expect(badge.variant).to.equal('warning');
    expect(el.shadowRoot!.querySelector('[part="run-status-message"]')!.textContent).to.equal('Retry in 30 seconds');
  });

  it('emits the shared lr-run-activate detail with id and run context', async () => {
    const run = {
      id: 'r-1',
      label: 'Run one',
      status: 'done' as const,
      metrics: { accuracy: 0.9 },
    };
    const el = await fixture<LyraAgentEvalDashboard>(html`
      <lr-agent-eval-dashboard .runs=${[run]}></lr-agent-eval-dashboard>
    `);
    const pending = oneEvent(el, 'lr-run-activate');
    (el.shadowRoot!.querySelector('[part="run"]') as HTMLButtonElement).click();
    const detail = (await pending).detail;
    expect(detail).to.deep.equal({ runId: 'r-1', run });
    expect(Object.isFrozen(detail), 'detail root').to.equal(true);
    expect(Object.isFrozen(detail.run), 'nested run').to.equal(true);
    expect(Object.isFrozen(detail.run.metrics), 'nested metrics').to.equal(true);
    expect(detail.run, 'event run is detached from component state').to.not.equal(el.runs[0]);
    expect(detail.run.metrics, 'event metrics are detached from component state').to.not.equal(
      el.runs[0]!.metrics,
    );

    try {
      (detail as { runId: string }).runId = 'consumer-change';
      (detail.run.metrics as { accuracy: number }).accuracy = 0;
    } catch {
      // Strict-mode writes to frozen snapshots throw; non-strict runtimes silently ignore them.
    }
    expect(detail.runId).to.equal('r-1');
    expect(el.runs[0]!.metrics!['accuracy']).to.equal(0.9);
  });
  it('is accessible in empty and populated states', async () => { await expect((await fixture(html`<lr-agent-eval-dashboard></lr-agent-eval-dashboard>`)) as LyraAgentEvalDashboard).to.be.accessible(); await expect((await fixture(html`<lr-agent-eval-dashboard .runs=${[{ id: 'r', label: 'Run', status: 'done' }]}></lr-agent-eval-dashboard>`)) as LyraAgentEvalDashboard).to.be.accessible(); });

  it('keeps a non-empty host name on the host and preserves an explicit-empty inner region name', async () => {
    const el = (await fixture(html`
      <lr-agent-eval-dashboard aria-label="Author dashboard" label="Visible dashboard"></lr-agent-eval-dashboard>
    `)) as LyraAgentEvalDashboard;
    expect(el.getAttribute('aria-label')).to.equal('Author dashboard');
    expect(el.shadowRoot!.querySelector('section')!.hasAttribute('aria-label')).to.equal(false);

    const decorative = (await fixture(html`
      <lr-agent-eval-dashboard aria-label="" label="Visible dashboard"></lr-agent-eval-dashboard>
    `)) as LyraAgentEvalDashboard;
    expect(decorative.shadowRoot!.querySelector('section')!.getAttribute('aria-label')).to.equal('');
  });

  it('distinguishes an omitted label from an explicit empty override on the heading', async () => {
    const omitted = (await fixture(html`
      <lr-agent-eval-dashboard .strings=${{ evaluationDashboardLabel: 'Evaluation overview' }}></lr-agent-eval-dashboard>
    `)) as LyraAgentEvalDashboard;
    expect(omitted.shadowRoot!.querySelector('[part="heading"]')!.textContent).to.equal('Evaluation overview');

    const explicitEmpty = (await fixture(html`
      <lr-agent-eval-dashboard label=""></lr-agent-eval-dashboard>
    `)) as LyraAgentEvalDashboard;
    expect(explicitEmpty.shadowRoot!.querySelector('[part="heading"]') === null).to.equal(true);

    const explicitOverride = (await fixture(html`
      <lr-agent-eval-dashboard label="Custom heading"></lr-agent-eval-dashboard>
    `)) as LyraAgentEvalDashboard;
    expect(explicitOverride.shadowRoot!.querySelector('[part="heading"]')!.textContent).to.equal('Custom heading');
  });

  it('formats percent, duration, and currency metrics with the effective locale and currency', async () => {
    const el = (await fixture(html`
      <lr-agent-eval-dashboard
        lang="de-DE"
        currency="EUR"
        .metrics=${[
          { id: 'pass', label: 'Pass rate', value: 0.125, format: 'percent' },
          { id: 'latency', label: 'Latency', value: 1200, format: 'milliseconds' },
          { id: 'cost', label: 'Cost', value: 2.5, format: 'currency' },
        ]}
      ></lr-agent-eval-dashboard>
    `)) as LyraAgentEvalDashboard;
    const values = [...el.shadowRoot!.querySelectorAll('lr-stat')].map((stat) => (stat as HTMLElement & { value: string }).value);
    expect(values).to.deep.equal([
      new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 1 }).format(0.125),
      `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(1.2)}s`,
      new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(2.5),
    ]);
  });

  it('composes metric stats with the public plain-frame contract and no card chrome', async () => {
    const el = (await fixture(html`
      <lr-agent-eval-dashboard
        .metrics=${[{ id: 'accuracy', label: 'Accuracy', value: 0.95, format: 'percent' }]}
      ></lr-agent-eval-dashboard>
    `)) as LyraAgentEvalDashboard;
    const stat = el.shadowRoot!.querySelector('lr-stat') as LyraStat;
    await stat.updateComplete;
    const base = stat.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const chrome = getComputedStyle(base);

    expect(stat.frame).to.equal('plain');
    expect(chrome.borderTopWidth).to.equal('0px');
    expect(chrome.paddingTop).to.equal('0px');
    expect(chrome.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  });

  it('falls back to USD when the currency code is invalid', async () => {
    const el = (await fixture(html`
      <lr-agent-eval-dashboard
        lang="en"
        currency="not-a-code"
        .metrics=${[{ id: 'cost', label: 'Cost', value: 2.5, format: 'currency' }]}
      ></lr-agent-eval-dashboard>
    `)) as LyraAgentEvalDashboard;
    expect((el.shadowRoot!.querySelector('lr-stat') as HTMLElement & { value: string }).value).to.equal(
      new Intl.NumberFormat('en', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(2.5),
    );
  });

  it('emits lr-metric-change from an operable metric selector', async () => {
    const el = (await fixture(html`
      <lr-agent-eval-dashboard
        metric-id="first"
        .metrics=${[
          { id: 'first', label: 'First', value: 1 },
          { id: 'second', label: 'Second', value: 2 },
        ]}
      ></lr-agent-eval-dashboard>
    `)) as LyraAgentEvalDashboard;
    const event = oneEvent(el, 'lr-metric-change');
    (el.shadowRoot!.querySelector('[data-metric-id="second"]') as HTMLButtonElement).click();
    expect((await event).detail).to.deep.equal({ metricId: 'second' });
  });

  it('omits empty metric identities and falls back to the first valid metric', async () => {
    const el = await fixture<LyraAgentEvalDashboard>(html`
      <lr-agent-eval-dashboard
        metric-id=""
        .metrics=${[
          { id: 'first', label: 'First', value: 1 },
          { id: '', label: 'Root metric', value: 2 },
          { id: '   ', label: 'Blank metric', value: 3 },
        ]}
      ></lr-agent-eval-dashboard>
    `);
    const metrics = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="metric"]')];
    expect(el.metricId).to.equal('');
    expect(metrics).to.have.length(1);
    expect(metrics[0]!.getAttribute('aria-label')).to.contain('First');
    expect(metrics[0]!.getAttribute('aria-pressed')).to.equal('true');
  });

  it('localizes the metric accessible value label with placeholders', async () => {
    const el = (await fixture(html`
      <lr-agent-eval-dashboard
        .metrics=${[{ id: 'accuracy', label: 'Accuracy', value: 0.75 }]}
        .strings=${{ chartValueLabel: '{value} ← {label}' }}
      ></lr-agent-eval-dashboard>
    `)) as LyraAgentEvalDashboard;
    const metric = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="metric"]')!;
    expect(metric.getAttribute('aria-label')).to.equal('0.75 ← Accuracy');
  });

  it('renders a strings override in the DOM', async () => {
    const el = (await fixture(html`
      <lr-agent-eval-dashboard .strings=${{ evaluationDashboardNoRuns: 'No executions yet' }}></lr-agent-eval-dashboard>
    `)) as LyraAgentEvalDashboard;
    expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.equal('No executions yet');
  });

  it('allows the active metric state to be rethemed through component-scoped hooks', async () => {
    const el = (await fixture(html`
      <lr-agent-eval-dashboard
        metric-id="pass"
        style="--lr-agent-eval-dashboard-active-border: rgb(1, 2, 3)"
        .metrics=${[{ id: 'pass', label: 'Pass', value: 1 }]}
      ></lr-agent-eval-dashboard>
    `)) as LyraAgentEvalDashboard;
    const metric = el.shadowRoot!.querySelector('[part="metric"]') as HTMLElement;
    expect(getComputedStyle(metric).borderTopColor).to.equal('rgb(1, 2, 3)');
  });

  it('draws each run row with only a top separator on the decorative --lr-color-border-subtle tier', async () => {
    const el = (await fixture(html`
      <lr-agent-eval-dashboard
        style="--lr-theme-color-surface-border: rgb(10, 20, 30); --lr-theme-color-surface-border-subtle: rgb(7, 8, 9)"
        .runs=${[{ id: 'r1', label: 'Run 1', status: 'done' }]}
      ></lr-agent-eval-dashboard>
    `)) as LyraAgentEvalDashboard;
    const row = getComputedStyle(el.shadowRoot!.querySelector('[part="run"]') as HTMLElement);
    expect(row.borderTopStyle).to.equal('solid');
    expect(row.borderTopColor).to.equal('rgb(7, 8, 9)');
    // The row is a native <button>: without a reset, the UA's outset button border stays on the
    // three sides the separator does not set, boxing every row in a heavy frame.
    expect([row.borderRightWidth, row.borderBottomWidth, row.borderLeftWidth]).to.deep.equal(['0px', '0px', '0px']);
  });

  it('contains long public dashboard, metric, and run labels at 320px', async () => {
    const token = 'unbroken'.repeat(80);
    const wrapper = (await fixture(html`
      <div style="inline-size: 320px; max-inline-size: 320px;">
        <lr-agent-eval-dashboard
          label=${token}
          .metrics=${[{ id: 'metric', label: token, value: 1 }]}
          .runs=${[{ id: 'run', label: token, status: 'done', metrics: { metric: 1 } }]}
        ></lr-agent-eval-dashboard>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-agent-eval-dashboard') as LyraAgentEvalDashboard;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const heading = el.shadowRoot!.querySelector('[part="heading"]') as HTMLElement;
    const metric = el.shadowRoot!.querySelector('[part="metric"]') as HTMLElement;
    const run = el.shadowRoot!.querySelector('[part="run"]') as HTMLElement;
    const runLabel = el.shadowRoot!.querySelector('[part="run-label"]') as HTMLElement;
    expect(base.scrollWidth).to.be.at.most(Math.ceil(base.getBoundingClientRect().width) + 1);
    expect(heading.scrollWidth).to.be.at.most(Math.ceil(heading.getBoundingClientRect().width) + 1);
    expect(metric.scrollWidth).to.be.at.most(Math.ceil(metric.getBoundingClientRect().width) + 1);
    expect(run.scrollWidth).to.be.at.most(Math.ceil(run.getBoundingClientRect().width) + 1);
    expect(runLabel.scrollWidth).to.be.at.most(Math.ceil(runLabel.getBoundingClientRect().width) + 1);
  });
});

it('normalizes duplicate metric and run ids first-wins across cards, chart, and rows', async () => {
  const el = await fixture<LyraAgentEvalDashboard>(html`
    <lr-agent-eval-dashboard
      .metrics=${[
        { id: 'metric', label: 'First metric', value: 1 },
        { id: 'metric', label: 'Later metric', value: 2 },
      ]}
      .runs=${[
        { id: 'run', label: 'First run', status: 'done', metrics: { metric: 1 } },
        { id: 'run', label: 'Later run', status: 'error', metrics: { metric: 2 } },
      ]}
    ></lr-agent-eval-dashboard>
  `);
  expect(el.shadowRoot!.querySelectorAll('[part="metric"]')).to.have.length(1);
  const metric = el.shadowRoot!.querySelector('lr-stat') as LyraStat;
  expect(metric.label).to.equal('First metric');
  expect(el.shadowRoot!.querySelectorAll('[part="run"]')).to.have.length(1);
  expect(el.shadowRoot!.querySelector('[part="run"]')!.textContent).to.contain('First run');
});

it('uses break-word, not anywhere, on heading and run-label text', async () => {
  const el = (await fixture(html`
    <lr-agent-eval-dashboard .runs=${[{ id: 'r', label: 'Run one', status: 'done' }]}></lr-agent-eval-dashboard>
  `)) as LyraAgentEvalDashboard;
  await el.updateComplete;
  const heading = el.shadowRoot!.querySelector('[part="runs-heading"]') as HTMLElement;
  const runLabel = el.shadowRoot!.querySelector('[part="run-label"]') as HTMLElement;
  expect(getComputedStyle(heading).overflowWrap).to.equal('break-word');
  expect(getComputedStyle(runLabel).overflowWrap).to.equal('break-word');
});

it('keeps a hover tint on the selected metric, not only on the unselected ones', async () => {
  const el = (await fixture(html`
    <lr-agent-eval-dashboard
      metric-id="pass"
      .metrics=${[
        { id: 'pass', label: 'Pass rate', value: 0.9 },
        { id: 'cost', label: 'Cost', value: 12 },
      ]}
    ></lr-agent-eval-dashboard>
  `)) as LyraAgentEvalDashboard;
  await el.updateComplete;
  const selected = el.shadowRoot!.querySelector<HTMLElement>('[part="metric"][aria-pressed="true"]')!;
  const unselected = el.shadowRoot!.querySelector<HTMLElement>('[part="metric"][aria-pressed="false"]')!;
  const centre = (element: HTMLElement): [number, number] => {
    const rect = element.getBoundingClientRect();
    return [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)];
  };
  await resetMouse();
  const selectedRest = getComputedStyle(selected).backgroundColor;
  const unselectedRest = getComputedStyle(unselected).backgroundColor;
  try {
    await sendMouse({ type: 'move', position: centre(unselected) });
    await waitUntil(
      () => getComputedStyle(unselected).backgroundColor !== unselectedRest,
      'an unselected metric never picked up a hover tint',
    );
    await sendMouse({ type: 'move', position: centre(selected) });
    await waitUntil(
      () => getComputedStyle(selected).backgroundColor !== selectedRest,
      'the selected metric stayed on its pressed fill under the pointer, so it is the one chip in ' +
        'the row that goes dead on hover',
    );
  } finally {
    await resetMouse();
  }
});

it('paints the selected metric from active-bg and ignores the retired active-background token', async () => {
  const selectedFill = async (style = '') => {
    const el = await fixture<LyraAgentEvalDashboard>(html`
      <lr-agent-eval-dashboard
        metric-id="first"
        style=${style}
        .metrics=${[
          { id: 'first', label: 'First', value: 1 },
          { id: 'second', label: 'Second', value: 2 },
        ]}
      ></lr-agent-eval-dashboard>
    `);
    const metric = el.shadowRoot!.querySelector<HTMLElement>('[part="metric"][aria-pressed="true"]')!;
    return getComputedStyle(metric).backgroundColor;
  };
  const baseline = await selectedFill();
  const retired = await selectedFill('--lr-agent-eval-dashboard-active-background: rgb(1, 2, 3)');
  const canonical = await selectedFill('--lr-agent-eval-dashboard-active-bg: rgb(4, 5, 6)');
  const both = await selectedFill(
    '--lr-agent-eval-dashboard-active-background: rgb(1, 2, 3); --lr-agent-eval-dashboard-active-bg: rgb(4, 5, 6)',
  );

  expect(retired, 'the removed token cannot retint the resting selected metric').to.equal(baseline);
  expect(canonical).to.equal('rgb(4, 5, 6)');
  expect(both, 'the canonical token owns the selected fill').to.equal(canonical);
});

// Pressing the already-selected metric used to fall to the plain press rule mixed from the
// unselected surface, so the metric looked deselected mid-click. It now mixes from its own fill.
it('mixes the pressed selected metric from --lr-agent-eval-dashboard-active-bg', async () => {
  const el = (await fixture(html`
    <lr-agent-eval-dashboard
      metric-id="first"
      style="--lr-transition-fast: 0s; --lr-agent-eval-dashboard-active-bg: rgb(200, 0, 0)"
      .metrics=${[
        { id: 'first', label: 'First', value: 1 },
        { id: 'second', label: 'Second', value: 2 },
      ]}
    ></lr-agent-eval-dashboard>
  `)) as LyraAgentEvalDashboard;
  await el.updateComplete;
  const metric = el.shadowRoot!.querySelector<HTMLElement>('[part="metric"][data-metric-id="first"]')!;
  expect(metric.getAttribute('aria-pressed')).to.equal('true');
  const probe = document.createElement('span');
  probe.style.backgroundColor =
    'color-mix(in oklab, rgb(200, 0, 0), var(--lr-color-mix-partner) var(--lr-color-mix-active))';
  el.shadowRoot!.append(probe);
  const expected = getComputedStyle(probe).backgroundColor;
  probe.remove();
  try {
    await hoverUntilMatched(metric, 'the selected metric never reported :hover');
    await sendMouse({ type: 'down' });
    await waitUntil(
      () => metric.matches(':active') && getComputedStyle(metric).backgroundColor === expected,
      'pressing the selected metric did not mix from its active background',
    );
  } finally {
    await sendMouse({ type: 'up' });
    await resetMouse();
  }
});


it('paints the selected metric from active-bg and ignores the retired active-background token', async () => {
  const selectedFill = async (style = '') => {
    const el = await fixture<LyraAgentEvalDashboard>(html`
      <lr-agent-eval-dashboard metric-id="first" style=${style}
        .metrics=${[{ id: 'first', label: 'First', value: 1 }, { id: 'second', label: 'Second', value: 2 }]}
      ></lr-agent-eval-dashboard>
    `);
    const metric = el.shadowRoot!.querySelector<HTMLElement>('[part="metric"][aria-pressed="true"]')!;
    return getComputedStyle(metric).backgroundColor;
  };
  const baseline = await selectedFill();
  const retired = await selectedFill('--lr-agent-eval-dashboard-active-background: rgb(1, 2, 3)');
  const canonical = await selectedFill('--lr-agent-eval-dashboard-active-bg: rgb(4, 5, 6)');
  const both = await selectedFill('--lr-agent-eval-dashboard-active-background: rgb(1, 2, 3); --lr-agent-eval-dashboard-active-bg: rgb(4, 5, 6)');
  expect(retired, 'the retired token cannot retint the resting selected metric').to.equal(baseline);
  expect(canonical).to.equal('rgb(4, 5, 6)');
  expect(both, 'the canonical token owns the selected fill').to.equal(canonical);
});

describe('lr-agent-eval-dashboard heading', () => {
  it('follows heading-level with the run history one level below, and renders no title for an empty label', async () => {
    const el = await fixture<LyraAgentEvalDashboard>(html`
      <lr-agent-eval-dashboard heading-level="3" .runs=${[{ id: 'r', label: 'R', status: 'done' }]}></lr-agent-eval-dashboard>
    `);
    const level = (part: string): string | null => el.shadowRoot!.querySelector(`[part="${part}"]`)!.getAttribute('aria-level');
    expect([level('heading'), level('runs-heading')]).to.deep.equal(['3', '4']);
    el.label = '';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="heading"]') === null).to.equal(true);
  });
});

describe('lr-agent-eval-dashboard metric requests', () => {
  it('requests a metric change through lr-metric-change-request, then the deprecated lr-metric-change alias', async () => {
    const el = await fixture<LyraAgentEvalDashboard>(html`<lr-agent-eval-dashboard .metrics=${[{ id: 'a', label: 'A', value: 1 }]}></lr-agent-eval-dashboard>`);
    const seen: string[] = [];
    for (const name of ['lr-metric-change-request', 'lr-metric-change']) {
      el.addEventListener(name, (event) => seen.push(`${name}:${(event as CustomEvent<{ metricId: string }>).detail.metricId}`));
    }
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="metric"]')!.click();
    expect(seen).to.deep.equal(['lr-metric-change-request:a', 'lr-metric-change:a']);
  });
});

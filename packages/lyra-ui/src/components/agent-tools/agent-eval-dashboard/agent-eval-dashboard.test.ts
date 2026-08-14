import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './agent-eval-dashboard.js';
import type { LyraAgentEvalDashboard } from './agent-eval-dashboard.class.js';
import type { LyraStat } from '../../data/stat/stat.class.js';
describe('lr-agent-eval-dashboard', () => {
  it('renders metrics, trend, and runs', async () => { const el = (await fixture(html`<lr-agent-eval-dashboard .strings=${{ evaluationDashboardLabel: 'Evaluation overview' }} .metrics=${[{ id: 'pass', label: 'Pass rate', value: 0.9, format: 'percent' }]} .runs=${[{ id: 'r1', label: 'Run 1', status: 'done', metrics: { pass: 0.9 } }]}></lr-agent-eval-dashboard>`)) as LyraAgentEvalDashboard; await el.updateComplete; expect(el.shadowRoot!.querySelector('lr-lite-chart')).to.exist; expect(el.shadowRoot!.querySelectorAll('[part="run"]').length).to.equal(1); });

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
    const chart = el.shadowRoot!.querySelector('lr-lite-chart') as HTMLElement & { labels: string[] };
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
    const run = { id: 'r-1', label: 'Run one', status: 'done' as const };
    const el = await fixture<LyraAgentEvalDashboard>(html`
      <lr-agent-eval-dashboard .runs=${[run]}></lr-agent-eval-dashboard>
    `);
    const pending = oneEvent(el, 'lr-run-activate');
    (el.shadowRoot!.querySelector('[part="run"]') as HTMLButtonElement).click();
    expect((await pending).detail).to.deep.equal({ runId: 'r-1', run });
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

  it('formats percent, unit, and currency metrics with the effective locale and currency', async () => {
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
      new Intl.NumberFormat('de-DE', { style: 'unit', unit: 'millisecond', unitDisplay: 'short', maximumFractionDigits: 0 }).format(1200),
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
        currency="not-a-code"
        .metrics=${[{ id: 'cost', label: 'Cost', value: 2.5, format: 'currency' }]}
      ></lr-agent-eval-dashboard>
    `)) as LyraAgentEvalDashboard;
    expect((el.shadowRoot!.querySelector('lr-stat') as HTMLElement & { value: string }).value).to.equal(
      new Intl.NumberFormat(el.effectiveLocale, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(2.5),
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

  it('distinguishes null fallback selection from a valid empty-string metric id', async () => {
    const el = await fixture<LyraAgentEvalDashboard>(html`
      <lr-agent-eval-dashboard
        metric-id=""
        .metrics=${[
          { id: 'first', label: 'First', value: 1 },
          { id: '', label: 'Root metric', value: 2 },
        ]}
      ></lr-agent-eval-dashboard>
    `);
    const metrics = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="metric"]')];
    expect(el.metricId).to.equal('');
    expect(metrics.map((metric) => metric.getAttribute('aria-pressed'))).to.deep.equal(['false', 'true']);
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

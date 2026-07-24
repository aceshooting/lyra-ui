import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './agent-eval-dashboard.js';
import type { LyraAgentEvalDashboard } from './agent-eval-dashboard.class.js';
describe('lr-agent-eval-dashboard', () => {
  it('renders metrics, trend, and runs', async () => { const el = (await fixture(html`<lr-agent-eval-dashboard .strings=${{ evaluationDashboardLabel: 'Evaluation overview' }} .metrics=${[{ id: 'pass', label: 'Pass rate', value: 0.9, format: 'percent' }]} .runs=${[{ id: 'r1', label: 'Run 1', status: 'done', metrics: { pass: 0.9 } }]}></lr-agent-eval-dashboard>`)) as LyraAgentEvalDashboard; await el.updateComplete; expect(el.shadowRoot!.querySelector('lr-lite-chart')).to.exist; expect(el.shadowRoot!.querySelectorAll('[part="run"]').length).to.equal(1); });
  it('is accessible in empty and populated states', async () => { await expect((await fixture(html`<lr-agent-eval-dashboard></lr-agent-eval-dashboard>`)) as LyraAgentEvalDashboard).to.be.accessible(); await expect((await fixture(html`<lr-agent-eval-dashboard .runs=${[{ id: 'r', label: 'Run', status: 'done' }]}></lr-agent-eval-dashboard>`)) as LyraAgentEvalDashboard).to.be.accessible(); });

  it('forwards the host aria-label to the section that owns the region name', async () => {
    const el = (await fixture(html`
      <lr-agent-eval-dashboard aria-label="Author dashboard" label="Visible dashboard"></lr-agent-eval-dashboard>
    `)) as LyraAgentEvalDashboard;
    expect(el.shadowRoot!.querySelector('section')!.getAttribute('aria-label')).to.equal('Author dashboard');
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
});

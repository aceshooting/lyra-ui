import { fixture, expect, html } from '@open-wc/testing';
import './agent-eval-dashboard.js';
import type { LyraAgentEvalDashboard } from './agent-eval-dashboard.class.js';
describe('lr-agent-eval-dashboard', () => {
  it('renders metrics, trend, and runs', async () => { const el = (await fixture(html`<lr-agent-eval-dashboard .strings=${{ evaluationDashboardLabel: 'Evaluation overview' }} .metrics=${[{ id: 'pass', label: 'Pass rate', value: 0.9, format: 'percent' }]} .runs=${[{ id: 'r1', label: 'Run 1', status: 'done', metrics: { pass: 0.9 } }]}></lr-agent-eval-dashboard>`)) as LyraAgentEvalDashboard; await el.updateComplete; expect(el.shadowRoot!.querySelector('lr-lite-chart')).to.exist; expect(el.shadowRoot!.querySelectorAll('[part="run"]').length).to.equal(1); });
  it('is accessible in empty and populated states', async () => { await expect((await fixture(html`<lr-agent-eval-dashboard></lr-agent-eval-dashboard>`)) as LyraAgentEvalDashboard).to.be.accessible(); await expect((await fixture(html`<lr-agent-eval-dashboard .runs=${[{ id: 'r', label: 'Run', status: 'done' }]}></lr-agent-eval-dashboard>`)) as LyraAgentEvalDashboard).to.be.accessible(); });
});

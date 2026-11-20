import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import '../../lr-agent-eval-dashboard.js';
import type { LyraAgentEvalDashboard } from './agent-eval-dashboard.class.js';

const stat = (el: LyraAgentEvalDashboard, id: string) =>
  el.shadowRoot!.querySelector(`[part="metric"][data-metric-id="${id}"]`)!.getAttribute('aria-label') ?? '';

describe('lr-agent-eval-dashboard remediation', () => {
  it('moves the run history tab stop with the keyboard and rehomes it when runs are removed', async () => {
    const runs = ['a', 'b', 'c'].map(id => ({ id, label: id, status: 'done' as const }));
    const el = await fixture<LyraAgentEvalDashboard>(html`<lr-agent-eval-dashboard without-chart
      .runs=${runs}></lr-agent-eval-dashboard>`);
    const root = el.shadowRoot!;
    const buttons = () => [...root.querySelectorAll<HTMLButtonElement>('[part="run"]')];
    const tabOrder = () => buttons().map(button => button.tabIndex);
    expect(tabOrder()).to.deep.equal([0, -1, -1]);

    await focusByKeyboard(buttons()[0]!);
    await sendKeys({ press: 'End' });
    expect(root.activeElement === buttons()[2]).to.equal(true);
    expect(tabOrder()).to.deep.equal([-1, -1, 0]);

    el.runs = runs.slice(0, 2);
    await el.updateComplete;
    expect(tabOrder()).to.deep.equal([-1, 0]);
  });

  it('paints a distinct press step on an unselected metric', async () => {
    const el = await fixture<LyraAgentEvalDashboard>(html`<lr-agent-eval-dashboard data-lr-theme-scope
      style="--lr-transition-fast: 0s"
      .metrics=${[{ id: 'first', label: 'First', value: 1 }, { id: 'second', label: 'Second', value: 2 }]}
      ></lr-agent-eval-dashboard>`);
    const metric = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-metric-id="second"]')!;
    expect(metric.getAttribute('aria-pressed')).to.equal('false');
    const background = () => getComputedStyle(metric).backgroundColor;
    const resting = background();
    try {
      await hoverUntilMatched(metric, 'unselected metric did not receive hover');
      await waitUntil(() => background() !== resting, 'unselected metric hover did not paint');
      const hovered = background();
      await sendMouse({ type: 'down' });
      await waitUntil(() => background() !== hovered, 'unselected metric press did not paint');
      expect(background()).not.to.equal(resting);
    } finally {
      await resetMouse();
    }
  });

  it('falls back to the first metric and notes a stale controlled id until it is cleared or matched', async () => {
    const metrics = [{ id: 'score', label: 'Score', value: 1 }];
    const runs = [{ id: 'run', label: 'Run', status: 'done', metrics: { score: 2 } }];
    const el = await fixture<LyraAgentEvalDashboard>(html`<lr-agent-eval-dashboard metric-id="deleted"
      .metrics=${metrics} .runs=${runs}></lr-agent-eval-dashboard>`);
    const selected = () => el.shadowRoot!.querySelectorAll('[part="metric"][aria-pressed="true"]').length;
    const chart = () => el.shadowRoot!.querySelectorAll('[part="chart"]').length;
    const notice = () => el.shadowRoot!.querySelector('[part="metric-unavailable"]')?.textContent;

    expect(el.metricId).to.equal('deleted');
    expect(selected()).to.equal(1);
    expect(chart()).to.equal(1);
    expect(notice()).to.equal('No evaluation metric is available for deleted.');
    el.strings = { evaluationDashboardMetricUnavailable: 'Missing metric {metric}.' };
    await el.updateComplete;
    expect(notice()).to.equal('Missing metric deleted.');

    el.metricId = 'score';
    await el.updateComplete;
    expect(selected()).to.equal(1);
    expect(chart()).to.equal(1);
    expect(notice()).to.equal(undefined);

    el.removeAttribute('metric-id');
    await el.updateComplete;
    expect(selected()).to.equal(1);
    expect(chart()).to.equal(1);
  });

  it('never rounds a small nonzero metric to zero', async () => {
    const el = await fixture<LyraAgentEvalDashboard>(html`<lr-agent-eval-dashboard .metrics=${[
      { id: 'share', label: 'Share', value: 0.0004, format: 'percent' },
      { id: 'pct', label: 'Pct', value: 0.875, format: 'percent' },
      { id: 'cost', label: 'Cost', value: 0.0012, format: 'currency' },
      { id: 'bad-cost', label: 'Bad', value: 0.0012, format: 'currency' },
      { id: 'plain', label: 'Plain', value: 0.00042 },
      { id: 'zero', label: 'Zero', value: 0 },
    ]}></lr-agent-eval-dashboard>`);
    expect(stat(el, 'share')).to.include('<0.1%');
    expect(stat(el, 'pct')).to.include('87.5%');
    expect(stat(el, 'cost')).to.include('$0.0012');
    expect(stat(el, 'plain')).to.include('0.00042');
    expect(stat(el, 'zero')).to.include('0');
    el.currency = 'not-a-code';
    await el.updateComplete;
    expect(stat(el, 'bad-cost')).to.include('$0.0012');
  });

  it("reads only a run's own finite metric values", async () => {
    const metrics = [{ id: 'constructor', label: 'Constructor', value: 1 }, { id: 'score', label: 'Score', value: 1 }];
    const runs = [
      { id: 'a', label: 'Run A', status: 'done', metrics: { score: 2 } },
      { id: 'b', label: 'Run B', status: 'done', metrics: { score: Number.NaN } },
    ];
    const el = await fixture<LyraAgentEvalDashboard>(html`<lr-agent-eval-dashboard without-chart metric-id="constructor" .metrics=${metrics} .runs=${runs}></lr-agent-eval-dashboard>`);
    const meta = () => [...el.shadowRoot!.querySelectorAll('[part="run-meta"]')].map((node) => node.querySelectorAll(':scope > span:not([part])').length);
    expect(meta()).to.deep.equal([0, 0]);
    el.metricId = 'score';
    await el.updateComplete;
    expect(meta()).to.deep.equal([1, 0]);
  });

  it('uses a neutral badge for a status kind matching an inherited name', async () => {
    const runs = [{ id: 'run', label: 'Run', status: { kind: 'constructor' } }];
    const el = await fixture<LyraAgentEvalDashboard>(html`<lr-agent-eval-dashboard
      .runs=${runs}></lr-agent-eval-dashboard>`);
    expect(el.shadowRoot!.querySelector('lr-badge')?.variant).to.equal('neutral');
  });
});

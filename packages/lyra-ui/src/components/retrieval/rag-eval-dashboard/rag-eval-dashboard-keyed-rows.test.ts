import { expect, fixture, html } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../../lr-rag-eval-dashboard.js';
import type { LyraRagEvalDashboard, LyraRagEvaluationMetric, LyraRagEvaluationRun } from '../../lr-rag-eval-dashboard.js';

const metrics: LyraRagEvaluationMetric[] = [{ id: 'mrr', label: 'MRR', category: 'retrieval', format: 'number' }];
const run = (id: string): LyraRagEvaluationRun => ({ id, label: `${id} run`, slice: 'all', metrics: { mrr: 0.5 } });

it('keeps keyboard focus on the same run when an earlier run is removed', async () => {
  const el = await fixture<LyraRagEvalDashboard>(html`<lr-rag-eval-dashboard .metrics=${metrics}
    .runs=${[run('a'), run('b'), run('c')]}></lr-rag-eval-dashboard>`);
  const buttons = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="run"]')];
  await focusByKeyboard(buttons[1]!);
  el.runs = [run('b'), run('c')];
  await el.updateComplete;
  const focused = el.shadowRoot!.activeElement as HTMLElement | null;
  expect(focused?.querySelector('span')?.textContent).to.equal('b run');
});

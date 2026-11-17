import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraTable } from '../../data/table/table.class.js';
import type { EvalResultSource, EvalRunResult, LyraEvalResult } from './eval-result.class.js';
import './eval-result.js';

const validRun = (): EvalRunResult => ({ id: 'current', label: 'Current run', model: 'Model A', promptVersion: 'v1', output: 'Accepted output', scores: {}, review: {} });
const provider = (value: unknown, revision: number): EvalResultSource => ({
  revision,
  query: async () => ({ total: 1, rows: [{ key: 'current', order: 0, value: value as EvalRunResult }] }),
  lookup: async () => [],
  locate: async () => null,
});

for (const [field, invalid] of [
  ['id', 7], ['label', false], ['model', 7], ['promptVersion', null], ['output', {}],
  ['scores', null], ['scores', false], ['scores', []],
  ['review', null], ['review', false], ['review', []],
] as const) {
  it(`rejects invalid source ${field}=${JSON.stringify(invalid)} without legacy fallback and accepts a corrected provider`, async () => {
    const element = await fixture<LyraEvalResult>(html`<lr-eval-result
      selected-run-id="not-selected" baseline-run-id="not-selected"
      .runs=${[{ id: 'legacy', label: 'Legacy must remain hidden', output: '' }]}
      .dataSource=${provider({ ...validRun(), [field]: invalid }, 1)}></lr-eval-result>`);
    await waitUntil(() => element.shadowRoot!.querySelector<LyraTable>('lr-table')?.error === true,
      'invalid fixed source fields fail visibly');
    const failedTable = element.shadowRoot!.querySelector<LyraTable>('lr-table')!;
    expect(failedTable.rows.length).to.equal(0);
    expect(element.sourceTotal).to.equal(null);
    expect(element.shadowRoot!.textContent).not.to.include('Legacy must remain hidden');
    expect(element.shadowRoot!.querySelectorAll('lr-rubric-form').length).to.equal(0);
    element.dataSource = provider(validRun(), 2);
    await waitUntil(() => element.shadowRoot!.querySelector<LyraTable<EvalRunResult>>('lr-table')?.rows[0]?.id === 'current',
      'a corrected source recovers the same mounted component');
    const recoveredTable = element.shadowRoot!.querySelector<LyraTable<EvalRunResult>>('lr-table')!;
    expect(recoveredTable.error).to.equal(false);
    expect(element.sourceTotal).to.equal(1);
    expect(recoveredTable.rows[0]!.label).to.equal('Current run');
    expect(recoveredTable.rows[0]!.model).to.equal('Model A');
    expect(recoveredTable.rows[0]!.promptVersion).to.equal('v1');
    expect(element.runs[0]!.id).to.equal('legacy');
  });
}

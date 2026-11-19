import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './eval-result.js';
import type { EvalResultSource, EvalRunResult, LyraEvalResult } from './eval-result.class.js';
import type { LyraSourceRecord } from '../../../data-sources.js';
import { captureReentrantUpdateWarning } from '../../../../test/expected-lit-update.js';

const oversized = (): LyraSourceRecord<EvalRunResult> => ({ key: 'r0', order: 0,
  value: { id: 'r0', label: 'Run 0', output: 'Output 0', review: { note: 'x'.repeat(70_000) } } });

describe('lr-eval-result review projection', () => {
  it('shows a failed review projection in the same update without a reentrant render', async () => {
    const source: EvalResultSource = { revision: 1,
      query: async () => ({ total: 1, rows: [oversized()] }),
      lookup: async (keys) => keys.filter((key) => key === 'r0').map(() => oversized()),
      locate: async () => null,
    };
    let el!: LyraEvalResult;
    const warnings = await captureReentrantUpdateWarning('lr-eval-result', async () => {
      el = await fixture<LyraEvalResult>(html`<lr-eval-result .rubricKeys=${[{ key: 'note', type: 'comment' }]} .dataSource=${source}></lr-eval-result>`);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="selection-status"]')?.textContent?.includes('Retry') === true, 'projection failure never shown');
    });
    expect(warnings).to.equal(0);
    expect(el.shadowRoot!.querySelector('lr-rubric-form') === null).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="selection-retry"]') !== null).to.equal(true);
  });
});

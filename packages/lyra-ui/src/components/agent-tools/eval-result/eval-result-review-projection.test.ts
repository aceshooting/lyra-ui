import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './eval-result.js';
import type { EvalResultSource, EvalRunResult, LyraEvalResult } from './eval-result.class.js';
import type { LyraSourceRecord } from '../../../data-sources.js';
import { captureReentrantUpdateWarning } from '../../../../test/expected-lit-update.js';

const oversized = (): LyraSourceRecord<EvalRunResult> => ({ key: 'r0', order: 0,
  value: { id: 'r0', label: 'Run 0', output: 'Output 0', review: { note: 'x'.repeat(70_000) } } });

describe('lr-eval-result review projection', () => {
  it('keeps a projection for replaced rubric keys out of the rendered form', async () => {
    const el = await fixture<LyraEvalResult>(html`<lr-eval-result .rubricKeys=${[{ key: 'note', type: 'comment' }]}></lr-eval-result>`);
    let switched = false;
    const review = new Proxy({ note: 'old', explanation: 'current' }, {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'note') {
          switched = true;
          el.rubricKeys = [{ key: 'explanation', type: 'comment' }];
        }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    const row: LyraSourceRecord<EvalRunResult> = { key: 'r0', order: 0, value: { id: 'r0', label: 'Run 0', output: '', review } };
    el.dataSource = { revision: 1,
      query: async () => ({ total: 1, rows: [row] }),
      lookup: async () => [row],
      locate: async () => null,
    };
    await waitUntil(() => switched, 'source review was not projected');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="review"]').length).to.equal(0);
    el.disabled = true;
    await el.updateComplete;
    const form = el.shadowRoot!.querySelector('lr-rubric-form')!;
    expect(form.value).to.deep.equal({ explanation: 'current' });
  });

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

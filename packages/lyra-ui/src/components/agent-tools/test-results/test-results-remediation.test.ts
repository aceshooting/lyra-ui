import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './test-results.js';
import type { LyraTestResults, TestResultsSource } from './test-results.class.js';

describe('lr-test-results remediation', () => {
  it('groups consecutive provider rows of one suite into a single named list', async () => {
    const rows = ['a', 'a', 'b', 'unnamed'].map((suiteId, index) => ({ key: JSON.stringify([suiteId, String(index)]), order: index,
      value: { suiteId, suiteName: suiteId === 'unnamed' ? '' : `Suite ${suiteId}`, test: { id: String(index), name: `test ${index}`, status: 'passed' as const } } }));
    const source: TestResultsSource = { revision: 1, lookup: async () => [], locate: async () => null,
      query: async () => ({ total: 4, rows, summary: { total: 4, passed: 4, failed: 0, skipped: 0, running: 0 } }) };
    const el = await fixture<LyraTestResults>(html`<lr-test-results .dataSource=${source}></lr-test-results>`);
    await waitUntil(() => el.sourceTotal === 4, 'provider total must settle');
    await el.updateComplete;
    const lists = [...el.shadowRoot!.querySelectorAll('[role="list"]')];
    expect(lists.map((list) => [list.getAttribute('aria-label'), list.querySelectorAll('[role="listitem"]').length]))
      .to.deep.equal([['Suite a', 2], ['Suite b', 1], [null, 1]]);
    expect(el.shadowRoot!.querySelectorAll('[part="suite-header"]').length).to.equal(3);
  });
});

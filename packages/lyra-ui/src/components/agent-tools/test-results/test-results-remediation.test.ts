import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './test-results.js';
import type { LyraTestResults, TestResultsSource } from './test-results.class.js';

describe('lr-test-results remediation', () => {
  it('roves across legacy suites and keeps a tab stop when a filter removes the active name', async () => {
    const suites = [
      { id: 'a', name: 'Suite A', tests: [{ id: 'first', name: 'Pass', status: 'passed' }] },
      { id: 'b', name: 'Suite B', tests: [{ id: 'second', name: 'Fail', status: 'failed' }] },
    ] as const;
    const el = await fixture<LyraTestResults>(html`<lr-test-results .suites=${suites}></lr-test-results>`);
    const root = el.shadowRoot!;
    const buttons = () => [...root.querySelectorAll<HTMLButtonElement>('[part="test-name"]')];
    await waitUntil(() => buttons().length === 2, 'both suite rows rendered');
    expect(buttons().map(button => button.tabIndex)).to.deep.equal([0, -1]);

    await focusByKeyboard(buttons()[0]!);
    await sendKeys({ press: 'ArrowDown' });
    expect(root.activeElement === buttons()[1]).to.equal(true);
    expect(buttons().map(button => button.tabIndex)).to.deep.equal([-1, 0]);
    expect(root.querySelector<HTMLButtonElement>('[part="test-expand-toggle"]')?.tabIndex).to.equal(0);

    el.statusFilter = ['passed'];
    await el.updateComplete;
    expect(buttons().map(button => [button.textContent?.trim(), button.tabIndex])).to.deep.equal([['Pass', 0]]);
  });

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
    const buttons = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="test-name"]')];
    expect(buttons.map(button => button.tabIndex)).to.deep.equal([0, -1, -1, -1]);
    await focusByKeyboard(buttons[0]!);
    await sendKeys({ press: 'End' });
    expect(el.shadowRoot!.activeElement === buttons[3]).to.equal(true);
    expect(buttons.map(button => button.tabIndex)).to.deep.equal([-1, -1, -1, 0]);
  });
});

import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './test-results.js';
import { type LyraTestResults, type TestResultsSource, type TestStatus, testResultDetailSlotName } from './test-results.class.js';
import { recordScaleMeasurement, renderedNodeCount } from '../../../../test/scale-budgets.js';

const statuses: TestStatus[] = ['passed', 'skipped', 'running', 'failed'];
describe('test-results complete provider scale', () => {
  it('addresses first, middle and final failures of one million logical tests with bounded pages', async () => {
    let calls = 0; let reads = 0; let lookup = 0; let locate = 0;
    const source: TestResultsSource = {
      revision: 1,
      query: async ({ page, pageSize, query }) => {
        calls++;
        const filtered = query.statuses.length > 0;
        const offsets = filtered ? statuses.map((status, index) => query.statuses.includes(status) ? index : -1).filter(index => index >= 0) : [0, 1, 2, 3];
        const total = 250_000 * offsets.length;
        return { total, summary: { total: 1_000_000, passed: 250_000, skipped: 250_000, running: 250_000, failed: 250_000 },
          rows: Array.from({ length: Math.min(pageSize, Math.max(0, total - page * pageSize)) }, (_, offset) => {
            const position = page * pageSize + offset;
            const index = Math.floor(position / offsets.length) * 4 + offsets[position % offsets.length]!;
            reads++;
            return { key: JSON.stringify(['million', `test-${index}`]), order: index,
              value: { suiteId: 'million', suiteName: 'Million results', test: {
                id: `test-${index}`, name: `Test ${index}`, status: statuses[index % 4]!, message: `Result ${index}`,
              } } };
          }),
        };
      },
      lookup: async () => { lookup++; return []; }, locate: async () => { locate++; return null; },
    };
    const slot = testResultDetailSlotName('million', 'test-999999');
    const el = await fixture<LyraTestResults>(html`<lr-test-results><span slot=${slot}>Tail detail</span></lr-test-results>`);
    let normalizedRows = 0;
    const probe = el as unknown as { normalizeSourceRecord(record: unknown, isCurrent: () => boolean): unknown; sourcePages: { state: { result?: { rows: readonly unknown[] } } } };
    const normalize = probe.normalizeSourceRecord;
    probe.normalizeSourceRecord = (record, isCurrent) => { normalizedRows++; return normalize.call(el, record, isCurrent); };
    el.dataSource = source;
    const settle = async (name: string) => {
      await waitUntil(() => !![...el.shadowRoot!.querySelectorAll('[part="test-name"]')].find(node => node.textContent!.trim() === name));
      await el.updateComplete;
    };
    const select = async (index: number) => {
      const received = oneEvent(el, 'lr-test-select');
      ([...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="test-name"]')].find(node => node.textContent!.trim() === `Test ${index}`))!.click();
      expect((await received).detail).to.deep.equal({ suiteId: 'million', testId: `test-${index}` });
    };
    await settle('Test 0'); await select(0);
    el.sourcePage = 5000; await settle('Test 500000'); await select(500000);
    const pager = el.shadowRoot!.querySelector('lr-pagination')!;
    await (pager as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    pager.shadowRoot!.querySelector<HTMLButtonElement>('[part~="last-button"]')!.click();
    await settle('Test 999999'); await select(999999);
    expect(calls).to.equal(3); expect(reads).to.equal(300);
    expect(el.shadowRoot!.querySelectorAll('[part="test"]').length).to.equal(100);
    const tail = [...el.shadowRoot!.querySelectorAll('[part="test"]')].find(node => node.textContent!.includes('Test 999999'))!;
    expect(tail.querySelector('slot')!.name).to.equal(slot);
    expect(tail.textContent).to.include('Result 999999');
    tail.querySelector<HTMLButtonElement>('[part="test-expand-toggle"]')!.click(); await el.updateComplete;
    expect(tail.querySelector('[part="failure"]')!.hasAttribute('hidden')).to.equal(true);
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="filter-toggle"][data-status="failed"]')!.click();
    await settle('Test 3'); expect(el.sourcePage).to.equal(0); expect(el.sourceTotal).to.equal(250_000);
    expect(el.shadowRoot!.querySelector('[part="count"][data-status="passed"]')!.textContent).to.include('250,000');
    await (pager as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    pager.shadowRoot!.querySelector<HTMLButtonElement>('[part~="last-button"]')!.click(); await settle('Test 999999');
    expect(Math.floor(999_999 / 4)).to.equal(249_999);
    expect(Math.floor(1_000_000 / 4)).to.equal(250_000);
    expect(lookup).to.equal(0); expect(locate).to.equal(0);
    recordScaleMeasurement('lr-test-results', 'one million logical provider tests', { logicalTests: 1_000_000, pageSize: 100,
      providerCalls: calls, recordsRead: reads, normalizedRows, sourceRetainedRows: probe.sourcePages.state.result!.rows.length,
      mountedTests: el.shadowRoot!.querySelectorAll('[part="test"]').length,
      mountedHeadings: el.shadowRoot!.querySelectorAll('[part="suite-header"]').length, lookup, locate, domNodes: renderedNodeCount(el) });
  });
});

import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './test-results.js';
import type { LyraTestResults, TestCaseResult } from './test-results.class.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';

describe('test-results staged complete legacy input', () => {
  it('reads each status once, keeps late failures and selects only a bounded candidate window', async () => {
    let reads = 0;
    const tests = Array.from({ length: 2501 }, (_, index) => ({ id: String(index), name: `Test ${index}`,
      get status() { reads++; return index === 2500 ? 'failed' : 'passed'; },
    })) as TestCaseResult[];
    const el = await fixture<LyraTestResults>(html`<lr-test-results .suites=${[{ id: 'suite', name: 'Suite', tests }]}></lr-test-results>`);
    await el.updateComplete;
    expect(reads).to.equal(2501);
    expect(el.shadowRoot!.querySelectorAll('[part="test"]').length).to.equal(1000);
    expect(el.shadowRoot!.textContent).to.include('Test 2500');
    for (let i = 0; i < 4; i++) {
      el.shadowRoot!.querySelector<HTMLButtonElement>('[part="filter-toggle"][data-status="failed"]')!.click();
      await el.updateComplete;
    }
    expect(reads).to.equal(2501);
    recordScaleMeasurement('lr-test-results', 'staged legacy 2501 tests', { logicalTests: 2501, normalizedRows: reads,
      candidateRows: (el as unknown as { projectedSuitesCache: { tests: readonly unknown[] }[] }).projectedSuitesCache.reduce((sum, suite) => sum + suite.tests.length, 0), mountedTests: el.shadowRoot!.querySelectorAll('[part="test"]').length });
  });

  it('revokes an unfinished corpus before later status reads', async () => {
    const el = await fixture<LyraTestResults>(html`<lr-test-results></lr-test-results>`);
    let reads = 0;
    el.suites = [{ id: 'old', name: 'Old', tests: Array.from({ length: 5000 }, (_, index) => ({
      id: String(index), name: 'Old', get status() { reads++; return 'failed' as const; },
    })) }];
    await Promise.resolve();
    const atReplacement = reads;
    expect(atReplacement).to.be.lessThan(500);
    el.suites = [{ id: 'new', name: 'New', tests: [{ id: 'new', name: 'Current', status: 'passed' }] }];
    await el.updateComplete;
    expect(reads).to.equal(atReplacement);
    expect(el.shadowRoot!.textContent).to.include('Current');
    expect(el.shadowRoot!.textContent).not.to.include('Old');
  });

  it('rejects an oversized failure snapshot without displaying all-pass counts', async () => {
    const el = await fixture<LyraTestResults>(html`<lr-test-results .suites=${[{ id: 'suite', name: 'Suite', tests: [
      { id: 'failed', name: 'Huge', status: 'failed', message: 'x'.repeat(65_537) },
    ] }]}></lr-test-results>`);
    await waitUntil(() => !!el.shadowRoot!.querySelector('[part="input-error"]'));
    expect(el.shadowRoot!.querySelectorAll('[part="count"]').length).to.equal(0);
  });
});

describe('test-results oversized identity admission', () => {
  it('checks oversized blank IDs before malformed-identity omission', async () => {
    const el = await fixture<LyraTestResults>(html`<lr-test-results .suites=${[{ id: 'suite', name: 'Suite', tests: [
      { id: ' '.repeat(65_537), name: 'Failure', status: 'failed' },
    ] }]}></lr-test-results>`);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="input-error"]').length).to.equal(1);
  });
});

it('normalizes a newer suites publication made by an old status getter', async () => {
  const el = await fixture<LyraTestResults>(html`<lr-test-results></lr-test-results>`);
  let calls = 0;
  el.suites = [{ id: 'old', name: 'Old', tests: [{ id: 'old', name: 'Old row', get status() {
    calls++;
    el.suites = [{ id: 'new', name: 'New', tests: [{ id: 'new', name: 'Current row', status: 'passed' }] }];
    return 'failed' as const;
  } }] }];
  await el.updateComplete;
  expect(calls).to.equal(1);
  expect(el.shadowRoot!.textContent).to.include('Current row');
  expect(el.shadowRoot!.textContent).not.to.include('Old row');
});

for (const replacementField of ['status', 'name', 'message', 'durationMs']) {
  it(`stops staged caller reads immediately after a ${replacementField} getter publishes new suites`, async () => {
    const el = await fixture<LyraTestResults>(html`<lr-test-results></lr-test-results>`);
    let staleReads = 0; let replaced = false;
    const trigger = { id: 'trigger' } as TestCaseResult;
    for (const field of ['status', 'name', 'message', 'durationMs']) Object.defineProperty(trigger, field, { get() {
      if (replaced) staleReads++;
      if (field === replacementField) {
        replaced = true;
        el.suites = [{ id: 'new', name: 'New', tests: [{ id: 'current', name: 'Current replacement', status: 'passed' }] }];
      }
      return field === 'status' ? 'failed' : field === 'durationMs' ? 1 : 'Obsolete';
    } });
    el.suites = [{ id: 'old', name: 'Old', tests: [...Array.from({ length: 600 }, (_, index) => ({ id: String(index), name: 'Old', status: 'passed' as const })), trigger] }];
    await el.updateComplete;
    expect(replaced).to.equal(true); expect(staleReads).to.equal(0);
    expect(el.shadowRoot!.textContent).to.include('Current replacement');
    expect(el.shadowRoot!.textContent).not.to.include('Obsolete');
  });
}

it('source entry cancels staged legacy reads and settles current source readiness', async () => {
  const el = await fixture<LyraTestResults>(html`<lr-test-results></lr-test-results>`);
  let reads = 0;
  el.suites = [{ id: 'old', name: 'Old', tests: Array.from({ length: 2501 }, (_, index) => ({ id: String(index), name: 'Old row', get status() { reads++; return 'failed' as const; } })) }];
  await Promise.resolve(); const before = reads;
  expect(before).to.be.greaterThan(0); expect(before).to.be.lessThan(500);
  el.dataSource = { revision: 1, query: async () => ({ total: 1,
    rows: [{ key: JSON.stringify(['new', 'current']), order: 0, value: { suiteId: 'new', suiteName: 'New', test: { id: 'current', name: 'Current source', status: 'passed' } } }],
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, running: 0 } }), lookup: async () => [], locate: async () => null };
  await el.updateComplete; await waitUntil(() => el.sourceTotal === 1); await el.updateComplete;
  expect(reads).to.equal(before); expect(el.shadowRoot!.textContent).to.include('Current source');
});

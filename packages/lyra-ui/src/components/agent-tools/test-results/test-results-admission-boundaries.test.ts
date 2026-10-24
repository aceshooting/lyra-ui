import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './test-results.js';
import type { LyraTestResults, TestResultsSource } from './test-results.class.js';

const currentSuites = () => [{ id: 'current-suite', name: 'Current suite', tests: [
  { id: 'current-test', name: 'Current result', status: 'passed' as const },
] }];

const names = (el: LyraTestResults) => [...el.shadowRoot!.querySelectorAll('[part="test-name"]')]
  .map(node => node.textContent!.trim());

describe('test-results legacy admission boundaries', () => {
  it('omits malformed identities while preserving valid rows and normalizing optional text', async () => {
    const el = await fixture<LyraTestResults>(html`<lr-test-results></lr-test-results>`);
    Reflect.set(el, 'suites', [null, { id: 7 }, { id: 'no-tests', name: 'Empty', tests: null }, {
      id: 'suite', name: 7, tests: [null, { id: 3 }, { id: ' ', name: 'Blank identity' },
        { id: 'unnamed', name: null, status: 'passed', message: false, durationMs: '4' },
        { id: 'named', name: 'Valid failure', status: 'failed', message: 'Expected failure', durationMs: 4 },
        { id: 'named', name: 'Duplicate', status: 'passed' }],
    }]);
    await el.updateComplete;
    expect(names(el)).to.deep.equal(['', 'Valid failure']);
    expect(el.shadowRoot!.querySelector('[part="suite-header"]')!.textContent).to.equal('');
    expect(el.shadowRoot!.querySelectorAll('[part="test-duration"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part="failure-message"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelector('[part="failure-message"]')!.textContent).to.equal('Expected failure');
    let selected: unknown;
    el.addEventListener('lr-test-select', event => { selected = (event as CustomEvent).detail; });
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="test-name"]')!.click();
    expect(selected).to.deep.equal({ suiteId: 'suite', testId: 'unnamed' });
  });

  for (const field of ['id', 'name', 'tests'] as const) {
    it(`abandons old suite metadata after its ${field} getter publishes a replacement`, async () => {
      const el = await fixture<LyraTestResults>(html`<lr-test-results></lr-test-results>`);
      let replaced = false;
      let staleReads = 0;
      const oldSuite = { id: 'old-suite', name: 'Obsolete suite', tests: [{ id: 'old-test', name: 'Obsolete result', status: 'failed' as const }] };
      for (const key of ['id', 'name', 'tests'] as const) {
        const value = oldSuite[key];
        Object.defineProperty(oldSuite, key, { get() {
          if (replaced) staleReads++;
          if (key === field) {
            replaced = true;
            el.suites = currentSuites();
          }
          return value;
        } });
      }
      el.suites = [oldSuite];
      await el.updateComplete;
      expect(replaced).to.equal(true);
      expect(staleReads).to.equal(0);
      expect(names(el)).to.deep.equal(['Current result']);
      expect(el.shadowRoot!.querySelector('[part="suite-header"]')!.textContent).to.equal('Current suite');
      expect(el.shadowRoot!.querySelectorAll('[part="input-error"]').length).to.equal(0);
    });
  }

  it('abandons a test whose identity getter publishes a newer collection', async () => {
    const el = await fixture<LyraTestResults>(html`<lr-test-results></lr-test-results>`);
    let identityReads = 0;
    let staleReads = 0;
    el.suites = [{ id: 'old', name: 'Old', tests: [{
      get id() { identityReads++; el.suites = currentSuites(); return 'old-test'; },
      get name() { staleReads++; return 'Obsolete result'; },
      get status() { staleReads++; return 'failed' as const; },
    }] }];
    await el.updateComplete;
    expect(identityReads).to.equal(1);
    expect(staleReads).to.equal(0);
    expect(names(el)).to.deep.equal(['Current result']);
  });

  for (const oversized of ['identity', 'combined text'] as const) {
    it(`rejects oversized suite ${oversized} atomically and recovers on replacement`, async () => {
      const el = await fixture<LyraTestResults>(html`<lr-test-results></lr-test-results>`);
      el.suites = [...currentSuites(), {
        id: oversized === 'identity' ? ' '.repeat(65_537) : 'suite',
        name: oversized === 'combined text' ? 'x'.repeat(65_532) : 'Oversized',
        tests: [{ id: 'failure', name: 'Failure', status: 'failed' }],
      }];
      await el.updateComplete;
      expect(el.shadowRoot!.querySelectorAll('[part="input-error"]').length).to.equal(1);
      expect(el.shadowRoot!.querySelectorAll('[part="count"]').length).to.equal(0);
      expect(names(el)).to.deep.equal([]);
      el.suites = currentSuites();
      await el.updateComplete;
      expect(el.shadowRoot!.querySelectorAll('[part="input-error"]').length).to.equal(0);
      expect(names(el)).to.deep.equal(['Current result']);
      expect(el.shadowRoot!.querySelectorAll('[part="count"]').length).to.equal(4);
    });
  }

  it('retries the current failed provider and replaces unknown counts with its recovered summary', async () => {
    let calls = 0;
    const source: TestResultsSource = {
      revision: 1,
      query: async () => {
        if (++calls === 1) throw new Error('Provider diagnostic');
        return { total: 1, rows: [{ key: JSON.stringify(['suite', 'recovered']), order: 0,
          value: { suiteId: 'suite', suiteName: 'Recovered suite', test: { id: 'recovered', name: 'Recovered failure', status: 'failed' } } }],
        summary: { total: 1, passed: 0, failed: 1, skipped: 0, running: 0 } };
      },
      lookup: async () => [], locate: async () => null,
    };
    const el = await fixture<LyraTestResults>(html`<lr-test-results .dataSource=${source}
      .strings=${{ tableLoadFailed: 'Results unavailable', retry: 'Retry results',
        testResultsFailed: '{count} failed results', testResultsPassed: '{count} successful results' }}></lr-test-results>`);
    await waitUntil(() => !!el.shadowRoot!.querySelector('[part="source-retry"]'));
    expect(el.sourceTotal).to.equal(null);
    expect(el.shadowRoot!.querySelectorAll('[part="count"]').length).to.equal(0);
    expect(el.shadowRoot!.textContent).to.include('Results unavailable');
    expect(el.shadowRoot!.textContent).not.to.include('Provider diagnostic');
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="source-retry"]')!.click();
    await waitUntil(() => el.sourceTotal === 1);
    await el.updateComplete;
    expect(calls).to.equal(2);
    expect(names(el)).to.deep.equal(['Recovered failure']);
    expect(el.shadowRoot!.querySelectorAll('[part="source-retry"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="count"]').length).to.equal(4);
    expect(el.shadowRoot!.querySelector('[part="count"][data-status="failed"]')!.textContent).to.equal('1 failed results');
    expect(el.shadowRoot!.querySelector('[part="count"][data-status="passed"]')!.textContent).to.equal('0 successful results');
  });
});

import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './test-results.js';
import type { LyraTestResults, TestSuiteResult } from './test-results.js';

const suites: TestSuiteResult[] = [
  {
    id: 's1',
    name: 'math.test.ts',
    tests: [
      { id: 't1', name: 'adds numbers', status: 'passed', durationMs: 5 },
      { id: 't2', name: 'subtracts numbers', status: 'failed', durationMs: 12, message: 'expected 2 got 3' },
      { id: 't3', name: 'is skipped', status: 'skipped' },
    ],
  },
];

describe('lr-test-results', () => {
  it('defaults to autoExpandFailures=true and empty statusFilter (show all)', async () => {
    const el = (await fixture(html`<lr-test-results></lr-test-results>`)) as LyraTestResults;
    expect(el.autoExpandFailures).to.be.true;
    expect(el.statusFilter).to.deep.equal([]);
  });

  it('renders visible localized counts per status, never color-only', async () => {
    const el = (await fixture(html`<lr-test-results .suites=${suites}></lr-test-results>`)) as LyraTestResults;
    await el.updateComplete;
    const passed = el.shadowRoot!.querySelector('[part="count"][data-status="passed"]')!;
    expect(passed.textContent).to.include('1');
    const failed = el.shadowRoot!.querySelector('[part="count"][data-status="failed"]')!;
    expect(failed.textContent).to.include('1');
  });

  it('emits lr-test-select when a test row name is activated', async () => {
    const el = (await fixture(html`<lr-test-results .suites=${suites}></lr-test-results>`)) as LyraTestResults;
    await el.updateComplete;
    const row = el.shadowRoot!.querySelector('[part="test"][data-status="passed"] [part="test-name"]') as HTMLElement;
    const listener = oneEvent(el, 'lr-test-select');
    row.click();
    const event = (await listener) as CustomEvent<{ suiteId: string; testId: string }>;
    expect(event.detail).to.deep.equal({ suiteId: 's1', testId: 't1' });
  });

  it('auto-expands a failed test and shows its message', async () => {
    const el = (await fixture(html`<lr-test-results .suites=${suites}></lr-test-results>`)) as LyraTestResults;
    await el.updateComplete;
    const failedRow = el.shadowRoot!.querySelector('[part="test"][data-status="failed"]')!;
    expect(failedRow.querySelector('[part="failure-message"]')!.textContent).to.include('expected 2 got 3');
  });

  it('emits lr-toggle when a failure row is manually collapsed/expanded', async () => {
    const el = (await fixture(
      html`<lr-test-results .suites=${suites} .autoExpandFailures=${false}></lr-test-results>`,
    )) as LyraTestResults;
    await el.updateComplete;
    const toggleButton = el.shadowRoot!.querySelector(
      '[part="test"][data-status="failed"] [part="test-expand-toggle"]',
    ) as HTMLButtonElement;
    const listener = oneEvent(el, 'lr-toggle');
    toggleButton.click();
    const event = (await listener) as CustomEvent<{ id: string; expanded: boolean }>;
    expect(event.detail).to.deep.equal({ id: 't2', expanded: true });
  });

  it('filter toggles mutate statusFilter and emit lr-filter-change', async () => {
    const el = (await fixture(html`<lr-test-results .suites=${suites}></lr-test-results>`)) as LyraTestResults;
    await el.updateComplete;
    const listener = oneEvent(el, 'lr-filter-change');
    const toggle = el.shadowRoot!.querySelector('[part="filter-toggle"][data-status="failed"]') as HTMLButtonElement;
    toggle.click();
    const event = (await listener) as CustomEvent<{ statuses: string[] }>;
    expect(event.detail.statuses).to.deep.equal(['failed']);
    expect(el.statusFilter).to.deep.equal(['failed']);
    expect(el.shadowRoot!.querySelectorAll('[part="test"]').length).to.equal(1);
  });

  it('renders lr-empty when suites is empty', async () => {
    const el = (await fixture(html`<lr-test-results></lr-test-results>`)) as LyraTestResults;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('lr-empty')).to.exist;
  });

  it('slots detail-{testId} content after the plain message text', async () => {
    const el = (await fixture(html`
      <lr-test-results .suites=${suites}>
        <div slot="detail-t2">rich diff here</div>
      </lr-test-results>
    `)) as LyraTestResults;
    await el.updateComplete;
    const slot = el.shadowRoot!.querySelector('slot[name="detail-t2"]') as HTMLSlotElement;
    expect(slot.assignedElements()[0].textContent).to.equal('rich diff here');
  });

  it('is accessible with a mixed-status suite', async () => {
    const el = (await fixture(html`<lr-test-results .suites=${suites}></lr-test-results>`)) as LyraTestResults;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

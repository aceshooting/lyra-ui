import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './test-results.js';
import type { LyraTestResults, TestSuiteResult } from './test-results.js';
import { styles } from './test-results.styles.js';

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

  it('accepts auto-expand-failures="false" as a plain-HTML attribute string', async () => {
    const el = (await fixture(html`<lr-test-results auto-expand-failures="false"></lr-test-results>`)) as LyraTestResults;
    expect(el.autoExpandFailures).to.be.false;
  });

  it('[part="base"]\'s aria-label defaults to the localized "Test results" label but a host aria-label wins', async () => {
    const el = (await fixture(html`<lr-test-results .suites=${suites}></lr-test-results>`)) as LyraTestResults;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Test results');

    const labeled = (await fixture(
      html`<lr-test-results .suites=${suites} aria-label="Build test results"></lr-test-results>`,
    )) as LyraTestResults;
    await labeled.updateComplete;
    expect(labeled.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
      'Build test results',
    );
  });

  it('wires this.localize() calls for status counts, filter label, status words, toggle labels, and durations to .strings overrides', async () => {
    const el = (await fixture(html`
      <lr-test-results
        .suites=${suites}
        .strings=${{
          testResultsPassed: '{count} réussi(s)',
          testResultsFilterLabel: 'Filtrer par statut',
          statusError: 'Échec',
          collapse: 'Réduire',
          durationMilliseconds: '{value} ms!',
        }}
      ></lr-test-results>
    `)) as LyraTestResults;
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('[part="count"][data-status="passed"]')!.textContent).to.include(
      '1 réussi(s)',
    );
    expect(el.shadowRoot!.querySelector('[part="filter"]')!.getAttribute('aria-label')).to.equal(
      'Filtrer par statut',
    );
    expect(
      el.shadowRoot!.querySelector('[part="test"][data-status="failed"] [part="test-status"]')!.textContent,
    ).to.include('Échec');
    // The failed test auto-expands by default, so its toggle shows the localized "collapse" text.
    expect(
      el.shadowRoot!
        .querySelector('[part="test"][data-status="failed"] [part="test-expand-toggle"]')!
        .textContent!.trim(),
    ).to.equal('Réduire');
    expect(
      el.shadowRoot!
        .querySelector('[part="test"][data-status="passed"] [part="test-duration"]')!
        .textContent!.trim(),
    ).to.equal('5 ms!');
  });

  it('wires the run-completion live-region announcement to a .strings override', async () => {
    const runningSuites: TestSuiteResult[] = [
      { id: 's1', name: 'math.test.ts', tests: [{ id: 't1', name: 'a', status: 'running' }] },
    ];
    const el = (await fixture(html`
      <lr-test-results
        .suites=${runningSuites}
        .strings=${{ testResultsCompleteAnnounce: '{passed} ok, {failed} ko, {skipped} skip' }}
      ></lr-test-results>
    `)) as LyraTestResults;
    await el.updateComplete;
    el.suites = [{ id: 's1', name: 'math.test.ts', tests: [{ id: 't1', name: 'a', status: 'passed' }] }];
    await el.updateComplete;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const region = el.shadowRoot!.querySelector('lr-live-region')!.shadowRoot!.querySelector('[part="region"]')!;
    expect(region.textContent).to.equal('1 ok, 0 ko, 0 skip');
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

  describe('--lr-test-results-filter-active-bg / -border / -color', () => {
    const pressedFixture = async (): Promise<LyraTestResults> => {
      const el = (await fixture(
        html`<lr-test-results .suites=${suites} .statusFilter=${['passed']}></lr-test-results>`,
      )) as LyraTestResults;
      await el.updateComplete;
      return el;
    };

    it('retints the pressed filter toggle background, border, and color via the cssprops', async () => {
      const el = await pressedFixture();
      el.style.setProperty('--lr-test-results-filter-active-bg', 'rgb(10, 20, 30)');
      el.style.setProperty('--lr-test-results-filter-active-border', 'rgb(40, 50, 60)');
      el.style.setProperty('--lr-test-results-filter-active-color', 'rgb(70, 80, 90)');
      const pressed = el.shadowRoot!.querySelector('[part="filter-toggle"][aria-pressed="true"]') as HTMLElement;
      expect(pressed.getAttribute('data-status')).to.equal('passed');
      expect(getComputedStyle(pressed).backgroundColor).to.equal('rgb(10, 20, 30)');
      expect(getComputedStyle(pressed).borderTopColor).to.equal('rgb(40, 50, 60)');
      expect(getComputedStyle(pressed).color).to.equal('rgb(70, 80, 90)');
    });

    it('renders byte-identically to the token defaults when unset', async () => {
      const el = await pressedFixture();
      const pressed = el.shadowRoot!.querySelector('[part="filter-toggle"][aria-pressed="true"]') as HTMLElement;
      const bg = getComputedStyle(pressed).backgroundColor;
      const border = getComputedStyle(pressed).borderTopColor;
      const color = getComputedStyle(pressed).color;
      el.style.setProperty('--lr-test-results-filter-active-bg', 'var(--lr-color-brand-quiet)');
      el.style.setProperty('--lr-test-results-filter-active-border', 'var(--lr-color-brand)');
      el.style.setProperty('--lr-test-results-filter-active-color', 'var(--lr-color-brand)');
      expect(getComputedStyle(pressed).backgroundColor).to.equal(bg);
      expect(getComputedStyle(pressed).borderTopColor).to.equal(border);
      expect(getComputedStyle(pressed).color).to.equal(color);
    });

    it('is accessible with a pressed filter toggle', async () => {
      const el = await pressedFixture();
      await expect(el).to.be.accessible();
    });
  });

  it('gives filter-toggle, test-name, and test-expand-toggle a hover state', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='filter-toggle'\]:hover/);
    expect(css).to.match(/\[part='test-name'\]:hover/);
    expect(css).to.match(/\[part='test-expand-toggle'\]:hover/);
  });
});

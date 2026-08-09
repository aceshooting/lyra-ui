import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './test-results.js';
import { testResultDetailSlotName, type LyraTestResults, type TestSuiteResult } from './test-results.js';
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
          statusSuccess: 'Réussi',
          statusError: 'Échec',
          statusSkipped: 'Ignoré',
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
    const decorativeStatusGlyphs = [...el.shadowRoot!.querySelectorAll<HTMLElement>(
      '[part="test-status"] > [aria-hidden="true"]',
    )].map((node) => node.textContent?.trim() ?? '');
    expect(decorativeStatusGlyphs).to.deep.equal(['✓', '×', '–']);
    expect(decorativeStatusGlyphs.join('')).not.to.match(/[PFS]/);
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

  it('formats status counts and durations with the effective locale', async () => {
    const el = (await fixture(
      html`<lr-test-results lang="ar-EG" .suites=${suites}></lr-test-results>`,
    )) as LyraTestResults;
    const number = new Intl.NumberFormat('ar-EG');
    expect(el.shadowRoot!.querySelector('[part="count"][data-status="passed"]')!.textContent)
      .to.include(number.format(1));
    expect(el.shadowRoot!
      .querySelector('[part="test"][data-status="passed"] [part="test-duration"]')!
      .textContent).to.include(number.format(5));
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

  it('keys manualExpanded by test.id, not positional index, so inserting a test above a manually-collapsed one leaves it collapsed', async () => {
    const initialSuites: TestSuiteResult[] = [
      { id: 's1', name: 'suite', tests: [{ id: 't1', name: 'test one', status: 'failed', message: 'one failed' }] },
    ];
    const el = (await fixture(html`<lr-test-results .suites=${initialSuites}></lr-test-results>`)) as LyraTestResults;
    await el.updateComplete;

    // t1 auto-expands (it's failed); manually collapse it.
    let toggle = el.shadowRoot!.querySelector('[part="test-expand-toggle"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).to.equal('true');
    toggle.click();
    await el.updateComplete;
    toggle = el.shadowRoot!.querySelector('[part="test-expand-toggle"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');

    // Insert a new failed test t0 above t1.
    const updatedSuites: TestSuiteResult[] = [
      {
        id: 's1',
        name: 'suite',
        tests: [
          { id: 't0', name: 'test zero', status: 'failed', message: 'zero failed' },
          { id: 't1', name: 'test one', status: 'failed', message: 'one failed' },
        ],
      },
    ];
    el.suites = updatedSuites;
    await el.updateComplete;

    const toggles = [...el.shadowRoot!.querySelectorAll('[part="test-expand-toggle"]')] as HTMLButtonElement[];
    expect(toggles.length).to.equal(2);
    expect(toggles[0].getAttribute('aria-expanded'), 't0 has no manual override and should auto-expand').to.equal(
      'true',
    );
    expect(
      toggles[1].getAttribute('aria-expanded'),
      "t1's manual collapse must follow test.id, not its now-shifted position",
    ).to.equal('false');
  });

  it('keeps duplicate test ids suite-scoped across expansion, names, slots, and toggle event detail', async () => {
    const duplicateSuites: TestSuiteResult[] = [
      {
        id: 'unit',
        name: 'Unit suite',
        tests: [{ id: 'same', name: 'shared name', status: 'failed', message: 'unit failed' }],
      },
      {
        id: 'integration',
        name: 'Integration suite',
        tests: [{ id: 'same', name: 'shared name', status: 'failed', message: 'integration failed' }],
      },
    ];
    const el = (await fixture(html`
      <lr-test-results .suites=${duplicateSuites} .autoExpandFailures=${false}>
        <div slot="detail-unit-same">unit detail</div>
        <div slot="detail-integration-same">integration detail</div>
      </lr-test-results>
    `)) as LyraTestResults;
    await el.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const toggles = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="test-expand-toggle"]')];
    expect(toggles.length).to.equal(2);
    expect(toggles[0]!.getAttribute('aria-label') ?? '').to.contain('Unit suite');
    expect(toggles[1]!.getAttribute('aria-label') ?? '').to.contain('Integration suite');

    const eventPromise = oneEvent(el, 'lr-toggle');
    toggles[0]!.click();
    const event = (await eventPromise) as CustomEvent<{ id: string; suiteId?: string; expanded: boolean }>;
    await el.updateComplete;
    expect(event.detail).to.deep.equal({ id: 'same', suiteId: 'unit', expanded: true });

    const nextToggles = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="test-expand-toggle"]')];
    expect(nextToggles[0]!.getAttribute('aria-expanded')).to.equal('true');
    expect(nextToggles[1]!.getAttribute('aria-expanded')).to.equal('false');
    const failures = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="failure"]')];
    const firstSlot = failures[0]!.querySelector<HTMLSlotElement>('slot[name="detail-unit-same"]')!;
    expect(firstSlot.assignedElements().length).to.equal(1);
    expect(firstSlot.assignedElements()[0]!.textContent).to.equal('unit detail');
    expect(failures[0]!.querySelectorAll('slot[name="detail-integration-same"]').length).to.equal(0);
  });

  it('routes collision-prone suite/test ids through distinct canonical detail slots', async () => {
    const collisionSuites: TestSuiteResult[] = [
      {
        id: 'a-b',
        name: 'First suite',
        tests: [{ id: 'c', name: 'First test', status: 'passed' }],
      },
      {
        id: 'a',
        name: 'Second suite',
        tests: [{ id: 'b-c', name: 'Second test', status: 'passed' }],
      },
    ];
    const firstSlot = `detail-${encodeURIComponent('a-b')}:${encodeURIComponent('c')}`;
    const secondSlot = `detail-${encodeURIComponent('a')}:${encodeURIComponent('b-c')}`;
    const el = (await fixture(html`
      <lr-test-results .suites=${collisionSuites}>
        <div slot=${firstSlot}>first detail</div>
        <div slot=${secondSlot}>second detail</div>
      </lr-test-results>
    `)) as LyraTestResults;
    await el.updateComplete;

    const toggles = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="test-expand-toggle"]')];
    expect(toggles).to.have.lengthOf(2);
    toggles.forEach((toggle) => toggle.click());
    await el.updateComplete;

    const first = el.shadowRoot!.querySelector<HTMLSlotElement>(`slot[name="${firstSlot}"]`);
    const second = el.shadowRoot!.querySelector<HTMLSlotElement>(`slot[name="${secondSlot}"]`);
    expect(first?.assignedElements().map((node) => node.textContent)).to.deep.equal(['first detail']);
    expect(second?.assignedElements().map((node) => node.textContent)).to.deep.equal(['second detail']);
  });

  it('derives distinct canonical slots for colliding ids with isolated UTF-16 surrogates', async () => {
    const malformed = '\uD800';
    const collisionSuites: TestSuiteResult[] = [
      {
        id: `a-${malformed}`,
        name: 'First suite',
        tests: [{ id: 'b', name: 'First test', status: 'passed' }],
      },
      {
        id: 'a',
        name: 'Second suite',
        tests: [{ id: `${malformed}-b`, name: 'Second test', status: 'passed' }],
      },
    ];
    const firstSlot = testResultDetailSlotName(collisionSuites[0]!.id, collisionSuites[0]!.tests[0]!.id);
    const secondSlot = testResultDetailSlotName(collisionSuites[1]!.id, collisionSuites[1]!.tests[0]!.id);
    expect(firstSlot).to.equal('detail-a-%uD800:b');
    expect(secondSlot).to.equal('detail-a:%uD800-b');

    const el = (await fixture(html`
      <lr-test-results .suites=${collisionSuites}>
        <div slot=${firstSlot}>first malformed detail</div>
        <div slot=${secondSlot}>second malformed detail</div>
      </lr-test-results>
    `)) as LyraTestResults;
    await el.updateComplete;

    const slots = [...el.shadowRoot!.querySelectorAll<HTMLSlotElement>('slot[name^="detail-"]')];
    const assignments = slots.map((slot) => [slot.name, ...slot.assignedElements().map((node) => node.textContent)]);
    expect(assignments).to.deep.include([firstSlot, 'first malformed detail']);
    expect(assignments).to.deep.include([secondSlot, 'second malformed detail']);
  });

  it('preserves detail-{testId} as the fallback slot when the test id is globally unique', async () => {
    const el = (await fixture(html`
      <lr-test-results .suites=${suites}>
        <div slot="detail-t2">legacy detail</div>
      </lr-test-results>
    `)) as LyraTestResults;
    await el.updateComplete;
    const slot = el.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="detail-t2"]');
    expect(slot?.assignedElements().length ?? 0).to.equal(1);
    expect(slot?.assignedElements()[0]?.textContent).to.equal('legacy detail');
  });

  it('discovers detail content appended after mount for a previously non-expandable test', async () => {
    const passing: TestSuiteResult[] = [
      { id: 'unit', name: 'Unit suite', tests: [{ id: 'late', name: 'late detail', status: 'passed' }] },
    ];
    const el = (await fixture(html`<lr-test-results .suites=${passing}></lr-test-results>`)) as LyraTestResults;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="test-expand-toggle"]').length).to.equal(0);

    const detail = document.createElement('div');
    detail.slot = 'detail-unit-late';
    detail.textContent = 'appended detail';
    el.append(detail);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await el.updateComplete;

    expect(el.shadowRoot!.querySelectorAll('[part="test-expand-toggle"]').length).to.equal(1);
  });

  it('omits invalid and negative public durations instead of rendering corrupt text', async () => {
    const invalid: TestSuiteResult[] = [
      {
        id: 'invalid',
        name: 'Invalid durations',
        tests: [
          { id: 'negative', name: 'negative', status: 'passed', durationMs: -1 },
          { id: 'nan', name: 'not a number', status: 'passed', durationMs: Number.NaN },
          { id: 'infinite', name: 'infinite', status: 'passed', durationMs: Number.POSITIVE_INFINITY },
          { id: 'valid', name: 'valid', status: 'passed', durationMs: 0 },
        ],
      },
    ];
    const el = (await fixture(html`<lr-test-results .suites=${invalid}></lr-test-results>`)) as LyraTestResults;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="test-duration"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelector('[part="test-duration"]')!.textContent).to.contain('0');
    expect(el.shadowRoot!.textContent).not.to.contain('NaN');
    expect(el.shadowRoot!.textContent).not.to.contain('Infinity');
  });

  it('contains an unbroken public test name in a 256px allocation', async () => {
    const longSuites: TestSuiteResult[] = [
      {
        id: 'long',
        name: 'Long suite',
        tests: [{ id: 'long-test', name: `test-${'identifier'.repeat(200)}`, status: 'passed' }],
      },
    ];
    const el = (await fixture(html`
      <div style="inline-size:256px;max-inline-size:256px">
        <lr-test-results style="max-inline-size:100%" .suites=${longSuites}></lr-test-results>
      </div>
    `)).querySelector('lr-test-results') as LyraTestResults;
    await el.updateComplete;
    const name = el.shadowRoot!.querySelector<HTMLElement>('[part="test-name"]')!;
    expect(Math.ceil(el.getBoundingClientRect().width)).to.be.at.most(256);
    expect(name.scrollWidth).to.be.at.most(Math.ceil(name.getBoundingClientRect().width) + 1);
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

  it('generates unique whitespace-free internal IDREF targets for duplicate and unsafe test ids', async () => {
    const duplicateSuites: TestSuiteResult[] = [
      {
        id: 'suite one',
        name: 'one',
        tests: [{ id: 'same id', name: 'first', status: 'failed', message: 'x' }],
      },
      {
        id: 'suite two',
        name: 'two',
        tests: [{ id: 'same id', name: 'second', status: 'failed', message: 'y' }],
      },
    ];
    const el = (await fixture(
      html`<lr-test-results .suites=${duplicateSuites}></lr-test-results>`,
    )) as LyraTestResults;
    await el.updateComplete;
    const ids = [...el.shadowRoot!.querySelectorAll('[id]')].map((node) => node.id);
    expect(new Set(ids).size).to.equal(ids.length);
    expect(ids.some((id) => /\s/.test(id))).to.be.false;
    for (const control of el.shadowRoot!.querySelectorAll('[aria-controls], [aria-describedby]')) {
      const target = control.getAttribute('aria-controls') ?? control.getAttribute('aria-describedby');
      expect((el.shadowRoot!.getElementById(target!)) != null).to.equal(true);
    }
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

  it('exposes component-scoped state colors for counts, row statuses, and failure messages', async () => {
    const el = (await fixture(html`<lr-test-results .suites=${suites}></lr-test-results>`)) as LyraTestResults;
    el.style.setProperty('--lr-test-results-passed-color', 'rgb(10, 20, 30)');
    el.style.setProperty('--lr-test-results-failed-color', 'rgb(40, 50, 60)');
    await el.updateComplete;
    const passed = el.shadowRoot!.querySelector<HTMLElement>('[part="count"][data-status="passed"]')!;
    const failedStatus = el.shadowRoot!.querySelector<HTMLElement>(
      '[part="test"][data-status="failed"] [part="test-status"]',
    )!;
    const failure = el.shadowRoot!.querySelector<HTMLElement>('[part="failure-message"]')!;
    expect(getComputedStyle(passed).color).to.equal('rgb(10, 20, 30)');
    expect(getComputedStyle(failedStatus).color).to.equal('rgb(40, 50, 60)');
    expect(getComputedStyle(failure).color).to.equal('rgb(40, 50, 60)');
  });

  it('gives filter-toggle, test-name, and test-expand-toggle a hover state', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='filter-toggle'\]:hover/);
    expect(css).to.match(/\[part='test-name'\]:hover/);
    expect(css).to.match(/\[part='test-expand-toggle'\]:hover/);
  });
});

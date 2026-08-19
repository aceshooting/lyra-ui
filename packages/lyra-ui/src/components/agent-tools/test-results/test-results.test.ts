import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import './test-results.js';
import { testResultDetailSlotName, type LyraTestResults, type TestSuiteResult } from './test-results.js';
import type { LyraEmpty } from '../../overlays/empty/empty.js';

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
  it('defaults to autoExpandFailures=true, an empty filter, and an idle uncorrelated run', async () => {
    const el = (await fixture(html`<lr-test-results></lr-test-results>`)) as LyraTestResults;
    expect(el.autoExpandFailures).to.be.true;
    expect(el.statusFilter).to.deep.equal([]);
    expect(el.runId).to.equal(null);
    expect(el.runState).to.equal('idle');
  });

  it('accepts auto-expand-failures="false" as a plain-HTML attribute string', async () => {
    const el = (await fixture(html`<lr-test-results auto-expand-failures="false"></lr-test-results>`)) as LyraTestResults;
    expect(el.autoExpandFailures).to.be.false;
  });

  it('names the overall wrapper only when the host does not already own a non-empty name', async () => {
    const el = (await fixture(html`<lr-test-results .suites=${suites}></lr-test-results>`)) as LyraTestResults;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Test results');

    const labeled = (await fixture(
      html`<lr-test-results .suites=${suites} aria-label="Build test results"></lr-test-results>`,
    )) as LyraTestResults;
    await labeled.updateComplete;
    const namedBase = labeled.shadowRoot!.querySelector('[part="base"]')!;
    expect(labeled.getAttribute('aria-label')).to.equal('Build test results');
    expect(namedBase.hasAttribute('role')).to.equal(false);
    expect(namedBase.hasAttribute('aria-label')).to.equal(false);

    const decorative = (await fixture(
      html`<lr-test-results .suites=${suites} aria-label=""></lr-test-results>`,
    )) as LyraTestResults;
    const decorativeBase = decorative.shadowRoot!.querySelector('[part="base"]')!;
    expect(decorativeBase.getAttribute('role')).to.equal('group');
    expect(decorativeBase.getAttribute('aria-label')).to.equal('');
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
        run-id="run-1"
        run-state="running"
        .suites=${runningSuites}
        .strings=${{ testResultsCompleteAnnounce: '{passed} ok, {failed} ko, {skipped} skip' }}
      ></lr-test-results>
    `)) as LyraTestResults;
    await el.updateComplete;
    el.suites = [{ id: 's1', name: 'math.test.ts', tests: [{ id: 't1', name: 'a', status: 'passed' }] }];
    el.runState = 'complete';
    await el.updateComplete;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const region = el.shadowRoot!.querySelector('lr-live-region')!.shadowRoot!.querySelector('[part="region"]')!;
    expect(region.textContent).to.equal('1 ok, 0 ko, 0 skip');
  });

  it('does not announce completion when a running result list is merely cleared', async () => {
    const el = await fixture<LyraTestResults>(html`
      <lr-test-results
        run-id="run-1"
        run-state="running"
        .suites=${[{ id: 's1', name: 'suite', tests: [{ id: 't1', name: 'test', status: 'running' }] }]}
      ></lr-test-results>
    `);
    el.suites = [];
    await el.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const region = el.shadowRoot!.querySelector('lr-live-region')!.shadowRoot!.querySelector('[part="region"]')!;
    expect(region.textContent).to.equal('');
  });

  it('does not correlate completion across a run-id replacement', async () => {
    const el = await fixture<LyraTestResults>(html`
      <lr-test-results run-id="run-1" run-state="running" .suites=${suites}></lr-test-results>
    `);
    el.runId = 'run-2';
    el.runState = 'complete';
    await el.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const region = el.shadowRoot!.querySelector('lr-live-region')!.shadowRoot!.querySelector('[part="region"]')!;
    expect(region.textContent).to.equal('');
  });

  it('renders correct per-status summary and filter counts across multiple suites (single-pass status-count regression)', async () => {
    const multiSuites: TestSuiteResult[] = [
      {
        id: 's1',
        name: 'suite one',
        tests: [
          { id: 't1', name: 'a', status: 'passed' },
          { id: 't2', name: 'b', status: 'passed' },
          { id: 't3', name: 'c', status: 'failed' },
          { id: 't4', name: 'd', status: 'skipped' },
        ],
      },
      {
        id: 's2',
        name: 'suite two',
        tests: [
          { id: 't5', name: 'e', status: 'passed' },
          { id: 't6', name: 'f', status: 'failed' },
          { id: 't7', name: 'g', status: 'running' },
          { id: 't8', name: 'h', status: 'running' },
        ],
      },
    ];
    const el = (await fixture(html`<lr-test-results .suites=${multiSuites}></lr-test-results>`)) as LyraTestResults;
    await el.updateComplete;

    const countFor = (status: string): string =>
      el.shadowRoot!.querySelector(`[part="count"][data-status="${status}"]`)!.textContent ?? '';
    expect(countFor('passed')).to.include('3');
    expect(countFor('failed')).to.include('2');
    expect(countFor('skipped')).to.include('1');
    expect(countFor('running')).to.include('2');

    const filterCountFor = (status: string): string =>
      el.shadowRoot!.querySelector(`[part="filter-toggle"][data-status="${status}"]`)!.textContent ?? '';
    expect(filterCountFor('passed')).to.include('3');
    expect(filterCountFor('failed')).to.include('2');
    expect(filterCountFor('skipped')).to.include('1');
    expect(filterCountFor('running')).to.include('2');
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
    const event = (await listener) as CustomEvent<{ suiteId: string; testId: string; expanded: boolean }>;
    expect(event.detail).to.deep.equal({ suiteId: 's1', testId: 't2', expanded: true });
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
    const unitSlot = testResultDetailSlotName('unit', 'same');
    const integrationSlot = testResultDetailSlotName('integration', 'same');
    const el = (await fixture(html`
      <lr-test-results .suites=${duplicateSuites} .autoExpandFailures=${false}>
        <div slot=${unitSlot}>unit detail</div>
        <div slot=${integrationSlot}>integration detail</div>
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
    const event = (await eventPromise) as CustomEvent<{ suiteId: string; testId: string; expanded: boolean }>;
    await el.updateComplete;
    expect(event.detail).to.deep.equal({ suiteId: 'unit', testId: 'same', expanded: true });

    const nextToggles = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="test-expand-toggle"]')];
    expect(nextToggles[0]!.getAttribute('aria-expanded')).to.equal('true');
    expect(nextToggles[1]!.getAttribute('aria-expanded')).to.equal('false');
    const failures = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="failure"]')];
    const firstSlot = failures[0]!.querySelector<HTMLSlotElement>(`slot[name="${unitSlot}"]`)!;
    expect(firstSlot.assignedElements().length).to.equal(1);
    expect(firstSlot.assignedElements()[0]!.textContent).to.equal('unit detail');
    expect(failures[0]!.querySelectorAll(`slot[name="${integrationSlot}"]`).length).to.equal(0);
  });

  it('mounts exactly one detail slot per row — the legacy spellings are gone', async () => {
    const el = (await fixture(html`
      <lr-test-results .suites=${suites}>
        <div slot=${testResultDetailSlotName('s1', 't2')}>canonical detail</div>
      </lr-test-results>
    `)) as LyraTestResults;
    await el.updateComplete;

    const rows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="failure"]')];
    expect(rows.map((row) => row.querySelectorAll('slot').length)).to.deep.equal([1, 1, 1]);
    expect(
      [...el.shadowRoot!.querySelectorAll<HTMLSlotElement>('slot[name^="detail-"]')].map((slot) => slot.name),
    ).to.deep.equal([
      testResultDetailSlotName('s1', 't1'),
      testResultDetailSlotName('s1', 't2'),
      testResultDetailSlotName('s1', 't3'),
    ]);
  });

  it('ignores the removed legacy detail-{suiteId}-{testId} and detail-{testId} slot spellings', async () => {
    const el = (await fixture(html`
      <lr-test-results .suites=${suites} .autoExpandFailures=${false}>
        <div slot="detail-s1-t1">legacy scoped detail</div>
        <div slot="detail-t3">legacy generic detail</div>
      </lr-test-results>
    `)) as LyraTestResults;
    await el.updateComplete;

    expect(el.shadowRoot!.querySelectorAll('slot[name="detail-s1-t1"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('slot[name="detail-t3"]').length).to.equal(0);
    // Neither passing/skipped row becomes expandable off a legacy name any more; only the failed
    // row keeps its own toggle.
    expect(el.shadowRoot!.querySelectorAll('[part="test-expand-toggle"]').length).to.equal(1);
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

  it('always emits the same suiteId/testId lr-toggle identity shape', async () => {
    const duplicateSuites: TestSuiteResult[] = [
      { id: 'suite-one', name: 'One', tests: [{ id: 'dup', name: 'first', status: 'failed', message: 'x' }] },
      { id: 'suite-two', name: 'Two', tests: [{ id: 'solo', name: 'second', status: 'failed', message: 'y' }] },
      { id: 'suite-three', name: 'Three', tests: [{ id: 'dup', name: 'third', status: 'failed', message: 'z' }] },
    ];
    const el = (await fixture(
      html`<lr-test-results .suites=${duplicateSuites} .autoExpandFailures=${false}></lr-test-results>`,
    )) as LyraTestResults;
    await el.updateComplete;

    const toggles = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="test-expand-toggle"]')];
    const duplicated = oneEvent(el, 'lr-toggle');
    toggles[0]!.click();
    expect(((await duplicated) as CustomEvent<{ suiteId: string; testId: string; expanded: boolean }>).detail).to.deep.equal({
      suiteId: 'suite-one',
      testId: 'dup',
      expanded: true,
    });

    const unique = oneEvent(el, 'lr-toggle');
    toggles[1]!.click();
    expect(((await unique) as CustomEvent<{ suiteId: string; testId: string; expanded: boolean }>).detail).to.deep.equal({
      suiteId: 'suite-two',
      testId: 'solo',
      expanded: true,
    });
  });

  it('normalizes one foreign provider status once to the localized skipped fallback', async () => {
    let statusReads = 0;
    const foreign = {
      id: 'foreign',
      name: 'foreign provider result',
      get status(): unknown {
        statusReads++;
        return 'provider-specific';
      },
    };
    const el = await fixture<LyraTestResults>(html`
      <lr-test-results
        .suites=${[{ id: 'provider', name: 'Provider', tests: [foreign] }] as unknown as TestSuiteResult[]}
        .strings=${{ statusSkipped: 'Not classified', testResultsSkipped: '{count} not classified' }}
      ></lr-test-results>
    `);

    const row = el.shadowRoot!.querySelector<HTMLElement>('[part="test"]')!;
    expect(statusReads).to.equal(1);
    expect(row.dataset['status']).to.equal('skipped');
    expect(row.querySelector('[part="test-status"]')!.textContent).to.include('Not classified');
    expect(el.shadowRoot!.querySelector('[part="count"][data-status="skipped"]')!.textContent).to.include(
      '1 not classified',
    );
  });

  it('builds the light-DOM detail-slot index at most once per render', async () => {
    const manyTests: TestSuiteResult[] = [{
      id: 'suite',
      name: 'Suite',
      tests: Array.from({ length: 40 }, (_, index) => ({
        id: `test-${index}`,
        name: `Test ${index}`,
        status: 'passed' as const,
      })),
    }];
    const el = await fixture<LyraTestResults>(html`
      <lr-test-results .suites=${manyTests}>
        ${Array.from({ length: 40 }, (_, index) => html`
          <span slot=${testResultDetailSlotName('suite', `test-${index}`)}>Detail ${index}</span>
        `)}
      </lr-test-results>
    `);
    const children = el.children;
    let childrenReads = 0;
    Object.defineProperty(el, 'children', {
      configurable: true,
      get: () => {
        childrenReads++;
        return children;
      },
    });

    el.requestUpdate();
    await el.updateComplete;

    expect(childrenReads).to.be.at.most(1);
    expect(el.shadowRoot!.querySelectorAll('[part="test-expand-toggle"]')).to.have.length(40);
  });

  it('discovers detail content appended after mount for a previously non-expandable test', async () => {
    const passing: TestSuiteResult[] = [
      { id: 'unit', name: 'Unit suite', tests: [{ id: 'late', name: 'late detail', status: 'passed' }] },
    ];
    const el = (await fixture(html`<lr-test-results .suites=${passing}></lr-test-results>`)) as LyraTestResults;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="test-expand-toggle"]').length).to.equal(0);

    const detail = document.createElement('div');
    detail.slot = testResultDetailSlotName('unit', 'late');
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

  it('renders an explicit empty state when filters hide every populated result, distinct from the genuinely-empty "no data" text', async () => {
    const el = await fixture<LyraTestResults>(html`
      <lr-test-results .suites=${suites} .statusFilter=${['running']}></lr-test-results>
    `);
    const empty = el.shadowRoot!.querySelector('[part="empty"]') as LyraEmpty;
    // Compares a boolean, never the DOM node itself, as chai's actual -- a failing node/NodeList
    // assertion hangs the whole file (see AGENTS.md's testing conventions).
    expect(Boolean(empty)).to.be.true;
    expect(el.shadowRoot!.querySelectorAll('[part="test"]')).to.have.length(0);
    // A filter that matches nothing on a populated run is a "no matches" state, not a "no data"
    // state -- rendering the same "No data" text here reads as the filter being broken rather
    // than simply empty (the run has three tests; none of them are "running").
    expect(empty.heading).to.equal('No matches');
    expect(empty.heading).to.not.equal('No data');
  });

  it('renders lr-empty with the genuinely-empty "no data" text when suites is empty', async () => {
    const el = (await fixture(html`<lr-test-results></lr-test-results>`)) as LyraTestResults;
    await el.updateComplete;
    const empty = el.shadowRoot!.querySelector('lr-empty') as LyraEmpty;
    expect(Boolean(empty)).to.be.true;
    expect(empty.heading).to.equal('No data');
  });

  it('still renders the genuinely-empty "no data" text when a suites is empty AND a statusFilter is set (regression: must not read as a filter no-match)', async () => {
    const el = (await fixture(
      html`<lr-test-results .statusFilter=${['failed']}></lr-test-results>`,
    )) as LyraTestResults;
    await el.updateComplete;
    const empty = el.shadowRoot!.querySelector('lr-empty') as LyraEmpty;
    expect(Boolean(empty)).to.be.true;
    expect(empty.heading).to.equal('No data');
  });

  it('wires the filtered-to-nothing empty heading to a .strings noMatches override', async () => {
    const el = await fixture<LyraTestResults>(html`
      <lr-test-results
        .suites=${suites}
        .statusFilter=${['running']}
        .strings=${{ noMatches: 'Aucun résultat' }}
      ></lr-test-results>
    `);
    const empty = el.shadowRoot!.querySelector('[part="empty"]') as LyraEmpty;
    expect(empty.heading).to.equal('Aucun résultat');
  });

  it('prunes removed expansion identities so a reused suite/test pair starts from defaults', async () => {
    const failed: TestSuiteResult[] = [
      { id: 'suite', name: 'suite', tests: [{ id: 'reused', name: 'test', status: 'failed', message: 'x' }] },
    ];
    const el = await fixture<LyraTestResults>(html`
      <lr-test-results .suites=${failed} .autoExpandFailures=${false}></lr-test-results>
    `);
    const toggle = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="test-expand-toggle"]')!;
    toggle.click();
    await el.updateComplete;
    expect(toggle.getAttribute('aria-expanded')).to.equal('true');

    el.suites = [];
    await el.updateComplete;
    el.suites = failed.map((suite) => ({ ...suite, tests: suite.tests.map((test) => ({ ...test })) }));
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('[part="test-expand-toggle"]')!.getAttribute('aria-expanded')).to.equal('false');
  });

  it('bounds mounted results, uses first-wins identities, and exposes localized truncation', async () => {
    const tests = Array.from({ length: 1_001 }, (_, index) => ({
      id: `test-${index}`,
      name: `test ${index}`,
      status: 'passed' as const,
    }));
    tests.splice(
      1,
      0,
      { ...tests[0]!, id: '   ', name: 'blank identity must be omitted' },
      { ...tests[0]!, name: 'duplicate must not replace first' },
    );
    const el = await fixture<LyraTestResults>(html`
      <lr-test-results
        .suites=${[
          { id: '   ', name: 'blank suite', tests: [tests[0]!] },
          { id: 'suite', name: 'suite', tests },
        ]}
        .strings=${{ testResultsLimit: 'Showing the first {count} tests' }}
      ></lr-test-results>
    `);
    const rows = [...el.shadowRoot!.querySelectorAll('[part="test"]')];
    expect(rows).to.have.length(1_000);
    expect(rows[0]!.querySelector('[part="test-name"]')!.textContent!.trim()).to.equal('test 0');
    expect(el.shadowRoot!.querySelector('[part="limit"]')!.textContent).to.equal('Showing the first 1,000 tests');
  });

  it('keeps complete status counts while reserving a failed result beyond the 1,000-row boundary', async () => {
    const tests: TestSuiteResult['tests'] = Array.from({ length: 1_001 }, (_, index) => ({
      id: `passed-${index}`,
      name: `passed ${index}`,
      status: 'passed' as const,
    }));
    tests.push({ id: 'late-failure', name: 'late failure', status: 'failed' });
    const el = await fixture<LyraTestResults>(html`
      <lr-test-results .suites=${[{ id: 'suite', name: 'suite', tests }]}></lr-test-results>
    `);
    const count = (status: string): string =>
      el.shadowRoot!.querySelector(`[part="count"][data-status="${status}"]`)?.textContent ?? '';

    expect(el.shadowRoot!.querySelectorAll('[part="test"]')).to.have.length(1_000);
    expect(el.shadowRoot!.querySelector('[part="test"][data-status="failed"]') !== null).to.equal(true);
    expect(count('passed')).to.include('1,001');
    expect(count('failed')).to.include('1');
  });

  it('preserves a manually expanded identity when later input moves it beyond the row boundary', async () => {
    const initial: TestSuiteResult['tests'] = Array.from({ length: 1_000 }, (_, index) => ({
      id: `test-${index}`,
      name: `test ${index}`,
      status: 'passed' as const,
    }));
    const detailSlot = testResultDetailSlotName('suite', 'test-999');
    const el = await fixture<LyraTestResults>(html`
      <lr-test-results .suites=${[{ id: 'suite', name: 'suite', tests: initial }]} .autoExpandFailures=${false}>
        <span slot=${detailSlot}>Late detail</span>
      </lr-test-results>
    `);
    const targetToggle = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="test-expand-toggle"]')]
      .find((toggle) => toggle.getAttribute('aria-label')?.includes('test 999'))!;
    targetToggle.click();
    await el.updateComplete;

    el.suites = [{
      id: 'suite',
      name: 'suite',
      tests: [
        ...Array.from({ length: 10 }, (_, index) => ({
          id: `new-${index}`,
          name: `new ${index}`,
          status: 'passed' as const,
        })),
        ...initial,
      ],
    }];
    await el.updateComplete;

    const reservedToggle = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="test-expand-toggle"]')]
      .find((toggle) => toggle.getAttribute('aria-label')?.includes('test 999'));
    expect(reservedToggle?.getAttribute('aria-expanded')).to.equal('true');
    expect(el.shadowRoot!.querySelectorAll('[part="test"]')).to.have.length(1_000);
  });

  it('slots canonical detail content after the plain message text', async () => {
    const slotName = testResultDetailSlotName('s1', 't2');
    const el = (await fixture(html`
      <lr-test-results .suites=${suites}>
        <div slot=${slotName}>rich diff here</div>
      </lr-test-results>
    `)) as LyraTestResults;
    await el.updateComplete;
    const failure = el.shadowRoot!.querySelectorAll<HTMLElement>('[part="failure"]')[1]!;
    const slot = failure.querySelector(`slot[name="${slotName}"]`) as HTMLSlotElement;
    expect(slot.assignedElements()[0].textContent).to.equal('rich diff here');
    expect(failure.querySelector('[part="failure-message"]')!.compareDocumentPosition(slot)
      & Node.DOCUMENT_POSITION_FOLLOWING).to.be.greaterThan(0);
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

  it('gives filter controls and test actions rendered hover feedback', async () => {
    const el = (await fixture(
      html`<lr-test-results .suites=${suites} .statusFilter=${['failed']}></lr-test-results>`,
    )) as LyraTestResults;
    await el.updateComplete;
    el.style.setProperty('--lr-test-results-filter-active-bg', 'rgb(10, 20, 30)');
    const selected = el.shadowRoot!.querySelector<HTMLElement>(
      '[part="filter-toggle"][aria-pressed="true"]',
    )!;
    const unselected = el.shadowRoot!.querySelector<HTMLElement>(
      '[part="filter-toggle"][aria-pressed="false"]',
    )!;
    const testName = el.shadowRoot!.querySelector<HTMLElement>('[part="test-name"]')!;
    const expandToggle = el.shadowRoot!.querySelector<HTMLElement>('[part="test-expand-toggle"]')!;
    const centre = (element: HTMLElement): [number, number] => {
      const rect = element.getBoundingClientRect();
      return [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)];
    };
    await resetMouse();
    const targets = [
      ['selected filter toggle', selected, getComputedStyle(selected).backgroundColor],
      ['unselected filter toggle', unselected, getComputedStyle(unselected).backgroundColor],
      ['test name', testName, getComputedStyle(testName).backgroundColor],
      ['test expand toggle', expandToggle, getComputedStyle(expandToggle).backgroundColor],
    ] as const;

    try {
      for (const [name, target, rest] of targets) {
        await sendMouse({ type: 'move', position: centre(target) });
        expect(getComputedStyle(target).backgroundColor, `${name} hover background`).not.to.equal(rest);
      }
    } finally {
      await resetMouse();
    }
  });
});

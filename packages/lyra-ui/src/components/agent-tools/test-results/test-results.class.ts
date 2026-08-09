import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import { srOnly } from '../../../internal/a11y.js';
import { styles } from './test-results.styles.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_durationMilliseconds, LYRA_DEFAULT_expand, LYRA_DEFAULT_noData, LYRA_DEFAULT_open, LYRA_DEFAULT_statusError, LYRA_DEFAULT_statusRunning, LYRA_DEFAULT_statusSkipped, LYRA_DEFAULT_statusSuccess, LYRA_DEFAULT_testResultsCollapseTest, LYRA_DEFAULT_testResultsCompleteAnnounce, LYRA_DEFAULT_testResultsExpandTest, LYRA_DEFAULT_testResultsFailed, LYRA_DEFAULT_testResultsFilterLabel, LYRA_DEFAULT_testResultsLabel, LYRA_DEFAULT_testResultsPassed, LYRA_DEFAULT_testResultsRunning, LYRA_DEFAULT_testResultsSkipped } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type TestStatus = 'passed' | 'failed' | 'skipped' | 'running';

export interface TestCaseResult {
  id: string;
  name: string;
  status: TestStatus;
  durationMs?: number;
  message?: string;
}

export interface TestSuiteResult {
  id: string;
  name: string;
  tests: TestCaseResult[];
}

const STATUSES: TestStatus[] = ['passed', 'failed', 'skipped', 'running'];

/** localize() key for each status's count-bearing summary/filter text, e.g. "3 passed". */
const STATUS_COUNT_KEY: Record<TestStatus, string> = {
  passed: 'testResultsPassed',
  failed: 'testResultsFailed',
  skipped: 'testResultsSkipped',
  running: 'testResultsRunning',
};

/** localize() key for a single row's visible status word -- reuses the same generic
 *  pending/running/success/error vocabulary `<lr-task-list>`/`<lr-trace-tree>`/
 *  `<lr-tool-call-chip>` already use for their own per-item run status, so a status word
 *  reads consistently across the library rather than introducing test-specific wording. */
const STATUS_LABEL_KEY: Record<TestStatus, string> = {
  passed: 'statusSuccess',
  failed: 'statusError',
  skipped: 'statusSkipped',
  running: 'statusRunning',
};

/** Language-neutral decorative marks; the adjacent localized word carries the status meaning. */
const STATUS_GLYPH: Record<Exclude<TestStatus, 'running'>, string> = {
  passed: '✓',
  failed: '×',
  skipped: '–',
};

/** URI-encode a slot-name segment without throwing on an isolated UTF-16 surrogate. For
 * well-formed strings this is exactly `encodeURIComponent(value)`; malformed code units get their
 * own `%uXXXX` escape so distinct public ids remain distinct instead of crashing or collapsing. */
function encodeDetailSlotSegment(value: string): string {
  let encoded = '';
  for (let index = 0; index < value.length;) {
    const codePoint = value.codePointAt(index)!;
    const character = String.fromCodePoint(codePoint);
    encoded += codePoint >= 0xd800 && codePoint <= 0xdfff
      ? `%u${codePoint.toString(16).toUpperCase().padStart(4, '0')}`
      : encodeURIComponent(character);
    index += character.length;
  }
  return encoded;
}

/** Returns the canonical collision-free rich-detail slot name for one suite/test pair.
 *
 * Well-formed ids use the same segment encoding as `encodeURIComponent`. Isolated UTF-16
 * surrogates, which `encodeURIComponent` rejects, are encoded as uppercase `%uXXXX` code units so
 * every string accepted by the component still has a deterministic, distinct slot name.
 */
export function testResultDetailSlotName(suiteId: string, testId: string): string {
  return `detail-${encodeDetailSlotSegment(suiteId)}:${encodeDetailSlotSegment(testId)}`;
}

export interface LyraTestResultsEventMap {
  'lr-test-select': CustomEvent<{ suiteId: string; testId: string }>;
  'lr-filter-change': CustomEvent<{ statuses: TestStatus[] }>;
  'lr-toggle': CustomEvent<{ id: string; suiteId?: string; expanded: boolean }>;
}

/**
 * `<lr-test-results>` — a pass/fail suite summary with per-status counts, status filter
 * toggles, and per-test rows whose failures auto-expand by default and can host rich slotted
 * detail (e.g. a diff or code block) alongside the plain failure message.
 *
 * @customElement lr-test-results
 * @event lr-test-select - `detail: { suiteId, testId }` — a test row's name was activated.
 * @event lr-filter-change - `detail: { statuses }` — the status-set filter changed.
 * @event lr-toggle - `detail: { id, suiteId?, expanded }` — a row's failure detail was
 *   expanded/collapsed. `suiteId` is included when the test id is not globally unique.
 * @slot detail-{encodedSuiteId}:{encodedTestId} - Collision-free suite-scoped rich detail for a
 *   test. Derive it with `testResultDetailSlotName(suiteId, testId)`; this form takes precedence
 *   over legacy slots.
 * @slot detail-{suiteId}-{testId} - Legacy suite-scoped detail, supported only when its name maps
 *   unambiguously to one suite/test pair and does not collide with another pair's canonical name.
 * @slot detail-{testId} - Legacy rich detail for a test whose id is globally unique across all
 *   suites.
 * @csspart base - The root wrapper; carries `role="group"`. Its `aria-label` defaults to the
 *   localized "Test results", but a host `aria-label` on `<lr-test-results>` itself wins over
 *   that default.
 * @csspart summary - The status-count strip.
 * @csspart count - One status count; carries `data-status`.
 * @csspart filter - The filter-toggle row.
 * @csspart filter-toggle - One status filter toggle; carries `data-status` and `aria-pressed`.
 * @csspart suite - One suite section.
 * @csspart suite-header - The suite's name row.
 * @csspart test - One test row; carries `data-status`.
 * @csspart test-status - A language-neutral decorative status glyph and its localized visible
 *   status-word text; carries `data-status`.
 * @csspart test-name - The activatable test-name button.
 * @csspart test-duration - The duration text.
 * @csspart test-expand-toggle - The expand/collapse button for a row's failure detail. Rendered
 *   for any failed test, or any test with suite-scoped detail content (or the eligible globally
 *   unique legacy `detail-{testId}` form).
 * @csspart failure - The failure-detail wrapper; hidden while collapsed.
 * @csspart failure-message - The failure's plain message text.
 * @cssprop [--lr-test-results-filter-active-bg=var(--lr-color-brand-quiet)] - Background of a pressed
 *   (active) status filter toggle.
 * @cssprop [--lr-test-results-filter-active-border=var(--lr-color-brand)] - Border color of a pressed
 *   (active) status filter toggle.
 * @cssprop [--lr-test-results-filter-active-color=var(--lr-color-brand)] - Text color of a pressed
 *   (active) status filter toggle. Restyling the pressed state otherwise requires overriding the
 *   library-wide brand tokens, since `::part(filter-toggle)[aria-pressed]` is invalid CSS.
 * @cssprop [--lr-test-results-passed-color=var(--lr-color-success)] - Passed-state foreground.
 * @cssprop [--lr-test-results-failed-color=var(--lr-color-danger)] - Failed-state foreground.
 * @cssprop [--lr-test-results-skipped-color=var(--lr-color-text-quiet)] - Skipped-state foreground.
 * @cssprop [--lr-test-results-running-color=var(--lr-color-brand)] - Running-state foreground.
 * @status stable
 * @since 4.0.0
 */
export class LyraTestResults extends LyraElement<LyraTestResultsEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    durationMilliseconds: LYRA_DEFAULT_durationMilliseconds,
    expand: LYRA_DEFAULT_expand,
    noData: LYRA_DEFAULT_noData,
    open: LYRA_DEFAULT_open,
    statusError: LYRA_DEFAULT_statusError,
    statusRunning: LYRA_DEFAULT_statusRunning,
    statusSkipped: LYRA_DEFAULT_statusSkipped,
    statusSuccess: LYRA_DEFAULT_statusSuccess,
    testResultsCollapseTest: LYRA_DEFAULT_testResultsCollapseTest,
    testResultsCompleteAnnounce: LYRA_DEFAULT_testResultsCompleteAnnounce,
    testResultsExpandTest: LYRA_DEFAULT_testResultsExpandTest,
    testResultsFailed: LYRA_DEFAULT_testResultsFailed,
    testResultsFilterLabel: LYRA_DEFAULT_testResultsFilterLabel,
    testResultsLabel: LYRA_DEFAULT_testResultsLabel,
    testResultsPassed: LYRA_DEFAULT_testResultsPassed,
    testResultsRunning: LYRA_DEFAULT_testResultsRunning,
    testResultsSkipped: LYRA_DEFAULT_testResultsSkipped,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];

  /** The suites to render, grouped in order. Controlled and never mutated by this component --
   *  pass a new array (e.g. as a run streams in) to update it. */
  @property({ attribute: false }) suites: TestSuiteResult[] = [];

  /** When non-empty, only tests whose status is in this set are shown. Empty means "show all". */
  @property({ attribute: false }) statusFilter: TestStatus[] = [];

  /** Whether a failed test's detail auto-expands. A row the user has manually toggled always
   *  keeps its own explicit state regardless of this flag. */
  @property({ type: Boolean, attribute: 'auto-expand-failures', converter: trueDefaultBooleanConverter })
  autoExpandFailures = true;

  /** Explicit per-row expand/collapse overrides, keyed by suite+test identity. Absence defers to
   *  `autoExpandFailures`. */
  @state() private manualExpanded = new Map<string, boolean>();

  @query('lr-live-region') private liveRegion?: LyraLiveRegion;

  /** Whether any test across all suites was `running` as of the last `suites` update -- diffed to
   *  detect the running -> not-running transition that triggers the completion announcement. */
  private previouslyRunning = false;
  private readonly idPrefix = nextId('test-results');

  /** Text queued by `willUpdate` for the completion announcement, flushed once the live region
   *  has rendered (it may not exist yet on the very first update). */
  private pendingCompletionAnnouncement: string | null = null;
  /** All canonical and compatibility slot names mapped to the row identities that could consume
   *  them. Rebuilt once per render so an ambiguous legacy name is never mounted on two rows (or
   *  allowed to steal another row's canonical content). */
  private detailSlotOwners = new Map<string, Set<string>>();

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('suites')) {
      const anyRunning = this.suites.some((suite) => suite.tests.some((t) => t.status === 'running'));
      if (this.previouslyRunning && !anyRunning) {
        const number = getNumberFormat(this.effectiveLocale);
        this.pendingCompletionAnnouncement = this.localize('testResultsCompleteAnnounce', undefined, {
          passed: number.format(this.countOf('passed')),
          failed: number.format(this.countOf('failed')),
          skipped: number.format(this.countOf('skipped')),
        });
      }
      this.previouslyRunning = anyRunning;
    }
  }

  protected override updated(): void {
    if (this.pendingCompletionAnnouncement !== null) {
      const text = this.pendingCompletionAnnouncement;
      this.pendingCompletionAnnouncement = null;
      // A discrete, one-off lifecycle transition (a run finishing) rather than a rapid stream --
      // force so it lands immediately instead of waiting out the live region's default throttle.
      this.liveRegion?.announce(text, { force: true });
    }
  }

  private countOf(status: TestStatus): number {
    return this.suites.reduce((n, suite) => n + suite.tests.filter((t) => t.status === status).length, 0);
  }

  private testKey(suiteId: string, testId: string): string {
    return JSON.stringify([suiteId, testId]);
  }

  private scopedDetailSlot(suiteId: string, testId: string): string {
    return testResultDetailSlotName(suiteId, testId);
  }

  private legacyScopedDetailSlot(suiteId: string, testId: string): string {
    return `detail-${suiteId}-${testId}`;
  }

  private rebuildDetailSlotOwners(): void {
    const rows = this.suites.flatMap((suite) =>
      suite.tests.map((test) => ({ suiteId: suite.id, testId: test.id })),
    );
    const testIdCounts = new Map<string, number>();
    for (const { testId } of rows) testIdCounts.set(testId, (testIdCounts.get(testId) ?? 0) + 1);

    const owners = new Map<string, Set<string>>();
    const add = (name: string, owner: string): void => {
      const existing = owners.get(name) ?? new Set<string>();
      existing.add(owner);
      owners.set(name, existing);
    };
    for (const { suiteId, testId } of rows) {
      const owner = this.testKey(suiteId, testId);
      add(this.scopedDetailSlot(suiteId, testId), owner);
      add(this.legacyScopedDetailSlot(suiteId, testId), owner);
      if (testIdCounts.get(testId) === 1) add(`detail-${testId}`, owner);
    }
    this.detailSlotOwners = owners;
  }

  private unambiguousLegacySlot(name: string, suiteId: string, testId: string): string | null {
    const owners = this.detailSlotOwners.get(name);
    return owners?.size === 1 && owners.has(this.testKey(suiteId, testId)) ? name : null;
  }

  private isGloballyUniqueTestId(testId: string): boolean {
    let count = 0;
    for (const suite of this.suites) {
      for (const test of suite.tests) {
        if (test.id === testId && ++count > 1) return false;
      }
    }
    return count === 1;
  }

  private hasSlottedChild(name: string): boolean {
    return [...this.children].some((child) => child.getAttribute('slot') === name);
  }

  private hasDetail(suiteId: string, testId: string): boolean {
    const scopedSlot = this.scopedDetailSlot(suiteId, testId);
    const legacyScopedSlot = this.unambiguousLegacySlot(
      this.legacyScopedDetailSlot(suiteId, testId),
      suiteId,
      testId,
    );
    const legacyTestSlot = this.isGloballyUniqueTestId(testId)
      ? this.unambiguousLegacySlot(`detail-${testId}`, suiteId, testId)
      : null;
    return (
      this.hasSlottedChild(scopedSlot) ||
      (legacyScopedSlot !== null && legacyScopedSlot !== scopedSlot && this.hasSlottedChild(legacyScopedSlot)) ||
      (legacyTestSlot !== null &&
        legacyTestSlot !== scopedSlot &&
        legacyTestSlot !== legacyScopedSlot &&
        this.hasSlottedChild(legacyTestSlot))
    );
  }

  private isExpanded(suiteId: string, test: TestCaseResult): boolean {
    const manual = this.manualExpanded.get(this.testKey(suiteId, test.id));
    if (manual !== undefined) return manual;
    return this.autoExpandFailures && test.status === 'failed';
  }

  private toggleFilter(status: TestStatus): void {
    const next = this.statusFilter.includes(status)
      ? this.statusFilter.filter((s) => s !== status)
      : [...this.statusFilter, status];
    this.statusFilter = next;
    this.emit('lr-filter-change', { statuses: next });
  }

  private toggleExpanded(suiteId: string, test: TestCaseResult): void {
    const expanded = !this.isExpanded(suiteId, test);
    const next = new Map(this.manualExpanded);
    next.set(this.testKey(suiteId, test.id), expanded);
    this.manualExpanded = next;
    this.emit(
      'lr-toggle',
      this.isGloballyUniqueTestId(test.id)
        ? { id: test.id, expanded }
        : { id: test.id, suiteId, expanded },
    );
  }

  private onDetailSlotChange(): void {
    this.requestUpdate();
  }

  private renderSummary(): TemplateResult {
    return html`
      <div part="summary">
        ${STATUSES.map((status) => {
          const count = this.countOf(status);
          const formattedCount = getNumberFormat(this.effectiveLocale).format(count);
          return html`<span part="count" data-status=${status}
            >${this.localize(STATUS_COUNT_KEY[status], undefined, { count: formattedCount })}</span
          >`;
        })}
      </div>
      <div part="filter" role="group" aria-label=${this.localize('testResultsFilterLabel')}>
        ${STATUSES.map((status) => {
          const count = this.countOf(status);
          const formattedCount = getNumberFormat(this.effectiveLocale).format(count);
          return html`
            <button
              part="filter-toggle"
              type="button"
              data-status=${status}
              aria-pressed=${this.statusFilter.includes(status) ? 'true' : 'false'}
              @click=${() => this.toggleFilter(status)}
            >
              ${this.localize(STATUS_COUNT_KEY[status], undefined, { count: formattedCount })}
            </button>
          `;
        })}
      </div>
    `;
  }

  private renderTest(
    suiteId: string,
    suiteName: string,
    test: TestCaseResult,
    suiteIndex: number,
    testIndex: number,
  ): TemplateResult {
    // `manualExpanded` looks up by suite+test identity, so a row's manual expand/collapse
    // survives the suite's tests being reordered or having a new test inserted above it -- a
    // positional key would silently reattach one test's override to whichever test now sits at
    // that same index. DOM ids below stay positional (not test.id), since test.id can repeat
    // across suites or contain characters that aren't valid in an HTML id.
    const expanded = this.isExpanded(suiteId, test);
    const scopedSlot = this.scopedDetailSlot(suiteId, test.id);
    const scopedDetail = this.hasSlottedChild(scopedSlot);
    const legacyScopedCandidate = this.legacyScopedDetailSlot(suiteId, test.id);
    const legacyScopedSlot =
      legacyScopedCandidate === scopedSlot
        ? null
        : this.unambiguousLegacySlot(legacyScopedCandidate, suiteId, test.id);
    const legacyScopedDetail =
      legacyScopedSlot !== null && this.hasSlottedChild(legacyScopedSlot);
    const legacyTestCandidate = `detail-${test.id}`;
    const legacyTestSlot =
      this.isGloballyUniqueTestId(test.id) &&
      legacyTestCandidate !== scopedSlot &&
      legacyTestCandidate !== legacyScopedSlot
        ? this.unambiguousLegacySlot(legacyTestCandidate, suiteId, test.id)
        : null;
    const canExpand = test.status === 'failed' || this.hasDetail(suiteId, test.id);
    const domKey = `${suiteIndex}-${testIndex}`;
    const failureId = `${this.idPrefix}-${domKey}-failure`;
    const statusId = `${this.idPrefix}-${domKey}-status`;
    const toggleName = this.localize(expanded ? 'testResultsCollapseTest' : 'testResultsExpandTest', undefined, {
      name: `${suiteName}: ${test.name}`,
    });
    return html`
      <div part="test" role="listitem" data-status=${test.status}>
        <span part="test-status" id=${statusId} data-status=${test.status}>
          ${test.status === 'running'
            ? html`<span aria-hidden="true"><lr-spinner></lr-spinner></span>`
            : html`<span aria-hidden="true">${STATUS_GLYPH[test.status]}</span>`}
          ${this.localize(STATUS_LABEL_KEY[test.status])}
        </span>
        <button
          part="test-name"
          type="button"
          aria-describedby=${statusId}
          @click=${() => this.emit('lr-test-select', { suiteId, testId: test.id })}
        >
          ${test.name}
        </button>
        ${typeof test.durationMs === 'number' && Number.isFinite(test.durationMs) && test.durationMs >= 0
          ? html`<span part="test-duration"
              >${this.localize('durationMilliseconds', undefined, {
                value: getNumberFormat(this.effectiveLocale).format(test.durationMs),
              })}</span
            >`
          : nothing}
        ${canExpand
          ? html`<button
              part="test-expand-toggle"
              type="button"
              aria-expanded=${expanded ? 'true' : 'false'}
              aria-controls=${failureId}
              aria-label=${toggleName}
              @click=${() => this.toggleExpanded(suiteId, test)}
            >
              ${expanded ? this.localize('collapse') : this.localize('expand')}
            </button>`
          : nothing}
        <div part="failure" id=${failureId} ?hidden=${!canExpand || !expanded}>
          ${test.message ? html`<div part="failure-message">${test.message}</div>` : nothing}
          <slot name=${scopedSlot} @slotchange=${this.onDetailSlotChange}></slot>
          ${legacyScopedSlot
            ? html`<slot
                name=${legacyScopedSlot}
                ?hidden=${scopedDetail}
                @slotchange=${this.onDetailSlotChange}
              ></slot>`
            : nothing}
          ${legacyTestSlot
            ? html`<slot
                name=${legacyTestSlot}
                ?hidden=${scopedDetail || legacyScopedDetail}
                @slotchange=${this.onDetailSlotChange}
              ></slot>`
            : nothing}
        </div>
      </div>
    `;
  }

  private renderSuite(suite: TestSuiteResult, suiteIndex: number): TemplateResult | typeof nothing {
    const visibleTests = suite.tests
      .map((test, testIndex) => ({ test, testIndex }))
      .filter(({ test }) => this.statusFilter.length === 0 || this.statusFilter.includes(test.status));
    if (visibleTests.length === 0) return nothing;
    return html`
      <div part="suite">
        <div part="suite-header">${suite.name}</div>
        <div role="list" aria-label=${suite.name}
          >${visibleTests.map(({ test, testIndex }) =>
            this.renderTest(suite.id, suite.name, test, suiteIndex, testIndex))}</div
        >
      </div>
    `;
  }

  override render(): TemplateResult {
    this.rebuildDetailSlotOwners();
    const ariaLabel = this.getAttribute('aria-label') || this.localize('testResultsLabel');
    return html`
      ${this.suites.length === 0
        ? html`<lr-empty heading=${this.localize('noData')}></lr-empty>`
        : html`
            <div part="base" role="group" aria-label=${ariaLabel}>
              ${this.renderSummary()} ${this.suites.map((suite, index) => this.renderSuite(suite, index))}
            </div>
          `}
      <lr-live-region mode="polite"></lr-live-region>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-test-results': LyraTestResults;
  }
}

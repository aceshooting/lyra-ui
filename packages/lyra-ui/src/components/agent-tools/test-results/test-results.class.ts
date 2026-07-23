import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import { srOnly } from '../../../internal/a11y.js';
import { styles } from './test-results.styles.js';
// The registering barrels (not the bare *.class.js modules) -- this side effect is what
// actually defines <lr-empty>/<lr-spinner>/<lr-live-region> as custom elements by the
// time this component's render() references them.
import '../../overlays/empty/empty.js';
import '../../overlays/spinner/spinner.js';
import '../../utility/live-region/live-region.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';

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

export interface LyraTestResultsEventMap {
  'lr-test-select': CustomEvent<{ suiteId: string; testId: string }>;
  'lr-filter-change': CustomEvent<{ statuses: TestStatus[] }>;
  'lr-toggle': CustomEvent<{ id: string; expanded: boolean }>;
}

/**
 * `<lr-test-results>` — a pass/fail suite summary with per-status counts, status filter
 * toggles, and per-test rows whose failures auto-expand by default and can host rich slotted
 * detail (e.g. a diff or code block) alongside the plain failure message.
 *
 * @customElement lr-test-results
 * @event lr-test-select - `detail: { suiteId, testId }` — a test row's name was activated.
 * @event lr-filter-change - `detail: { statuses }` — the status-set filter changed.
 * @event lr-toggle - `detail: { id, expanded }` — a row's failure detail was expanded/collapsed.
 * @slot detail-{testId} - Rich failure detail for that test, rendered after its plain message
 *   text once the row is expanded.
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
 * @csspart test-status - The status glyph and its visible status-word text; carries `data-status`.
 * @csspart test-name - The activatable test-name button.
 * @csspart test-duration - The duration text.
 * @csspart test-expand-toggle - The expand/collapse button for a row's failure detail. Rendered
 *   for any failed test, or any test with slotted `detail-{testId}` content.
 * @csspart failure - The failure-detail wrapper; hidden while collapsed.
 * @csspart failure-message - The failure's plain message text.
 * @cssprop [--lr-test-results-filter-active-bg=var(--lr-color-brand-quiet)] - Background of a pressed
 *   (active) status filter toggle.
 * @cssprop [--lr-test-results-filter-active-border=var(--lr-color-brand)] - Border color of a pressed
 *   (active) status filter toggle.
 * @cssprop [--lr-test-results-filter-active-color=var(--lr-color-brand)] - Text color of a pressed
 *   (active) status filter toggle. Restyling the pressed state otherwise requires overriding the
 *   library-wide brand tokens, since `::part(filter-toggle)[aria-pressed]` is invalid CSS.
 */
export class LyraTestResults extends LyraElement<LyraTestResultsEventMap> {
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

  /** Explicit per-row expand/collapse overrides, keyed by test id. Absence defers to
   *  `autoExpandFailures`. */
  @state() private manualExpanded = new Map<string, boolean>();

  /** Test ids known to carry slotted `detail-{id}` content, so their expand toggle renders even
   *  when the test itself didn't fail. */
  @state() private hasDetailSlot = new Set<string>();

  @query('lr-live-region') private liveRegion?: LyraLiveRegion;

  /** Whether any test across all suites was `running` as of the last `suites` update -- diffed to
   *  detect the running -> not-running transition that triggers the completion announcement. */
  private previouslyRunning = false;
  private readonly idPrefix = nextId('test-results');

  /** Text queued by `willUpdate` for the completion announcement, flushed once the live region
   *  has rendered (it may not exist yet on the very first update). */
  private pendingCompletionAnnouncement: string | null = null;

  protected override willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated || changed.has('suites')) {
      // Seed from light-DOM children up front, mirroring `<lr-widget>`'s `hasActionsSlot`
      // bootstrap: a `slotchange` event alone can't discover slotted detail content for a test
      // that isn't expanded yet, since the `<slot>` element itself only exists once expanded --
      // and `canExpand` needs to know about slotted content *before* that first expand.
      const next = new Set(this.hasDetailSlot);
      for (const child of this.children) {
        const slotAttr = child.getAttribute('slot');
        if (slotAttr?.startsWith('detail-')) next.add(slotAttr.slice('detail-'.length));
      }
      this.hasDetailSlot = next;
    }
    if (changed.has('suites')) {
      const anyRunning = this.suites.some((suite) => suite.tests.some((t) => t.status === 'running'));
      if (this.previouslyRunning && !anyRunning) {
        this.pendingCompletionAnnouncement = this.localize('testResultsCompleteAnnounce', undefined, {
          passed: this.countOf('passed'),
          failed: this.countOf('failed'),
          skipped: this.countOf('skipped'),
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

  private isExpanded(testKey: string, test: TestCaseResult): boolean {
    const manual = this.manualExpanded.get(testKey);
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

  private toggleExpanded(testKey: string, test: TestCaseResult): void {
    const expanded = !this.isExpanded(testKey, test);
    const next = new Map(this.manualExpanded);
    next.set(testKey, expanded);
    this.manualExpanded = next;
    this.emit('lr-toggle', { id: test.id, expanded });
  }

  private onDetailSlotChange(testId: string, e: Event): void {
    const has = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
    if (has === this.hasDetailSlot.has(testId)) return;
    const next = new Set(this.hasDetailSlot);
    if (has) next.add(testId);
    else next.delete(testId);
    this.hasDetailSlot = next;
  }

  private renderSummary(): TemplateResult {
    return html`
      <div part="summary">
        ${STATUSES.map((status) => {
          const count = this.countOf(status);
          return html`<span part="count" data-status=${status}
            >${this.localize(STATUS_COUNT_KEY[status], undefined, { count })}</span
          >`;
        })}
      </div>
      <div part="filter" role="group" aria-label=${this.localize('testResultsFilterLabel')}>
        ${STATUSES.map((status) => {
          const count = this.countOf(status);
          return html`
            <button
              part="filter-toggle"
              type="button"
              data-status=${status}
              aria-pressed=${this.statusFilter.includes(status) ? 'true' : 'false'}
              @click=${() => this.toggleFilter(status)}
            >
              ${this.localize(STATUS_COUNT_KEY[status], undefined, { count })}
            </button>
          `;
        })}
      </div>
    `;
  }

  private renderTest(suiteId: string, test: TestCaseResult, suiteIndex: number, testIndex: number): TemplateResult {
    const testKey = `${suiteIndex}-${testIndex}`;
    const expanded = this.isExpanded(testKey, test);
    const canExpand = test.status === 'failed' || this.hasDetailSlot.has(test.id);
    const failureId = `${this.idPrefix}-${testKey}-failure`;
    const statusId = `${this.idPrefix}-${testKey}-status`;
    return html`
      <div part="test" role="listitem" data-status=${test.status}>
        <span part="test-status" id=${statusId} data-status=${test.status}>
          ${test.status === 'running'
            ? html`<span aria-hidden="true"><lr-spinner></lr-spinner></span>`
            : html`<span aria-hidden="true">${test.status.charAt(0).toUpperCase()}</span>`}
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
        ${test.durationMs !== undefined
          ? html`<span part="test-duration"
              >${this.localize('durationMilliseconds', undefined, { value: test.durationMs })}</span
            >`
          : nothing}
        ${canExpand
          ? html`<button
              part="test-expand-toggle"
              type="button"
              aria-expanded=${expanded ? 'true' : 'false'}
              aria-controls=${failureId}
              @click=${() => this.toggleExpanded(testKey, test)}
            >
              ${expanded ? this.localize('collapse') : this.localize('expand')}
            </button>`
          : nothing}
        ${canExpand
          ? html`<div part="failure" id=${failureId} ?hidden=${!expanded}>
              ${test.message ? html`<div part="failure-message">${test.message}</div>` : nothing}
              <slot
                name=${`detail-${test.id}`}
                @slotchange=${(e: Event) => this.onDetailSlotChange(test.id, e)}
              ></slot>
            </div>`
          : nothing}
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
          >${visibleTests.map(({ test, testIndex }) => this.renderTest(suite.id, test, suiteIndex, testIndex))}</div
        >
      </div>
    `;
  }

  override render(): TemplateResult {
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

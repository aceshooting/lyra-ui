import type { LyraPageSource, LyraSourceRecord } from '../../../data-sources.js';
import { SourcePageController } from '../../../internal/source-page-controller.js';
import { finiteInteger } from '../../../internal/numbers.js';
import { collectionSupport } from '../../../internal/collection-snapshot.js';
import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import { srOnly } from '../../../internal/a11y.js';
import { styles } from './test-results.styles.js';
import { testResultDetailSlotName } from './test-results-slots.js';
export { testResultDetailSlotName } from './test-results-slots.js';
import { agentActionButtonStyles } from '../agent-action-button.styles.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { formatShortDuration } from '../../../internal/duration.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { overallSemanticLabel, overallSemanticRole } from '../semantic-owner.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_accessibleLabelSeparator, LYRA_DEFAULT_statusSkipped, LYRA_DEFAULT_testResultsCollapseTest, LYRA_DEFAULT_testResultsCompleteAnnounce, LYRA_DEFAULT_testResultsExpandTest, LYRA_DEFAULT_testResultsFailed, LYRA_DEFAULT_testResultsFilterLabel, LYRA_DEFAULT_testResultsInputTooLarge, LYRA_DEFAULT_testResultsLabel, LYRA_DEFAULT_testResultsLimit, LYRA_DEFAULT_testResultsPassed, LYRA_DEFAULT_testResultsRunning, LYRA_DEFAULT_testResultsSkipped } from '../../../internal/default-strings/agent-tools.generated.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_copy, LYRA_DEFAULT_date, LYRA_DEFAULT_details, LYRA_DEFAULT_durationMilliseconds, LYRA_DEFAULT_durationSeconds, LYRA_DEFAULT_expand, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_noData, LYRA_DEFAULT_noMatches, LYRA_DEFAULT_open, LYRA_DEFAULT_retry, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_statusError, LYRA_DEFAULT_statusRunning, LYRA_DEFAULT_statusSuccess, LYRA_DEFAULT_tableLoadFailed } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type TestStatus = 'passed' | 'failed' | 'skipped' | 'running';
export type TestRunState = 'idle' | 'running' | 'complete';

export interface TestCaseResult {
  id: string;
  name: string;
  /** Foreign runtime values normalize once: `error`/`timedOut`/`broken` to `failed`, any other to `skipped`. */
  status: TestStatus;
  durationMs?: number;
  message?: string;
}

export interface TestSuiteResult {
  id: string;
  name: string;
  tests: readonly TestCaseResult[];
}

export interface TestResultsSourceQuery { readonly statuses: readonly TestStatus[]; }
export interface TestResultsSourceRow { readonly suiteId: string; readonly suiteName: string; readonly test: TestCaseResult; }
export interface TestResultsSourceSummary { readonly total: number; readonly passed: number; readonly failed: number; readonly skipped: number; readonly running: number; }
export type TestResultsSource = LyraPageSource<TestResultsSourceRow, TestResultsSourceQuery, TestResultsSourceSummary>;

function sourceField(value: unknown, name: string): unknown {
  if (!value || typeof value !== 'object') throw new TypeError('Invalid result');
  const descriptor = Object.getOwnPropertyDescriptor(value, name);
  if (descriptor && !('value' in descriptor)) throw new TypeError('Invalid result field');
  return descriptor?.value;
}
function checkRowText(suiteId: string, suiteName: string, test: TestCaseResult): void {
  if (suiteId.length + suiteName.length + test.id.length + test.name.length + (test.message?.length ?? 0) > 65_536) throw new RangeError('Result text limit');
}

const STATUSES: TestStatus[] = ['passed', 'failed', 'skipped', 'running'];
const MAX_RENDERED_TESTS = 1_000;

/** Provider payloads can bypass the compile-time union. `error`, `timedOut` and `broken` count as
 * `failed`; other unknown states use the neutral, non-success `skipped` fallback, so every accepted
 * row retains a visible localized status and participates in exactly one summary count. */
function normalizeTestStatus(value: unknown): TestStatus {
  switch (value) {
    case 'passed':
    case 'failed':
    case 'skipped':
    case 'running':
      return value;
    case 'error':
    case 'timedOut':
    case 'broken':
      return 'failed';
    default:
      return 'skipped';
  }
}

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

export interface LyraTestResultsEventMap {
  'lr-test-select': CustomEvent<{ suiteId: string; testId: string }>;
  'lr-filter-change': CustomEvent<LyraEventDetailSnapshot<{ statuses: TestStatus[] }>>;
  'lr-toggle-request': CustomEvent<{ suiteId: string; testId: string; expanded: boolean }>;
  'lr-toggle': CustomEvent<{ suiteId: string; testId: string; expanded: boolean }>;
}

/**
 * `<lr-test-results>` — a pass/fail suite summary with per-status counts, status filter
 * toggles, and per-test rows whose failures auto-expand by default and can host rich slotted
 * detail (e.g. a diff or code block) alongside the plain failure message.
 * Empty/blank suite and test ids are omitted and duplicates use first-wins identity. At most 1,000
 * uniquely identified suite/test rows are mounted. Manually expanded identities and
 * failures reserve positions before ordinary input-order rows, while the four summary counts cover
 * the complete normalized input. Foreign runtime statuses normalize once to the localized neutral
 * `skipped` fallback. Completion announcements require an explicit same-`runId`
 * `runState="running"` -> `"complete"` transition; clearing data alone is not treated as a
 * completed run.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-test-results
 * @event lr-test-select - `detail: { suiteId, testId }` — a test row's name was activated.
 * @event lr-filter-change - `detail: { statuses }` — the status-set filter changed.
 * @event lr-toggle-request - Cancelable proposal before a row's failure detail changes. `detail: { suiteId, testId, expanded }`
 *   is the requested state.
 * @event lr-toggle - `detail: { suiteId, testId, expanded }` — a row's failure detail was
 *   expanded/collapsed. The identity shape is invariant even when `testId` is globally unique.
 * @slot detail-{encodedSuiteId}:{encodedTestId} - Collision-free suite-scoped rich detail for a
 *   test, and the only detail slot this component reads. Derive it with
 *   `testResultDetailSlotName(suiteId, testId)` rather than assembling it by hand. The legacy
 *   `detail-{suiteId}-{testId}` and `detail-{testId}` spellings were removed in 9.0.0; content
 *   assigned to either is simply never slotted.
 * @csspart base - The root wrapper; carries the localized "Test results" `role="group"` semantics
 *   unless a non-empty host `aria-label` already makes the host the overall semantic owner.
 *   Explicit `aria-label=""` remains empty instead of restoring the fallback.
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
 * @csspart test-expand-toggle - The expand/collapse button for a row's failure detail. Its
 *   accessible name joins the suite and test name with the localized
 *   `accessibleLabelSeparator`. Rendered for any failed test, or any test with canonical
 *   suite-scoped detail content.
 * @csspart failure - The failure-detail wrapper; hidden while collapsed.
 * @csspart failure-message - The failure's plain message text.
 * @csspart limit - Localized resource-ceiling notice.
 * @csspart empty - Empty/no-match state, including a populated run hidden entirely by filters.
 * @cssprop [--lr-test-results-filter-active-bg=var(--lr-color-brand-quiet)] - Background of a pressed
 *   (active) status filter toggle, and the base its hover/press mixes from.
 * @cssprop [--lr-test-results-filter-active-border=var(--lr-color-brand)] - Border color of a pressed
 *   (active) status filter toggle.
 * @cssprop [--lr-test-results-filter-active-color=var(--lr-color-brand)] - Text color of a pressed
 *   (active) status filter toggle. Restyling the pressed state otherwise requires overriding the
 *   library-wide brand tokens, since `::part(filter-toggle)[aria-pressed]` is invalid CSS.
 * @cssprop [--lr-test-results-passed-color=var(--lr-color-success)] - Passed-state foreground.
 * @cssprop [--lr-test-results-failed-color=var(--lr-color-danger)] - Failed-state foreground.
 * @cssprop [--lr-test-results-skipped-color=var(--lr-color-text-quiet)] - Skipped-state foreground.
 * @cssprop [--lr-test-results-running-color=var(--lr-color-brand)] - Running-state foreground.
 * @cssprop [--lr-test-results-spinner-size=var(--lr-size-1em)] - Diameter of the composed spinner
 *   in a running test row.
 * @csspart source-status - Provider loading or failure message.
 * @csspart source-retry - Retry the current failed provider request.
 * @csspart source-pagination - Provider page controls.
 * @csspart input-error - Oversized legacy result input message.
 * @status stable
 * @since 4.0.0
 */
export class LyraTestResults extends LyraElement<LyraTestResultsEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    accessibleLabelSeparator: LYRA_DEFAULT_accessibleLabelSeparator,
    collapse: LYRA_DEFAULT_collapse,
    copy: LYRA_DEFAULT_copy,
    date: LYRA_DEFAULT_date,
    details: LYRA_DEFAULT_details,
    durationMilliseconds: LYRA_DEFAULT_durationMilliseconds,
    durationSeconds: LYRA_DEFAULT_durationSeconds,
    expand: LYRA_DEFAULT_expand,
    loading: LYRA_DEFAULT_loading,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    noData: LYRA_DEFAULT_noData,
    noMatches: LYRA_DEFAULT_noMatches,
    open: LYRA_DEFAULT_open,
    retry: LYRA_DEFAULT_retry,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    statusError: LYRA_DEFAULT_statusError,
    statusRunning: LYRA_DEFAULT_statusRunning,
    statusSkipped: LYRA_DEFAULT_statusSkipped,
    statusSuccess: LYRA_DEFAULT_statusSuccess,
    tableLoadFailed: LYRA_DEFAULT_tableLoadFailed,
    testResultsCollapseTest: LYRA_DEFAULT_testResultsCollapseTest,
    testResultsCompleteAnnounce: LYRA_DEFAULT_testResultsCompleteAnnounce,
    testResultsExpandTest: LYRA_DEFAULT_testResultsExpandTest,
    testResultsFailed: LYRA_DEFAULT_testResultsFailed,
    testResultsFilterLabel: LYRA_DEFAULT_testResultsFilterLabel,
    testResultsInputTooLarge: LYRA_DEFAULT_testResultsInputTooLarge,
    testResultsLabel: LYRA_DEFAULT_testResultsLabel,
    testResultsLimit: LYRA_DEFAULT_testResultsLimit,
    testResultsPassed: LYRA_DEFAULT_testResultsPassed,
    testResultsRunning: LYRA_DEFAULT_testResultsRunning,
    testResultsSkipped: LYRA_DEFAULT_testResultsSkipped,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze(['suites', 'statusFilter']);
  /** Each suite (and its nested tests) is caller-owned data -- only the outer sequence is
   *  bounded/detached/frozen. A generic structural clone would silently drop an accessor-defined
   *  `status` (no data descriptor to copy) before `rebuildNormalizedSuites()` ever saw it, so a
   *  foreign provider's status would default to `skipped` without the single normalizing read the
   *  class contract promises. Preserving item identity keeps the real property live for that one
   *  read. */
  protected static override readonly identityCollectionProperties = Object.freeze(['suites']);

  static override styles = [LyraElement.styles, styles, srOnly, agentActionButtonStyles];

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-filter-change',
  ]);

  /** The suites to render, grouped in order. Controlled and never mutated by this component --
   *  pass a new array (e.g. as a run streams in) to update it. Duplicate suite ids and per-suite
   *  test ids use deterministic first-wins identity. Assign a new array to update: mutating an array and assigning it again does not. */
  @property({ attribute: false }) suites: readonly TestSuiteResult[] = [];

  private _dataSource?: TestResultsSource;
  private sourceEpoch = 0;
  private sourceSyncing = false;
  private sourceInputs?: readonly unknown[];
  private sourceSize?: number;
  private sourceFilter?: string;
  private sourceExpanded = new Map<string, boolean>();
  @state() private sourceVersion = 0;
  private readonly sourcePages = new SourcePageController<TestResultsSourceRow, TestResultsSourceQuery, TestResultsSourceSummary>(this, {
    normalizeRecord: (record, isCurrent) => this.normalizeSourceRecord(record, isCurrent),
    normalizeSummary: value => {
      const counts = Object.fromEntries(['total', ...STATUSES].map(key => {
        const count = sourceField(value, key);
        if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) throw new TypeError('Invalid summary');
        return [key, count];
      })) as unknown as TestResultsSourceSummary;
      const sum = STATUSES.reduce((total, status) => total + counts[status], 0);
      if (!Number.isSafeInteger(sum) || sum !== counts.total) throw new TypeError('Inconsistent summary');
      return Object.freeze(counts);
    },
    validateMetadata: (result, query) => {
      const summary = result.summary!;
      if (result.total !== (query.statuses.length ? query.statuses.reduce((sum, status) => sum + summary[status], 0) : summary.total)) throw new TypeError('Inconsistent total');
      const counts = { passed: 0, failed: 0, skipped: 0, running: 0 };
      for (const row of result.rows) {
        const status = row.value.test.status;
        if (query.statuses.length && !query.statuses.includes(status)) throw new TypeError('Unexpected status');
        if (++counts[status] > summary[status]) throw new TypeError('Inconsistent status count');
      }
    },
    onChange: () => { this.sourceVersion++; },
  });

  /** Complete result provider; undefined restores suites. Same-source assignment refreshes. */
  @property({ attribute: false })
  get dataSource(): TestResultsSource | undefined { return this._dataSource; }
  set dataSource(value: TestResultsSource | undefined) {
    const old = this._dataSource; this._dataSource = value; this.sourceEpoch++;
    this.pendingCompletionRun = undefined;
    this.requestUpdate('dataSource', old);
  }
  /** Zero-based provider page. */
  @property({ type: Number, attribute: 'source-page' }) sourcePage = 0;
  /** Provider page size, normalized to 1..500; changes reset the page. */
  @property({ type: Number, attribute: 'source-page-size' }) sourcePageSize = 100;
  /** Exact current filtered count, or null while unavailable. */
  get sourceTotal(): number | null { return this.sourceMode ? this.sourcePages.state.result?.total ?? null : null; }
  private get sourceMode(): boolean { return this.dataSource !== undefined; }

  private normalizeSourceRecord(record: LyraSourceRecord<unknown>, isCurrent: () => boolean): LyraSourceRecord<TestResultsSourceRow> {
    const field = (input: unknown, key: string): unknown => {
      if (!isCurrent()) throw new Error('Obsolete source result');
      const value = sourceField(input, key);
      if (!isCurrent()) throw new Error('Obsolete source result');
      return value;
    };
    const text = (value: unknown): string => { if (typeof value !== 'string') throw new TypeError('Invalid text'); return value; };
    const suiteId = text(field(record.value, 'suiteId'));
    const suiteName = text(field(record.value, 'suiteName'));
    const raw = field(record.value, 'test');
    const id = text(field(raw, 'id'));
    const name = text(field(raw, 'name'));
    const messageValue = field(raw, 'message');
    const duration = field(raw, 'durationMs');
    const test = Object.freeze({ id, name, status: normalizeTestStatus(field(raw, 'status')),
      ...(messageValue === undefined ? {} : { message: text(messageValue) }),
      ...(typeof duration === 'number' ? { durationMs: duration } : {}) });
    checkRowText(suiteId, suiteName, test);
    if (!suiteId.trim() || !id.trim() || record.key !== this.testKey(suiteId, id)) throw new TypeError('Invalid result identity');
    return { key: record.key, order: record.order, value: Object.freeze({ suiteId, suiteName, test }) };
  }

  private syncSource(): void {
    if (!this.sourcePages || this.sourceSyncing) return;
    this.sourceSyncing = true;
    try {
      if (!this.sourceMode) {
        if (this.sourceInputs) this.sourcePages.bind(undefined);
        this.sourceInputs = undefined; this.sourceSize = undefined; this.sourceFilter = undefined;
        return;
      }
      const source = this.dataSource!;
      const statuses = [...new Set(this.statusFilter)];
      if (statuses.some(status => !STATUSES.includes(status))) throw new TypeError('Invalid filter');
      const filter = JSON.stringify(statuses);
      const size = finiteInteger(this.sourcePageSize, 100, 1, 500);
      let page = finiteInteger(this.sourcePage, 0, 0, Math.floor(Number.MAX_SAFE_INTEGER / size));
      if ((this.sourceSize !== undefined && this.sourceSize !== size) || (this.sourceFilter !== undefined && this.sourceFilter !== filter)) { page = 0; this.sourcePage = 0; }
      this.sourceSize = size; this.sourceFilter = filter;
      const epoch = this.sourceEpoch;
      const revision = source.revision;
      if (this.dataSource !== source || this.sourceEpoch !== epoch) return;
      const inputs = [source, revision, this.sourceEpoch, this.effectiveLocale, size, filter, page];
      if (this.sourceInputs && inputs.every((value, index) => value === this.sourceInputs![index])) return;
      this.cancelLegacy();
      this.sourceInputs = inputs; this.sourceExpanded.clear();
      this.sourcePages.bind({ source, revision, epoch: this.sourceEpoch, locale: this.effectiveLocale });
      void this.sourcePages.request(Object.freeze({ statuses: Object.freeze(statuses) }), page, size);
    } catch { this.sourcePages.bind(undefined); this.sourceInputs = undefined; this.sourceExpanded.clear(); }
    finally { this.sourceSyncing = false; }
  }

  override requestUpdate(...args: Parameters<LyraElement['requestUpdate']>): void {
    if (args[0] === 'suites' && this.legacyGeneration !== undefined) {
      this.cancelLegacy();
      this.legacyNeedsNormalization = true;
      if (!this.legacyIntentScheduled) {
        this.legacyIntentScheduled = true;
        queueMicrotask(() => {
          this.legacyIntentScheduled = false;
          if (this.legacyNeedsNormalization && !this.sourceMode && this.isConnected) this.requestUpdate('legacyNeedsNormalization');
        });
      }
    }
    if ((args[0] === 'runState' && this.runState !== 'complete') || args[0] === 'runId') this.pendingCompletionRun = undefined;
    if (args[0] === undefined) this.sourceEpoch = (this.sourceEpoch ?? 0) + 1;
    if (args[0] === undefined || ['dataSource', 'sourcePage', 'sourcePageSize', 'statusFilter'].includes(String(args[0]))) this.syncSource();
    super.requestUpdate(...args);
  }

  /** When non-empty, only tests whose status is in this set are shown. Empty means "show all". */
  @property({ attribute: false }) statusFilter: readonly TestStatus[] = [];

  /** Stable source-run identity used to correlate lifecycle announcements. */
  @property({ attribute: 'run-id' }) runId: string | null = null;

  /** Explicit source-run lifecycle; only a same-id running -> complete transition announces. */
  @property({ attribute: 'run-state', reflect: true }) runState: TestRunState = 'idle';

  /** Keeps a failed test's detail collapsed until the user expands it, instead of auto-expanding
   *  it. A row the user has manually toggled always keeps its own explicit state regardless of this
   *  flag. */
  @property({ type: Boolean, attribute: 'without-auto-expand-failures' })
  withoutAutoExpandFailures = false;

  /** Explicit per-row expand/collapse overrides, keyed by suite+test identity. Absence defers to
   *  `without-auto-expand-failures`. */
  @state() private manualExpanded = new Map<string, boolean>();

  @query('lr-live-region') private liveRegion?: LyraLiveRegion;

  private legacyGeneration = 0;
  private legacyNeedsNormalization = false;
  private legacyIntentScheduled = false;
  private legacyPending = false;
  private legacyError = false;
  private legacyDone: Promise<void> = Promise.resolve();
  private settleLegacy?: () => void;
  private legacyTimer?: number;
  private legacyRows: { suiteId: string; suiteName: string; test: TestCaseResult; key: string; order: number }[] = [];
  private pendingCompletionRun: { id: string; source: TestResultsSource | undefined } | undefined;
  private normalizedSuitesCache: TestSuiteResult[] = [];
  private projectedSuitesCache: TestSuiteResult[] = [];
  private completeStatusCounts: Record<TestStatus, number> = { passed: 0, failed: 0, skipped: 0, running: 0 };
  private detailSlotNames = new Set<string>();
  private detailSlotsDirty = true;
  private projectionTruncated = false;
  private readonly announcements = new AnnouncementSinkController(this, { eager: ['polite'] });
  private limitAnnouncementInitialized = false;
  private statusAnnouncementInitialized = false;
  private previousStatusAnnouncement = '';
  private previouslyTruncated = false;
  private readonly idPrefix = nextId('test-results');

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated && !this.sourceMode) this.rebuildNormalizedSuites();
    this.limitAnnouncementInitialized = this.hasUpdated;
    this.previouslyTruncated = this.projectionTruncated;
  }

  override adoptedCallback(): void {
    this.cancelLegacy(); this.pendingCompletionRun = undefined;
    this.statusAnnouncementInitialized = false; this.previousStatusAnnouncement = '';
    super.adoptedCallback();
    this.announcements.adopted();
    this.sourcePages.adopted();
    this.sourceInputs = undefined; this.syncSource();
    if (!this.sourceMode && this.isConnected) this.rebuildNormalizedSuites();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.syncSource();
    if (this.sourceMode && this.sourcePages.state.result && this.sourcePage !== this.sourcePages.state.page) {
      this.sourceSyncing = true; this.sourcePage = this.sourcePages.state.page; this.sourceSyncing = false;
      this.sourceInputs = this.sourceInputs ? [...this.sourceInputs.slice(0, -1), this.sourcePage] : undefined;
    }
    if (!this.sourceMode && (changed.has('suites') || changed.has('dataSource') || this.legacyNeedsNormalization)) this.rebuildNormalizedSuites();
    if (!this.sourceMode && (changed.has('suites') || changed.has('statusFilter'))) this.rebuildProjection();
    if (this.detailSlotsDirty) {
      this.rebuildDetailSlotNames();
      this.detailSlotsDirty = false;
    }
    if (changed.has('runState') || changed.has('runId')) {
      const previousState = changed.has('runState') ? changed.get('runState') : this.runState;
      const previousRunId = changed.has('runId') ? changed.get('runId') : this.runId;
      if (
        previousState === 'running'
        && this.runState === 'complete'
        && this.runId !== null
        && previousRunId === this.runId
      ) {
        this.pendingCompletionRun = { id: this.runId, source: this.dataSource };
      }
    }
  }

  private cancelLegacy(): void {
    this.legacyGeneration++;
    if (this.legacyTimer !== undefined) this.ownerDocument.defaultView?.clearTimeout(this.legacyTimer);
    this.legacyTimer = undefined; this.settleLegacy?.(); this.settleLegacy = undefined;
    this.legacyPending = false;
  }

  private rebuildNormalizedSuites(): void {
    this.legacyNeedsNormalization = false;
    this.cancelLegacy();
    const generation = this.legacyGeneration;
    const owner = this.ownerDocument;
    // SSR has no document; normalize the same bounded first batch before hydration.
    const current = () => generation === this.legacyGeneration && this.ownerDocument === owner && !this.sourceMode && (!owner || this.isConnected);
    const input = this.suites;
    this.legacyPending = true; this.legacyError = false;
    this.normalizedSuitesCache = []; this.projectedSuitesCache = []; this.legacyRows = [];
    this.legacyDone = new Promise(resolve => { this.settleLegacy = resolve; });
    const rows: typeof this.legacyRows = [];
    const suites: TestSuiteResult[] = [];
    const keys = new Set<string>();
    const suiteIds = new Set<string>();
    const counts = { passed: 0, failed: 0, skipped: 0, running: 0 };
    const host = this;
    function* normalize(): Generator<void> {
      for (const suite of Array.isArray(input) ? input : []) {
        yield;
        if (!current()) return;
        if (!suite) continue;
        const suiteId = suite.id;
        if (!current()) return;
        if (typeof suiteId !== 'string') continue;
        if (suiteId.length > 65_536) throw new RangeError('Result text limit');
        if (!suiteId.trim() || suiteIds.has(suiteId)) continue;
        const rawSuiteName = suite.name;
        if (!current()) return;
        const suiteName = typeof rawSuiteName === 'string' ? rawSuiteName : '';
        if (suiteId.length + suiteName.length > 65_536) throw new RangeError('Result text limit');
        suiteIds.add(suiteId);
        const testIds = new Set<string>();
        const tests: TestCaseResult[] = [];
        const inputTests = suite.tests;
        if (!current()) return;
        for (const test of Array.isArray(inputTests) ? inputTests : []) {
          yield;
          if (!current()) return;
          if (!test) continue;
          const id = test.id;
          if (!current()) return;
          if (typeof id !== 'string') continue;
          if (id.length > 65_536) throw new RangeError('Result text limit');
          if (!id.trim() || testIds.has(id)) continue;
          const status = normalizeTestStatus(test.status);
          if (!current()) return;
          const name = test.name;
          if (!current()) return;
          const message = test.message;
          if (!current()) return;
          const durationMs = test.durationMs;
          if (!current()) return;
          const normalized: TestCaseResult = { id, name: typeof name === 'string' ? name : '', status,
            ...(typeof message === 'string' ? { message } : {}), ...(typeof durationMs === 'number' ? { durationMs } : {}) };
          checkRowText(suiteId, suiteName, normalized);
          testIds.add(id); tests.push(normalized);
          const key = host.testKey(suiteId, id); keys.add(key); counts[status]++;
          rows.push({ suiteId, suiteName, test: normalized, key, order: rows.length });
        }
        if (tests.length) suites.push({ id: suiteId, name: suiteName, tests });
      }
    }
    const iterator = normalize();
    const step = () => {
      if (!current()) return;
      try {
        for (let position = 0; position < 500; position++) {
          const next = iterator.next();
          if (!current()) return;
          if (next.done) {
            this.normalizedSuitesCache = suites; this.legacyRows = rows;
            this.completeStatusCounts = counts; this.legacyPending = false;
            for (const key of this.manualExpanded.keys()) if (!keys.has(key)) this.manualExpanded.delete(key);
            this.rebuildProjection(); this.settleLegacy?.(); this.settleLegacy = undefined;
            this.requestUpdate('legacyPending'); return;
          }
        }
        this.legacyTimer = owner?.defaultView?.setTimeout(step, 0);
      } catch {
        if (!current()) return;
        this.legacyPending = false; this.legacyError = true;
        this.settleLegacy?.(); this.settleLegacy = undefined;
        this.requestUpdate('legacyError');
      }
    };
    step();
  }

  protected override async getUpdateComplete(): Promise<boolean> {
    let result = await super.getUpdateComplete();
    while (!this.sourceMode && (this.legacyPending || this.legacyNeedsNormalization) && this.isConnected) {
      const done = this.legacyDone;
      await done;
      result = await super.getUpdateComplete();
    }
    return result;
  }

  override disconnectedCallback(): void {
    this.cancelLegacy(); this.pendingCompletionRun = undefined;
    this.statusAnnouncementInitialized = false; this.previousStatusAnnouncement = '';
    this.sourceInputs = undefined; this.sourceExpanded.clear();
    super.disconnectedCallback();
  }

  private rebuildProjection(): void {
    const statuses = new Set(this.statusFilter);
    const eligible = (row: typeof this.legacyRows[number]) => !statuses.size || statuses.has(row.test.status);
    const chosen = new Map<string, typeof this.legacyRows[number]>();
    for (const priority of [0, 1, 2]) {
      for (const row of this.legacyRows) {
        if (chosen.size >= MAX_RENDERED_TESTS) break;
        if (eligible(row) && (priority === 2 || (priority === 0 ? this.manualExpanded.get(row.key) === true : row.test.status === 'failed'))) chosen.set(row.key, row);
      }
    }
    const selected = [...chosen.values()].sort((a, b) => a.order - b.order);
    const suites: { id: string; name: string; tests: TestCaseResult[] }[] = [];
    for (const row of selected) {
      let suite = suites[suites.length - 1];
      if (!suite || suite.id !== row.suiteId) { suite = { id: row.suiteId, name: row.suiteName, tests: [] }; suites.push(suite); }
      suite.tests.push(row.test);
    }
    this.projectedSuitesCache = suites;
    const total = STATUSES.reduce((sum, status) => sum + (!statuses.size || statuses.has(status) ? this.completeStatusCounts[status] : 0), 0);
    this.projectionTruncated = chosen.size < total;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const status = this.sourceMode
      ? this.sourcePages.state.pending ? this.localize('loading') : !this.sourcePages.state.result ? this.localize('tableLoadFailed') : ''
      : this.legacyError ? this.localize('testResultsInputTooLarge') : this.legacyPending ? this.localize('loading') : '';
    if (this.statusAnnouncementInitialized && status && status !== this.previousStatusAnnouncement) this.announcements.announcePolite(status);
    this.statusAnnouncementInitialized = true; this.previousStatusAnnouncement = status;
    const completion = this.pendingCompletionRun;
    if (completion && (this.runState !== 'complete' || completion.id !== this.runId || completion.source !== this.dataSource)) this.pendingCompletionRun = undefined;
    const counts = this.sourceMode ? this.sourcePages.state.result?.summary : !this.legacyPending && !this.legacyError ? this.completeStatusCounts : undefined;
    if (completion && this.pendingCompletionRun === completion && counts) {
      const owner = this.ownerDocument;
      const epoch = this.sourceEpoch;
      const generation = this.legacyGeneration;
      const result = this.sourcePages.state.result;
      const current = () => this.pendingCompletionRun === completion && this.isConnected && this.ownerDocument === owner
        && this.runState === 'complete' && this.runId === completion.id && this.dataSource === completion.source
        && this.sourceEpoch === epoch && this.legacyGeneration === generation && this.sourcePages.state.result === result;
      const number = getNumberFormat(this.effectiveLocale);
      if (current()) {
        const text = this.localize('testResultsCompleteAnnounce', undefined, {
          passed: number.format(counts.passed), failed: number.format(counts.failed), skipped: number.format(counts.skipped),
        });
        if (current()) {
          this.pendingCompletionRun = undefined;
          this.liveRegion?.announce(text, { force: true });
        }
      }
    }
    if (!this.sourceMode && this.limitAnnouncementInitialized && this.projectionTruncated && !this.previouslyTruncated) {
      this.announcements.announcePolite(this.localize('testResultsLimit', undefined, {
        count: getNumberFormat(this.effectiveLocale).format(MAX_RENDERED_TESTS),
      }));
    }
    this.limitAnnouncementInitialized = true;
    this.previouslyTruncated = this.projectionTruncated;
  }

  private computeStatusCounts(): Record<TestStatus, number> {
    return this.completeStatusCounts;
  }

  private testKey(suiteId: string, testId: string): string {
    return JSON.stringify([suiteId, testId]);
  }

  private scopedDetailSlot(suiteId: string, testId: string): string {
    return testResultDetailSlotName(suiteId, testId);
  }

  private rebuildDetailSlotNames(): void {
    this.detailSlotNames = new Set(
      [...(this.children ?? [])]
        .map((child) => child.getAttribute('slot'))
        .filter((name): name is string => name !== null),
    );
  }

  private hasDetail(suiteId: string, testId: string): boolean {
    return this.detailSlotNames.has(this.scopedDetailSlot(suiteId, testId));
  }

  private isExpanded(suiteId: string, test: TestCaseResult): boolean {
    const manual = (this.sourceMode ? this.sourceExpanded : this.manualExpanded).get(this.testKey(suiteId, test.id));
    if (manual !== undefined) return manual;
    return !this.withoutAutoExpandFailures && test.status === 'failed';
  }

  private toggleFilter(status: TestStatus): void {
    const next = this.statusFilter.includes(status)
      ? this.statusFilter.filter((s) => s !== status)
      : [...this.statusFilter, status];
    this.statusFilter = next;
    this.emit('lr-filter-change', { statuses: next });
  }

  private toggleExpanded(suiteId: string, test: TestCaseResult, current: () => boolean): void {
    if (!current()) return;
    const expanded = !this.isExpanded(suiteId, test);
    if (this.emit('lr-toggle-request', { suiteId, testId: test.id, expanded }, { cancelable: true }).defaultPrevented) return;
    if (!current()) return;
    const next = new Map(this.sourceMode ? this.sourceExpanded : this.manualExpanded);
    next.set(this.testKey(suiteId, test.id), expanded);
    if (this.sourceMode) { this.sourceExpanded = next; this.sourceVersion++; } else this.manualExpanded = next;
    this.emit('lr-toggle', { suiteId, testId: test.id, expanded });
  }

  private onDetailSlotChange(): void {
    this.detailSlotsDirty = true;
    this.requestUpdate('detailSlotsDirty');
  }

  private renderSummary(statusCounts: Record<TestStatus, number>): TemplateResult {
    return html`
      <div part="summary">
        ${STATUSES.map((status) => {
          const count = statusCounts[status];
          const formattedCount = getNumberFormat(this.effectiveLocale).format(count);
          return html`<span part="count" data-status=${status}
            >${this.localize(STATUS_COUNT_KEY[status], undefined, { count: formattedCount })}</span
          >`;
        })}
      </div>
      <div part="filter" role="group" aria-label=${this.localize('testResultsFilterLabel')}>
        ${STATUSES.map((status) => {
          const count = statusCounts[status];
          const formattedCount = getNumberFormat(this.effectiveLocale).format(count);
          return html`
            <button
              part="filter-toggle"
              data-agent-action="filter"
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
    const state = this.sourcePages.state;
    const generation = this.legacyGeneration;
    const source = this.dataSource;
    const owner = this.ownerDocument;
    const current = () => this.isConnected && this.ownerDocument === owner && this.dataSource === source && (this.sourceMode ? (this.sourcePages.state === state && !!state.result) : generation === this.legacyGeneration && !this.legacyPending && !this.legacyError);
    const expanded = this.isExpanded(suiteId, test);
    const scopedSlot = this.scopedDetailSlot(suiteId, test.id);
    const canExpand = test.status === 'failed' || this.hasDetail(suiteId, test.id);
    const domKey = `${suiteIndex}-${testIndex}`;
    const failureId = `${this.idPrefix}-${domKey}-failure`;
    const statusId = `${this.idPrefix}-${domKey}-status`;
    const toggleName = this.localize(expanded ? 'testResultsCollapseTest' : 'testResultsExpandTest', undefined, {
      name: [suiteName, test.name].join(this.localize('accessibleLabelSeparator')),
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
          @click=${() => { if (current()) this.emit('lr-test-select', { suiteId, testId: test.id }); }}
        >
          ${test.name}
        </button>
        ${typeof test.durationMs === 'number' && Number.isFinite(test.durationMs) && test.durationMs >= 0
          ? html`<span part="test-duration"
              >${formatShortDuration(this.localize.bind(this), this.effectiveLocale, test.durationMs)}</span
            >`
          : nothing}
        ${canExpand
          ? html`<button
              part="test-expand-toggle"
              data-agent-action="detail"
              type="button"
              aria-expanded=${expanded ? 'true' : 'false'}
              aria-controls=${failureId}
              aria-label=${toggleName}
              @click=${() => this.toggleExpanded(suiteId, test, current)}
            >
              ${expanded ? this.localize('collapse') : this.localize('expand')}
            </button>`
          : nothing}
        <div part="failure" id=${failureId} ?hidden=${!canExpand || !expanded}>
          ${test.message ? html`<div part="failure-message">${test.message}</div>` : nothing}
          <slot name=${scopedSlot} @slotchange=${this.onDetailSlotChange}></slot>
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
        <div role="list" aria-label=${suite.name || nothing}
          >${repeat(visibleTests, ({ test }) => test.id, ({ test, testIndex }) =>
            this.renderTest(suite.id, suite.name, test, suiteIndex, testIndex))}</div
        >
      </div>
    `;
  }

  private renderSource(): TemplateResult {
    const state = this.sourcePages.state;
    const source = this.dataSource;
    const result = state.result;
    const failed = !state.pending && !result;
    const rows = result?.rows ?? [];
    const label = overallSemanticLabel(this, this.localize('testResultsLabel'));
    return html`<div part="base" role=${overallSemanticRole(this, 'group') ?? nothing} aria-label=${label ?? nothing} aria-busy=${state.pending ? 'true' : 'false'}>
      ${result ? this.renderSummary(result.summary!) : html`<p part="source-status">${this.localize(failed ? 'tableLoadFailed' : 'loading')}</p>`}
      ${failed ? html`<button part="source-retry" type="button" @click=${() => {
        if (this.isConnected && this.dataSource === source && this.sourcePages.state === state) { this.sourceInputs = undefined; this.syncSource(); this.sourceVersion++; }
      }}>${this.localize('retry')}</button>` : nothing}
      ${rows.map((record, index) => html`${index === 0 || rows[index - 1]!.value.suiteId !== record.value.suiteId ? html`<div part="suite-header">${record.value.suiteName}</div>` : nothing}
        <div role="list">${this.renderTest(record.value.suiteId, record.value.suiteName, record.value.test, index, 0)}</div>`)}
      ${result && !rows.length ? html`<lr-empty part="empty" heading=${this.localize(result.summary!.total ? 'noMatches' : 'noData')}></lr-empty>` : nothing}
      <lr-pagination part="source-pagination" format="compact" with-edges .page=${finiteInteger(this.sourcePage, 0, 0, Number.MAX_SAFE_INTEGER - 1) + 1}
        .pageSize=${finiteInteger(this.sourcePageSize, 100, 1, 500)} .total=${this.sourceTotal ?? -1} .disabled=${!result}
        .strings=${this.strings} @lr-page-change=${(event: CustomEvent<{ page: number }>) => {
          event.stopPropagation(); if (this.sourcePages.state === state && result) this.sourcePage = event.detail.page - 1;
        }} @lr-before-page-change=${(event: Event) => event.stopPropagation()} @lr-activate=${(event: Event) => event.stopPropagation()}></lr-pagination>
    </div><lr-live-region mode="polite"></lr-live-region>`;
  }

  override render(): TemplateResult {
    if (this.sourceMode) return this.renderSource();
    if (this.legacyPending || this.legacyError) return html`<div part=${this.legacyError ? 'input-error' : 'source-status'} aria-busy=${this.legacyPending ? 'true' : 'false'}>${this.localize(this.legacyError ? 'testResultsInputTooLarge' : 'loading')}</div><lr-live-region mode="polite"></lr-live-region>`;
    const ariaLabel = overallSemanticLabel(this, this.localize('testResultsLabel'));
    const visibleSuites = this.projectedSuitesCache.filter((suite) =>
      suite.tests.some((test) => this.statusFilter.length === 0 || this.statusFilter.includes(test.status)));
    return html`
      ${this.normalizedSuitesCache.length === 0
        ? html`<lr-empty part="empty" heading=${this.localize('noData')}></lr-empty>`
        : html`
            <div
              part="base"
              role=${overallSemanticRole(this, 'group') ?? nothing}
              aria-label=${ariaLabel ?? nothing}
            >
              ${this.renderSummary(this.computeStatusCounts())}
              ${visibleSuites.length === 0
                ? html`<lr-empty part="empty" heading=${this.localize('noMatches')}></lr-empty>`
                : repeat(this.projectedSuitesCache, (suite) => suite.id, (suite, index) => this.renderSuite(suite, index))}
              ${this.projectionTruncated
                ? html`<p part="limit" role="note">${this.localize('testResultsLimit', undefined, {
                    count: getNumberFormat(this.effectiveLocale).format(MAX_RENDERED_TESTS),
                  })}</p>`
                : nothing}
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

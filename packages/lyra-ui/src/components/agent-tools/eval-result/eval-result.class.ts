import type { EvalRunResult } from './eval-run-result.js';
export type { EvalRunResult } from './eval-run-result.js';
import type { LyraPageSource, LyraPageResult, LyraSourceRecord, LyraSourceRevision } from '../../../data-sources.js';
import { SourcePageController } from '../../../internal/source-page-controller.js';
import { finiteInteger } from '../../../internal/numbers.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { projectEvalSourceRun, projectEvalSourceReview } from './eval-result-source.js';
import { collectionSupport, snapshotEventDetail } from '../../../internal/collection-snapshot.js';
import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import {
  LyraElement,
  type LyraEventDetailSnapshot,
} from '../../../internal/lyra-element.js';
import { styles } from './eval-result.styles.js';
import { agentActionButtonStyles } from '../agent-action-button.styles.js';
import type { RubricKey, RubricValue } from '../../forms/rubric-form/rubric-form.class.js';
import type { AgentRunActivateDetail } from '../run-events.js';
import { firstByIdentityMemo } from '../collection-identity.js';
import type { LyraTableEventMap, TableColumn } from '../../data/table/table.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_evaluationDashboardRunsLabel } from '../../../internal/default-strings/agent-tools.generated.js';
import { LYRA_DEFAULT_loading, LYRA_DEFAULT_noData, LYRA_DEFAULT_retry, LYRA_DEFAULT_sourceSelectionFailed, LYRA_DEFAULT_sourceSelectionLoading } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const EMPTY_RUNS: EvalRunResult[] = [];
const EMPTY_COLUMNS: TableColumn<EvalRunResult>[] = [];
const EMPTY_KEYS: RubricKey[] = [];
const runId = (run: EvalRunResult): unknown => run.id;
const columnKey = (column: TableColumn<EvalRunResult>): unknown => column.key;
const rubricKey = (key: RubricKey): unknown => key.key;
const rowKey = (row: EvalRunResult): string => row.id;

/** Full-source server order for the comparison grid. */
export interface EvalResultSourceQuery {
  readonly sortKey: string | null;
  readonly sortDir: 'asc' | 'desc';
}
export type EvalResultSource = LyraPageSource<EvalRunResult, EvalResultSourceQuery>;

export interface LyraEvalResultEventMap {
  /** Source mode only: the original cancelable table proposal. */
  'lr-sort-request': LyraTableEventMap<EvalRunResult>['lr-sort-request'];
  /** Source mode only: the original accepted table sort. */
  'lr-sort': LyraTableEventMap<EvalRunResult>['lr-sort'];
  'lr-run-activate': CustomEvent<LyraEventDetailSnapshot<AgentRunActivateDetail<EvalRunResult>>>;
  'lr-review-input': CustomEvent<LyraEventDetailSnapshot<{ runId: string; value: RubricValue }>>;
  'lr-review-validity-change': CustomEvent<LyraEventDetailSnapshot<{
    runId: string;
    valid: boolean;
    errors: Record<string, string>;
  }>>;
  'lr-review-submit': CustomEvent<LyraEventDetailSnapshot<{ runId: string; value: RubricValue }>>;
  'lr-review-skip': CustomEvent<LyraEventDetailSnapshot<{ runId: string }>>;
}

/**
 * `<lr-eval-result>` — rubric scoring, human review, and comparison across a single evaluation
 * example's runs (one per model or prompt version), LangSmith/Arize-eval-result style. Duplicate
 * run ids normalize before fallback selection, lookup, table row keys, review events, and
 * comparison; the first occurrence wins.
 *
 * Composes three existing primitives directly rather than re-deriving any of their behavior:
 * `<lr-table>` renders the `runs` comparison table (`columns` is a plain pass-through to its
 * own `TableColumn[]` shape, the same way `rubricKeys` is a pass-through to
 * `<lr-rubric-form>`'s own `keys` -- neither is re-derived here); `<lr-rubric-form>` is the
 * human-review scoring surface for whichever run is currently selected, reading/writing that
 * run's own `review` value and re-emitting its `lr-input`/`lr-validity-change`/`lr-submit`/
 * `lr-skip` events with the run id attached; `<lr-diff-view>` compares the selected run's output
 * against `baselineRunId`'s output -- `layout="split"` once they resolve to two distinct runs,
 * `layout="unified"` (an all-equal diff, i.e. a plain read of the one run's output) once they
 * resolve to the same run or no baseline resolves at all -- so there is no separate un-diffed
 * "just show the output" code path to keep in sync with the comparison one.
 *
 * `selectedRunId`/`baselineRunId` are both fully controlled: this component never mutates either
 * property itself. Each one falls back to `runs[0]?.id` purely for *rendering* whenever the
 * property is unset, so the component renders something useful with zero configuration beyond
 * `runs` -- but moving the selection for real requires the host to set `selectedRunId` in
 * response to `lr-run-activate`, the same shape `<lr-rubric-form>`'s own `itemId` already uses. A
 * `selectedRunId`/`baselineRunId` that doesn't match any entry in `runs` degrades gracefully: the
 * comparison grid still renders, and the review/diff sections simply don't (no error, no crash).
 *
 * `dataSource` opts into server pages of at most 500 rows; explicit selected/baseline IDs
 * resolve through a separate lookup of at most two IDs. Null selection remains the first global
 * row of the current query, including when an initial nonzero page needs a size-one primer.
 * Provider rows are immutable for their revision. Fixed run fields are projected and frozen;
 * source activation events retain complete opaque scores/review dictionaries by identity.
 * Custom column callbacks receive original provider records; built-in review reads configured
 * rubric keys only. Reassign the provider or call requestUpdate() to refresh.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-eval-result
 * @event lr-sort-request - Source mode only: cancelable original table sort proposal.
 * @event lr-sort - Source mode only: accepted original table sort commit.
 * @event lr-run-activate - A comparison-grid row was activated. `detail: { runId, run }`.
 * @event lr-review-input - The selected run's rubric value changed. `detail: { runId, value }`.
 * @event lr-review-validity-change - The selected run's rubric validity changed. `detail: { runId, valid, errors }`.
 * @event lr-review-submit - The selected run's rubric form was submitted. `detail: { runId, value }`.
 * @event lr-review-skip - The selected run's rubric form was skipped (`reviewSkippable` only). `detail: { runId }`.
 * @csspart base - The outer wrapper.
 * @csspart empty - The message shown when `runs` has no entries.
 * @csspart grid - The `<lr-table>` comparison table.
 * @csspart source-status - Localized initial source loading status.
 * @csspart selection-status - Localized source selection loading/failure status.
 * @csspart selection-retry - Retries the current selected/baseline lookup.
 * @csspart review - The `<lr-rubric-form>` scoring the selected run.
 * @csspart diff - The wrapper around the diff caption and `<lr-diff-view>`.
 * @csspart diff-labels - The caption row naming the two compared runs (only rendered while comparing two distinct runs).
 * @csspart diff-label-old - The baseline run's caption.
 * @csspart diff-label-new - The selected run's caption.
 * @csspart diff-view - The `<lr-diff-view>` comparing the baseline and selected runs' output.
 * @status stable
 * @since 4.1.0
 */
export class LyraEvalResult extends LyraElement<LyraEvalResultEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    evaluationDashboardRunsLabel: LYRA_DEFAULT_evaluationDashboardRunsLabel,
    loading: LYRA_DEFAULT_loading,
    noData: LYRA_DEFAULT_noData,
    retry: LYRA_DEFAULT_retry,
    sourceSelectionFailed: LYRA_DEFAULT_sourceSelectionFailed,
    sourceSelectionLoading: LYRA_DEFAULT_sourceSelectionLoading,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze(['runs', 'columns', 'rubricKeys']);

  static override styles = [LyraElement.styles, styles, agentActionButtonStyles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-run-activate',
    'lr-review-input',
    'lr-review-validity-change',
    'lr-review-submit',
    'lr-review-skip',
  ]);

  protected static override readonly identityCollectionObjectProperties = Object.freeze(['dataSource']);
  protected static override readonly identityEventDetailProperties = Object.freeze({ 'lr-run-activate': Object.freeze(['run']) });

  @state() private sourceStateVersion = 0;
  private _dataSource?: EvalResultSource;
  private sourceEpoch = 0;
  private acceptedSourceRevision?: LyraSourceRevision;
  private sourceVersion = 0;
  private pairVersion = 0;
  private sourceSyncing = false;
  private sourceResync = false;
  private sourceLocaleUpdate = false;
  private sourceInputs?: readonly unknown[];
  private sourceOrderInputs?: readonly unknown[];
  private pairInputs?: readonly unknown[];
  private sourceResult?: LyraPageResult<EvalRunResult>;
  private sourceRows: EvalRunResult[] = [];
  private sourcePair: readonly LyraSourceRecord<EvalRunResult>[] = [];
  private readonly sourceOriginals = new WeakMap<EvalRunResult, EvalRunResult>();
  private sourceFailure: unknown;
  private pairFailure: unknown;
  private sourcePriming = false;
  private sourceTableShown = false;
  private fallbackId: string | null | undefined;
  private sourceSortKey: string | null = null;
  private sourceSortDir: 'asc' | 'desc' = 'asc';
  private sourceColumnsMemo?: { columns: readonly TableColumn<EvalRunResult>[]; rows: readonly EvalRunResult[]; value: TableColumn<EvalRunResult>[] };
  private sourceReviewMemo?: { run: EvalRunResult; keys: readonly RubricKey[]; value: RubricValue };
  private sortRequest?: { target: EventTarget | null; version: number; columns: readonly TableColumn<EvalRunResult>[]; key: string; dir: string };
  private readonly announcements = new AnnouncementSinkController(this, { eager: ['polite'] });
  private failureInitialized = false;
  private previousFailure = false;
  private readonly sourcePages = new SourcePageController<EvalRunResult, EvalResultSourceQuery>(this, {
    normalizeRecord: (record, isCurrent) => {
      const epoch = this.sourceEpoch; const source = this.dataSource; const owner = this.ownerDocument;
      const current = () => isCurrent() && this.isConnected && this.sourceEpoch === epoch && this.dataSource === source && this.ownerDocument === owner;
      const value = projectEvalSourceRun(record, current);
      this.sourceOriginals.set(value, record.value as EvalRunResult);
      return { key: record.key, order: record.order, value };
    },
    validateMetadata: () => {},
    onChange: () => { this.sourceStateVersion++; },
  });

  /** Immutable full-source provider; takes precedence over runs. Same-reference assignment or
   * requestUpdate() refreshes. undefined restores legacy runs. Source keys equal run IDs. */
  @property({ attribute: false })
  get dataSource(): EvalResultSource | undefined { return this._dataSource; }
  set dataSource(value: EvalResultSource | undefined) {
    const old = this._dataSource; this._dataSource = value;
    this.sourceEpoch = (this.sourceEpoch ?? 0) + 1;
    this.requestUpdate('dataSource', old);
  }
  /** Zero-based provider page. Null selection uses the first global row, primed with a size-one
   * page-zero request when necessary, independently of this displayed page. */
  @property({ type: Number, attribute: 'source-page' }) sourcePage = 0;
  /** Provider rows per page, normalized to 1..500. */
  @property({ type: Number, attribute: 'source-page-size' }) sourcePageSize = 100;
  /** Exact displayed-query total; null while pending/failed or outside provider mode. */
  get sourceTotal(): number | null { return this.sourceMode ? this.sourceResult?.total ?? null : null; }
  private get sourceMode(): boolean { return this.dataSource !== undefined; }

  override requestUpdate(...args: Parameters<LyraElement['requestUpdate']>): void {
    if (this.sourceLocaleUpdate) {
      super.requestUpdate(...args);
      this.syncSource();
      return;
    }
    if (args[0] === undefined && !this.sourceLocaleUpdate && (!this.sourceOrderInputs || this.effectiveLocale === this.sourceOrderInputs[3])) this.sourceEpoch = (this.sourceEpoch ?? 0) + 1;
    if (args[0] === undefined || ['dataSource', 'sourcePage', 'sourcePageSize'].includes(String(args[0]))) this.syncSource();
    if (['selectedRunId', 'baselineRunId'].includes(String(args[0])) && this.sourcePages && this.sourceMode) {
      this.syncSource(); this.syncPair();
    }
    if (args[0] === 'rubricKeys') { this.sourceReviewMemo = undefined; this.pairFailure = undefined; }
    super.requestUpdate(...args);
  }
  override attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    const previous = this.sourceLocaleUpdate;
    if (name === 'lang' || name === 'locale') this.sourceLocaleUpdate = true;
    try { super.attributeChangedCallback(name, old, value); } finally { this.sourceLocaleUpdate = previous; }
  }
  override connectedCallback(): void { super.connectedCallback(); this.syncSource(); }
  override disconnectedCallback(): void { this.clearSourceLifecycle(); super.disconnectedCallback(); }
  override adoptedCallback(): void {
    this.clearSourceLifecycle(); this.sourcePages.adopted(); this.announcements.adopted(); super.adoptedCallback(); this.syncSource();
  }
  private clearSourceLifecycle(): void {
    this.sourceEpoch++; this.sourceVersion++; this.pairVersion++;
    this.sourceTableShown = false; this.failureInitialized = false; this.previousFailure = false;
    this.sourceInputs = undefined; this.sourceOrderInputs = undefined; this.pairInputs = undefined; this.acceptedSourceRevision = undefined;
    this.sourceRows = []; this.sourcePair = []; this.sourceResult = undefined; this.fallbackId = undefined;
    this.sourceReviewMemo = undefined; this.sourceColumnsMemo = undefined; this.sourcePages.bind(undefined);
  }
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); this.syncSource(); this.syncPair();
  }
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const state = this.sourcePages.state;
    const failed = this.sourceMode && !!(this.pairFailure || state.selectionError);
    if (this.failureInitialized && failed && !this.previousFailure) this.announcements.announcePolite(this.localize('sourceSelectionFailed'));
    if (this.sourceMode && !state.pending && !state.selectionPending && (this.sourceResult || state.error || this.sourceFailure)) this.failureInitialized = true;
    this.previousFailure = failed;
  }

  private syncSource(): void {
    if (!this.sourcePages) return;
    if (this.sourceSyncing) { this.sourceResync = true; return; }
    if (!this.isConnected) return;
    this.sourceSyncing = true;
    const source = this.dataSource; const epoch = this.sourceEpoch;
    const current = () => this.dataSource === source && this.sourceEpoch === epoch && this.isConnected;
    try {
      if (source === undefined) {
        if (this.sourceInputs) this.clearSourceLifecycle();
        this.sourceFailure = undefined; this.pairFailure = undefined; return;
      }
      const revision = source.revision;
      if (!current()) return;
      const locale = this.effectiveLocale;
      const size = finiteInteger(this.sourcePageSize, 100, 1, 500);
      let page = finiteInteger(this.sourcePage, 0, 0, Math.floor(Number.MAX_SAFE_INTEGER / size));
      const orderInputs = [source, revision, epoch, locale, this.sourceSortKey, this.sourceSortDir];
      const resetFallback = !this.sourceOrderInputs || orderInputs.some((value, index) => value !== this.sourceOrderInputs![index]);
      if (this.sourceInputs && (size !== this.sourceInputs[6] || this.sourceSortKey !== this.sourceInputs[4] || this.sourceSortDir !== this.sourceInputs[5])) page = 0;
      const inputs = [...orderInputs, size, page];
      const needPrime = (this.selectedRunId === null || this.baselineRunId === null) && (resetFallback || this.fallbackId === undefined);
      if (this.sourceInputs && inputs.every((value, index) => value === this.sourceInputs![index]) && !(needPrime && !this.sourcePriming && this.sourceResult)) return;
      const version = ++this.sourceVersion;
      if (resetFallback) this.fallbackId = undefined;
      this.sourceOrderInputs = orderInputs; this.sourceInputs = inputs;
      this.sourceRows = []; this.sourceResult = undefined; this.sourceColumnsMemo = undefined; this.sourceFailure = undefined;
      this.sourcePage = page;
      if (this.acceptedSourceRevision !== revision) {
        this.pairVersion++; this.pairInputs = undefined; this.sourcePair = []; this.sourceReviewMemo = undefined;
      }
      this.sourcePages.bind({ source, revision, epoch, locale });
      if (!current() || version !== this.sourceVersion) return;
      this.acceptedSourceRevision = revision;
      this.sourcePriming = needPrime && page !== 0;
      const query: EvalResultSourceQuery = Object.freeze({ sortKey: this.sourceSortKey, sortDir: this.sourceSortDir });
      void this.loadSourcePage(version, query, page, size, this.sourcePriming);
      this.syncPair();
    } catch (error) {
      if (current()) {
        this.sourceVersion++; this.pairVersion++; this.sourceRows = []; this.sourceResult = undefined; this.sourcePair = [];
        this.sourceFailure = error; this.sourcePages.bind(undefined);
      }
    } finally {
      this.sourceSyncing = false;
      if (this.sourceResync) { this.sourceResync = false; this.syncSource(); }
    }
  }
  private async loadSourcePage(version: number, query: EvalResultSourceQuery, page: number, size: number, prime: boolean): Promise<void> {
    const owner = this.ownerDocument;
    const current = () => this.isConnected && this.ownerDocument === owner && this.sourceVersion === version && this.sourceMode;
    if (prime) {
      const accepted = await this.sourcePages.request(query, 0, 1);
      if (!current()) return;
      if (!accepted) { this.sourcePriming = false; this.sourceStateVersion++; return; }
      this.fallbackId = this.sourcePages.state.result!.rows[0]?.key ?? null;
      this.syncPair();
      if (!current()) return;
    }
    const accepted = await this.sourcePages.request(query, page, size);
    if (!current()) return;
    this.sourcePriming = false;
    if (accepted) {
      this.sourceResult = this.sourcePages.state.result;
      this.sourceRows = this.sourceResult!.rows.map(record => record.value);
      if (this.fallbackId === undefined && this.sourcePages.state.page === 0) this.fallbackId = this.sourceRows[0]?.id ?? null;
      if (this.sourceInputs) this.sourceInputs = [...this.sourceInputs.slice(0, -1), this.sourcePages.state.page];
      this.sourcePage = this.sourcePages.state.page;
      this.syncPair();
    }
    this.sourceStateVersion++;
  }
  private syncPair(force = false): void {
    if (!this.sourcePages || !this.sourceMode || !this.isConnected) return;
    const selected = this.selectedRunId ?? this.fallbackId;
    const baseline = this.baselineRunId ?? this.fallbackId;
    const inputs = [this.dataSource, this.sourceEpoch, this.acceptedSourceRevision, selected, baseline];
    if (!force && this.pairInputs && inputs.every((value, index) => value === this.pairInputs![index])) return;
    this.pairInputs = inputs; const version = ++this.pairVersion;
    const owner = this.ownerDocument;
    this.sourcePair = []; this.sourceReviewMemo = undefined; this.pairFailure = undefined;
    const keys = [...new Set([selected, baseline].filter((id): id is string => typeof id === 'string' && id.length > 0))];
    void this.sourcePages.resolveSelection(keys).then(records => {
      if (!this.isConnected || this.ownerDocument !== owner || this.pairVersion !== version || !this.sourceMode) return;
      if (records) this.sourcePair = records;
      this.sourceStateVersion++;
    });
  }
  private sourceColumns(): TableColumn<EvalRunResult>[] {
    const columns = this.normalizedColumns;
    if (this.sourceColumnsMemo?.columns === columns && this.sourceColumnsMemo.rows === this.sourceRows) return this.sourceColumnsMemo.value;
    const rows = this.sourceRows; const version = this.sourceVersion;
    const current = () => this.isConnected && this.sourceMode && this.sourceVersion === version && this.sourceRows === rows;
    const value = columns.map(column => {
      const wrapped = { ...column };
      for (const name of ['cell', 'cellStyle', 'cellTitle', 'heatValue', 'editValue', 'editLabel'] as const) {
        const callback = column[name];
        if (typeof callback !== 'function') continue;
        Object.assign(wrapped, { [name]: (row: EvalRunResult) => {
          if (!current() || !rows.includes(row)) return undefined;
          const result = callback.call(column, this.sourceOriginals.get(row)!);
          return current() ? result : undefined;
        } });
      }
      if (column.footer) wrapped.footer = pageRows => {
        if (!current()) return undefined;
        const result = column.footer!(pageRows.map(row => this.sourceOriginals.get(row)!));
        return current() ? result : undefined;
      };
      return wrapped;
    });
    this.sourceColumnsMemo = { columns, rows, value }; return value;
  }

  /** The runs (one per model or prompt version) being compared for this evaluation example. Empty
   *  ids are omitted and duplicates normalize first-wins before selection, diff, grid, and review
   *  events. */
  @property({ attribute: false }) runs: readonly EvalRunResult[] = EMPTY_RUNS;

  /** Column definitions for the comparison grid -- forwarded to `<lr-table>` after malformed and
   *  empty keys are omitted and duplicate keys normalize first-wins.
   *  Each column now needs a `cell(row)` accessor (`<lr-table>`'s `TableColumn` shape), not the old
   *  `<lr-data-grid>` `DataGridColumn`'s optional `value(row)`. */
  @property({ attribute: false }) columns: readonly TableColumn<EvalRunResult>[] = EMPTY_COLUMNS;

  /** Rubric field definitions for the review form. Empty keys are omitted and duplicate keys
   *  normalize first-wins before the review form receives them. */
  @property({ attribute: false }) rubricKeys: readonly RubricKey[] = EMPTY_KEYS;

  /** Accessible name for the independently interactive comparison grid. Falls back to the
   *  localized evaluation-runs label when unset or empty, since the grid needs a name. */
  @property() label = '';

  private get normalizedRuns(): EvalRunResult[] {
    return firstByIdentityMemo(Array.isArray(this.runs) ? this.runs : [], runId);
  }
  private get normalizedColumns(): TableColumn<EvalRunResult>[] {
    return firstByIdentityMemo(Array.isArray(this.columns) ? this.columns : [], columnKey);
  }
  private get normalizedRubricKeys(): RubricKey[] {
    return firstByIdentityMemo(Array.isArray(this.rubricKeys) ? this.rubricKeys : [], rubricKey);
  }

  /** The run currently open for review, and the diff's "new" side. `null` falls back to the first
   *  valid run; an unmatched identity selects no run. */
  @property({ attribute: 'selected-run-id' }) selectedRunId: string | null = null;

  /** The run compared against, and the diff's "old" side. `null` falls back to the first valid run;
   *  an unmatched identity selects no baseline. */
  @property({ attribute: 'baseline-run-id' }) baselineRunId: string | null = null;

  /** Shows a Skip control on the review form (forwarded to `<lr-rubric-form>`'s own `skippable`). */
  @property({ type: Boolean, attribute: 'review-skippable' }) reviewSkippable = false;

  /** Disables the review form's controls. The comparison grid stays interactive (selecting a run to inspect is not a mutation). */
  @property({ type: Boolean, reflect: true }) disabled = false;

  private get effectiveSelectedRunId(): string {
    return this.selectedRunId ?? (this.sourceMode ? this.fallbackId : this.normalizedRuns[0]?.id) ?? '';
  }

  private get selectedRun(): EvalRunResult | undefined {
    const id = this.effectiveSelectedRunId;
    return this.sourceMode ? this.sourcePair.find(record => record.key === id)?.value : this.normalizedRuns.find((run) => run.id === id);
  }

  private get effectiveBaselineRunId(): string {
    return this.baselineRunId ?? (this.sourceMode ? this.fallbackId : this.normalizedRuns[0]?.id) ?? '';
  }

  private get baselineRun(): EvalRunResult | undefined {
    const id = this.effectiveBaselineRunId;
    return this.sourceMode ? this.sourcePair.find(record => record.key === id)?.value : this.normalizedRuns.find((run) => run.id === id);
  }

  private stopOwnedEvent(event: Event): void {
    event.stopPropagation();
  }

  private reviewBinding?: { id: string; json: string; value: RubricValue };

  /** One value object per run and stored review, so a re-render never re-seeds the form's draft. */
  private reviewValue(run: EvalRunResult): RubricValue {
    const json = JSON.stringify(run.review ?? null);
    if (this.reviewBinding?.id !== run.id || this.reviewBinding.json !== json)
      this.reviewBinding = { id: run.id, json, value: run.review ?? {} };
    return this.reviewBinding.value;
  }

  private renderReview(selected: EvalRunResult): TemplateResult | typeof nothing {
    const source = this.sourceMode; const epoch = this.sourceEpoch; const version = this.pairVersion;
    const current = () => (!source && !this.sourceMode) || (source && this.isConnected && this.sourceMode && this.sourceEpoch === epoch && this.pairVersion === version && this.selectedRun === selected && !this.pairFailure);
    let value: RubricValue;
    if (source) {
      try {
        const keys = this.normalizedRubricKeys;
        if (this.sourceReviewMemo?.run !== selected || this.sourceReviewMemo.keys !== keys) {
          const projected = projectEvalSourceReview(selected.review, keys, current);
          if (!current()) return nothing;
          this.sourceReviewMemo = { run: selected, keys, value: projected };
        }
        value = this.sourceReviewMemo.value;
      } catch (error) { if (current()) { this.pairFailure = error; this.sourceStateVersion++; } return nothing; }
    } else value = this.reviewValue(selected);
    return html`<lr-rubric-form
      part="review"
      .keys=${this.normalizedRubricKeys}
      .value=${value}
      item-id=${selected.id}
      ?skippable=${this.reviewSkippable}
      ?disabled=${this.disabled}
      @input=${this.stopOwnedEvent}
      @change=${this.stopOwnedEvent}
      @focus=${this.stopOwnedEvent}
      @blur=${this.stopOwnedEvent}
      @lr-invalid=${this.stopOwnedEvent}
      @lr-input=${(e: CustomEvent<{ value: RubricValue }>) => {
        e.stopPropagation();
        if (!current() || (source && this.disabled)) return;
        this.emit('lr-review-input', { runId: selected.id, value: e.detail.value });
      }}
      @lr-validity-change=${(e: CustomEvent<{ valid: boolean; errors: Record<string, string> }>) => {
        e.stopPropagation();
        if (!current() || (source && this.disabled)) return;
        this.emit('lr-review-validity-change', { runId: selected.id, valid: e.detail.valid, errors: e.detail.errors });
      }}
      @lr-submit=${(e: CustomEvent<{ value: RubricValue; itemId: string }>) => {
        e.stopPropagation();
        if (!current() || (source && this.disabled)) return;
        this.emit('lr-review-submit', { runId: source ? selected.id : e.detail.itemId, value: e.detail.value });
      }}
      @lr-skip=${(e: CustomEvent<{ itemId: string }>) => {
        e.stopPropagation();
        if (!current() || (source && this.disabled)) return;
        this.emit('lr-review-skip', { runId: source ? selected.id : e.detail.itemId });
      }}
    ></lr-rubric-form>`;
  }

  private renderDiff(selected: EvalRunResult, baseline: EvalRunResult | undefined): TemplateResult {
    const comparing = Boolean(baseline && baseline.id !== selected.id);
    const selectedOutput = typeof selected.output === 'string' ? selected.output : '';
    const baselineOutput = typeof baseline?.output === 'string' ? baseline.output : selectedOutput;
    return html`<div part="diff">
      ${comparing
        ? html`<div part="diff-labels">
            <span part="diff-label-old">${baseline!.label}</span>
            <span part="diff-label-new">${selected.label}</span>
          </div>`
        : nothing}
      <lr-diff-view
        part="diff-view"
        layout=${comparing ? 'split' : 'unified'}
        .oldText=${baselineOutput}
        .newText=${selectedOutput}
        @lr-copy=${this.stopOwnedEvent}
        @lr-error=${this.stopOwnedEvent}
        @lr-copy-error=${this.stopOwnedEvent}
      ></lr-diff-view>
    </div>`;
  }

  override render(): TemplateResult {
    const source = this.sourceMode;
    const runs = source ? this.sourceRows : this.normalizedRuns;
    const version = this.sourceVersion; const pairVersion = this.pairVersion;
    const state = this.sourcePages.state;
    const current = () => this.isConnected && this.sourceMode && this.sourceVersion === version && this.sourceRows === runs;
    if (source && !state.pending && !this.sourcePriming && (this.sourceResult || state.error || this.sourceFailure)) this.sourceTableShown = true;
    if (source && !this.sourceTableShown) return html`<div part="base"><p part="source-status">${this.localize('loading')}</p></div>`;
    if (!source && runs.length === 0) {
      return html`<div part="base"><p part="empty">${this.localize('noData')}</p></div>`;
    }
    const selected = this.selectedRun;
    const review = selected && !this.pairFailure && !state.selectionPending ? this.renderReview(selected) : nothing;
    const selectionFailed = source && !!(this.pairFailure || state.selectionError);
    const selectionLoading = source && (state.selectionPending || ((this.selectedRunId === null || this.baselineRunId === null) && this.fallbackId === undefined));
    return html`
      <div part="base">
        <lr-table
          part="grid"
          .columns=${source ? this.sourceColumns() : this.normalizedColumns}
          .paginationMode=${source ? 'server' : 'client'}
          .sortMode=${source ? 'server' : 'client'}
          .page=${source ? finiteInteger(this.sourcePage, 0, 0, Number.MAX_SAFE_INTEGER - 1) + 1 : 1}
          .pageSize=${source ? finiteInteger(this.sourcePageSize, 100, 1, 500) : 100}
          .sortKey=${source ? this.sourceSortKey ?? '' : ''}
          .sortDir=${source ? this.sourceSortDir : 'asc'}
          .totalItems=${source ? this.sourceTotal ?? 0 : 0}
          .unknownTotal=${source && this.sourceTotal === null}
          .hasNext=${false}
          .loading=${source && (state.pending || this.sourcePriming)}
          .error=${source && !!(state.error || this.sourceFailure)}
          .strings=${this.strings}
          .rows=${runs}
          .rowKey=${rowKey}
          .selectionMode=${'single'}
          .selectedRowKeys=${new Set([this.effectiveSelectedRunId])}
          aria-label=${this.label || this.localize('evaluationDashboardRunsLabel')}
          @input=${this.stopOwnedEvent}
          @change=${this.stopOwnedEvent}
          @focus=${this.stopOwnedEvent}
          @blur=${this.stopOwnedEvent}
          @lr-sort-request=${(e: LyraTableEventMap<EvalRunResult>['lr-sort-request']) => {
            if (!source) { e.stopPropagation(); return; }
            if (!current()) { e.preventDefault(); e.stopPropagation(); return; }
            this.sortRequest = { target: e.currentTarget, version, columns: this.columns, key: e.detail.sortKey, dir: e.detail.sortDir };
          }}
          @lr-priority-columns-visibility-change=${this.stopOwnedEvent}
          @lr-sort=${(e: LyraTableEventMap<EvalRunResult>['lr-sort']) => {
            if (!source) { e.stopPropagation(); return; }
            const request = this.sortRequest; this.sortRequest = undefined;
            if (!current() || !request || request.target !== e.currentTarget || request.version !== version || request.columns !== this.columns || request.key !== e.detail.sortKey || request.dir !== e.detail.sortDir) { e.stopPropagation(); return; }
            this.sourceSortKey = e.detail.sortKey; this.sourceSortDir = e.detail.sortDir;
            this.syncSource(); this.sourceStateVersion++;
          }}
          @lr-row-expand-toggle=${this.stopOwnedEvent}
          @lr-load-more=${this.stopOwnedEvent}
          @lr-selection-change=${this.stopOwnedEvent}
          @lr-filter-change=${this.stopOwnedEvent}
          @lr-page-change=${(e: CustomEvent<{ page: number }>) => { e.stopPropagation(); if (source && current()) this.sourcePage = e.detail.page - 1; }}
          @lr-retry-request=${(e: Event) => { e.stopPropagation(); if (source && current()) this.requestUpdate(); }}
          @lr-cell-edit=${this.stopOwnedEvent}
          @lr-column-resize=${this.stopOwnedEvent}
          @lr-row-activate=${(e: CustomEvent<{ row: EvalRunResult }>) => {
            e.stopPropagation();
            const run = e.detail.row;
            if (source) {
              if (!current() || !runs.includes(run)) return;
              this.emit('lr-run-activate', Object.freeze({ runId: run.id, run }));
            } else if (!this.sourceMode) this.emit('lr-run-activate', snapshotEventDetail({ runId: run.id, run }, this.ownerDocument.defaultView) as LyraEventDetailSnapshot<AgentRunActivateDetail<EvalRunResult>>);
          }}
          @lr-row-click=${this.stopOwnedEvent}
        ></lr-table>
        ${selectionLoading || selectionFailed ? html`<div part="selection-status">${this.localize(selectionFailed ? 'sourceSelectionFailed' : 'sourceSelectionLoading')}${selectionFailed ? html`<button part="selection-retry" data-agent-action type="button" @click=${() => { if (current() && this.pairVersion === pairVersion) this.syncPair(true); }}>${this.localize('retry')}</button>` : nothing}</div>` : nothing}
        ${review}
        ${selected && !selectionFailed && !selectionLoading ? this.renderDiff(selected, this.baselineRun) : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-eval-result': LyraEvalResult;
  }
}

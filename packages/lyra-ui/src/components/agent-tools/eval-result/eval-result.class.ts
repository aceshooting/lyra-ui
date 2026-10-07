import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import {
  LyraElement,
  type LyraEventDetailSnapshot,
} from '../../../internal/lyra-element.js';
import { styles } from './eval-result.styles.js';
import type { RubricKey, RubricValue } from '../../forms/rubric-form/rubric-form.class.js';
import type { AgentRunActivateDetail } from '../run-events.js';
import { firstByIdentityMemo } from '../collection-identity.js';
import type { TableColumn } from '../../data/table/table.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_evaluationDashboardRunsLabel, LYRA_DEFAULT_noData } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const EMPTY_RUNS: EvalRunResult[] = [];
const EMPTY_COLUMNS: TableColumn<EvalRunResult>[] = [];
const EMPTY_KEYS: RubricKey[] = [];
const runId = (run: EvalRunResult): unknown => run.id;
const columnKey = (column: TableColumn<EvalRunResult>): unknown => column.key;
const rubricKey = (key: RubricKey): unknown => key.key;
const rowKey = (row: EvalRunResult): string => row.id;

/**
 * One model/prompt-version's output for a single evaluation example, plus whatever automated
 * `scores` it already carries and whatever `review` a human has entered for it so far. `scores`
 * and `review` are both keyed the same way as the `rubricKeys` passed to this component -- the
 * same `RubricValue` shape `<lr-rubric-form>` itself reads and writes -- so a `TableColumn`'s
 * `cell()` accessor and the rubric form's own `value` binding can both read a run's fields with
 * no conversion.
 */
export interface EvalRunResult {
  readonly id: string;
  readonly label: string;
  readonly model?: string;
  readonly promptVersion?: string;
  readonly output: string;
  readonly scores?: RubricValue;
  readonly review?: RubricValue;
}

export interface LyraEvalResultEventMap {
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
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-eval-result
 * @event lr-run-activate - A comparison-grid row was activated. `detail: { runId, run }`.
 * @event lr-review-input - The selected run's rubric value changed. `detail: { runId, value }`.
 * @event lr-review-validity-change - The selected run's rubric validity changed. `detail: { runId, valid, errors }`.
 * @event lr-review-submit - The selected run's rubric form was submitted. `detail: { runId, value }`.
 * @event lr-review-skip - The selected run's rubric form was skipped (`reviewSkippable` only). `detail: { runId }`.
 * @csspart base - The outer wrapper.
 * @csspart empty - The message shown when `runs` has no entries.
 * @csspart grid - The `<lr-table>` comparison table.
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
    noData: LYRA_DEFAULT_noData,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze(['runs', 'columns', 'rubricKeys']);

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-run-activate',
    'lr-review-input',
    'lr-review-validity-change',
    'lr-review-submit',
    'lr-review-skip',
  ]);

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
    return this.selectedRunId ?? this.normalizedRuns[0]?.id ?? '';
  }

  private get selectedRun(): EvalRunResult | undefined {
    const id = this.effectiveSelectedRunId;
    return this.normalizedRuns.find((run) => run.id === id);
  }

  private get effectiveBaselineRunId(): string {
    return this.baselineRunId ?? this.normalizedRuns[0]?.id ?? '';
  }

  private get baselineRun(): EvalRunResult | undefined {
    const id = this.effectiveBaselineRunId;
    return this.normalizedRuns.find((run) => run.id === id);
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

  private renderReview(selected: EvalRunResult): TemplateResult {
    return html`<lr-rubric-form
      part="review"
      .keys=${this.normalizedRubricKeys}
      .value=${this.reviewValue(selected)}
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
        this.emit('lr-review-input', { runId: selected.id, value: e.detail.value });
      }}
      @lr-validity-change=${(e: CustomEvent<{ valid: boolean; errors: Record<string, string> }>) => {
        e.stopPropagation();
        this.emit('lr-review-validity-change', { runId: selected.id, valid: e.detail.valid, errors: e.detail.errors });
      }}
      @lr-submit=${(e: CustomEvent<{ value: RubricValue; itemId: string }>) => {
        e.stopPropagation();
        this.emit('lr-review-submit', { runId: e.detail.itemId, value: e.detail.value });
      }}
      @lr-skip=${(e: CustomEvent<{ itemId: string }>) => {
        e.stopPropagation();
        this.emit('lr-review-skip', { runId: e.detail.itemId });
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
    const runs = this.normalizedRuns;
    if (runs.length === 0) {
      return html`<div part="base"><p part="empty">${this.localize('noData')}</p></div>`;
    }
    const selected = this.selectedRun;
    return html`
      <div part="base">
        <lr-table
          part="grid"
          .columns=${this.normalizedColumns}
          .rows=${runs}
          .rowKey=${rowKey}
          .selectionMode=${'single'}
          .selectedRowKeys=${new Set([this.effectiveSelectedRunId])}
          aria-label=${this.label || this.localize('evaluationDashboardRunsLabel')}
          @input=${this.stopOwnedEvent}
          @change=${this.stopOwnedEvent}
          @focus=${this.stopOwnedEvent}
          @blur=${this.stopOwnedEvent}
          @lr-sort-request=${this.stopOwnedEvent}
          @lr-priority-columns-visibility-change=${this.stopOwnedEvent}
          @lr-sort=${this.stopOwnedEvent}
          @lr-row-expand-toggle=${this.stopOwnedEvent}
          @lr-load-more=${this.stopOwnedEvent}
          @lr-selection-change=${this.stopOwnedEvent}
          @lr-filter-change=${this.stopOwnedEvent}
          @lr-page-change=${this.stopOwnedEvent}
          @lr-cell-edit=${this.stopOwnedEvent}
          @lr-column-resize=${this.stopOwnedEvent}
          @lr-row-activate=${(e: CustomEvent<{ row: EvalRunResult }>) => {
            e.stopPropagation();
            this.emit('lr-run-activate', { runId: e.detail.row.id, run: e.detail.row });
          }}
          @lr-row-click=${this.stopOwnedEvent}
        ></lr-table>
        ${selected ? this.renderReview(selected) : nothing}
        ${selected ? this.renderDiff(selected, this.baselineRun) : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-eval-result': LyraEvalResult;
  }
}

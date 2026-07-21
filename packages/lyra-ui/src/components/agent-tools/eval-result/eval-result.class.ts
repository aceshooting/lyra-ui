import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './eval-result.styles.js';
import type { RubricKey, RubricValue } from '../../forms/rubric-form/rubric-form.class.js';
import type { TableColumn } from '../../data/table/table.class.js';
import '../../forms/rubric-form/rubric-form.class.js';
import '../../data/table/table.class.js';
import '../../utility/diff-view/diff-view.class.js';

const EMPTY_RUNS: EvalRunResult[] = [];
const EMPTY_COLUMNS: TableColumn<EvalRunResult>[] = [];
const EMPTY_KEYS: RubricKey[] = [];
const EMPTY_VALUE: RubricValue = {};

/**
 * One model/prompt-version's output for a single evaluation example, plus whatever automated
 * `scores` it already carries and whatever `review` a human has entered for it so far. `scores`
 * and `review` are both keyed the same way as the `rubricKeys` passed to this component -- the
 * same `RubricValue` shape `<lr-rubric-form>` itself reads and writes -- so a `TableColumn`'s
 * `cell()` accessor and the rubric form's own `value` binding can both read a run's fields with
 * no conversion.
 */
export interface EvalRunResult {
  id: string;
  label: string;
  model?: string;
  promptVersion?: string;
  output: string;
  scores?: RubricValue;
  review?: RubricValue;
}

export interface LyraEvalResultEventMap {
  'lr-run-select': CustomEvent<{ runId: string }>;
  'lr-review-input': CustomEvent<{ runId: string; value: RubricValue }>;
  'lr-review-validity-change': CustomEvent<{ runId: string; valid: boolean; errors: Record<string, string> }>;
  'lr-review-submit': CustomEvent<{ runId: string; value: RubricValue }>;
  'lr-review-skip': CustomEvent<{ runId: string }>;
}

/**
 * `<lr-eval-result>` — rubric scoring, human review, and comparison across a single evaluation
 * example's runs (one per model or prompt version), LangSmith/Arize-eval-result style.
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
 * response to `lr-run-select`, the same shape `<lr-rubric-form>`'s own `itemId` already uses. A
 * `selectedRunId`/`baselineRunId` that doesn't match any entry in `runs` degrades gracefully: the
 * comparison grid still renders, and the review/diff sections simply don't (no error, no crash).
 *
 * @customElement lr-eval-result
 * @event lr-run-select - A comparison-grid row was activated. `detail: { runId }`.
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
 */
export class LyraEvalResult extends LyraElement<LyraEvalResultEventMap> {
  static styles = [LyraElement.styles, styles];

  /** The runs (one per model or prompt version) being compared for this evaluation example. */
  @property({ attribute: false }) runs: EvalRunResult[] = EMPTY_RUNS;

  /** Column definitions for the comparison grid -- forwarded verbatim to `<lr-table>`'s own `columns`.
   *  Each column now needs a `cell(row)` accessor (`<lr-table>`'s `TableColumn` shape), not the old
   *  `<lr-data-grid>` `DataGridColumn`'s optional `value(row)`. */
  @property({ attribute: false }) columns: TableColumn<EvalRunResult>[] = EMPTY_COLUMNS;

  /** Rubric field definitions for the review form -- forwarded verbatim to `<lr-rubric-form>`'s own `keys`. */
  @property({ attribute: false }) rubricKeys: RubricKey[] = EMPTY_KEYS;

  /** The run currently open for review, and the diff's "new" side. Falls back to `runs[0]?.id` when unset. */
  @property({ attribute: 'selected-run-id' }) selectedRunId = '';

  /** The run compared against, and the diff's "old" side. Falls back to `runs[0]?.id` when unset. */
  @property({ attribute: 'baseline-run-id' }) baselineRunId = '';

  /** Shows a Skip control on the review form (forwarded to `<lr-rubric-form>`'s own `skippable`). */
  @property({ type: Boolean, attribute: 'review-skippable' }) reviewSkippable = false;

  /** Disables the review form's controls. The comparison grid stays interactive (selecting a run to inspect is not a mutation). */
  @property({ type: Boolean, reflect: true }) disabled = false;

  private get effectiveSelectedRunId(): string {
    return this.selectedRunId || this.runs[0]?.id || '';
  }

  private get selectedRun(): EvalRunResult | undefined {
    const id = this.effectiveSelectedRunId;
    return this.runs.find((run) => run.id === id);
  }

  private get effectiveBaselineRunId(): string {
    return this.baselineRunId || this.runs[0]?.id || '';
  }

  private get baselineRun(): EvalRunResult | undefined {
    const id = this.effectiveBaselineRunId;
    return this.runs.find((run) => run.id === id);
  }

  private renderReview(selected: EvalRunResult): TemplateResult {
    return html`<lr-rubric-form
      part="review"
      .keys=${this.rubricKeys}
      .value=${selected.review ?? EMPTY_VALUE}
      item-id=${selected.id}
      ?skippable=${this.reviewSkippable}
      ?disabled=${this.disabled}
      @lr-input=${(e: CustomEvent<{ value: RubricValue }>) =>
        this.emit('lr-review-input', { runId: selected.id, value: e.detail.value })}
      @lr-validity-change=${(e: CustomEvent<{ valid: boolean; errors: Record<string, string> }>) =>
        this.emit('lr-review-validity-change', { runId: selected.id, valid: e.detail.valid, errors: e.detail.errors })}
      @lr-submit=${(e: CustomEvent<{ value: RubricValue; itemId: string }>) =>
        this.emit('lr-review-submit', { runId: e.detail.itemId, value: e.detail.value })}
      @lr-skip=${(e: CustomEvent<{ itemId: string }>) => this.emit('lr-review-skip', { runId: e.detail.itemId })}
    ></lr-rubric-form>`;
  }

  private renderDiff(selected: EvalRunResult, baseline: EvalRunResult | undefined): TemplateResult {
    const comparing = Boolean(baseline && baseline.id !== selected.id);
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
        .oldText=${baseline?.output ?? selected.output}
        .newText=${selected.output}
      ></lr-diff-view>
    </div>`;
  }

  render(): TemplateResult {
    if (this.runs.length === 0) {
      return html`<div part="base"><p part="empty">${this.localize('noData')}</p></div>`;
    }
    const selected = this.selectedRun;
    return html`
      <div part="base">
        <lr-table
          part="grid"
          .columns=${this.columns}
          .rows=${this.runs}
          .rowKey=${(row: EvalRunResult) => row.id}
          .selectedKey=${this.effectiveSelectedRunId}
          aria-label=${this.getAttribute('aria-label') || nothing}
          @lr-row-click=${(e: CustomEvent<{ row: EvalRunResult }>) => this.emit('lr-run-select', { runId: e.detail.row.id })}
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

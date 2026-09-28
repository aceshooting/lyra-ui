import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { styles } from './background-runs.styles.js';
import { firstByIdentity } from '../collection-identity.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_agentRunStatusCancelled, LYRA_DEFAULT_agentRunStatusQueued, LYRA_DEFAULT_backgroundRunsCancelFor, LYRA_DEFAULT_backgroundRunsEmpty, LYRA_DEFAULT_backgroundRunsLabel, LYRA_DEFAULT_backgroundRunsLimit, LYRA_DEFAULT_backgroundRunsOpenFor, LYRA_DEFAULT_backgroundRunsStatusCompleted, LYRA_DEFAULT_backgroundRunsStatusFailed, LYRA_DEFAULT_cancel, LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_statusRunning } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type BackgroundRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

/** Host-owned state for one background run. Status is display-only and never inferred or mutated. */
export interface BackgroundRun {
  id: string;
  label: string;
  description?: string;
  status: BackgroundRunStatus;
}

export interface LyraBackgroundRunsEventMap {
  'lr-run-open': CustomEvent<{ runId: string }>;
  'lr-run-cancel': CustomEvent<{ runId: string }>;
}

const MAX_RENDERED_RUNS = 100;
const STATUSES: readonly BackgroundRunStatus[] = ['queued', 'running', 'completed', 'failed', 'cancelled'];
const STATUS_LABEL_KEY: Record<BackgroundRunStatus, string> = {
  queued: 'agentRunStatusQueued',
  running: 'statusRunning',
  completed: 'backgroundRunsStatusCompleted',
  failed: 'backgroundRunsStatusFailed',
  cancelled: 'agentRunStatusCancelled',
};
const CANCELLABLE_STATUSES: ReadonlySet<BackgroundRunStatus> = new Set(['queued', 'running']);

/**
 * `<lr-background-runs>` — a bounded, controlled list of background run states. Open and eligible
 * cancel buttons emit host requests only; statuses remain host-owned and this component never
 * polls, starts timers, or executes a run operation. Blank ids are skipped, duplicate ids retain
 * the first valid item, and no more than 100 rows are mounted.
 *
 * @customElement lr-background-runs
 * @event lr-run-open - A run was requested for opening. `detail: { runId }`.
 * @event lr-run-cancel - A queued or running run was requested for cancellation. `detail: { runId }`.
 *   Terminal or missing runs cannot emit this event.
 * @csspart base - The fieldset and group.
 * @csspart legend - The visible component label.
 * @csspart list - The run rows.
 * @csspart run - One run row, keyed by `data-run-id`.
 * @csspart run-copy - The run label and description.
 * @csspart label - The host-supplied run label.
 * @csspart description - Optional host-supplied run description.
 * @csspart status - The localized controlled status.
 * @csspart actions - The open and optional cancel buttons.
 * @csspart open - The native open button.
 * @csspart cancel - The native cancel button, present only for queued/running runs.
 * @csspart empty - The empty state.
 * @csspart limit - Localized notice shown when more than 100 valid runs are supplied.
 * @status experimental
 * @since 22.0.0
 */
export class LyraBackgroundRuns extends LyraElement<LyraBackgroundRunsEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    agentRunStatusCancelled: LYRA_DEFAULT_agentRunStatusCancelled,
    agentRunStatusQueued: LYRA_DEFAULT_agentRunStatusQueued,
    backgroundRunsCancelFor: LYRA_DEFAULT_backgroundRunsCancelFor,
    backgroundRunsEmpty: LYRA_DEFAULT_backgroundRunsEmpty,
    backgroundRunsLabel: LYRA_DEFAULT_backgroundRunsLabel,
    backgroundRunsLimit: LYRA_DEFAULT_backgroundRunsLimit,
    backgroundRunsOpenFor: LYRA_DEFAULT_backgroundRunsOpenFor,
    backgroundRunsStatusCompleted: LYRA_DEFAULT_backgroundRunsStatusCompleted,
    backgroundRunsStatusFailed: LYRA_DEFAULT_backgroundRunsStatusFailed,
    cancel: LYRA_DEFAULT_cancel,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    statusRunning: LYRA_DEFAULT_statusRunning,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;
  protected static override readonly ownedCollectionProperties = Object.freeze(['runs']);

  static override styles = [LyraElement.styles, styles];

  /** Ordered host-owned records. The component never mutates assigned runs. */
  @property({ attribute: false }) runs: readonly BackgroundRun[] = [];
  /** Accessible group name and visible legend. */
  @property() label?: string;
  /** Disables all run actions. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  private dispatchingRequest = false;

  private get normalizedRuns(): BackgroundRun[] {
    const runs = Array.isArray(this.runs) ? this.runs : [];
    const valid = runs.filter((run): run is BackgroundRun => {
      try {
        return Boolean(run && typeof run.label === 'string' && STATUSES.includes(run.status));
      } catch {
        return false;
      }
    });
    return firstByIdentity(valid, (run) => run.id);
  }

  private requestOpen(runId: string): void {
    if (this.disabled || !this.normalizedRuns.some((run) => run.id === runId) || this.dispatchingRequest) return;
    this.dispatchingRequest = true;
    try {
      this.emit('lr-run-open', { runId });
    } finally {
      this.dispatchingRequest = false;
    }
  }

  private requestCancel(runId: string): void {
    if (this.disabled) return;
    const current = this.normalizedRuns.find((run) => run.id === runId);
    if (!current || !CANCELLABLE_STATUSES.has(current.status) || this.dispatchingRequest) return;
    this.dispatchingRequest = true;
    try {
      this.emit('lr-run-cancel', { runId });
    } finally {
      this.dispatchingRequest = false;
    }
  }

  private renderRun(run: BackgroundRun): TemplateResult {
    const cancellable = CANCELLABLE_STATUSES.has(run.status);
    return html`
      <div part="run" role="listitem" data-run-id=${run.id}>
        <div part="run-copy">
          <span part="label">${run.label}</span>
          ${run.description ? html`<span part="description">${run.description}</span>` : nothing}
        </div>
        <span part="status" data-status=${run.status}>${this.localize(STATUS_LABEL_KEY[run.status])}</span>
        <div part="actions">
          <button
            part="open"
            type="button"
            aria-label=${this.localize('backgroundRunsOpenFor', undefined, { label: run.label })}
            ?disabled=${this.disabled}
            @click=${() => this.requestOpen(run.id)}
          >${this.localize('open')}</button>
          ${cancellable
            ? html`<button
                part="cancel"
                type="button"
                aria-label=${this.localize('backgroundRunsCancelFor', undefined, { label: run.label })}
                ?disabled=${this.disabled}
                @click=${() => this.requestCancel(run.id)}
              >${this.localize('cancel')}</button>`
            : nothing}
        </div>
      </div>
    `;
  }

  override render(): TemplateResult {
    const runs = this.normalizedRuns;
    const visibleLabel = this.label == null ? this.localize('backgroundRunsLabel') : this.label;
    const hostLabel = hostAriaLabel(this);
    return html`
      <fieldset part="base" aria-label=${hostLabel === null ? nothing : hostLabel} ?disabled=${this.disabled}>
        <legend part="legend">${visibleLabel}</legend>
        ${runs.length === 0
          ? html`<p part="empty">${this.localize('backgroundRunsEmpty')}</p>`
          : html`<div part="list" role="list">
              ${runs.slice(0, MAX_RENDERED_RUNS).map((run) => this.renderRun(run))}
            </div>`}
        ${runs.length > MAX_RENDERED_RUNS
          ? html`<p part="limit">${this.localize('backgroundRunsLimit', undefined, {
              count: getNumberFormat(this.effectiveLocale).format(MAX_RENDERED_RUNS),
            })}</p>`
          : nothing}
      </fieldset>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-background-runs': LyraBackgroundRuns;
  }
}

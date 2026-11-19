import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { normalizeLabel } from '../../../internal/accessible-name.js';
import { captureComposedFocusRepair } from '../../../internal/focus-navigation.js';
import { restoreComposedFocus } from '../../../internal/focus-repair.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { resolveListMove } from '../../../internal/list-navigation.js';
import { styles } from './background-runs.styles.js';
import { agentActionButtonStyles } from '../agent-action-button.styles.js';
import { firstByIdentity } from '../collection-identity.js';
import { normalizeAgentTerminalStatus } from '../../../internal/shared-unions.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_agentRunStatusCancelled, LYRA_DEFAULT_agentRunStatusQueued, LYRA_DEFAULT_backgroundRunsCancelFor, LYRA_DEFAULT_backgroundRunsEmpty, LYRA_DEFAULT_backgroundRunsLabel, LYRA_DEFAULT_backgroundRunsLimit, LYRA_DEFAULT_backgroundRunsOpenFor, LYRA_DEFAULT_backgroundRunsStatusCompleted, LYRA_DEFAULT_backgroundRunsStatusFailed } from '../../../internal/default-strings/agent-tools.generated.js';
import { LYRA_DEFAULT_cancel, LYRA_DEFAULT_collapse, LYRA_DEFAULT_copy, LYRA_DEFAULT_date, LYRA_DEFAULT_details, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_statusRunning, LYRA_DEFAULT_statusUnknown } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type BackgroundRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

/** Host-owned state for one background run. Status is display-only and never inferred or mutated. */
export interface BackgroundRun {
  id: string;
  label: string;
  description?: string;
  /** Shared terminal spellings are accepted alongside the component's original values. */
  status: BackgroundRunStatus | 'done' | 'success' | 'complete' | 'error';
}

type NormalizedRun = Omit<BackgroundRun, 'status'> & { status: BackgroundRunStatus | 'unknown' };

export interface LyraBackgroundRunsEventMap {
  'lr-run-activate': CustomEvent<{ runId: string }>;
  'lr-run-cancel': CustomEvent<{ runId: string }>;
}

const MAX_RENDERED_RUNS = 100;
const STATUSES: readonly BackgroundRunStatus[] = ['queued', 'running', 'completed', 'failed', 'cancelled'];
const STATUS_LABEL_KEY: Record<NormalizedRun['status'], string> = {
  queued: 'agentRunStatusQueued',
  running: 'statusRunning',
  completed: 'backgroundRunsStatusCompleted',
  failed: 'backgroundRunsStatusFailed',
  cancelled: 'agentRunStatusCancelled',
  unknown: 'statusUnknown',
};
const CANCELLABLE_STATUSES: ReadonlySet<NormalizedRun['status']> = new Set(['queued', 'running']);

/**
 * `<lr-background-runs>` — a bounded, controlled list of background run states. Open and eligible
 * cancel buttons emit host requests only; statuses remain host-owned and this component never
 * polls, starts timers, or executes a run operation. Blank ids are skipped, duplicate ids retain
 * the first valid item, and no more than 100 rows are mounted. Shared terminal spellings are
 * normalized; an explicit foreign status remains visible as a neutral unknown row.
 *
 * @customElement lr-background-runs
 * @event lr-run-activate - A run was requested for opening. `detail: { runId }`.
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
    copy: LYRA_DEFAULT_copy,
    date: LYRA_DEFAULT_date,
    details: LYRA_DEFAULT_details,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    statusRunning: LYRA_DEFAULT_statusRunning,
    statusUnknown: LYRA_DEFAULT_statusUnknown,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;
  protected static override readonly ownedCollectionProperties = Object.freeze(['runs']);

  static override styles = [LyraElement.styles, styles, agentActionButtonStyles];

  /** Ordered host-owned records. The component never mutates assigned runs. */
  @property({ attribute: false }) runs: readonly BackgroundRun[] = [];
  /** Accessible group name and visible legend. */
  @property() label?: string;
  /** Disables all run actions. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  private dispatchingRequest = false;
  private focusedRow?: Element | null;
  private readonly announcements = new AnnouncementSinkController(this, { eager: ['polite'] });
  /** The one row whose actions are in the tab sequence; the others are reached with arrow keys. */
  @state() private activeRunId?: string;

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.announcements.adopted();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('runs')) {
      const rows = this.normalizedRuns.slice(0, MAX_RENDERED_RUNS);
      if (!rows.some(run => run.id === this.activeRunId)) this.activeRunId = rows[0]?.id;
    }
    this.focusedRow = captureComposedFocusRepair(this, this)?.activeElement.closest('[data-run-id]');
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.focusedRow) restoreComposedFocus(this, true, this.focusedRow.querySelector<HTMLElement>('[part="open"]'));
    const limited = this.normalizedRuns.length > MAX_RENDERED_RUNS;
    this.announcements.transition('limit', limited ? 'limited' : 'complete', limited ? this.limitText() : '', 'polite');
  }

  private limitText(): string {
    return this.localize('backgroundRunsLimit', undefined, {
      count: getNumberFormat(this.effectiveLocale).format(MAX_RENDERED_RUNS),
    });
  }

  private onListKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.shiftKey) return;
    const target = event.target as HTMLElement;
    const rows = Array.from(this.renderRoot.querySelectorAll<HTMLElement>('[part="run"]'));
    const current = rows.findIndex((row) => row.contains(target));
    const next = rows[resolveListMove(event, { count: rows.length, current, orientation: 'vertical', wrap: false, clamp: true }) ?? -1];
    if (!next) return;
    event.preventDefault();
    (next.querySelector<HTMLElement>(`[part="${target.getAttribute('part')}"]`) ?? next.querySelector<HTMLElement>('[part="open"]'))?.focus();
  };

  private onListFocusIn = (event: FocusEvent): void => {
    this.activeRunId = (event.target as HTMLElement).closest<HTMLElement>('[data-run-id]')?.dataset['runId'];
  };

  private normalizedFor?: readonly BackgroundRun[];
  private normalizedCache: NormalizedRun[] = [];

  private get normalizedRuns(): NormalizedRun[] {
    if (this.normalizedFor !== this.runs) {
      this.normalizedFor = this.runs;
      const valid: NormalizedRun[] = [];
      for (const run of Array.isArray(this.runs) ? this.runs : []) {
        try {
          const terminal = normalizeAgentTerminalStatus(run.status);
          const status = terminal === 'success' ? 'completed' : terminal === 'error' ? 'failed' : terminal === 'cancelled' ? 'cancelled' : run.status;
          if (typeof run.label === 'string')
            valid.push({ ...run, status: (STATUSES as readonly string[]).includes(status) ? status as BackgroundRunStatus : 'unknown' });
        } catch {
          // A malformed row is skipped.
        }
      }
      this.normalizedCache = firstByIdentity(valid, (run) => run.id);
    }
    return this.normalizedCache;
  }

  private requestOpen(runId: string): void {
    if (this.disabled || !this.normalizedRuns.some((run) => run.id === runId) || this.dispatchingRequest) return;
    this.dispatchingRequest = true;
    try {
      this.emit('lr-run-activate', { runId });
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

  private renderRun(run: NormalizedRun, tabbable: boolean): TemplateResult {
    const cancellable = CANCELLABLE_STATUSES.has(run.status);
    const tabindex = tabbable ? nothing : '-1';
    const actionLabel = normalizeLabel(run.label) ?? run.id;
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
            data-agent-action="neutral"
            type="button"
            tabindex=${tabindex}
            aria-label=${this.localize('backgroundRunsOpenFor', undefined, { label: actionLabel })}
            ?disabled=${this.disabled}
            @click=${() => this.requestOpen(run.id)}
          >${this.localize('open')}</button>
          ${cancellable
            ? html`<button
                part="cancel"
                data-agent-action="neutral"
                type="button"
                tabindex=${tabindex}
                aria-label=${this.localize('backgroundRunsCancelFor', undefined, { label: actionLabel })}
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
    const rendered = runs.slice(0, MAX_RENDERED_RUNS);
    const visibleLabel = this.label == null ? this.localize('backgroundRunsLabel') : this.label;
    const hostLabel = hostAriaLabel(this);
    return html`
      <fieldset part="base" aria-label=${hostLabel === null ? nothing : hostLabel} ?disabled=${this.disabled}>
        <legend part="legend">${visibleLabel}</legend>
        ${runs.length === 0
          ? html`<p part="empty" tabindex="-1">${this.localize('backgroundRunsEmpty')}</p>`
          : html`<div part="list" role="list" @keydown=${this.onListKeyDown} @focusin=${this.onListFocusIn}>
              ${repeat(rendered, (run) => run.id, (run) => this.renderRun(run, run.id === this.activeRunId))}
            </div>`}
        ${runs.length > MAX_RENDERED_RUNS
          ? html`<p part="limit" role="note">${this.limitText()}</p>`
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

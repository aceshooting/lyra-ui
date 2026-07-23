import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { AgentStatusKind } from '../../../ai/types.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteRange } from '../../../internal/numbers.js';
import type { BadgeVariant } from '../../overlays/badge/badge.class.js';
import '../../overlays/badge/badge.class.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './subagent-panel.styles.js';

export interface SubagentRun {
  id: string;
  parentId?: string;
  label: string;
  status: AgentStatusKind;
  task?: string;
  model?: string;
  progress?: number;
  startedAt?: number;
  endedAt?: number;
  metadata?: Record<string, unknown>;
}
export interface LyraSubagentPanelEventMap {
  'lr-run-select': CustomEvent<{ run: SubagentRun }>;
  'lr-cancel': CustomEvent<{ runId: string }>;
  'lr-retry': CustomEvent<{ runId: string }>;
}

const STATUS_VARIANT: Partial<Record<AgentStatusKind, BadgeVariant>> = {
  idle: 'neutral', queued: 'neutral', running: 'brand', collecting: 'brand',
  'waiting-input': 'warning', 'waiting-approval': 'warning', done: 'success',
  error: 'danger', cancelled: 'neutral',
};
const ACTIVE = new Set<AgentStatusKind>(['queued', 'running', 'collecting', 'waiting-input', 'waiting-approval']);

/**
 * `<lr-subagent-panel>` — a controlled hierarchy of nested agent runs with lifecycle status,
 * task/model context, progress, selection, cancellation, and retry intents.
 *
 * @customElement lr-subagent-panel
 * @event lr-run-select - A complete subagent run was selected.
 * @event lr-cancel - Cancellation was requested for an active run.
 * @event lr-retry - Retry was requested for an errored/cancelled run.
 * @csspart base - The named subagent region.
 * @csspart list - Hierarchical run list.
 * @csspart run - One run.
 * @csspart run-selected - The selected run.
 * @csspart run-row - Run content and actions.
 * @csspart run-trigger - Run selection action.
 * @csspart label - Run label.
 * @csspart status - Lifecycle status badge.
 * @csspart task - Caller-supplied task text.
 * @csspart model - Caller-supplied model id.
 * @csspart progress - Progress indicator.
 * @csspart actions - Run actions.
 * @csspart cancel - Cancellation action.
 * @csspart retry - Retry action.
 * @csspart empty - The empty state.
 */
export class LyraSubagentPanel extends LyraElement<LyraSubagentPanelEventMap> {
  static override styles = [LyraElement.styles, styles];

  @property({ attribute: false }) runs: SubagentRun[] = [];
  @property({ attribute: 'selected-run-id' }) selectedRunId = '';
  @property() label = '';

  private statusLabel(status: AgentStatusKind): string {
    switch (status) {
      case 'idle': return this.localize('agentRunStatusIdle');
      case 'queued': return this.localize('agentRunStatusQueued');
      case 'running': return this.localize('statusRunning');
      case 'collecting': return this.localize('agentRunStatusCollecting');
      case 'waiting-input': return this.localize('agentRunStatusWaitingInput');
      case 'waiting-approval': return this.localize('agentRunStatusWaitingApproval');
      case 'done': return this.localize('agentRunStatusDone');
      case 'error': return this.localize('statusError');
      case 'cancelled': return this.localize('agentRunStatusCancelled');
      default: return status;
    }
  }

  private ordered(): Array<{ run: SubagentRun; depth: number }> {
    const byParent = new Map<string, SubagentRun[]>();
    const ids = new Set(this.runs.map((run) => run.id));
    for (const run of this.runs) {
      const parent = run.parentId && ids.has(run.parentId) ? run.parentId : '';
      byParent.set(parent, [...(byParent.get(parent) ?? []), run]);
    }
    const rows: Array<{ run: SubagentRun; depth: number }> = [];
    const visited = new Set<string>();
    const walk = (parent: string, depth: number): void => {
      for (const run of byParent.get(parent) ?? []) {
        if (visited.has(run.id)) continue;
        visited.add(run.id);
        rows.push({ run, depth });
        walk(run.id, depth + 1);
      }
    };
    walk('', 0);
    for (const run of this.runs) if (!visited.has(run.id)) rows.push({ run, depth: 0 });
    return rows;
  }

  private renderRun = ({ run, depth }: { run: SubagentRun; depth: number }): TemplateResult => {
    const selected = run.id === this.selectedRunId;
    const progress = typeof run.progress === 'number' ? finiteRange(run.progress, 0, 0, 1) : null;
    const runPart = selected ? 'run run-selected' : 'run';
    return html`
      <li
        part=${runPart}
        data-run-id=${run.id}
        data-depth=${depth}
        style=${styleMap({ '--lr-subagent-depth': String(depth) })}
      >
        <div part="run-row">
          <button
            part="run-trigger"
            type="button"
            aria-pressed=${selected ? 'true' : 'false'}
            @click=${() => this.emit('lr-run-select', { run })}
          >
            <span part="label">${run.label}</span>
            <lr-badge part="status" variant=${STATUS_VARIANT[run.status] ?? 'neutral'}>${this.statusLabel(run.status)}</lr-badge>
            ${run.task ? html`<span part="task">${run.task}</span>` : nothing}
            ${run.model ? html`<span part="model">${run.model}</span>` : nothing}
            ${progress != null
              ? html`<span
                  part="progress"
                  role="progressbar"
                  aria-label=${run.label}
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow=${Math.round(progress * 100)}
                ><span style=${styleMap({ inlineSize: `${progress * 100}%` })}></span></span>`
              : nothing}
          </button>
          <span part="actions">
            ${ACTIVE.has(run.status)
              ? html`<button part="cancel" type="button" aria-label=${this.localize('subagentPanelCancel')} @click=${() => this.emit('lr-cancel', { runId: run.id })}>×</button>`
              : nothing}
            ${run.status === 'error' || run.status === 'cancelled'
              ? html`<button part="retry" type="button" @click=${() => this.emit('lr-retry', { runId: run.id })}>${this.localize('subagentPanelRetry')}</button>`
              : nothing}
          </span>
        </div>
      </li>
    `;
  };

  override render(): TemplateResult {
    const label = this.getAttribute('aria-label') || this.label || this.localize('subagentPanelLabel');
    return html`
      <section part="base" aria-label=${label}>
        ${this.runs.length
          ? html`<ul part="list">${this.ordered().map(this.renderRun)}</ul>`
          : html`<lr-empty part="empty" heading=${this.localize('subagentPanelEmpty')}></lr-empty>`}
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-subagent-panel': LyraSubagentPanel;
  }
}

import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { AgentStatusKind } from '../../../ai/types.js';
import {
  LyraElement,
  type LyraEventDetailSnapshot,
} from '../../../internal/lyra-element.js';
import { finiteRange } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { AGENT_STATUS_VARIANTS } from '../../../internal/agent-status-variants.js';
import { firstByIdentity } from '../collection-identity.js';
import { agentStatusText } from '../../../internal/agent-status-text.js';
import { isRtl } from '../../../internal/rtl.js';
import type { LyraFrame, LyraSize } from '../../../internal/variants.js';
import '../../overlays/badge/badge.class.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './subagent-panel.styles.js';
import { agentActionButtonStyles } from '../agent-action-button.styles.js';
import type { AgentRunActivateDetail } from '../run-events.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_agentRunStatusCancelled, LYRA_DEFAULT_agentRunStatusCollecting, LYRA_DEFAULT_agentRunStatusDone, LYRA_DEFAULT_agentRunStatusIdle, LYRA_DEFAULT_agentRunStatusQueued, LYRA_DEFAULT_agentRunStatusWaitingApproval, LYRA_DEFAULT_agentRunStatusWaitingInput, LYRA_DEFAULT_collapse, LYRA_DEFAULT_copy, LYRA_DEFAULT_details, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_progress, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_statusError, LYRA_DEFAULT_statusRunning, LYRA_DEFAULT_subagentPanelCancelRun, LYRA_DEFAULT_subagentPanelEmpty, LYRA_DEFAULT_subagentPanelLabel, LYRA_DEFAULT_subagentPanelLimit, LYRA_DEFAULT_subagentPanelRetry, LYRA_DEFAULT_subagentPanelRetryRun } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface SubagentRun {
  readonly id: string;
  readonly parentId?: string;
  readonly label: string;
  readonly status: AgentStatusKind;
  readonly task?: string;
  readonly model?: string;
  /** Completion ratio in the inclusive 0..1 range. */
  readonly progressRatio?: number;
  readonly startedAt?: number;
  readonly endedAt?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
export interface LyraSubagentPanelEventMap {
  'lr-run-activate': CustomEvent<LyraEventDetailSnapshot<AgentRunActivateDetail<SubagentRun>>>;
  'lr-run-cancel': CustomEvent<LyraEventDetailSnapshot<{ runId: string }>>;
  'lr-cancel': CustomEvent<LyraEventDetailSnapshot<{ runId: string }>>;
  'lr-run-retry': CustomEvent<LyraEventDetailSnapshot<{ runId: string }>>;
}

const ACTIVE = new Set<AgentStatusKind>(['queued', 'running', 'collecting', 'waiting-input', 'waiting-approval']);
const MAX_RENDERED_RUNS = 500;
const MAX_VISUAL_INDENT_DEPTH = 12;

interface SubagentRow {
  run: SubagentRun;
  depth: number;
  posInSet: number;
  setSize: number;
}

interface OrderedRuns {
  rows: SubagentRow[];
  truncated: boolean;
}

/**
 * `<lr-subagent-panel>` — a controlled hierarchy of nested agent runs with lifecycle status,
 * task/model context, progress, selection, cancellation, and retry intents. Runs with empty ids
 * are omitted and later duplicate ids are ignored before hierarchy, focus, counts, and events.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-subagent-panel
 * @event lr-run-activate - A complete subagent run was activated. `detail: { runId, run }`.
 * @event lr-run-cancel - Cancellation was requested for an active run. `detail: { runId }`.
 * @event lr-cancel - Deprecated alias of `lr-run-cancel`, dispatched right after it.
 * @event lr-run-retry - Retry was requested for an errored/cancelled run.
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
 * @csspart limit - Resource-ceiling status shown when additional runs are omitted.
 * @csspart empty - The empty state.
 * @cssprop [--lr-subagent-panel-selected-border=var(--lr-color-brand)] - Selected run border.
 * @cssprop [--lr-subagent-panel-progress-track=var(--lr-color-border)] - Progress track.
 * @cssprop [--lr-subagent-panel-progress-fill=var(--lr-color-brand)] - Progress fill.
 * @cssprop [--lr-subagent-panel-compact-trigger-padding=var(--lr-space-2xs) var(--lr-space-s)] -
 *   `[part="run-trigger"]` padding while `size` is `s` or smaller.
 * @cssprop [--lr-subagent-panel-compact-trigger-gap=var(--lr-space-2xs)] - Gap between
 *   `[part="run-trigger"]`'s label/status/task/model/progress while `size` is `s` or smaller.
 * @cssprop [--lr-subagent-panel-compact-font-size=var(--lr-font-size-2xs)] - `[part="task"]`/
 *   `[part="model"]` font size while `size` is `s` or smaller.
 * @cssprop [--lr-subagent-panel-compact-action-padding=var(--lr-space-2xs)] - `[part="cancel"]`/
 *   `[part="retry"]` padding while `size` is `s` or smaller.
 * @cssprop [--lr-subagent-panel-bg=var(--lr-color-surface)] - Resting fill of each run
 *   row's trigger and action buttons. Hover and press follow
 *   `--lr-subagent-panel-hover-bg`, so retune both together.
 * @cssprop [--lr-subagent-panel-hover-bg=var(--lr-color-surface-raised)] - Hovered fill of
 *   each run row's trigger and action buttons. The pressed fill is this value mixed a further
 *   `--lr-color-mix-active` toward `--lr-color-mix-partner`, so retuning hover carries the press
 *   with it.
 * @cssprop [--lr-subagent-panel-border-color=var(--lr-color-border)] - Colour of each run row's
 *   border and of its action divider. A selected row still uses
 *   `--lr-subagent-panel-selected-border`.
 * @cssprop [--lr-subagent-panel-radius=var(--lr-radius)] - Corner radius of each run row.
 *   `frame="plain"` still squares the corners.
 * @status stable
 * @since 7.0.0
 */
export class LyraSubagentPanel extends LyraElement<LyraSubagentPanelEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    agentRunStatusCancelled: LYRA_DEFAULT_agentRunStatusCancelled,
    agentRunStatusCollecting: LYRA_DEFAULT_agentRunStatusCollecting,
    agentRunStatusDone: LYRA_DEFAULT_agentRunStatusDone,
    agentRunStatusIdle: LYRA_DEFAULT_agentRunStatusIdle,
    agentRunStatusQueued: LYRA_DEFAULT_agentRunStatusQueued,
    agentRunStatusWaitingApproval: LYRA_DEFAULT_agentRunStatusWaitingApproval,
    agentRunStatusWaitingInput: LYRA_DEFAULT_agentRunStatusWaitingInput,
    collapse: LYRA_DEFAULT_collapse,
    copy: LYRA_DEFAULT_copy,
    details: LYRA_DEFAULT_details,
    loading: LYRA_DEFAULT_loading,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    progress: LYRA_DEFAULT_progress,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    statusError: LYRA_DEFAULT_statusError,
    statusRunning: LYRA_DEFAULT_statusRunning,
    subagentPanelCancelRun: LYRA_DEFAULT_subagentPanelCancelRun,
    subagentPanelEmpty: LYRA_DEFAULT_subagentPanelEmpty,
    subagentPanelLabel: LYRA_DEFAULT_subagentPanelLabel,
    subagentPanelLimit: LYRA_DEFAULT_subagentPanelLimit,
    subagentPanelRetry: LYRA_DEFAULT_subagentPanelRetry,
    subagentPanelRetryRun: LYRA_DEFAULT_subagentPanelRetryRun,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze(['runs']);

  static override styles = [LyraElement.styles, styles, agentActionButtonStyles];

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-run-activate',
    'lr-run-cancel',
    'lr-cancel',
    'lr-run-retry',
  ]);

  @property({ attribute: false }) runs: readonly SubagentRun[] = [];
  @property({ attribute: 'selected-run-id' }) selectedRunId: string | null = null;
  /** Optional accessible-name override for the `role="tree"` element. Omission localizes the
   *  default; any supplied string, including `''`, is rendered verbatim. */
  @property() label?: string;

  /**
   * Density on the shared size scale. `s` (and the smaller `xs`/`2xs`) tightens run-row
   * padding/gaps and shrinks the task/model text -- same convention as
   * `lr-task-list`/`lr-stack-trace`/`lr-thinking-panel`/`lr-terminal`'s `size`. `m` (the default)
   * and larger keep the full padding. Purely a density knob: each row's own border stays, so use
   * `frame="plain"` instead to drop the chrome entirely.
   */
  @property({ reflect: true }) size: LyraSize = 'm';

  /** Visual chrome for each run row, in the library's shared container-frame vocabulary. `'card'`
   *  (the default) keeps each row's own border/radius; `'plain'` drops it, for a transcript or
   *  message-bubble context that already draws its own border around a nested
   *  `<lr-subagent-panel>` and would otherwise double it. */
  @property({ reflect: true }) frame: LyraFrame = 'card';

  /** Roving-tabindex focus target. `null` defaults the first rendered row to `tabindex="0"`. */
  @state() private focusedId: string | null = null;
  /**
   * Cache of `ordered()`'s result, refreshed only in `willUpdate()` when `runs` or `selectedRunId` changes. Reading
   * this instead of recomputing avoids re-flattening/re-validating the whole tree on every
   * keystroke (`onKeyDown`) and every render.
   */
  private orderedRunsCache: OrderedRuns = { rows: [], truncated: false };
  private readonly announcements = new AnnouncementSinkController(this, { eager: ['polite'] });
  private previousLimitText = '';
  private suppressNextLimitAnnouncement = true;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) {
      this.suppressNextLimitAnnouncement = true;
      this.requestUpdate();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.suppressNextLimitAnnouncement = true;
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.announcements.adopted();
  }

  private statusLabel(status: AgentStatusKind): string {
    return agentStatusText(this.localize.bind(this), status);
  }

  private ordered(): OrderedRuns {
    const runs = firstByIdentity(
      Array.isArray(this.runs) ? this.runs : [],
      (run) => run.id,
    );
    const truncated = runs.length > MAX_RENDERED_RUNS;

    // `selectedRunId` and as much of its nearest-ancestor chain as fits reserve positions inside
    // the render cap before ordinary input-order runs fill the rest -- mirrors
    // normalizeLyraSpans()'s activeSpanId reservation (trace-tree/span.ts), so a controlled
    // selection landing outside the first MAX_RENDERED_RUNS array-order entries still renders.
    const allById = new Map<string, SubagentRun>();
    for (const run of runs) allById.set(run.id, run);
    const chosenIds = new Set<string>();
    const visitedPath = new Set<string>();
    let current = this.selectedRunId ? allById.get(this.selectedRunId) : undefined;
    while (current && chosenIds.size < MAX_RENDERED_RUNS && !visitedPath.has(current.id)) {
      chosenIds.add(current.id);
      visitedPath.add(current.id);
      current = current.parentId ? allById.get(current.parentId) : undefined;
    }
    for (const run of runs) {
      if (chosenIds.size >= MAX_RENDERED_RUNS) break;
      chosenIds.add(run.id);
    }

    const normalized: SubagentRun[] = [];
    const byId = new Map<string, SubagentRun>();
    for (const run of runs) {
      if (!chosenIds.has(run.id)) continue;
      normalized.push(run);
      byId.set(run.id, run);
    }

    const byParent = new Map<string, SubagentRun[]>();
    const roots: SubagentRun[] = [];
    const hasCyclicParentChain = (run: SubagentRun): boolean => {
      const visited = new Set<string>([run.id]);
      let parentId = run.parentId;
      while (parentId) {
        if (visited.has(parentId)) return true;
        visited.add(parentId);
        parentId = byId.get(parentId)?.parentId;
      }
      return false;
    };
    for (const run of normalized) {
      const parent = run.parentId && byId.has(run.parentId) && !hasCyclicParentChain(run) ? run.parentId : '';
      byParent.set(parent, [...(byParent.get(parent) ?? []), run]);
      if (!parent) roots.push(run);
    }

    const rows: SubagentRow[] = [];
    const stack = [...roots]
      .reverse()
      .map((run, reverseIndex) => ({
        run,
        depth: 0,
        posInSet: roots.length - reverseIndex,
        setSize: roots.length,
      }));
    const visited = new Set<string>();
    while (stack.length > 0 && rows.length < MAX_RENDERED_RUNS) {
      const row = stack.pop();
      if (!row || visited.has(row.run.id)) continue;
      visited.add(row.run.id);
      rows.push(row);
      const children = byParent.get(row.run.id) ?? [];
      for (let index = children.length - 1; index >= 0; index--) {
        const child = children[index];
        if (child) {
          stack.push({
            run: child,
            depth: row.depth + 1,
            posInSet: index + 1,
            setSize: children.length,
          });
        }
      }
    }
    return { rows, truncated };
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('runs') || changed.has('selectedRunId')) {
      this.orderedRunsCache = this.ordered();
      const rows = this.orderedRunsCache.rows;
      const ids = new Set(rows.map((row) => row.run.id));
      // Concretize focusedId to a real row (defaulting to the first) whenever it's unset or its row
      // was removed by a `runs` update -- onKeyDown indexes off it directly, so leaving it `null`
      // makes `rows.findIndex(...)` return -1 and ArrowDown/Up land back on the same row instead of
      // advancing.
      if (this.focusedId == null || !ids.has(this.focusedId)) {
        this.focusedId = rows[0]?.run.id ?? null;
      }
    }
  }

  protected override updated(_changed: PropertyValues<this>): void {
    super.updated(_changed);
    const limitText = this.renderRoot.querySelector('[part="limit"]')?.textContent?.trim() ?? '';
    if (!this.suppressNextLimitAnnouncement && limitText && limitText !== this.previousLimitText) {
      this.announcements.announcePolite(limitText);
    }
    this.previousLimitText = limitText;
    this.suppressNextLimitAnnouncement = false;
  }

  private runElement(runId: string): HTMLElement | null {
    const ownerCss = this.ownerDocument.defaultView?.CSS;
    if (typeof ownerCss?.escape === 'function') {
      try {
        const candidate = this.renderRoot.querySelector<HTMLElement>(
          `[data-run-id="${ownerCss.escape(runId)}"]`,
        );
        if (candidate?.getAttribute('data-run-id') === runId) return candidate;
      } catch {
        // A partial DOM can expose CSS.escape while rejecting selector construction.
      }
    }
    return (
      Array.from(this.renderRoot.querySelectorAll<HTMLElement>('[data-run-id]')).find(
        (candidate) => candidate.getAttribute('data-run-id') === runId,
      ) ?? null
    );
  }

  private focusRow(row: SubagentRow | undefined): void {
    if (!row) return;
    this.focusedId = row.run.id;
    void this.updateComplete.then(() => {
      this.runElement(row.run.id)?.focus();
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const { rows } = this.orderedRunsCache;
    if (rows.length === 0) return;
    const currentIndex = rows.findIndex((r) => r.run.id === this.focusedId);
    const depth = rows[currentIndex]?.depth ?? 0;
    const [childKey, parentKey] = isRtl(this) ? ['ArrowLeft', 'ArrowRight'] : ['ArrowRight', 'ArrowLeft'];
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.focusRow(rows[Math.min(rows.length - 1, currentIndex + 1)]);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.focusRow(rows[Math.max(0, currentIndex - 1)]);
        break;
      case 'Home':
        e.preventDefault();
        this.focusRow(rows[0]);
        break;
      case 'End':
        e.preventDefault();
        this.focusRow(rows[rows.length - 1]);
        break;
      case childKey: {
        e.preventDefault();
        const child = rows[currentIndex + 1];
        if (child && child.depth > depth) this.focusRow(child);
        break;
      }
      case parentKey:
        e.preventDefault();
        this.focusRow(rows.slice(0, Math.max(currentIndex, 0)).reverse().find((row) => row.depth < depth));
        break;
      case 'Enter':
      case ' ': {
        const target = e.target as HTMLElement;
        if (target.getAttribute('role') !== 'treeitem') return;
        const row = rows.find((candidate) => candidate.run.id === target.dataset['runId']);
        if (!row) return;
        e.preventDefault();
        this.emit('lr-run-activate', { runId: row.run.id, run: row.run });
        break;
      }
      default:
        return;
    }
  };

  // Native "focus" does not bubble, so it can never be caught with a single listener on the
  // list -- delegating on "focusin" (which does bubble) instead of a per-row `@focus` handler
  // keeps `focusedId` in sync no matter whether focus lands on the <li role="treeitem"> itself or
  // on one of its nested run-trigger/cancel/retry buttons.
  private onFocusIn = (e: FocusEvent): void => {
    const target = e.target as HTMLElement | null;
    const runId = target?.closest<HTMLElement>('[role="treeitem"]')?.dataset['runId'];
    if (runId) this.focusedId = runId;
  };

  private renderRun = ({ run, depth, posInSet, setSize }: SubagentRow, firstId: string | undefined): TemplateResult => {
    const selected = run.id === this.selectedRunId;
    const progress = typeof run.progressRatio === 'number' ? finiteRange(run.progressRatio, 0, 0, 1) : null;
    const runPart = selected ? 'run run-selected' : 'run';
    const tabbable = this.focusedId === run.id || (this.focusedId == null && run.id === firstId);
    const buttonTabindex = tabbable ? nothing : '-1';
    return html`
      <li
        part=${runPart}
        data-run-id=${run.id}
        data-depth=${depth}
        role="treeitem"
        tabindex=${tabbable ? '0' : '-1'}
        aria-selected=${selected ? 'true' : 'false'}
        aria-level=${depth + 1}
        aria-posinset=${posInSet}
        aria-setsize=${setSize}
        style=${styleMap({ '--lr-subagent-depth': String(Math.min(depth, MAX_VISUAL_INDENT_DEPTH)) })}
      >
        <div part="run-row">
          <button
            part="run-trigger"
            type="button"
            tabindex=${buttonTabindex}
            @click=${() => this.emit('lr-run-activate', { runId: run.id, run })}
          >
            <span part="label">${run.label}</span>
            <lr-badge part="status" variant=${AGENT_STATUS_VARIANTS[run.status] ?? 'neutral'}>${this.statusLabel(run.status)}</lr-badge>
            ${run.task ? html`<span part="task">${run.task}</span>` : nothing}
            ${run.model ? html`<span part="model">${run.model}</span>` : nothing}
            ${progress != null
              ? html`<span
                  part="progress"
                  role="progressbar"
                  aria-label=${run.label || this.localize('progress')}
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow=${Math.round(progress * 100)}
                ><span style=${styleMap({ inlineSize: `${progress * 100}%` })}></span></span>`
              : nothing}
          </button>
          <span part="actions">
            ${ACTIVE.has(run.status)
              ? html`<button
                  part="cancel"
                  data-agent-action="inline"
                  type="button"
                  tabindex=${buttonTabindex}
                  aria-label=${this.localize('subagentPanelCancelRun', undefined, { name: run.label })}
                  @click=${() => {
                    this.emit('lr-run-cancel', { runId: run.id });
                    this.emit('lr-cancel', { runId: run.id });
                  }}
                >×</button>`
              : nothing}
            ${run.status === 'error' || run.status === 'cancelled'
              ? html`<button
                  part="retry"
                  data-agent-action="inline"
                  type="button"
                  tabindex=${buttonTabindex}
                  aria-label=${this.localize('subagentPanelRetryRun', undefined, { name: run.label })}
                  @click=${() => this.emit('lr-run-retry', { runId: run.id })}
                >${this.localize('subagentPanelRetry')}</button>`
              : nothing}
          </span>
        </div>
      </li>
    `;
  };

  override render(): TemplateResult {
    const label =
      hostAriaLabel(this) ??
      (this.label == null ? this.localize('subagentPanelLabel') : this.label);
    const ordered = this.orderedRunsCache;
    const firstId = ordered.rows[0]?.run.id;
    return html`
      <div part="base">
        ${ordered.rows.length
          ? html`<ul
              part="list"
              role="tree"
              aria-label=${label}
              @keydown=${this.onKeyDown}
              @focusin=${this.onFocusIn}
            >${repeat(ordered.rows, (row) => row.run.id, (row) => this.renderRun(row, firstId))}</ul>
              ${ordered.truncated
                ? html`<p part="limit">${this.localize('subagentPanelLimit', undefined, {
                      count: getNumberFormat(this.effectiveLocale).format(MAX_RENDERED_RUNS),
                    })}</p>`
                : nothing}`
          : html`<lr-empty part="empty" heading=${this.localize('subagentPanelEmpty')}></lr-empty>`}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-subagent-panel': LyraSubagentPanel;
  }
}

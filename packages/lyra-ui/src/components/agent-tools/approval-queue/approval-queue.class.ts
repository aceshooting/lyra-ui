import { loadLazyChildren } from '../../../internal/lazy-children.js';
import { resolveHeadingLevel, type LyraHeadingLevel } from '../../../internal/heading-level.js';
import type { ApprovalWaitUntil } from '../../../internal/approval-wait-until.js';
import { ltrIsolate } from '../../../internal/bidi.js';
import { labelWithVisibleText } from '../../../internal/accessible-name.js';
import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { ToolApprovalEventDetail } from '../../../ai/types.js';
import type {
  LyraToolApprovalDialog,
  ToolApprovalDialogCloseReason,
} from '../tool-approval-dialog/tool-approval-dialog.class.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { deepActiveElementIn, shadowFocusTarget } from '../../../internal/active-element.js';
import { focusFirstAvailable } from '../../../internal/focus-navigation.js';
import { styles } from './approval-queue.styles.js';
import { overallSemanticLabel } from '../semantic-owner.js';
import type { ApprovalAction, ApprovalDecision } from '../approval-state.js';
import { isPlainDataRecord } from '../../../internal/data-descriptors.js';
import { firstByIdentityMemo } from '../../../internal/collection-identity.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_approvalQueueEmpty, LYRA_DEFAULT_approvalQueueLabel, LYRA_DEFAULT_approvalQueueLimit, LYRA_DEFAULT_approvalQueueOpen, LYRA_DEFAULT_approvalQueuePending, LYRA_DEFAULT_approvalQueuePendingCount, LYRA_DEFAULT_confirmApproved, LYRA_DEFAULT_confirmDenied } from '../../../internal/default-strings/agent-tools.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type ApprovalRequestStatus = 'pending' | ApprovalDecision;

/** Ceiling on request rows actually mounted into the DOM, matching this family's established
 *  `MAX_RENDERED_*` convention (`trace-tree`/`span-waterfall`'s `MAX_RENDERED_LYRA_SPANS`,
 *  `subagent-panel`'s `MAX_RENDERED_RUNS`, `tool-timeline`'s `MAX_RENDERED_ENTRIES`). The pending
 *  count in the heading row still derives from every request in `requests`, not just the rendered
 *  subset -- only the request row DOM is capped, and `selectedRequest` lookup still searches the
 *  full normalized list so a selection beyond the render ceiling still opens its dialog. */
const MAX_RENDERED_REQUESTS = 500;


/** Compare only the selected request's owned snapshots. Repeated references can expand a small
 * graph exponentially. Stop after 50,000 entries and containers or 256 nested levels. */
function sameApprovalArgs(previous: unknown, next: unknown): boolean {
  let remaining = 50_000;
  function equal(left: unknown, right: unknown, depth: number): boolean {
    if (left === right) return true;
    if (depth > 256 || !left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
    if (Array.isArray(left) || Array.isArray(right)) {
      if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    } else if (!isPlainDataRecord(left) || !isPlainDataRecord(right)) return false;
    const keys = Object.keys(left);
    remaining -= keys.length + 1;
    if (remaining < 0 || keys.length !== Object.keys(right).length) return false;
    return keys.every(key => {
      const before = Object.getOwnPropertyDescriptor(left, key);
      const after = Object.getOwnPropertyDescriptor(right, key);
      return before && after && 'value' in before && 'value' in after && equal(before.value, after.value, depth + 1);
    });
  }
  return equal(previous, next, 0);
}

/** A host-owned tool call waiting for or carrying a human approval decision. */
export interface ToolApprovalRequest {
  id: string;
  toolName: string;
  args: unknown;
  status?: ApprovalRequestStatus;
}

function admittedId(row: ToolApprovalRequest): string | undefined {
  return row.id;
}

export interface LyraApprovalQueueEventMap {
  'lr-approval-open': CustomEvent<{ invocationId: string }>;
  'lr-approval-select': CustomEvent<{ invocationId: string }>;
  'lr-approval-decision-request': CustomEvent<ToolApprovalEventDetail & { args?: unknown; waitUntil?: ApprovalWaitUntil }>;
  'lr-approval-close': CustomEvent<{ invocationId: string; reason: ToolApprovalDialogCloseReason }>;
}

/**
 * `<lr-approval-queue>` — a controlled queue of tool calls that need human approval, with a
 * keyboard-accessible request list and a single reused `<lr-tool-approval-dialog>`. It never
 * executes tools, applies permissions, or persists decisions; the host owns those operations.
 * Empty request ids are omitted and duplicate ids normalize before counts, selection, rendering,
 * and events; the first valid occurrence wins.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 * Equivalent JSON arguments keep an open draft and pending decision across new arrays, including
 * reordered object keys. A comparison exceeding 50,000 entries and containers or 256 nested levels
 * starts a fresh draft. A resolved decision is announced, and focus lost with it moves to the next pending row.
 *
 * @customElement lr-approval-queue
 * @event lr-approval-open - A review was opened, with detail.invocationId.
 * @event lr-approval-select - A request was selected. `detail: { invocationId }`.
 * @event lr-approval-decision-request - Cancelable approval or denial proposal. `detail: { invocationId,
 *   approved, args?, waitUntil }`. Call `waitUntil(promise)` during dispatch to defer settlement.
 *   Preventing the event keeps the nested dialog pending until the host
 *   resolves the request or calls `finalizePendingApproval()`/`revertPendingApproval()`.
 * @event lr-approval-close - The nested decision dialog closed, or controlled requests invalidated
 *   its formerly pending selection. `detail: { invocationId, reason }`; invalidation uses
 *   `reason: 'request-invalidated'` after selection and open state are cleared. Non-cancelable.
 * @csspart base - The root queue wrapper.
 * @csspart heading-row - The heading and pending-count row.
 * @csspart heading - The visible queue heading.
 * @csspart count - The pending-count text; takes focus (`tabindex="-1"`) when no pending row is left.
 * @csspart list - The request list.
 * @csspart request - One selectable request row.
 * @csspart request-info - Request name and id wrapper.
 * @csspart tool-name - The proposed tool name.
 * @csspart request-id - The stable request id.
 * @csspart status - The request status badge.
 * @csspart empty - The empty state.
 * @csspart limit - Localized notice shown when `requests` exceeds the 500-row render ceiling.
 * @cssprop [--lr-approval-queue-selected-border=var(--lr-color-brand)] - Selected request border.
 * @status stable
 * @since 6.2.0
 */
export class LyraApprovalQueue extends LyraElement<LyraApprovalQueueEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    approvalQueueEmpty: LYRA_DEFAULT_approvalQueueEmpty,
    approvalQueueLabel: LYRA_DEFAULT_approvalQueueLabel,
    approvalQueueLimit: LYRA_DEFAULT_approvalQueueLimit,
    approvalQueueOpen: LYRA_DEFAULT_approvalQueueOpen,
    approvalQueuePending: LYRA_DEFAULT_approvalQueuePending,
    approvalQueuePendingCount: LYRA_DEFAULT_approvalQueuePendingCount,
    confirmApproved: LYRA_DEFAULT_confirmApproved,
    confirmDenied: LYRA_DEFAULT_confirmDenied,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  private emitApprovalDecisionRequest(detail: LyraApprovalQueueEventMap['lr-approval-decision-request']['detail']): CustomEvent {
    const request = this.emit('lr-approval-decision-request', Object.freeze(detail), { cancelable: true });
    return request;
  }
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze(['requests']);

  static override styles = [LyraElement.styles, styles];

  /** Outline level of the title. `none` preserves its text without a heading role. */
  @property({ attribute: 'heading-level' }) headingLevel: LyraHeadingLevel = '2';

  /** Prevents the reviewer from starting or editing a decision. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Requests in display order. Controlled and never mutated by this component. Empty ids are
   *  omitted and duplicate ids normalize first-wins before counts, selection, dialog lookup, and
   *  events. */
  @property({ attribute: false }) requests: readonly ToolApprovalRequest[] = [];
  /** Stable invocation identity of the request currently shown in the dialog, or `null` when none
   *  is selected. */
  @property({ attribute: 'selected-invocation-id' }) selectedInvocationId: string | null = null;
  /** Whether the decision dialog is open. */
  @property({ type: Boolean, reflect: true }) open = false;
  /** Withholds argument editing in the nested approval dialog. */
  @property({ type: Boolean }) readonly = false;
  /** Accessible name and visible heading. Optional. Omitting it localizes the default
   *  `approvalQueueLabel` message; an explicit empty string renders no visible/accessible label. */
  @property() label?: string;

  // A nested dialog close may accompany a host request replacement in the
  // same update. Its existing close event is the sole close notification for
  // that turn; a later independent invalidation remains observable.
  private nestedCloseInvocationId: string | null = null;

  @query('lr-tool-approval-dialog') private dialogEl?: LyraToolApprovalDialog;
  @query('[part="count"]') private countEl?: HTMLElement;

  private readonly sink = new AnnouncementSinkController(this, { eager: ['polite'] });
  private readonly decidedInvocationIds = new Set<string>();
  private settledAnnouncements: string[] = [];
  private focusAnchorId: string | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.decidedInvocationIds.clear();
    this.settledAnnouncements = [];
  }

  /** The decision a vetoed `lr-approval-decision-request` holds in the open dialog, or `null`. */
  get pendingApproval(): ApprovalAction | null {
    return this.dialogEl?.pendingAction ?? null;
  }

  /** Closes the dialog with the held decision once the host has persisted it. */
  finalizePendingApproval(): void {
    const pending = this.pendingApproval;
    if (pending) this.dialogEl?.close(pending);
  }

  /** Releases the held decision after a failed save, keeping the dialog and its edits for a retry. */
  revertPendingApproval(): void {
    if (this.dialogEl) this.dialogEl.pendingAction = null;
  }

  private normalizedRequestsFor(value: readonly ToolApprovalRequest[]): ToolApprovalRequest[] {
    return firstByIdentityMemo(value, admittedId);
  }

  private dialogArgs?: { readonly request: ToolApprovalRequest; readonly args: unknown };

  /** Re-cloned but equal arguments keep their identity, so the dialog keeps its draft. */
  private stableDialogArgs(request: ToolApprovalRequest): unknown {
    const previous = this.dialogArgs;
    if (previous?.request === request) return previous.args;
    const args = previous?.request.id === request.id && sameApprovalArgs(previous.args, request.args)
      ? previous.args
      : request.args;
    this.dialogArgs = { request, args };
    return args;
  }

  private get normalizedRequests(): ToolApprovalRequest[] {
    return this.normalizedRequestsFor(this.requests);
  }

  private get selectedRequest(): ToolApprovalRequest | undefined {
    return this.normalizedRequests.find((request) => request.id === this.selectedInvocationId);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('requests') && this.hasUpdated) this.prepareRequestsUpdate();
    if (!changed.has('requests') && !changed.has('selectedInvocationId')) return;
    const selectedInvocationId = this.selectedInvocationId;
    const selected = this.selectedRequest;
    if (selected && (selected.status ?? 'pending') === 'pending') return;
    const previousSelected = selectedInvocationId !== null && changed.has('requests')
      ? this.normalizedRequestsFor(changed.get('requests')).find(
          (request) => request.id === selectedInvocationId,
        )
      : undefined;
    const invalidated =
      this.hasUpdated &&
      !changed.has('selectedInvocationId') &&
      selectedInvocationId !== null &&
      previousSelected !== undefined &&
      (previousSelected.status ?? 'pending') === 'pending';
    const nestedCloseInSameCycle =
      this.nestedCloseInvocationId === selectedInvocationId;
    this.selectedInvocationId = null;
    this.open = false;
    if (invalidated && !nestedCloseInSameCycle) {
      this.emit('lr-approval-close', {
        invocationId: selectedInvocationId,
        reason: 'request-invalidated',
      });
    }
  }

  private childRegistration?: Promise<unknown>;

  protected override async getUpdateComplete(): Promise<boolean> {
    const complete = await super.getUpdateComplete();
    await this.childRegistration;
    return complete;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.childRegistration = loadLazyChildren('approval-queue', this.renderRoot) ?? this.childRegistration;
    this.nestedCloseInvocationId = null;
    const anchorId = this.focusAnchorId;
    this.focusAnchorId = null;
    const active = deepActiveElementIn(this.ownerDocument) as HTMLButtonElement | null;
    if (anchorId !== null && (!active || active === this.ownerDocument.body || active.disabled)) {
      const rows = [...this.renderRoot.querySelectorAll<HTMLElement>('[part~="request"]')];
      const index = rows.findIndex((row) => row.dataset['requestId'] === anchorId);
      focusFirstAvailable([...rows.slice(index + 1), ...rows.slice(0, Math.max(index, 0)).reverse(), this.countEl]);
    }
    for (const text of this.settledAnnouncements.splice(0)) this.sink.announcePolite(text);
  }

  /** Remembers the focused request (or the dialog's) and queues decided requests this update resolves. */
  private prepareRequestsUpdate(): void {
    const active = shadowFocusTarget(this) as HTMLElement | null | undefined;
    this.focusAnchorId = active && active === this.dialogEl ? this.selectedInvocationId : active?.dataset['requestId'] ?? null;
    for (const id of this.decidedInvocationIds) {
      const request = this.normalizedRequests.find((candidate) => candidate.id === id);
      const status = request && (request.status ?? 'pending');
      if (status === 'pending') continue;
      this.decidedInvocationIds.delete(id);
      if (status) this.settledAnnouncements.push(this.statusLabel(status));
    }
  }

  private pendingCount(): number {
    return this.normalizedRequests.filter((request) => (request.status ?? 'pending') === 'pending').length;
  }

  private statusLabel(status: ApprovalRequestStatus): string {
    if (status === 'approved') return this.localize('confirmApproved');
    if (status === 'denied') return this.localize('confirmDenied');
    return this.localize('approvalQueuePending');
  }

  private statusVariant(status: ApprovalRequestStatus): string {
    return status === 'approved' ? 'success' : status === 'denied' ? 'danger' : 'warning';
  }

  private select(request: ToolApprovalRequest): void {
    const current = this.normalizedRequests.find(item => item.id === request.id);
    if (this.disabled || !current || (current.status ?? 'pending') !== 'pending') return;
    this.selectedInvocationId = request.id;
    this.open = true;
    this.emit('lr-approval-open', { invocationId: request.id });
    this.emit('lr-approval-select', { invocationId: request.id });
  }

  private decisionDispatching = false;
  private onDecision(request: ToolApprovalRequest, event: CustomEvent<{ args?: unknown; waitUntil?: ApprovalWaitUntil } | null>): void {
    event.stopPropagation();
    if (this.decisionDispatching) return;
    const current = this.selectedRequest;
    if (this.disabled || !this.open || !current || current.id !== request.id || (current.status ?? 'pending') !== 'pending' ||
        current.toolName !== request.toolName || (current !== request && !sameApprovalArgs(current.args, request.args))) {
      event.preventDefault();
      return;
    }
    this.decisionDispatching = true;
    try {
      this.decidedInvocationIds.add(request.id);
      const detail = event.type === 'lr-approve-request'
        ? { invocationId: request.id, approved: true, args: event.detail?.args }
        : { invocationId: request.id, approved: false };
      const waitUntil = event.detail?.waitUntil;
      const decision = this.emitApprovalDecisionRequest({ ...detail, ...(waitUntil ? { waitUntil } : {}) });
      if (decision.defaultPrevented) event.preventDefault();
    } finally {
      this.decisionDispatching = false;
    }
  }

  private stopOwnedEvent(event: Event): void {
    event.stopPropagation();
  }

  private onClose(request: ToolApprovalRequest, event: CustomEvent<{ reason: ToolApprovalDialogCloseReason }>): void {
    if (event.composedPath()[0] !== event.currentTarget) return;
    event.stopPropagation();
    this.nestedCloseInvocationId = request.id;
    if (request.id === this.selectedInvocationId) {
      const wasOpen = this.open;
      this.open = false;
      // A closed child produces no reactive property write, but its one-cycle close marker must
      // still clear even when a host does not replace requests from this event.
      if (!wasOpen) this.requestUpdate();
    } else {
      // A decision listener can synchronously select a replacement before the old dialog closes.
      // Keep that replacement open, while still scheduling the stale close marker's cleanup.
      this.requestUpdate();
    }
    this.emit('lr-approval-close', { invocationId: request.id, reason: event.detail.reason });
  }

  private renderRequest(request: ToolApprovalRequest, index: number): TemplateResult {
    const status = request.status ?? 'pending';
    // The badge is the only place the resolved decision (approved/denied) is rendered, but the
    // button already carries an explicit `aria-label`, which -- per the accessible-name
    // computation -- excludes the badge's own text from the name. `aria-describedby` back onto
    // the badge keeps that decision reachable to assistive tech without touching the localized
    // `approvalQueueOpen` message itself.
    const statusId = `approval-queue-status-${index}`;
    return html`<div role="listitem"><button
      part="request"
      type="button"
      data-request-id=${request.id}
      data-selected=${request.id === this.selectedInvocationId ? 'true' : 'false'}
      aria-current=${request.id === this.selectedInvocationId ? 'true' : 'false'}
      aria-label=${labelWithVisibleText(this.localize('approvalQueueOpen', undefined, { tool: request.toolName }), ltrIsolate(request.id))}
      aria-describedby=${statusId}
      ?disabled=${this.disabled || status !== 'pending'}
      @click=${() => this.select(request)}
    >
      <span part="request-info"><span part="tool-name" dir="auto">${request.toolName}</span><span part="request-id" dir="ltr">${request.id}</span></span>
      <lr-badge id=${statusId} part="status" variant=${this.statusVariant(status)}>${this.statusLabel(status)}</lr-badge>
    </button></div>`;
  }

  override render(): TemplateResult {
    const level = resolveHeadingLevel(this.headingLevel);
    const label = this.label == null ? this.localize('approvalQueueLabel') : this.label;
    const request = this.selectedRequest;
    const requests = this.normalizedRequests;
    const pendingCount = this.pendingCount();
    const truncated = requests.length > MAX_RENDERED_REQUESTS;
    return html`<section part="base" aria-label=${overallSemanticLabel(this, label) ?? nothing}>
      <div part="heading-row">
        <div role=${level && label.trim() ? 'heading' : nothing} aria-level=${label.trim() ? level ?? nothing : nothing} part="heading">${label}</div>
        <span part="count" tabindex="-1">${this.localize('approvalQueuePendingCount', undefined, { count: this.formatLocaleNumber(pendingCount) })}</span>
      </div>
      ${requests.length > 0
        ? html`<div part="list" role="list">${repeat(requests.slice(0, MAX_RENDERED_REQUESTS), (item) => item.id, (item, index) => this.renderRequest(item, index))}</div>`
        : html`<p part="empty">${this.localize('approvalQueueEmpty')}</p>`}
      ${truncated
        ? html`<p part="limit">${this.localize('approvalQueueLimit', undefined, {
              count: this.formatLocaleNumber(MAX_RENDERED_REQUESTS),
            })}</p>`
        : nothing}
      ${request
        ? keyed(
            request.id,
            html`<lr-tool-approval-dialog
              .open=${this.open}
              .toolName=${request.toolName}
              .args=${this.stableDialogArgs(request)}
              .readonly=${this.readonly}
              .disabled=${this.disabled}
              @lr-approve-request=${(event: CustomEvent<{ args: unknown; waitUntil: ApprovalWaitUntil }>) => this.onDecision(request, event)}
              @lr-deny-request=${(event: CustomEvent<{ waitUntil: ApprovalWaitUntil }>) => this.onDecision(request, event)}
              @lr-close=${(event: CustomEvent<{ reason: ToolApprovalDialogCloseReason }>) => this.onClose(request, event)}
              @lr-decision-settled=${this.stopOwnedEvent}
            ></lr-tool-approval-dialog>`,
          )
        : nothing}
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-approval-queue': LyraApprovalQueue;
  }
}

import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { ToolApprovalEventDetail } from '../../../ai/types.js';
import type { ToolApprovalDialogCloseReason } from '../tool-approval-dialog/tool-approval-dialog.class.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { styles } from './approval-queue.styles.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { overallSemanticLabel } from '../semantic-owner.js';
import type { ApprovalDecision } from '../approval-state.js';
import { firstByIdentity } from '../collection-identity.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_approvalQueueEmpty, LYRA_DEFAULT_approvalQueueLabel, LYRA_DEFAULT_approvalQueueOpen, LYRA_DEFAULT_approvalQueuePending, LYRA_DEFAULT_approvalQueuePendingCount, LYRA_DEFAULT_confirmApproved, LYRA_DEFAULT_confirmDenied } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type ApprovalRequestStatus = 'pending' | ApprovalDecision;

/** A host-owned tool call waiting for or carrying a human approval decision. */
export interface ToolApprovalRequest {
  id: string;
  toolName: string;
  args: unknown;
  status?: ApprovalRequestStatus;
}

export interface LyraApprovalQueueEventMap {
  'lr-approval-select': CustomEvent<{ invocationId: string }>;
  'lr-approval-decision': CustomEvent<ToolApprovalEventDetail & { args?: unknown }>;
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
 *
 * @customElement lr-approval-queue
 * @event lr-approval-select - A request was selected. `detail: { invocationId }`.
 * @event lr-approval-decision - A request was approved or denied. `detail: { invocationId,
 *   approved, args? }`. Cancelable; preventing it keeps the nested dialog pending.
 * @event lr-approval-close - The nested decision dialog closed. `detail: { invocationId, reason }`.
 * @csspart base - The root queue wrapper.
 * @csspart heading-row - The heading and pending-count row.
 * @csspart heading - The visible queue heading.
 * @csspart count - The pending-count text.
 * @csspart list - The request list.
 * @csspart request - One selectable request row.
 * @csspart request-info - Request name and id wrapper.
 * @csspart tool-name - The proposed tool name.
 * @csspart request-id - The stable request id.
 * @csspart status - The request status badge.
 * @csspart empty - The empty state.
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
    approvalQueueOpen: LYRA_DEFAULT_approvalQueueOpen,
    approvalQueuePending: LYRA_DEFAULT_approvalQueuePending,
    approvalQueuePendingCount: LYRA_DEFAULT_approvalQueuePendingCount,
    confirmApproved: LYRA_DEFAULT_confirmApproved,
    confirmDenied: LYRA_DEFAULT_confirmDenied,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze(['requests']);

  static override styles = [LyraElement.styles, styles];

  /** Requests in display order. Controlled and never mutated by this component. Empty ids are
   *  omitted and duplicate ids normalize first-wins before counts, selection, dialog lookup, and
   *  events. */
  @property({ attribute: false }) requests: readonly ToolApprovalRequest[] = [];
  /** Stable invocation identity of the request currently shown in the dialog, or `null` when none
   *  is selected. */
  @property({ attribute: 'selected-invocation-id' }) selectedInvocationId: string | null = null;
  /** Whether the decision dialog is open. */
  @property({ type: Boolean, reflect: true }) open = false;
  /** Allows argument editing in the nested approval dialog. */
  @property({ type: Boolean, converter: trueDefaultBooleanConverter }) editable = true;
  /** Accessible name and visible heading. */
  @property() label = '';

  private get normalizedRequests(): ToolApprovalRequest[] {
    return firstByIdentity(Array.isArray(this.requests) ? this.requests : [], (request) => request.id);
  }

  private get selectedRequest(): ToolApprovalRequest | undefined {
    return this.normalizedRequests.find((request) => request.id === this.selectedInvocationId);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!changed.has('requests') && !changed.has('selectedInvocationId')) return;
    const selected = this.selectedRequest;
    if (selected && (selected.status ?? 'pending') === 'pending') return;
    if (this.selectedInvocationId !== null) this.selectedInvocationId = null;
    if (this.open) this.open = false;
  }

  private pendingCount(): number {
    return this.normalizedRequests.filter((request) => (request.status ?? 'pending') === 'pending').length;
  }

  private formatCount(value: number): string {
    return getNumberFormat(this.effectiveLocale).format(value);
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
    if ((request.status ?? 'pending') !== 'pending') return;
    this.selectedInvocationId = request.id;
    this.open = true;
    this.emit('lr-approval-select', { invocationId: request.id });
  }

  private onApprove(request: ToolApprovalRequest, event: CustomEvent<{ args: unknown }>): void {
    event.stopPropagation();
    if ((request.status ?? 'pending') !== 'pending') return;
    const translated = this.emit(
      'lr-approval-decision',
      { invocationId: request.id, approved: true, args: event.detail.args },
      { cancelable: true },
    );
    if (translated.defaultPrevented) event.preventDefault();
  }

  private onDeny(request: ToolApprovalRequest, event: CustomEvent<null>): void {
    event.stopPropagation();
    if ((request.status ?? 'pending') !== 'pending') return;
    const translated = this.emit(
      'lr-approval-decision',
      { invocationId: request.id, approved: false },
      { cancelable: true },
    );
    if (translated.defaultPrevented) event.preventDefault();
  }

  private onClose(request: ToolApprovalRequest, event: CustomEvent<ToolApprovalDialogCloseReason>): void {
    event.stopPropagation();
    this.open = false;
    this.emit('lr-approval-close', { invocationId: request.id, reason: event.detail });
  }

  private renderRequest(request: ToolApprovalRequest): TemplateResult {
    const status = request.status ?? 'pending';
    return html`<div role="listitem"><button
      part="request"
      type="button"
      data-selected=${request.id === this.selectedInvocationId ? 'true' : 'false'}
      aria-current=${request.id === this.selectedInvocationId ? 'true' : 'false'}
      aria-label=${this.localize('approvalQueueOpen', undefined, { tool: request.toolName })}
      ?disabled=${status !== 'pending'}
      @click=${() => this.select(request)}
    >
      <span part="request-info"><span part="tool-name">${request.toolName}</span><span part="request-id">${request.id}</span></span>
      <lr-badge part="status" variant=${this.statusVariant(status)}>${this.statusLabel(status)}</lr-badge>
    </button></div>`;
  }

  override render(): TemplateResult {
    const label = this.label || this.localize('approvalQueueLabel');
    const request = this.selectedRequest;
    const requests = this.normalizedRequests;
    const pendingCount = this.pendingCount();
    return html`<section part="base" aria-label=${overallSemanticLabel(this, label) ?? nothing}>
      <div part="heading-row">
        <h2 part="heading">${label}</h2>
        <span part="count">${this.localize('approvalQueuePendingCount', undefined, { count: this.formatCount(pendingCount) })}</span>
      </div>
      ${requests.length > 0
        ? html`<div part="list" role="list">${requests.map((item) => this.renderRequest(item))}</div>`
        : html`<p part="empty">${this.localize('approvalQueueEmpty')}</p>`}
      ${request
        ? keyed(
            request.id,
            html`<lr-tool-approval-dialog
              .open=${this.open}
              .toolName=${request.toolName}
              .args=${request.args}
              .editable=${this.editable}
              @lr-approve=${(event: CustomEvent<{ args: unknown }>) => this.onApprove(request, event)}
              @lr-deny=${(event: CustomEvent<null>) => this.onDeny(request, event)}
              @lr-close=${(event: CustomEvent<ToolApprovalDialogCloseReason>) => this.onClose(request, event)}
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

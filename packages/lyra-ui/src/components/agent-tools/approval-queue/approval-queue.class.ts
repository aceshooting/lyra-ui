import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { ToolApprovalEventDetail } from '../../../ai/types.js';
import type { ToolApprovalDialogCloseReason } from '../tool-approval-dialog/tool-approval-dialog.class.js';
import '../tool-approval-dialog/tool-approval-dialog.js';
import '../../overlays/badge/badge.js';
import { styles } from './approval-queue.styles.js';

export type ApprovalRequestStatus = 'pending' | 'approved' | 'denied';

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
 *
 * @customElement lr-approval-queue
 * @event lr-approval-select - A request was selected. `detail: { invocationId }`.
 * @event lr-approval-decision - A request was approved or denied. `detail: { invocationId,
 *   approved, args? }`.
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
 */
export class LyraApprovalQueue extends LyraElement<LyraApprovalQueueEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** Requests in display order. Controlled and never mutated by this component. */
  @property({ attribute: false }) requests: ToolApprovalRequest[] = [];
  /** The request currently shown in the dialog. */
  @property({ attribute: 'selected-id' }) selectedId = '';
  /** Whether the decision dialog is open. */
  @property({ type: Boolean, reflect: true }) open = false;
  /** Allows argument editing in the nested approval dialog. */
  @property({ type: Boolean }) editable = true;
  /** Accessible name and visible heading. */
  @property() label = '';

  private get selectedRequest(): ToolApprovalRequest | undefined {
    return this.requests.find((request) => request.id === this.selectedId);
  }

  private pendingCount(): number {
    return this.requests.filter((request) => (request.status ?? 'pending') === 'pending').length;
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
    this.selectedId = request.id;
    this.open = true;
    this.emit('lr-approval-select', { invocationId: request.id });
  }

  private onApprove = (event: CustomEvent<{ args: unknown }>): void => {
    event.stopPropagation();
    const request = this.selectedRequest;
    if (!request) return;
    this.emit('lr-approval-decision', { invocationId: request.id, approved: true, args: event.detail.args });
  };

  private onDeny = (event: CustomEvent<undefined>): void => {
    event.stopPropagation();
    const request = this.selectedRequest;
    if (!request) return;
    this.emit('lr-approval-decision', { invocationId: request.id, approved: false });
  };

  private onClose = (event: CustomEvent<ToolApprovalDialogCloseReason>): void => {
    event.stopPropagation();
    const request = this.selectedRequest;
    if (request) this.emit('lr-approval-close', { invocationId: request.id, reason: event.detail });
  };

  private renderRequest(request: ToolApprovalRequest): TemplateResult {
    const status = request.status ?? 'pending';
    return html`<div role="listitem"><button
      part="request"
      type="button"
      data-selected=${request.id === this.selectedId ? 'true' : 'false'}
      aria-label=${this.localize('approvalQueueOpen', undefined, { tool: request.toolName })}
      @click=${() => this.select(request)}
    >
      <span part="request-info"><span part="tool-name">${request.toolName}</span><span part="request-id">${request.id}</span></span>
      <lr-badge part="status" variant=${this.statusVariant(status)}>${this.statusLabel(status)}</lr-badge>
    </button></div>`;
  }

  override render(): TemplateResult {
    const label = this.label || this.localize('approvalQueueLabel');
    const request = this.selectedRequest;
    return html`<section part="base" aria-label=${label}>
      <div part="heading-row">
        <h2 part="heading">${label}</h2>
        <span part="count">${this.localize('approvalQueuePendingCount', undefined, { count: this.pendingCount() })}</span>
      </div>
      ${this.requests.length > 0
        ? html`<div part="list" role="list">${this.requests.map((item) => this.renderRequest(item))}</div>`
        : html`<p part="empty">${this.localize('approvalQueueEmpty')}</p>`}
      ${request
        ? html`<lr-tool-approval-dialog
            .open=${this.open}
            .toolName=${request.toolName}
            .args=${request.args}
            .editable=${this.editable}
            @lr-approve=${this.onApprove}
            @lr-deny=${this.onDeny}
            @lr-close=${this.onClose}
          ></lr-tool-approval-dialog>`
        : nothing}
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-approval-queue': LyraApprovalQueue;
  }
}

import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './approval-queue.js';
import type { LyraApprovalQueue, ToolApprovalRequest } from './approval-queue.class.js';

const meta: Meta = { title: 'ApprovalQueue', component: 'lr-approval-queue', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

const requests: ToolApprovalRequest[] = [
  { id: 'call-1', toolName: 'web_search', args: { query: 'release notes' } },
  { id: 'call-2', toolName: 'create_ticket', args: { title: 'Investigate latency', priority: 'high' } },
  { id: 'call-3', toolName: 'read_file', args: { path: 'docs/runbook.md' }, status: 'approved' },
];

function invalidateSelectedRequest(event: Event): void {
  const queue = (event.currentTarget as HTMLElement).parentElement?.querySelector<LyraApprovalQueue>(
    'lr-approval-queue',
  );
  if (queue) queue.requests = [];
}

function logApprovalClose(event: Event): void {
  console.info('lr-approval-close', (event as CustomEvent).detail);
}

export const Default: Story = { render: () => html`<lr-approval-queue .requests=${requests}></lr-approval-queue>` };
export const SelectedInvocation: Story = {
  render: () => html`
    <lr-approval-queue
      .requests=${requests}
      .selectedInvocationId=${'call-2'}
      open
    ></lr-approval-queue>
  `,
};
export const InvalidatedSelection: Story = {
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-s); max-inline-size: 30rem;">
      <button type="button" @click=${invalidateSelectedRequest}>Remove active request</button>
      <lr-approval-queue
        .requests=${[requests[0]!]}
        .selectedInvocationId=${'call-1'}
        .open=${true}
        @lr-approval-close=${logApprovalClose}
      ></lr-approval-queue>
    </div>
  `,
};
export const Empty: Story = { render: () => html`<lr-approval-queue></lr-approval-queue>` };
export const Narrow320: Story = {
  name: 'Narrow (320px, long content)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-approval-queue
        label="Tool requests awaiting a reviewer decision"
        .requests=${[
          {
            id: 'call-with-a-long-correlation-identifier-for-a-production-agent-run',
            toolName: 'create_customer_support_escalation_ticket',
            args: { title: 'Investigate the customer-facing latency regression' },
          },
        ]}
      ></lr-approval-queue>
    </div>
  `,
};

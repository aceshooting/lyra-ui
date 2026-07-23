import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './approval-queue.js';
import type { ToolApprovalRequest } from './approval-queue.class.js';

const meta: Meta = { title: 'ApprovalQueue', component: 'lr-approval-queue', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

const requests: ToolApprovalRequest[] = [
  { id: 'call-1', toolName: 'web_search', args: { query: 'release notes' } },
  { id: 'call-2', toolName: 'create_ticket', args: { title: 'Investigate latency', priority: 'high' } },
  { id: 'call-3', toolName: 'read_file', args: { path: 'docs/runbook.md' }, status: 'approved' },
];

export const Default: Story = { render: () => html`<lr-approval-queue .requests=${requests}></lr-approval-queue>` };
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

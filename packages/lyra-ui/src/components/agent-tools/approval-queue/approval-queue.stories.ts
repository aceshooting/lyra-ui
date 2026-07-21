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

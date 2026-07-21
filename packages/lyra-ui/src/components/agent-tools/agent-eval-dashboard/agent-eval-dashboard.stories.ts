import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './agent-eval-dashboard.js';
const meta: Meta = { title: 'AgentEvalDashboard', component: 'lr-agent-eval-dashboard', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;
export const Default: Story = { render: () => html`<lr-agent-eval-dashboard .metrics=${[{ id: 'pass', label: 'Pass rate', value: 0.92, format: 'percent' }, { id: 'latency', label: 'Latency', value: 840, format: 'milliseconds' }]} .runs=${[{ id: 'r1', label: 'Prompt v3', status: 'done', metrics: { pass: 0.92, latency: 840 } }, { id: 'r2', label: 'Prompt v2', status: 'error', metrics: { pass: 0.71, latency: 1100 } }]}></lr-agent-eval-dashboard>` };

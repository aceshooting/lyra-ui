import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './agent-eval-dashboard.js';

const metrics = [
  { id: 'pass', label: 'Pass rate', value: 0.92, format: 'percent' as const },
  { id: 'latency', label: 'Latency', value: 840, format: 'milliseconds' as const },
  { id: 'cost', label: 'Average cost', value: 0.034, format: 'currency' as const },
];
const runs = [
  { id: 'r1', label: 'Prompt v3', status: 'done' as const, metrics: { pass: 0.92, latency: 840, cost: 0.034 } },
  { id: 'r2', label: 'Prompt v2', status: 'error' as const, metrics: { pass: 0.71, latency: 1100, cost: 0.051 } },
];

const meta: Meta = { title: 'AgentEvalDashboard', component: 'lr-agent-eval-dashboard', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-agent-eval-dashboard currency="EUR" .metrics=${metrics} .runs=${runs}></lr-agent-eval-dashboard>
  `,
};

export const Narrow320: Story = {
  name: 'Narrow (320px, long content)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-agent-eval-dashboard
        label="Evaluation performance across the latest production prompt experiments"
        currency="EUR"
        .metrics=${metrics}
        .runs=${runs.map((run) => ({ ...run, label: `${run.label} — multilingual customer-support benchmark` }))}
      ></lr-agent-eval-dashboard>
    </div>
  `,
};

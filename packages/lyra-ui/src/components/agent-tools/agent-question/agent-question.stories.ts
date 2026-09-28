import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './agent-question.js';
const meta: Meta = { title: 'AgentQuestion', component: 'lr-agent-question', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;
const schema = { type: 'object' as const, properties: {
  environment: { type: 'string' as const, title: 'Environment', enum: ['development', 'staging', 'production'] },
  notes: { type: 'string' as const, title: 'Notes', description: 'Optional context for the agent.' },
}, required: ['environment'] };
export const Default: Story = { render: () => html`<lr-agent-question request-id="environment-question" message="Which environment should the agent inspect?" .schema=${schema}></lr-agent-question>` };
export const Submitted: Story = { render: () => html`<lr-agent-question request-id="environment-question" status="submitted" message="Which environment should the agent inspect?" .schema=${schema} .value=${{ environment: 'staging' }}></lr-agent-question>` };
export const NarrowRTL: Story = { render: () => html`<div dir="rtl" style="inline-size: 320px; max-inline-size: 100%;"><lr-agent-question request-id="environment-question" message="Which environment should the agent inspect?" .schema=${schema}></lr-agent-question></div>` };

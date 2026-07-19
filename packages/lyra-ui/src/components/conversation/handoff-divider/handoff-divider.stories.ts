import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './handoff-divider.js';
import '../../media/avatar/avatar.js';

const meta: Meta = {
  title: 'HandoffDivider',
  component: 'lr-handoff-divider',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'A labeled semantic separator marking control transfer between agents in a transcript.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-handoff-divider style="max-width: 32rem;" agent="Research Agent"></lr-handoff-divider>`,
};

export const FromTo: Story = {
  name: 'From one agent to another',
  render: () => html`
    <lr-handoff-divider style="max-width: 32rem;" from-agent="Planner" agent="Research Agent">
      <lr-avatar slot="avatar" initials="RA"></lr-avatar>
    </lr-handoff-divider>
  `,
};

export const NoAgentSet: Story = {
  name: 'Generic fallback (no agent set)',
  render: () => html`<lr-handoff-divider style="max-width: 32rem;"></lr-handoff-divider>`,
};

export const CustomLabel: Story = {
  render: () => html`
    <lr-handoff-divider style="max-width: 32rem;" label="Escalated to a human reviewer"></lr-handoff-divider>
  `,
};

export const Narrow320: Story = {
  name: 'Narrow (320px)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-handoff-divider from-agent="Long Planner Agent Name" agent="Very Long Research Agent Name">
        <lr-avatar slot="avatar" initials="RA"></lr-avatar>
      </lr-handoff-divider>
    </div>
  `,
};

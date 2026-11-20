import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../../lr-background-runs.js';
import type { BackgroundRun } from './background-runs.class.js';

const meta: Meta = {
  title: 'AgentTools/BackgroundRuns',
  component: 'lr-background-runs',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A controlled list of background run states. Open and cancel buttons emit requests; the host owns status and run execution.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const runs: BackgroundRun[] = [
  { id: 'index', label: 'Index the project', description: 'Prepare repository search data.', status: 'running' },
  { id: 'review', label: 'Review dependencies', description: 'Waiting for an available worker.', status: 'queued' },
  { id: 'deploy', label: 'Deploy preview', description: 'Paused until a reviewer approves.', status: 'waiting-approval' },
  { id: 'format', label: 'Check formatting', status: 'completed' },
  { id: 'tests', label: 'Run browser tests', status: 'failed' },
];

export const MixedStates: Story = {
  render: () => html`<lr-background-runs style="max-inline-size: 48rem" .runs=${runs}></lr-background-runs>`,
};

export const Disabled: Story = {
  render: () => html`<lr-background-runs style="max-inline-size: 48rem" disabled .runs=${runs}></lr-background-runs>`,
};

export const Empty: Story = {
  render: () => html`<lr-background-runs label="Work history"></lr-background-runs>`,
};

export const PlainFrame: Story = {
  render: () => html`<div style="max-inline-size: 48rem; border: var(--lr-border-width-thin) solid var(--lr-color-border); border-radius: var(--lr-radius); padding: var(--lr-space-m)">
    <lr-background-runs frame="plain" .runs=${runs}></lr-background-runs>
  </div>`,
};

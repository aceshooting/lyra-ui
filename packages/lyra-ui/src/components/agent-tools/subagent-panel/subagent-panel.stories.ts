import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './subagent-panel.js';

const meta: Meta = { title: 'Agent Tools/Subagent Panel', component: 'lr-subagent-panel' };
export default meta;
type Story = StoryObj;

export const NestedRuns: Story = {
  render: () => html`<lr-subagent-panel
    .runs=${[
      { id: 'research', label: 'Researcher', status: 'running', task: 'Find primary sources', progress: 0.6 },
      { id: 'writer', parentId: 'research', label: 'Writer', status: 'waiting-input', task: 'Draft the response' },
      { id: 'review', label: 'Reviewer', status: 'queued', task: 'Check every claim' },
    ]}
  ></lr-subagent-panel>`,
};


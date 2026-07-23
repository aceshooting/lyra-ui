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

export const Narrow320: Story = {
  name: 'Narrow (320px, long nested runs)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-subagent-panel
        selected-run-id="writer"
        .runs=${[
          {
            id: 'research',
            label: 'Primary-source research specialist',
            status: 'running',
            task: 'Find authoritative evidence for every customer-facing claim in the proposed response',
            progress: 0.6,
          },
          {
            id: 'writer',
            parentId: 'research',
            label: 'Multilingual response drafting specialist',
            status: 'waiting-input',
            task: 'Draft the response after the research specialist supplies sources',
          },
          {
            id: 'review',
            parentId: 'writer',
            label: 'Compliance and factual-accuracy reviewer',
            status: 'error',
            task: 'Verify every claim and request a retry when evidence is missing',
          },
        ]}
      ></lr-subagent-panel>
    </div>
  `,
};

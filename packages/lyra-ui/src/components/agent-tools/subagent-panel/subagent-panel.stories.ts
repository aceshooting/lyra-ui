import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import type { SubagentRun } from './subagent-panel.js';
import './subagent-panel.js';

const meta: Meta = { title: 'Agent Tools/Subagent Panel', component: 'lr-subagent-panel' };
export default meta;
type Story = StoryObj;

const depth12Runs: SubagentRun[] = Array.from({ length: 13 }, (_, depth) => ({
  id: `depth-${depth}`,
  ...(depth > 0 ? { parentId: `depth-${depth - 1}` } : {}),
  label: `Depth ${depth}`,
  status: depth === 11 ? 'error' : depth === 12 ? 'waiting-approval' : 'done',
}));

export const NestedRuns: Story = {
  render: () => html`<lr-subagent-panel
    .runs=${[
      { id: 'research', label: 'Researcher', status: 'running', task: 'Find primary sources', progressRatio: 0.6 },
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
            progressRatio: 0.6,
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

/** Every supported visual indentation depth, with the longest badge plus both action variants. */
export const Depth12Narrow: Story = {
  name: 'Depth 12 narrow',
  render: () => html`
    <div dir="rtl" style="inline-size: 320px; max-inline-size: 100%;">
      <lr-subagent-panel selected-run-id="depth-12" .runs=${depth12Runs}></lr-subagent-panel>
    </div>
  `,
};

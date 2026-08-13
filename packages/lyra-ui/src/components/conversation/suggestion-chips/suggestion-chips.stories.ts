import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './suggestion-chips.js';

const meta: Meta = {
  title: 'SuggestionChips',
  component: 'lr-suggestion-chips',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Starter prompts and follow-up suggestions as a chip row. Never writes into a composer or sends anything — the host listens for lr-suggestion-select.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const followUps = [
  { id: 'a', label: 'What caused the spike?', icon: '🔎', detail: 'Based on the error rate chart above' },
  { id: 'b', label: 'Show the affected services', icon: '📊' },
  { id: 'c', label: 'Draft a status update', icon: '✍️' },
];

export const ScrollableRow: Story = {
  render: () => html`<lr-suggestion-chips .suggestions=${followUps}></lr-suggestion-chips>`,
};

export const WrappedStarterGrid: Story = {
  render: () => html`
    <lr-suggestion-chips
      wrap
      .suggestions=${[
        { id: '1', label: 'Summarize this document' },
        { id: '2', label: 'Find action items' },
        { id: '3', label: 'Translate to French' },
        { id: '4', label: 'Explain like I am five' },
      ]}
    ></lr-suggestion-chips>
  `,
};

export const CenteredUnderEmptyState: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-suggestion-chips-justify: center` centers every chip line, including the short final one after a wrap — which `::part(base)` alone cannot do, because the row fills the available inline size once the chips wrap.',
      },
    },
  },
  render: () => html`
    <div style="max-width:26rem;text-align:center;">
      <h3 style="margin-block-end:0.25rem;">Start a conversation</h3>
      <p style="margin-block-start:0;color:var(--lr-color-text-quiet);">Pick a prompt, or type your own.</p>
      <lr-suggestion-chips
        wrap
        style="--lr-suggestion-chips-justify: center;"
        .suggestions=${[
          { id: '1', label: 'Summarize this document' },
          { id: '2', label: 'Find action items' },
          { id: '3', label: 'Translate to French' },
          { id: '4', label: 'Explain like I am five' },
          { id: '5', label: 'Draft a reply' },
        ]}
      ></lr-suggestion-chips>
    </div>
  `,
};

export const Empty: Story = {
  render: () => html`<p>Nothing renders below when suggestions is empty:</p>
    <lr-suggestion-chips .suggestions=${[]}></lr-suggestion-chips>`,
};

export const Narrow320px: Story = {
  render: () => html`
    <div style="max-width:320px;border:1px dashed var(--lr-color-border);padding:8px;">
      <lr-suggestion-chips .suggestions=${followUps}></lr-suggestion-chips>
    </div>
  `,
};

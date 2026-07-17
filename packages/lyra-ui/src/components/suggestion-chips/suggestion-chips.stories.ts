import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './suggestion-chips.js';

const meta: Meta = {
  title: 'SuggestionChips',
  component: 'lyra-suggestion-chips',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Starter prompts and follow-up suggestions as a chip row. Never writes into a composer or sends anything — the host listens for lyra-suggestion-select.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const followUps = [
  { id: 'a', label: 'What caused the spike?', detail: 'Based on the error rate chart above' },
  { id: 'b', label: 'Show the affected services' },
  { id: 'c', label: 'Draft a status update' },
];

export const ScrollableRow: Story = {
  render: () => html`<lyra-suggestion-chips .suggestions=${followUps}></lyra-suggestion-chips>`,
};

export const WrappedStarterGrid: Story = {
  render: () => html`
    <lyra-suggestion-chips
      wrap
      .suggestions=${[
        { id: '1', label: 'Summarize this document' },
        { id: '2', label: 'Find action items' },
        { id: '3', label: 'Translate to French' },
        { id: '4', label: 'Explain like I am five' },
      ]}
    ></lyra-suggestion-chips>
  `,
};

export const Empty: Story = {
  render: () => html`<p>Nothing renders below when suggestions is empty:</p>
    <lyra-suggestion-chips .suggestions=${[]}></lyra-suggestion-chips>`,
};

export const Narrow320px: Story = {
  render: () => html`
    <div style="max-width:320px;border:1px dashed var(--lyra-color-border);padding:8px;">
      <lyra-suggestion-chips .suggestions=${followUps}></lyra-suggestion-chips>
    </div>
  `,
};

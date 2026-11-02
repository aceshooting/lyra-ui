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
          'Starter prompts and follow-up suggestions as a chip row. Each item has a unique nonempty suggestionId; invalid and later duplicate identifiers are omitted. Suggestions are a bounded clone-owned frozen snapshot; create and reassign a new array after changes. Never writes into a composer or sends anything — the host listens for lr-suggestion-select with { suggestionId, label }.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const followUps = [
  { suggestionId: 'a', label: 'What caused the spike?', icon: '🔎', detail: 'Based on the error rate chart above' },
  { suggestionId: 'b', label: 'Show the affected services', icon: '📊' },
  { suggestionId: 'c', label: 'Draft a status update', icon: '✍️' },
];

export const ScrollableRow: Story = {
  render: () => html`<lr-suggestion-chips .suggestions=${followUps}></lr-suggestion-chips>`,
};

/** A suggestion can be marked `disabled`, rendering it as a genuinely non-actionable chip: no
 *  roving tab stop, no hover/press affordance, and activating it emits nothing. */
export const DisabledSuggestion: Story = {
  render: () => html`
    <lr-suggestion-chips
      .suggestions=${[
        ...followUps,
        { suggestionId: 'd', label: 'Escalate to on-call (unavailable)', disabled: true },
      ]}
    ></lr-suggestion-chips>
  `,
};

export const WrappedStarterGrid: Story = {
  render: () => html`
    <lr-suggestion-chips
      wrap
      .suggestions=${[
        { suggestionId: '1', label: 'Summarize this document' },
        { suggestionId: '2', label: 'Find action items' },
        { suggestionId: '3', label: 'Translate to French' },
        { suggestionId: '4', label: 'Explain like I am five' },
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
          { suggestionId: '1', label: 'Summarize this document' },
          { suggestionId: '2', label: 'Find action items' },
          { suggestionId: '3', label: 'Translate to French' },
          { suggestionId: '4', label: 'Explain like I am five' },
          { suggestionId: '5', label: 'Draft a reply' },
        ]}
      ></lr-suggestion-chips>
    </div>
  `,
};

export const MultiLineStarterPrompts: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'With `wrap` set, each chip label shows up to three lines and no chip grows wider than the row, so full-question starter prompts stay readable in a narrow (24rem) chat column. `--lr-suggestion-chips-label-lines` sets the line count (the scrolling row defaults to 1) and `--lr-suggestion-chips-chip-max-inline-size` the chip cap (default 16rem).',
      },
    },
  },
  render: () => html`
    <div style="max-width:24rem;border:1px dashed var(--lr-color-border);padding:8px;">
      <lr-suggestion-chips
        wrap
        .suggestions=${[
          { suggestionId: '1', label: 'How do I migrate the billing service to the new event bus without losing in-flight invoices?' },
          { suggestionId: '2', label: 'What changed in the latest release, and which of those changes affect our deployment?' },
          { suggestionId: '3', label: 'Draft a reply' },
        ]}
      ></lr-suggestion-chips>
    </div>
    <div style="max-width:24rem;border:1px dashed var(--lr-color-border);padding:8px;margin-block-start:1rem;">
      <lr-suggestion-chips
        wrap
        style="--lr-suggestion-chips-label-lines: 4; --lr-suggestion-chips-chip-max-inline-size: 100%;"
        .suggestions=${[
          { suggestionId: '1', label: 'How do I migrate the billing service to the new event bus without losing in-flight invoices?' },
          { suggestionId: '2', label: 'Summarize this document' },
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

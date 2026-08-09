import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './flow-node.js';

const meta: Meta = {
  title: 'Flow Node',
  component: 'lr-flow-node',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-flow-node heading="Web search"></lr-flow-node>`,
};

export const RunStates: Story = {
  render: () => html`
    <div style="display:flex;flex-direction:column;gap:1rem;align-items:flex-start">
      <lr-flow-node heading="Fetch data" status="pending"></lr-flow-node>
      <lr-flow-node
        heading="Summarize"
        status="running"
        progress="40"
        duration-ms="1800"
        status-detail="chunk 2 of 5"
      ></lr-flow-node>
      <lr-flow-node heading="Notify" status="success" duration-ms="812"></lr-flow-node>
      <lr-flow-node heading="Validate" status="error" status-detail="schema mismatch"></lr-flow-node>
      <lr-flow-node heading="Send email" status="denied"></lr-flow-node>
    </div>
  `,
};

export const RetintedRunStates: Story = {
  name: 'Retinted run states',
  parameters: {
    docs: {
      description: {
        story:
          'Status-dot colors can be retinted independently without changing the shared brand, success, warning, or danger tokens.',
      },
    },
  },
  render: () => html`
    <div
      style="
        display:flex;
        flex-direction:column;
        gap:1rem;
        align-items:flex-start;
        --lr-flow-node-status-pending-color: var(--lr-color-text);
        --lr-flow-node-status-running-color: var(--lr-color-danger);
        --lr-flow-node-status-success-color: var(--lr-color-brand);
        --lr-flow-node-status-error-color: var(--lr-color-warning);
        --lr-flow-node-status-denied-color: var(--lr-color-success);
      "
    >
      <lr-flow-node heading="Queued" status="pending"></lr-flow-node>
      <lr-flow-node heading="Fetching" status="running"></lr-flow-node>
      <lr-flow-node heading="Complete" status="success"></lr-flow-node>
      <lr-flow-node heading="Failed" status="error"></lr-flow-node>
      <lr-flow-node heading="Denied" status="denied"></lr-flow-node>
    </div>
  `,
};

export const RetintedProgress: Story = {
  name: 'Retinted progress track and fill',
  parameters: {
    docs: {
      description: {
        story:
          'The progress track and fill inherit independent component hooks, so a canvas can retint every descendant node without changing shared border or brand tokens.',
      },
    },
  },
  render: () => html`
    <div
      style="
        --lr-flow-node-progress-track-color: var(--lr-color-warning-quiet);
        --lr-flow-node-progress-fill-color: var(--lr-color-warning);
      "
    >
      <lr-flow-node heading="Index documents" status="running" progress="64"></lr-flow-node>
    </div>
  `,
};

export const WithSlots: Story = {
  render: () => html`
    <lr-flow-node heading="Review" status="running">
      <span slot="icon">👁</span>
      Custom body content describing the review step.
      <button slot="toolbar" type="button">Open</button>
    </lr-flow-node>
  `,
};

export const VerticalOrientation: Story = {
  render: () => html`<lr-flow-node heading="Fetch data" orientation="vertical"></lr-flow-node>`,
};

export const NarrowAllocation: Story = {
  name: 'Narrow allocation (320px)',
  parameters: {
    docs: {
      description: {
        story: 'The card wraps its heading/body rather than clipping at a 320px allocation.',
      },
    },
  },
  render: () => html`
    <div style="inline-size:320px; max-inline-size:100%; border:1px dashed var(--lr-color-border); padding:0.5rem;">
      <lr-flow-node
        heading="Summarize a long document into a structured report with multiple sections"
        status="running"
        progress="40"
      ></lr-flow-node>
    </div>
  `,
};

export const Compact: Story = {
  name: 'compact (dense canvas)',
  parameters: {
    docs: {
      description: {
        story:
          '`compact` tightens the card padding for dense canvases and palette previews; the border, background, shadow and every state treatment stay. Retune it per canvas with `--lr-flow-node-compact-padding` / `--lr-flow-node-compact-gap`.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; gap:1rem; align-items:flex-start">
      <lr-flow-node heading="Fetch data" status="running" progress="40"></lr-flow-node>
      <lr-flow-node compact heading="Fetch data" status="running" progress="40"></lr-flow-node>
      <lr-flow-node
        compact
        style="--lr-flow-node-compact-padding: 0.125rem"
        heading="Fetch data"
        status="running"
        progress="40"
      ></lr-flow-node>
    </div>
  `,
};

export const RetintedSelection: Story = {
  name: 'Retinted selection border',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-flow-node-selected-border` recolors the `selected` card border without touching the library-wide `--lr-color-brand` token (the right pair is retinted, the left keeps the default). Unset, it renders exactly as before.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; gap:1rem; align-items:flex-start">
      <lr-flow-node heading="Fetch data" selected></lr-flow-node>
      <lr-flow-node
        style="--lr-flow-node-selected-border: var(--lr-color-success)"
        heading="Summarize"
        selected
      ></lr-flow-node>
    </div>
  `,
};

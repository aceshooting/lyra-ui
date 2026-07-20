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
      <lr-flow-node heading="Summarize" status="running" progress="40" duration-ms="1800" status-detail="chunk 2 of 5"></lr-flow-node>
      <lr-flow-node heading="Notify" status="success" duration-ms="812"></lr-flow-node>
      <lr-flow-node heading="Validate" status="error" status-detail="schema mismatch"></lr-flow-node>
      <lr-flow-node heading="Send email" status="denied"></lr-flow-node>
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

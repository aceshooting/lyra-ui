import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../flow-canvas/flow-canvas.js';
import './flow-run-overlay.js';
import type { FlowNode, FlowEdge, FlowRunDecorations } from '../flow-canvas/flow-canvas.js';

const nodes: FlowNode[] = [
  { id: 'fetch', position: { x: 0, y: 0 }, data: { label: 'Fetch data' } },
  { id: 'summarize', position: { x: 240, y: 0 }, data: { label: 'Summarize' } },
  { id: 'notify', position: { x: 480, y: 0 }, data: { label: 'Notify' } },
];
const edges: FlowEdge[] = [
  { id: 'fetch-summarize', source: 'fetch', target: 'summarize' },
  { id: 'summarize-notify', source: 'summarize', target: 'notify' },
];
const decorations: FlowRunDecorations = {
  fetch: { status: 'success', durationMs: 812 },
  summarize: { status: 'running', progress: 40, detail: 'chunk 2 of 5' },
};

const meta: Meta = {
  title: 'Flow Run Overlay',
  component: 'lr-flow-run-overlay',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-flow-canvas style="width:100%;height:20rem" .nodes=${nodes} .edges=${edges}>
      <lr-flow-run-overlay slot="top-end" .decorations=${decorations}></lr-flow-run-overlay>
    </lr-flow-canvas>
  `,
};

export const HiddenSummary: Story = {
  render: () => html`
    <lr-flow-canvas style="width:100%;height:20rem" .nodes=${nodes} .edges=${edges}>
      <lr-flow-run-overlay slot="top-end" hide-summary .decorations=${decorations}></lr-flow-run-overlay>
    </lr-flow-canvas>
  `,
};

export const NarrowAllocation: Story = {
  name: 'Narrow allocation (320px)',
  parameters: { docs: { description: { story: 'The strip wraps onto one extra row at a 320px allocation.' } } },
  render: () => html`
    <div style="inline-size:320px; max-inline-size:100%; block-size:16rem; border:1px dashed var(--lr-color-border);">
      <lr-flow-canvas style="width:100%;height:100%" .nodes=${nodes} .edges=${edges}>
        <lr-flow-run-overlay slot="top-end" .decorations=${decorations}></lr-flow-run-overlay>
      </lr-flow-canvas>
    </div>
  `,
};

export const PlainInToolbar: Story = {
  name: 'appearance="plain" (embedded in a host toolbar)',
  parameters: {
    docs: {
      description: {
        story:
          'With `appearance="plain"` the strip drops its own border/background/shadow so it reads as part of a host toolbar that already draws its own frame, instead of a doubled floating card.',
      },
    },
  },
  render: () => html`
    <div
      style="display:flex; align-items:center; gap:0.75rem; padding:0.5rem 0.75rem; border:1px solid var(--lr-color-border); border-radius:var(--lr-radius); background:var(--lr-color-surface);"
    >
      <strong style="font-size:0.8125rem;">Run</strong>
      <lr-flow-run-overlay appearance="plain" .decorations=${decorations}></lr-flow-run-overlay>
    </div>
  `,
};

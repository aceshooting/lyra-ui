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
  component: 'lyra-flow-run-overlay',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-flow-canvas style="width:100%;height:20rem" .nodes=${nodes} .edges=${edges}>
      <lyra-flow-run-overlay slot="top-end" .decorations=${decorations}></lyra-flow-run-overlay>
    </lyra-flow-canvas>
  `,
};

export const HiddenSummary: Story = {
  render: () => html`
    <lyra-flow-canvas style="width:100%;height:20rem" .nodes=${nodes} .edges=${edges}>
      <lyra-flow-run-overlay slot="top-end" hide-summary .decorations=${decorations}></lyra-flow-run-overlay>
    </lyra-flow-canvas>
  `,
};

export const NarrowAllocation: Story = {
  name: 'Narrow allocation (320px)',
  parameters: { docs: { description: { story: 'The strip wraps onto one extra row at a 320px allocation.' } } },
  render: () => html`
    <div style="inline-size:320px; max-inline-size:100%; block-size:16rem; border:1px dashed var(--lyra-color-border);">
      <lyra-flow-canvas style="width:100%;height:100%" .nodes=${nodes} .edges=${edges}>
        <lyra-flow-run-overlay slot="top-end" .decorations=${decorations}></lyra-flow-run-overlay>
      </lyra-flow-canvas>
    </div>
  `,
};

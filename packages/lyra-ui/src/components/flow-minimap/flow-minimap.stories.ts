import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../flow-canvas/flow-canvas.js';
import './flow-minimap.js';
import type { FlowNode, FlowEdge } from '../flow-canvas/flow-canvas.js';

const nodes: FlowNode[] = [
  { id: 'fetch', position: { x: 0, y: 0 }, data: { label: 'Fetch data' } },
  { id: 'summarize', position: { x: 240, y: 0 }, data: { label: 'Summarize' } },
  { id: 'notify', position: { x: 480, y: 240 }, data: { label: 'Notify' } },
];
const edges: FlowEdge[] = [
  { id: 'fetch-summarize', source: 'fetch', target: 'summarize' },
  { id: 'summarize-notify', source: 'summarize', target: 'notify' },
];

const meta: Meta = {
  title: 'Flow Minimap',
  component: 'lr-flow-minimap',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-flow-canvas style="width:100%;height:24rem" .nodes=${nodes} .edges=${edges}>
      <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    </lr-flow-canvas>
  `,
};

export const ExternalPlacement: Story = {
  render: () => html`
    <div style="display:flex;flex-direction:column;gap:0.5rem">
      <lr-flow-canvas id="wf-ext" style="width:100%;height:20rem" .nodes=${nodes} .edges=${edges}></lr-flow-canvas>
      <lr-flow-minimap for="wf-ext"></lr-flow-minimap>
    </div>
  `,
};

export const NarrowAllocation: Story = {
  name: 'Narrow allocation (320px)',
  parameters: {
    docs: {
      description: { story: 'Corner overlay slots stack rather than overlap at a 320px canvas allocation.' },
    },
  },
  render: () => html`
    <div style="inline-size:320px; max-inline-size:100%; block-size:16rem; border:1px dashed var(--lr-color-border);">
      <lr-flow-canvas style="width:100%;height:100%" .nodes=${nodes} .edges=${edges}>
        <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
      </lr-flow-canvas>
    </div>
  `,
};

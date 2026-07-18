import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './flow-canvas.js';
import type { FlowNode, FlowEdge } from './flow-canvas.js';

const nodes: FlowNode[] = [
  { id: 'fetch', position: { x: 0, y: 0 }, data: { label: 'Fetch data' } },
  { id: 'summarize', position: { x: 240, y: 0 }, data: { label: 'Summarize' } },
  { id: 'notify', position: { x: 480, y: 0 }, data: { label: 'Notify' } },
];

const edges: FlowEdge[] = [
  { id: 'fetch-summarize', source: 'fetch', target: 'summarize', label: 'then' },
  { id: 'summarize-notify', source: 'summarize', target: 'notify' },
];

const meta: Meta = {
  title: 'Flow Canvas',
  component: 'lyra-flow-canvas',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-flow-canvas style="width:100%;height:24rem" .nodes=${nodes} .edges=${edges}></lyra-flow-canvas>
  `,
};

export const Editable: Story = {
  render: () => html`
    <lyra-flow-canvas
      style="width:100%;height:24rem"
      nodes-draggable
      connectable
      .nodes=${nodes}
      .edges=${edges}
    ></lyra-flow-canvas>
  `,
};

export const Empty: Story = {
  render: () => html`<lyra-flow-canvas style="width:100%;height:16rem"></lyra-flow-canvas>`,
};

export const NarrowAllocation: Story = {
  name: 'Narrow allocation (320px)',
  parameters: {
    docs: {
      description: {
        story: 'At a 320px allocation the canvas stays a functional pan/zoom viewer; corner overlay slots stack rather than overlapping.',
      },
    },
  },
  render: () => html`
    <div style="inline-size:320px; max-inline-size:100%; block-size:16rem; border:1px dashed var(--lyra-color-border);">
      <lyra-flow-canvas style="width:100%;height:100%" .nodes=${nodes} .edges=${edges}></lyra-flow-canvas>
    </div>
  `,
};

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../flow-canvas/flow-canvas.js';
import './flow-controls.js';
import type { FlowNode } from '../flow-canvas/flow-canvas.js';

const nodes: FlowNode[] = [
  { id: 'fetch', position: { x: 0, y: 0 }, data: { label: 'Fetch data' } },
  { id: 'summarize', position: { x: 240, y: 0 }, data: { label: 'Summarize' } },
];

const meta: Meta = {
  title: 'Flow Controls',
  component: 'lyra-flow-controls',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-flow-canvas style="width:100%;height:20rem" .nodes=${nodes}>
      <lyra-flow-controls slot="bottom-start"></lyra-flow-controls>
    </lyra-flow-canvas>
  `,
};

export const HorizontalHideLock: Story = {
  render: () => html`
    <lyra-flow-canvas style="width:100%;height:20rem" .nodes=${nodes}>
      <lyra-flow-controls slot="bottom-start" orientation="horizontal" hide-lock></lyra-flow-controls>
    </lyra-flow-canvas>
  `,
};

export const NarrowAllocation: Story = {
  name: 'Narrow allocation (320px)',
  render: () => html`
    <div style="inline-size:320px; max-inline-size:100%; block-size:14rem; border:1px dashed var(--lyra-color-border);">
      <lyra-flow-canvas style="width:100%;height:100%" .nodes=${nodes}>
        <lyra-flow-controls slot="bottom-start"></lyra-flow-controls>
      </lyra-flow-canvas>
    </div>
  `,
};

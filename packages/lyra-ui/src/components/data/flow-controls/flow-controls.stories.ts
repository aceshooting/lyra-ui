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
  component: 'lr-flow-controls',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-flow-canvas style="width:100%;height:20rem" .nodes=${nodes}>
      <lr-flow-controls slot="bottom-start"></lr-flow-controls>
    </lr-flow-canvas>
  `,
};

export const HorizontalHideLock: Story = {
  render: () => html`
    <lr-flow-canvas style="width:100%;height:20rem" .nodes=${nodes}>
      <lr-flow-controls slot="bottom-start" orientation="horizontal" hide-lock></lr-flow-controls>
    </lr-flow-canvas>
  `,
};

export const PlainInToolbar: Story = {
  name: 'appearance="plain" (inside a host toolbar)',
  parameters: {
    docs: {
      description: {
        story:
          'With `appearance="plain"` the cluster drops its border, background **and** its floating-surface shadow, so it sits flush in a host toolbar that already draws a surface instead of doubling the frame. The buttons keep their shared minimum hit area and their hover/focus rings.',
      },
    },
  },
  render: () => html`
    <div
      style="display:flex; align-items:center; gap:0.5rem; padding:0.25rem 0.5rem; border:1px solid var(--lr-color-border); border-radius:var(--lr-radius); background:var(--lr-color-surface);"
    >
      <span style="font-size:0.8125rem; color:var(--lr-color-text-quiet);">Workflow</span>
      <lr-flow-controls for="plain-canvas" orientation="horizontal" appearance="plain"></lr-flow-controls>
    </div>
    <lr-flow-canvas id="plain-canvas" style="width:100%;height:16rem" .nodes=${nodes}></lr-flow-canvas>
  `,
};

export const NarrowAllocation: Story = {
  name: 'Narrow allocation (320px)',
  render: () => html`
    <div style="inline-size:320px; max-inline-size:100%; block-size:14rem; border:1px dashed var(--lr-color-border);">
      <lr-flow-canvas style="width:100%;height:100%" .nodes=${nodes}>
        <lr-flow-controls slot="bottom-start"></lr-flow-controls>
      </lr-flow-canvas>
    </div>
  `,
};

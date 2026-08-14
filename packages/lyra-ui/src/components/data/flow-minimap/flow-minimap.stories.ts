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

export const CanceledDragKeepsMapClick: Story = {
  name: 'Canceled drag keeps the next map click',
  parameters: {
    docs: {
      description: {
        story:
          'If a touch-scroll takeover cancels a viewport drag, the next genuine map click still recenters the canvas. Only the browser-synthesized click after a completed pointerup is consumed.',
      },
    },
  },
  render: () => html`
    <lr-flow-canvas style="width:100%;height:24rem" .nodes=${nodes} .edges=${edges}>
      <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    </lr-flow-canvas>
  `,
};

export const InteractionAnnouncements: Story = {
  name: 'Viewport interaction announcements',
  parameters: {
    docs: {
      description: {
        story:
          'Keyboard navigation, click-to-center, wheel zoom, and a completed viewport drag all announce the applied viewport through the shared polite sink. Dense wheel updates follow the canvas snapshot cadence, and a drag announces its final position once.',
      },
    },
  },
  render: () => html`
    <lr-flow-canvas style="width:100%;height:24rem" .nodes=${nodes} .edges=${edges}>
      <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    </lr-flow-canvas>
  `,
};

export const RetintedRunStates: Story = {
  name: 'Retinted run states',
  parameters: {
    docs: {
      description: {
        story:
          'Each execution-state rectangle has its own component-scoped color hook; the shared semantic palette remains unchanged.',
      },
    },
  },
  render: () => html`
    <lr-flow-canvas
      style="width:100%;height:20rem"
      .nodes=${nodes}
      .edges=${edges}
      .decorations=${{
        fetch: { status: 'success' },
        summarize: { status: 'running' },
        notify: { status: 'denied' },
      }}
    >
      <lr-flow-minimap
        slot="bottom-end"
        style="
          --lr-flow-status-running-color: var(--lr-color-danger);
          --lr-flow-status-success-color: var(--lr-color-brand);
          --lr-flow-status-denied-color: var(--lr-color-success);
        "
      ></lr-flow-minimap>
    </lr-flow-canvas>
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

const sprawlingNodes: FlowNode[] = [
  { id: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
  { id: 'far', position: { x: 6000, y: 4200 }, data: { label: 'Far' } },
];

export const HugeCanvasViewportFloor: Story = {
  name: 'Huge canvas (viewport-rect floor)',
  parameters: {
    docs: {
      description: {
        story:
          'Node bounds far larger than the visible viewport. The viewport rectangle is floored at ' +
          '--lr-flow-minimap-viewport-min-size so it stays a usable drag target; the second map ' +
          'opts out with 0 and shows the raw, near-invisible ratio.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; gap:1rem; flex-wrap:wrap;">
      <lr-flow-canvas style="width:24rem;height:16rem" .nodes=${sprawlingNodes}>
        <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
      </lr-flow-canvas>
      <lr-flow-canvas
        style="width:24rem;height:16rem;--lr-flow-minimap-viewport-min-size:0"
        .nodes=${sprawlingNodes}
      >
        <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
      </lr-flow-canvas>
    </div>
  `,
};

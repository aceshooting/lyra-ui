import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../flow-canvas/flow-canvas.js';
import './node-palette.js';
import type { PaletteItem } from './node-palette.js';
import type { FlowNode } from '../flow-canvas/flow-canvas.js';

const items: PaletteItem[] = [
  { type: 'http-request', label: 'HTTP Request', category: 'Data', description: 'Call an external API', keywords: ['fetch', 'api'] },
  { type: 'transform', label: 'Transform', category: 'Data', description: 'Reshape the payload' },
  { type: 'email', label: 'Send Email', category: 'Actions', disabled: true, description: 'Coming soon' },
  { type: 'webhook', label: 'Webhook', category: 'Actions', description: 'Trigger an outbound webhook' },
];

const meta: Meta = {
  title: 'Node Palette',
  component: 'lyra-node-palette',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<div style="inline-size:16rem"><lyra-node-palette .items=${items}></lyra-node-palette></div>`,
};

export const WithCanvas: Story = {
  render: () => {
    let nodes: FlowNode[] = [];
    const onPlace = (e: Event) => {
      const type = (e as CustomEvent<{ type: string }>).detail.type;
      nodes = [...nodes, { id: `${type}-${nodes.length}`, type }];
    };
    return html`
      <div style="display:flex;height:20rem;gap:1rem">
        <div style="inline-size:16rem"><lyra-node-palette .items=${items} @lyra-palette-place=${onPlace}></lyra-node-palette></div>
        <lyra-flow-canvas droppable style="flex:1" .nodes=${nodes}></lyra-flow-canvas>
      </div>
    `;
  },
};

export const NarrowAllocation: Story = {
  name: 'Narrow allocation (320px)',
  parameters: {
    docs: { description: { story: 'Items stack single-column and truncate their description at a 320px allocation.' } },
  },
  render: () => html`
    <div style="inline-size:320px; max-inline-size:100%; border:1px dashed var(--lyra-color-border); padding:0.5rem;">
      <lyra-node-palette .items=${items}></lyra-node-palette>
    </div>
  `,
};

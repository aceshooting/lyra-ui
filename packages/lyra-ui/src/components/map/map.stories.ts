import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LegendEntry } from '../../lyra.js';

const legend: LegendEntry[] = [
  { color: '#5b8def', label: 'Low' },
  { color: '#e5484d', label: 'High' },
];

const meta: Meta = {
  title: 'Map',
  component: 'lyra-map',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Demoed with a raster OpenStreetMap tile style since a vector style needs an API key.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-map
      style="height: 20rem"
      center="[2.3522, 48.8566]"
      zoom="4"
      .legend=${legend}
      .mapStyle=${{
        version: 8,
        sources: {
          demo: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'demo', type: 'raster', source: 'demo' }],
      }}
    ></lyra-map>
  `,
};

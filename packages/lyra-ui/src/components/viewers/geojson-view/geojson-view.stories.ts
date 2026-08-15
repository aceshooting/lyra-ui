import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './geojson-view.js';
import '../../../../../../.storybook/maplibre-worker.js';

const meta: Meta = {
  title: 'DocumentViewer/GeoJsonView (legacy tag)',
  component: 'lr-geojson-view',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Permanent compatibility tag for the pre-v9 `lr-geojson-view` name. Use `lr-geojson-viewer` ' +
          'for new code -- see its own docs page for the full story set. This subclass preserves ' +
          '`instanceof LyraGeoJsonViewer` while allowing both tag names in one custom-elements registry.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const sample = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-122.42, 37.77] }, properties: {} },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-122.5, 37.8] }, properties: {} },
  ],
};
const src = `data:application/geo+json,${encodeURIComponent(JSON.stringify(sample))}`;

export const Default: Story = {
  render: () => html`<lr-geojson-view src=${src} name="legacy-zones.geojson"></lr-geojson-view>`,
};

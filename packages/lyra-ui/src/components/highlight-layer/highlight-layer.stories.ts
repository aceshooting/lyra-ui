import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './highlight-layer.js';
import type { HighlightLayerItem } from './highlight-layer.class.js';

const meta: Meta = {
  title: 'DocumentViewer/HighlightLayer',
  component: 'lr-highlight-layer',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Paints highlight rectangles (percent-of-box coordinates) over positioned content.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const ITEMS: HighlightLayerItem[] = [
  { id: 'zone-a', rects: [{ x: 12, y: 30, width: 30, height: 14 }], label: 'Zone A', tone: 'warning' },
  { id: 'zone-b', rects: [{ x: 12, y: 55, width: 60, height: 10 }], tone: 'accent' },
];

export const OverImage: Story = {
  render: () => html`
    <figure style="position:relative; width:320px; margin:0;">
      <div style="width:320px; height:200px; background:var(--lr-color-surface-raised);"></div>
      <lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>
    </figure>
  `,
};

export const NonInteractive: Story = {
  render: () => html`
    <figure style="position:relative; width:320px; margin:0;">
      <div style="width:320px; height:200px; background:var(--lr-color-surface-raised);"></div>
      <lr-highlight-layer .items=${ITEMS} .interactive=${false}></lr-highlight-layer>
    </figure>
  `,
};

export const Narrow320: Story = {
  render: () => html`
    <figure style="position:relative; width:320px; margin:0;">
      <div style="width:320px; height:160px; background:var(--lr-color-surface-raised);"></div>
      <lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>
    </figure>
  `,
};

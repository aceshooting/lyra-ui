import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './pan-zoom.js';

const meta: Meta = {
  title: 'Media/Pan Zoom',
  component: 'lr-pan-zoom',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const SlottedContent: Story = {
  render: () => html`<lr-pan-zoom aria-label="Diagram preview">
    <div style="inline-size: 32rem; block-size: 16rem; display: grid; place-items: center; background: var(--lr-color-brand-quiet);">
      Zoomable diagram
    </div>
  </lr-pan-zoom>`,
};

export const ImageSource: Story = {
  render: () => html`<lr-pan-zoom
    src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
    alt="Preview"
    aria-label="Image preview"
  ></lr-pan-zoom>`,
};

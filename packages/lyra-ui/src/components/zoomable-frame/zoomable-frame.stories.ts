import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Zoomable Frame',
  component: 'lyra-zoomable-frame',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const SlottedContent: Story = {
  render: () => html`<lyra-zoomable-frame aria-label="Diagram preview">
    <div style="inline-size: 32rem; block-size: 16rem; display: grid; place-items: center; background: var(--lyra-color-brand-quiet);">
      Zoomable diagram
    </div>
  </lyra-zoomable-frame>`,
};

export const ImageSource: Story = {
  render: () => html`<lyra-zoomable-frame
    src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
    alt="Preview"
    aria-label="Image preview"
  ></lyra-zoomable-frame>`,
};

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../../lr-lightbox.js';
import '../../lr-lightbox-item.js';

const swatch = (fill: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="${fill}"/></svg>`)}`;

const meta: Meta = {
  title: 'Lightbox/Lightbox Item',
  component: 'lr-lightbox-item',
  tags: ['autodocs'],
};
export default meta;

export const Default: StoryObj = {
  render: () => html`
    <lr-lightbox label="Swatches">
      <lr-lightbox-item src=${swatch('#2f6f9f')} alt="Blue swatch" width="640" height="360">
        <img src=${swatch('#2f6f9f')} alt="Blue swatch" width="160" height="90" />
        <span slot="caption">Blue</span>
      </lr-lightbox-item>
      <lr-lightbox-item src=${swatch('#9f5f2f')} alt="Amber swatch" width="640" height="360">
        <img src=${swatch('#9f5f2f')} alt="Amber swatch" width="160" height="90" />
        <span slot="caption">Amber</span>
      </lr-lightbox-item>
    </lr-lightbox>
  `,
};

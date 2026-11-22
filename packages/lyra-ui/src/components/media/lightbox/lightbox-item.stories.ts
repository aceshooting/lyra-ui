import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../../lr-lightbox.js';
import '../../lr-lightbox-item.js';

const blue =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="360"%3E%3Crect width="640" height="360" fill="%230969da"/%3E%3C/svg%3E';
const amber =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="360"%3E%3Crect width="640" height="360" fill="%23bf8700"/%3E%3C/svg%3E';

const meta: Meta = {
  title: 'Lightbox/Lightbox Item',
  component: 'lr-lightbox-item',
  tags: ['autodocs'],
};
export default meta;

export const Default: StoryObj = {
  render: () => html`
    <lr-lightbox label="Swatches">
      <lr-lightbox-item src=${blue} alt="Blue swatch" width="640" height="360">
        <img src=${blue} alt="Blue swatch" width="160" height="90" />
        <span slot="caption">Blue</span>
      </lr-lightbox-item>
      <lr-lightbox-item src=${amber} alt="Amber swatch" width="640" height="360">
        <img src=${amber} alt="Amber swatch" width="160" height="90" />
        <span slot="caption">Amber</span>
      </lr-lightbox-item>
    </lr-lightbox>
  `,
};

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './lightbox.js';
import type { LyraLightbox } from './lightbox.js';

const meta: Meta = {
  title: 'Lightbox',
  component: 'lr-lightbox',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

const images = [
  {
    src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="360"%3E%3Crect width="640" height="360" fill="%230969da"/%3E%3C/svg%3E',
    alt: 'Blue illustration',
    caption: 'Blue illustration',
  },
  {
    src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="360"%3E%3Crect width="640" height="360" fill="%23cf222e"/%3E%3C/svg%3E',
    alt: 'Red illustration',
    caption: 'Red illustration',
  },
];

export const Default: Story = {
  render: () => html`
    <button @click=${(event: Event) => {
      const lightbox = (event.currentTarget as HTMLElement).nextElementSibling as LyraLightbox;
      lightbox.open = true;
    }}>Open lightbox</button>
    <lr-lightbox .images=${images}></lr-lightbox>
  `,
};

export const OpenInitially: Story = {
  render: () => html`<lr-lightbox .images=${images} open></lr-lightbox>`,
};

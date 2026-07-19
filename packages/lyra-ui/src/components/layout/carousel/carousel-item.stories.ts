import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './carousel-item.js';

const meta: Meta = { title: 'Components/Carousel Item', component: 'lr-carousel-item' };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-carousel-item style="padding: 3rem; background: var(--lr-color-surface-raised);">Slide content</lr-carousel-item>`,
};

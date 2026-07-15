import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './carousel-item.js';

const meta: Meta = { title: 'Components/Carousel Item', component: 'lyra-carousel-item' };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-carousel-item style="padding: 3rem; background: var(--lyra-color-surface-raised);">Slide content</lyra-carousel-item>`,
};

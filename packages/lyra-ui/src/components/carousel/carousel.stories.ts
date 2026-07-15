import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Carousel',
  component: 'lyra-carousel',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-carousel aria-label="Product previews">
    <div style="padding: var(--lyra-space-2xl); background: var(--lyra-color-brand-quiet);">First panel</div>
    <div style="padding: var(--lyra-space-2xl); background: var(--lyra-color-success-quiet);">Second panel</div>
    <div style="padding: var(--lyra-space-2xl); background: var(--lyra-color-warning-quiet);">Third panel</div>
  </lyra-carousel>`,
};

export const LoopingAutoplay: Story = {
  render: () => html`<lyra-carousel loop autoplay autoplay-interval="3000" aria-label="Announcements">
    <p>Announcement one</p>
    <p>Announcement two</p>
  </lyra-carousel>`,
};

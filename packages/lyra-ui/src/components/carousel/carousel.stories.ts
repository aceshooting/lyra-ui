import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Carousel',
  component: 'lr-carousel',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-carousel aria-label="Product previews">
    <div style="padding: var(--lr-space-2xl); background: var(--lr-color-brand-quiet);">First panel</div>
    <div style="padding: var(--lr-space-2xl); background: var(--lr-color-success-quiet);">Second panel</div>
    <div style="padding: var(--lr-space-2xl); background: var(--lr-color-warning-quiet);">Third panel</div>
  </lr-carousel>`,
};

export const LoopingAutoplay: Story = {
  render: () => html`<lr-carousel loop autoplay autoplay-interval="3000" aria-label="Announcements">
    <p>Announcement one</p>
    <p>Announcement two</p>
  </lr-carousel>`,
};

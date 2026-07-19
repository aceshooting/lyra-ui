import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Skeleton',
  component: 'lr-skeleton',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Gallery: Story = {
  render: () => html`
    <div style="display:flex; gap:1rem; align-items:center;">
      <lr-skeleton label="Loading profile" width="10rem" height="1rem"></lr-skeleton>
      <lr-skeleton
        .announce=${false}
        variant="circle"
        width="3rem"
        height="3rem"
      ></lr-skeleton>
      <lr-skeleton
        .announce=${false}
        variant="rect"
        effect="sheen"
        width="6rem"
        height="3rem"
      ></lr-skeleton>
    </div>
  `,
};

export const CustomLabel: Story = {
  render: () =>
    html`<lr-skeleton label="Loading chart" width="10rem" height="1rem"></lr-skeleton>`,
};

export const RetimedMotion: Story = {
  render: () => html`
    <lr-skeleton
      effect="sheen"
      width="12rem"
      height="2rem"
      style="--lr-transition-ambient: 3s linear"
    ></lr-skeleton>
  `,
};

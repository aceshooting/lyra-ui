import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Skeleton',
  component: 'lyra-skeleton',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Gallery: Story = {
  render: () => html`
    <div style="display:flex; gap:1rem; align-items:center;">
      <lyra-skeleton label="Loading profile" width="10rem" height="1rem"></lyra-skeleton>
      <lyra-skeleton
        .announce=${false}
        variant="circle"
        width="3rem"
        height="3rem"
      ></lyra-skeleton>
      <lyra-skeleton
        .announce=${false}
        variant="rect"
        effect="sheen"
        width="6rem"
        height="3rem"
      ></lyra-skeleton>
    </div>
  `,
};

export const CustomLabel: Story = {
  render: () =>
    html`<lyra-skeleton label="Loading chart" width="10rem" height="1rem"></lyra-skeleton>`,
};

export const RetimedMotion: Story = {
  render: () => html`
    <lyra-skeleton
      effect="sheen"
      width="12rem"
      height="2rem"
      style="--lyra-transition-ambient: 3s linear"
    ></lyra-skeleton>
  `,
};

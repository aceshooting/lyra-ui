import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './skeleton.js';

const meta: Meta = {
  title: 'Skeleton',
  component: 'lr-skeleton',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A Web Awesome/Shoelace-compatible loading placeholder, decorative by default. Set `announce` on one meaningful loading owner to add a localized status. `shape` is the canonical geometry axis. An absent label localizes, while any supplied label remains literal.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Gallery: Story = {
  render: () => html`
    <div style="display:flex; gap:1rem; align-items:center;">
      <lr-skeleton announce label="Loading profile" width="10rem" height="1rem"></lr-skeleton>
      <lr-skeleton
        shape="circle"
        width="3rem"
        height="3rem"
      ></lr-skeleton>
      <lr-skeleton
        shape="rect"
        effect="sheen"
        width="6rem"
        height="3rem"
      ></lr-skeleton>
    </div>
  `,
};

export const CustomLabel: Story = {
  render: () =>
    html`<lr-skeleton announce label="Loading chart" width="10rem" height="1rem"></lr-skeleton>`,
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

export const UpstreamThemeHooks: Story = {
  render: () => html`
    <lr-skeleton
      effect="sheen"
      width="12rem"
      height="2rem"
      style="--color:var(--lr-color-brand-quiet);--sheen-color:var(--lr-color-surface);--border-radius:var(--lr-radius-pill)"
    ></lr-skeleton>
  `,
};

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
      <lyra-skeleton width="10rem" height="1rem"></lyra-skeleton>
      <lyra-skeleton variant="circle" width="3rem" height="3rem"></lyra-skeleton>
      <lyra-skeleton variant="rect" effect="sheen" width="6rem" height="3rem"></lyra-skeleton>
    </div>
  `,
};

export const CustomLabel: Story = {
  render: () =>
    html`<lyra-skeleton label="Loading chart" width="10rem" height="1rem"></lyra-skeleton>`,
};

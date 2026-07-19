import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './branch-picker.js';

const meta: Meta = {
  title: 'BranchPicker',
  component: 'lr-branch-picker',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A controlled "‹ 2 / 5 ›" navigator across regenerated/edited variants of one message. Never mutates its own index — the host applies it after handling lr-branch-change.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-branch-picker index="1" count="3"></lr-branch-picker>`,
};

export const AtFirstBranch: Story = {
  render: () => html`<lr-branch-picker index="0" count="3"></lr-branch-picker>`,
};

export const AtLastBranch: Story = {
  render: () => html`<lr-branch-picker index="2" count="3"></lr-branch-picker>`,
};

export const SingleBranchRendersNothing: Story = {
  render: () => html`<p>Nothing below this line — <code>count</code> is 1:</p>
    <lr-branch-picker index="0" count="1"></lr-branch-picker>`,
};

export const Narrow320px: Story = {
  render: () => html`
    <div style="max-width:320px;border:1px dashed var(--lr-color-border);padding:8px;">
      <lr-branch-picker index="1" count="12"></lr-branch-picker>
    </div>
  `,
};

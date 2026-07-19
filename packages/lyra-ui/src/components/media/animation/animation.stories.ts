import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './animation.js';

const meta: Meta = {
  title: 'Animation',
  component: 'lr-animation',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-animation name="fade-in" play iterations="1">
      <p>Content animated with a named preset.</p>
    </lr-animation>
  `,
};

export const Presets: Story = {
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-s);">
      <lr-animation name="slide-in-start" play iterations="1"><span>Slide in from the start</span></lr-animation>
      <lr-animation name="zoom-in" play iterations="1"><span>Zoom in</span></lr-animation>
      <lr-animation name="bounce" play iterations="1"><span>Bounce</span></lr-animation>
    </div>
  `,
};

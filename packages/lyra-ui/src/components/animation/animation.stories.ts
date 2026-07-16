import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './animation.js';

const meta: Meta = {
  title: 'Animation',
  component: 'lyra-animation',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-animation name="fade-in" play iterations="1">
      <p>Content animated with a named preset.</p>
    </lyra-animation>
  `,
};

export const Presets: Story = {
  render: () => html`
    <div style="display: grid; gap: var(--lyra-space-s);">
      <lyra-animation name="slide-in-start" play iterations="1"><span>Slide in from the start</span></lyra-animation>
      <lyra-animation name="zoom-in" play iterations="1"><span>Zoom in</span></lyra-animation>
      <lyra-animation name="bounce" play iterations="1"><span>Bounce</span></lyra-animation>
    </div>
  `,
};

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Image Comparer',
  component: 'lyra-image-comparer',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-image-comparer aria-label="Before and after comparison">
    <div slot="before" style="padding: var(--lyra-space-2xl); background: var(--lyra-color-surface-raised);">Before</div>
    <div slot="after" style="padding: var(--lyra-space-2xl); background: var(--lyra-color-brand-quiet);">After</div>
  </lyra-image-comparer>`,
};

export const Vertical: Story = {
  render: () => html`<lyra-image-comparer orientation="vertical" position="65" aria-label="Vertical comparison">
    <div slot="before" style="padding: var(--lyra-space-2xl); background: var(--lyra-color-surface-raised);">Top</div>
    <div slot="after" style="padding: var(--lyra-space-2xl); background: var(--lyra-color-brand-quiet);">Bottom</div>
  </lyra-image-comparer>`,
};

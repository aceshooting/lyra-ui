import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Image Comparer',
  component: 'lr-image-comparer',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Before/after comparison with a native range handle. Host `focus()`, `blur()`, and `click()` forward to that handle.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-image-comparer aria-label="Before and after comparison">
    <div slot="before" style="padding: var(--lr-space-2xl); background: var(--lr-color-surface-raised);">Before</div>
    <div slot="after" style="padding: var(--lr-space-2xl); background: var(--lr-color-brand-quiet);">After</div>
  </lr-image-comparer>`,
};

export const Vertical: Story = {
  render: () => html`<lr-image-comparer orientation="vertical" position="65" aria-label="Vertical comparison">
    <div slot="before" style="padding: var(--lr-space-2xl); background: var(--lr-color-surface-raised);">Top</div>
    <div slot="after" style="padding: var(--lr-space-2xl); background: var(--lr-color-brand-quiet);">Bottom</div>
  </lr-image-comparer>`,
};

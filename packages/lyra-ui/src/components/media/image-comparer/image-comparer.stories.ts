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
          'Before/after comparison with a native range input. It emits `lr-position-change` while moving and `lr-change` when a gesture commits. The `handle` slot customizes its visible affordance, `--divider-width` and `--handle-size` tune the geometry, and the `dragging` CSS state follows pointer gestures. Host `focus()`, `blur()`, and `click()` forward to the range input.',
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
  render: () => html`<lr-image-comparer
    orientation="vertical"
    position="65"
    aria-label="Vertical comparison"
    style="--divider-width: var(--lr-border-width-medium); --handle-size: var(--lr-size-2rem)"
  >
    <div slot="before" style="padding: var(--lr-space-2xl); background: var(--lr-color-surface-raised);">Top</div>
    <div slot="after" style="padding: var(--lr-space-2xl); background: var(--lr-color-brand-quiet);">Bottom</div>
    <span slot="handle" aria-hidden="true">↕</span>
  </lr-image-comparer>`,
};

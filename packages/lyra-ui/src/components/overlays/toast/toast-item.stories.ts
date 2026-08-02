import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './toast-item.js';

const meta: Meta = { title: 'Feedback/Toast item', component: 'lr-toast-item', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-toast-item>Saved successfully.</lr-toast-item>` };
export const NarrowLongContent: StoryObj = {
  render: () => html`
    <div style="inline-size:320px">
      <lr-toast-item duration="0">
        ${'A very long localized notification with an unbroken value: '}
        ${'archive-identifier-'.repeat(18)}
      </lr-toast-item>
    </div>
  `,
};

export const AliasSizes: StoryObj = {
  parameters: {
    docs: {
      description: {
        story: '`small`, `medium`, and `large` are accepted write aliases whose getters normalize to `s`, `m`, and `l`.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-s);">
      <lr-toast-item size="small" duration="0">Small alias</lr-toast-item>
      <lr-toast-item size="medium" duration="0">Medium alias</lr-toast-item>
      <lr-toast-item size="large" duration="0">Large alias</lr-toast-item>
    </div>
  `,
};

export const MappedPartsAndTokens: StoryObj = {
  render: () => html`
    <style>
      .mapped-toast-item {
        --accent-width: var(--lr-size-6px);
        --padding: var(--lr-space-l);
        --show-duration: var(--lr-transition-fast);
        --hide-duration: var(--lr-transition-ambient);
      }
      .mapped-toast-item::part(progress-ring__indicator) {
        stroke: var(--lr-color-success);
      }
      .mapped-toast-item::part(close-icon) {
        color: var(--lr-color-text);
      }
    </style>
    <lr-toast-item class="mapped-toast-item" duration="60000" variant="success">
      The mapped progress-ring and close-icon part trees remain fully styleable.
    </lr-toast-item>
  `,
};

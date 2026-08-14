import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './toast-item.js';

const meta: Meta = {
  title: 'Feedback/Toast item',
  component: 'lr-toast-item',
  tags: ['autodocs'],
  parameters: {
    docs: {
      // These demos have no args, so their rendered markup never changes. Using Storybook's
      // compiled CSF source also keeps the snippets available without relying on the dynamic
      // source event that is absent when this docs page mounts all five stories together.
      source: { type: 'auto' },
    },
  },
};
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
        story: '`small`, `medium`, and `large` remain the observable property/attribute spellings while mapping to the same rendered sizes as `s`, `m`, and `l`.',
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

export const ScopedGeometryAndCloseStates: StoryObj = {
  name: 'Scoped geometry and close states (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          'The item gap/radius stay separate from the toast region stack gap. Hover or press the close button to see its four inherited state hooks without retheming the item surface.',
      },
    },
  },
  render: () => html`
    <div
      style="inline-size: var(--lr-size-20rem); --lr-toast-item-gap: var(--lr-space-m); --lr-toast-item-radius: var(--lr-radius-pill); --lr-toast-close-button-hover-bg: var(--lr-color-brand-quiet); --lr-toast-close-button-hover-color: var(--lr-color-brand); --lr-toast-close-button-active-bg: var(--lr-color-warning-quiet); --lr-toast-close-button-active-color: var(--lr-color-warning);"
    >
      <lr-toast-item duration="0" variant="success">
        The item chrome and close interaction states are independently themeable.
      </lr-toast-item>
    </div>
  `,
};

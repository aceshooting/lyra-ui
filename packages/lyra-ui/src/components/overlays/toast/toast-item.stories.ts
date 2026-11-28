import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../../lr-toast-item.js';

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

export const DismissalReason: StoryObj = {
  render: () => html`<div>
    <lr-toast-item duration="8000" @lr-close=${(event: CustomEvent<{ reason: string }>) => {
      const output = (event.currentTarget as HTMLElement).nextElementSibling;
      if (output) output.textContent = event.detail.reason;
    }}>Changes saved</lr-toast-item>
    <output aria-label="Dismissal reason"></output>
  </div>`,
};

const infoGlyph = html`<svg slot="icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v6M12 7.5v.5"></path></svg>`;

export const IconColorAndAlignment: StoryObj = {
  name: 'Icon colour and alignment (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          'A neutral icon takes the quiet text tone while its accent bar stays unaccented; other variants paint it in their loud fill. `--lr-toast-icon-color` recolours the icon alone. One-line messages centre on the close control; wrapped ones start at the top.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-s); inline-size: var(--lr-size-20rem);">
      <lr-toast-item with-icon duration="60000">${infoGlyph}Saved.</lr-toast-item>
      <lr-toast-item with-icon duration="60000" variant="success">${infoGlyph}Upload complete.</lr-toast-item>
      <lr-toast-item with-icon duration="60000" style="--lr-toast-icon-color: var(--lr-color-brand);">${infoGlyph}Icon-only colour hook.</lr-toast-item>
      <lr-toast-item with-icon duration="0" variant="warning">
        ${infoGlyph}A longer message wraps onto several lines and stays aligned to the top, beside the close control.
      </lr-toast-item>
    </div>
  `,
};

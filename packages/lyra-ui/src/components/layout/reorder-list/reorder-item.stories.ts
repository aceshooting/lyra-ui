import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './reorder-item.js';
import './reorder-list.js';

const meta: Meta = { title: 'Primitives/Reorder Item', component: 'lr-reorder-item', tags: ['autodocs'] };
export default meta;

export const Default: StoryObj = {
  render: () => html`<div role="list"><lr-reorder-item value="a">Row content</lr-reorder-item></div>`,
};

export const ThemedMoveButtons: StoryObj = {
  name: 'Themed move-button states (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          'Set the hover and pressed properties on the row or any ancestor. Each property applies only to the move buttons, preserving the row content and disabled-button treatment.',
      },
    },
  },
  render: () => html`
    <div
      role="list"
      style="
        --lr-reorder-item-move-button-hover-bg: var(--lr-color-success-quiet);
        --lr-reorder-item-move-button-hover-color: var(--lr-color-success);
        --lr-reorder-item-move-button-active-bg: var(--lr-color-success);
        --lr-reorder-item-move-button-active-color: var(--lr-color-on-success);
      "
    >
      <lr-reorder-item value="themed">Theme the movement controls independently</lr-reorder-item>
    </div>
  `,
};

export const Boundaries: StoryObj = {
  render: () => html`
    <lr-reorder-list style="display:flex; flex-direction:column; gap:var(--lr-space-2xs);">
      <lr-reorder-item value="a">First row (move-up disabled)</lr-reorder-item>
      <lr-reorder-item value="b">Middle row</lr-reorder-item>
      <lr-reorder-item value="c">Last row (move-down disabled)</lr-reorder-item>
      <lr-reorder-item value="d" disabled>Disabled row</lr-reorder-item>
    </lr-reorder-list>
  `,
};

export const NarrowLongContent: StoryObj = {
  name: 'Narrow long content LTR/RTL (320px)',
  parameters: {
    docs: {
      description: {
        story:
          'Each exact 320px list allocation retains both 40px movement controls while an unbroken localized row label wraps within the remaining logical inline space.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-m);">
      ${(['ltr', 'rtl'] as const).map(
        (direction) => html`
          <div dir=${direction} role="list" style="inline-size: 320px; max-inline-size: 100%;">
            <lr-reorder-item value=${direction}
              >${direction === 'rtl'
                ? 'عنصرترتيبمحليطويلجداًبدونأيفرصةللفصلالتلقائي'
                : 'InternationalizedReorderItemLabelWithoutAnyNaturalBreakOpportunity'}</lr-reorder-item
            >
          </div>
        `,
      )}
    </div>
  `,
};

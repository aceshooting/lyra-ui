import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './reorder-item.js';

const meta: Meta = { title: 'Primitives/Reorder Item', component: 'lr-reorder-item', tags: ['autodocs'] };
export default meta;

export const Default: StoryObj = {
  render: () => html`<lr-reorder-item value="a">Row content</lr-reorder-item>`,
};

export const Boundaries: StoryObj = {
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:0.125rem;">
      <lr-reorder-item value="a" .atStart=${true}>First row (move-up disabled)</lr-reorder-item>
      <lr-reorder-item value="b">Middle row</lr-reorder-item>
      <lr-reorder-item value="c" .atEnd=${true}>Last row (move-down disabled)</lr-reorder-item>
      <lr-reorder-item value="d" disabled>Disabled row</lr-reorder-item>
    </div>
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

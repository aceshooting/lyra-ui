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

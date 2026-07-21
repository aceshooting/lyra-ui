import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './reorder-list.js';
import './reorder-item.js';

const meta: Meta = {
  title: 'Primitives/Reorder List',
  component: 'lr-reorder-list',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A generic flat-list reorder primitive: per-row move-up/move-down buttons, plus Ctrl/Cmd+ArrowUp/ArrowDown from focus inside a row. Emits `lr-reorder` with the full new order so the host can persist it without hand-rolled splice/resort logic.',
      },
    },
  },
};
export default meta;

export const Default: StoryObj = {
  render: () => html`
    <lr-reorder-list
      label="Form fields"
      style="max-width: 20rem;"
      @lr-reorder=${(e: CustomEvent) => console.log('lr-reorder', e.detail)}
    >
      <lr-reorder-item value="name">Name</lr-reorder-item>
      <lr-reorder-item value="email">Email</lr-reorder-item>
      <lr-reorder-item value="phone">Phone</lr-reorder-item>
      <lr-reorder-item value="address">Address</lr-reorder-item>
    </lr-reorder-list>
  `,
};

export const WithADisabledRow: StoryObj = {
  render: () => html`
    <lr-reorder-list label="Form fields" style="max-width: 20rem;">
      <lr-reorder-item value="name">Name</lr-reorder-item>
      <lr-reorder-item value="email" disabled>Email (locked)</lr-reorder-item>
      <lr-reorder-item value="phone">Phone</lr-reorder-item>
    </lr-reorder-list>
  `,
};

export const ListDisabled: StoryObj = {
  render: () => html`
    <lr-reorder-list label="Form fields" disabled style="max-width: 20rem;">
      <lr-reorder-item value="name">Name</lr-reorder-item>
      <lr-reorder-item value="email">Email</lr-reorder-item>
    </lr-reorder-list>
  `,
};

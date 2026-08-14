import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './menu-label.js';
import './menu.js';
import './menu-item.js';

const meta: Meta = {
  title: 'Layout/Menu label',
  component: 'lr-menu-label',
  tags: ['autodocs'],
};
export default meta;

export const Default: StoryObj = {
  render: () => html`
    <lr-menu style="max-inline-size: 16rem;">
      <lr-menu-label>Recently used</lr-menu-label>
      <lr-menu-item value="open">Open…</lr-menu-item>
      <lr-menu-item value="duplicate">Duplicate</lr-menu-item>
      <lr-menu-label>Danger zone</lr-menu-label>
      <lr-menu-item value="delete">Delete</lr-menu-item>
    </lr-menu>
  `,
};

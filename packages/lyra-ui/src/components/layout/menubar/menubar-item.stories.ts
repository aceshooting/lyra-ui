import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './menubar.js';

const meta: Meta = { title: 'Layout/Menubar item', component: 'lr-menubar-item', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = {
  render: () => html`<lr-menubar label="Application"><lr-menubar-item>File<lr-menu slot="menu"><lr-menu-item>New</lr-menu-item><lr-menu-item>Open</lr-menu-item></lr-menu></lr-menubar-item><lr-menubar-item>Help</lr-menubar-item></lr-menubar>`,
};

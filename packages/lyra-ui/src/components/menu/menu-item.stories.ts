import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './menu-item.js';

const meta: Meta = { title: 'Navigation/Menu item', component: 'lr-menu-item', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-menu-item value="save">Save</lr-menu-item>` };

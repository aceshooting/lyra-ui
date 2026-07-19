import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './divider.js';
const meta: Meta = { title: 'Layout/Divider', component: 'lr-divider', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<p>Above</p><lr-divider></lr-divider><p>Below</p>` };

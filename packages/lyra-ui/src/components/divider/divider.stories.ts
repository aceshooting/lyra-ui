import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './divider.js';
const meta: Meta = { title: 'Layout/Divider', component: 'lyra-divider', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<p>Above</p><lyra-divider></lyra-divider><p>Below</p>` };

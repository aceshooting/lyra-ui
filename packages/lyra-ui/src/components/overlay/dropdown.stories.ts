import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './dropdown.js';

const meta: Meta = { title: 'Overlay/Dropdown', component: 'lr-dropdown', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-dropdown><button slot="trigger">Open menu</button><div>Menu content</div></lr-dropdown>` };

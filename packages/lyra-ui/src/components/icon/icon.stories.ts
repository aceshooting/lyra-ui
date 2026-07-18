import type { Meta, StoryObj } from '@storybook/web-components-vite'; import { html } from 'lit'; import './icon.js';
const meta: Meta = { title: 'Icon', component: 'lr-icon', tags: ['autodocs'] }; export default meta; type Story = StoryObj;
export const CommonIcons: Story = { render: () => html`<div style="display:flex;gap:1rem;font-size:1.5rem"><lr-icon name="search"></lr-icon><lr-icon name="calendar"></lr-icon><lr-icon name="check"></lr-icon><lr-icon name="close"></lr-icon></div>` };

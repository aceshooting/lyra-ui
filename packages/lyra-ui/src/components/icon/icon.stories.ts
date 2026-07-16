import type { Meta, StoryObj } from '@storybook/web-components-vite'; import { html } from 'lit'; import './icon.js';
const meta: Meta = { title: 'Icon', component: 'lyra-icon', tags: ['autodocs'] }; export default meta; type Story = StoryObj;
export const CommonIcons: Story = { render: () => html`<div style="display:flex;gap:1rem;font-size:1.5rem"><lyra-icon name="search"></lyra-icon><lyra-icon name="calendar"></lyra-icon><lyra-icon name="check"></lyra-icon><lyra-icon name="close"></lyra-icon></div>` };

import type { Meta, StoryObj } from '@storybook/web-components-vite'; import { html } from 'lit'; import './icon-button.js';
const meta: Meta = { title: 'Icon Button', component: 'lyra-icon-button', tags: ['autodocs'] }; export default meta; type Story = StoryObj;
export const Actions: Story = { render: () => html`<div style="display:flex;gap:0.5rem"><lyra-icon-button icon="search" aria-label="Search"></lyra-icon-button><lyra-icon-button icon="close" aria-label="Close"></lyra-icon-button></div>` };

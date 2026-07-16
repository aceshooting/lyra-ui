import type { Meta, StoryObj } from '@storybook/web-components-vite'; import { html } from 'lit'; import './data-grid.js';
const meta: Meta = { title: 'Data Grid', component: 'lyra-data-grid', tags: ['autodocs'] }; export default meta; type Story = StoryObj;
export const Default: Story = { render: () => html`<lyra-data-grid aria-label="People" .columns=${[{ key: 'name', label: 'Name', sortable: true }, { key: 'role', label: 'Role' }]} .rows=${[{ name: 'Ada Lovelace', role: 'Mathematician' }, { name: 'Grace Hopper', role: 'Engineer' }]}></lyra-data-grid>` };

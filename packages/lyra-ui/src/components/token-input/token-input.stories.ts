import type { Meta, StoryObj } from '@storybook/web-components-vite'; import { html } from 'lit'; import './token-input.js';
const meta: Meta = { title: 'Token Input', component: 'lyra-token-input', tags: ['autodocs'] }; export default meta; type Story = StoryObj;
export const Default: Story = { render: () => html`<lyra-token-input label="Recipients" placeholder="Add a recipient…" .value=${['Ada', 'Grace']}></lyra-token-input>` };

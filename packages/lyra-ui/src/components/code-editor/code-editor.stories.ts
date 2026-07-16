import type { Meta, StoryObj } from '@storybook/web-components-vite'; import { html } from 'lit'; import './code-editor.js';
const meta: Meta = { title: 'Code Editor', component: 'lyra-code-editor', tags: ['autodocs'] }; export default meta; type Story = StoryObj;
export const Json: Story = { render: () => html`<lyra-code-editor label="Configuration" language="json" .value=${'{\n  "enabled": true\n}'}></lyra-code-editor>` };

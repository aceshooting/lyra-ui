import type { Meta, StoryObj } from '@storybook/web-components-vite'; import { html } from 'lit'; import './code-editor.js';
const meta: Meta = { title: 'Code Editor', component: 'lr-code-editor', tags: ['autodocs'] }; export default meta; type Story = StoryObj;
export const Json: Story = { render: () => html`<lr-code-editor label="Configuration" language="json" .value=${'{\n  "enabled": true\n}'}></lr-code-editor>` };

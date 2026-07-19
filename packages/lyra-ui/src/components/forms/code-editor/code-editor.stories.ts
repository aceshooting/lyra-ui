import type { Meta, StoryObj } from '@storybook/web-components-vite'; import { html } from 'lit'; import './code-editor.js';
const meta: Meta = { title: 'Code Editor', component: 'lr-code-editor', tags: ['autodocs'] }; export default meta; type Story = StoryObj;
export const Json: Story = { render: () => html`<lr-code-editor label="Configuration" language="json" .value=${'{\n  "enabled": true\n}'}></lr-code-editor>` };
// Tab width precedence: an inherited `--lr-code-editor-tab-size` drives both editors' tab stops and
// their Tab key, except where `tab-size` is set explicitly -- the property still wins.
export const TabWidth: Story = { render: () => html`<div style="display: grid; gap: 1rem; --lr-code-editor-tab-size: 8;"><lr-code-editor label="Token-driven (8)" language="go" .value=${'func main() {\n\tprintln("hi")\n}'}></lr-code-editor><lr-code-editor label="Property wins (2)" language="go" tab-size="2" .value=${'func main() {\n\tprintln("hi")\n}'}></lr-code-editor></div>` };

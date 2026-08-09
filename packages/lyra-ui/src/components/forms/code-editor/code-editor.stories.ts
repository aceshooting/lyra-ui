import type { Meta, StoryObj } from '@storybook/web-components-vite'; import { html } from 'lit'; import './code-editor.js';
const meta: Meta = { title: 'Code Editor', component: 'lr-code-editor', tags: ['autodocs'] }; export default meta; type Story = StoryObj;
export const Json: Story = { render: () => html`<lr-code-editor label="Configuration" language="json" .value=${'{\n  "enabled": true\n}'}></lr-code-editor>` };
// Tab width precedence: an inherited `--lr-code-editor-tab-size` drives both editors' tab stops and
// their Tab key, except where `tab-size` is set explicitly -- the property still wins.
export const TabWidth: Story = { render: () => html`<div style="display: grid; gap: 1rem; --lr-code-editor-tab-size: 8;"><lr-code-editor label="Token-driven (8)" language="go" .value=${'func main() {\n\tprintln("hi")\n}'}></lr-code-editor><lr-code-editor label="Property wins (2)" language="go" tab-size="2" .value=${'func main() {\n\tprintln("hi")\n}'}></lr-code-editor></div>` };

export const ScopedStateTheme: Story = {
  name: 'Scoped hover / invalid border',
  parameters: { docs: { description: { story: 'Hover the editor, then submit it empty, to exercise its independent frame-state hooks.' } } },
  render: () => html`
    <form>
      <lr-code-editor
        label="Required configuration"
        required
        style="--lr-code-editor-hover-border: var(--lr-color-success); --lr-code-editor-invalid-border: var(--lr-color-warning)"
      ></lr-code-editor>
      <button type="submit">Validate</button>
    </form>
  `,
};

export const NarrowLongContent: Story = {
  name: 'Narrow RTL long content (320px)',
  parameters: {
    docs: {
      description: {
        story:
          'Long translated chrome wraps at the host boundary while unbroken source remains reachable through the editor-owned scrollport.',
      },
    },
  },
  render: () => html`
    <div dir="rtl" style="inline-size:320px;max-inline-size:100%;overflow:hidden">
      <lr-code-editor
        label="${'LocalizedUnbrokenEditorLabel'.repeat(12)}"
        hint="${'LocalizedUnbrokenEditorHint'.repeat(12)}"
        resize="none"
        .value=${`const payload = '${'unbrokenSourceToken'.repeat(64)}';`}
        style="max-inline-size:100%"
      ></lr-code-editor>
    </div>
  `,
};

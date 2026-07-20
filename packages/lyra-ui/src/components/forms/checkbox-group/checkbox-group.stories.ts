import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './checkbox-group.js'; import '../checkbox/checkbox.js';
const meta: Meta = { title: 'Checkbox Group', component: 'lr-checkbox-group', tags: ['autodocs'] }; export default meta; type Story = StoryObj;
export const Default: Story = { render: () => html`<lr-checkbox-group label="Topics" name="topics"><lr-checkbox value="news">News</lr-checkbox><lr-checkbox value="product">Product updates</lr-checkbox></lr-checkbox-group>` };

export const ValueIsReadOnly: Story = {
  name: 'value reflects the children',
  parameters: {
    docs: {
      description: {
        story:
          '`value` is a read-out of child state, never an input. `sync()` recomputes it from the `<lr-checkbox>` children on every toggle, slot change, blur and form reset — and `connectedCallback()` syncs before the first render — so assigning it (even from a template binding) is discarded and logs a console warning. Preselect by setting `checked` on the children instead, and give each child a distinct `value` so the submitted `FormData` can tell them apart.',
      },
    },
  },
  render: () => html`
    <lr-checkbox-group
      label="Topics"
      name="topics"
      @lr-change=${(event: CustomEvent<{ value: string[] }>) => {
        const output = document.getElementById('checkbox-group-value');
        if (output) output.textContent = JSON.stringify(event.detail.value);
      }}
    >
      <lr-checkbox value="news" checked>News</lr-checkbox>
      <lr-checkbox value="product">Product updates</lr-checkbox>
      <lr-checkbox value="research">Research</lr-checkbox>
    </lr-checkbox-group>
    <p id="checkbox-group-value" style="font-family: monospace;" aria-live="polite">["news"]</p>
  `,
};

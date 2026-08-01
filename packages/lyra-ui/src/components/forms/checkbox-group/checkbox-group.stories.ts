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

export const Sizes: StoryObj = {
  name: 'Size ladder',
  parameters: {
    docs: {
      description: {
        story:
          '`size` is the library\'s shared ladder, so a `size` set here matches an `<lr-input>`, `<lr-select>` or `<lr-button>` of the same `size` in the same row. Both spellings of every tier are accepted — `s`/`m`/`l` and Web Awesome\'s `small`/`medium`/`large` — so a migration is a tag rename with no attribute rewrite.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-m); justify-items: start;">
      <lr-checkbox-group size="s" name="pick-s" label="Size s"><lr-checkbox value="a" size="s">Alpha</lr-checkbox><lr-checkbox value="b" size="s">Bravo</lr-checkbox></lr-checkbox-group>
      <lr-checkbox-group size="m" name="pick-m" label="Size m"><lr-checkbox value="a" size="m">Alpha</lr-checkbox><lr-checkbox value="b" size="m">Bravo</lr-checkbox></lr-checkbox-group>
      <lr-checkbox-group size="l" name="pick-l" label="Size l"><lr-checkbox value="a" size="l">Alpha</lr-checkbox><lr-checkbox value="b" size="l">Bravo</lr-checkbox></lr-checkbox-group>
    </div>
  `,
};

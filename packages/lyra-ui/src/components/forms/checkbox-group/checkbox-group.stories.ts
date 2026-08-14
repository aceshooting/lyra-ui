import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './checkbox-group.js'; import '../checkbox/checkbox.js';
const meta: Meta = { title: 'Checkbox Group', component: 'lr-checkbox-group', tags: ['autodocs'] }; export default meta; type Story = StoryObj;
export const Default: Story = { render: () => html`<lr-checkbox-group label="Topics" name="topics"><lr-checkbox value="news">News</lr-checkbox><lr-checkbox value="product">Product updates</lr-checkbox></lr-checkbox-group>` };

export const NativeMethods: Story = {
  name: 'Native method semantics',
  parameters: {
    docs: {
      description: {
        story:
          '`focus()` and `blur()` forward to the first enabled owned checkbox. `click()` has native activation semantics and toggles that checkbox; it is not a focus shorthand. `reportValidity()` validates the aggregate and focuses the first enabled checkbox when the required group is empty.',
      },
    },
  },
  render: () => {
    const invoke = (event: Event, method: 'focus' | 'blur' | 'click' | 'reportValidity') => {
      const demo = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-native-methods]')!;
      const group = demo.querySelector('lr-checkbox-group')!;
      const status = demo.querySelector<HTMLElement>('[role="status"]')!;
      if (method === 'reportValidity') {
        status.textContent = `reportValidity() returned ${group.reportValidity()}`;
      } else {
        group[method]();
        status.textContent = `${method}() called; value is ${JSON.stringify(group.value)}`;
      }
    };
    return html`
      <div data-native-methods style="display:grid;gap:var(--lr-space-m);justify-items:start">
        <lr-checkbox-group label="Required topics" name="native-topics" required>
          <lr-checkbox value="unavailable" disabled>Unavailable first option</lr-checkbox>
          <lr-checkbox value="news">News</lr-checkbox>
          <lr-checkbox value="product">Product updates</lr-checkbox>
        </lr-checkbox-group>
        <div style="display:flex;gap:var(--lr-space-s);flex-wrap:wrap">
          ${(['focus', 'blur', 'click', 'reportValidity'] as const).map(
            (method) => html`<button type="button" @click=${(event: Event) => invoke(event, method)}>${method}()</button>`,
          )}
        </div>
        <p role="status">Choose a method.</p>
      </div>
    `;
  },
};

export const ValueIsReadOnly: Story = {
  name: 'value reflects the children',
  parameters: {
    docs: {
      description: {
        story:
          '`value` is a defensive readonly snapshot of child state. Direct child checked/value writes update it, FormData and validity in the same task without emitting user events. Preselect by setting `checked` on the children, and give each child a distinct `value` so submitted FormData can tell them apart.',
      },
    },
  },
  render: () => html`
    <lr-checkbox-group
      label="Topics"
      name="topics"
      @lr-change=${(event: CustomEvent<{ value: readonly string[] }>) => {
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

export const Orientations: Story = {
  render: () => html`
    <div style="display:grid; gap:var(--lr-space-l);">
      <lr-checkbox-group label="Vertical" name="vertical-topics">
        <lr-checkbox value="news">News</lr-checkbox>
        <lr-checkbox value="product">Product updates</lr-checkbox>
      </lr-checkbox-group>
      <lr-checkbox-group
        label="Horizontal"
        name="horizontal-topics"
        orientation="horizontal"
        style="--gap:var(--lr-space-l);"
      >
        <lr-checkbox value="news">News</lr-checkbox>
        <lr-checkbox value="product">Product updates</lr-checkbox>
      </lr-checkbox-group>
    </div>
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
      <lr-checkbox-group size="s" name="pick-s" label="Size s"><lr-checkbox value="a">Alpha</lr-checkbox><lr-checkbox value="b">Bravo</lr-checkbox></lr-checkbox-group>
      <lr-checkbox-group size="m" name="pick-m" label="Size m"><lr-checkbox value="a">Alpha</lr-checkbox><lr-checkbox value="b">Bravo</lr-checkbox></lr-checkbox-group>
      <lr-checkbox-group size="l" name="pick-l" label="Size l"><lr-checkbox value="a">Alpha</lr-checkbox><lr-checkbox value="b">Bravo</lr-checkbox></lr-checkbox-group>
    </div>
  `,
};

export const OptionalSizeAuthority: Story = {
  name: 'Optional size authority',
  parameters: {
    docs: {
      description: {
        story:
          'An unset group preserves each authored child tier. Setting size temporarily projects one tier; removing it or moving a child out restores that child’s latest authored size.',
      },
    },
  },
  render: () => html`
    <lr-checkbox-group label="Authored child sizes" name="mixed-size">
      <lr-checkbox value="compact" size="s">Compact</lr-checkbox>
      <lr-checkbox value="default">Default</lr-checkbox>
      <lr-checkbox value="large" size="l">Large</lr-checkbox>
    </lr-checkbox-group>
  `,
};

export const ScopedInvalidTheme: Story = {
  name: 'Scoped invalid border',
  parameters: { docs: { description: { story: 'Submit with no selection to reveal the group-only invalid-border hook.' } } },
  render: () => html`
    <form>
      <lr-checkbox-group
        label="Required topics"
        name="topics"
        required
        style="--lr-checkbox-group-invalid-border: var(--lr-color-warning)"
      >
        <lr-checkbox value="news">News</lr-checkbox>
        <lr-checkbox value="product">Product updates</lr-checkbox>
      </lr-checkbox-group>
      <button type="submit">Validate</button>
    </form>
  `,
};

export const NarrowLongContent: Story = {
  name: 'Narrow RTL long options (320px)',
  parameters: {
    docs: {
      description: {
        story:
          'Long translated group chrome and unbroken horizontal option labels wrap inside an exact 320px RTL allocation.',
      },
    },
  },
  render: () => html`
    <div dir="rtl" style="inline-size:320px;max-inline-size:100%;overflow:hidden">
      <lr-checkbox-group
        orientation="horizontal"
        label="${'LocalizedUnbrokenGroupLabel'.repeat(12)}"
        hint="${'LocalizedUnbrokenGroupHint'.repeat(12)}"
        style="max-inline-size:100%"
      >
        <lr-checkbox value="alpha">${'LocalizedUnbrokenOption'.repeat(12)}</lr-checkbox>
        <lr-checkbox value="beta">${'LocalizedUnbrokenOption'.repeat(12)}</lr-checkbox>
      </lr-checkbox-group>
    </div>
  `,
};

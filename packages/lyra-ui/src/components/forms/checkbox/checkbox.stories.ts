import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './checkbox.js';
import type { LyraCheckbox } from './checkbox.js';

const meta: Meta = {
  title: 'Checkbox',
  component: 'lr-checkbox',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A boolean form control — the checkbox-semantics counterpart to `<lr-switch>` (`role="checkbox"` + a tri-state `aria-checked`, including `"mixed"` for the visual-only `indeterminate` state). Form-associated via `ElementInternals`; participates in native `<form>` submission, validation, and reset.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-checkbox>Subscribe to updates</lr-checkbox>`,
};

export const Checked: Story = {
  render: () => html`<lr-checkbox checked>Subscribe to updates</lr-checkbox>`,
};

export const Indeterminate: Story = {
  render: () => html`<lr-checkbox indeterminate>Select all</lr-checkbox>`,
};

export const Disabled: Story = {
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:0.75rem;">
      <lr-checkbox disabled>Unchecked, disabled</lr-checkbox>
      <lr-checkbox disabled checked>Checked, disabled</lr-checkbox>
      <lr-checkbox disabled indeterminate>Indeterminate, disabled</lr-checkbox>
    </div>
  `,
};

export const NoLabelSlot: Story = {
  name: 'No label slot (aria-label only)',
  render: () => html`<lr-checkbox aria-label="Subscribe to updates"></lr-checkbox>`,
};

export const Required: Story = {
  render: () => html`
    <form
      @submit=${(e: Event) => {
        e.preventDefault();
        alert('Form submitted');
      }}
      style="display:flex; flex-direction:column; gap:0.75rem; align-items:flex-start;"
    >
      <lr-checkbox name="terms" required>I agree to the terms</lr-checkbox>
      <button type="submit">Submit</button>
    </form>
  `,
};

export const IndeterminateParent: Story = {
  name: 'Indeterminate parent/children group',
  render: () => {
    const onParentChange = (e: Event) => {
      const parent = e.currentTarget as LyraCheckbox;
      const group = parent.closest('[data-group]') as HTMLElement;
      const children = [...group.querySelectorAll<LyraCheckbox>('.child')];
      children.forEach((c) => (c.checked = parent.checked));
    };
    const onChildChange = (e: Event) => {
      const child = e.currentTarget as LyraCheckbox;
      const group = child.closest('[data-group]') as HTMLElement;
      const parent = group.querySelector('#parent') as LyraCheckbox;
      const children = [...group.querySelectorAll<LyraCheckbox>('.child')];
      const checkedCount = children.filter((c) => c.checked).length;
      parent.checked = checkedCount === children.length;
      parent.indeterminate = checkedCount > 0 && checkedCount < children.length;
    };
    return html`
      <div data-group style="display:flex; flex-direction:column; gap:0.5rem;">
        <lr-checkbox id="parent" @lr-change=${onParentChange}>Select all</lr-checkbox>
        <div style="display:flex; flex-direction:column; gap:0.5rem; padding-inline-start:1.5rem;">
          <lr-checkbox class="child" @lr-change=${onChildChange}>Option A</lr-checkbox>
          <lr-checkbox class="child" @lr-change=${onChildChange}>Option B</lr-checkbox>
          <lr-checkbox class="child" @lr-change=${onChildChange}>Option C</lr-checkbox>
        </div>
      </div>
    `;
  },
};

export const Interactive: Story = {
  render: () => html`
    <lr-checkbox
      @lr-change=${(e: CustomEvent<{ checked: boolean }>) => {
        const out = document.getElementById('checkbox-log');
        if (out) out.textContent = `checked: ${e.detail.checked}`;
      }}
      >Send me email updates</lr-checkbox
    >
    <p id="checkbox-log" style="font-family: monospace; margin-top: 0.5rem;">checked: false</p>
  `,
};

export const NativeEventContract: Story = {
  name: 'Native event and focus contract',
  render: () => {
    const record = (event: Event) => {
      const output = document.getElementById('checkbox-native-events');
      if (output) output.textContent = `${output.textContent ?? ''}${event.type} `;
    };
    return html`
      <lr-checkbox
        @input=${record}
        @change=${record}
        @lr-change=${record}
        >Toggle with a click or the Space key</lr-checkbox
      >
      <p id="checkbox-native-events" aria-live="polite">Events: </p>
    `;
  },
};

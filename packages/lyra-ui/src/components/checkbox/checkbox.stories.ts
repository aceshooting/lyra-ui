import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './checkbox.js';
import type { LyraCheckbox } from './checkbox.js';

const meta: Meta = {
  title: 'Checkbox',
  component: 'lyra-checkbox',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A boolean form control — the checkbox-semantics counterpart to `<lyra-switch>` (`role="checkbox"` + a tri-state `aria-checked`, including `"mixed"` for the visual-only `indeterminate` state). Form-associated via `ElementInternals`; participates in native `<form>` submission, validation, and reset.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-checkbox>Subscribe to updates</lyra-checkbox>`,
};

export const Checked: Story = {
  render: () => html`<lyra-checkbox checked>Subscribe to updates</lyra-checkbox>`,
};

export const Indeterminate: Story = {
  render: () => html`<lyra-checkbox indeterminate>Select all</lyra-checkbox>`,
};

export const Disabled: Story = {
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:0.75rem;">
      <lyra-checkbox disabled>Unchecked, disabled</lyra-checkbox>
      <lyra-checkbox disabled checked>Checked, disabled</lyra-checkbox>
      <lyra-checkbox disabled indeterminate>Indeterminate, disabled</lyra-checkbox>
    </div>
  `,
};

export const NoLabelSlot: Story = {
  name: 'No label slot (aria-label only)',
  render: () => html`<lyra-checkbox aria-label="Subscribe to updates"></lyra-checkbox>`,
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
      <lyra-checkbox name="terms" required>I agree to the terms</lyra-checkbox>
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
        <lyra-checkbox id="parent" @lyra-change=${onParentChange}>Select all</lyra-checkbox>
        <div style="display:flex; flex-direction:column; gap:0.5rem; padding-inline-start:1.5rem;">
          <lyra-checkbox class="child" @lyra-change=${onChildChange}>Option A</lyra-checkbox>
          <lyra-checkbox class="child" @lyra-change=${onChildChange}>Option B</lyra-checkbox>
          <lyra-checkbox class="child" @lyra-change=${onChildChange}>Option C</lyra-checkbox>
        </div>
      </div>
    `;
  },
};

export const Interactive: Story = {
  render: () => html`
    <lyra-checkbox
      @lyra-change=${(e: CustomEvent<{ checked: boolean }>) => {
        const out = document.getElementById('checkbox-log');
        if (out) out.textContent = `checked: ${e.detail.checked}`;
      }}
      >Send me email updates</lyra-checkbox
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
      <lyra-checkbox
        @input=${record}
        @change=${record}
        @lyra-change=${record}
        >Toggle with a click or the Space key</lyra-checkbox
      >
      <p id="checkbox-native-events" aria-live="polite">Events: </p>
    `;
  },
};

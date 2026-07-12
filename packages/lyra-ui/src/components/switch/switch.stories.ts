import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './switch.js';

const meta: Meta = {
  title: 'Switch',
  component: 'lyra-switch',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A boolean toggle-switch form control — the switch-semantics counterpart to a checkbox (`role="switch"` + `aria-checked` instead of `role="checkbox"`, no indeterminate state). Form-associated via `ElementInternals`; participates in native `<form>` submission, validation, and reset.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-switch>Enable notifications</lyra-switch>`,
};

export const Checked: Story = {
  render: () => html`<lyra-switch checked>Enable notifications</lyra-switch>`,
};

export const Disabled: Story = {
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:0.75rem;">
      <lyra-switch disabled>Off, disabled</lyra-switch>
      <lyra-switch disabled checked>On, disabled</lyra-switch>
    </div>
  `,
};

export const NoLabelSlot: Story = {
  name: 'No label slot (aria-label only)',
  render: () => html`<lyra-switch aria-label="Enable notifications"></lyra-switch>`,
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
      <lyra-switch name="terms" required>I agree to the terms</lyra-switch>
      <button type="submit">Submit</button>
    </form>
  `,
};

export const Interactive: Story = {
  render: () => html`
    <lyra-switch
      @lyra-change=${(e: CustomEvent<{ checked: boolean }>) => {
        const out = document.getElementById('switch-log');
        if (out) out.textContent = `checked: ${e.detail.checked}`;
      }}
      >Dark mode</lyra-switch
    >
    <p id="switch-log" style="font-family: monospace; margin-top: 0.5rem;">checked: false</p>
  `,
};

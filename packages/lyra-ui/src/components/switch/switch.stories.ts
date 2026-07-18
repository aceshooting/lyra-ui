import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './switch.js';

const meta: Meta = {
  title: 'Switch',
  component: 'lr-switch',
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
  render: () => html`<lr-switch>Enable notifications</lr-switch>`,
};

export const Checked: Story = {
  render: () => html`<lr-switch checked>Enable notifications</lr-switch>`,
};

export const Disabled: Story = {
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:0.75rem;">
      <lr-switch disabled>Off, disabled</lr-switch>
      <lr-switch disabled checked>On, disabled</lr-switch>
    </div>
  `,
};

export const NoLabelSlot: Story = {
  name: 'No label slot (aria-label only)',
  render: () => html`<lr-switch aria-label="Enable notifications"></lr-switch>`,
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
      <lr-switch name="terms" required>I agree to the terms</lr-switch>
      <button type="submit">Submit</button>
    </form>
  `,
};

export const Interactive: Story = {
  render: () => html`
    <lr-switch
      @lr-change=${(e: CustomEvent<{ checked: boolean }>) => {
        const out = document.getElementById('switch-log');
        if (out) out.textContent = `checked: ${e.detail.checked}`;
      }}
      >Dark mode</lr-switch
    >
    <p id="switch-log" style="font-family: monospace; margin-top: 0.5rem;">checked: false</p>
  `,
};

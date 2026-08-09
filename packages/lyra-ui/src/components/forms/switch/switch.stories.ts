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

export const IndependentStateTheme: Story = {
  name: 'Independent checked and pointer theme',
  render: () => html`
    <lr-switch
      checked
      style="--lr-switch-gap: var(--lr-space-l); --lr-switch-checked-track-fill: var(--lr-color-success); --lr-switch-thumb-fill: var(--lr-color-on-success); --lr-switch-track-hover-fill: var(--lr-color-warning); --lr-switch-track-active-fill: var(--lr-color-danger);"
    >Hover and press me</lr-switch>
  `,
};

export const SupportingTextAliases: Story = {
  name: 'WA hint and Shoelace help text',
  render: () => html`
    <div style="display:grid; gap:var(--lr-space-m);">
      <lr-switch hint="Applies to this browser">Desktop notifications</lr-switch>
      <lr-switch default-checked>
        Weekly digest
        <span slot="help-text">Shoelace-compatible supporting-text slot</span>
      </lr-switch>
    </div>
  `,
};

export const Disabled: Story = {
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:0.75rem;">
      <lr-switch disabled>Off, disabled</lr-switch>
      <lr-switch disabled checked>On, disabled</lr-switch>
    </div>
  `,
};

export const NarrowLongContent: Story = {
  name: 'Narrow long content LTR/RTL (320px)',
  render: () => {
    const label = 'InternationalizedSwitchLabelWithoutAnyNaturalBreakOpportunity';
    return html`
      <div style="display: grid; gap: var(--lr-space-m)">
        ${(['ltr', 'rtl'] as const).map(
          (direction) => html`
            <div dir=${direction} style="inline-size: 320px; max-inline-size: 100%">
              <lr-switch hint=${label}>${label}</lr-switch>
            </div>
          `,
        )}
      </div>
    `;
  },
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

export const NativeFormEvents: Story = {
  name: 'Native input/change events',
  parameters: {
    docs: {
      description: {
        story:
          'A user toggle fires the native `input` and `change` pair before the `lr-change` alias, so a form library or a `<form>`-level listener bound to the native names sees the switch the same way it sees a native checkbox.',
      },
    },
  },
  render: () => html`
    <form
      @input=${() => {
        const out = document.getElementById('switch-native-log');
        if (out) out.textContent = `${out.textContent} input`;
      }}
      @change=${() => {
        const out = document.getElementById('switch-native-log');
        if (out) out.textContent = `${out.textContent} change`;
      }}
      style="display:flex; flex-direction:column; gap:0.75rem; align-items:flex-start;"
    >
      <lr-switch name="notifications">Enable notifications</lr-switch>
    </form>
    <p id="switch-native-log" style="font-family: monospace; margin-top: 0.5rem;">form saw:</p>
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
      <lr-switch size="2xs">Size 2xs</lr-switch>
      <lr-switch size="xs">Size xs</lr-switch>
      <lr-switch size="s">Size s</lr-switch>
      <lr-switch size="m">Size m</lr-switch>
      <lr-switch size="l">Size l</lr-switch>
      <lr-switch size="xl">Size xl</lr-switch>
    </div>
  `,
};

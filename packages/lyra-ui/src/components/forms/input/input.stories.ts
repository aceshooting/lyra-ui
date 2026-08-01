import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './input.js';
import '../button/button.js';

const meta: Meta = {
  title: 'Input',
  component: 'lr-input',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'A single-line plain-text input primitive -- the `lr-*` equivalent of a plain `wa-input`.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-input label="Name" placeholder="Ada Lovelace"></lr-input>`,
};

/** The show/hide-password button is opt-in: add `password-toggle` to render it. */
export const Password: Story = {
  render: () => html`<lr-input type="password" password-toggle label="Password"></lr-input>`,
};

export const Email: Story = {
  render: () => html`<lr-input type="email" label="Email" required></lr-input>`,
};

export const NumericType: Story = {
  name: 'type="number"',
  render: () => html`<lr-input type="number" label="Quantity" min="1" max="10" step="1" value="1"></lr-input>`,
};

export const ValidationMessage: Story = {
  render: () => html`<lr-input type="email" label="Email" hint="We'll never share it." required></lr-input>`,
};

export const CompactGridRow: Story = {
  name: 'Compact grid row (aria-label only)',
  render: () => html`<lr-input aria-label="Search" placeholder="Search..."></lr-input>`,
};

export const ClearableWithAdornments: Story = {
  render: () => html`
    <lr-input type="search" clearable value="workflow" aria-label="Search workflows">
      <span slot="start" aria-hidden="true">⌕</span>
      <kbd slot="end">⌘K</kbd>
    </lr-input>
  `,
};

/**
 * `size` walks the library's one form-control ladder. Every tier matches both its canonical step
 * and Web Awesome's/Shoelace's name for it, so migrating markup that says `size="small"` renders
 * exactly what `size="s"` renders. The same ladder backs `<lr-button>`, `<lr-select>` and
 * `<lr-textarea>`, so same-tier controls are the same height in a toolbar row.
 */
export const Sizes: Story = {
  render: () => html`
    <div style="display: grid; gap: 0.75rem; max-inline-size: 24rem">
      ${['2xs', 'xs', 's', 'm', 'l', 'xl'].map(
        (size) => html`<lr-input size=${size} label=${size} placeholder="Name"></lr-input>`,
      )}
    </div>
  `,
};

/** The `small`/`medium`/`large` spellings render exactly what `s`/`m`/`l` render. */
export const SizeSpellings: Story = {
  name: 'Both size spellings',
  render: () => html`
    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
      <lr-input size="s" aria-label="s" placeholder='size="s"'></lr-input>
      <lr-input size="small" aria-label="small" placeholder='size="small"'></lr-input>
      <lr-button size="s">size="s"</lr-button>
      <lr-button size="small">size="small"</lr-button>
    </div>
  `,
};

/** `appearance` swaps the control row's fill and border; `pill` rounds it to a full pill. */
export const Appearance: Story = {
  render: () => html`
    <div style="display: grid; gap: 0.75rem; max-inline-size: 20rem">
      <lr-input appearance="filled-outlined" label="filled-outlined (default)"></lr-input>
      <lr-input appearance="outlined" label="outlined"></lr-input>
      <lr-input appearance="filled" label="filled"></lr-input>
      <lr-input appearance="plain" label="plain"></lr-input>
      <lr-input appearance="accent" label="accent"></lr-input>
      <lr-input pill label="pill" placeholder="Rounded ends"></lr-input>
    </div>
  `,
};

/** `without-spin-buttons` suppresses the browser's own increment/decrement controls. */
export const WithoutSpinButtons: Story = {
  name: 'type="number" without-spin-buttons',
  render: () => html`
    <lr-input type="number" without-spin-buttons label="Quantity" min="0" max="10" value="3"></lr-input>
  `,
};

/** Enter submits the ancestor form, exactly as it would in a native `<input>`. */
export const ImplicitSubmission: Story = {
  render: () => html`
    <form @submit=${(event: Event) => event.preventDefault()}>
      <lr-input name="q" label="Search" hint="Press Enter to submit" required></lr-input>
    </form>
  `,
};

export const Disabled: Story = {
  render: () => html`<lr-input label="Name" value="Ada Lovelace" disabled></lr-input>`,
};

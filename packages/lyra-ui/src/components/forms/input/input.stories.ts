import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraInput } from './input.js';
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

/** Remaining mapped native input types keep the browser's editing and validation semantics. */
export const NativeTypes: Story = {
  render: () => html`
    <div style="display:grid; gap:0.75rem; max-inline-size:24rem">
      <lr-input type="date" label="Date"></lr-input>
      <lr-input type="datetime-local" label="Local date and time"></lr-input>
      <lr-input type="tel" label="Telephone"></lr-input>
      <lr-input type="url" label="URL"></lr-input>
    </div>
  `,
};

/**
 * `autocorrect` always reads as boolean while accepting Web Awesome's boolean writes and
 * Shoelace's `'off'`/`'on'` writes.
 */
export const AutocorrectPropertyWrites: Story = {
  render: () => {
    const write = (event: Event, value: boolean | 'off' | 'on') => {
      const root = (event.currentTarget as HTMLElement).closest('[data-autocorrect-story]')!;
      const input = root.querySelector('lr-input') as LyraInput;
      input.autocorrect = value;
      const output = root.querySelector('output')!;
      output.textContent = `autocorrect reads ${String(input.autocorrect)}`;
    };

    return html`
      <div
        data-autocorrect-story
        style="display: grid; gap: var(--lr-space-s); max-inline-size: var(--lr-size-20rem);"
      >
        <lr-input label="Editing assistance"></lr-input>
        <div style="display: flex; gap: var(--lr-space-xs); flex-wrap: wrap;">
          <button type="button" @click=${(event: Event) => write(event, false)}>Write false</button>
          <button type="button" @click=${(event: Event) => write(event, 'off')}>Write "off"</button>
          <button type="button" @click=${(event: Event) => write(event, 'on')}>Write "on"</button>
        </div>
        <output aria-live="polite">autocorrect reads true</output>
      </div>
    `;
  },
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
      <lr-input appearance="outlined" label="outlined (default)"></lr-input>
      <lr-input appearance="filled-outlined" label="filled-outlined"></lr-input>
      <lr-input appearance="filled" label="filled"></lr-input>
      <lr-input appearance="plain" label="plain"></lr-input>
      <lr-input appearance="accent" label="accent"></lr-input>
      <lr-input pill label="pill" placeholder="Rounded ends"></lr-input>
    </div>
  `,
};

/** Shoelace aliases converge on the same state/slots as Lyra's canonical spellings. */
export const ShoelaceAliases: Story = {
  render: () => html`
    <lr-input filled help-text="Rendered through help-text" no-spin-buttons type="number" label="Quantity">
      <span slot="prefix" aria-hidden="true">#</span>
      <span slot="suffix">units</span>
    </lr-input>
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

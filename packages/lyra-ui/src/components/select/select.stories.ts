import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraSelect, LyraSelectSize } from './select.js';

const meta: Meta = {
  title: 'Select',
  component: 'lyra-select',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-select label="Fruit" placeholder="Pick one…" style="max-width: 20rem">
      <lyra-option value="a">Apple</lyra-option>
      <lyra-option value="b">Banana</lyra-option>
      <lyra-option value="c">Cherry</lyra-option>
      <lyra-option value="d">Date</lyra-option>
    </lyra-select>
  `,
};

/** `focus()` and `blur()` target the internal combobox trigger and surface host events. */
export const ProgrammaticFocus: Story = {
  render: () => html`
    <div style="display: grid; gap: 0.75rem; max-width: 20rem;">
      <lyra-select label="Fruit" placeholder="Pick one…">
        <lyra-option value="a">Apple</lyra-option>
        <lyra-option value="b">Banana</lyra-option>
      </lyra-select>
      <button
        type="button"
        style="justify-self: start;"
        @click=${(event: Event) => {
          const select = (event.currentTarget as HTMLElement).parentElement!.querySelector(
            'lyra-select',
          ) as LyraSelect;
          select.focus();
        }}
      >Focus the select</button>
    </div>
  `,
};

/** `<lyra-option selected>` seeds the initial value, mirroring `<option selected>`. */
export const PreSelectedValue: Story = {
  render: () => html`
    <lyra-select label="Fruit" style="max-width: 20rem">
      <lyra-option value="a">Apple</lyra-option>
      <lyra-option value="b" selected>Banana</lyra-option>
      <lyra-option value="c">Cherry</lyra-option>
      <lyra-option value="d">Date</lyra-option>
    </lyra-select>
  `,
};

/**
 * Rows come from `<lyra-option>` children plus `group` (section headers),
 * `sub` (a secondary line), and `dot-color` (a leading status dot) — same
 * rich-row support as `<lyra-combobox>`.
 */
export const RichRows: Story = {
  render: () => html`
    <lyra-select label="Inverter" placeholder="Pick one…" style="max-width: 22rem">
      <lyra-option value="inv-1" group="Building A" sub="Running" dot-color="var(--lyra-color-success)">
        Inverter 1
      </lyra-option>
      <lyra-option value="inv-2" group="Building A" sub="Idle" dot-color="var(--lyra-color-text-quiet)">
        Inverter 2
      </lyra-option>
      <lyra-option value="inv-3" group="Building B" sub="Fault" dot-color="var(--lyra-color-danger)">
        Inverter 3
      </lyra-option>
    </lyra-select>
  `,
};

/** `size` spans the same `xs`–`xl` scale as `lyra-toast-item`, default `m`. */
export const Sizes: Story = {
  render: () => {
    const sizes: LyraSelectSize[] = ['xs', 's', 'm', 'l', 'xl'];
    return html`
      <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 20rem">
        ${sizes.map(
          (size) => html`
            <lyra-select size=${size} placeholder=${`Size "${size}"`}>
              <lyra-option value="a">Apple</lyra-option>
              <lyra-option value="b">Banana</lyra-option>
            </lyra-select>
          `,
        )}
      </div>
    `;
  },
};

export const Disabled: Story = {
  render: () => html`
    <lyra-select label="Disabled" disabled placeholder="Can't touch this" style="max-width: 20rem">
      <lyra-option value="a">Apple</lyra-option>
      <lyra-option value="b">Banana</lyra-option>
    </lyra-select>
  `,
};

/**
 * When exactly one `<lyra-option>` is enabled, the trigger auto-commits that
 * option on click or Arrow Up/Down instead of opening a listbox — no chevron,
 * no popup. Useful for "only one choice available" states that would
 * otherwise force an unnecessary extra click.
 */
export const SingleOption: Story = {
  render: () => html`
    <lyra-select label="Region" style="max-width: 20rem">
      <lyra-option value="us-east">US East</lyra-option>
    </lyra-select>
  `,
};

/** The same auto-commit behavior applies when only one *enabled* option remains among disabled ones. */
export const SingleEnabledAmongDisabled: Story = {
  render: () => html`
    <lyra-select label="Plan" style="max-width: 20rem">
      <lyra-option value="free" disabled>Free (unavailable)</lyra-option>
      <lyra-option value="pro">Pro</lyra-option>
      <lyra-option value="enterprise" disabled>Enterprise (unavailable)</lyra-option>
    </lyra-select>
  `,
};

/**
 * `required` blocks form submission while empty; `error-text` renders a
 * validation message alongside the shared `hint`.
 */
export const RequiredWithValidation: Story = {
  render: () => html`
    <form style="display: flex; flex-direction: column; gap: 1.5rem; max-width: 22rem">
      <lyra-select label="Required" required hint="Pick your favorite">
        <lyra-option value="a">Apple</lyra-option>
        <lyra-option value="b">Banana</lyra-option>
      </lyra-select>
      <lyra-select label="Invalid" required error-text="Selection required">
        <lyra-option value="a">Apple</lyra-option>
        <lyra-option value="b">Banana</lyra-option>
      </lyra-select>
      <button type="submit">Submit</button>
    </form>
  `,
};

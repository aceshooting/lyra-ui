import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraSelect, LyraSelectAppearance, LyraSelectSize } from './select.js';
import type { LyraOption } from '../combobox/option.class.js';

const meta: Meta = {
  title: 'Select',
  component: 'lr-select',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-select label="Fruit" placeholder="Pick one…" style="max-width: 20rem">
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
      <lr-option value="c">Cherry</lr-option>
      <lr-option value="d">Date</lr-option>
    </lr-select>
  `,
};

/** `focus()` and `blur()` target the internal combobox trigger and surface host events. */
export const ProgrammaticFocus: Story = {
  render: () => html`
    <div style="display: grid; gap: 0.75rem; max-width: 20rem;">
      <lr-select label="Fruit" placeholder="Pick one…">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
      <button
        type="button"
        style="justify-self: start;"
        @click=${(event: Event) => {
          const select = (event.currentTarget as HTMLElement).parentElement!.querySelector(
            'lr-select',
          ) as LyraSelect;
          select.focus();
        }}
      >Focus the select</button>
    </div>
  `,
};

/** `<lr-option selected>` seeds the initial value, mirroring `<option selected>`. */
export const PreSelectedValue: Story = {
  render: () => html`
    <lr-select label="Fruit" style="max-width: 20rem">
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b" selected>Banana</lr-option>
      <lr-option value="c">Cherry</lr-option>
      <lr-option value="d">Date</lr-option>
    </lr-select>
  `,
};

/**
 * Rows come from `<lr-option>` children plus `group` (section headers),
 * `sub` (a secondary line), and `dot-color` (a leading status dot) — same
 * rich-row support as `<lr-combobox>`.
 */
export const RichRows: Story = {
  render: () => html`
    <lr-select label="Inverter" placeholder="Pick one…" style="max-width: 22rem">
      <lr-option value="inv-1" group="Building A" sub="Running" dot-color="var(--lr-color-success)">
        Inverter 1
      </lr-option>
      <lr-option value="inv-2" group="Building A" sub="Idle" dot-color="var(--lr-color-text-quiet)">
        Inverter 2
      </lr-option>
      <lr-option value="inv-3" group="Building B" sub="Fault" dot-color="var(--lr-color-danger)">
        Inverter 3
      </lr-option>
    </lr-select>
  `,
};

/** `size` spans the same `xs`–`xl` scale as `lr-toast-item`, default `m`. */
export const Sizes: Story = {
  render: () => {
    const sizes: LyraSelectSize[] = ['2xs', 'xs', 's', 'm', 'l', 'xl'];
    return html`
      <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 20rem">
        ${sizes.map(
          (size) => html`
            <lr-select size=${size} placeholder=${`Size "${size}"`}>
              <lr-option value="a">Apple</lr-option>
              <lr-option value="b">Banana</lr-option>
            </lr-select>
          `,
        )}
      </div>
    `;
  },
};

export const Disabled: Story = {
  render: () => html`
    <lr-select label="Disabled" disabled placeholder="Can't touch this" style="max-width: 20rem">
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
    </lr-select>
  `,
};

/** Start/end slots remain inside the trigger and shrink around a long selected label. */
export const Adornments: Story = {
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-select label="Deployment region" value="primary">
        <span slot="start" aria-hidden="true">◉</span>
        <kbd slot="end">R</kbd>
        <lr-option value="primary"
          >Primary-production-region-with-an-intentionally-long-identifier</lr-option
        >
        <lr-option value="backup">Backup region</lr-option>
      </lr-select>
    </div>
  `,
};

/**
 * When exactly one `<lr-option>` is enabled, the trigger auto-commits that
 * option on click or Arrow Up/Down instead of opening a listbox — no chevron,
 * no popup. Useful for "only one choice available" states that would
 * otherwise force an unnecessary extra click.
 */
export const SingleOption: Story = {
  render: () => html`
    <lr-select label="Region" auto-commit-single-option style="max-width: 20rem">
      <lr-option value="us-east">US East</lr-option>
    </lr-select>
  `,
};

/** The same auto-commit behavior applies when only one *enabled* option remains among disabled ones. */
export const SingleEnabledAmongDisabled: Story = {
  render: () => html`
    <lr-select label="Plan" auto-commit-single-option style="max-width: 20rem">
      <lr-option value="free" disabled>Free (unavailable)</lr-option>
      <lr-option value="pro">Pro</lr-option>
      <lr-option value="enterprise" disabled>Enterprise (unavailable)</lr-option>
    </lr-select>
  `,
};

/**
 * `required` blocks form submission while empty; `error-text` renders a
 * validation message alongside the shared `hint`.
 */
export const RequiredWithValidation: Story = {
  render: () => html`
    <form style="display: flex; flex-direction: column; gap: 1.5rem; max-width: 22rem">
      <lr-select label="Required" required hint="Pick your favorite">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
      <lr-select label="Invalid" required error-text="Selection required">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
      <button type="submit">Submit</button>
    </form>
  `,
};

/**
 * `multiple` turns the value into a `string[]` and renders one chip per selection. Picking a
 * selected row toggles it back off; Backspace on the trigger drops the last one. The chips are
 * deliberately non-interactive — the trigger is a real `<button>`, so a nested remove button
 * would be invalid (and unreachable) interactive-content nesting.
 */
export const Multiple: Story = {
  render: () => html`
    <lr-select label="Fruit" multiple placeholder="Pick any" style="max-width: 22rem">
      <lr-option value="a" selected>Apple</lr-option>
      <lr-option value="b" selected>Banana</lr-option>
      <lr-option value="c">Cherry</lr-option>
      <lr-option value="d">Date</lr-option>
    </lr-select>
  `,
};

/** Past `max-options-visible` chips, the rest collapse behind a localized "+N" chip. */
export const MaxOptionsVisible: Story = {
  render: () => html`
    <lr-select label="Fruit" multiple max-options-visible="2" style="max-width: 22rem">
      <lr-option value="a" selected>Apple</lr-option>
      <lr-option value="b" selected>Banana</lr-option>
      <lr-option value="c" selected>Cherry</lr-option>
      <lr-option value="d" selected>Date</lr-option>
    </lr-select>
  `,
};

/** `getTag` replaces a chip entirely, so the consumer owns its markup and parts. */
export const CustomTags: Story = {
  render: () => html`
    <lr-select
      label="Fruit"
      multiple
      style="max-width: 22rem"
      .getTag=${(option: LyraOption, index: number) =>
        html`<span part="tag" style="text-transform: uppercase">${index + 1}. ${option.label}</span>`}
    >
      <lr-option value="a" selected>Apple</lr-option>
      <lr-option value="b" selected>Banana</lr-option>
      <lr-option value="c">Cherry</lr-option>
    </lr-select>
  `,
};

/** `with-clear` adds a button that empties the selection and fires `lr-clear`. */
export const WithClear: Story = {
  render: () => html`
    <lr-select label="Fruit" with-clear style="max-width: 20rem">
      <lr-option value="a" selected>Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
    </lr-select>
  `,
};

/** `appearance` retunes the trigger surface; `pill` rounds its corners. */
export const Appearances: Story = {
  render: () => {
    const appearances: LyraSelectAppearance[] = [
      'accent',
      'filled',
      'outlined',
      'filled-outlined',
      'plain',
    ];
    return html`
      <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 20rem">
        ${appearances.map(
          (appearance) => html`
            <lr-select appearance=${appearance} placeholder=${appearance}>
              <lr-option value="a">Apple</lr-option>
              <lr-option value="b">Banana</lr-option>
            </lr-select>
          `,
        )}
        <lr-select pill placeholder="pill">
          <lr-option value="a">Apple</lr-option>
        </lr-select>
      </div>
    `;
  },
};

/** `placement` picks the preferred side; `flip`/`shift` still keep the listbox in view. */
export const Placement: Story = {
  render: () => html`
    <div style="padding-block-start: 12rem">
      <lr-select label="Fruit" placement="top-start" open style="max-width: 20rem">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    </div>
  `,
};

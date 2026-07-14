import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { ComboboxSource, LyraCombobox, OptionFilter } from './combobox.js';

const meta: Meta = {
  title: 'Combobox',
  component: 'lyra-combobox',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-combobox label="Fruit" placeholder="Pick one…" with-clear style="max-width: 20rem">
      <lyra-option value="a">Apple</lyra-option>
      <lyra-option value="b">Banana</lyra-option>
      <lyra-option value="c">Cherry</lyra-option>
      <lyra-option value="d">Date</lyra-option>
    </lyra-combobox>
  `,
};

export const Multiple: Story = {
  render: () => html`
    <lyra-combobox label="Fruit" multiple with-clear style="max-width: 20rem">
      <lyra-option value="a">Apple</lyra-option>
      <lyra-option value="b">Banana</lyra-option>
      <lyra-option value="c">Cherry</lyra-option>
      <lyra-option value="d">Date</lyra-option>
    </lyra-combobox>
  `,
};

export const Sizes: Story = {
  render: () => html`
    <div style="display: grid; gap: 1rem; max-width: 24rem">
      <lyra-combobox size="xs" label="Extra small" placeholder="Choose a value…">
        <lyra-option value="a">Alpha</lyra-option>
      </lyra-combobox>
      <lyra-combobox size="s" label="Small" placeholder="Choose a value…">
        <lyra-option value="a">Alpha</lyra-option>
      </lyra-combobox>
      <lyra-combobox size="m" label="Medium" placeholder="Choose a value…">
        <lyra-option value="a">Alpha</lyra-option>
      </lyra-combobox>
      <lyra-combobox size="l" label="Large" placeholder="Choose a value…">
        <lyra-option value="a">Alpha</lyra-option>
      </lyra-combobox>
      <lyra-combobox size="xl" label="Extra large" placeholder="Choose a value…">
        <lyra-option value="a">Alpha</lyra-option>
      </lyra-combobox>
    </div>
  `,
};

/**
 * Rows come from `<lyra-option>` children plus `group` (section headers),
 * `sub` (a secondary line), and `dot-color` (a leading status dot) — useful
 * for richer pickers like a device or status list.
 */
export const RichRows: Story = {
  render: () => html`
    <lyra-combobox label="Inverter" placeholder="Pick one…" style="max-width: 22rem">
      <lyra-option value="inv-1" group="Building A" sub="Running" dot-color="var(--lyra-color-success)">
        Inverter 1
      </lyra-option>
      <lyra-option value="inv-2" group="Building A" sub="Idle" dot-color="var(--lyra-color-text-quiet)">
        Inverter 2
      </lyra-option>
      <lyra-option value="inv-3" group="Building B" sub="Fault" dot-color="var(--lyra-color-danger)">
        Inverter 3
      </lyra-option>
    </lyra-combobox>
  `,
};

/**
 * `source` replaces the light-DOM `<lyra-option>` list with an async
 * `(query) => Promise<ComboboxSourceRow[]>` lookup, debounced ~200ms after
 * each keystroke. A "Loading…" row is shown while a call is in flight.
 */
export const AsyncSource: Story = {
  render: () => {
    const all = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry', 'Fig', 'Grape'];
    const source: ComboboxSource = async (query) => {
      await new Promise((r) => setTimeout(r, 400));
      return all
        .filter((label) => label.toLowerCase().includes(query.toLowerCase()))
        .map((label) => ({ value: label.toLowerCase(), label }));
    };
    return html`
      <lyra-combobox label="Fruit (async)" placeholder="Type to search…" with-clear
        style="max-width: 22rem" .source=${source}
      ></lyra-combobox>
    `;
  },
};

export const RichAsyncRows: Story = {
  render: () => {
    const source: ComboboxSource = async (query) => {
      const rows = [
        {
          value: 'case-42',
          label: 'Alpine Energy v Commission',
          sub: 'Judgment · 14 July 2026',
          icon: html`<span>§</span>`,
          badge: 12,
          accessibleLabel: 'Alpine Energy versus Commission, judgment, 12 citations',
          data: { kind: 'judgment', citationCount: 12 },
        },
        {
          value: 'case-77',
          label: 'Northwind v Council',
          sub: 'Opinion · 8 May 2026',
          icon: html`<span>◇</span>`,
          badge: 'Draft',
          accessibleLabel: 'Northwind versus Council, draft opinion',
          data: { kind: 'opinion', citationCount: 0 },
        },
      ];
      return rows.filter((row) => row.label.toLowerCase().includes(query.toLowerCase()));
    };

    const reportSelection = (event: Event) => {
      const combobox = event.currentTarget as LyraCombobox;
      const output = combobox.parentElement?.querySelector('output');
      const row = combobox.selectedRows[0];
      const data = row?.data as { kind?: string } | undefined;
      if (output) output.textContent = row ? `${row.label} — payload kind: ${data?.kind ?? 'unknown'}` : 'No selection';
    };

    return html`
      <div>
        <style>
          .rich-results::part(option-icon) {
            color: var(--lyra-color-brand);
          }
          .rich-results::part(option-badge) {
            font-weight: var(--lyra-font-weight-semibold);
          }
        </style>
        <lyra-combobox
          class="rich-results"
          label="Case"
          placeholder="Search cases…"
          style="max-width: 28rem"
          .source=${source}
          @change=${reportSelection}
        ></lyra-combobox>
        <output aria-live="polite">Select a result to inspect its retained data payload.</output>
      </div>
    `;
  },
};

/**
 * `filter` overrides the default label/searchText matcher entirely, e.g. to
 * match only from the start of the label instead of anywhere within it.
 */
export const CustomFilter: Story = {
  render: () => {
    const startsWith: OptionFilter = (option, query) => option.label.toLowerCase().startsWith(query.toLowerCase());
    return html`
      <lyra-combobox label="Fruit (starts with…)" placeholder="Try “an”…" style="max-width: 22rem"
        .filter=${startsWith}
      >
        <lyra-option value="a">Apple</lyra-option>
        <lyra-option value="b">Banana</lyra-option>
        <lyra-option value="c">Cherry</lyra-option>
        <lyra-option value="d">Date</lyra-option>
      </lyra-combobox>
    `;
  },
};

export const States: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 1.5rem; max-width: 22rem">
      <lyra-combobox label="Disabled" disabled placeholder="Can't touch this">
        <lyra-option value="a">Apple</lyra-option>
      </lyra-combobox>
      <lyra-combobox label="Required" required hint="Pick your favorite">
        <lyra-option value="a">Apple</lyra-option>
      </lyra-combobox>
      <lyra-combobox label="Invalid" required error-text="Selection required">
        <lyra-option value="a">Apple</lyra-option>
      </lyra-combobox>
    </div>
  `,
};

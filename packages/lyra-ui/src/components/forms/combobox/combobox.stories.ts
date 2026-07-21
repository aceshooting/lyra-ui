import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { ComboboxFilterDetail, ComboboxSource, LyraCombobox, OptionFilter } from './combobox.js';

const meta: Meta = {
  title: 'Combobox',
  component: 'lr-combobox',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-combobox label="Fruit" placeholder="Pick one…" clearable style="max-width: 20rem">
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
      <lr-option value="c">Cherry</lr-option>
      <lr-option value="d">Date</lr-option>
    </lr-combobox>
  `,
};

export const Multiple: Story = {
  render: () => html`
    <lr-combobox label="Fruit" multiple clearable style="max-width: 20rem">
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
      <lr-option value="c">Cherry</lr-option>
      <lr-option value="d">Date</lr-option>
    </lr-combobox>
  `,
};

export const Sizes: Story = {
  render: () => html`
    <div style="display: grid; gap: 1rem; max-width: 24rem">
      <lr-combobox size="2xs" label="2xs" placeholder="Choose a value…">
        <lr-option value="a">Alpha</lr-option>
      </lr-combobox>
      <lr-combobox size="xs" label="Extra small" placeholder="Choose a value…">
        <lr-option value="a">Alpha</lr-option>
      </lr-combobox>
      <lr-combobox size="s" label="Small" placeholder="Choose a value…">
        <lr-option value="a">Alpha</lr-option>
      </lr-combobox>
      <lr-combobox size="m" label="Medium" placeholder="Choose a value…">
        <lr-option value="a">Alpha</lr-option>
      </lr-combobox>
      <lr-combobox size="l" label="Large" placeholder="Choose a value…">
        <lr-option value="a">Alpha</lr-option>
      </lr-combobox>
      <lr-combobox size="xl" label="Extra large" placeholder="Choose a value…">
        <lr-option value="a">Alpha</lr-option>
      </lr-combobox>
    </div>
  `,
};

/**
 * Rows come from `<lr-option>` children plus `group` (section headers),
 * `sub` (a secondary line), and `dot-color` (a leading status dot) — useful
 * for richer pickers like a device or status list.
 */
export const RichRows: Story = {
  render: () => html`
    <lr-combobox label="Inverter" placeholder="Pick one…" style="max-width: 22rem">
      <lr-option value="inv-1" group="Building A" sub="Running" dot-color="var(--lr-color-success)">
        Inverter 1
      </lr-option>
      <lr-option value="inv-2" group="Building A" sub="Idle" dot-color="var(--lr-color-text-quiet)">
        Inverter 2
      </lr-option>
      <lr-option value="inv-3" group="Building B" sub="Fault" dot-color="var(--lr-color-danger)">
        Inverter 3
      </lr-option>
    </lr-combobox>
  `,
};

/**
 * `source` replaces the light-DOM `<lr-option>` list with an async
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
      <lr-combobox label="Fruit (async)" placeholder="Type to search…" clearable
        style="max-width: 22rem" .source=${source}
      ></lr-combobox>
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
            color: var(--lr-color-brand);
          }
          .rich-results::part(option-badge) {
            font-weight: var(--lr-font-weight-semibold);
          }
        </style>
        <lr-combobox
          class="rich-results"
          label="Case"
          placeholder="Search cases…"
          style="max-width: 28rem"
          .source=${source}
          @change=${reportSelection}
        ></lr-combobox>
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
      <lr-combobox label="Fruit (starts with…)" placeholder="Try “an”…" style="max-width: 22rem"
        .filter=${startsWith}
      >
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
        <lr-option value="c">Cherry</lr-option>
        <lr-option value="d">Date</lr-option>
      </lr-combobox>
    `;
  },
};

/**
 * `lr-filter` reports the live, in-progress filter text (`detail.value`) on every user keystroke —
 * the thing `value` deliberately is *not*, since `value` is the committed selection. Use it to
 * drive search-as-you-type side effects outside the listbox, such as this "No matches for “…”"
 * empty state, instead of reading the shadow input.
 *
 * It fires for user input only — typing, and the clear button when it blanks a non-empty query.
 * Picking a row, `form.reset()`, dismissing the listbox and programmatic `value` writes all blank
 * the filter silently. With `clearable`, the button appears for filter text alone (no selection
 * needed), and a query-only clear emits `lr-filter` without a spurious `change`/`lr-clear`.
 */
export const LiveFilterText: Story = {
  render: () => {
    const fruits = ['Apple', 'Banana', 'Cherry', 'Date'];

    const onFilter = (event: Event) => {
      const combobox = event.currentTarget as LyraCombobox;
      const { value } = (event as CustomEvent<ComboboxFilterDetail>).detail;
      const status = combobox.parentElement?.querySelector('output');
      if (!status) return;
      const query = value.trim();
      if (!query) {
        status.textContent = 'Type to filter — the live text arrives on every keystroke.';
        return;
      }
      const matches = fruits.filter((fruit) => fruit.toLowerCase().includes(query.toLowerCase()));
      status.textContent = matches.length ? `${matches.length} match(es) for “${query}”` : `No matches for “${query}”`;
    };

    return html`
      <div style="max-width: 22rem">
        <lr-combobox label="Fruit" placeholder="Type to search…" clearable @lr-filter=${onFilter}>
          ${fruits.map((fruit) => html`<lr-option value=${fruit.toLowerCase()}>${fruit}</lr-option>`)}
        </lr-combobox>
        <output aria-live="polite">Type to filter — the live text arrives on every keystroke.</output>
      </div>
    `;
  },
};

export const States: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 1.5rem; max-width: 22rem">
      <lr-combobox label="Disabled" disabled placeholder="Can't touch this">
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
      <lr-combobox label="Required" required hint="Pick your favorite">
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
      <lr-combobox label="Invalid" required error-text="Selection required">
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    </div>
  `,
};

export const ExactToolbarHeight: Story = {
  name: 'Exact toolbar height',
  parameters: {
    docs: {
      description: {
        story:
          'Each sized control exposes an exact-height custom property (`--lr-combobox-trigger-height`, ' +
          '`--lr-select-trigger-height`, `--lr-input-control-height`). Left unset they only floor the ' +
          'control; set to the same length they pixel-match in one toolbar row without a `::part()` rule. ' +
          'Leave the combobox one unset in `multiple` mode, where a wrapping tag row needs to grow.',
      },
    },
  },
  render: () => html`
    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap">
      <lr-input
        aria-label="Search"
        placeholder="Search…"
        style="--lr-input-control-height: 2.25rem"
      ></lr-input>
      <lr-select aria-label="Status" placeholder="Status" style="--lr-select-trigger-height: 2.25rem">
        <lr-option value="open">Open</lr-option>
        <lr-option value="closed">Closed</lr-option>
      </lr-select>
      <lr-combobox aria-label="Owner" placeholder="Owner" style="--lr-combobox-trigger-height: 2.25rem">
        <lr-option value="ada">Ada</lr-option>
        <lr-option value="grace">Grace</lr-option>
      </lr-combobox>
    </div>
  `,
};

export const Adornments: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The `start` and `end` slots place decorative chrome inside the trigger row. `end` renders ' +
          'before the expand chevron, so consumer content is never outboard of it. Slotted adornments ' +
          'are never collected as options.',
      },
    },
  },
  render: () => html`
    <lr-combobox label="Owner" placeholder="Search people…" clearable style="max-width: 22rem">
      <span slot="start" aria-hidden="true">⌕</span>
      <kbd slot="end">⌘K</kbd>
      <lr-option value="ada">Ada Lovelace</lr-option>
      <lr-option value="grace">Grace Hopper</lr-option>
      <lr-option value="alan">Alan Turing</lr-option>
    </lr-combobox>
  `,
};

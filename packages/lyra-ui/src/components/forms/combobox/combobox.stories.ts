import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type {
  ComboboxFilterDetail,
  ComboboxSource,
  LyraCombobox,
  LyraComboboxValidator,
  OptionFilter,
} from './combobox.js';
import '../color-picker/color-picker.js';

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

export const VetoedClosePreservesFilter: Story = {
  name: 'Cancelable close preserves live filter state',
  render: () => {
    let vetoNextClose = true;
    return html`
      <div style="display: grid; gap: var(--lr-space-s); max-inline-size: var(--lr-size-22rem)">
        <p style="margin: 0">Type a filter, then close twice. The first close is vetoed and keeps the query and active row.</p>
        <lr-combobox
          open
          label="Fruit"
          @lr-hide=${(event: Event) => {
            if (!vetoNextClose) return;
            vetoNextClose = false;
            event.preventDefault();
          }}
        >
          <lr-option value="a">Apple</lr-option>
          <lr-option value="b">Banana</lr-option>
          <lr-option value="c">Cherry</lr-option>
        </lr-combobox>
      </div>
    `;
  },
};

export const DynamicOptionAvailability: Story = {
  render: () => html`
    <div style="display:grid; gap:var(--lr-space-s); max-inline-size:22rem;">
      <p style="margin:0;">Open the list, press End, then R to remove the active final option or D to disable it.</p>
      <lr-combobox
        label="Fruit"
        placeholder="Pick one…"
        @keydown=${(event: KeyboardEvent) => {
          const combobox = event.currentTarget as LyraCombobox;
          if (event.key.toLocaleLowerCase() === 'r') {
            combobox.querySelector('lr-option:last-of-type')?.remove();
          }
          if (event.key.toLocaleLowerCase() === 'd') {
            const input = combobox.shadowRoot?.querySelector('[part="combobox-input"]');
            const activeId = input?.getAttribute('aria-activedescendant');
            const value = activeId
              ? combobox.shadowRoot?.getElementById(activeId)?.getAttribute('data-value')
              : null;
            const option = value
              ? combobox.querySelector(`lr-option[value="${CSS.escape(value)}"]`)
              : null;
            if (option) (option as HTMLElement & { disabled: boolean }).disabled = true;
          }
        }}
      >
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
        <lr-option value="c">Cherry</lr-option>
      </lr-combobox>
    </div>
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

export const CreateAndCustomValues: Story = {
  render: () => html`
    <div style="display:grid; gap:var(--lr-space-m); max-inline-size:22rem;">
      <lr-combobox
        label="Tags"
        hint="Type a new tag and choose the localized create row."
        multiple
        allow-create
        with-clear
        appearance="filled-outlined"
      >
        <lr-option value="stable">Stable</lr-option>
        <lr-option value="preview">Preview</lr-option>
      </lr-combobox>
      <lr-combobox
        label="Custom single value"
        hint="Enter commits text without appending an option."
        allow-custom-value
        placement="top"
      >
        <lr-option value="known">Known value</lr-option>
      </lr-combobox>
    </div>
  `,
};

/** 320px allocation with selected unbroken content and long option metadata. */
export const Narrow: Story = {
  name: 'Narrow (320px)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-combobox
        multiple
        label="Long generated deployment identifiers"
        hint="Selected tags remain inside this narrow panel."
      >
        <lr-option
          value="deployment-with-an-intentionally-unbroken-generated-identifier-that-must-not-widen-the-panel"
          selected
          sub="Production environment with long metadata"
          >deployment-with-an-intentionally-unbroken-generated-identifier-that-must-not-widen-the-panel</lr-option
        >
        <lr-option value="secondary" sub="Backup environment">Secondary deployment</lr-option>
      </lr-combobox>
    </div>
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
 * `size` also accepts the Web Awesome / Shoelace spellings — `small`, `medium` and `large` render
 * exactly as `s`, `m` and `l` — and `pill` rounds the trigger row to a full pill.
 */
export const AliasSizesAndPill: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 20rem">
      <lr-combobox size="small" label='size="small"' placeholder="Choose a value…">
        <lr-option value="a">Alpha</lr-option>
      </lr-combobox>
      <lr-combobox size="medium" label='size="medium"' placeholder="Choose a value…">
        <lr-option value="a">Alpha</lr-option>
      </lr-combobox>
      <lr-combobox size="large" label='size="large"' placeholder="Choose a value…">
        <lr-option value="a">Alpha</lr-option>
      </lr-combobox>
      <lr-combobox pill label="pill" placeholder="Choose a value…">
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
  parameters: {
    docs: {
      description: {
        story:
          'Async-row icons are visual metadata: their rendered subtree stays visible but is inert and aria-hidden. Put independent actions outside the icon field.',
      },
    },
  },
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

const seatAvailabilityValidator: LyraComboboxValidator = {
  observedAttributes: ['data-sold-out'],
  checkValidity: (input) => {
    const soldOut = (input as unknown as HTMLElement).getAttribute('data-sold-out') === 'true';
    return {
      isValid: !soldOut,
      message: 'That performance just sold out — pick another.',
      invalidKeys: ['customError'],
    };
  },
};

export const CustomValidators: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The `validators` property runs after the intrinsic `required` constraint and accepts ' +
          'Lyra function and `validate(value, input)` forms plus Web Awesome-compatible ' +
          '`{ observedAttributes?, checkValidity(), message? }` objects. Changing a listed host ' +
          'attribute re-runs validity with no explicit `checkValidity()` call.',
      },
    },
  },
  render: () => {
    const toggleSoldOut = (event: Event) => {
      const container = (event.currentTarget as HTMLElement).parentElement;
      const combobox = container?.querySelector('lr-combobox');
      if (!combobox) return;
      const soldOut = combobox.getAttribute('data-sold-out') === 'true';
      combobox.setAttribute('data-sold-out', soldOut ? 'false' : 'true');
      const output = container?.querySelector('output');
      if (output) output.textContent = combobox.validationMessage || 'Valid';
    };
    return html`
      <div style="display: grid; gap: var(--lr-space-s); max-width: 22rem">
        <lr-combobox
          label="Performance"
          data-sold-out="true"
          .validators=${[seatAvailabilityValidator]}
        >
          <lr-option value="fri">Friday</lr-option>
          <lr-option value="sat">Saturday</lr-option>
        </lr-combobox>
        <button type="button" @click=${toggleSoldOut}>Toggle sold out</button>
        <output aria-live="polite">That performance just sold out — pick another.</output>
      </div>
    `;
  },
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

export const ManagedOverlayStack: Story = {
  name: 'Managed nonmodal overlay stack',
  parameters: {
    docs: {
      description: {
        story:
          'The color picker opens first and the combobox second. Their shared stack puts the newer listbox above the picker; one Escape or outside pointer dismisses only that top layer and hands focus to the survivor.',
      },
    },
  },
  render: () => html`
    <div style="display:flex;align-items:start;gap:calc(var(--lr-space-l) + var(--lr-space-s));min-block-size:var(--lr-size-24rem)">
      <lr-color-picker label="Accent" open></lr-color-picker>
      <lr-combobox label="Owner" placeholder="Search people…" open>
        <lr-option value="ada">Ada Lovelace</lr-option>
        <lr-option value="grace">Grace Hopper</lr-option>
        <lr-option value="alan">Alan Turing</lr-option>
      </lr-combobox>
    </div>
  `,
};

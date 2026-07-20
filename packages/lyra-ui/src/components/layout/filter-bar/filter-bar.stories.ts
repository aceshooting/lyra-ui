import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './filter-bar.js';
import type { LyraFilterBar, FilterBarFilterDefinition } from './filter-bar.js';

const meta: Meta = {
  title: 'FilterBar',
  component: 'lr-filter-bar',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

const dashboardFilters: FilterBarFilterDefinition[] = [
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    placeholder: 'Any status',
    options: [
      { value: 'open', label: 'Open' },
      { value: 'in-progress', label: 'In progress' },
      { value: 'closed', label: 'Closed' },
    ],
  },
  {
    id: 'owners',
    label: 'Owners',
    type: 'combobox',
    multiple: true,
    placeholder: 'Any owner',
    options: [
      { value: 'ada', label: 'Ada Lovelace' },
      { value: 'grace', label: 'Grace Hopper' },
      { value: 'alan', label: 'Alan Turing' },
    ],
  },
  { id: 'created', label: 'Created', type: 'date' },
  { id: 'period', label: 'Active period', type: 'date-range' },
];

/** A filter bar with no filters set yet -- every control renders at its own empty default and
 *  the active-filter chip row and reset button stay hidden/disabled respectively. */
export const Default: Story = {
  render: () => html` <lr-filter-bar style="max-width: 48rem" .filters=${dashboardFilters}></lr-filter-bar> `,
};

/** A prefilled `value` renders each control's current selection and a matching row of removable
 *  active-filter chips. Removing a chip clears just that filter. */
export const WithActiveFilters: Story = {
  render: () => html`
    <lr-filter-bar
      style="max-width: 48rem"
      .filters=${dashboardFilters}
      .value=${{ status: 'open', owners: ['ada', 'grace'], period: '2026-01-01/2026-01-31' }}
    ></lr-filter-bar>
  `,
};

/** `required: true` on a filter definition surfaces that composed control's own inline error
 *  once it's touched (or `reportValidity()` is called) -- see the "search" filter here. */
export const RequiredFilter: Story = {
  render: () => {
    const filters: FilterBarFilterDefinition[] = [
      { ...dashboardFilters[0], required: true },
      dashboardFilters[1],
    ];
    const onRun = (e: Event) => {
      const host = (e.target as HTMLElement).closest('.demo')!;
      const bar = host.querySelector('lr-filter-bar') as LyraFilterBar;
      const status = host.querySelector('.status') as HTMLElement;
      status.textContent = bar.reportValidity() ? `Valid — ${JSON.stringify(bar.value)}` : 'Invalid — see the Status field above';
    };
    return html`
      <div class="demo" style="max-width: 48rem; display: flex; flex-direction: column; gap: 1rem">
        <lr-filter-bar .filters=${filters}></lr-filter-bar>
        <button type="button" @click=${onRun}>Apply</button>
        <p class="status" style="font-size: 0.875rem"></p>
      </div>
    `;
  },
};

/** `loading` shows the status spinner and disables the reset button, but filter controls stay
 *  interactive so a user can keep refining while a previous query is still in flight. */
export const Loading: Story = {
  render: () => html`
    <lr-filter-bar
      style="max-width: 48rem"
      loading
      .filters=${dashboardFilters}
      .value=${{ status: 'open' }}
    ></lr-filter-bar>
  `,
};

/** A filter with its own `defaultValue` restores to that value on reset instead of clearing to
 *  unset -- here `status` always resets back to "Open" while `owners` clears entirely. */
export const ResetWithDefaults: Story = {
  render: () => {
    const filters: FilterBarFilterDefinition[] = [
      { ...dashboardFilters[0], defaultValue: 'open' },
      dashboardFilters[1],
    ];
    return html`
      <lr-filter-bar
        style="max-width: 48rem"
        .filters=${filters}
        .value=${{ status: 'closed', owners: ['alan'] }}
      ></lr-filter-bar>
    `;
  },
};

/** Live `lr-input`/`lr-validity-change`/`lr-reset` events, mirroring what a host would listen for
 *  to serialize `value` into a URL querystring on every change. */
export const LiveEvents: Story = {
  render: () => {
    const onEvent = (e: Event) => {
      const log = (e.target as HTMLElement).closest('.demo')!.querySelector('.log') as HTMLElement;
      log.textContent = `${e.type}: ${JSON.stringify((e as CustomEvent).detail)}`;
    };
    return html`
      <div class="demo" style="max-width: 50rem; display: flex; flex-direction: column; gap: 1rem">
        <lr-filter-bar
          .filters=${dashboardFilters}
          @lr-input=${onEvent}
          @lr-validity-change=${onEvent}
          @lr-reset=${onEvent}
        ></lr-filter-bar>
        <pre class="log" style="font-size: 0.75rem; white-space: pre-wrap; word-break: break-all"></pre>
      </div>
    `;
  },
};

/** A `'text'` filter composes `<lr-input>` for an open-ended query, so a search box and its
 *  sibling dropdowns live in one filter bar instead of being split across a separate toolbar.
 *  Its optional `debounce` (ms) commits once the user pauses rather than once per keystroke --
 *  the log below fires once per pause, which is the debounce a server-backed consumer would
 *  otherwise hand-roll. The query's own chip shows it verbatim (slashes included) and removing
 *  the chip clears the field. */
export const FreeTextSearch: Story = {
  render: () => {
    const filters: FilterBarFilterDefinition[] = [
      { id: 'q', label: 'Search', type: 'text', placeholder: 'Search logs (e.g. GET /api/v1)', debounce: 250 },
      {
        id: 'severity',
        label: 'Severity',
        type: 'select',
        placeholder: 'Any severity',
        options: [
          { value: 'error', label: 'Error' },
          { value: 'warn', label: 'Warning' },
          { value: 'info', label: 'Info' },
        ],
      },
      {
        id: 'kind',
        label: 'Type',
        type: 'select',
        placeholder: 'Any type',
        options: [
          { value: 'request', label: 'Request' },
          { value: 'job', label: 'Job' },
        ],
      },
      { id: 'period', label: 'Active period', type: 'date-range' },
    ];
    let commits = 0;
    const onInput = (e: Event) => {
      commits += 1;
      const log = (e.target as HTMLElement).closest('.demo')!.querySelector('.log') as HTMLElement;
      log.textContent = `commit #${commits}: ${JSON.stringify((e as CustomEvent).detail.value)}`;
    };
    return html`
      <div class="demo" style="max-width: 50rem; display: flex; flex-direction: column; gap: 1rem">
        <lr-filter-bar .filters=${filters} .value=${{ q: 'GET /api/v1' }} @lr-input=${onInput}></lr-filter-bar>
        <pre class="log" style="font-size: 0.75rem; white-space: pre-wrap; word-break: break-all"></pre>
      </div>
    `;
  },
};

/** A narrow (320px) allocation wraps the filter controls onto multiple lines instead of
 *  overflowing, matching this library's own narrow-panel/dialog responsive contract. */
export const NarrowAllocation: Story = {
  render: () => html`
    <lr-filter-bar
      style="max-width: 320px"
      .filters=${dashboardFilters}
      .value=${{ status: 'open' }}
    ></lr-filter-bar>
  `,
};

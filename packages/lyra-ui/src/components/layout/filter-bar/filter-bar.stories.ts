import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './filter-bar.js';
import '../../forms/checkbox/checkbox.js';
import '../../forms/time-range/time-range.js';
import type { ComboboxSource } from '../../forms/combobox/combobox.class.js';
import type {
  LyraFilterBar,
  LyraFilterBarCustomControlAdapter,
  LyraFilterBarFilterDefinition,
} from './filter-bar.js';

const meta: Meta = {
  title: 'FilterBar',
  component: 'lr-filter-bar',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Filter definitions and values are detached, deeply frozen, and bounded at assignment; Lit icon payloads retain rendering identity. Create and reassign a new array or record after changes, and consume complete frozen value snapshots from filter-bar events.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const dashboardFilters: LyraFilterBarFilterDefinition[] = [
  {
    filterId: 'status',
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
    filterId: 'owners',
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
  { filterId: 'created', label: 'Created', type: 'date' },
  { filterId: 'period', label: 'Active period', type: 'date-range' },
];

/** A filter bar with no filters set yet -- every control renders at its own empty default and
 *  the active-filter chip row and reset button stay hidden/disabled respectively. */
export const Default: Story = {
  render: () => html` <lr-filter-bar style="max-width: 48rem" .filters=${dashboardFilters}></lr-filter-bar> `,
};

/** A host `aria-label` names the internal group ahead of `label`. Presence is authoritative, so
 *  an explicitly empty attribute also suppresses the label fallback. */
export const AccessibleNamePrecedence: Story = {
  render: () => html`
    <div style="display:grid;gap:var(--lr-space-l);max-inline-size:48rem">
      <lr-filter-bar
        label="Report filters"
        aria-label="Author filters"
        .filters=${dashboardFilters}
      ></lr-filter-bar>
      <lr-filter-bar
        label="Suppressed fallback"
        aria-label=""
        .filters=${dashboardFilters}
      ></lr-filter-bar>
    </div>
  `,
};

/** Semantic forwarded parts theme the same field/input tier across every built-in filter type. */
export const ForwardedControlParts: Story = {
  render: () => html`
    <div class="forwarded-control-parts" style="max-inline-size:48rem;">
      <style>
        .forwarded-control-parts lr-filter-bar::part(filter-control-field) {
          outline: var(--lr-border-width-thick) solid var(--lr-color-brand);
          outline-offset: var(--lr-border-width-thin);
        }
        .forwarded-control-parts lr-filter-bar::part(filter-control-input) {
          color: var(--lr-color-brand);
        }
      </style>
      <lr-filter-bar .filters=${dashboardFilters}></lr-filter-bar>
    </div>
  `,
};

/** A prefilled `value` renders each control's current selection and a matching row of removable
 *  active-filter chips. Removing a chip clears just that filter. The reset action uses the same
 *  default `m` height tier as the adjacent built-in fields. */
export const WithActiveFilters: Story = {
  render: () => html`
    <lr-filter-bar
      style="max-width: 48rem"
      .filters=${dashboardFilters}
      .value=${{ status: 'open', owners: ['ada', 'grace'], period: '2026-01-01/2026-01-31' }}
    ></lr-filter-bar>
  `,
};

/** Invalid provider-supplied ISO dates stay verbatim in active chips instead of silently rolling
 * into another month/year; the valid year 0099 retains its literal early-year meaning. */
export const StrictDateChipFormatting: Story = {
  render: () => html`
    <lr-filter-bar
      style="max-width: 48rem"
      .filters=${dashboardFilters}
      .value=${{ created: '2026-02-31', period: '0099-01-01/0099-01-31' }}
    ></lr-filter-bar>
  `,
};

/** `required: true` on a filter definition surfaces that composed control's own inline error
 *  once it's touched (or `reportValidity()` is called) -- see the "search" filter here. */
export const RequiredFilter: Story = {
  render: () => {
    const filters: LyraFilterBarFilterDefinition[] = [
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

/** Foreign/untyped built-in values are normalized before state, validity, reset, or chips use
 * them. In particular, boolean `false` is the canonical empty built-in value rather than a blank
 * active chip; custom boolean controls define emptiness through their own adapter below. */
export const ForeignFalseBuiltInValue: Story = {
  name: 'Foreign false built-in value (normalized empty)',
  parameters: {
    docs: {
      description: {
        story:
          'The host supplies `false` for the required select through an untyped boundary. It is omitted as empty, so no blank active chip appears and required validity remains unsatisfied.',
      },
    },
  },
  render: () => html`
    <lr-filter-bar
      style="max-width: 48rem"
      .filters=${[{ ...dashboardFilters[0], required: true }]}
      .value=${{ status: false }}
    ></lr-filter-bar>
  `,
};

/** A filter with its own `defaultValue` restores to that value on reset instead of clearing to
 *  unset -- here `status` always resets back to "Open" while `owners` clears entirely. */
export const ResetWithDefaults: Story = {
  render: () => {
    const filters: LyraFilterBarFilterDefinition[] = [
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
 *  to serialize `value` into a URL querystring on every change. Each edit produces one bar-owned
 *  `lr-input`; child-control `lr-input`/`lr-change` aliases stay inside the wrapper. */
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
    const filters: LyraFilterBarFilterDefinition[] = [
      { filterId: 'q', label: 'Search', type: 'text', placeholder: 'Search logs (e.g. GET /api/v1)', debounce: 250 },
      {
        filterId: 'severity',
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
        filterId: 'kind',
        label: 'Type',
        type: 'select',
        placeholder: 'Any type',
        options: [
          { value: 'request', label: 'Request' },
          { value: 'job', label: 'Job' },
        ],
      },
      { filterId: 'period', label: 'Active period', type: 'date-range' },
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

/** Custom renderers let an existing Lyra control join the filter bar's value, active-chip,
 * reset, disabled, and validation contract. This example uses a two-handle time brush, a native
 * checkbox, and an async-backed combobox source without adding any control-specific branches to
 * `<lr-filter-bar>`. */
export const CustomControls: Story = {
  render: () => {
    const checkboxAdapter: LyraFilterBarCustomControlAdapter = {
      valueFromEvent: (event) =>
        (event as CustomEvent<{ checked: boolean }>).detail.checked,
      clearValue: false,
      formatValue: (value) => (value === true ? 'Enabled' : 'Disabled'),
    };
    const rangeAdapter: LyraFilterBarCustomControlAdapter = {
      valueFromEvent: (event) => {
        const { start, end } = (event as CustomEvent<{ start: number; end: number }>).detail;
        return `${start}/${end}`;
      },
      clearValue: '',
      formatValue: (value) => (typeof value === 'string' ? value : ''),
    };
    const ownerSource: ComboboxSource = async (query) => {
      const owners = [
        { value: 'ada', label: 'Ada Lovelace' },
        { value: 'grace', label: 'Grace Hopper' },
        { value: 'alan', label: 'Alan Turing' },
      ];
      return owners.filter((owner) => owner.label.toLowerCase().includes(query.toLowerCase()));
    };
    const filters: LyraFilterBarFilterDefinition[] = [
      {
        filterId: 'window',
        label: 'Time window',
        type: 'custom',
        custom: {
          adapter: rangeAdapter,
          render: (context) => {
            const [start, end] =
              typeof context.value === 'string' && context.value.includes('/')
                ? context.value.split('/').map(Number)
                : [20, 80];
            return html`
              <lr-time-range
                aria-label=${context.label}
                min="0"
                max="100"
                .start=${Number.isFinite(start) ? start : 20}
                .end=${Number.isFinite(end) ? end : 80}
                ?disabled=${context.disabled}
                @lr-change=${context.onChange}
                @focusout=${context.onFocusout}
              ></lr-time-range>
            `;
          },
        },
      },
      {
        filterId: 'archived',
        label: 'Include archived',
        type: 'custom',
        custom: {
          adapter: checkboxAdapter,
          render: (context) => html`
            <lr-checkbox
              .checked=${context.value === true}
              ?disabled=${context.disabled}
              ?required=${context.required}
              .errorText=${context.errorText}
              @lr-change=${context.onValueChange}
              @focusout=${context.onFocusout}
            >${context.label}</lr-checkbox>
          `,
        },
      },
      {
        filterId: 'owner',
        label: 'Owner',
        type: 'custom',
        custom: {
          adapter: {
            valueFromEvent: (event) =>
              (event.target as HTMLElement & { value: string }).value,
            clearValue: '',
          },
          render: (context) => html`
            <lr-combobox
              .label=${context.label}
              .source=${ownerSource}
              .value=${typeof context.value === 'string' ? context.value : ''}
              ?disabled=${context.disabled}
              @change=${context.onChange}
              @focusout=${context.onFocusout}
            ></lr-combobox>
          `,
        },
      },
    ];
    return html`
      <lr-filter-bar
        style="max-width: 58rem"
        label="Dashboard filters"
        .filters=${filters}
        .value=${{ window: '20/80', archived: true }}
      ></lr-filter-bar>
    `;
  },
};

/** A narrow (320px) RTL allocation wraps the filter controls onto multiple lines and contains an
 *  unbroken localized active-chip value, matching this library's narrow-panel/dialog contract. */
export const NarrowAllocation: Story = {
  render: () => {
    const filters: LyraFilterBarFilterDefinition[] = [
      {
        filterId: 'status',
        label: 'الحالة',
        type: 'select',
        options: [
          { value: 'open', label: 'قيمةحالةمحليةطويلةجداًبدونأيفرصةللفصلأوالالتفافالتلقائي' },
        ],
      },
      ...dashboardFilters.slice(1),
    ];
    return html`
      <div dir="rtl" style="inline-size: 320px; max-inline-size: 100%;">
        <lr-filter-bar style="inline-size: 100%;" .filters=${filters} .value=${{ status: 'open' }}></lr-filter-bar>
      </div>
    `;
  },
};

/** An option can carry an optional `icon`: arbitrary Lit content rendered into the composed
 *  `<lr-option>`'s own `start` slot as inert, `aria-hidden` chrome. It is a visual cue only — the
 *  option's accessible name stays its `label`. */
export const OptionIcons: Story = {
  render: () => {
    const dot = (color: string) => html`<span
      style="display:inline-block;inline-size:var(--lr-space-s);block-size:var(--lr-space-s);border-radius:var(--lr-radius-pill);background:${color}"
    ></span>`;
    const filters: LyraFilterBarFilterDefinition[] = [
      {
        filterId: 'status',
        label: 'Status',
        type: 'select',
        placeholder: 'Any status',
        options: [
          { value: 'open', label: 'Open', icon: dot('var(--lr-color-success)') },
          { value: 'in-progress', label: 'In progress', icon: dot('var(--lr-color-warning)') },
          { value: 'closed', label: 'Closed', icon: dot('var(--lr-color-text-quiet)') },
        ],
      },
      {
        filterId: 'owner',
        label: 'Owner',
        type: 'combobox',
        placeholder: 'Any owner',
        options: [
          { value: 'ada', label: 'Ada Lovelace', icon: dot('var(--lr-color-brand)') },
          { value: 'grace', label: 'Grace Hopper', icon: dot('var(--lr-color-brand)') },
        ],
      },
    ];
    return html`<lr-filter-bar style="max-width: 48rem" .filters=${filters}></lr-filter-bar>`;
  },
};

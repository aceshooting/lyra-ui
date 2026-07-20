import { fixture, expect, html, oneEvent, aTimeout } from '@open-wc/testing';
import './filter-bar.js';
import type { LyraFilterBar, FilterBarFilterDefinition, FilterBarInputDetail } from './filter-bar.js';

const basicFilters: FilterBarFilterDefinition[] = [
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed' },
    ],
    required: true,
  },
  {
    id: 'tags',
    label: 'Tags',
    type: 'combobox',
    multiple: true,
    options: [
      { value: 'urgent', label: 'Urgent' },
      { value: 'billing', label: 'Billing' },
    ],
  },
  { id: 'created', label: 'Created', type: 'date' },
  { id: 'range', label: 'Active period', type: 'date-range' },
];

function control(el: LyraFilterBar, id: string): HTMLElement {
  return el.shadowRoot!.querySelector(`[data-filter-id="${id}"]`) as HTMLElement;
}

/** The native `<input>` inside a `'text'` filter's composed `<lr-input>`. */
async function nativeInput(el: LyraFilterBar, id: string): Promise<HTMLInputElement> {
  const composed = control(el, id) as HTMLElement & { updateComplete: Promise<unknown> };
  await composed.updateComplete;
  return composed.shadowRoot!.querySelector('input') as HTMLInputElement;
}

/** Simulates a user keystroke in a `'text'` filter, driving the real `<lr-input>` input path. */
async function typeInto(el: LyraFilterBar, id: string, text: string): Promise<HTMLInputElement> {
  const native = await nativeInput(el, id);
  native.value = text;
  native.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  return native;
}

it('renders one composed control per filter, matched to its declared type', async () => {
  const el = (await fixture(html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`)) as LyraFilterBar;
  expect(control(el, 'status').localName).to.equal('lr-select');
  expect(control(el, 'status').querySelectorAll('lr-option').length).to.equal(2);
  expect(control(el, 'tags').localName).to.equal('lr-combobox');
  expect((control(el, 'tags') as HTMLElement & { multiple: boolean }).multiple).to.be.true;
  expect(control(el, 'created').localName).to.equal('lr-date-input');
  expect((control(el, 'created') as HTMLElement & { mode: string }).mode).to.equal('single');
  expect(control(el, 'range').localName).to.equal('lr-date-input');
  expect((control(el, 'range') as HTMLElement & { mode: string }).mode).to.equal('range');
});

it('forwards each filter definition\'s label to its composed control\'s own label prop', async () => {
  const el = (await fixture(html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`)) as LyraFilterBar;
  expect((control(el, 'status') as HTMLElement & { label: string }).label).to.equal('Status');
  expect((control(el, 'tags') as HTMLElement & { label: string }).label).to.equal('Tags');
});

it('treats a null/undefined filters or value as empty rather than throwing', async () => {
  const el = (await fixture(html`<lr-filter-bar></lr-filter-bar>`)) as LyraFilterBar;
  expect(el.filters).to.deep.equal([]);
  expect(el.value).to.deep.equal({});
  el.filters = null as unknown as FilterBarFilterDefinition[];
  el.value = null as unknown as Record<string, unknown>;
  await el.updateComplete;
  expect(el.filters).to.deep.equal([]);
  expect(el.value).to.deep.equal({});
});

describe('value getter/setter (URL/state serialization contract)', () => {
  it('round-trips a plain object through value, independent of any prior state', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`)) as LyraFilterBar;
    el.value = { status: 'open', tags: ['urgent', 'billing'] };
    await el.updateComplete;
    expect(el.value).to.deep.equal({ status: 'open', tags: ['urgent', 'billing'] });
    expect((control(el, 'status') as HTMLElement & { value: string }).value).to.equal('open');
    expect((control(el, 'tags') as HTMLElement & { value: string[] }).value).to.deep.equal(['urgent', 'billing']);
  });

  it('returns a fresh copy from the value getter so external mutation cannot corrupt internal state', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`)) as LyraFilterBar;
    el.value = { status: 'open' };
    const snapshot = el.value;
    snapshot.status = 'closed';
    expect(el.value.status).to.equal('open');
  });
});

describe('lr-input (filter edits)', () => {
  it('emits lr-input with the full value object and the changed filterId on a select commit', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`)) as LyraFilterBar;
    const select = control(el, 'status') as HTMLElement & { value: string };

    const promise = oneEvent(el, 'lr-input');
    select.value = 'open';
    select.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    const ev = (await promise) as CustomEvent<FilterBarInputDetail>;
    expect(ev.detail.filterId).to.equal('status');
    expect(ev.detail.value).to.deep.equal({ status: 'open' });
    expect(el.value).to.deep.equal({ status: 'open' });
  });

  it('emits lr-input with a string array for a multiple combobox commit', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`)) as LyraFilterBar;
    const combo = control(el, 'tags') as HTMLElement & { value: string[] };

    const promise = oneEvent(el, 'lr-input');
    combo.value = ['urgent'];
    combo.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    const ev = (await promise) as CustomEvent<FilterBarInputDetail>;
    expect(ev.detail.filterId).to.equal('tags');
    expect(ev.detail.value.tags).to.deep.equal(['urgent']);
  });

  it('emits lr-input on a committed date-range change, carrying the ISO range string', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`)) as LyraFilterBar;
    const dateRange = control(el, 'range') as HTMLElement & { value: string };

    const promise = oneEvent(el, 'lr-input');
    dateRange.value = '2026-01-01/2026-01-31';
    dateRange.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    const ev = (await promise) as CustomEvent<FilterBarInputDetail>;
    expect(ev.detail.value.range).to.equal('2026-01-01/2026-01-31');
  });

  it('never mutates value or emits while disabled, even from a directly-dispatched control change', async () => {
    const el = (await fixture(
      html`<lr-filter-bar disabled .filters=${basicFilters}></lr-filter-bar>`,
    )) as LyraFilterBar;
    const select = control(el, 'status') as HTMLElement & { value: string };
    let fired = false;
    el.addEventListener('lr-input', () => (fired = true));

    select.value = 'open';
    select.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await el.updateComplete;

    expect(fired).to.be.false;
    expect(el.value).to.deep.equal({});
  });
});

describe('active-filter chips', () => {
  it('renders no chip row and no active-filters group while nothing is set', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`)) as LyraFilterBar;
    expect(el.shadowRoot!.querySelector('[part="active-filters"]')).to.not.exist;
    expect(el.hasActiveFilters).to.be.false;
  });

  it('renders one removable chip per active filter, labeled "<label>: <display>"', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`)) as LyraFilterBar;
    el.value = { status: 'open', tags: ['urgent', 'billing'] };
    await el.updateComplete;

    const chips = Array.from(el.shadowRoot!.querySelectorAll('[part="chip"]')) as HTMLElement[];
    expect(chips.length).to.equal(2);
    expect(chips[0].textContent!.trim()).to.equal('Status: Open');
    expect(chips[1].textContent!.trim()).to.equal('Tags: Urgent, Billing');
    expect(chips.every((c) => c.hasAttribute('removable'))).to.be.true;
    expect(el.hasActiveFilters).to.be.true;
  });

  it('falls back to the raw value for a chip whose value no longer matches a known option', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`)) as LyraFilterBar;
    el.value = { status: 'archived' };
    await el.updateComplete;
    const chip = el.shadowRoot!.querySelector('[part="chip"]') as HTMLElement;
    expect(chip.textContent!.trim()).to.equal('Status: archived');
  });

  it('shows a date/date-range chip using the raw ISO value(s), with the range separator swapped for an en dash', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`)) as LyraFilterBar;
    el.value = { created: '2026-02-01', range: '2026-01-01/2026-01-31' };
    await el.updateComplete;
    const chips = Array.from(el.shadowRoot!.querySelectorAll('[part="chip"]')) as HTMLElement[];
    expect(chips.map((c) => c.textContent!.trim())).to.deep.equal([
      'Created: 2026-02-01',
      'Active period: 2026-01-01 – 2026-01-31',
    ]);
  });

  it('clears just the removed filter on lr-remove, leaving the others untouched, and emits lr-input', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`)) as LyraFilterBar;
    el.value = { status: 'open', created: '2026-02-01' };
    await el.updateComplete;

    const statusChip = el.shadowRoot!.querySelectorAll('[part="chip"]')[0] as HTMLElement;
    const promise = oneEvent(el, 'lr-input');
    statusChip.dispatchEvent(new CustomEvent('lr-remove', { bubbles: true, composed: true, detail: { value: 'status' } }));
    const ev = (await promise) as CustomEvent<FilterBarInputDetail>;
    expect(ev.detail.filterId).to.equal('status');
    expect(el.value).to.deep.equal({ status: '', created: '2026-02-01' });
  });

  it('clears a multiple combobox filter to an empty array (not an empty string) when its chip is removed', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`)) as LyraFilterBar;
    el.value = { tags: ['urgent'] };
    await el.updateComplete;

    const chip = el.shadowRoot!.querySelector('[part="chip"]') as HTMLElement;
    chip.dispatchEvent(new CustomEvent('lr-remove', { bubbles: true, composed: true, detail: {} }));
    await el.updateComplete;
    expect(el.value.tags).to.deep.equal([]);
  });
});

describe('reset()', () => {
  it('disables the reset button until a filter becomes active, and while loading/disabled', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`)) as LyraFilterBar;
    const resetButton = el.shadowRoot!.querySelector('[part="reset-button"]') as HTMLElement & { disabled: boolean };
    expect(resetButton.disabled).to.be.true;

    el.value = { status: 'open' };
    await el.updateComplete;
    expect(resetButton.disabled).to.be.false;

    el.loading = true;
    await el.updateComplete;
    expect(resetButton.disabled).to.be.true;
    el.loading = false;

    el.disabled = true;
    await el.updateComplete;
    expect(resetButton.disabled).to.be.true;
  });

  it('restores every filter to its own defaultValue (or unset), clears touched state, and emits lr-input then lr-reset', async () => {
    const filtersWithDefault: FilterBarFilterDefinition[] = [
      { ...basicFilters[0], defaultValue: 'open' },
      basicFilters[1],
    ];
    const el = (await fixture(
      html`<lr-filter-bar .filters=${filtersWithDefault}></lr-filter-bar>`,
    )) as LyraFilterBar;
    el.value = { status: 'closed', tags: ['urgent'] };
    await el.updateComplete;

    const events: string[] = [];
    el.addEventListener('lr-input', () => events.push('lr-input'));
    el.addEventListener('lr-reset', () => events.push('lr-reset'));
    const resetPromise = oneEvent(el, 'lr-reset');
    el.reset();
    const resetEvent = await resetPromise;
    expect(events).to.deep.equal(['lr-input', 'lr-reset']);
    expect(resetEvent.detail.value).to.deep.equal({ status: 'open' });
    expect(el.value).to.deep.equal({ status: 'open' });
  });

  it('is a no-op while disabled', async () => {
    const el = (await fixture(
      html`<lr-filter-bar disabled .filters=${basicFilters}></lr-filter-bar>`,
    )) as LyraFilterBar;
    el.value = { status: 'open' };
    let fired = false;
    el.addEventListener('lr-reset', () => (fired = true));
    el.reset();
    expect(fired).to.be.false;
    expect(el.value).to.deep.equal({ status: 'open' });
  });
});

describe('loading', () => {
  it('renders the status spinner only while loading', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`)) as LyraFilterBar;
    expect(el.shadowRoot!.querySelector('[part="status"]')).to.not.exist;
    el.loading = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="status"]')!.localName).to.equal('lr-spinner');
  });

  it('leaves filter controls interactive while loading', async () => {
    const el = (await fixture(
      html`<lr-filter-bar loading .filters=${basicFilters}></lr-filter-bar>`,
    )) as LyraFilterBar;
    expect((control(el, 'status') as HTMLElement & { disabled: boolean }).disabled).to.be.false;
  });
});

describe('disabled', () => {
  it('disables every composed control and the reset button', async () => {
    const el = (await fixture(
      html`<lr-filter-bar disabled .filters=${basicFilters}></lr-filter-bar>`,
    )) as LyraFilterBar;
    expect((control(el, 'status') as HTMLElement & { disabled: boolean }).disabled).to.be.true;
    expect((control(el, 'tags') as HTMLElement & { disabled: boolean }).disabled).to.be.true;
    expect((control(el, 'created') as HTMLElement & { disabled: boolean }).disabled).to.be.true;
    const resetButton = el.shadowRoot!.querySelector('[part="reset-button"]') as HTMLElement & { disabled: boolean };
    expect(resetButton.disabled).to.be.true;
  });

  it('renders active-filter chips with no remove affordance, instead of a clickable-but-inert one', async () => {
    const el = (await fixture(
      html`<lr-filter-bar disabled .filters=${basicFilters} .value=${{ status: 'open' }}></lr-filter-bar>`,
    )) as LyraFilterBar;
    const chip = el.shadowRoot!.querySelector('[part="chip"]') as HTMLElement & {
      removable: boolean;
      updateComplete: Promise<unknown>;
    };
    expect(chip).to.not.equal(null);
    expect(chip.removable).to.be.false;
    expect(chip.hasAttribute('removable')).to.be.false;
    await chip.updateComplete;
    expect(chip.shadowRoot!.querySelector('[part="remove-button"]')).to.equal(null);
  });
});

describe('validation contract', () => {
  it('reports invalidFilterIds/checkValidity from required-but-unset filters, live (not cached)', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`)) as LyraFilterBar;
    expect(el.invalidFilterIds).to.deep.equal(['status']);
    expect(el.checkValidity()).to.be.false;

    el.value = { status: 'open' };
    expect(el.invalidFilterIds).to.deep.equal([]);
    expect(el.checkValidity()).to.be.true;
  });

  it('does not reveal an inline error on the composed control until it is touched (focusout)', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`)) as LyraFilterBar;
    expect((control(el, 'status') as HTMLElement & { errorText: string }).errorText).to.equal('');

    control(el, 'status').dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect((control(el, 'status') as HTMLElement & { errorText: string }).errorText).to.equal(
      'This field is required.',
    );
  });

  it('reportValidity() reveals the inline error immediately and returns overall validity', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`)) as LyraFilterBar;
    expect(el.reportValidity()).to.be.false;
    await el.updateComplete;
    expect((control(el, 'status') as HTMLElement & { errorText: string }).errorText).to.equal(
      'This field is required.',
    );

    el.value = { status: 'open' };
    expect(el.reportValidity()).to.be.true;
  });

  it('emits lr-validity-change whenever the computed valid/invalidFilterIds actually changes, and not on a no-op edit', async () => {
    const el = document.createElement('lr-filter-bar') as LyraFilterBar;
    el.filters = basicFilters;
    const mountPromise = oneEvent(el, 'lr-validity-change');
    document.body.appendChild(el);
    const mountEvent = await mountPromise;
    expect(mountEvent.detail.valid).to.be.false;
    expect(mountEvent.detail.invalidFilterIds).to.deep.equal(['status']);

    const promise = oneEvent(el, 'lr-validity-change');
    el.value = { status: 'open' };
    const ev = await promise;
    expect(ev.detail.valid).to.be.true;
    expect(ev.detail.invalidFilterIds).to.deep.equal([]);

    let fired = false;
    el.addEventListener('lr-validity-change', () => (fired = true));
    el.value = { status: 'open', created: '2026-01-01' };
    await el.updateComplete;
    expect(fired, 'validity did not actually change, so the event must not re-fire').to.be.false;

    el.remove();
  });
});

describe('localization', () => {
  it('defaults the reset button and active-filters group label to English with no strings override', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`)) as LyraFilterBar;
    const resetButton = el.shadowRoot!.querySelector('[part="reset-button"]') as HTMLElement;
    expect(resetButton.textContent!.trim()).to.equal('Reset filters');

    el.value = { status: 'open' };
    await el.updateComplete;
    const group = el.shadowRoot!.querySelector('[part="active-filters"]') as HTMLElement;
    expect(group.getAttribute('aria-label')).to.equal('Active filters');
  });

  it('honors .strings overrides for filterBarReset/filterBarActiveFilters', async () => {
    const el = (await fixture(
      html`<lr-filter-bar
        .filters=${basicFilters}
        .strings=${{ filterBarReset: 'Réinitialiser', filterBarActiveFilters: 'Filtres actifs' }}
      ></lr-filter-bar>`,
    )) as LyraFilterBar;
    const resetButton = el.shadowRoot!.querySelector('[part="reset-button"]') as HTMLElement;
    expect(resetButton.textContent!.trim()).to.equal('Réinitialiser');

    el.value = { status: 'open' };
    await el.updateComplete;
    const group = el.shadowRoot!.querySelector('[part="active-filters"]') as HTMLElement;
    expect(group.getAttribute('aria-label')).to.equal('Filtres actifs');
  });

  it('reuses the shared fieldRequired key for its own required-error text, honoring its .strings override', async () => {
    const el = (await fixture(
      html`<lr-filter-bar
        .filters=${basicFilters}
        .strings=${{ fieldRequired: 'Ce champ est requis.' }}
      ></lr-filter-bar>`,
    )) as LyraFilterBar;
    el.reportValidity();
    await el.updateComplete;
    expect((control(el, 'status') as HTMLElement & { errorText: string }).errorText).to.equal('Ce champ est requis.');
  });
});

describe('label forwarding', () => {
  it('prefers the label prop over a forwarded host aria-label, matching <lr-control-group>', async () => {
    const el = (await fixture(
      html`<lr-filter-bar label="Report filters" aria-label="Ignored" .filters=${basicFilters}></lr-filter-bar>`,
    )) as LyraFilterBar;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-label')).to.equal('Report filters');
  });

  it('falls back to a forwarded host aria-label when label is unset', async () => {
    const el = (await fixture(
      html`<lr-filter-bar aria-label="Dashboard filters" .filters=${basicFilters}></lr-filter-bar>`,
    )) as LyraFilterBar;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-label')).to.equal('Dashboard filters');
  });
});

describe('RTL and narrow-allocation layout', () => {
  it('renders correctly under dir="rtl" without throwing, and the controls row still reports :dir(rtl)', async () => {
    const el = (await fixture(
      html`<lr-filter-bar dir="rtl" .filters=${basicFilters}></lr-filter-bar>`,
    )) as LyraFilterBar;
    await el.updateComplete;
    const controlsRow = el.shadowRoot!.querySelector('[part="controls"]') as HTMLElement;
    expect(controlsRow.matches(':dir(rtl)')).to.be.true;
    expect(el.shadowRoot!.querySelectorAll('[part="filter-control"]').length).to.equal(basicFilters.length);
  });

  it('wraps onto multiple lines instead of overflowing a 320px allocation', async () => {
    const el = (await fixture(
      html`<lr-filter-bar style="inline-size: 320px" .filters=${basicFilters}></lr-filter-bar>`,
    )) as LyraFilterBar;
    const controlsRow = el.shadowRoot!.querySelector('[part="controls"]') as HTMLElement;
    expect(getComputedStyle(controlsRow).flexWrap).to.equal('wrap');
  });
});

describe("'text' free-text filters", () => {
  const textFilters: FilterBarFilterDefinition[] = [
    { id: 'q', label: 'Search', type: 'text', placeholder: 'Search logs' },
    {
      id: 'severity',
      label: 'Severity',
      type: 'select',
      options: [
        { value: 'error', label: 'Error' },
        { value: 'warn', label: 'Warning' },
      ],
    },
  ];
  const debouncedFilters: FilterBarFilterDefinition[] = [
    { id: 'q', label: 'Search', type: 'text', placeholder: 'Search logs', debounce: 60 },
    textFilters[1],
  ];

  it('composes an lr-input for a text filter, forwarding label/placeholder to its own chrome', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${textFilters}></lr-filter-bar>`)) as LyraFilterBar;
    const composed = control(el, 'q') as HTMLElement & { label: string; placeholder: string };
    expect(composed.localName).to.equal('lr-input');
    expect(composed.label).to.equal('Search');
    expect(composed.placeholder).to.equal('Search logs');
    // No duplicate chrome: the label/hint/error belong to <lr-input>, never re-rendered here.
    expect(el.shadowRoot!.querySelector('label')).to.not.exist;
    const native = await nativeInput(el, 'q');
    expect(native.type).to.equal('text');
  });

  it('emits lr-input with the typed value and the changed filterId, with no debounce declared', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${textFilters}></lr-filter-bar>`)) as LyraFilterBar;
    const promise = oneEvent(el, 'lr-input');
    await typeInto(el, 'q', 'timeout');
    const ev = (await promise) as CustomEvent<FilterBarInputDetail>;
    expect(ev.detail.filterId).to.equal('q');
    expect(ev.detail.value).to.deep.equal({ q: 'timeout' });
    expect(el.value).to.deep.equal({ q: 'timeout' });
  });

  it("never leaks the composed lr-input's own lr-input/lr-change events as this component's", async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${textFilters}></lr-filter-bar>`)) as LyraFilterBar;
    const details: unknown[] = [];
    el.addEventListener('lr-input', (e) => details.push((e as CustomEvent).detail));
    let changes = 0;
    el.addEventListener('lr-change', () => (changes += 1));

    const native = await typeInto(el, 'q', 'abc');
    native.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await el.updateComplete;

    expect(details.length, 'exactly one lr-input, carrying this component\'s own detail shape').to.equal(1);
    expect((details[0] as FilterBarInputDetail).value).to.deep.equal({ q: 'abc' });
    expect(changes, "the inner control's lr-change must not escape this shadow root").to.equal(0);
  });

  it('debounces rapid keystrokes into a single lr-input carrying the final value', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${debouncedFilters}></lr-filter-bar>`)) as LyraFilterBar;
    const values: string[] = [];
    el.addEventListener('lr-input', (e) => values.push(String((e as CustomEvent<FilterBarInputDetail>).detail.value.q)));

    await typeInto(el, 'q', 't');
    await typeInto(el, 'q', 'ti');
    await typeInto(el, 'q', 'tim');
    expect(values, 'nothing is emitted while the debounce is still in flight').to.deep.equal([]);
    expect(el.value).to.deep.equal({});

    await aTimeout(300);
    expect(values).to.deep.equal(['tim']);
    expect(el.value).to.deep.equal({ q: 'tim' });
  });

  it('flushes a pending debounce on the control\'s own change (Enter/blur commit)', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${debouncedFilters}></lr-filter-bar>`)) as LyraFilterBar;
    const native = await typeInto(el, 'q', 'flush');
    const promise = oneEvent(el, 'lr-input');
    native.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    const ev = (await promise) as CustomEvent<FilterBarInputDetail>;
    expect(ev.detail.value).to.deep.equal({ q: 'flush' });
  });

  it('shows the query verbatim in its chip, never mangling a slash into an en dash', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${textFilters}></lr-filter-bar>`)) as LyraFilterBar;
    el.value = { q: 'GET /api/v1' };
    await el.updateComplete;
    const chip = el.shadowRoot!.querySelector('[part="chip"]') as HTMLElement;
    expect(chip.textContent!.trim()).to.equal('Search: GET /api/v1');
  });

  it('mirrors an external value write into the composed input', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${textFilters}></lr-filter-bar>`)) as LyraFilterBar;
    el.value = { q: 'from-the-url' };
    await el.updateComplete;
    expect((control(el, 'q') as HTMLElement & { value: string }).value).to.equal('from-the-url');
    const native = await nativeInput(el, 'q');
    expect(native.value).to.equal('from-the-url');
  });

  it('cancels a pending debounce on reset(), so the stale keystroke never overwrites the reset', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${debouncedFilters}></lr-filter-bar>`)) as LyraFilterBar;
    el.value = { q: 'seed' };
    await el.updateComplete;

    let inputs = 0;
    el.addEventListener('lr-input', () => (inputs += 1));
    await typeInto(el, 'q', 'draft');
    el.reset();
    await aTimeout(300);

    expect(el.value).to.deep.equal({});
    expect(inputs, 'only the reset itself emitted').to.equal(1);
    const native = await nativeInput(el, 'q');
    expect(native.value, 'the cancelled draft is synced back out of the field').to.equal('');
  });

  it('cancels a pending debounce when its chip is removed', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${debouncedFilters}></lr-filter-bar>`)) as LyraFilterBar;
    el.value = { q: 'seed' };
    await el.updateComplete;

    let inputs = 0;
    el.addEventListener('lr-input', () => (inputs += 1));
    await typeInto(el, 'q', 'draft');
    const chip = el.shadowRoot!.querySelector('[part="chip"]') as HTMLElement;
    chip.dispatchEvent(new CustomEvent('lr-remove', { bubbles: true, composed: true, detail: {} }));
    await aTimeout(300);

    expect(el.value).to.deep.equal({ q: '' });
    expect(inputs, 'only the chip removal itself emitted').to.equal(1);
    const native = await nativeInput(el, 'q');
    expect(native.value).to.equal('');
  });

  it('cancels a pending debounce on disconnect, so a detached bar never emits after teardown', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${debouncedFilters}></lr-filter-bar>`)) as LyraFilterBar;
    let fired = false;
    el.addEventListener('lr-input', () => (fired = true));
    await typeInto(el, 'q', 'detached');
    el.remove();
    await aTimeout(300);
    expect(fired).to.be.false;
    expect(el.value).to.deep.equal({});
  });

  it('keeps the caret and the typed text across a re-render triggered mid-typing', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${debouncedFilters}></lr-filter-bar>`)) as LyraFilterBar;
    const native = await typeInto(el, 'q', 'abcdef');
    native.setSelectionRange(3, 3);

    // Any unrelated state change re-renders the whole bar while the debounce is still pending;
    // a controlled `.value=` binding would push the stale (empty) model value back into the field.
    el.loading = true;
    await el.updateComplete;
    await (control(el, 'q') as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
    expect(native.value).to.equal('abcdef');
    expect(native.selectionStart).to.equal(3);

    // …and the commit itself, which re-renders again, must not disturb it either.
    await aTimeout(300);
    await el.updateComplete;
    await (control(el, 'q') as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
    expect(el.value).to.deep.equal({ q: 'abcdef' });
    expect(native.value).to.equal('abcdef');
    expect(native.selectionStart).to.equal(3);
  });

  it('reveals a required text filter\'s error on blur, not per keystroke, and flushes first', async () => {
    const requiredText: FilterBarFilterDefinition[] = [
      { id: 'q', label: 'Search', type: 'text', required: true, debounce: 400 },
    ];
    const el = (await fixture(html`<lr-filter-bar .filters=${requiredText}></lr-filter-bar>`)) as LyraFilterBar;
    const composed = control(el, 'q') as HTMLElement & { errorText: string };
    expect(composed.errorText).to.equal('');

    await typeInto(el, 'q', 'hello');
    await el.updateComplete;
    expect(composed.errorText, 'an in-flight debounce must not flash a required error').to.equal('');

    control(el, 'q').dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.value, 'blur flushes the pending debounce').to.deep.equal({ q: 'hello' });
    expect(composed.errorText, 'the flushed value satisfies required, so no error is revealed').to.equal('');
  });

  it('still reveals the required error on blur when the text filter is genuinely empty', async () => {
    const requiredText: FilterBarFilterDefinition[] = [
      { id: 'q', label: 'Search', type: 'text', required: true, debounce: 60 },
    ];
    const el = (await fixture(html`<lr-filter-bar .filters=${requiredText}></lr-filter-bar>`)) as LyraFilterBar;
    control(el, 'q').dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect((control(el, 'q') as HTMLElement & { errorText: string }).errorText).to.equal('This field is required.');
    expect(el.invalidFilterIds).to.deep.equal(['q']);
  });

  it('disables the composed text input along with every other control', async () => {
    const el = (await fixture(
      html`<lr-filter-bar disabled .filters=${textFilters}></lr-filter-bar>`,
    )) as LyraFilterBar;
    expect((control(el, 'q') as HTMLElement & { disabled: boolean }).disabled).to.be.true;
    let fired = false;
    el.addEventListener('lr-input', () => (fired = true));
    await typeInto(el, 'q', 'nope');
    await aTimeout(120);
    expect(fired).to.be.false;
    expect(el.value).to.deep.equal({});
  });

  it('is accessible with a text filter populated, its chip shown, and a revealed required error', async () => {
    const filters: FilterBarFilterDefinition[] = [
      { id: 'q', label: 'Search', type: 'text', placeholder: 'Search logs', debounce: 60 },
      { ...textFilters[1], required: true },
    ];
    const el = (await fixture(html`<lr-filter-bar .filters=${filters}></lr-filter-bar>`)) as LyraFilterBar;
    el.value = { q: 'GET /api/v1' };
    el.reportValidity();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="chip"]').length).to.equal(1);
    await expect(el).to.be.accessible();
  });
});

describe('accessibility', () => {
  it('is accessible in the empty (no filters, no active state) default render', async () => {
    const el = (await fixture(html`<lr-filter-bar></lr-filter-bar>`)) as LyraFilterBar;
    await expect(el).to.be.accessible();
  });

  it('is accessible in a populated state: active filters, loading spinner, and a revealed required error', async () => {
    const el = (await fixture(html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`)) as LyraFilterBar;
    el.value = { status: 'open', tags: ['urgent', 'billing'], created: '2026-02-01' };
    el.loading = true;
    el.reportValidity();
    await el.updateComplete;

    expect(el.shadowRoot!.querySelectorAll('[part="chip"]').length).to.equal(3);
    expect(el.shadowRoot!.querySelector('[part="status"]')).to.exist;
    await expect(el).to.be.accessible();
  });
});

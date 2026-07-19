import { fixture, expect, html, oneEvent } from '@open-wc/testing';
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

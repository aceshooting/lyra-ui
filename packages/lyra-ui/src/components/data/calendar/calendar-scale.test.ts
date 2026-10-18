import { expect, fixture, html } from '@open-wc/testing';
import './calendar.js';
import type { LyraCalendar } from './calendar.class.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';

it('does not sort 10,000 agenda events again on unrelated updates', async () => {
  const events = Array.from({ length: 10000 }, (_, i) => ({ date: `2026-01-${String(28 - i % 28).padStart(2, '0')}`, title: `${i}` }));
  const el = await fixture<LyraCalendar>(html`<lr-calendar view="agenda" view-date="2026-01-01" .events=${events}></lr-calendar>`);
  const original = Array.prototype.sort;
  let sorts = 0;
  Array.prototype.sort = function (...args) { if (this.length === 10000) sorts++; return original.apply(this, args); };
  try {
    for (let i = 0; i < 10; i++) { el.accessibleLabel = `${i}`; await el.updateComplete; }
    expect(sorts).to.equal(0);
    recordScaleMeasurement('lr-calendar', 'agenda-unrelated@10000', { sorts: sorts });
  } finally { Array.prototype.sort = original; }
});

it('discloses input loss in either calendar view and clears it on replacement', async () => {
  const { expectDevWarning } = await import('../../../../test/expected-dev-warnings.js');
  expectDevWarning('lyra-collection-truncated:lr-calendar:events');
  const el = await fixture<LyraCalendar>(html`<lr-calendar .strings=${{ calendarInputLimit: 'Input limited' }} .events=${Array.from({ length: 10001 }, () => ({ date: '2026-01-01', title: 'Event' }))}></lr-calendar>`);
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.equal('Input limited');
  el.view = 'agenda';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.equal('Input limited');
  el.events = [];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="limit"]')).to.equal(null);
});

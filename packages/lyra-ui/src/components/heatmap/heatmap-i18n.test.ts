import { fixture, expect, html } from '@open-wc/testing';
import './heatmap.js';
import type { LyraHeatmap } from './heatmap.js';

it('localizes the built-in value label in the legend and generated accessible name', async () => {
  const el = (await fixture(html`
    <lr-heatmap
      .values=${[[1, 2]]}
      .rowLabels=${['A']}
      .colLabels=${['B', 'C']}
      .strings=${{ heatmapValueLabel: 'valeur' }}
    ></lr-heatmap>
  `)) as LyraHeatmap;
  const legendLabel = el.shadowRoot!.querySelector('[part="legend"] > span:last-of-type')!;

  expect(legendLabel.textContent).to.equal('valeur');
  expect(el.getAttribute('aria-label')).to.contain('valeur range 1–2');
});

it('keeps an explicitly customized value-label verbatim', async () => {
  const el = (await fixture(html`
    <lr-heatmap
      value-label="requests"
      .values=${[[1, 2]]}
      .rowLabels=${['A']}
      .colLabels=${['B', 'C']}
    ></lr-heatmap>
  `)) as LyraHeatmap;
  const legendLabel = el.shadowRoot!.querySelector('[part="legend"] > span:last-of-type')!;

  expect(legendLabel.textContent).to.equal('requests');
  expect(el.getAttribute('aria-label')).to.contain('requests range 1–2');
});

it('formats legend ranges with the effective locale', async () => {
  const el = (await fixture(html`
    <lr-heatmap
      locale="de-DE"
      .values=${[[1234.5, 2345.6]]}
      .rowLabels=${['A']}
      .colLabels=${['B', 'C']}
    ></lr-heatmap>
  `)) as LyraHeatmap;

  expect(el.shadowRoot!.querySelector('[part="legend-lo"]')!.textContent).to.equal('1.234,5');
  expect(el.shadowRoot!.querySelector('[part="legend-hi"]')!.textContent).to.equal('2.345,6');
  expect(el.getAttribute('aria-label')).to.contain('value range 1.234,5–2.345,6');
});

it('derives calendar-mode month labels from the same `locale` as weekday labels, so the two never disagree on language', async () => {
  const el = (await fixture(html`
    <lr-heatmap mode="calendar" locale="fr-FR" .days=${[{ date: '2026-03-01', value: 5 }]}></lr-heatmap>
  `)) as LyraHeatmap;
  await el.updateComplete;

  type CachedGrid = { cachedCalendarGrid: { monthLabels: { label: string }[]; firstWeekStart: Date } };
  const grid = (el as unknown as CachedGrid).cachedCalendarGrid;
  const monthLabel = grid.monthLabels[0]!.label;
  const expectedMonth = new Date(Date.UTC(2026, 2, 1)).toLocaleString('fr-FR', { month: 'short', timeZone: 'UTC' });
  expect(monthLabel).to.equal(expectedMonth);

  const weekdayLabels = (el as unknown as { weekdayLabels: (d: Date) => string[] }).weekdayLabels(
    grid.firstWeekStart,
  );
  // weekdayLabels() only labels rows 1/3/5 (Mon/Wed/Fri, see its own doc comment) --
  // row 1 (Monday) is `firstWeekStart` + 1 day with the default Sunday-anchored
  // firstDayOfWeek used here.
  const monday = new Date(grid.firstWeekStart.getTime() + 24 * 60 * 60 * 1000);
  const expectedWeekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: 'UTC' }).format(monday);
  expect(weekdayLabels[1]).to.equal(expectedWeekday);
});

it('re-derives the default calendar month label once `locale` changes on an already-built grid', async () => {
  const el = (await fixture(html`
    <lr-heatmap mode="calendar" .days=${[{ date: '2026-03-01', value: 5 }]}></lr-heatmap>
  `)) as LyraHeatmap;
  await el.updateComplete;
  type CachedGrid = { cachedCalendarGrid: { monthLabels: { label: string }[] } };
  const before = (el as unknown as CachedGrid).cachedCalendarGrid.monthLabels[0]!.label;

  el.locale = 'fr-FR';
  await el.updateComplete;
  const after = (el as unknown as CachedGrid).cachedCalendarGrid.monthLabels[0]!.label;

  expect(after).to.equal(new Date(Date.UTC(2026, 2, 1)).toLocaleString('fr-FR', { month: 'short', timeZone: 'UTC' }));
  expect(after, 'the month label must actually re-resolve, not stay pinned to the runtime default').to.not.equal(
    before,
  );
});

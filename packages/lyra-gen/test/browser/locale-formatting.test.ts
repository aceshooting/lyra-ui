import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraTable } from '@aceshooting/lyra-ui/components/lr-table.js';
import { registerLyraLocale } from '@aceshooting/lyra-ui/localization.js';
import { initialCatalog } from '../../src/catalog.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import type { LyraGenView } from '../../src/types.js';

it('formats typed numeric and ISO columns by inherited en/fr/ar locale while preserving raw snapshots', async () => {
  const rows = [{ c0: -123456789.125, c1: '2024-02-29', c2: '2026-01-01T00:30:00+02:00', c3: '1234.5' }, { c0: null, c1: '2025-02-29', c2: 'not a date', c3: 'unchanged' }];
  const document: LyraGenView = { version: '1', catalog: { id: initialCatalog.id, version: initialCatalog.version }, surfaceId: 'typed-values', revision: 0, root: { id: 'records', type: 'table', props: { caption: 'Typed values', columns: [
    { key: 'c0', label: 'Number', format: { kind: 'number' } }, { key: 'c1', label: 'Date', format: { kind: 'date', timeZone: 'UTC' } },
    { key: 'c2', label: 'Instant', format: { kind: 'datetime', timeZone: 'UTC' } }, { key: 'c3', label: 'Text' },
  ], rows } } };
  const raw = JSON.stringify(document);
  const parent = await fixture<HTMLElement>(html`<section lang="en"><lr-gen-view .catalog=${initialCatalog} .document=${document}></lr-gen-view></section>`);
  const view = parent.querySelector<LyraGenViewElement>('lr-gen-view')!;
  await waitUntil(() => view.shadowRoot?.querySelector('lr-table') !== null && view.shadowRoot?.querySelector('lr-table') !== undefined);
  const table = view.shadowRoot!.querySelector<LyraTable>('lr-table')!;
  for (const locale of ['en', 'fr', 'ar']) {
    registerLyraLocale(locale, { tableFilterLabel: locale === 'fr' ? 'Filtrer' : locale === 'ar' ? 'تصفية' : 'Filter', tableFilterPlaceholder: locale === 'fr' ? 'Filtrer' : locale === 'ar' ? 'تصفية' : 'Filter' });
    parent.lang = locale;
    parent.dir = locale === 'ar' ? 'rtl' : 'ltr';
    await waitUntil(() => table.shadowRoot?.querySelector('tbody')?.textContent?.includes(new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(-123456789.125)) ?? false);
    const cells = [...table.shadowRoot!.querySelectorAll('tbody td')].map(cell => cell.textContent?.trim());
    expect(cells[0]).to.equal(new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(-123456789.125));
    expect(cells[1]).to.equal(new Intl.DateTimeFormat(locale, { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date('2024-02-29T00:00:00Z')));
    expect(cells[2]).to.equal(new Intl.DateTimeFormat(locale, { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date('2025-12-31T22:30:00Z')));
    expect(cells.slice(3)).to.deep.equal(['1234.5', '', '2025-02-29', 'not a date', 'unchanged']);
    expect(table.rows).to.deep.equal(rows);
    expect(JSON.stringify(document)).to.equal(raw);
    expect(view.document?.root.props?.['rows']).to.deep.equal(rows);
  }
});

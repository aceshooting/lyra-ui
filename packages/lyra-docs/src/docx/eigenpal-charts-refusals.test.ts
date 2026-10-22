import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { OoxmlPackage } from '@docx-editor.dev/core/store';
import { chartPlacements } from './eigenpal-charts.js';
import { chartFixture, chartXml } from '../../test/corpus.js';
const store = await import('@docx-editor.dev/core/store');

const CEILING = 2 * 1024 * 1024;
const CHART_PART = '/word/charts/chart1.xml';
const SECOND_CHART_PART = '/word/charts/chart2.xml';

/** The fixture's column chart beside a line chart (instead of its unsupported pie), so a dropped chart is visible beside a kept one. */
function readPackage(): OoxmlPackage {
  const result = store.readOoxmlPackage(chartFixture());
  assert(result.ok);
  const partBytes = new Map(result.package.partBytes).set(SECOND_CHART_PART, new TextEncoder().encode(chartXml('line')));
  return { ...result.package, partBytes };
}

test('places each supported chart and nothing for a package without a main document part', () => {
  const pkg = readPackage();
  assert.deepEqual(chartPlacements(pkg).map(placement => placement.model.title), ['Quarterly column', 'Quarterly line']);
  assert.deepEqual(chartPlacements({ ...pkg, mainDocumentPart: '/word/absent.xml' }), []);
});

test('drops a chart whose relationship is external, unresolvable, unknown or has no stored bytes and keeps the others', () => {
  const pkg = readPackage();
  const edit = (change: { targetMode?: 'External'; rawTarget?: string; id?: string }): OoxmlPackage => ({ ...pkg,
    relationships: new Map([...pkg.relationships].map(([owner, records]) => [owner,
      records.map(record => record.id === 'rIdChart1' ? { ...record, ...change } : record)])) });
  assert.equal(chartPlacements(edit({})).length, 2);
  const refused: [string, Parameters<typeof edit>[0]][] = [
    ['an external target', { targetMode: 'External' }],
    ['a target outside the package', { rawTarget: '../../charts/chart1.xml' }],
    ['a target with a fragment', { rawTarget: 'charts/chart1.xml#top' }],
    ['a target with no stored bytes', { rawTarget: 'charts/absent.xml' }],
    ['an identifier no drawing refers to', { id: 'rIdOther' }],
  ];
  for (const [label, change] of refused) assert.deepEqual(chartPlacements(edit(change)).map(placement => placement.model.type), ['line'], label);
});

test('measures the chart size ceiling in stored bytes, not in decoded characters', () => {
  const pkg = readPackage();
  const stored = (count: number) => new TextEncoder().encode(`${chartXml('column')}<!--${'é'.repeat(count)}-->`);
  const place = (bytes: Uint8Array) => chartPlacements({ ...pkg, partBytes: new Map([...pkg.partBytes, [CHART_PART, bytes]]) });
  const within = stored(1_040_000), above = stored(1_049_000);
  assert.ok(within.length < CEILING);
  assert.ok(above.length > CEILING);
  // Every two-byte character decodes to one unit, so the decoded text stays far below the ceiling.
  assert.ok(new TextDecoder().decode(above).length < CEILING);
  assert.deepEqual(place(within).map(placement => placement.model.type), ['bar', 'line']);
  assert.deepEqual(place(above).map(placement => placement.model.type), ['line']);
});

test('returns no placements when reading the package throws', () => {
  const pkg = readPackage();
  const hostile = { ...pkg, get mainDocumentPart(): string { throw new Error('unreadable package'); } };
  assert.deepEqual(chartPlacements(hostile), []);
});

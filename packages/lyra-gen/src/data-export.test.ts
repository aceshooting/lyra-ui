import assert from 'node:assert/strict';
import test from 'node:test';
import { dashboardCatalog } from './catalog.js';
import { exportPrintableHtml, exportViewData, toCsv } from './data-export.js';
import { createSurfaceState, validateView } from './runtime.js';
import type { LyraGenNode, LyraGenView } from './types.js';

const catalog = dashboardCatalog();
const view = (...children: LyraGenNode[]): LyraGenView => {
  const checked = validateView({ version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'export', revision: 1, root: { id: 'root', type: 'stack', children } }, catalog);
  assert.ok(checked.ok, JSON.stringify(checked.diagnostics));
  return (checked as { value: LyraGenView }).value;
};
const ok = <T>(result: { ok: boolean; value?: T }): T => { assert.equal(result.ok, true); return (result as { value: T }).value; };

test('tables, charts and grids export their typed rows in document order', () => {
  const tables = ok(exportViewData(view(
    { id: 't', type: 'table', props: { caption: 'People', columns: [{ key: 'c0', label: 'Name' }, { key: 'c1', label: 'Age' }], rows: [{ c0: 'Ada', c1: 36 }, { c0: 'Bob', c1: null }] } },
    { id: 'c', type: 'series-chart', props: { label: 'Sales', labels: ['Q1', 'Q2'], datasets: [{ label: 'EU', data: [1, null] }, { label: 'US', data: [3, 4] }] } },
    { id: 'g', type: 'data-grid', props: { label: 'Grid', columns: [{ field: 'c1', label: 'B' }, { field: 'c0', label: 'A' }], data: [{ c0: 'x', c1: true }] } },
  )));
  assert.deepEqual(tables.map(table => table.nodeId), ['t', 'c', 'g']);
  assert.deepEqual(tables[0], { nodeId: 't', role: 'table', title: 'People', columns: ['Name', 'Age'], rows: [['Ada', 36], ['Bob', null]] });
  assert.deepEqual(tables[1]!.columns, ['Label', 'EU', 'US']);
  assert.deepEqual(tables[1]!.rows, [['Q1', 1, 3], ['Q2', null, 4]]);
  assert.deepEqual(tables[2]!.rows, [[true, 'x']]);
});

test('heatmap, funnel, stat, gauge, sparkline, treemap, sankey and word-cloud export', () => {
  const tables = ok(exportViewData(view(
    { id: 'h', type: 'heatmap', props: { label: 'Heat', data: { kind: 'matrix', rowLabels: ['r1'], colLabels: ['a', 'b'], values: [[1, 2]] } } },
    { id: 'f', type: 'funnel', props: { label: 'Funnel', stages: [{ label: 'Visit', value: 10 }], comparison: [{ label: 'Visit', value: 8 }], comparisonLabel: 'Last' } },
    { id: 's', type: 'stat', props: { label: 'Open', value: '12', deltaPercent: 3 } },
    { id: 'ga', type: 'gauge', props: { label: 'Load', value: 5, min: 0, max: 10 } },
    { id: 'sp', type: 'sparkline', props: { label: 'Trend', values: [1, 2] } },
    { id: 'tm', type: 'treemap', props: { label: 'Tree', nodes: [{ id: 'a', label: 'A', children: [{ id: 'b', label: 'B', value: 2 }] }] } },
    { id: 'sk', type: 'sankey', props: { label: 'Flow', nodes: [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }], links: [{ source: 'a', target: 'b', value: 4 }] } },
    { id: 'wc', type: 'word-cloud', props: { words: [{ text: 'hi', weight: 2 }] } },
  )));
  const byId = Object.fromEntries(tables.map(table => [table.nodeId, table]));
  assert.deepEqual(byId['h']!.rows, [['r1', 1, 2]]);
  assert.deepEqual(byId['h']!.columns, ['', 'a', 'b']);
  assert.deepEqual(byId['f']!.columns, ['Stage', 'Value', 'Last']);
  assert.deepEqual(byId['f']!.rows, [['Visit', 10, 8]]);
  assert.deepEqual(byId['s']!.rows, [['Open', '12', null, null, 3]]);
  assert.deepEqual(byId['ga']!.rows, [['Load', 5, 0, 10]]);
  assert.deepEqual(byId['sp']!.rows, [[0, 1], [1, 2]]);
  assert.deepEqual(byId['tm']!.rows, [['a', 'A', null, null], ['b', 'B', 2, 'a']]);
  assert.deepEqual(byId['sk']!.rows, [['Alpha', 'Beta', 4]]);
  assert.deepEqual(byId['wc']!.rows, [['hi', 2, null]]);
});

test('bindings resolve from surface state and headings can be translated', () => {
  const v = view({ id: 'in', type: 'input', props: { label: 'Load' }, bindings: { value: '/load' } }, { id: 'g', type: 'gauge', props: { label: 'Load', value: 1 }, reads: { value: '/load' } });
  const state = { ...createSurfaceState(v), values: { load: 9 } };
  const tables = ok(exportViewData(v, state, { headings: { value: 'Valeur' } }));
  assert.deepEqual(tables[0]!.rows[0]![1], 9);
  assert.equal(tables[0]!.columns[1], 'Valeur');
  assert.equal(ok(exportViewData(v))[0]!.rows[0]![1], 1);
});

test('export is bounded', () => {
  const v = view({ id: 'a', type: 'sparkline', props: { label: 'A', values: [1, 2, 3] } }, { id: 'b', type: 'sparkline', props: { label: 'B', values: [1] } });
  assert.equal(exportViewData(v, undefined, { maxTables: 1 }).ok, false);
  const cells = exportViewData(v, undefined, { maxCells: 5 });
  assert.equal(cells.ok, false);
  assert.equal(cells.diagnostics[0]!.code, 'export.limit');
});

test('CSV follows RFC 4180 and neutralizes formulas', () => {
  const csv = ok(toCsv({ columns: ['a', 'b,c'], rows: [['say "hi"', 1.5], ['=SUM(A1)', null], ['+1', '-2'], ['@x', '\tcmd'], ['\rcr', 'line\nbreak'], [true, -3]] }));
  assert.equal(csv, 'a,"b,c"\r\n"say ""hi""",1.5\r\n\'=SUM(A1),\r\n\'+1,\'-2\r\n\'@x,\'\tcmd\r\n"\'\rcr","line\nbreak"\r\ntrue,-3\r\n');
  assert.equal(ok(toCsv({ columns: ['=h'], rows: [] })), '\'=h\r\n');
});

test('CSV supports a byte order mark, a locale, a delimiter and a size bound', () => {
  assert.ok(ok(toCsv({ columns: ['n'], rows: [] }, { bom: true })).startsWith('﻿n'));
  assert.equal(ok(toCsv({ columns: ['n'], rows: [[1234.5]] }, { locale: 'de' })), 'n\r\n"1234,5"\r\n');
  assert.equal(ok(toCsv({ columns: ['n'], rows: [[1234.5]] }, { locale: 'de', delimiter: ';' })), 'n\r\n1234,5\r\n');
  assert.equal(ok(toCsv({ columns: ['n', 'm'], rows: [['a;b', 'c']] }, { delimiter: ';' })), 'n;m\r\n"a;b";c\r\n');
  assert.equal(toCsv({ columns: ['n'], rows: [] }, { delimiter: '"' }).ok, false);
  assert.equal(toCsv({ columns: ['n'], rows: [] }, { locale: 'not a locale!' }).ok, false);
  const limited = toCsv({ columns: ['n'], rows: [['x'.repeat(100)]] }, { maxLength: 50 });
  assert.equal(limited.ok, false);
  assert.equal(limited.diagnostics[0]!.code, 'csv.limit');
});

test('printable HTML is inert: no scripts, handlers, links or external URLs', async () => {
  const markup = '<section data-lyra-gen-snapshot="x" data-surface-id="s" lang="en" onclick="alert(1)"><script>alert(1)</script><style>@import url(https://evil.test/a.css)</style>' +
    '<a href="https://evil.test/">link</a><img src="https://evil.test/p.png"><iframe src="https://evil.test"></iframe><svg><script>x</script></svg>' +
    '<div data-gen-id="a" onmouseover="x()" style="background:url(https://evil.test)"><h2>T &amp; U &lt;b&gt;</h2><button type="button" disabled formaction="https://evil.test">Go</button></div>' +
    '<!--?lit$1$--><table data-gen-id="t"><caption>C</caption><tbody><tr><td>1 < 2</td></tr></tbody></table><template data-lyra-gen-state="{&quot;u&quot;:&quot;https://x.test&quot;}"></template></section>';
  const html = ok(await exportPrintableHtml(markup, { title: 'Board <1>', locale: 'ar', direction: 'rtl' }));
  assert.doesNotMatch(html, /<script|<iframe|<img|<a[ >]|<svg|<template|\son[a-z]+=|href=|src=|formaction|https?:\/\/|url\(|@import|javascript:|<!--/iu);
  assert.match(html, /<html lang="ar" dir="rtl">/u);
  assert.match(html, /<title>Board &lt;1&gt;<\/title>/u);
  assert.match(html, /<h2>T &amp; U &lt;b&gt;<\/h2>/u);
  assert.match(html, /<td>1 &lt; 2<\/td>/u);
  assert.match(html, /@page/u);
  assert.match(html, /<button type="button" disabled>Go<\/button>/u);
});

test('printable HTML renders a snapshot through the host renderer and rejects bad context', async () => {
  const snapshot = { profile: 'lyra-gen-static-v1', template: {}, serialized: '' } as never;
  assert.equal((await exportPrintableHtml(snapshot)).ok, false);
  const rendered = ok(await exportPrintableHtml(snapshot, { render: () => '<p>Hi</p>' }));
  assert.match(rendered, /<body><p>Hi<\/p><\/body>/u);
  assert.equal((await exportPrintableHtml('<p>x</p>', { locale: 'not a locale!' })).ok, false);
  assert.equal((await exportPrintableHtml('<p>x</p>', { maxBytes: 10 })).ok, false);
});

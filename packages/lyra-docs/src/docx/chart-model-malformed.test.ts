import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDocxChart } from './chart-model.js';
import { chartXml } from '../../test/corpus.js';

const CEILING = 2 * 1024 * 1024;
const elementCount = (xml: string) => (xml.match(/<[A-Za-z]/g) ?? []).length;
/** Puts extra content inside the plot area's layout element, which no chart reader interprets. */
const inLayout = (xml: string, extras: string) => xml.replace('<c:layout/>', `<c:layout>${extras}</c:layout>`);
const withoutTitle = (xml: string) => xml.replace(/<c:title>[\s\S]*?<\/c:title>/, '');

test('refuses a chart part above the size ceiling but reads one that fills it', () => {
  const xml = chartXml('column');
  const padded = (length: number) => xml + ' '.repeat(length - xml.length);
  assert.equal(parseDocxChart(padded(CEILING))?.series.length, 2);
  assert.equal(parseDocxChart(padded(CEILING + 1)), null);
});

test('refuses a chart nested deeper than the depth ceiling or holding more elements than the node ceiling', () => {
  const xml = chartXml('column');
  // The chart space, chart, plot area and layout take four levels, so sixty more reach the ceiling of sixty-four.
  const nested = (depth: number) => inLayout(xml, '<c:x>'.repeat(depth) + '</c:x>'.repeat(depth));
  assert.equal(parseDocxChart(nested(60))?.type, 'bar');
  assert.equal(parseDocxChart(nested(61)), null);
  const room = 50_000 - elementCount(xml);
  assert.equal(parseDocxChart(inLayout(xml, '<c:x/>'.repeat(room)))?.type, 'bar');
  assert.equal(parseDocxChart(inLayout(xml, '<c:x/>'.repeat(room + 1))), null);
});

test('reports no chart, instead of throwing, for a part that ends inside a CDATA section on a lone surrogate', () => {
  // The XML parser throws for this truncation rather than reporting a malformed document.
  for (const ending of [']', ']]']) {
    const truncated = chartXml('column').replace('</c:chartSpace>', `<![CDATA[x${ending}\ud800`);
    assert.equal(parseDocxChart(truncated), null, ending);
  }
});

test('refuses a chart without series or without a usable cached point', () => {
  const xml = chartXml('column');
  assert.equal(parseDocxChart(xml.replace(/<c:ser>[\s\S]*<\/c:ser>/, '')), null);
  assert.equal(parseDocxChart(xml.replace(/<c:pt idx=\x22\d+\x22><c:v>[^<]*<\/c:v><\/c:pt>/g, '')), null);
  for (const index of ['x', '-1', '1.5', '500']) {
    assert.equal(parseDocxChart(xml.replace(/idx=\x22\d+\x22/g, `idx="${index}"`)), null, index);
  }
  // Index 499 is the last cached point a chart may carry.
  const last = parseDocxChart(xml.replace(/<c:pt idx=\x22\d+\x22>/g, '<c:pt idx="499">'));
  assert.equal(last?.labels.length, 500);
});

test('names an unnamed series by its position and numbers categories a chart does not cache', () => {
  const xml = chartXml('column');
  const unnamed = xml.replace(/<c:tx><c:strRef>[\s\S]*?<\/c:strRef><\/c:tx>/g, '');
  const model = parseDocxChart(unnamed);
  assert.deepEqual(model?.series.map(series => series.label), ['1', '2']);
  assert.equal(model?.title, 'Quarterly column');
  assert.deepEqual(parseDocxChart(xml.replace('<c:v>Sales</c:v>', '<c:v>   </c:v>'))?.series.map(series => series.label), ['1', 'Costs']);
  const uncategorized = parseDocxChart(xml.replace(/<c:cat>[\s\S]*?<\/c:cat>/g, ''));
  assert.deepEqual(uncategorized?.labels, ['1', '2', '3']);
  assert.deepEqual(uncategorized?.series.map(series => series.data), [[12, 7, 9], [8, 5, 4]]);
});

test('treats a missing grouping as unstacked and stacks only bar charts', () => {
  const bar = chartXml('column');
  assert.equal(parseDocxChart(bar.replace('<c:grouping val="clustered"/>', ''))?.stacked, false);
  assert.equal(parseDocxChart(bar.replace('<c:grouping val="clustered"/>', '<c:grouping/>'))?.stacked, false);
  assert.equal(parseDocxChart(bar.replace('val="clustered"', 'val="percentStacked"'))?.stacked, true);
  const line = parseDocxChart(chartXml('line').replace('val="standard"', 'val="stacked"'));
  assert.deepEqual([line?.type, line?.stacked], ['line', false]);
});

test('titles a single series after itself unless the chart suppresses its automatic title', () => {
  const line = withoutTitle(chartXml('line'));
  assert.equal(parseDocxChart(line)?.title, 'Trend');
  assert.equal(parseDocxChart(line.replace('<c:autoTitleDeleted val="0"/>', ''))?.title, 'Trend');
  assert.equal(parseDocxChart(line.replace('<c:autoTitleDeleted val="0"/>', '<c:autoTitleDeleted val="1"/>'))?.title, '');
  assert.equal(parseDocxChart(withoutTitle(chartXml('column')))?.title, '');
  assert.equal(parseDocxChart(chartXml('line'))?.title, 'Quarterly line');
});

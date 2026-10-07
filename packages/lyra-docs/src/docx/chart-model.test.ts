import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDocxChart } from './chart-model.js';
import { chartPlacements } from './eigenpal-charts.js';
import { chartFixture, chartXml, representativeFixture } from '../../test/corpus.js';
const store = await import('@docx-editor.dev/core/store');

test('column and line charts read their cached categories, series and title', () => {
  assert.deepEqual(parseDocxChart(chartXml('column')), {
    type: 'bar', stacked: false, title: 'Quarterly column', labels: ['North', 'South', 'East'],
    series: [{ label: 'Sales', data: [12, 7, 9] }, { label: 'Costs', data: [8, 5, 4] }],
  });
  const line = parseDocxChart(chartXml('line'));
  assert.equal(line?.type, 'line');
  assert.deepEqual(line?.series, [{ label: 'Trend', data: [1, 4, 2] }]);
  assert.equal(Object.isFrozen(line), true);
});

test('stacked bars, sparse points and missing labels keep their positions', () => {
  const xml = chartXml('column').replace('<c:grouping val="clustered"/>', '<c:grouping val="stacked"/>')
    .replace('<c:pt idx="1"><c:v>7</c:v></c:pt>', '').replaceAll('<c:pt idx="2"><c:v>East</c:v></c:pt>', '');
  const model = parseDocxChart(xml)!;
  assert.equal(model.stacked, true);
  assert.deepEqual(model.labels, ['North', 'South', '3']);
  assert.deepEqual(model.series[0]!.data, [12, null, 9]);
});

test('unsupported kinds, malformed XML, DTDs and empty data are not painted', () => {
  assert.equal(parseDocxChart(chartXml('pie')), null);
  assert.equal(parseDocxChart('<c:chartSpace'), null);
  assert.equal(parseDocxChart('<!DOCTYPE x [<!ENTITY a "b">]>' + chartXml('column')), null);
  assert.equal(parseDocxChart('<x xmlns="urn:other"/>'), null);
  assert.equal(parseDocxChart(chartXml('column').replace(/<c:v>\d+<\/c:v>/g, '<c:v>n/a</c:v>')), null);
  assert.equal(parseDocxChart('<?xml version="1.0"?><?evil?>' + chartXml('column')), null);
});

test('series, points and text are bounded', () => {
  const many = chartXml('column').replace(/<c:ser>[\s\S]*<\/c:ser>/, match => match.repeat(20));
  assert.equal(parseDocxChart(many)!.series.length, 16);
  const long = chartXml('column').replace('Quarterly column', 'x'.repeat(1000));
  assert.equal(parseDocxChart(long)!.title.length, 256);
  const far = chartXml('column').replace('<c:pt idx="2"><c:v>9</c:v></c:pt>', '<c:pt idx="2"><c:v>9</c:v></c:pt><c:pt idx="99999"><c:v>1</c:v></c:pt>');
  assert.equal(parseDocxChart(far)!.labels.length, 3);
});

test('chart placements skip chart-free documents, parse each chart part once and isolate a broken part', () => {
  const read = (bytes: Uint8Array) => { const result = store.readOoxmlPackage(bytes); assert(result.ok); return result.package; };
  const plain = read(representativeFixture()), main = plain.parts.get(plain.mainDocumentPart)!;
  let walked = false;
  const guarded = { ...main, get root() { walked = true; return main.root; } };
  assert.deepEqual(chartPlacements({ ...plain, parts: new Map([...plain.parts, [main.name, guarded]]) }), []);
  assert.equal(walked, false);
  const charts = read(chartFixture()), partBytes = new Map(charts.partBytes);
  partBytes.set('/word/charts/chart2.xml', Uint8Array.of(0xff, 0xfe));
  const first = chartPlacements({ ...charts, partBytes }), second = chartPlacements({ ...charts, partBytes });
  assert.equal(first.length, 1);
  assert.equal(second[0]?.model, first[0]!.model);
});

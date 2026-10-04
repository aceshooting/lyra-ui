import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDocxChart } from './chart-model.js';
import { chartXml } from '../../test/corpus.js';

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

import { expect } from '@open-wc/testing';
import { admitChartArray, canonicalSeriesData, canonicalSeriesPoints, copyChartArrayEntries, projectChartDataConfiguration, projectChartPlugins } from './chart-input-projection.js';
import type { LyraChartSeries } from './chart.class.js';
import { boundChartSeriesValues } from './chart-series-bounds.js';
import { ChartTokenCache } from './chart-token-cache.js';

it('rejects stale array admissions and uninspectable records before projection', () => {
  const values = [1, 2];
  const admission = admitChartArray(values)!;
  values.pop();
  expect(copyChartArrayEntries(admission)).to.deep.equal([]);
  const invalid = null as unknown as LyraChartSeries;
  expect(canonicalSeriesData(invalid)).to.deep.equal([]);
  expect(canonicalSeriesPoints(invalid) === undefined).to.equal(true);
  expect(projectChartPlugins([{ id: '  ' }, { id: 4 }])).to.deep.equal([]);
  const opaque = new Proxy({}, { ownKeys() { throw new TypeError('No keys'); } });
  expect(projectChartDataConfiguration(opaque) === undefined).to.equal(true);
  const record = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(record, 'constructor', { value: 'unused', enumerable: true });
  Object.defineProperty(record, 'opaque', { get() { throw new Error('Accessor must not run'); }, enumerable: true });
  record['data'] = [2];
  const config = Object.defineProperties(Object.create(null) as Record<string, unknown>, Object.getOwnPropertyDescriptors(record));
  config['datasets'] = [opaque, record];
  const result = projectChartDataConfiguration(config);
  expect(result?.datasets?.length).to.equal(1);
  expect(Object.keys(result!)).to.deep.equal(['data', 'datasets']);
  expect(Object.keys(result!.datasets![0]!)).to.deep.equal(['data']);
});

it('resolves inline chart tokens without an owner window and measures lengths on a light DOM host', () => {
  const detached = document.implementation.createHTMLDocument().createElement('div');
  const tokens = new ChartTokenCache(detached);
  detached.style.setProperty('--width', '22px');
  expect(tokens.styleNumber('--width', undefined, 4)).to.equal(22);
  detached.style.setProperty('--width', '2em');
  expect(tokens.styleNumber('--width', undefined, 4)).to.equal(4);
  expect(tokens.styleColor('--missing', 'rgb(1, 2, 3)')).to.equal('rgb(1, 2, 3)');
  expect(tokens.themeColors(false).tickFontSize).to.be.greaterThan(0);
  const host = document.createElement('div');
  host.style.cssText = 'font-size:10px;--width:2em';
  document.body.append(host);
  try {
    expect(new ChartTokenCache(host).styleNumber('--width', undefined, 0)).to.equal(20);
    expect(host.childElementCount).to.equal(0);
  } finally { host.remove(); }
});

it('rejects uninspectable series and data lengths without reading their entries', () => {
  const unreadable = new Proxy([1], { getOwnPropertyDescriptor() { throw new TypeError('Unavailable descriptor'); } });
  expect(boundChartSeriesValues(unreadable) === undefined).to.equal(true);
  expect(boundChartSeriesValues([{ data: unreadable }]) === undefined).to.equal(true);
});

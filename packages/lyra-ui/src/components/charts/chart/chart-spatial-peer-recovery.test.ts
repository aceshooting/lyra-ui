import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraChart, LyraChartInstance } from './chart.class.js';
import type { LyraSpatialChartSource } from '../../../utilities/data-spatial.js';
import './chart.js';

const bounds = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
function source(revision = 'initial'): LyraSpatialChartSource {
  const point = { id: revision, seriesId: 's', sourceIndex: 0, x: 5, y: 5, label: revision };
  return { kind: 'spatial', revision, count: 1, bounds, series: [{ id: 's', label: 'Series' }],
    query: () => ({ matchedCount: 1, bins: [{ bounds, count: 1 }], points: [point] }),
    getPoint: () => point };
}

async function mounted(): Promise<LyraChart> {
  const element = await fixture<LyraChart>(html`<lr-chart type="scatter" without-animation with-data-table
    style="inline-size:500px;block-size:280px" .preparedData=${source()}></lr-chart>`);
  await waitUntil(() => !!element.chart && element.getAttribute('aria-busy') === 'false' &&
    element.shadowRoot!.querySelector('[data-spatial-id="initial"]') !== null);
  return element;
}

function click(peer: LyraChartInstance): void {
  const area = peer.chartArea!;
  const callback = peer.options['onClick'] as (event: unknown, hits: unknown[], chart: LyraChartInstance) => void;
  callback({ native: new MouseEvent('click'), x: area.left + area.width / 2, y: area.top + area.height / 2 }, [], peer);
}

for (const failure of ['throwing query', 'null result', 'revoked result', 'null hit', 'missing hit', 'accessor hit', 'accessor index', 'shrinking result', 'result revoked after admission']) {
  it(`contains a spatial ${failure} and accepts the next valid point activation`, async () => {
    const element = await mounted();
    const peer = element.chart!;
    const original = peer.getElementsAtEventForMode;
    const events: string[] = [];
    let getterReads = 0;
    element.addEventListener('lr-spatial-point-select', event => events.push(event.detail.point.id));
    element.addEventListener('lr-spatial-bin-select', () => events.push('density'));
    const hit = { datasetIndex: 0, index: 0 };
    const revoked = Proxy.revocable([hit], {}); revoked.revoke();
    const accessorHit = [hit];
    Object.defineProperty(accessorHit, '0', { get() { getterReads++; return hit; } });
    const accessorIndex = Object.defineProperty({ index: 0 }, 'datasetIndex', { get() { getterReads++; return 0; } });
    let lengthReads = 0;
    const shrinking = new Proxy([hit], { getOwnPropertyDescriptor(target, key) {
      const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
      if (key === 'length') return { ...descriptor, value: ++lengthReads === 1 ? 1 : 0 };
      return descriptor;
    } });
    const retiring = Proxy.revocable([hit], { getOwnPropertyDescriptor(target, key) {
      const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
      if (key === 'length') retiring.revoke();
      return descriptor;
    } });
    const results: Record<string, unknown> = {
      'null result': null, 'revoked result': revoked.proxy, 'null hit': [null], 'missing hit': new Array(1),
      'accessor hit': accessorHit, 'accessor index': [accessorIndex], 'shrinking result': shrinking,
      'result revoked after admission': retiring.proxy,
    };
    peer.getElementsAtEventForMode = () => {
      if (failure === 'throwing query') throw new Error('Spatial hit test unavailable');
      return results[failure] as ReturnType<LyraChartInstance['getElementsAtEventForMode']>;
    };
    try {
      expect(() => click(peer)).not.to.throw();
      expect(getterReads).to.equal(0);
      expect(events).to.deep.equal([]);
      peer.getElementsAtEventForMode = () => [hit];
      click(peer);
      expect(events).to.deep.equal(['initial']);
      expect(element.exportData('csv')).to.include('initial,0,initial,5,5');
    } finally { peer.getElementsAtEventForMode = original; }
  });
}

for (const phase of ['array admission', 'array revalidation', 'entry admission', 'index admission']) {
  it(`discards spatial hits when the source changes during ${phase}`, async () => {
    const element = await mounted();
    const peer = element.chart!, original = peer.getElementsAtEventForMode;
    const events: string[] = [];
    element.addEventListener('lr-spatial-point-select', event => events.push(event.detail.point.id));
    element.addEventListener('lr-spatial-bin-select', () => events.push('density'));
    let replaced = false;
    const replace = (): void => {
      if (replaced) return;
      replaced = true;
      element.preparedData = source('replacement');
    };
    const hit = new Proxy({ datasetIndex: 0, index: 0 }, { getOwnPropertyDescriptor(target, key) {
      if (phase === 'index admission' && key === 'index') replace();
      return Reflect.getOwnPropertyDescriptor(target, key);
    } });
    let lengthReads = 0;
    const hits = new Proxy([hit], { getOwnPropertyDescriptor(target, key) {
      if (key === 'length') lengthReads++;
      if ((phase === 'array admission' && lengthReads === 1) ||
        (phase === 'array revalidation' && lengthReads === 2) ||
        (phase === 'entry admission' && key === '0')) replace();
      return Reflect.getOwnPropertyDescriptor(target, key);
    } });
    peer.getElementsAtEventForMode = () => hits;
    try {
      click(peer);
      expect(replaced).to.equal(true);
      expect(events).to.deep.equal([]);
    } finally { peer.getElementsAtEventForMode = original; }
    await element.updateComplete;
    await waitUntil(() => element.getAttribute('aria-busy') === 'false' &&
      element.shadowRoot!.querySelector('[data-spatial-id="replacement"]') !== null);
    const current = element.chart!, query = current.getElementsAtEventForMode;
    current.getElementsAtEventForMode = () => [{ datasetIndex: 0, index: 0 }];
    try {
      click(current);
      expect(events).to.deep.equal(['replacement']);
    } finally { current.getElementsAtEventForMode = query; }
  });
}

for (const retirement of ['replacement', 'clear', 'disconnect', 'reconnect']) {
  it(`ignores a spatial hit after source ${retirement} during the native query`, async () => {
    const element = await mounted();
    const peer = element.chart!;
    const parent = element.parentNode!;
    const original = peer.getElementsAtEventForMode;
    const events: string[] = [];
    element.addEventListener('lr-spatial-point-select', event => events.push(event.detail.point.id));
    element.addEventListener('lr-spatial-bin-select', () => events.push('density'));
    let retired = false;
    peer.getElementsAtEventForMode = () => {
      retired = true;
      if (retirement === 'replacement') element.preparedData = source('replacement');
      else if (retirement === 'clear') element.preparedData = null;
      else { element.remove(); if (retirement === 'reconnect') parent.append(element); }
      return [{ datasetIndex: 0, index: 0 }];
    };
    try {
      click(peer);
      expect(retired).to.equal(true);
      expect(events).to.deep.equal([]);
    } finally { peer.getElementsAtEventForMode = original; }
    if (!element.isConnected) parent.append(element);
    element.preparedData = source('replacement');
    await element.updateComplete;
    await waitUntil(() => !!element.chart && element.getAttribute('aria-busy') === 'false' &&
      element.shadowRoot!.querySelector('[data-spatial-id="replacement"]') !== null);
    const current = element.chart!, query = current.getElementsAtEventForMode;
    current.getElementsAtEventForMode = () => [{ datasetIndex: 0, index: 0 }];
    try {
      click(current);
      expect(events).to.deep.equal(['replacement']);
    } finally { current.getElementsAtEventForMode = query; }
  });
}

import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './embedding-explorer.js';
import type { EmbeddingPoint, LyraEmbeddingExplorer } from './embedding-explorer.js';

it('atomically replaces a large sample with the first valid winner of every sampled id', async () => {
  const source = new Proxy(new Array<EmbeddingPoint>(1_000_000), {
    getOwnPropertyDescriptor(target, key) {
      if (typeof key === 'string' && /^\d+$/.test(key)) return { configurable: true, enumerable: true, writable: true, value: point(Number(key)) };
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
    get(target, key, receiver) { return typeof key === 'string' && /^\d+$/.test(key) ? point(Number(key)) : Reflect.get(target, key, receiver); },
  });
  function point(index: number): EmbeddingPoint { return { id: index === 1 || index === 999_999 ? 'duplicate' : `p${index}`, x: index, y: 0, label: index === 1 ? 'First winner' : 'Later point' }; }
  const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .points=${[{ id: 'old', x: 0, y: 0 }]}></lr-embedding-explorer>`);
  el.selectedPointId = 'duplicate'; el.points = source; await el.updateComplete;
  expect(el.points[0]!.id).to.equal('old');
  await waitUntil(() => el.points.some(point => point.id === 'duplicate' && point.label === 'First winner'), 'first valid duplicate was lost', { timeout: 5000 });
  await el.updateComplete;
  expect(el.points.length).to.be.at.most(10_000);
  recordScaleMeasurement('lr-embedding-explorer', 'n=1000000 sampled identity resolution', { retained: el.points.length, rendered: el.shadowRoot!.querySelectorAll('[part="point"]').length });
  expect(el.shadowRoot!.querySelector('[data-id="duplicate"]')!.getAttribute('aria-selected')).to.equal('true');
  expect(el.points.find(point => point.id === 'duplicate')!.x).to.equal(1);
});

it('ignores invalid earlier duplicates and accessors before selecting the first valid sampled identity', async () => {
  let getters = 0;
  const source: EmbeddingPoint[] = Array.from({ length: 20_000 }, (_, index) => ({ id: `p${index}`, x: index, y: 0 }));
  source[1] = { id: 'duplicate', x: NaN, y: 0 };
  source[2] = { id: 'duplicate', get x() { getters++; return 2; }, y: 0 };
  source[3] = { id: 'duplicate', x: 3, y: 0, label: 'First valid' };
  source[19_999] = { id: 'duplicate', x: 19_999, y: 0, label: 'Later duplicate' };
  const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .points=${source} selected-point-id="duplicate"></lr-embedding-explorer>`);
  await waitUntil(() => el.points.some(point => point.id === 'duplicate' && point.x === 3), 'valid first duplicate missing');
  await el.updateComplete;
  expect(getters).to.equal(0);
  expect(el.shadowRoot!.querySelector('[data-id="duplicate"]')!.getAttribute('aria-selected')).to.equal('true');
});

it('cancels replaced and disconnected scans and honors a coalesced explicit mutable refresh', async () => {
  const source = Array.from({ length: 30_000 }, (_, index) => ({ id: `p${index}`, x: index, y: 0 }));
  const current = [{ id: 'current', x: 1, y: 0 }];
  const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .points=${current}></lr-embedding-explorer>`);
  el.points = source; await el.updateComplete;
  el.points = [{ id: 'replacement', x: 2, y: 0 }]; await el.updateComplete;
  await new Promise(resolve => setTimeout(resolve, 30));
  expect(el.points.map(point => point.id)).to.deep.equal(['replacement']);
  el.points = current; await el.updateComplete;
  current[0]!.x = 7; el.requestUpdate(); el.label = 'Named update'; await el.updateComplete;
  expect(el.points[0]!.x).to.equal(7);
  el.points = source; await el.updateComplete; el.remove();
  await new Promise(resolve => setTimeout(resolve, 30)); expect(el.points[0]!.id).to.equal('current');
  document.body.append(el);
  await waitUntil(() => el.points.at(-1)?.id === 'p29999', 'reconnected scan did not finish');
  el.remove();
});

it('activates the displayed completed point while a replacement is pending, then the committed winner', async () => {
  const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .points=${[{ id: 'same', x: 1, y: 0, label: 'Completed point' }]}></lr-embedding-explorer>`);
  const source = Array.from({ length: 30_000 }, (_, index) => ({ id: index === 0 ? 'same' : `p${index}`, x: index, y: 0, label: 'Replacement point' }));
  const activated: EmbeddingPoint[] = [];
  el.addEventListener('lr-point-select', event => activated.push(event.detail.point));
  el.points = source; await el.updateComplete;
  el.shadowRoot!.querySelector('[data-id="same"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(activated[0]!.label).to.equal('Completed point'); expect(activated[0]!.x).to.equal(1);
  await waitUntil(() => el.points[0]?.label === 'Replacement point', 'replacement did not finish'); await el.updateComplete;
  el.shadowRoot!.querySelector('[data-id="same"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(activated[1]!.label).to.equal('Replacement point'); expect(activated[1]!.x).to.equal(0);
});

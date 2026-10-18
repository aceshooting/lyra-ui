import { expect, fixture, html, waitUntil, nextFrame } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import './geojson-viewer.js';
import type { LyraGeoJsonViewer } from './geojson-viewer.class.js';
import type { LyraMap } from '../../media/map/map.class.js';
const data = { type: 'FeatureCollection', features: Array.from({ length: 1000 }, (_, id) => ({ type: 'Feature', id, geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} })) };
async function viewer() {
  const el = await fixture<LyraGeoJsonViewer>(html`<lr-geojson-viewer></lr-geojson-viewer>`);
  (el as unknown as { forceMissingMaplibreForTesting: boolean }).forceMissingMaplibreForTesting = true;
  return el;
}
it('does not register the fallback JSON viewer on the ordinary registration path', () => {
  expect(customElements.get('lr-json-viewer') === undefined).equal(true);
});
it('rejects responses over four MiB before JSON parsing', async () => {
  const fetch = window.fetch; const parse = JSON.parse; let parses = 0;
  const payload = ' '.repeat(4 * 1024 * 1024) + JSON.stringify(data);
  window.fetch = async () => new Response(payload);
  JSON.parse = function(text: string, reviver?: (this: unknown, key: string, value: unknown) => unknown) { if (text === payload) parses++; return parse(text, reviver); };
  try {
    const el = await viewer(); el.src = 'https://example.test/large.geojson';
    await waitUntil(() => !!el.shadowRoot!.querySelector('[part="error"], [part="metadata"]'));
    expect(parses).equal(0);
    expect(el.shadowRoot!.querySelector('[part="error"]') !== null).equal(true);
    recordScaleMeasurement('lr-geojson-viewer', 'n=1000 oversized response preparse', { parses });
  } finally { window.fetch = fetch; JSON.parse = parse; }
});
it('retains a loaded thousand-feature document across disconnect and reconnect', async () => {
  const fetch = window.fetch; let fetches = 0;
  window.fetch = async () => { fetches++; return new Response(JSON.stringify(data)); };
  try {
    const el = await viewer(); el.src = 'https://example.test/features.geojson';
    await waitUntil(() => !!el.shadowRoot!.querySelector('[part="metadata"]'));
    const parent = el.parentNode!; el.remove(); parent.appendChild(el);
    await el.updateComplete; await nextFrame(); await nextFrame();
    expect(fetches).equal(1);
    recordScaleMeasurement('lr-geojson-viewer', 'n=1000 reconnect', { fetches });
  } finally { window.fetch = fetch; }
});
it('keeps the child data-layer identity stable on an unrelated viewer render', async () => {
  const el = await viewer();
  (el as unknown as { loadState: unknown }).loadState = { kind: 'loaded', value: data, metadata: '{}', featureCount:1000, center:[0,0], zoom:1, peerAvailable:true };
  await el.updateComplete;
  const child = el.shadowRoot!.querySelector('lr-map') as LyraMap;
  await child.updateComplete;
  const before = child.dataLayers;
  el.name = 'Updated name'; await el.updateComplete;
  expect(child.dataLayers === before).equal(true);
});
it('rejects oversized pretty metadata before serializing the parsed document', async () => {
  let nested: unknown = Array.from({ length: 40000 }, () => 0);
  for (let depth = 0; depth < 55; depth++) nested = [nested];
  const document = { type: 'Feature', geometry: null, properties: { nested } };
  const payload = JSON.stringify(document); const stringify = JSON.stringify; const fetch = window.fetch; let serializations = 0;
  window.fetch = async () => new Response(payload);
  JSON.stringify = function(value: unknown, ...args: unknown[]) {
    if ((value as { type?: string } | null)?.type === 'Feature') serializations++;
    return Reflect.apply(stringify, JSON, [value, ...args]);
  } as typeof JSON.stringify;
  try {
    const el = await viewer(); el.src = 'https://example.test/metadata.geojson';
    await waitUntil(() => !!el.shadowRoot!.querySelector('[part="error"]'));
    expect(serializations).equal(0);
  } finally { JSON.stringify = stringify; window.fetch = fetch; }
});

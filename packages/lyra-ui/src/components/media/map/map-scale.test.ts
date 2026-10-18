import { expect } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { buildGeoJsonPropertyDiff, projectAdmittedGeoJson } from './map-geojson-diff.js';
it('diffs one thousand polygon property updates without a whole-source fallback', () => {
  const geometry = Array.from({ length:1000 }, () => ({ type:'Polygon', coordinates:[Array.from({ length:101 }, (_, i) => [i % 10, i % 10])] }));
  const collection = (value:number) => ({ type:'FeatureCollection', features:geometry.map((geometry,id) => ({ type:'Feature', id, geometry, properties:{value} })) });
  const before = collection(0); const after = collection(1);
  const diff = buildGeoJsonPropertyDiff(before, after);
  expect(diff === null).equal(false);
  expect(diff!.update.length).equal(1000);
  recordScaleMeasurement('lr-map', 'n=1000 polygons property diff', { updates:diff!.update.length });
});
it('reuses admitted polygon geometry projections across property-only collections', () => {
  const coordinate = [0, 0]; let reads = 0;
  const proxy = new Proxy(coordinate, { getOwnPropertyDescriptor(target,key) { reads++; return Reflect.getOwnPropertyDescriptor(target,key); } });
  const geometry = { type:'Polygon', coordinates:[Array.from({ length:1000 }, () => proxy)] };
  const collection = (value:number) => ({ type:'FeatureCollection', features:[{ type:'Feature', id:0, geometry, properties:{value} }] });
  projectAdmittedGeoJson(collection(0)); reads = 0;
  projectAdmittedGeoJson(collection(1));
  expect(reads).equal(0);
  recordScaleMeasurement('lr-map', 'n=1000 retained geometry coordinates', { reads });
});

import { fixture, html, nextFrame } from '@open-wc/testing';
import './map.js';
import type { LyraMap } from './map.class.js';
async function mountMap() {
  const wrapper = await fixture<HTMLElement>(html`<div></div>`);
  const el = document.createElement('lr-map') as LyraMap;
  (el as unknown as { loadLibrary(): Promise<unknown> }).loadLibrary = () => new Promise(() => {});
  wrapper.append(el); await el.updateComplete; await nextFrame(); return el;
}
it('skips peer semantics and marker writes on unrelated changes', async () => {
  const el = await mountMap(); let scans = 0; let writes = 0;
  const seam = el as unknown as { syncPeerChromeParts(): void; _markerInstances: Map<string, unknown>; semanticsStale: boolean };
  seam.syncPeerChromeParts = () => scans++;
  for (let i=0;i<1000;i++) {
    const element = document.createElement('div'); const set = element.setAttribute.bind(element);
    element.setAttribute = (...args) => { writes++; set(...args); };
    seam._markerInstances.set(String(i), { getElement: () => element, remove() {} });
  }
  seam.semanticsStale = false; el.legendCollapsible = true; await el.updateComplete;
  expect(scans).equal(0); expect(writes).equal(0);
  recordScaleMeasurement('lr-map', 'n=1000 markers unrelated update', { scans, writes });
});
it('does not repaint unchanged layer styles for a data-only update', async () => {
  const el = await mountMap(); let paints = 0;
  const sources = new Map(); const layers = new Set();
  const seam = el as unknown as { _map: unknown; applyDataLayers(): void };
  seam._map = { getSource: (id:string) => sources.get(id), addSource:(id:string) => sources.set(id,{setData(){},updateData(){}}), getLayer:(id:string) => layers.has(id), addLayer:(layer:{id:string}) => layers.add(layer.id), setPaintProperty:() => paints++, remove(){} };
  const geojson = (value:number) => ({type:'FeatureCollection' as const, features:[{ type:'Feature' as const,id:0,geometry:{type:'Point' as const,coordinates:[0,0]},properties:{value} }]});
  el.dataLayers = [{sourceId:'zones',geojson:geojson(0),color:'red'}]; seam.applyDataLayers(); paints=0;
  el.dataLayers = [{sourceId:'zones',geojson:geojson(1),color:'red'}]; seam.applyDataLayers();
  expect(paints).equal(0); recordScaleMeasurement('lr-map','n=1 data-only layer update',{paints});
});
it('forwards consumer diffs by public source id and invalidates automatic diff history', async () => {
  const el = await mountMap(); let forwarded: unknown; let receiver: unknown;
  const source = { updateData(diff: unknown) { forwarded=diff; receiver=this; } };
  const seam = el as unknown as { _map: unknown; _styleLoaded: boolean; _appliedDataLayerIds: Map<string,string>; _appliedGeoJson: Map<string,unknown> };
  seam._map = { getSource:(id:string) => id==='private-source' ? source : undefined, remove(){} }; seam._styleLoaded=true;
  seam._appliedDataLayerIds.set('public-source','private-source'); seam._appliedGeoJson.set('private-source',{});
  const diff = { update:[{id:0,newGeometry:{type:'Point',coordinates:[1,2]}}] };
  const update = (el as unknown as { updateSourceData(id:string,diff:unknown): boolean }).updateSourceData;
  expect(typeof update).equal('function');
  expect(update.call(el,'public-source',diff)).equal(true); expect(forwarded===diff).equal(true); expect(receiver===source).equal(true);
  expect(seam._appliedGeoJson.has('private-source')).equal(false);
  expect(update.call(el,'private-source',diff)).equal(false);
});
it('reports marker truncation without allocating all authored markers', async () => {
  const el = await mountMap(); el.markers = Array.from({length:2001},(_,id)=>({id:String(id),lngLat:[0,0] as const}));
  expect((el as unknown as { markersTruncated: boolean }).markersTruncated).equal(true);
  el.markers=[]; expect((el as unknown as { markersTruncated: boolean }).markersTruncated).equal(false);
});
it('ignores unrelated ancestor style changes without repainting layers or rebuilding markers', async () => {
  const el = await mountMap(); el.markers = Array.from({length:1000}, (_, id) => ({id:String(id),lngLat:[0,0] as const}));
  await el.updateComplete; let paints = 0; let markerPasses = 0;
  const seam = el as unknown as { refreshThemePaint(): void; applyMarkers(): void };
  seam.refreshThemePaint = () => paints++; seam.applyMarkers = () => markerPasses++;
  el.parentElement!.style.padding = '1px'; await nextFrame(); await nextFrame();
  paints=0; markerPasses=0;
  el.parentElement!.style.padding = '2px'; await nextFrame(); await nextFrame();
  expect(paints).equal(0); expect(markerPasses).equal(0);
  recordScaleMeasurement('lr-map', 'n=1000 marker theme noise', { paints, markerPasses });
});
it('keeps default marker and popup identities through a brand-color change', async () => {
  const el = await mountMap(); let creations = 0;
  class Marker {
    element = document.createElement('div'); popup: unknown;
    constructor(readonly options?: { color?: string }) { creations++; this.element.className='maplibregl-marker'; }
    setLngLat() { return this; } setPopup(popup: unknown) { this.popup=popup; return this; }
    getPopup() { return this.popup; } getElement() { return this.element; }
    addTo() { el.shadowRoot!.append(this.element); return this; } remove() { this.element.remove(); }
  }
  class Popup {
    options = {}; element = document.createElement('div');
    setText(text:string) { this.element.textContent=text; return this; }
    getElement() { return this.element; } isOpen() { return true; }
  }
  const seam = el as unknown as { _map:unknown; _maplibreModule:unknown; applyMarkers():void; _markerInstances:Map<string,Marker> };
  seam._map={remove(){}}; seam._maplibreModule={Marker,Popup}; el.markers=[{id:'a',lngLat:[0,0],label:'Open popup'}];
  el.style.setProperty('--lr-color-brand','rgb(1, 2, 3)'); seam.applyMarkers();
  const before=seam._markerInstances.get('id:a'); const popup=before!.getPopup();
  el.style.setProperty('--lr-color-brand','rgb(4, 5, 6)'); seam.applyMarkers();
  expect(seam._markerInstances.get('id:a')===before).equal(true); expect(creations).equal(1);
  expect(seam._markerInstances.get('id:a')!.getPopup()===popup).equal(true);
  expect((popup as Popup).isOpen()).equal(true);
});
it('skips text-only peer chrome observer batches', async () => {
  const el=await mountMap();
  const seam=el as unknown as { observePeerChrome():void; measurePeerControlInsets(container:HTMLElement):void; containerEl:HTMLElement };
  const container=document.createElement('div');
  el.shadowRoot!.append(container); Object.defineProperty(el, 'containerEl', { configurable:true, value:container });
  seam.observePeerChrome(); await nextFrame();
  let measurements=0; const original=seam.measurePeerControlInsets;
  seam.measurePeerControlInsets=()=>measurements++;
  try {
    seam.containerEl.append(document.createTextNode('scale'));
    await nextFrame(); await nextFrame(); expect(measurements).equal(0);
  } finally { seam.measurePeerControlInsets=original; }
});
it('leaves explicit source updates unavailable until an incremental source exists', async () => {
  const el=await mountMap(); const diff={removeAll:true};
  expect(el.updateSourceData('missing',diff)).equal(false);
  const seam=el as unknown as { _map:unknown; _styleLoaded:boolean; _appliedDataLayerIds:Map<string,string> };
  seam._map={getSource:()=>({setData(){}}),remove(){}}; seam._styleLoaded=true;
  seam._appliedDataLayerIds.set('public','resolved');
  expect(el.updateSourceData('public',diff)).equal(false);
  el.remove(); expect(el.updateSourceData('public',diff)).equal(false);
});

import { registerLyraLocale } from '../../../internal/localization.js';
it('refreshes canvas, marker and popup semantics for a coalesced public locale update', async () => {
  registerLyraLocale('fr-XA', { map: 'Carte test', close: 'Fermer test', loading: 'Chargement test', zoomIn: 'Agrandir test' });
  const el = await mountMap();
  const canvas = document.createElement('canvas');
  const marker = document.createElement('button');
  const popup = document.createElement('div');
  const close = document.createElement('button'); close.className = 'maplibregl-popup-close-button'; popup.append(close);
  const zoom = document.createElement('button'); zoom.className = 'maplibregl-ctrl-zoom-in';
  el.shadowRoot!.append(canvas, marker, popup, zoom);
  const seam = el as unknown as { _map: unknown; _markerInstances: Map<string, unknown>; syncMapSemantics(): void };
  seam._map = { getCanvas: () => canvas, remove() {} };
  seam._markerInstances.set('a', { getElement: () => marker, getPopup: () => ({ getElement: () => popup, isOpen: () => true }), remove() {} });
  seam.syncMapSemantics(); await el.updateComplete;
  expect(canvas.getAttribute('lang')).not.equal('fr-XA');
  el.legendCollapsible = true; el.locale = 'fr-XA'; await el.updateComplete;
  expect(canvas.getAttribute('lang')).equal('fr-XA');
  expect(canvas.getAttribute('aria-label')).equal('Carte test');
  expect(marker.getAttribute('aria-label')).equal('Carte test');
  expect(popup.getAttribute('lang')).equal('fr-XA');
  expect(popup.getAttribute('aria-label')).equal('Carte test');
  expect(close.getAttribute('aria-label')).equal('Fermer test');
  expect(zoom.getAttribute('aria-label')).equal('Agrandir test');
  expect(zoom.title).equal('Agrandir test');
});
it('repaints a step base color when its ancestor custom token changes', async () => {
  const el = await mountMap(); const parent = el.parentElement!;
  parent.style.setProperty('--custom-base', 'rgb(1, 2, 3)');
  let expression: unknown[] = []; let exists = false;
  const seam = el as unknown as { _map: unknown; applyChoropleth(): void };
  seam._map = { getSource: () => exists ? { setData() {} } : undefined, addSource() {}, getLayer: () => exists,
    addLayer(spec: { paint: Record<string, unknown> }) { expression = spec.paint['fill-color'] as unknown[]; exists = true; },
    setPaintProperty(_id: string, key: string, value: unknown) { if (key === 'fill-color') expression = value as unknown[]; }, remove() {} };
  el.choropleth = { sourceId: 'regions', geojson: { type: 'FeatureCollection', features: [] }, field: 'value',
    stops: [[10, 'red'], [20, 'blue']], interpolation: 'step', stepBaseColor: 'var(--custom-base)' };
  (el as unknown as { _styleLoaded: boolean })._styleLoaded = true;
  seam.applyChoropleth(); await el.updateComplete; await nextFrame(); await nextFrame();
  expect(expression[2]).equal('rgb(1, 2, 3)');
  parent.style.setProperty('--custom-base', 'rgb(4, 5, 6)'); await nextFrame(); await nextFrame();
  expect(expression[2]).equal('rgb(4, 5, 6)');
});

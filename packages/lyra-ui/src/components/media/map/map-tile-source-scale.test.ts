import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { addProtocol, removeProtocol, getWorkerUrl, setWorkerUrl, type Map as ModularMap } from '@aceshooting/lyra-map';
import { catalogPoint, catalogVectorTile, VECTOR_CATALOG_COUNT } from '../../../../test/map-vector-tile.js';
import { recordScaleMeasurement, renderedNodeCount } from '../../../../test/scale-budgets.js';
import './map.js';
import type { LyraMap } from './map.class.js';
import type { Feature, Point } from 'geojson';

it('reaches first middle and final million-catalog features through real modular vector tiles and bounded overlays', async function () {
  this.timeout(30000);
  const previousWorkerUrl = getWorkerUrl();
  setWorkerUrl(new URL('/__lyra-map-worker__/worker.mjs', location.origin).href);
  const protocol = 'lyracatalog';
  let requests = 0, generatedFeatures = 0, maxTileFeatures = 0, maxTileBytes = 0;
  const requestedTiles = new Set<string>();
  addProtocol(protocol, async (parameters) => {
    const match = /^lyracatalog:\/\/tiles\/(\d+)\/(\d+)\/(\d+)\.pbf$/.exec(parameters.url);
    if (!match) throw new Error('Unexpected catalog URL');
    const [z, x, y] = match.slice(1).map(Number) as [number, number, number];
    const tile = catalogVectorTile(z, x, y);
    requests++; requestedTiles.add(`${z}/${x}/${y}`);
    generatedFeatures += tile.featureCount;
    maxTileFeatures = Math.max(maxTileFeatures, tile.featureCount);
    maxTileBytes = Math.max(maxTileBytes, tile.data.byteLength);
    return { data: tile.data };
  });
  let element: LyraMap | undefined;
  const errors: string[] = [];
  const feature = (index: number, phase: string): Feature<Point> => ({
    type: 'Feature', id: index, properties: { catalogIndex: index, phase },
    geometry: { type: 'Point', coordinates: catalogPoint(index).coordinates },
  });
  try {
    element = await fixture<LyraMap>(html`<lr-map style="width:320px;--lr-map-height:240px" zoom="10" .center=${catalogPoint(0).coordinates} .mapStyle=${{
      version: 8,
      sources: { catalog: { type: 'vector', tiles: [`${protocol}://tiles/{z}/{x}/{y}.pbf`], minzoom: 10, maxzoom: 10 } },
      layers: [{ id: 'catalog-points', type: 'circle', source: 'catalog', 'source-layer': 'catalog', paint: { 'circle-radius': 9, 'circle-color': '#123456' } }],
    }}></lr-map>`);
    expect(element.engine).to.equal('modular');
    await waitUntil(() => element?.map !== undefined, 'real modular peer must construct', { timeout: 12000 });
    const peer = element.map as unknown as ModularMap;
    peer.on('error', event => errors.push(event.error.message));
    expect(typeof peer.prepareFeatures).to.equal('function');
    const context = peer.getCanvas().getContext('webgl2');
    expect(context !== null, 'actual WebGL2 context').to.equal(true);
    const reached: number[] = [];
    for (const index of [0, 500000, 999999]) {
      const coordinates = catalogPoint(index).coordinates;
      peer.jumpTo({ center: coordinates, zoom: 10 });
      await waitUntil(() => peer.loaded() && peer.queryRenderedFeatures(peer.project(coordinates), { layers: ['catalog-points'] }).some(value => value.id === index), `actual tile hit ${index}`, { timeout: 10000 });
      const hit = peer.queryRenderedFeatures(peer.project(coordinates), { layers: ['catalog-points'] }).find(value => value.id === index)!;
      expect(hit.properties['catalogIndex']).to.equal(index);
      expect(hit.properties['name']).to.equal(`Record ${index}`);
      const [x, y] = catalogPoint(index).tile;
      expect(requestedTiles.has(`10/${x}/${y}`)).to.equal(true);
      reached.push(index);
    }
    const firstOverlay = 999999;
    element.dataLayers = [{ sourceId: 'selection', geojson: { type: 'FeatureCollection', features: [feature(firstOverlay, 'initial')] }, point: { radius: 12 }, color: '#b00020' }];
    await element.updateComplete;
    const overlayHits = () => peer.queryRenderedFeatures(peer.project(catalogPoint(firstOverlay).coordinates)).filter(value => value.properties['phase']);
    await waitUntil(() => overlayHits().some(value => value.properties['phase'] === 'initial'), 'real GeoJSON overlay', { timeout: 10000 });
    expect(element.updateSourceData('selection', { update: [{ id: firstOverlay, addOrUpdateProperties: [{ key: 'phase', value: 'diff' }] }] })).to.equal(true);
    await waitUntil(() => overlayHits().some(value => value.properties['phase'] === 'diff'), 'worker-applied public diff', { timeout: 10000 });
    const replacementIndex = 500000;
    element.dataLayers = [{ sourceId: 'selection', geojson: feature(replacementIndex, 'replacement'), point: { radius: 12 }, color: '#b00020' }];
    await element.updateComplete;
    peer.jumpTo({ center: catalogPoint(replacementIndex).coordinates, zoom: 10 });
    await waitUntil(() => peer.loaded() && peer.queryRenderedFeatures(peer.project(catalogPoint(replacementIndex).coordinates)).some(value => value.id === replacementIndex && value.properties['phase'] === 'replacement'), 'actual Feature replacement', { timeout: 10000 });
    expect(reached).to.deep.equal([0, 500000, 999999]);
    expect(errors).to.deep.equal([]);
    expect(requests).to.be.at.most(100);
    expect(maxTileFeatures).to.equal(1);
    expect(maxTileBytes).to.be.lessThan(256);
    expect(element.markers.length).to.equal(0);
    recordScaleMeasurement('lr-map', 'tile-source@1000000:three-cameras-overlay-diff', {
      logicalRecords: VECTOR_CATALOG_COUNT, reachedRecords: reached.length,
      tileRequests: requests, uniqueTiles: requestedTiles.size, generatedFeatures, maxTileFeatures,
      overlayRecords: 1, dataLayerDescriptors: element.dataLayers.length, markers: element.markers.length,
      canvases: element.shadowRoot!.querySelectorAll('canvas').length, domNodes: renderedNodeCount(element),
    }, { maxTileBytes });
  } finally {
    element?.remove();
    removeProtocol(protocol);
    setWorkerUrl(previousWorkerUrl);
  }
});

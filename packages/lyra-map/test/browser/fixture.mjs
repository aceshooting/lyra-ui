const receipt = await (await fetch('./receipt.json')).json();
const entry = receipt.entries.find((x) => x.facade === '\0modular-entry').file;
const engine = await import('./' + entry);
const data = await (await fetch('./data.json')).json();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const maps = new Set();
function assert(condition, message) {
  if (!condition) throw Error(message);
}
async function until(check, message, limit = 12000) {
  const end = performance.now() + limit;
  while (performance.now() < end) {
    if (check()) return;
    await sleep(25);
  }
  throw Error('Timeout: ' + message);
}
function base() {
  return {
    version: 8,
    sources: {},
    layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#123456' } }]
  };
}
function geoStyle(types = ['circle', 'line', 'fill']) {
  return {
    ...base(),
    sources: { sample: { type: 'geojson', data } },
    layers: [
      ...base().layers,
      ...types.map((type) => ({
        id: type,
        type,
        source: 'sample',
        paint:
          type === 'circle'
            ? { 'circle-radius': 12, 'circle-color': '#ff0000' }
            : type === 'line'
            ? { 'line-width': 4, 'line-color': '#00ff00' }
            : type === 'fill'
            ? { 'fill-color': '#ff00ff', 'fill-opacity': 0.5 }
            : type === 'fill-extrusion'
            ? { 'fill-extrusion-color': '#ff00ff', 'fill-extrusion-height': 200000 }
            : {}
      }))
    ]
  };
}
function rasterStyle() {
  return {
    ...base(),
    sources: {
      raster: { type: 'raster', tiles: [location.origin + '/raster.png'], tileSize: 256, minzoom: 0, maxzoom: 0 }
    },
    layers: [...base().layers, { id: 'raster', type: 'raster', source: 'raster' }]
  };
}
function vectorStyle() {
  return {
    ...base(),
    'font-faces': { 'Test Font': [{ url: location.origin + '/font.ttf' }] },
    sources: { v: { type: 'vector', tiles: [location.origin + '/tile.pbf'], minzoom: 0, maxzoom: 0 } },
    layers: [
      ...base().layers,
      ...['fill', 'line', 'circle'].map((type) => ({
        id: type,
        type,
        source: 'v',
        'source-layer': 'sample',
        paint: type === 'line' ? { 'line-width': 3 } : type === 'circle' ? { 'circle-radius': 8 } : {}
      })),
      {
        id: 'symbol',
        type: 'symbol',
        source: 'v',
        'source-layer': 'sample',
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Test Font'], 'text-size': 18 }
      }
    ]
  };
}
async function make(style, { waitForLoad = true } = {}) {
  const container = document.createElement('div');
  container.style.cssText = 'width:640px;height:480px';
  document.body.append(container);
  const map = new engine.Map({ container, style, center: [0, 0], zoom: 1, attributionControl: false, fadeDuration: 0 });
  map.on('error', (event) =>
    errors.push({ message: event.error?.message ?? String(event.error), map: map.getContainer() === container })
  );
  maps.add(map);
  if (waitForLoad) await until(() => map.loaded(), 'initial map load');
  return map;
}
async function change(map, style) {
  let loaded = false;
  const handler = () => (loaded = true);
  map.once('style.load', handler);
  map.setStyle(style);
  await until(() => loaded && map.loaded(), 'style update');
}
function remove(map) {
  if (maps.delete(map)) {
    const c = map.getContainer();
    map.remove();
    c.remove();
  }
}
async function finish() {
  for (const map of [...maps]) remove(map);
  await sleep(100);
}
window.fixture = {
  engine,
  errors,
  base,
  geoStyle,
  rasterStyle,
  vectorStyle,
  make,
  change,
  finish,
  until,
  sleep,
  async run(name) {
    const startErrors = errors.length;
    if (name === 'canvas-image') {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ff5500';
      ctx.fillRect(0, 0, 64, 64);
      const style = base();
      const coordinates = [
        [-40, 40],
        [40, 40],
        [40, -40],
        [-40, -40]
      ];
      style.sources.canvas = { type: 'canvas', canvas, animate: false, coordinates };
      style.sources.image = { type: 'image', url: location.origin + '/raster.png', coordinates };
      style.layers.push(
        { id: 'canvas', type: 'raster', source: 'canvas' },
        { id: 'image', type: 'raster', source: 'image' }
      );
      const m = await make(style);
      assert(m.getSource('canvas').getCanvas() === canvas, 'canvas identity preserved');
      assert(m.getSource('image').loaded(), 'image loaded');
      remove(m);
    } else if (name === 'raster') {
      const m = await make(rasterStyle());
      assert(m.getSource('raster'), 'raster source');
      assert(
        m.getCanvas().getAttribute('role') === 'region' || m.getCanvas().getAttribute('aria-label'),
        'named map canvas'
      );
      remove(m);
    } else if (name === 'geojson') {
      const m = await make(geoStyle());
      assert(
        m.queryRenderedFeatures().some((f) => f.id === 1),
        'GeoJSON point renders'
      );
      m.getSource('sample').setData({ type: 'FeatureCollection', features: [{ ...data.features[0], id: 99 }] });
      await until(() => m.queryRenderedFeatures().some((f) => f.id === 99), 'incremental GeoJSON');
      remove(m);
    } else if (name === 'vector-symbol') {
      const m = await make(vectorStyle());
      await until(() => m.queryRenderedFeatures().some((f) => f.layer.id === 'symbol'), 'vector text symbol renders');
      assert(document.fonts.size > 0, 'declared font loaded');
      remove(m);
    } else if (name === 'cluster') {
      const style = geoStyle(['circle']);
      style.sources.sample.cluster = true;
      style.sources.sample.data = {
        type: 'FeatureCollection',
        features: Array.from({ length: 20 }, (_, i) => ({
          ...data.features[0],
          id: i,
          geometry: { type: 'Point', coordinates: [i / 100, 0] }
        }))
      };
      const m = await make(style);
      const cluster = m.querySourceFeatures('sample').find((f) => f.properties.cluster);
      assert(cluster, 'cluster emitted');
      const source = m.getSource('sample');
      assert(Number.isFinite(await source.getClusterExpansionZoom(cluster.properties.cluster_id)), 'cluster expansion');
      assert((await source.getClusterLeaves(cluster.properties.cluster_id, 30, 0)).length === 20, 'cluster leaves');
      remove(m);
    } else if (name === 'prepare-features-null-style') {
      const m = await make(null, { waitForLoad: false });
      const style = geoStyle(['circle']);
      await m.prepareFeatures({ sources: style.sources, layers: style.layers });
      m.addSource('sample', style.sources.sample);
      m.addLayer(style.layers.find((layer) => layer.id === 'circle'));
      await until(
        () => m.loaded() && m.queryRenderedFeatures().some((f) => f.id === 1),
        'prepared imperative source and layer render'
      );
      remove(m);
    } else if (name === 'invalid-source-preparation') {
      const m = await make(base());
      const activeStyle = m.style;
      const serializedStyle = JSON.stringify(m.getStyle());
      const rejected = [];
      for (const type of ['does-not-exist', 'toString', 'constructor', '__proto__']) {
        const sources = { bad: { type } };
        for (const [method, prepare] of [
          ['prepareStyle', () => engine.prepareStyle({ version: 8, sources, layers: [] })],
          ['prepareFeatures', () => m.prepareFeatures({ sources })]
        ]) {
          let failure;
          try { await prepare(); } catch (error) { failure = error; }
          if (!(failure instanceof Error) || !failure.message.includes('Unknown feature ' + type)) {
            rejected.push(method + ':' + type + ':' + (failure?.message ?? 'resolved'));
          }
          assert(m.style === activeStyle, method + ' keeps the active style for ' + type);
          assert(JSON.stringify(m.getStyle()) === serializedStyle, method + ' leaves style data unchanged for ' + type);
          assert(!m.getSource('bad'), method + ' does not install ' + type);
        }
      }
      assert(rejected.length === 0, 'Unknown source preparation must reject: ' + rejected.join(', '));
      const style = geoStyle(['circle']);
      await Promise.all([
        engine.prepareStyle(style),
        engine.prepareStyle(style),
        m.prepareFeatures({ sources: style.sources, layers: style.layers }),
        m.prepareFeatures({ sources: style.sources, layers: style.layers })
      ]);
      assert(m.style === activeStyle, 'concurrent valid preparation keeps the active style');
      assert(JSON.stringify(m.getStyle()) === serializedStyle, 'valid preparation does not mutate style data');
      m.addSource('sample', style.sources.sample);
      m.addLayer(style.layers.find((layer) => layer.id === 'circle'));
      await until(
        () => m.loaded() && m.queryRenderedFeatures().some((feature) => feature.id === 1),
        'valid source and layer still render after rejected and concurrent preparations'
      );
      remove(m);
    } else if (name === 'invalid-remote-metadata') {
      const m = await make(base());
      const resourceCounts = async () => (await fetch('/metadata-observation.json')).json();
      const before = await resourceCounts();
      const remote = { type: 'raster', url: location.origin + '/metadata-invalid-tilejson.json' };
      const layer = { id: 'remote', type: 'raster', source: 'remote' };
      await m.prepareFeatures({ sources: { remote }, layers: [layer] });
      m.addSource('remote', remote);
      m.addLayer(layer);
      await until(() => errors.length > startErrors, 'invalid remote TileJSON error');
      assert(errors.length === startErrors + 1, 'one TileJSON error');
      assert(errors[startErrors].message.includes('Invalid TileJSON scheme'), 'TileJSON error names invalid metadata');
      assert(m.getLayer('bg') && m.getLayer('remote'), 'existing style and layer remain available');
      assert((await resourceCounts()).forbiddenTiles === before.forbiddenTiles, 'invalid TileJSON schedules no tile request');
      m.getSource('remote').setUrl(location.origin + '/metadata-valid-tilejson.json');
      await until(() => m.loaded() && m.isSourceLoaded('remote'), 'valid TileJSON replacement recovers source');
      assert((await resourceCounts()).rasterTiles > before.rasterTiles, 'recovered source requested its valid tile');

      m.addImage('existing', { width: 1, height: 1, data: new Uint8Array([0, 0, 0, 255]) });
      m.setSprite(location.origin + '/metadata-invalid-sprite');
      await until(() => errors.length > startErrors + 1, 'invalid remote sprite error');
      assert(errors.length === startErrors + 2, 'one sprite metadata error');
      assert(errors[startErrors + 1].message.includes('Invalid sprite metadata'), 'sprite error names invalid metadata');
      assert(m.hasImage('existing'), 'failed sprite leaves existing runtime image intact');
      assert(!m.hasImage('partial') && !m.hasImage('broken'), 'failed sprite installs no partial icon set');
      m.setSprite(location.origin + '/metadata-valid-sprite');
      await until(() => m.loaded() && m.hasImage('recovered'), 'valid sprite replacement recovers');
      const recovered = m.getImage('recovered');
      assert(recovered.data.width === 16 && recovered.data.height === 16, 'recovered icon extracts valid pixels');
      assert(m.hasImage('existing'), 'recovery keeps runtime image');
      const iconData = { type: 'FeatureCollection', features: ['constructor', '__proto__', 'hasOwnProperty'].map((icon, index) => ({
        type: 'Feature', id: 900 + index, geometry: { type: 'Point', coordinates: [-20 + index * 20, 0] }, properties: { icon }
      })) };
      const iconSource = { type: 'geojson', data: iconData };
      const iconLayer = { id: 'reserved-icons', type: 'symbol', source: 'reserved-icons', layout: {
        'icon-image': ['get', 'icon'], 'icon-overlap': 'always'
      } };
      await m.prepareFeatures({ sources: { 'reserved-icons': iconSource }, layers: [iconLayer] });
      m.addSource('reserved-icons', iconSource);
      m.addLayer(iconLayer);
      await until(() => m.loaded() && ['constructor', '__proto__', 'hasOwnProperty'].every(icon =>
        m.queryRenderedFeatures({ layers: ['reserved-icons'] }).some(feature => feature.properties.icon === icon)),
      'reserved sprite names render through worker transport and atlas');
      m.removeLayer('reserved-icons');
      m.removeSource('reserved-icons');
      for (const id of ['constructor', '__proto__', 'hasOwnProperty']) {
        assert(m.listImages().includes(id), id + ' is stored as an own image name');
        assert(m.getImage(id).data.width === 16, id + ' extracts sprite pixels');
        m.removeImage(id);
        assert(!m.hasImage(id) && !m.listImages().includes(id), id + ' removal clears the own image');
        m.addImage(id, { width: 1, height: 1, data: new Uint8Array([0, 0, 0, 255]) });
        assert(m.getImage(id).data.width === 1, id + ' supports a runtime replacement');
        m.removeImage(id);
        assert(!m.hasImage(id), id + ' runtime replacement removes cleanly');
      }
      assert((await resourceCounts()).forbiddenTiles === before.forbiddenTiles, 'recovery does not request rejected tiles');
      remove(m);
      await sleep(100);
      assert(errors.length === startErrors + 2, 'no additional source or sprite errors after recovery and removal');
      return { name, passed: true, expectedErrors: errors.slice(startErrors) };
    } else if (name === 'controls-exports') {
      const m = await make(base());
      for (const name of ['AttributionControl', 'NavigationControl', 'GeolocateControl', 'ScaleControl']) {
        assert(typeof engine[name] === 'function', name + ' export');
        const control = new engine[name]();
        m.addControl(control);
        assert(m.hasControl(control), name + ' installed');
        m.removeControl(control);
        assert(!m.hasControl(control), name + ' removed');
      }
      remove(m);
    } else if (name === 'dynamic-features') {
      const m = await make(base());
      await change(m, geoStyle(['circle', 'line', 'fill', 'heatmap', 'fill-extrusion']));
      assert(m.getLayer('heatmap') && m.getLayer('fill-extrusion'), 'feature families installed');
      const style = m.getStyle();
      await engine.prepareStyle({ ...style, projection: { type: 'globe' } });
      m.setProjection({ type: 'globe' });
      await until(() => m.loaded(), 'globe');
      await engine.prepareStyle({ ...style, projection: { type: 'vertical-perspective' } });
      m.setProjection({ type: 'vertical-perspective' });
      await until(() => m.loaded(), 'vertical perspective');
      m.setProjection({ type: 'mercator' });
      await until(() => m.loaded(), 'mercator');
      remove(m);
    } else if (name === 'terrain') {
      const style = geoStyle(['circle']);
      style.sources.dem = {
        type: 'raster-dem',
        tiles: [location.origin + '/dem.png'],
        tileSize: 256,
        maxzoom: 0,
        encoding: 'mapbox'
      };
      style.sources.shade = { ...style.sources.dem };
      style.sources.relief = { ...style.sources.dem };
      style.terrain = { source: 'dem', exaggeration: 1 };
      style.layers.push(
        { id: 'hillshade', type: 'hillshade', source: 'shade' },
        { id: 'relief', type: 'color-relief', source: 'relief' }
      );
      const m = await make(style);
      assert(m.getTerrain()?.source === 'dem', 'terrain active');
      await until(() => m.loaded(), 'DEM loads');
      remove(m);
    } else if (name === 'custom') {
      const m = await make(base());
      let added = 0,
        rendered = 0;
      const layer = {
        id: 'custom',
        type: 'custom',
        renderingMode: '2d',
        onAdd() {
          added++;
        },
        render() {
          rendered++;
        }
      };
      await engine.prepareStyle({ ...m.getStyle(), layers: [...m.getStyle().layers, layer] });
      m.addLayer(layer);
      m.triggerRepaint();
      await until(() => rendered > 0, 'custom render');
      assert(added === 1, 'custom onAdd once');
      remove(m);
    } else if (name === 'url-transform') {
      const m = await make(base());
      let transformed = 0;
      let loaded = false;
      m.once('style.load', () => (loaded = true));
      m.setStyle(location.origin + '/style.json', {
        transformStyle(_previous, next) {
          transformed++;
          return { ...next, layers: [...next.layers, { id: 'heatmap', type: 'heatmap', source: 'sample' }] };
        }
      });
      await until(() => loaded && m.loaded(), 'URL transformed style');
      assert(transformed === 1, 'transformStyle once');
      assert(m.getLayer('heatmap'), 'transformed feature prepared');
      remove(m);
    } else if (name === 'context-restore') {
      const m = await make(geoStyle());
      const ext = m.getCanvas().getContext('webgl2').getExtension('WEBGL_lose_context');
      assert(ext, 'context loss extension');
      let lost = false,
        restored = false;
      m.on('webglcontextlost', () => (lost = true));
      m.on('webglcontextrestored', () => (restored = true));
      ext.loseContext();
      await until(() => lost, 'context lost');
      ext.restoreContext();
      await until(() => restored && m.loaded(), 'context restore');
      assert(m.queryRenderedFeatures().length > 0, 'features after restoration');
      remove(m);
    } else if (name === 'reconnect') {
      let m = await make(geoStyle());
      remove(m);
      m = await make(vectorStyle());
      assert(m.queryRenderedFeatures().length > 0, 'fresh map after removal');
      remove(m);
    } else throw Error('Unknown case ' + name);
    assert(errors.length === startErrors, JSON.stringify(errors.slice(startErrors)));
    return { name, passed: true };
  }
};
window.ready = true;

export const preparedAdversarialCases = [
  'prepared-held-import',
  'prepared-failed-import',
  'prepared-cancel-import',
  'prepared-style-import',
  'prepared-remove-import',
  'prepared-newer-import'
];

/** Exercise the public shorthand against a real, cold, intercepted renderer import. */
export async function preparedAdversarial(browser, url, name) {
  const context = await browser.newContext();
  const pageErrors = [], consoleErrors = [], imports = [], routeErrors = [], routes = new Set();
  context.on('page', page => {
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  });
  const page = await context.newPage();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const failed = name === 'prepared-failed-import';
  await page.route('**/shader-heatmap-*.*js', route => {
    const work = (async () => {
    imports.push(route.request().url());
    await gate;
    if (failed) {
      // A valid module response that fails evaluation rejects import() without a failed-network
      // console exception. Every console/page error is still recorded and fails this fixture.
      await route.fulfill({ status: 200, contentType: 'text/javascript',
        body: 'throw new Error("Prepared fixture module evaluation failure");' });
    } else await route.continue();
    })().catch(error => { routeErrors.push(error.message); });
    routes.add(work);
    return work.finally(() => routes.delete(work));
  });
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  let outcome, before, after;
  try {
    await page.goto(url); await page.waitForFunction(() => window.ready);
    await page.evaluate(async () => {
      const map = window.targetMap = await window.fixture.make(window.fixture.base());
      window.originalPreparedMap = map;
      window.originalPreparedStyle = map.style;
      window.originalPreparedJSON = JSON.stringify(map.getStyle());
      window.samplePreparedPixel = target => new Promise(resolve => {
        target.once('render', () => {
          const canvas = target.getCanvas(), gl = canvas.getContext('webgl2');
          const pixel = new Uint8Array(4);
          gl.readPixels(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
          resolve([...pixel]);
        });
        target.triggerRepaint();
      });
      window.beforePreparedPixel = await window.samplePreparedPixel(map);
      window.preparedController = new AbortController();
      window.preparedInput = {
        sources: { 'held-source': { type: 'geojson', data: { type: 'FeatureCollection', features: [
          { type: 'Feature', id: 7, properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } }
        ] } } },
        layers: [{ layer: { id: 'held-heat', type: 'heatmap', source: 'held-source', paint: {
          'heatmap-radius': 32, 'heatmap-intensity': 4,
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(255,0,0,0)', 0.01, 'rgba(255,0,0,1)', 1, 'rgba(255,0,0,1)']
        } } }]
      };
      window.preparedOutcome = null;
      window.preparedWork = map.addPreparedFeatures(window.preparedInput, { signal: window.preparedController.signal }).then(
        result => { window.preparedOutcome = { status: 'fulfilled', sameMap: result === map }; },
        error => { window.preparedOutcome = { status: 'rejected', name: error.name, message: error.message }; }
      );
    });
    const deadline = Date.now() + 10000;
    while (!imports.length && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(imports.length > 0, 'Public shorthand did not introduce the intercepted heatmap family');
    before = await page.evaluate(async () => ({
      pending: window.preparedOutcome === null,
      sameStyle: window.targetMap.style === window.originalPreparedStyle,
      sameJSON: JSON.stringify(window.targetMap.getStyle()) === window.originalPreparedJSON,
      source: !!window.targetMap.getSource('held-source'), layer: !!window.targetMap.getLayer('held-heat'),
      pixel: await window.samplePreparedPixel(window.targetMap), originalPixel: window.beforePreparedPixel
    }));
    assert(before.pending && before.sameStyle && before.sameJSON && !before.source && !before.layer,
      'Held preparation mutated or settled the active map: ' + JSON.stringify(before));
    assert(before.pixel.every((value, index) => Math.abs(value - before.originalPixel[index]) <= 1),
      'Held preparation changed the existing framebuffer: ' + JSON.stringify(before));
    assert(before.pixel[0] >= 16 && before.pixel[0] <= 20 && before.pixel[1] >= 50 && before.pixel[1] <= 54 &&
      before.pixel[2] >= 84 && before.pixel[2] <= 88 && before.pixel[3] === 255,
      'Old-style framebuffer was not actually painted: ' + JSON.stringify(before.pixel));

    if (name === 'prepared-held-import') {
      await page.evaluate(() => {
        window.preparedInput.sources['held-source'].data.features[0].geometry.coordinates[0] = 70;
        window.preparedInput.layers[0].layer.paint['heatmap-radius'] = 3;
      });
    } else if (name === 'prepared-cancel-import') {
      await page.evaluate(() => window.preparedController.abort());
    } else if (name === 'prepared-style-import') {
      await page.evaluate(() => window.fixture.change(window.targetMap, window.fixture.geoStyle(['circle'])));
    } else if (name === 'prepared-remove-import') {
      await page.evaluate(async () => {
        await window.fixture.finish();
        window.targetMap = await window.fixture.make(window.fixture.geoStyle(['circle']));
      });
    } else if (name === 'prepared-newer-import') {
      await page.evaluate(async () => {
        const map = window.targetMap;
        await map.addPreparedFeatures({ sources: { newer: { type: 'geojson', data: {
          type: 'FeatureCollection', features: [{ type: 'Feature', id: 8, properties: {}, geometry: { type: 'Point', coordinates: [0,0] } }]
        } } }, layers: [{ layer: { id: 'newer-circle', type: 'circle', source: 'newer' } }] });
        await window.fixture.until(() => map.loaded() && map.queryRenderedFeatures().some(feature => feature.id === 8), 'newer shorthand renders while old import is held');
      });
    }
    if (!failed && name !== 'prepared-held-import') {
      // These promises must reject promptly, before the ignored import can finish.
      await page.waitForFunction(() => window.preparedOutcome !== null);
      outcome = await page.evaluate(() => window.preparedOutcome);
      assert(outcome.status === 'rejected' && outcome.name === 'AbortError',
        'Cancellation did not promptly reject shorthand: ' + JSON.stringify(outcome));
    }
    release();
    await page.waitForFunction(() => window.preparedOutcome !== null);
    outcome = await page.evaluate(() => window.preparedOutcome);
    const module = await page.evaluate(async moduleUrl => {
      try { await import(moduleUrl); return { loaded: true }; }
      catch (error) { return { loaded: false, message: error.message }; }
    }, imports[0]);
    assert(failed ? !module.loaded && /Prepared fixture module evaluation failure/.test(module.message) : module.loaded,
      'The intercepted real module did not finish as expected: ' + JSON.stringify(module));
    assert(imports.length === 1, 'Duplicate renderer module request: ' + JSON.stringify(imports));
    if (!failed && name !== 'prepared-held-import') {
      // Await actual renderer and worker registration after the ignored import finishes. This
      // does not add held IDs, supersede shorthand ownership or reuse its aborted signal.
      await page.evaluate(async () => {
        await window.targetMap.prepareFeatures({ sources: window.preparedInput.sources,
          layers: window.preparedInput.layers.map(entry => entry.layer) });
      });
    }

    if (name === 'prepared-held-import') {
      assert(outcome.status === 'fulfilled' && outcome.sameMap, 'Released shorthand did not fulfill: ' + JSON.stringify(outcome));
      after = await page.evaluate(async () => {
        const map = window.targetMap;
        await window.fixture.until(() => map.loaded(), 'prepared heatmap is loaded');
        const descriptor = map.getStyle().sources['held-source'];
        return { sameStyle: map.style === window.originalPreparedStyle, source: !!map.getSource('held-source'),
          layer: !!map.getLayer('held-heat'), lng: descriptor.data.features[0].geometry.coordinates[0],
          radius: map.getPaintProperty('held-heat', 'heatmap-radius'), pixel: await window.samplePreparedPixel(map) };
      });
      assert(after.sameStyle && after.source && after.layer && after.lng === 0 && after.radius === 32,
        'Snapshot/commit did not survive actual import boundary: ' + JSON.stringify(after));
      assert(after.pixel[0] > before.pixel[0] + 50, 'New heatmap did not change actual framebuffer: ' + JSON.stringify(after));
    } else if (failed || name === 'prepared-cancel-import') {
      if (failed) assert(outcome.status === 'rejected' && /Prepared fixture module evaluation failure/.test(outcome.message),
        'Actual import failure did not reject public shorthand: ' + JSON.stringify(outcome));
      after = await page.evaluate(async () => ({
        sameStyle: window.targetMap.style === window.originalPreparedStyle,
        sameJSON: JSON.stringify(window.targetMap.getStyle()) === window.originalPreparedJSON,
        source: !!window.targetMap.getSource('held-source'), layer: !!window.targetMap.getLayer('held-heat'),
        pixel: await window.samplePreparedPixel(window.targetMap)
      }));
      assert(after.sameStyle && after.sameJSON && !after.source && !after.layer,
        'Failed/cancelled preparation replaced the prior map: ' + JSON.stringify(after));
      assert(after.pixel.every((value, index) => Math.abs(value - before.pixel[index]) <= 1),
        'Failed/cancelled preparation damaged prior framebuffer: ' + JSON.stringify(after));
      // The previous style/worker remains usable after the failed family admission.
      await page.evaluate(async () => {
        const map = window.targetMap;
        await map.addPreparedFeatures({ sources: { recovered: { type: 'geojson', data: {
          type: 'FeatureCollection', features: [{ type: 'Feature', id: 9, properties: {}, geometry: { type: 'Point', coordinates: [0,0] } }]
        } } }, layers: [{ layer: { id: 'recovered-circle', type: 'circle', source: 'recovered' } }] });
        await window.fixture.until(() => map.loaded() && map.queryRenderedFeatures().some(feature => feature.id === 9), 'previous style/worker recovers through another family');
      });
    } else {
      after = await page.evaluate(async () => {
        const map = window.targetMap;
        await window.fixture.until(() => map.loaded() && map.queryRenderedFeatures().some(feature =>
          feature.layer.id === 'circle' || feature.layer.id === 'newer-circle'), 'replacement remains rendered after old import finishes');
        return { source: !!map.getSource('held-source'), layer: !!map.getLayer('held-heat'),
          originalCanvasConnected: window.originalPreparedMap.getCanvas().isConnected };
      });
      assert(!after.source && !after.layer, 'Stale shorthand committed after newer work: ' + JSON.stringify(after));
      if (name === 'prepared-remove-import') assert(!after.originalCanvasConnected, 'Removed original canvas remained connected');
    }
    await page.evaluate(() => window.fixture.finish());
    const mapErrors = await page.evaluate(() => window.fixture.errors);
    assert(!mapErrors.length && !pageErrors.length && !consoleErrors.length && !routeErrors.length,
      'Unexpected native/page/console errors: ' + JSON.stringify({ mapErrors, pageErrors, consoleErrors, routeErrors }));
    return { name, passed: true, imports, outcome, before, after, module, mapErrors, pageErrors, consoleErrors, routeErrors };
  } catch (error) {
    const failure = new Error(error.message + ' ' + JSON.stringify({ imports, outcome, before, after, pageErrors, consoleErrors }));
    failure.pageErrors = pageErrors; failure.consoleErrors = consoleErrors; throw failure;
  } finally {
    release(); await Promise.all([...routes]); await context.close();
    if (pageErrors.length || consoleErrors.length || routeErrors.length) {
      const failure = new Error('Unexpected browser errors: ' + JSON.stringify({ pageErrors, consoleErrors, routeErrors }));
      failure.pageErrors = pageErrors; failure.consoleErrors = consoleErrors; throw failure;
    }
  }
}

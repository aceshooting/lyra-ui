export const adversarialCases = [
  'failed-feature',
  'cancel-feature',
  'teardown-feature',
  'invalid-style',
  'held-style-snapshot',
  'held-load-snapshot',
  'held-style-imperative-mutations',
  'failed-feature-full-rebuild'
];
export async function adversarial(browser, url, name) {
  const context = await browser.newContext();
  const pageErrors = [],
    consoleErrors = [];
  context.on('page', (page) => {
    page.on('pageerror', (e) => pageErrors.push({ url: page.url(), message: e.message }));
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
  });
  const page = await context.newPage();
  let requested = false,
    release;
  const held = new Promise((r) => (release = r));
  const fails = name === 'failed-feature' || name === 'failed-feature-full-rebuild';
  const waitForImport = async () => {
    const deadline = Date.now() + 10000;
    while (!requested && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20));
    if (!requested) throw Error('Feature import not observed');
  };
  if (name !== 'invalid-style')
    await page.route('**/shader-heatmap-*.*js', async (route) => {
      requested = true;
      if (fails) await route.abort();
      else {
        await held;
        await route.continue();
      }
    });
  try {
    await page.goto(url);
    await page.waitForFunction(() => window.ready);
    if (name === 'held-load-snapshot') {
      await page.evaluate(async () => {
        window.candidateStyle = window.fixture.geoStyle(['heatmap']);
        window.candidateStyle.layers.find((x) => x.id === 'heatmap').paint['heatmap-radius'] = [
          'interpolate',
          ['linear'],
          ['zoom'],
          0,
          10,
          10,
          20
        ];
        window.admittedStyle = JSON.parse(JSON.stringify(window.candidateStyle));
        window.targetMap = await window.fixture.make(window.candidateStyle, { waitForLoad: false });
      });
    } else
      await page.evaluate(async () => {
        window.targetMap = await window.fixture.make(window.fixture.base());
      });
    if (name === 'held-load-snapshot') {
      await waitForImport();
      await page.evaluate(() => {
        window.candidateStyle.sources.sample.data.features[0].geometry.coordinates[0] = 137;
        window.candidateStyle.layers.find((x) => x.id === 'heatmap').paint['heatmap-radius'][1][0] = 'exponential';
        window.candidateStyle.layers.find((x) => x.id === 'heatmap').paint['heatmap-radius'][4] = 999;
      });
      release();
      await page.evaluate(() => window.fixture.until(() => window.targetMap.loaded(), 'initial snapshot style commit'));
      const state = await page.evaluate(() => {
        const style = window.targetMap.getStyle();
        return {
          sourceMatches: JSON.stringify(style.sources.sample) === JSON.stringify(window.admittedStyle.sources.sample),
          paintMatches:
            JSON.stringify(style.layers.find((x) => x.id === 'heatmap').paint) ===
            JSON.stringify(window.admittedStyle.layers.find((x) => x.id === 'heatmap').paint)
        };
      });
      if (!state.sourceMatches || !state.paintMatches)
        throw Error('Caller mutation reached initial admitted style: ' + JSON.stringify(state));
    } else if (name === 'invalid-style') {
      await page.evaluate(() => {
        window.targetMap.setStyle({ version: 8, sources: {}, layers: [{ id: 'bad', type: 'does-not-exist' }] });
      });
      await page.waitForFunction(() => window.fixture.errors.length > 0);
      const state = await page.evaluate(() => ({
        bg: !!window.targetMap.getLayer('bg'),
        bad: !!window.targetMap.getLayer('bad')
      }));
      if (!state.bg || state.bad) throw Error('Invalid candidate changed active style');
    } else {
      await page.evaluate((name) => {
        const map = window.targetMap;
        const candidate = window.fixture.geoStyle(['heatmap']);
        window.candidateStyle = candidate;
        window.candidateLoaded = false;
        map.once('style.load', () => (window.candidateLoaded = true));
        if (name === 'held-style-snapshot')
          candidate.layers.find((x) => x.id === 'heatmap').paint['heatmap-radius'] = [
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            10,
            10,
            20
          ];
        if (name === 'held-style-imperative-mutations') {
          const layer = { id: 'restore', type: 'background', paint: { 'background-color': '#654321' } };
          map.addLayer(layer);
          candidate.layers.splice(1, 0, layer);
        }
        window.originalStyle = map.style;
        window.transformCount = 0;
        map.setStyle(
          candidate,
          name === 'failed-feature-full-rebuild'
            ? {
                diff: false,
                transformStyle(_previous, next) {
                  window.transformCount++;
                  return next;
                }
              }
            : undefined
        );
      }, name);
      await waitForImport();
      if (fails) {
        await page.waitForFunction(() => window.fixture.errors.length === 1);
        const state = await page.evaluate(() => ({
          bg: !!window.targetMap.getLayer('bg'),
          heat: !!window.targetMap.getLayer('heatmap'),
          sameStyle: window.targetMap.style === window.originalStyle,
          transformed: window.transformCount,
          error: window.fixture.errors[0].message
        }));
        if (
          !state.bg ||
          state.heat ||
          !state.sameStyle ||
          !/module|import|fetch/i.test(state.error) ||
          (name === 'failed-feature-full-rebuild' && state.transformed !== 1)
        )
          throw Error('Failed preparation did not retain original style: ' + JSON.stringify(state));
        await page.evaluate(() => window.fixture.change(window.targetMap, window.fixture.geoStyle(['circle'])));
      } else if (name === 'held-style-snapshot') {
        await page.evaluate(() => {
          window.admittedStyle = JSON.parse(JSON.stringify(window.candidateStyle));
          window.candidateStyle.sources.sample.data.features[0].geometry.coordinates[0] = 137;
          window.candidateStyle.layers.find((x) => x.id === 'heatmap').paint['heatmap-radius'][1][0] = 'exponential';
          window.candidateStyle.layers.find((x) => x.id === 'heatmap').paint['heatmap-radius'][4] = 999;
        });
        release();
        await page.evaluate(() =>
          window.fixture.until(() => window.candidateLoaded && window.targetMap.loaded(), 'snapshot candidate commit')
        );
        const state = await page.evaluate(() => {
          const style = window.targetMap.getStyle();
          return {
            sourceMatches: JSON.stringify(style.sources.sample) === JSON.stringify(window.admittedStyle.sources.sample),
            paintMatches:
              JSON.stringify(style.layers.find((x) => x.id === 'heatmap').paint) ===
              JSON.stringify(window.admittedStyle.layers.find((x) => x.id === 'heatmap').paint)
          };
        });
        if (!state.sourceMatches || !state.paintMatches)
          throw Error('Caller mutation reached admitted style: ' + JSON.stringify(state));
      } else if (name === 'held-style-imperative-mutations') {
        await page.evaluate(() => {
          const map = window.targetMap;
          map.addLayer({ id: 'imperative', type: 'background' });
          map.removeLayer('restore');
          map.setPaintProperty('bg', 'background-color', '#abcdef');
        });
        release();
        await page.evaluate(() =>
          window.fixture.until(() => window.candidateLoaded && window.targetMap.loaded(), 'fresh style diff commit')
        );
        const state = await page.evaluate(() => ({
          extra: !!window.targetMap.getLayer('imperative'),
          restored: !!window.targetMap.getLayer('restore'),
          paint: window.targetMap.getPaintProperty('bg', 'background-color'),
          heat: !!window.targetMap.getLayer('heatmap')
        }));
        if (state.extra || !state.restored || state.paint !== '#123456' || !state.heat)
          throw Error('Pending style diff used stale serialization: ' + JSON.stringify(state));
      } else if (name === 'cancel-feature') {
        await page.evaluate(() => window.fixture.change(window.targetMap, window.fixture.geoStyle(['circle'])));
        release();
        await page.waitForTimeout(150);
        const state = await page.evaluate(() => ({
          circle: !!window.targetMap.getLayer('circle'),
          heat: !!window.targetMap.getLayer('heatmap'),
          errors: window.fixture.errors
        }));
        if (!state.circle || state.heat || state.errors.length)
          throw Error('Stale style committed after cancellation: ' + JSON.stringify(state));
      } else if (name === 'teardown-feature') {
        await page.evaluate(() => window.fixture.finish());
        release();
        await page.waitForTimeout(150);
        await page.evaluate(async () => {
          window.targetMap = await window.fixture.make(window.fixture.geoStyle(['circle']));
        });
        const errors = await page.evaluate(() => window.fixture.errors);
        if (errors.length) throw Error('Removed preparation emitted errors: ' + JSON.stringify(errors));
      } else throw Error(name);
    }
    await page.evaluate(() => window.fixture.finish());
    const expectedConsole = fails
      ? consoleErrors.filter((x) => /Failed to load resource|Failed to fetch|Load failed|NetworkError/.test(x))
      : [];
    const unexpected = consoleErrors.filter((x) => !expectedConsole.includes(x));
    if (pageErrors.length || unexpected.length) throw Error(JSON.stringify({ pageErrors, unexpected }));
    return { name, passed: true, expectedConsole, pageErrors };
  } catch (error) {
    const state = await page
      .evaluate(() => ({
        errors: window.fixture?.errors,
        style: window.targetMap?.getStyle(),
        loaded: window.targetMap?.loaded(),
        styleLoaded: window.targetMap?.isStyleLoaded()
      }))
      .catch(() => null);
    const failure = new Error(error.message + ' STATE ' + JSON.stringify({ state, pageErrors, consoleErrors }));
    failure.pageErrors = pageErrors;
    failure.consoleErrors = consoleErrors;
    throw failure;
  } finally {
    release();
    await context.close();
    if (pageErrors.length) {
      const failure = new Error('Unexpected page errors: ' + JSON.stringify(pageErrors));
      failure.pageErrors = pageErrors;
      failure.consoleErrors = consoleErrors;
      throw failure;
    }
  }
}

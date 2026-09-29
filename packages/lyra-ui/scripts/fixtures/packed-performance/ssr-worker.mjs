import { parentPort, workerData } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';

const VALUE = 'retained-server-value';
const LIGHT_DOM_TEXT = 'SSR light DOM probe';

function now() {
  return process.hrtime.bigint();
}

function durationMs(startedAt) {
  return Number(now() - startedAt) / 1_000_000;
}

try {
  const setupStartedAt = workerData.smokeOnly ? undefined : now();
  const [{ LitElementRenderer, render }, { collectResult }, { html }] = await Promise.all([
    import('@lit-labs/ssr'),
    import('@lit-labs/ssr/lib/render-result.js'),
    import('lit'),
  ]);
  const ssrModule = await import(pathToFileURL(workerData.ssrModulePath).href);
  const registrationStartedAt = workerData.smokeOnly ? undefined : now();
  await import(pathToFileURL(workerData.registrationModulePath).href);
  const registrationMs = registrationStartedAt === undefined ? undefined : durationMs(registrationStartedAt);
  const mode = ssrModule.getLyraSsrMode('lr-input');
  if (mode !== 'render-and-hydrate') {
    throw new Error(`lr-input SSR mode is ${String(mode)}; expected render-and-hydrate`);
  }
  const elementRenderers = ssrModule.lyraSsrElementRenderers(LitElementRenderer);
  const setupMs = setupStartedAt === undefined ? undefined : durationMs(setupStartedAt);
  const renderOnce = () => collectResult(render(html`<lr-input
    data-hydration-probe
    label="Hydration probe"
    value=${VALUE}
    hint="SSR light DOM probe"
  ><span data-hydration-light-dom>${LIGHT_DOM_TEXT}</span></lr-input>`, { elementRenderers }));

  const warmupSamples = [];
  const renderSamplesMs = [];
  let htmlResult;
  if (workerData.smokeOnly) {
    htmlResult = await renderOnce();
  } else {
    for (let index = 0; index < workerData.warmupSamples; index += 1) {
      const startedAt = now();
      await renderOnce();
      warmupSamples.push(durationMs(startedAt));
    }
    for (let index = 0; index < workerData.measuredSamples; index += 1) {
      const startedAt = now();
      htmlResult = await renderOnce();
      renderSamplesMs.push(durationMs(startedAt));
    }
  }
  if (typeof htmlResult !== 'string' || !htmlResult.includes('shadowrootmode="open"')) {
    throw new Error('lr-input did not emit an open declarative shadow tree');
  }
  if (!htmlResult.includes(VALUE) || !htmlResult.includes(LIGHT_DOM_TEXT)) {
    throw new Error('lr-input SSR output omitted the expected input value or light-DOM probe');
  }
  parentPort.postMessage({
    ok: true,
    mode,
    measureTiming: !workerData.smokeOnly,
    setupMs,
    registrationMs,
    warmupSamplesMs: warmupSamples,
    renderSamplesMs,
    html: htmlResult,
    expectedValue: VALUE,
    expectedLightDomText: LIGHT_DOM_TEXT,
  });
} catch (error) {
  parentPort.postMessage({ ok: false, error: error instanceof Error ? error.stack ?? error.message : String(error) });
}

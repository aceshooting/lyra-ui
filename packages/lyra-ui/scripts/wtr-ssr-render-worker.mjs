// Server half of the hydrated-fixture suite (test/wtr-ssr-fixture.ts). Runs in a worker thread so
// @lit-labs/ssr's DOM shim and every built registration stay out of the test runner's own realm.
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parentPort } from 'node:worker_threads';
import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';
import { html, nothing } from 'lit';
import { loadSsrFixtureContext, packageDir, registrationDistPath } from './ssr-fixture.mjs';

if (!existsSync(join(packageDir, 'dist', 'ssr.js'))) {
  throw new Error('Hydrated fixtures render the built package: run `pnpm build` before `test:hydration-fixtures`.');
}

const context = await loadSsrFixtureContext();
const registrationByTag = new Map(
  context.inventory.components.map((component) => [
    component.tag,
    '/' + relative(packageDir, registrationDistPath(component)).replaceAll('\\', '/'),
  ]),
);

function templateStrings(strings, raw) {
  // lit-html only accepts a genuine template strings array: an array carrying its own `raw`.
  const result = [...strings];
  Object.defineProperty(result, 'raw', { value: Object.freeze([...raw]) });
  return Object.freeze(result);
}

/** Inverse of `serializeValue()` in test/wtr-ssr-fixture.ts. */
function revive(value) {
  switch (value.kind) {
    case 'primitive':
      return value.value;
    case 'undefined':
      return undefined;
    case 'nothing':
      return nothing;
    case 'array':
      return value.items.map(revive);
    case 'object':
      return Object.fromEntries(Object.entries(value.entries).map(([key, entry]) => [key, revive(entry)]));
    case 'template':
      return html(templateStrings(value.strings, value.raw), ...value.values.map(revive));
    default:
      throw new Error(`Unknown serialized fixture value kind: ${JSON.stringify(value.kind)}`);
  }
}

async function renderFixture(serialized) {
  const template = revive(serialized);
  const markup = await collectResult(render(template, { elementRenderers: context.elementRenderers }));
  const tags = new Set([...markup.matchAll(/<([a-z][a-z0-9]*-[a-z0-9-]*)[\s/>]/g)].map((match) => match[1]));
  const modules = [];
  const clientRendered = [];
  for (const tag of [...tags].sort()) {
    const module = registrationByTag.get(tag);
    if (module) modules.push(module);
    if (module && context.loader.getLyraSsrMode(tag) === 'client-render') clientRendered.push(tag);
  }
  return { html: markup, modules, clientRendered };
}

parentPort.on('message', async ({ id, template }) => {
  try {
    parentPort.postMessage({ id, result: await renderFixture(template) });
  } catch (error) {
    parentPort.postMessage({ id, error: error instanceof Error ? error.stack ?? error.message : String(error) });
  }
});
parentPort.postMessage({ ready: true });

// Server half of the hydrated-fixture suite (test/wtr-ssr-fixture.ts). Runs in a worker thread so
// @lit-labs/ssr's DOM shim and every built registration stay out of the test runner's own realm.
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parentPort } from 'node:worker_threads';
import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';
import { html, nothing } from 'lit';
import { loadSsrFixtureContext, packageDir, registrationDistPath } from './ssr-fixture.mjs';

if (!existsSync(join(packageDir, 'dist', 'ssr.js'))) {
  throw new Error('Hydrated fixtures render the built package: run `pnpm build` before `test:hydration-fixtures`.');
}

const context = await loadSsrFixtureContext();
const { setLyraLocale } = await import('@aceshooting/lyra-ui/localization.js');

/** Same grammar the browser half accepts: a BCP-47-shaped tag naming a built catalog file. */
const CATALOG_TAG = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

function checkedCatalogTag(locale) {
  if (typeof locale !== 'string' || !CATALOG_TAG.test(locale)) {
    throw new Error(`ssrFixture catalogs/serverLocale expect a locale tag such as "fr"; received ${JSON.stringify(locale)}.`);
  }
  return locale;
}

/** Imports a built catalog once; importing it registers every family slice in this realm. */
async function registerCatalog(locale) {
  const file = join(packageDir, 'dist', 'translations', `${checkedCatalogTag(locale)}.js`);
  if (!existsSync(file)) throw new Error(`ssrFixture: no built catalog at dist/translations/${locale}.js.`);
  await import(pathToFileURL(file).href);
}
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

async function renderFixture(serialized, { catalogs = [], serverLocale } = {}) {
  const template = revive(serialized);
  for (const locale of catalogs) await registerCatalog(locale);
  // A per-request server render sets the request's locale as the active one: Lit's server DOM
  // gives an element no ancestors, so an ancestor `lang` never reaches it.
  if (serverLocale !== undefined) setLyraLocale(checkedCatalogTag(serverLocale));
  let markup;
  try {
    markup = await collectResult(render(template, { elementRenderers: context.elementRenderers }));
  } finally {
    if (serverLocale !== undefined) setLyraLocale('');
  }
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

parentPort.on('message', async ({ id, template, locale }) => {
  try {
    parentPort.postMessage({ id, result: await renderFixture(template, locale) });
  } catch (error) {
    parentPort.postMessage({ id, error: error instanceof Error ? error.stack ?? error.message : String(error) });
  }
});
parentPort.postMessage({ ready: true });

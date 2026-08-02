import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LitElementRenderer, render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';
import { html, unsafeStatic } from 'lit/static-html.js';

export const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const inventoryPath = join(packageDir, 'scripts', 'fixtures', 'component-inventory.json');

let contextPromise;

export async function readComponentInventory() {
  return JSON.parse(await readFile(inventoryPath, 'utf8'));
}

export function registrationDistPath(component) {
  return join(
    packageDir,
    'dist',
    component.registrationModule.slice('src/'.length).replace(/\.ts$/, '.js'),
  );
}

/** Loads the public entry plus every granular registration, including root-excluded peer families. */
export async function loadSsrFixtureContext() {
  contextPromise ??= (async () => {
    const loader = await import('@aceshooting/lyra-ui/ssr-loader.js');
    const inventory = await readComponentInventory();
    for (const component of inventory.components) {
      await import(pathToFileURL(registrationDistPath(component)).href);
    }

    const elementRenderers = loader.lyraSsrElementRenderers(LitElementRenderer);
    return { elementRenderers, inventory, loader };
  })();
  return contextPromise;
}

export async function renderSsrProbe(tagName, elementRenderers) {
  const staticTag = unsafeStatic(tagName);
  return collectResult(
    render(
      html`<${staticTag}
        data-ssr-probe=${tagName}
        aria-label=${`SSR probe ${tagName}`}
      ><span data-ssr-light=${tagName}>Light DOM ${tagName}</span></${staticTag}>`,
      { elementRenderers },
    ),
  );
}

export async function renderSsrMatrix() {
  const context = await loadSsrFixtureContext();
  const entries = [];
  for (const component of context.inventory.components) {
    entries.push({
      tag: component.tag,
      mode: context.loader.getLyraSsrMode(component.tag),
      html: await renderSsrProbe(component.tag, context.elementRenderers),
    });
  }
  return { ...context, entries };
}

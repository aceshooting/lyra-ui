import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LitElementRenderer, render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';
import { html, unsafeStatic } from 'lit/static-html.js';

export const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const inventoryPath = join(packageDir, 'scripts', 'fixtures', 'component-inventory.json');
const editorHtmlDataPath = join(packageDir, 'vscode-html-data.json');

let contextPromise;

async function readComponentInventory() {
  return JSON.parse(await readFile(inventoryPath, 'utf8'));
}

export async function readEditorHtmlData() {
  return JSON.parse(await readFile(editorHtmlDataPath, 'utf8'));
}

function descriptionText(description) {
  return typeof description === 'string' ? description : description?.value ?? '';
}

/**
 * Expands every documented boolean and closed-string attribute into an independent SSR case.
 * The editor data is generated from the public manifest, so this covers new public states without
 * maintaining a second hand-written component list.
 */
export function enumeratePublicSsrStateCases(editorData, renderAndHydrateTags) {
  const supportedTags = new Set(renderAndHydrateTags);
  const cases = [];
  const seen = new Set();

  const addCase = (stateCase) => {
    const key = `${stateCase.tag}\0${stateCase.attribute}\0${stateCase.value}`;
    if (seen.has(key)) return;
    seen.add(key);
    cases.push(stateCase);
  };

  for (const tag of editorData.tags ?? []) {
    if (!supportedTags.has(tag.name)) continue;

    for (const attribute of tag.attributes ?? []) {
      const description = descriptionText(attribute.description);
      const documentedType = description.match(/Type:\s*`([^`]+)`/)?.[1] ?? '';
      if (/\bboolean\b/.test(documentedType)) {
        addCase({ tag: tag.name, attribute: attribute.name, value: '' });
        addCase({ tag: tag.name, attribute: attribute.name, value: 'false' });
      }

      for (const value of attribute.values ?? []) {
        addCase({ tag: tag.name, attribute: attribute.name, value: value.name });
      }
    }
  }

  return cases;
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

export async function renderSsrStateProbe(stateCase, elementRenderers) {
  const staticTag = unsafeStatic(stateCase.tag);
  const staticAttribute = unsafeStatic(stateCase.attribute);
  const caseLabel = `${stateCase.tag}[${stateCase.attribute}=${JSON.stringify(stateCase.value)}]`;
  const lightDom = stateCase.slot
    ? html`<span slot=${stateCase.slot} data-ssr-state-light=${caseLabel}>State probe</span>`
    : html`<span data-ssr-state-light=${caseLabel}>State probe</span>`;
  return collectResult(
    render(
      html`<${staticTag}
        ${staticAttribute}=${stateCase.value}
        data-ssr-state-probe=${caseLabel}
      >${lightDom}</${staticTag}>`,
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

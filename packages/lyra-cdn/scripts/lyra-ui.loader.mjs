// Entry of the single-script-tag build (`dist/lyra-ui.loader.js`). Bundled by
// scripts/build.mjs; the imports below resolve against the workspace `dist` trees.
import { start } from '../../lyra-ui/dist/autoloader.js';
import { tag } from '../../lyra-ui/dist/utilities/prefix.js';
import { loadLyraLocale } from '../../lyra-ui/dist/locale-loader.js';

/** Companion elements the lyra-ui autoloader does not know; each loads on first sight. */
const COMPANION_ELEMENTS = [
  ['gen-view', () => import('../../lyra-gen/dist/gen-view.js')],
  ['gen-devtools', () => import('../../lyra-gen/dist/devtools.js')],
  ['docx-editor', () => import('../../lyra-docs/dist/docx/editor.js')],
];

const CLOAK = 'lr-cloak';
const DEFAULT_CLOAK_TIMEOUT_MS = 2000;

/** The loader's own `<script>`: `document.currentScript` for classic tags, a URL match for modules. */
function ownScript() {
  const moduleUrl = new URL(import.meta.url).href;
  for (const script of document.scripts) {
    if (script.hasAttribute('data-lyra-loader')) return script;
    try {
      if (script.src && new URL(script.src, document.baseURI).href === moduleUrl) return script;
    } catch {
      // A malformed src on an unrelated script is not ours.
    }
  }
  return undefined;
}

/**
 * Opt-in registrations a bundler user imports by hand, run once their element is first defined
 * anywhere (shadow roots included). Rendered instances re-resolve when one lands.
 */
const ON_DEFINITION = [
  ['flag', () => import('../../lyra-ui/dist/components/media/flag/flag-peer.js')],
];

function registerOnDefinition() {
  for (const [name, load] of ON_DEFINITION) {
    void customElements.whenDefined(tag(name)).then(load).catch((error) => {
      console.error(`[lr-loader] Unable to register the <${tag(name)}> companion.`, error);
    });
  }
}

/**
 * Every optional peer is bundled, so every component is enabled by default. A page may still
 * narrow the set with `data-lyra-optional-peers="dompurify,marked"`; `none` disables them all.
 */
function optionalPeers(script) {
  const value = script?.dataset.lyraOptionalPeers?.trim();
  if (!value || value === 'all') return 'all';
  if (value === 'none') return [];
  return value.split(',').map((peer) => peer.trim()).filter(Boolean);
}

/** Loads a companion element the first time one appears in the document. */
function watchCompanions() {
  const pending = new Map(COMPANION_ELEMENTS.map(([name, load]) => [tag(name), load]));
  const loads = [];
  let observer;
  const scan = () => {
    for (const [name, load] of pending) {
      if (!customElements.get(name) && !document.querySelector(name)) continue;
      pending.delete(name);
      if (customElements.get(name)) continue;
      loads.push(load().catch((error) => console.error(`[lr-loader] Unable to load <${name}>.`, error)));
    }
    if (pending.size === 0) observer?.disconnect();
  };
  scan();
  if (pending.size > 0) {
    observer = new MutationObserver(scan);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
  return Promise.all(loads);
}

/**
 * Loads the bundled catalog for the document's `lang`, now and whenever it changes: the exact tag
 * when one ships, else its base language (`fr-FR` uses `fr`). English and unshipped languages keep
 * the built-in English strings.
 */
function watchDocumentLocale() {
  const root = document.documentElement;
  const load = () => {
    const lang = root.lang.trim();
    if (!lang) return Promise.resolve();
    const base = lang.split(/[-_]/)[0];
    return loadLyraLocale(lang)
      .catch(() => (base && base !== lang ? loadLyraLocale(base) : undefined))
      .catch(() => undefined);
  };
  new MutationObserver(() => void load()).observe(root, { attributes: true, attributeFilter: ['lang'] });
  return load();
}

function cloakTimeout(script) {
  const value = Number(script?.dataset.lyraCloakTimeout);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_CLOAK_TIMEOUT_MS;
}

function uncloak() {
  for (const element of document.querySelectorAll(`.${CLOAK}, [${CLOAK}]`)) {
    element.classList.remove(CLOAK);
    element.removeAttribute(CLOAK);
  }
}

function run() {
  const script = ownScript();
  // Opt out with `data-lyra-autoload="false"` (or `data-lyra-no-autoload`) and drive
  // `start()`/`discover()` yourself from the module's exports.
  if (script?.dataset.lyraAutoload === 'false' || script?.hasAttribute('data-lyra-no-autoload')) return;
  registerOnDefinition();
  const locale = watchDocumentLocale();
  const companions = watchCompanions();
  const core = start(document, {
    optionalPeers: optionalPeers(script),
    events: script?.hasAttribute('data-lyra-autoload-events') === true,
  }).catch((error) => {
    console.error('[lr-loader] Unable to load a discovered component.', error);
  });
  const finished = Promise.all([core, companions, locale]);
  // Reveal cloaked content once the first scan settles, or after a short cap (`data-lyra-cloak-timeout`, default 2000 ms) so a slow chunk
  // cannot hold the page hidden.
  void Promise.race([finished, new Promise((resolve) => setTimeout(resolve, cloakTimeout(script)))]).then(uncloak);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
}

export { start, stop, discover } from '../../lyra-ui/dist/autoloader.js';
export { loadLyraLocale };

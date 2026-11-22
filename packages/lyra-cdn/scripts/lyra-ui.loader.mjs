// Entry of the single-script-tag build (`dist/lyra-ui.loader.js`). Bundled by
// scripts/build.mjs; the import below resolves against the workspace lyra-ui `dist` tree.
import { start } from '../../lyra-ui/dist/autoloader.js';

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

function optionalPeers(script) {
  const value = script?.dataset.lyraOptionalPeers?.trim();
  if (!value) return undefined;
  return value === 'all' ? 'all' : value.split(',').map((peer) => peer.trim()).filter(Boolean);
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
  const finished = start(document, {
    optionalPeers: optionalPeers(script),
    events: script?.hasAttribute('data-lyra-autoload-events') === true,
  }).catch((error) => {
    console.error('[lr-loader] Unable to load a discovered component.', error);
  });
  // Reveal cloaked content once the first scan settles, or after a short cap (`data-lyra-cloak-timeout`, default 2000 ms) so a slow chunk
  // cannot hold the page hidden.
  void Promise.race([finished, new Promise((resolve) => setTimeout(resolve, cloakTimeout(script)))]).then(uncloak);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
}

export { start, stop, discover } from '../../lyra-ui/dist/autoloader.js';

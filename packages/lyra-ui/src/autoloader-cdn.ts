import { start, type AutoloaderOptionalPeers } from './autoloader.js';

function loaderScript(): HTMLScriptElement | undefined {
  if (typeof document === 'undefined') return undefined;
  const moduleUrl = new URL(import.meta.url).href;
  const scripts = [...document.scripts];
  const exact = scripts.find((script) => {
    try {
      return new URL(script.src, document.baseURI).href === moduleUrl;
    } catch {
      return false;
    }
  });
  if (exact) return exact;

  // ESM CDNs may execute this entry behind a generated wrapper URL. The explicit marker keeps
  // script-local options discoverable in that case without guessing a vendor's rewrite format.
  for (let index = scripts.length - 1; index >= 0; index -= 1) {
    const script = scripts[index]!;
    if (script.hasAttribute('data-lyra-autoloader')) return script;
  }
  return undefined;
}

function optionalPeers(script: HTMLScriptElement | undefined): AutoloaderOptionalPeers | undefined {
  const value = script?.dataset['lyraOptionalPeers']?.trim();
  if (!value) return undefined;
  if (value === 'all') return 'all';
  return value.split(',').map((peer) => peer.trim()).filter(Boolean);
}

if (typeof document !== 'undefined') {
  const script = loaderScript();
  void start(document, {
    optionalPeers: optionalPeers(script),
    events: script?.hasAttribute('data-lyra-autoload-events') === true,
  }).catch((error: unknown) => {
    console.error('[lr-autoloader] Unable to load a discovered component.', error);
  });
}

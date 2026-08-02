import { aTimeout, expect, fixture, html, oneEvent } from '@open-wc/testing';
import {
  stop,
  type AutoloadableTagName,
} from './autoloader.js';
import { setAutoloaderLoaderForTesting } from './internal/autoloader-loaders.js';

const overriddenTags = new Set<AutoloadableTagName>();
let moduleId = 0;

function override(tag: AutoloadableTagName, loader: () => Promise<CustomElementConstructor>): void {
  stop();
  overriddenTags.add(tag);
  setAutoloaderLoaderForTesting(tag, loader);
}

function loadCdnEntry(attributes: Record<string, string> = {}, wrapped = false): Promise<void> {
  moduleId += 1;
  const script = document.createElement('script');
  script.type = 'module';
  const entryUrl = new URL(`./autoloader-cdn.ts?test=${moduleId}`, import.meta.url).href;
  let objectUrl: string | undefined;
  if (wrapped) {
    objectUrl = URL.createObjectURL(new Blob([`import ${JSON.stringify(entryUrl)};`], { type: 'text/javascript' }));
    script.src = objectUrl;
  } else {
    script.src = entryUrl;
  }
  for (const [name, value] of Object.entries(attributes)) script.setAttribute(name, value);
  const loaded = new Promise<void>((resolve, reject) => {
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('The CDN autoloader module failed to load')), {
      once: true,
    });
  });
  document.head.append(script);
  return loaded.finally(() => {
    script.remove();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  });
}

afterEach(() => {
  stop();
  for (const tag of overriddenTags) setAutoloaderLoaderForTesting(tag, undefined);
  overriddenTags.clear();
});

describe('autoloader CDN entry', () => {
  it('auto-starts, keeps optional peers isolated by default, and reads explicit script options', async () => {
    const tag = 'lr-flag';
    let calls = 0;
    override(tag, async () => {
      calls += 1;
      return class extends HTMLElement {};
    });
    await fixture<HTMLElement>(html`<main><lr-flag></lr-flag></main>`);

    await loadCdnEntry();
    await aTimeout(0);
    expect(calls).to.equal(0);
    expect(customElements.get(tag)).to.equal(undefined);

    const loadedEvent = oneEvent(document, 'lr-autoload-loaded');
    await loadCdnEntry({
      'data-lyra-autoloader': '',
      'data-lyra-autoload-events': '',
      'data-lyra-optional-peers': '@aceshooting/lyra-flags',
    }, true);
    const event = await loadedEvent as CustomEvent<{ tag: string; optionalPeers: readonly string[] }>;
    expect(event.detail.tag).to.equal(tag);
    expect(event.detail.optionalPeers.join(',')).to.equal('@aceshooting/lyra-flags');
    expect(calls).to.equal(1);
    expect(customElements.get(tag)).to.be.a('function');
  });
});

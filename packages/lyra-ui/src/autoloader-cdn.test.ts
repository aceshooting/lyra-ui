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

/**
 * A decoy `<script>` whose `src` accessor is overridden (rather than set through the real
 * attribute) to return a string that `new URL()` rejects even with a base URL supplied -- an
 * absolute `http:` URL with no host is invalid on its own, so the base is never consulted. This
 * exercises `loaderScript()`'s `try`/`catch` around the URL comparison without the browser ever
 * attempting to fetch anything for the decoy (no real `src` attribute is set, and the `type` is
 * left non-executable).
 */
function appendUnparsableSrcDecoyScript(): HTMLScriptElement {
  const decoy = document.createElement('script');
  decoy.type = 'lr-test-decoy';
  Object.defineProperty(decoy, 'src', {
    configurable: true,
    get: () => 'http://',
  });
  document.head.append(decoy);
  return decoy;
}

function stubConsoleError(): { calls: unknown[][]; restore: () => void } {
  const original = console.error;
  const calls: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    calls.push(args);
  };
  return {
    calls,
    restore: () => {
      console.error = original;
    },
  };
}

afterEach(() => {
  stop();
  for (const tag of overriddenTags) setAutoloaderLoaderForTesting(tag, undefined);
  overriddenTags.clear();
});

describe('autoloader CDN entry', () => {
  it('auto-starts, keeps optional peers isolated by default, and reads explicit script options', async () => {
    const tag = 'lr-pdf-viewer';
    let calls = 0;
    override(tag, async () => {
      calls += 1;
      return class extends HTMLElement {};
    });
    await fixture<HTMLElement>(html`<main><lr-pdf-viewer></lr-pdf-viewer></main>`);

    await loadCdnEntry();
    await aTimeout(0);
    expect(calls).to.equal(0);
    expect(typeof customElements.get(tag)).to.equal('undefined');

    const loadedEvent = oneEvent(document, 'lr-autoload-loaded');
    await loadCdnEntry({
      'data-lyra-autoloader': '',
      'data-lyra-autoload-events': '',
      'data-lyra-optional-peers': 'pdfjs-dist',
    }, true);
    const event = await loadedEvent as CustomEvent<{ tag: string; optionalPeers: readonly string[] }>;
    expect(event.detail.tag).to.equal(tag);
    expect(event.detail.optionalPeers.join(',')).to.equal('pdfjs-dist');
    expect(calls).to.equal(1);
    expect(typeof customElements.get(tag)).to.equal('function');
  });

  it('splits, trims, and drops empty entries from a comma-separated optional-peers list', async () => {
    const tag = 'lr-docx-viewer';
    let calls = 0;
    override(tag, async () => {
      calls += 1;
      return class extends HTMLElement {};
    });
    await fixture<HTMLElement>(html`<main><lr-docx-viewer></lr-docx-viewer></main>`);

    const loadedEvent = oneEvent(document, 'lr-autoload-loaded');
    await loadCdnEntry({
      'data-lyra-autoload-events': '',
      // Both peers this tag requires, plus surrounding whitespace and empty entries that only a
      // correct split/trim/filter pipeline resolves to the required set.
      'data-lyra-optional-peers': ' dompurify ,, mammoth , ',
    });
    const event = await loadedEvent as CustomEvent<{ tag: string; optionalPeers: readonly string[] }>;
    expect(event.detail.tag).to.equal(tag);
    expect(calls).to.equal(1);
    expect(typeof customElements.get(tag)).to.equal('function');
  });

  it("treats an explicit 'all' optional-peers policy as eligible regardless of the tag's required peers", async () => {
    const tag = 'lr-calendar-viewer';
    let calls = 0;
    override(tag, async () => {
      calls += 1;
      return class extends HTMLElement {};
    });
    await fixture<HTMLElement>(html`<main><lr-calendar-viewer></lr-calendar-viewer></main>`);

    const loadedEvent = oneEvent(document, 'lr-autoload-loaded');
    await loadCdnEntry({
      'data-lyra-autoload-events': '',
      'data-lyra-optional-peers': 'all',
    });
    const event = await loadedEvent as CustomEvent<{ tag: string; optionalPeers: readonly string[] }>;
    expect(event.detail.tag).to.equal(tag);
    expect(calls).to.equal(1);
    expect(typeof customElements.get(tag)).to.equal('function');
  });

  it('falls back to undefined when neither an exact match nor a marker script is present', async () => {
    // Wrapped so the generated wrapper script's own src never equals this module's
    // `import.meta.url`, and no `data-lyra-autoloader` marker is set on it either -- forcing
    // `loaderScript()` through both the exact-match miss and the marker loop's exhaustion.
    await loadCdnEntry({}, true);
    await aTimeout(0);
    // No script-local options were discoverable, so the loader falls back to the default,
    // isolated policy (confirmed unreachable component tags stay undefined).
    expect(typeof customElements.get('lr-qr-code')).to.equal('undefined');
  });

  // NOTE: keep this the LAST test/load in this file. `@web/test-runner-coverage-v8` maps every
  // V8 coverage entry for a given source file back to the same on-disk path regardless of the
  // cache-busting `?test=N` query string these fixtures use, then folds entries together with
  // `Object.assign` (see its `v8ToIstanbul()`) -- so only the LAST-executed reimport's per-line
  // coverage survives Codecov's view of this file for this test session. This scenario is
  // deliberately dense (decoy + marker fallback + a rejected load) so it credits as many of the
  // remaining branches as one execution can reach; it uses a plain (non-"all", non-comma) peer
  // name rather than "all" so it still exercises the same split/trim path as the test above,
  // instead of overriding that test's contribution to this file's single surviving trace.
  it('finds the marker script past an unparsable decoy and reports a start() rejection via console.error', async () => {
    const tag = 'lr-archive-viewer';
    override(tag, async () => {
      throw new Error('simulated peer load failure');
    });
    await fixture<HTMLElement>(html`<main><lr-archive-viewer></lr-archive-viewer></main>`);

    const decoy = appendUnparsableSrcDecoyScript();
    const consoleStub = stubConsoleError();
    try {
      const errorEvent = oneEvent(document, 'lr-autoload-error');
      await loadCdnEntry({
        'data-lyra-autoloader': '',
        'data-lyra-autoload-events': '',
        'data-lyra-optional-peers': ' dompurify ',
      }, true);
      const event = await errorEvent as CustomEvent<{ tag: string; error: unknown }>;
      expect(event.detail.tag).to.equal(tag);
      // The rejection that produced `lr-autoload-error` also propagates out of `start()`; give
      // its promise chain a turn to reach the CDN entry's top-level `.catch()`.
      await aTimeout(0);
      expect(consoleStub.calls.length).to.equal(1);
      expect(consoleStub.calls[0]?.[0]).to.equal('[lr-autoloader] Unable to load a discovered component.');
    } finally {
      consoleStub.restore();
      decoy.remove();
    }
  });
});

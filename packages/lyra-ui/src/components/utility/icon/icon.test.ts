import { fixture, expect, html, aTimeout, oneEvent, waitUntil } from '@open-wc/testing';
import './icon.js';
import type { LyraIcon } from './icon.js';
import { getIconLibrary, registerIconLibrary, unregisterIconLibrary } from './icon-library.js';
import { clearIconSanitizerCache, loadIconSanitizer } from './dompurify-loader.js';
import { __clearIconResourceCacheForTesting } from './icon-resource.js';

it('uses mapped defaults and reflects name changes', async () => {
  const el = (await fixture(html`<lr-icon></lr-icon>`)) as LyraIcon;
  expect(el.library).to.equal('default');
  expect(el.rotate).to.equal(0);
  el.name = 'search';
  await el.updateComplete;
  expect(el.getAttribute('name')).to.equal('search');
});

it('renders a named SVG path as a decorative icon', async () => {
  const el = (await fixture(html`<lr-icon name="search"></lr-icon>`)) as LyraIcon;
  expect(el.shadowRoot!.querySelector('path')).to.exist;
  expect(el.shadowRoot!.querySelector('svg')!.getAttribute('aria-hidden')).to.equal('true');
});

it('is accessible when given a label', async () => {
  const el = await fixture(html`<lr-icon name="search" label="Search"></lr-icon>`);
  await expect(el).to.be.accessible();
});

it('forwards the host accessible name to the shadow SVG, including late changes', async () => {
  const el = (await fixture(html`<lr-icon name="search" aria-label="Find"></lr-icon>`)) as LyraIcon;
  const svg = el.shadowRoot!.querySelector('svg')!;

  expect(svg.getAttribute('aria-label')).to.equal('Find');
  expect(svg.getAttribute('aria-hidden')).to.equal('false');

  el.setAttribute('aria-label', 'Search');
  await el.updateComplete;
  expect(svg.getAttribute('aria-label')).to.equal('Search');

  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(svg.hasAttribute('aria-label')).to.be.false;
  expect(svg.getAttribute('aria-hidden')).to.equal('true');
});

it('renders custom SVG nodes inside the shadow SVG', async () => {
  const el = await fixture(html`
    <lr-icon>
      <path d="M4 12h16"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </lr-icon>
  `);

  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('svg > path')).to.exist;
  expect(el.shadowRoot!.querySelector('svg > circle')).to.exist;
});

it('does not clone hyphenated light-DOM custom elements into the SVG namespace', async () => {
  const el = await fixture(html`
    <lr-icon>
      <x-icon-test-node><path d="M0 0"></path></x-icon-test-node>
      <path d="M4 12h16"></path>
    </lr-icon>
  `);
  await (el as LyraIcon).updateComplete;
  expect(el.shadowRoot!.querySelector('svg > x-icon-test-node')).to.not.exist;
  expect(el.shadowRoot!.querySelector('svg > path')).to.exist;
});

it('tracks assigned SVG attribute and descendant mutations only while connected', async () => {
  const el = (await fixture(html`
    <lr-icon><g><path d="M1 1"></path></g></lr-icon>
  `)) as LyraIcon;
  const parent = el.parentElement!;
  const sourceGroup = el.querySelector('g')!;
  const sourcePath = sourceGroup.querySelector('path')!;

  sourcePath.setAttribute('d', 'M2 2');
  const sourceCircle = document.createElement('circle');
  sourceCircle.setAttribute('r', '4');
  sourceGroup.append(sourceCircle);
  await aTimeout(0);
  expect(el.shadowRoot!.querySelector('svg > g > path')!.getAttribute('d')).to.equal('M2 2');
  expect(el.shadowRoot!.querySelector('svg > g > circle')!.getAttribute('r')).to.equal('4');

  el.remove();
  sourcePath.setAttribute('d', 'M3 3');
  await aTimeout(0);
  expect(el.shadowRoot!.querySelector('svg > g > path')!.getAttribute('d')).to.equal('M2 2');

  parent.append(el);
  await aTimeout(0);
  expect(el.shadowRoot!.querySelector('svg > g > path')!.getAttribute('d')).to.equal('M3 3');
});

// ---------------------------------------------------------------------------
// Icon libraries, remote `src`, and the sanitization pipeline
// ---------------------------------------------------------------------------

const CIRCLE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle></svg>';
const RECT_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="2" y="2" width="8" height="8"></rect></svg>';

function svgResponse(body: string, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 404,
    statusText: ok ? 'OK' : 'Not Found',
    text: () => Promise.resolve(body),
  } as Response;
}

/** Stubs `window.fetch`, returning the restore function every caller runs from a `finally`. */
function stubFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response>,
): () => void {
  const original = window.fetch;
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    handler(String(input), init)) as typeof window.fetch;
  return () => {
    window.fetch = original;
  };
}

const partCount = (el: LyraIcon, selector: string): number =>
  el.shadowRoot!.querySelectorAll(selector).length;

describe('lr-icon icon libraries', () => {
  afterEach(() => {
    __clearIconResourceCacheForTesting();
    unregisterIconLibrary('test-lib');
    unregisterIconLibrary('late-lib');
    unregisterIconLibrary('swap-lib');
    unregisterIconLibrary('mutator-lib');
    unregisterIconLibrary('revert-lib');
    unregisterIconLibrary('async-lib');
    unregisterIconLibrary('mutator-a');
    unregisterIconLibrary('mutator-b');
    unregisterIconLibrary('duotone-lib');
  });

  it('registers, looks up, and unregisters a library', () => {
    const resolver = (name: string) => `https://icons.test/${name}.svg`;
    registerIconLibrary('test-lib', { resolver });
    expect(getIconLibrary('test-lib')?.name).to.equal('test-lib');
    expect(getIconLibrary('test-lib')?.resolver('star', '', '')).to.equal(
      'https://icons.test/star.svg',
    );
    unregisterIconLibrary('test-lib');
    expect(getIconLibrary('test-lib')).to.equal(undefined);
  });

  it('resolves a library icon through the resolver and renders the sanitized SVG', async () => {
    const requested: string[] = [];
    const restore = stubFetch((url) => {
      requested.push(url);
      return Promise.resolve(svgResponse(CIRCLE_SVG));
    });
    try {
      registerIconLibrary('test-lib', { resolver: (name) => `https://icons.test/${name}.svg` });
      const el = (await fixture(html`<lr-icon library="test-lib" name="star"></lr-icon>`)) as LyraIcon;
      await waitUntil(() => partCount(el, '[part="svg"] circle') === 1);
      expect(requested).to.deep.equal(['https://icons.test/star.svg']);
      expect(partCount(el, '[part="error"]')).to.equal(0);
    } finally {
      restore();
    }
  });

  it('loads a direct `src` and emits lr-load once the icon is in the DOM', async () => {
    const restore = stubFetch(() => Promise.resolve(svgResponse(CIRCLE_SVG)));
    try {
      const el = (await fixture(html`<lr-icon></lr-icon>`)) as LyraIcon;
      const loaded = oneEvent(el, 'lr-load');
      el.src = 'https://icons.test/star.svg';
      const event = await loaded;
      expect((event.detail as { src: string }).src).to.equal('https://icons.test/star.svg');
      expect(partCount(el, '[part="svg"] circle')).to.equal(1);
    } finally {
      restore();
    }
  });

  it('strips scripting from fetched SVG markup before it reaches the DOM', async () => {
    const flag = window as unknown as Record<string, unknown>;
    delete flag['__lrIconXss'];
    const malicious =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
      '<script>window.__lrIconXss = "script";<\/script>' +
      '<circle cx="12" cy="12" r="5" onload="window.__lrIconXss = \'onload\'"></circle>' +
      '<a href="javascript:window.__lrIconXss = \'href\'"><rect width="4" height="4"></rect></a>' +
      '</svg>';
    const restore = stubFetch(() => Promise.resolve(svgResponse(malicious)));
    try {
      const el = (await fixture(html`<lr-icon src="https://icons.test/evil.svg"></lr-icon>`)) as LyraIcon;
      await waitUntil(() => partCount(el, '[part="svg"]') === 1);
      await aTimeout(20);
      expect(partCount(el, 'script')).to.equal(0);
      expect(el.shadowRoot!.querySelector('circle')!.hasAttribute('onload')).to.be.false;
      expect(el.shadowRoot!.innerHTML.includes('javascript:')).to.be.false;
      expect(flag['__lrIconXss']).to.equal(undefined);
    } finally {
      delete flag['__lrIconXss'];
      restore();
    }
  });

  it('never fetches a URL the fetch allowlist rejects, and fails closed instead', async () => {
    let calls = 0;
    const restore = stubFetch(() => {
      calls += 1;
      return Promise.resolve(svgResponse(CIRCLE_SVG));
    });
    try {
      const el = (await fixture(html`<lr-icon></lr-icon>`)) as LyraIcon;
      const errored = oneEvent(el, 'lr-error');
      el.src = 'javascript:alert(1)';
      await errored;
      expect(calls).to.equal(0);
      expect(partCount(el, '[part="error"]')).to.equal(1);
      expect(partCount(el, 'svg')).to.equal(0);
    } finally {
      restore();
    }
  });

  it('renders a localized alert, not the raw failure text, when the fetch fails', async () => {
    const restore = stubFetch(() => Promise.resolve(svgResponse('', false)));
    try {
      const el = (await fixture(html`<lr-icon></lr-icon>`)) as LyraIcon;
      const errored = oneEvent(el, 'lr-error');
      el.src = 'https://icons.test/missing.svg';
      await errored;
      const alert = el.shadowRoot!.querySelector('[part="error"]')!;
      expect(alert.getAttribute('role')).to.equal('alert');
      expect(alert.textContent!.trim().length > 0).to.be.true;
      expect(alert.textContent!.includes('404')).to.be.false;
      expect(alert.textContent!.includes('Not Found')).to.be.false;
      expect(partCount(el, 'svg')).to.equal(0);
    } finally {
      restore();
    }
  });

  it('routes the failure message through .strings so it can be translated', async () => {
    const restore = stubFetch(() => Promise.resolve(svgResponse('', false)));
    try {
      const el = (await fixture(
        html`<lr-icon .strings=${{ iconLoadError: 'Icone indisponible' }}></lr-icon>`,
      )) as LyraIcon;
      const errored = oneEvent(el, 'lr-error');
      el.src = 'https://icons.test/missing.svg';
      await errored;
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent!.trim()).to.equal(
        'Icone indisponible',
      );
    } finally {
      restore();
    }
  });

  it('treats an empty-but-valid response as its own state, not an error', async () => {
    const restore = stubFetch(() => Promise.resolve(svgResponse('')));
    try {
      const el = (await fixture(html`<lr-icon></lr-icon>`)) as LyraIcon;
      const loaded = oneEvent(el, 'lr-load');
      el.src = 'https://icons.test/blank.svg';
      await loaded;
      expect(partCount(el, '[part="empty"]')).to.equal(1);
      expect(partCount(el, '[part="error"]')).to.equal(0);
    } finally {
      restore();
    }
  });

  it('fails closed when the dompurify peer cannot be loaded', async () => {
    const originalWarn = console.warn;
    console.warn = () => {};
    clearIconSanitizerCache();
    const restore = stubFetch(() => Promise.resolve(svgResponse(CIRCLE_SVG)));
    try {
      expect(await loadIconSanitizer(() => Promise.reject(new Error('no dompurify')))).to.equal(null);
      const el = (await fixture(html`<lr-icon></lr-icon>`)) as LyraIcon;
      const errored = oneEvent(el, 'lr-error');
      el.src = 'https://icons.test/star.svg';
      await errored;
      expect(partCount(el, '[part="error"]')).to.equal(1);
      expect(partCount(el, 'circle')).to.equal(0);
    } finally {
      restore();
      clearIconSanitizerCache();
      console.warn = originalWarn;
    }
  });

  it('re-resolves already-rendered icons when their library is registered late', async () => {
    const restore = stubFetch(() => Promise.resolve(svgResponse(CIRCLE_SVG)));
    try {
      const el = (await fixture(html`<lr-icon library="late-lib" name="search"></lr-icon>`)) as LyraIcon;
      expect(partCount(el, 'svg > path')).to.equal(1);
      const loaded = oneEvent(el, 'lr-load');
      registerIconLibrary('late-lib', { resolver: (name) => `https://icons.test/${name}.svg` });
      await loaded;
      expect(partCount(el, '[part="svg"] circle')).to.equal(1);
    } finally {
      restore();
    }
  });

  it('re-resolves when a library is re-registered with a different resolver', async () => {
    const restore = stubFetch((url) =>
      Promise.resolve(svgResponse(url.includes('/v2/') ? RECT_SVG : CIRCLE_SVG)),
    );
    try {
      registerIconLibrary('swap-lib', { resolver: (name) => `https://icons.test/${name}.svg` });
      const el = (await fixture(html`<lr-icon library="swap-lib" name="star"></lr-icon>`)) as LyraIcon;
      await waitUntil(() => partCount(el, '[part="svg"] circle') === 1);
      const loaded = oneEvent(el, 'lr-load');
      registerIconLibrary('swap-lib', { resolver: (name) => `https://icons.test/v2/${name}.svg` });
      await loaded;
      expect(partCount(el, '[part="svg"] rect')).to.equal(1);
      expect(partCount(el, '[part="svg"] circle')).to.equal(0);
    } finally {
      restore();
    }
  });

  it('falls back to the built-in glyph set when a library is unregistered', async () => {
    const restore = stubFetch(() => Promise.resolve(svgResponse(CIRCLE_SVG)));
    try {
      registerIconLibrary('revert-lib', { resolver: (name) => `https://icons.test/${name}.svg` });
      const el = (await fixture(html`<lr-icon library="revert-lib" name="search"></lr-icon>`)) as LyraIcon;
      await waitUntil(() => partCount(el, '[part="svg"] circle') === 1);
      unregisterIconLibrary('revert-lib');
      await waitUntil(() => partCount(el, 'svg > path') === 1);
      expect(partCount(el, 'circle')).to.equal(0);
    } finally {
      restore();
    }
  });

  it('runs a library mutator on the sanitized SVG', async () => {
    const restore = stubFetch(() => Promise.resolve(svgResponse(CIRCLE_SVG)));
    try {
      registerIconLibrary('mutator-lib', {
        resolver: (name) => `https://icons.test/${name}.svg`,
        mutator: (svg) => svg.setAttribute('data-mutated', 'yes'),
      });
      const el = (await fixture(html`<lr-icon library="mutator-lib" name="star"></lr-icon>`)) as LyraIcon;
      await waitUntil(() => partCount(el, '[part="svg"]') === 1);
      expect(el.shadowRoot!.querySelector('[part="svg"]')!.getAttribute('data-mutated')).to.equal('yes');
    } finally {
      restore();
    }
  });

  it('awaits async resolvers with family and variant and drops a superseded result', async () => {
    const resolverCalls: Array<[string, string, string]> = [];
    const requested: string[] = [];
    let resolveClassic!: (url: string) => void;
    const restore = stubFetch((url) => {
      requested.push(url);
      return Promise.resolve(svgResponse(url.includes('sharp') ? RECT_SVG : CIRCLE_SVG));
    });
    try {
      registerIconLibrary('async-lib', {
        resolver: (name, family, variant) => {
          resolverCalls.push([name, family, variant]);
          if (family === 'classic') {
            return new Promise<string>((resolve) => {
              resolveClassic = resolve;
            });
          }
          return Promise.resolve(`https://icons.test/${family}/${variant}/${name}.svg`);
        },
      });
      const el = (await fixture(html`
        <lr-icon
          library="async-lib"
          name="star"
          family="classic"
          variant="regular"
        ></lr-icon>
      `)) as LyraIcon;
      await waitUntil(() => resolverCalls.length === 1);
      el.family = 'sharp';
      el.variant = 'solid';
      await waitUntil(() => resolverCalls.length === 2);
      await waitUntil(() => partCount(el, '[part="svg"] rect') === 1);
      resolveClassic('https://icons.test/classic/regular/star.svg');
      await aTimeout(20);

      expect(resolverCalls).to.deep.equal([
        ['star', 'classic', 'regular'],
        ['star', 'sharp', 'solid'],
      ]);
      expect(requested).to.deep.equal(['https://icons.test/sharp/solid/star.svg']);
      expect(partCount(el, 'circle')).to.equal(0);
    } finally {
      restore();
    }
  });

  it('deduplicates a remote SVG and does not abort another connected subscriber', async () => {
    let calls = 0;
    let signal: AbortSignal | null | undefined;
    let resolveFetch!: (response: Response) => void;
    const restore = stubFetch((_url, init) => {
      calls += 1;
      signal = init?.signal;
      return new Promise<Response>((resolve, reject) => {
        resolveFetch = resolve;
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    });
    try {
      const first = (await fixture(
        html`<lr-icon src="https://icons.test/shared.svg"></lr-icon>`,
      )) as LyraIcon;
      const second = (await fixture(
        html`<lr-icon src="https://icons.test/shared.svg"></lr-icon>`,
      )) as LyraIcon;
      await waitUntil(() => calls === 1);
      first.remove();
      expect(signal?.aborted).to.equal(false);

      resolveFetch(svgResponse(CIRCLE_SVG));
      await waitUntil(() => partCount(second, '[part="svg"] circle') === 1);
      expect(calls).to.equal(1);
    } finally {
      restore();
    }
  });

  it('caches a canonical sanitized SVG and clones it before each trusted mutator', async () => {
    let calls = 0;
    const restore = stubFetch(() => {
      calls += 1;
      return Promise.resolve(svgResponse(CIRCLE_SVG));
    });
    try {
      registerIconLibrary('mutator-a', {
        resolver: () => 'https://icons.test/canonical.svg',
        mutator: (svg) => svg.setAttribute('data-owner', 'a'),
      });
      registerIconLibrary('mutator-b', {
        resolver: () => 'https://icons.test/canonical.svg',
        mutator: (svg) => svg.setAttribute('data-owner', 'b'),
      });
      const first = (await fixture(
        html`<lr-icon library="mutator-a" name="star"></lr-icon>`,
      )) as LyraIcon;
      const second = (await fixture(
        html`<lr-icon library="mutator-b" name="star"></lr-icon>`,
      )) as LyraIcon;
      await waitUntil(() => partCount(first, '[part="svg"]') === 1);
      await waitUntil(() => partCount(second, '[part="svg"]') === 1);

      const plain = (await fixture(
        html`<lr-icon src="https://icons.test/canonical.svg"></lr-icon>`,
      )) as LyraIcon;
      await waitUntil(() => partCount(plain, '[part="svg"]') === 1);
      const firstSvg = first.shadowRoot!.querySelector('[part="svg"]')!;
      const secondSvg = second.shadowRoot!.querySelector('[part="svg"]')!;
      const plainSvg = plain.shadowRoot!.querySelector('[part="svg"]')!;
      expect(firstSvg.getAttribute('data-owner')).to.equal('a');
      expect(secondSvg.getAttribute('data-owner')).to.equal('b');
      expect(plainSvg.hasAttribute('data-owner')).to.equal(false);
      expect(firstSvg.isSameNode(secondSvg)).to.equal(false);
      expect(calls).to.equal(1);
    } finally {
      restore();
    }
  });

  it('evicts retryable remote failures instead of poisoning the icon cache', async () => {
    let calls = 0;
    const restore = stubFetch(() => {
      calls += 1;
      return Promise.resolve(calls === 1 ? svgResponse('', false) : svgResponse(RECT_SVG));
    });
    try {
      const failed = (await fixture(html`<lr-icon></lr-icon>`)) as LyraIcon;
      const errored = oneEvent(failed, 'lr-error');
      failed.src = 'https://icons.test/retry.svg';
      await errored;

      const retried = (await fixture(
        html`<lr-icon src="https://icons.test/retry.svg"></lr-icon>`,
      )) as LyraIcon;
      await waitUntil(() => partCount(retried, '[part="svg"] rect') === 1);
      expect(calls).to.equal(2);
    } finally {
      restore();
    }
  });

  it('never lets a superseded load paint over a newer one', async () => {
    const restore = stubFetch((url) =>
      url.includes('slow')
        ? new Promise<Response>((resolve) => {
            setTimeout(() => resolve(svgResponse(CIRCLE_SVG)), 80);
          })
        : Promise.resolve(svgResponse(RECT_SVG)),
    );
    try {
      const el = (await fixture(html`<lr-icon></lr-icon>`)) as LyraIcon;
      el.src = 'https://icons.test/slow.svg';
      await aTimeout(0);
      el.src = 'https://icons.test/fast.svg';
      await waitUntil(() => partCount(el, '[part="svg"] rect') === 1);
      await aTimeout(200);
      expect(partCount(el, '[part="svg"] rect')).to.equal(1);
      expect(partCount(el, 'circle')).to.equal(0);
    } finally {
      restore();
    }
  });

  it('names a fetched icon through label and stays hidden without one', async () => {
    const restore = stubFetch(() => Promise.resolve(svgResponse(CIRCLE_SVG)));
    try {
      const el = (await fixture(
        html`<lr-icon src="https://icons.test/star.svg" label="Favorite"></lr-icon>`,
      )) as LyraIcon;
      await waitUntil(() => partCount(el, '[part="svg"]') === 1);
      const svg = el.shadowRoot!.querySelector('[part="svg"]')!;
      expect(svg.getAttribute('aria-label')).to.equal('Favorite');
      expect(svg.getAttribute('aria-hidden')).to.equal('false');
      await expect(el).to.be.accessible();

      el.label = '';
      await el.updateComplete;
      expect(svg.hasAttribute('aria-label')).to.be.false;
      expect(svg.getAttribute('aria-hidden')).to.equal('true');
    } finally {
      restore();
    }
  });

  it('exposes fetched use parts and applies independently themeable duotone layers', async () => {
    const duotone =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
      '<defs><path id="shape" d="M2 2h8v8H2z"></path></defs>' +
      '<path class="fa-secondary" d="M14 14h8v8h-8z"></path>' +
      '</svg>';
    const restore = stubFetch(() => Promise.resolve(svgResponse(duotone)));
    try {
      registerIconLibrary('duotone-lib', {
        resolver: () => 'https://icons.test/duotone.svg',
        mutator: (svg) => {
          const primary = document.createElementNS('http://www.w3.org/2000/svg', 'use');
          primary.setAttribute('class', 'fa-primary');
          primary.setAttribute('href', '#shape');
          svg.append(primary);
        },
      });
      const el = (await fixture(html`
        <lr-icon
          library="duotone-lib"
          name="shape"
          style="--primary-color: rgb(255 0 0); --primary-opacity: 0.8; --secondary-color: rgb(0 128 0); --secondary-opacity: 0.2"
        ></lr-icon>
      `)) as LyraIcon;
      await waitUntil(() => partCount(el, '[part~="svg"]') === 1);
      const primary = el.shadowRoot!.querySelector<SVGElement>('.fa-primary')!;
      const secondary = el.shadowRoot!.querySelector<SVGElement>('.fa-secondary')!;
      expect(primary.getAttribute('part')?.split(/\s+/)).to.include('use');
      expect(getComputedStyle(primary).fill).to.equal('rgb(255, 0, 0)');
      expect(getComputedStyle(primary).opacity).to.equal('0.8');
      expect(getComputedStyle(secondary).fill).to.equal('rgb(0, 128, 0)');
      expect(getComputedStyle(secondary).opacity).to.equal('0.2');

      el.swapOpacity = true;
      await el.updateComplete;
      expect(getComputedStyle(primary).opacity).to.equal('0.2');
      expect(getComputedStyle(secondary).opacity).to.equal('0.8');
    } finally {
      restore();
    }
  });

  it('refuses an oversized icon document before it is parsed', async () => {
    const huge = `<svg xmlns="http://www.w3.org/2000/svg"><title>${'x'.repeat(1024 * 1024)}</title></svg>`;
    const restore = stubFetch(() => Promise.resolve(svgResponse(huge)));
    try {
      const el = (await fixture(html`<lr-icon></lr-icon>`)) as LyraIcon;
      const errored = oneEvent(el, 'lr-error');
      el.src = 'https://icons.test/huge.svg';
      await errored;
      expect(partCount(el, '[part="error"]')).to.equal(1);
      expect(partCount(el, 'svg')).to.equal(0);
    } finally {
      restore();
    }
  });

  it('rejects a response that is not an SVG document', async () => {
    const restore = stubFetch(() => Promise.resolve(svgResponse('<p>Not an icon</p>')));
    try {
      const el = (await fixture(html`<lr-icon></lr-icon>`)) as LyraIcon;
      const errored = oneEvent(el, 'lr-error');
      el.src = 'https://icons.test/page.html';
      await errored;
      expect(partCount(el, '[part="error"]')).to.equal(1);
      expect(el.shadowRoot!.textContent!.includes('Not an icon')).to.be.false;
    } finally {
      restore();
    }
  });

  it('re-resolves a remote icon after a disconnect and reconnect', async () => {
    const restore = stubFetch(() => Promise.resolve(svgResponse(CIRCLE_SVG)));
    try {
      const el = (await fixture(html`<lr-icon src="https://icons.test/star.svg"></lr-icon>`)) as LyraIcon;
      await waitUntil(() => partCount(el, '[part="svg"] circle') === 1);
      const parent = el.parentElement!;
      el.remove();
      await aTimeout(0);
      expect(partCount(el, 'circle')).to.equal(0);
      parent.append(el);
      await waitUntil(() => partCount(el, '[part="svg"] circle') === 1);
    } finally {
      restore();
    }
  });

  it('leaves the built-in glyph path untouched when no remote source is configured', async () => {
    let calls = 0;
    const events: string[] = [];
    const restore = stubFetch(() => {
      calls += 1;
      return Promise.resolve(svgResponse(CIRCLE_SVG));
    });
    try {
      const el = (await fixture(html`<lr-icon name="search"></lr-icon>`)) as LyraIcon;
      el.addEventListener('lr-load', () => events.push('load'));
      el.addEventListener('lr-error', () => events.push('error'));
      await aTimeout(30);
      expect(calls).to.equal(0);
      expect(events).to.deep.equal([]);
      expect(partCount(el, 'svg > path')).to.equal(1);
      expect(el.shadowRoot!.querySelector('svg')!.getAttribute('aria-hidden')).to.equal('true');
      expect(partCount(el, '[part="error"]')).to.equal(0);
      expect(partCount(el, '[part="empty"]')).to.equal(0);
      // The transform rule keys off these attributes, so an unrotated, unflipped icon must not
      // carry either one — otherwise every icon in the library would grow a stacking context.
      expect(el.hasAttribute('rotate')).to.be.false;
      expect(el.hasAttribute('flip')).to.be.false;
      expect(el.hasAttribute('fixed-width')).to.be.false;
      expect(el.hasAttribute('family')).to.be.false;
      expect(el.hasAttribute('variant')).to.be.false;
      expect(el.hasAttribute('canvas')).to.be.false;
      expect(el.hasAttribute('auto-width')).to.be.false;
      expect(el.hasAttribute('swap-opacity')).to.be.false;
      expect(el.hasAttribute('animation')).to.be.false;
    } finally {
      restore();
    }
  });
});

describe('lr-icon presentation knobs', () => {
  const matrixOf = (el: Element): number[] => {
    const { transform } = getComputedStyle(el);
    if (transform === 'none') return [1, 0, 0, 1, 0, 0];
    const m = new DOMMatrixReadOnly(transform);
    return [m.a, m.b, m.c, m.d, m.e, m.f].map((value) => Math.round(value));
  };

  it('rotates the icon box by the requested angle', async () => {
    const el = (await fixture(html`<lr-icon name="search"></lr-icon>`)) as LyraIcon;
    expect(matrixOf(el)).to.deep.equal([1, 0, 0, 1, 0, 0]);
    el.rotate = 180;
    await el.updateComplete;
    expect(matrixOf(el)).to.deep.equal([-1, 0, 0, -1, 0, 0]);
    el.rotate = Number.NaN;
    await el.updateComplete;
    expect(matrixOf(el)).to.deep.equal([1, 0, 0, 1, 0, 0]);
  });

  it('flips physically, identically in LTR and RTL', async () => {
    const el = (await fixture(html`<lr-icon name="search" flip="horizontal"></lr-icon>`)) as LyraIcon;
    expect(matrixOf(el)).to.deep.equal([-1, 0, 0, 1, 0, 0]);
    el.setAttribute('dir', 'rtl');
    await el.updateComplete;
    expect(matrixOf(el)).to.deep.equal([-1, 0, 0, 1, 0, 0]);

    el.flip = 'vertical';
    await el.updateComplete;
    expect(matrixOf(el)).to.deep.equal([1, 0, 0, -1, 0, 0]);

    el.flip = 'both';
    await el.updateComplete;
    expect(matrixOf(el)).to.deep.equal([-1, 0, 0, -1, 0, 0]);

    el.flip = 'x';
    await el.updateComplete;
    expect(matrixOf(el)).to.deep.equal([-1, 0, 0, 1, 0, 0]);

    el.flip = 'y';
    await el.updateComplete;
    expect(matrixOf(el)).to.deep.equal([1, 0, 0, -1, 0, 0]);
  });

  it('implements fixed, intrinsic, square, roomy, and deprecated auto-width canvases', async () => {
    const icon = async (attributes = ''): Promise<LyraIcon> =>
      (await fixture(
        html`<lr-icon name="search" style="font-size: 20px" .canvas=${
          attributes || undefined
        }></lr-icon>`,
      )) as LyraIcon;
    const plain = await icon();
    const fixed = await icon('fixed');
    const auto = await icon('auto');
    const square = await icon('square');
    const roomy = await icon('roomy');
    const autoAlias = (await fixture(
      html`<lr-icon name="search" style="font-size: 20px" auto-width></lr-icon>`,
    )) as LyraIcon;

    for (const el of [plain, fixed]) {
      expect(el.getBoundingClientRect().width).to.be.closeTo(25, 0.25);
      expect(el.getBoundingClientRect().height).to.be.closeTo(20, 0.25);
    }
    for (const el of [auto, autoAlias]) {
      expect(el.getBoundingClientRect().width).to.be.closeTo(20, 0.25);
      expect(el.getBoundingClientRect().height).to.be.closeTo(20, 0.25);
    }
    expect(square.getBoundingClientRect().width).to.be.closeTo(25, 0.25);
    expect(square.getBoundingClientRect().height).to.be.closeTo(25, 0.25);
    expect(roomy.getBoundingClientRect().width).to.be.closeTo(30, 0.25);
    expect(roomy.getBoundingClientRect().height).to.be.closeTo(30, 0.25);
  });

  it('runs every documented animation and resolves the shared timing hooks', async function () {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) this.skip();
    const names = [
      'beat',
      'fade',
      'beat-fade',
      'bounce',
      'flip',
      'flip-360',
      'shake',
      'spin',
      'spin-pulse',
      'spin-reverse',
      'spin-snap',
      'spin-snap-4',
      'spin-snap-8',
      'buzz',
      'wag',
      'float',
      'swing',
      'jello',
    ] as const;
    const el = (await fixture(html`
      <lr-icon
        name="search"
        style="--animation-delay: 0.25s; --animation-duration: 2s; --animation-iteration-count: 3; --animation-timing: linear"
      ></lr-icon>
    `)) as LyraIcon;
    const svg = el.shadowRoot!.querySelector<SVGSVGElement>('[part~="svg"]')!;

    for (const name of names) {
      el.animation = name;
      await el.updateComplete;
      const animation = getComputedStyle(svg);
      expect(animation.animationName, name).to.not.equal('none');
      expect(animation.animationDelay, name).to.equal('0.25s');
      expect(animation.animationDuration, name).to.equal('2s');
      expect(animation.animationIterationCount, name).to.equal('3');
      expect(animation.animationTimingFunction, name).to.equal('linear');
    }
  });

  it('defaults an icon animation cycle to the mirrored one-second duration token', async function () {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) this.skip();
    const el = (await fixture(
      html`<lr-icon name="search" animation="spin"></lr-icon>`,
    )) as LyraIcon;
    const svg = el.shadowRoot!.querySelector<SVGSVGElement>('[part~="svg"]')!;
    expect(getComputedStyle(svg).animationDuration).to.equal('1s');
  });

  it('stops icon animations under prefers-reduced-motion', async () => {
    const el = (await fixture(
      html`<lr-icon name="search" animation="spin"></lr-icon>`,
    )) as LyraIcon;
    const svg = el.shadowRoot!.querySelector<SVGSVGElement>('[part~="svg"]')!;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      expect(getComputedStyle(svg).animationName).to.equal('none');
      return;
    }

    const reducedRule = el.shadowRoot!.adoptedStyleSheets
      .flatMap((sheet) => [...sheet.cssRules])
      .find(
        (rule): rule is CSSMediaRule =>
          rule instanceof CSSMediaRule &&
          rule.conditionText === '(prefers-reduced-motion: reduce)' &&
          [...rule.cssRules].some(
            (nested) =>
              nested instanceof CSSStyleRule &&
              nested.selectorText.includes(':host(:where([animation])) svg') &&
              nested.style.getPropertyPriority('animation') === 'important',
          ),
      );
    expect(reducedRule).to.exist;
    const originalCondition = reducedRule!.media.mediaText;
    try {
      reducedRule!.media.mediaText = 'all';
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      expect(getComputedStyle(svg).animationName).to.equal('none');
    } finally {
      reducedRule!.media.mediaText = originalCondition;
    }
  });

  it('widens the icon box under fixed-width while keeping the glyph size', async () => {
    const plain = (await fixture(html`<lr-icon name="search"></lr-icon>`)) as LyraIcon;
    const fixed = (await fixture(html`<lr-icon name="search" fixed-width></lr-icon>`)) as LyraIcon;
    const plainBox = plain.getBoundingClientRect();
    const fixedBox = fixed.getBoundingClientRect();
    expect(fixedBox.width > plainBox.width).to.be.true;
    expect(fixedBox.height).to.equal(plainBox.height);
    expect(fixed.shadowRoot!.querySelector('svg')!.getBoundingClientRect().width).to.equal(
      plain.shadowRoot!.querySelector('svg')!.getBoundingClientRect().width,
    );
  });
});

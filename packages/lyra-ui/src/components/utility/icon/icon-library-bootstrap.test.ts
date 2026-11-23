import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import '../../lr-icon.js';
import type { LyraIcon } from '../../lr-icon.js';
import { getIconLibrary } from './icon-library.js';
import {
  BOOTSTRAP_ICONS_DEFAULT_VERSION,
  bootstrapIconMutator,
  createBootstrapIconResolver,
  registerBootstrapIconLibrary,
} from './icon-library-bootstrap.js';
import { __clearIconResourceCacheForTesting } from './icon-resource.js';

const CDN = `https://cdn.jsdelivr.net/npm/bootstrap-icons@${BOOTSTRAP_ICONS_DEFAULT_VERSION}/icons`;
const GEAR_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M0 0h16v16H0z"></path></svg>';

function svgResponse(body: string, ok = true): Response {
  return { ok, status: ok ? 200 : 404, statusText: ok ? 'OK' : 'Not Found', text: () => Promise.resolve(body) } as Response;
}

/** Stubs `window.fetch`, records every URL, and returns the restore function. */
function stubFetch(handler: (url: string) => Promise<Response>): { urls: string[]; restore: () => void } {
  const original = window.fetch;
  const urls: string[] = [];
  window.fetch = ((input: RequestInfo | URL) => {
    urls.push(String(input));
    return handler(String(input));
  }) as typeof window.fetch;
  return { urls, restore: () => { window.fetch = original; } };
}

const resolve = (options: Parameters<typeof createBootstrapIconResolver>[0], name: string, family = '', variant = '') =>
  createBootstrapIconResolver(options)(name, family, variant);

describe('Bootstrap Icons URL resolution', () => {
  it('resolves from a pinned release, accepts the bi- class form, and ignores family and variant', () => {
    expect(resolve({}, 'gear')).to.equal(`${CDN}/gear.svg`);
    expect(resolve({}, 'bi-house-fill')).to.equal(`${CDN}/house-fill.svg`);
    expect(resolve({}, '1-circle', 'sharp', 'thin')).to.equal(`${CDN}/1-circle.svg`);
    expect(resolve({ version: '1.11.3' }, 'gear')).to.equal('https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/gear.svg');
  });

  it('resolves a self-hosted base path instead of the CDN', () => {
    expect(resolve({ basePath: '/assets/bootstrap-icons/' }, 'gear')).to.equal('/assets/bootstrap-icons/gear.svg');
    expect(resolve({ basePath: '/assets/bi///' }, 'gear')).to.equal('/assets/bi/gear.svg');
    expect(resolve({ basePath: `/bi${'/'.repeat(50_000)}` }, 'gear')).to.equal('/bi/gear.svg');
    expect(resolve({ basePath: 'https://static.example/bi', version: '1.0.0' }, 'x-lg')).to.equal('https://static.example/bi/x-lg.svg');
  });

  it('refuses unsafe names and malformed options before any request', () => {
    for (const name of ['', 'bi-', '../gear', 'gear.svg', 'gear?x=1', 'gear#a', 'Gear', 'a/b', '%2e%2e', 'gear-']) {
      expect(() => resolve({}, name), name).to.throw(RangeError);
    }
    expect(() => createBootstrapIconResolver({ version: '1.13' })).to.throw(TypeError);
    expect(() => createBootstrapIconResolver({ version: 'latest' })).to.throw(TypeError);
    expect(() => createBootstrapIconResolver({ basePath: '/bi?x' })).to.throw(TypeError);
    expect(() => createBootstrapIconResolver({ basePath: ' ' })).to.throw(TypeError);
  });

  it('adds currentColor only to an SVG that declares no fill', () => {
    const bare = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    bootstrapIconMutator(bare);
    expect(bare.getAttribute('fill')).to.equal('currentColor');
    const filled = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    filled.setAttribute('fill', 'none');
    bootstrapIconMutator(filled);
    expect(filled.getAttribute('fill')).to.equal('none');
  });
});

describe('registerBootstrapIconLibrary with <lr-icon>', () => {
  let unregister: (() => void) | undefined;
  beforeEach(() => __clearIconResourceCacheForTesting());
  afterEach(() => {
    unregister?.();
    unregister = undefined;
    __clearIconResourceCacheForTesting();
  });

  it('registers nothing until called, then renders a sanitized, currentColor icon', async () => {
    expect(getIconLibrary('bi')).to.equal(undefined);
    const fetch = stubFetch(() => Promise.resolve(svgResponse(GEAR_SVG.replace('<path', '<script>alert(1)</script><path'))));
    try {
      const el = await fixture<LyraIcon>(html`<lr-icon library="bi" name="gear" label="Settings"></lr-icon>`);
      // Unregistered: the built-in set renders and nothing is fetched (offline-first).
      expect(fetch.urls).to.deep.equal([]);
      const loaded = oneEvent(el, 'lr-load');
      unregister = registerBootstrapIconLibrary();
      await loaded;
      expect(fetch.urls).to.deep.equal([`${CDN}/gear.svg`]);
      const svg = el.shadowRoot!.querySelector('svg')!;
      expect(svg.getAttribute('fill')).to.equal('currentColor');
      expect(el.shadowRoot!.querySelector('script') === null).to.equal(true);
      await expect(el).to.be.accessible();
    } finally {
      fetch.restore();
    }
  });

  it('owns unlabelled-library icons when registered as the default library', async () => {
    const fetch = stubFetch(() => Promise.resolve(svgResponse(GEAR_SVG)));
    try {
      unregister = registerBootstrapIconLibrary({ name: 'default', basePath: '/vendor/bi' });
      const el = await fixture<LyraIcon>(html`<lr-icon label="Settings"></lr-icon>`);
      const loaded = oneEvent(el, 'lr-load');
      el.name = 'gear-wide-connected';
      await loaded;
      // The fetch layer resolves the self-hosted path against the document.
      expect(fetch.urls.map((url) => new URL(url, document.baseURI).pathname)).to.deep.equal(['/vendor/bi/gear-wide-connected.svg']);
    } finally {
      fetch.restore();
    }
  });

  it('fails closed with the localized fallback, without a request, for an invalid name', async () => {
    const fetch = stubFetch(() => Promise.resolve(svgResponse(GEAR_SVG)));
    try {
      unregister = registerBootstrapIconLibrary();
      const el = await fixture<LyraIcon>(html`<lr-icon label="Settings"></lr-icon>`);
      const errored = oneEvent(el, 'lr-error');
      Object.assign(el, { library: 'bi', name: '../gear' });
      const event = await errored;
      expect(fetch.urls).to.deep.equal([]);
      expect(event.detail.src).to.equal('../gear');
      expect(el.shadowRoot!.querySelectorAll('svg').length).to.equal(0);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent!.trim()).to.equal('The icon failed to load.');
    } finally {
      fetch.restore();
    }
  });

  it('routes a failed or oversized download through the translated alerts', async () => {
    const fetch = stubFetch((url) => Promise.resolve(
      url.includes('/big.svg') ? svgResponse(`<svg>${'x'.repeat(1024 * 1024 + 1)}</svg>`) : svgResponse('', false),
    ));
    try {
      unregister = registerBootstrapIconLibrary();
      const strings = { iconLoadError: 'Icone indisponible', iconTooLarge: 'Icone trop grande' };
      const missing = await fixture<LyraIcon>(html`<lr-icon label="A" .strings=${strings}></lr-icon>`);
      const missed = oneEvent(missing, 'lr-error');
      Object.assign(missing, { library: 'bi', name: 'missing' });
      await missed;
      expect(missing.shadowRoot!.querySelector('[part="error"]')!.textContent!.trim()).to.equal('Icone indisponible');

      const big = await fixture<LyraIcon>(html`<lr-icon label="B" .strings=${strings}></lr-icon>`);
      const tooBig = oneEvent(big, 'lr-error');
      Object.assign(big, { library: 'bi', name: 'big' });
      await tooBig;
      expect(big.shadowRoot!.querySelector('[part="error"]')!.textContent!.trim()).to.equal('Icone trop grande');
      expect(big.shadowRoot!.querySelectorAll('svg').length).to.equal(0);
    } finally {
      fetch.restore();
    }
  });

  it('unregisters only its own registration', () => {
    const first = registerBootstrapIconLibrary({ name: 'bi-test' });
    const second = registerBootstrapIconLibrary({ name: 'bi-test', basePath: '/bi' });
    first();
    expect(getIconLibrary('bi-test')).to.not.equal(undefined);
    second();
    expect(getIconLibrary('bi-test')).to.equal(undefined);
  });
});

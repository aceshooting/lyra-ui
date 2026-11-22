import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import '../../lr-icon.js';
import type { LyraIcon } from '../../lr-icon.js';
import { getIconLibrary, setDefaultIconFamily, getDefaultIconFamily, getDefaultIconVariant } from './icon-library.js';
import {
  FONT_AWESOME_DEFAULT_VERSION,
  createFontAwesomeIconResolver,
  fontAwesomeIconFolder,
  registerFontAwesomeIconLibrary,
} from './icon-library-font-awesome.js';
import { __clearIconResourceCacheForTesting } from './icon-resource.js';

const FREE = `https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@${FONT_AWESOME_DEFAULT_VERSION}/svgs`;
const HOUSE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M0 0h512v512H0z"></path></svg>';

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

const resolve = (options: Parameters<typeof createFontAwesomeIconResolver>[0], name: string, family = '', variant = '') =>
  createFontAwesomeIconResolver(options)(name, family, variant);

describe('Font Awesome folder and URL resolution', () => {
  it('maps every family and variant onto Font Awesome folders', () => {
    expect(fontAwesomeIconFolder('', '')).to.equal('solid');
    expect(fontAwesomeIconFolder('classic', 'thin')).to.equal('thin');
    expect(fontAwesomeIconFolder('brands', 'regular')).to.equal('brands');
    expect(fontAwesomeIconFolder('duotone', 'solid')).to.equal('duotone');
    expect(fontAwesomeIconFolder('duotone', 'light')).to.equal('duotone-light');
    expect(fontAwesomeIconFolder('sharp', 'regular')).to.equal('sharp-regular');
    expect(fontAwesomeIconFolder('sharp-duotone', 'thin')).to.equal('sharp-duotone-thin');
    // A single-style pack always uses its own style, like brands ignores variants.
    expect(fontAwesomeIconFolder('jelly-duo', 'solid')).to.equal('jelly-duo-regular');
    expect(fontAwesomeIconFolder('utility', '')).to.equal('utility-semibold');
    expect(() => fontAwesomeIconFolder('classic', 'semibold')).to.throw(RangeError);
    expect(() => fontAwesomeIconFolder('material', 'solid')).to.throw(RangeError);
    expect(() => fontAwesomeIconFolder('constructor', '')).to.throw(RangeError);
  });

  it('resolves the free tier from a pinned release and accepts the fa- class form', () => {
    expect(resolve({}, 'house')).to.equal(`${FREE}/solid/house.svg`);
    expect(resolve({}, 'fa-house', 'classic', 'regular')).to.equal(`${FREE}/regular/house.svg`);
    expect(resolve({}, 'github', 'brands')).to.equal(`${FREE}/brands/github.svg`);
    expect(resolve({ version: '6.7.2' }, 'house')).to.contain('fontawesome-free@6.7.2/svgs/solid/');
  });

  it('refuses Pro families, unsafe names, and malformed options before any request', () => {
    expect(() => resolve({}, 'house', 'sharp')).to.throw(/kitCode or a self-hosted basePath/);
    expect(() => resolve({}, 'house', 'classic', 'light')).to.throw(RangeError);
    for (const name of ['', '../house', 'house.svg', 'house?x=1', 'house#a', 'House', 'a/b', '%2e%2e']) {
      expect(() => resolve({}, name), name).to.throw(RangeError);
    }
    expect(() => createFontAwesomeIconResolver({ kitCode: 'abc&x=1' })).to.throw(TypeError);
    expect(() => createFontAwesomeIconResolver({ version: '7' })).to.throw(TypeError);
    expect(() => createFontAwesomeIconResolver({ basePath: '/fa?x' })).to.throw(TypeError);
    expect(() => createFontAwesomeIconResolver({ defaultFamily: 'nope' as never })).to.throw(TypeError);
    expect(() => createFontAwesomeIconResolver({ defaultVariant: 'semibold' })).to.throw(RangeError);
  });

  it('unlocks every family through a kit code or a self-hosted base path', () => {
    expect(resolve({ kitCode: 'abc123' }, 'house', 'sharp-duotone', 'light')).to.equal(
      `https://ka-p.fontawesome.com/releases/v${FONT_AWESOME_DEFAULT_VERSION}/svgs/sharp-duotone-light/house.svg?token=abc123`,
    );
    expect(resolve({ basePath: '/assets/fa/svgs/' }, 'house', 'thumbprint')).to.equal('/assets/fa/svgs/thumbprint-light/house.svg');
    expect(resolve({ basePath: '/fa', kitCode: 'abc123' }, 'house', 'duotone')).to.equal('/fa/duotone/house.svg');
  });

  it('applies the preset defaults only where the icon and the global default are silent', () => {
    const options = { kitCode: 'k1', defaultFamily: 'sharp', defaultVariant: 'thin' } as const;
    expect(resolve(options, 'house')).to.contain('/sharp-thin/house.svg');
    // An icon (or global) family wins and keeps that family's own default variant.
    expect(resolve(options, 'house', 'duotone')).to.contain('/duotone/house.svg');
    expect(resolve(options, 'house', '', 'light')).to.contain('/sharp-light/house.svg');
  });
});

describe('registerFontAwesomeIconLibrary with <lr-icon>', () => {
  let unregister: (() => void) | undefined;
  let savedFamily = '';
  let savedVariant = '';
  beforeEach(() => {
    __clearIconResourceCacheForTesting();
    savedFamily = getDefaultIconFamily();
    savedVariant = getDefaultIconVariant();
  });
  afterEach(() => {
    unregister?.();
    unregister = undefined;
    setDefaultIconFamily(savedFamily, savedVariant);
    __clearIconResourceCacheForTesting();
  });

  it('registers nothing until called, then renders a sanitized, currentColor icon', async () => {
    expect(getIconLibrary('fa')).to.equal(undefined);
    const fetch = stubFetch(() => Promise.resolve(svgResponse(HOUSE_SVG.replace('<path', '<script>alert(1)</script><path'))));
    try {
      const el = await fixture<LyraIcon>(html`<lr-icon library="fa" name="house" label="Home"></lr-icon>`);
      // Unregistered: the built-in set renders and nothing is fetched (offline-first).
      expect(fetch.urls).to.deep.equal([]);
      const loaded = oneEvent(el, 'lr-load');
      unregister = registerFontAwesomeIconLibrary();
      await loaded;
      expect(fetch.urls).to.deep.equal([`${FREE}/solid/house.svg`]);
      const svg = el.shadowRoot!.querySelector('svg')!;
      expect(svg.getAttribute('fill')).to.equal('currentColor');
      expect(el.shadowRoot!.querySelector('script')).to.equal(null);
      await expect(el).to.be.accessible();
    } finally {
      fetch.restore();
    }
  });

  it('honours setDefaultIconFamily() and the per-icon family and variant', async () => {
    const fetch = stubFetch(() => Promise.resolve(svgResponse(HOUSE_SVG)));
    try {
      unregister = registerFontAwesomeIconLibrary({ kitCode: 'kit42' });
      setDefaultIconFamily('sharp', 'light');
      const el = await fixture<LyraIcon>(html`<lr-icon library="fa" name="house"></lr-icon>`);
      await waitUntil(() => fetch.urls.length === 1);
      expect(fetch.urls[0]).to.contain('/svgs/sharp-light/house.svg?token=kit42');

      el.family = 'duotone';
      el.variant = 'thin';
      await waitUntil(() => fetch.urls.some((url) => url.includes('/svgs/duotone-thin/house.svg')));

      el.family = '';
      el.variant = '';
      setDefaultIconFamily('classic', 'regular');
      await waitUntil(() => fetch.urls.some((url) => url.includes('/svgs/regular/house.svg')));
      expect(fetch.urls.every((url) => url.endsWith('?token=kit42'))).to.equal(true);
    } finally {
      fetch.restore();
    }
  });

  it('fails closed with the localized fallback, without a request, for a Pro family on the free tier', async () => {
    const fetch = stubFetch(() => Promise.resolve(svgResponse(HOUSE_SVG)));
    try {
      unregister = registerFontAwesomeIconLibrary();
      const el = await fixture<LyraIcon>(html`<lr-icon label="Home"></lr-icon>`);
      const errored = oneEvent(el, 'lr-error');
      Object.assign(el, { library: 'fa', family: 'sharp', name: 'house' });
      const event = await errored;
      expect(fetch.urls).to.deep.equal([]);
      expect(event.detail.src).to.equal('house');
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
      unregister = registerFontAwesomeIconLibrary();
      const strings = { iconLoadError: 'Icone indisponible', iconTooLarge: 'Icone trop grande' };
      const missing = await fixture<LyraIcon>(html`<lr-icon label="A" .strings=${strings}></lr-icon>`);
      const missed = oneEvent(missing, 'lr-error');
      Object.assign(missing, { library: 'fa', name: 'missing' });
      await missed;
      expect(missing.shadowRoot!.querySelector('[part="error"]')!.textContent!.trim()).to.equal('Icone indisponible');

      const big = await fixture<LyraIcon>(html`<lr-icon label="B" .strings=${strings}></lr-icon>`);
      const tooBig = oneEvent(big, 'lr-error');
      Object.assign(big, { library: 'fa', name: 'big' });
      await tooBig;
      expect(big.shadowRoot!.querySelector('[part="error"]')!.textContent!.trim()).to.equal('Icone trop grande');
      expect(big.shadowRoot!.querySelectorAll('svg').length).to.equal(0);
    } finally {
      fetch.restore();
    }
  });

  it('unregisters only its own registration', async () => {
    const first = registerFontAwesomeIconLibrary({ name: 'fa-test' });
    const second = registerFontAwesomeIconLibrary({ name: 'fa-test', kitCode: 'k2' });
    first();
    expect(getIconLibrary('fa-test')).to.not.equal(undefined);
    second();
    expect(getIconLibrary('fa-test')).to.equal(undefined);
  });
});

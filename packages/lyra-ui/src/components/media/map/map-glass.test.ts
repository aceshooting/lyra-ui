import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { toRgba, contrastRatio, resolvedColorToken } from '../../../../test/color-contrast.js';
import { setForcedColors } from '../../../../test/wtr-media.js';
import './map.js';
import type { LyraMap } from './map.js';

const composite = (paint: string, backdrop: string): string => {
  const foreground = toRgba(paint);
  const background = toRgba(backdrop);
  return `rgb(${foreground.slice(0, 3).map((channel, index) => channel * foreground[3] / 255 + background[index]! * (1 - foreground[3] / 255)).join(' ')})`;
};

/** Native peer nodes exercise the component's CSS even where WebGL2 is unavailable. */
async function chromeFixture(look = 'shadcn', mode = 'light', treatment = 'glass') {
  const host = await fixture<LyraMap>(html`<lr-map data-lr-look=${look} data-lr-mode=${mode}
    data-lr-surface=${treatment} .legend=${[{ label: 'Category', color: 'red' }]}></lr-map>`);
  const base = host.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const controls = ['maplibregl-ctrl-group', 'maplibregl-ctrl-scale', 'maplibregl-ctrl-attrib'].map((name) => {
    const element = document.createElement('div');
    element.className = `maplibregl-ctrl ${name}`;
    element.textContent = 'Control';
    base.append(element);
    return element;
  });
  const legend = host.shadowRoot!.querySelector<HTMLElement>('[part="legend"]')!;
  return { host, controls, legend, surfaces: [...controls, legend] };
}

describe('map floating chrome material', () => {
  let previous: CSSStyleSheet[];
  let sheets: CSSStyleSheet[];
  before(async () => {
    sheets = await Promise.all(['theme.css', 'surfaces/glass.css', 'preferences.css', 'looks/material.css', 'looks/data.css', 'looks/terminal.css', 'looks/high-contrast.css'].map(async path => {
      const response = await fetch(new URL(`../../../${path}`, import.meta.url));
      if (!response.ok) throw new Error(`Missing map chrome fixture ${path}`);
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(await response.text());
      return sheet;
    }));
  });
  beforeEach(() => {
    previous = document.adoptedStyleSheets;
    document.adoptedStyleSheets = [...previous, ...sheets];
  });
  afterEach(() => {
    fixtureCleanup();
    document.adoptedStyleSheets = previous;
  });

  for (const look of ['lyra', 'shadcn', 'material', 'data', 'terminal', 'high-contrast']) for (const mode of ['light', 'dark']) {
    it(`shares readable ${look}/${mode} material across navigation, scale, attribution and legend`, async function () {
      if (!CSS.supports('backdrop-filter', 'blur(1px)')) this.skip();
      const { host, controls, surfaces } = await chromeFixture(look, mode);
      for (const surface of surfaces) {
        const paint = getComputedStyle(surface).backgroundColor;
        expect(toRgba(paint)[3]).to.be.within(203, 205);
        const layer = surface.querySelector<HTMLElement>(':scope > .glass-scroll-layer') ?? surface;
        expect(getComputedStyle(layer, '::before').backdropFilter).to.include('blur(');
        for (const backdrop of ['black', 'white']) {
          const background = composite(paint, backdrop);
          expect(contrastRatio(getComputedStyle(surface).color, background)).to.be.at.least(4.5);
          expect(contrastRatio(resolvedColorToken(surface, '--lr-color-text-quiet'), background)).to.be.at.least(4.5);
          if (surface === controls[0]) {
            const highlighted = composite('rgb(255 255 255 / 0.12)', background);
            expect(contrastRatio(getComputedStyle(surface).borderTopColor, highlighted)).to.be.at.least(3);
          }
        }
      }
      host.setAttribute('data-lr-surface', 'solid');
      expect(getComputedStyle(host.shadowRoot!.querySelector('[part="legend-swatch"]')!).backgroundColor).to.equal('rgb(255, 0, 0)');
      for (const surface of surfaces) {
        const layer = surface.querySelector<HTMLElement>(':scope > .glass-scroll-layer') ?? surface;
        expect(toRgba(getComputedStyle(surface).backgroundColor)[3]).to.equal(255);
        expect(getComputedStyle(layer, '::before').content).to.equal('none');
      }
      host.setAttribute('data-lr-surface', 'glass');
      host.setAttribute('data-lr-contrast', 'more');
      for (const surface of surfaces) expect(toRgba(getComputedStyle(surface).backgroundColor)[3]).to.equal(255);
    });
  }

  it('keeps legend content geometry unchanged when its decorative layer is inserted', async () => {
    const { host, legend } = await chromeFixture();
    const layer = legend.querySelector<HTMLElement>(':scope > .glass-scroll-layer')!;
    const list = legend.querySelector<HTMLElement>('.legend-list')!;
    const geometry = () => ({
      height: legend.getBoundingClientRect().height,
      contentTop: list.getBoundingClientRect().top,
      contentHeight: list.getBoundingClientRect().height,
    });
    for (const treatment of ['solid', 'glass']) {
      host.setAttribute('data-lr-surface', treatment);
      const next = layer.nextSibling;
      layer.remove();
      const before = geometry();
      legend.insertBefore(layer, next);
      expect(geometry()).to.deep.equal(before);
    }
  });

  it('keeps the legend material stationary through scrolling, resizing and reconnecting in both directions', async () => {
    const { host, legend } = await chromeFixture();
    legend.style.maxBlockSize = '80px';
    legend.style.inlineSize = '180px';
    const content = document.createElement('div');
    content.style.cssText = 'height:600px;width:400px;flex:0 0 auto';
    legend.append(content);
    const layer = legend.querySelector<HTMLElement>(':scope > .glass-scroll-layer')!;
    for (const direction of ['ltr', 'rtl']) {
      host.dir = direction;
      await host.updateComplete;
      legend.scrollTop = 0;
      legend.scrollLeft = 0;
      await waitUntil(() => parseFloat(getComputedStyle(layer, '::before').height) === legend.clientHeight);
      const initial = layer.getBoundingClientRect();
      legend.scrollTop = 120;
      legend.scrollLeft = direction === 'rtl' ? -50 : 50;
      await waitUntil(() => layer.style.getPropertyValue('--_lr-glass-scroll-offset') === `${legend.scrollLeft}px`);
      expect(legend.scrollTop).to.be.greaterThan(0);
      expect(layer.getBoundingClientRect().top).to.equal(initial.top);
      expect(layer.getBoundingClientRect().left).to.equal(initial.left);
    }
    legend.style.maxBlockSize = '100px';
    await waitUntil(() => parseFloat(getComputedStyle(layer, '::before').height) === legend.clientHeight);
    const parent = host.parentNode!;
    host.remove();
    parent.append(host);
    await waitUntil(() => parseFloat(getComputedStyle(layer, '::before').height) === legend.clientHeight);
    expect(getComputedStyle(layer, '::before').backdropFilter).to.include('blur(');
  });

  it('uses opaque system surfaces when forced colors is active', async () => {
    const { surfaces } = await chromeFixture();
    try {
      await setForcedColors('active');
      for (const surface of surfaces) {
        const layer = surface.querySelector<HTMLElement>(':scope > .glass-scroll-layer') ?? surface;
        expect(toRgba(getComputedStyle(surface).backgroundColor)[3]).to.equal(255);
        expect(getComputedStyle(layer, '::before').content).to.equal('none');
      }
    } finally {
      await setForcedColors('none');
    }
  });
});

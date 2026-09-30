import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { css } from 'lit';
import { LyraElement } from './lyra-element.js';
import { tokens } from './tokens.styles.js';
import { GlassScrollLayer } from './glass-scroll-layer.js';
import { glassSurface } from './glass-surface.styles.js';
import { glassScrollLayerStyles } from './glass-scroll-layer.styles.js';
import { setForcedColors } from '../../test/wtr-media.js';

class GlassScrollFixture extends LyraElement {
  constructor() { super(); new GlassScrollLayer(this, '.surface'); }
  static override styles = [LyraElement.styles, css`
    :host { display: block; }
    .surface { position: relative; height: 100px; width: 160px; overflow: auto; padding: 8px; border: 2px solid; border-radius: 8px; }
    ${glassScrollLayerStyles}
    ${glassSurface('.surface', css`rgb(250 250 250)`, undefined, true)}
  `];
  override render() { return html`<div class="surface"><span class="glass-scroll-layer" aria-hidden="true"></span><slot></slot></div>`; }
}
customElements.define('test-glass-scroll-surface', GlassScrollFixture);

describe('glass surface composition', () => {
  let surfaceSheet: CSSStyleSheet;
  let preferenceSheet: CSSStyleSheet;
  let previousSheets: CSSStyleSheet[];

  function backgroundPixel(element: Element): number[] {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d')!;
    context.fillStyle = getComputedStyle(element).backgroundColor;
    context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data];
  }

  before(async () => {
    const response = await fetch(new URL('../surfaces/glass.css', import.meta.url));
    if (!response.ok) throw new Error('Missing glass stylesheet fixture');
    surfaceSheet = new CSSStyleSheet();
    surfaceSheet.replaceSync(await response.text());
    const preferences = await fetch(new URL('../preferences.css', import.meta.url));
    if (!preferences.ok) throw new Error('Missing preference stylesheet fixture');
    preferenceSheet = new CSSStyleSheet();
    preferenceSheet.replaceSync(await preferences.text());
  });
  beforeEach(() => {
    previousSheets = document.adoptedStyleSheets;
    document.adoptedStyleSheets = [...previousSheets, surfaceSheet, preferenceSheet];
  });
  afterEach(() => { document.adoptedStyleSheets = previousSheets; });

  async function surfaces(treatment?: 'solid' | 'glass') {
    const host = await fixture<HTMLDivElement>(html`<div data-lr-surface=${treatment}></div>`);
    if (treatment === undefined) host.removeAttribute('data-lr-surface');
    const shadow = host.attachShadow({ mode: 'open' });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css`
      ${tokens}
      :host { display: block; margin-block-start: 80px; }
      .surface { position: relative; min-block-size: 100px; border-radius: 8px; }
      .fixed { position: fixed; top: 7px; left: 9px; }
      ${glassSurface('.surface', css`rgb(250 250 250)`, css`var(--resting-fill, rgb(250 250 250))`)}
    `.cssText);
    shadow.adoptedStyleSheets = [sheet];
    const outer = document.createElement('div');
    outer.className = 'surface';
    const inner = document.createElement('div');
    inner.className = 'surface';
    const fixed = document.createElement('div');
    fixed.className = 'fixed';
    fixed.textContent = 'Overlay';
    inner.append(fixed);
    outer.append(inner);
    shadow.append(outer);
    return { host, outer, inner, fixed };
  }

  it('leaves the solid surface opaque without creating a glass layer', async () => {
    const { outer } = await surfaces('solid');
    outer.style.setProperty('--lr-theme-surface-opacity', '0');
    expect(backgroundPixel(outer)).to.deep.equal([250, 250, 250, 255]);
    expect(getComputedStyle(outer, '::before').content).to.equal('none');
    expect(getComputedStyle(outer, '::before').backdropFilter).to.equal('none');
  });

  it('filters the decorative layer without capturing fixed descendants', async function () {
    if (!CSS.supports('backdrop-filter', 'blur(1px)')) this.skip();
    const { outer, fixed } = await surfaces('glass');
    expect(getComputedStyle(outer).backdropFilter).to.equal('none');
    expect(getComputedStyle(outer, '::before').backdropFilter).to.include('blur(');
    expect(fixed.getBoundingClientRect().top).to.equal(7);
    expect(fixed.getBoundingClientRect().left).to.equal(9);
  });

  it('prevents nested blur without cyclic inherited opacity values', async function () {
    if (!CSS.supports('backdrop-filter', 'blur(1px)')) this.skip();
    const { inner } = await surfaces('glass');
    const layer = getComputedStyle(inner, '::before');
    expect(layer.backdropFilter).to.equal('none');
    expect(backgroundPixel(inner)).to.deep.equal([250, 250, 250, 255]);
  });

  it('captures material for a painted host and class selectors without suppressing Glass below Solid', async function () {
    if (!CSS.supports('backdrop-filter', 'blur(1px)')) this.skip();
    const scope = await fixture<HTMLDivElement>(html`<div data-lr-surface="solid"><div data-lr-surface="glass"></div></div>`);
    const host = scope.firstElementChild as HTMLDivElement;
    const shadow = host.attachShadow({ mode: 'open' });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css`
      ${tokens}
      :host, .surface { position: relative; display: block; min-block-size: 20px; }
      ${glassSurface(':host(:not([data-contained])), .surface', css`rgb(250 250 250)`)}
    `.cssText);
    shadow.adoptedStyleSheets = [surfaceSheet, sheet];
    const inner = document.createElement('div');
    inner.className = 'surface';
    inner.setAttribute('data-lr-surface', 'glass');
    shadow.append(inner);
    expect(backgroundPixel(host)[3]).to.be.within(178, 179);
    expect(getComputedStyle(host, '::before').backdropFilter).to.include('blur(12px)');
    expect(backgroundPixel(inner)[3]).to.equal(255);
    expect(getComputedStyle(inner, '::before').backdropFilter).to.match(/^(none|blur\(0px\))/);
    host.setAttribute('data-lr-surface', 'solid');
    expect(backgroundPixel(host)[3]).to.equal(255);
    expect(backgroundPixel(inner)[3]).to.be.within(178, 179);
    expect(getComputedStyle(inner, '::before').backdropFilter).to.include('blur(12px)');
  });

  it('lets wrapper scopes reset nested material while accessibility preferences remain authoritative', async function () {
    if (!CSS.supports('backdrop-filter', 'blur(1px)')) this.skip();
    const { host, outer, inner } = await surfaces('glass');
    const shadow = host.shadowRoot!;
    shadow.adoptedStyleSheets = [surfaceSheet, preferenceSheet, ...shadow.adoptedStyleSheets];
    const wrapper = document.createElement('section');
    wrapper.setAttribute('data-lr-surface', 'solid');
    inner.setAttribute('data-lr-surface', 'glass');
    outer.append(wrapper);
    wrapper.append(inner);
    expect(backgroundPixel(inner)[3]).to.be.within(178, 179);
    expect(getComputedStyle(inner, '::before').backdropFilter).to.include('blur(12px)');
    wrapper.setAttribute('data-lr-surface', 'glass');
    expect(backgroundPixel(inner)[3]).to.equal(255);
    expect(getComputedStyle(inner, '::before').backdropFilter).to.include('blur(0px)');
    host.setAttribute('data-lr-surface', 'solid');
    expect(backgroundPixel(inner)[3]).to.be.within(178, 179);
    expect(getComputedStyle(inner, '::before').backdropFilter).to.include('blur(12px)');
    wrapper.setAttribute('data-lr-contrast', 'more');
    expect(backgroundPixel(inner)[3]).to.equal(255);
    expect(getComputedStyle(inner, '::before').backdropFilter).to.equal('none');
    wrapper.removeAttribute('data-lr-contrast');
    expect(backgroundPixel(inner)[3]).to.be.within(178, 179);
    expect(getComputedStyle(inner, '::before').backdropFilter).to.include('blur(12px)');
  });

  it('removes the glass layer when the scope switches to solid', async () => {
    const { host, outer } = await surfaces('glass');
    host.setAttribute('data-lr-surface', 'solid');
    expect(getComputedStyle(outer, '::before').content).to.equal('none');
    expect(getComputedStyle(outer, '::before').backdropFilter).to.equal('none');
    expect(backgroundPixel(outer)).to.deep.equal([250, 250, 250, 255]);
  });

  it('uses the built-in Glass default when no surface scope is selected', async function () {
    if (!CSS.supports('backdrop-filter', 'blur(1px)')) this.skip();
    const { outer } = await surfaces();
    expect(backgroundPixel(outer)[3]).to.be.within(178, 179);
    expect(getComputedStyle(outer, '::before').content).to.not.equal('none');
    expect(getComputedStyle(outer, '::before').backdropFilter).to.include('blur(12px)');
  });

  it('paints the sheetless default at 70% and honors author opacity from transparent to opaque', async function () {
    if (!CSS.supports('backdrop-filter', 'blur(1px)')) this.skip();
    document.adoptedStyleSheets = previousSheets;
    const { outer } = await surfaces();
    expect(backgroundPixel(outer)[3]).to.be.within(178, 179);
    expect(getComputedStyle(outer, '::before').backdropFilter).to.include('blur(12px)');
    for (const [opacity, minimumAlpha, maximumAlpha] of [[0, 0, 0], [0.35, 89, 90], [0.7, 178, 179], [1, 255, 255]] as const) {
      outer.style.setProperty('--lr-theme-surface-opacity', String(opacity));
      expect(backgroundPixel(outer)[3], `public opacity ${opacity}`).to.be.within(minimumAlpha, maximumAlpha);
    }
    outer.style.setProperty('--lr-theme-surface-opacity', 'initial');
    outer.style.setProperty('--_lr-surface-min-opacity', 'initial');
    expect(backgroundPixel(outer)[3]).to.be.within(178, 179);
  });

  it('resolves component-local glass controls at the painted surface', async function () {
    if (!CSS.supports('backdrop-filter', 'blur(1px)')) this.skip();
    const { outer } = await surfaces('glass');
    outer.style.setProperty('--lr-theme-surface-blur', '2px');
    outer.style.setProperty('--lr-theme-surface-saturation', '1.4');
    const layer = getComputedStyle(outer, '::before');
    expect(layer.backdropFilter).to.include('blur(2px)');
    expect(layer.backdropFilter).to.include('saturate(1.4)');
    outer.style.setProperty('--lr-theme-surface-blur', '100px');
    expect(getComputedStyle(outer, '::before').backdropFilter).to.include('blur(16px)');
  });

  it('keeps the fill on the scrollport when tall content scrolls', async () => {
    const { outer, inner } = await surfaces('glass');
    outer.style.cssText = 'height:100px; overflow:auto;';
    inner.style.height = '500px';
    const fill = backgroundPixel(outer);
    outer.scrollTop = 240;
    expect(outer.scrollTop).to.equal(240);
    expect(backgroundPixel(outer)).to.deep.equal(fill);
    expect(fill[3]).to.be.within(178, 179);
    expect(getComputedStyle(outer, '::before').backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  });

  it('keeps the full blur layer stationary as the public scrollport scrolls and resizes', async () => {
    const host = await fixture<GlassScrollFixture>(html`<test-glass-scroll-surface data-lr-surface="glass"><div style="height:600px">Tall content</div></test-glass-scroll-surface>`);
    const surface = host.shadowRoot!.querySelector<HTMLElement>('.surface')!;
    const layer = surface.querySelector<HTMLElement>('.glass-scroll-layer')!;
    await waitUntil(() => parseFloat(getComputedStyle(layer, '::before').height) === surface.clientHeight);
    const top = layer.getBoundingClientRect().top;
    const left = layer.getBoundingClientRect().left;
    expect(top).to.equal(surface.getBoundingClientRect().top + surface.clientTop);
    expect(left).to.equal(surface.getBoundingClientRect().left + surface.clientLeft);
    for (const scroll of [100, 300, surface.scrollHeight]) {
      surface.scrollTop = scroll;
      expect(surface.scrollTop).to.be.greaterThan(0);
      expect(layer.getBoundingClientRect().top).to.equal(top);
      expect(getComputedStyle(layer, '::before').backdropFilter).to.include('blur(');
      expect(parseFloat(getComputedStyle(layer, '::before').width)).to.equal(surface.clientWidth);
    }
    surface.style.height = '150px';
    await waitUntil(() => parseFloat(getComputedStyle(layer, '::before').height) === surface.clientHeight);
    expect(layer.getBoundingClientRect().top).to.equal(top);
  });

  it('disconnects measurement and restores it when the same scrollport reconnects', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><test-glass-scroll-surface data-lr-surface="glass"><div style="height:600px;width:400px">Wide and tall content</div></test-glass-scroll-surface></div>`);
    const host = wrapper.firstElementChild as GlassScrollFixture;
    await host.updateComplete;
    const surface = host.shadowRoot!.querySelector<HTMLElement>('.surface')!;
    const layer = surface.querySelector<HTMLElement>('.glass-scroll-layer')!;
    surface.scrollLeft = 80;
    await waitUntil(() => layer.style.getPropertyValue('--_lr-glass-scroll-offset') === '80px');
    host.remove();
    surface.style.height = '175px';
    wrapper.append(host);
    await waitUntil(() => parseFloat(getComputedStyle(layer, '::before').height) === surface.clientHeight);
    expect(surface.clientHeight).to.equal(171);
    surface.scrollLeft = 120;
    await waitUntil(() => layer.style.getPropertyValue('--_lr-glass-scroll-offset') === '120px');
  });

  it('anchors the full scroll layer at inline start with asymmetric padding in both directions', async () => {
    for (const direction of ['ltr', 'rtl']) {
      const host = await fixture<GlassScrollFixture>(html`<test-glass-scroll-surface dir=${direction} data-lr-surface="glass"><div style="height:600px;width:400px">Wide and tall content</div></test-glass-scroll-surface>`);
      const surface = host.shadowRoot!.querySelector<HTMLElement>('.surface')!;
      const layer = surface.querySelector<HTMLElement>('.glass-scroll-layer')!;
      surface.style.paddingInlineStart = '12px';
      surface.style.paddingInlineEnd = '20px';
      host.requestUpdate();
      await host.updateComplete;
      await waitUntil(() => parseFloat(getComputedStyle(layer, '::before').width) === surface.clientWidth);
      const expected = surface.getBoundingClientRect().left + surface.clientLeft + (direction === 'rtl' ? surface.clientWidth : 0);
      const inlineStart = () => direction === 'rtl' ? layer.getBoundingClientRect().right : layer.getBoundingClientRect().left;
      expect(inlineStart()).to.equal(expected);
      for (const distance of [80, 160]) {
        surface.scrollLeft = direction === 'rtl' ? -distance : distance;
        surface.scrollTop = distance;
        expect(Math.abs(surface.scrollLeft)).to.be.greaterThan(0);
        await waitUntil(() => inlineStart() === expected, 'sticky inline position should settle after scrolling');
        expect(inlineStart()).to.equal(expected);
        expect(layer.getBoundingClientRect().top).to.equal(surface.getBoundingClientRect().top + surface.clientTop);
      }
    }
  });

  it('keeps viewport-fixed descendants outside the sticky filter layer', async () => {
    const host = await fixture<GlassScrollFixture>(html`<test-glass-scroll-surface data-lr-surface="glass"><div style="position:fixed;top:17px;left:19px">Fixed child</div></test-glass-scroll-surface>`);
    const fixed = host.firstElementChild!;
    expect(fixed.getBoundingClientRect().top).to.equal(17);
    expect(fixed.getBoundingClientRect().left).to.equal(19);
    const surface = host.shadowRoot!.querySelector<HTMLElement>('.surface')!;
    expect(getComputedStyle(surface).backdropFilter).to.equal('none');
    expect(getComputedStyle(surface).transform).to.equal('none');
  });

  it('uses the author’s opaque resting fill and no blur under explicit increased contrast', async function () {
    if (!CSS.supports('backdrop-filter', 'blur(1px)')) this.skip();
    const { host, outer, inner, fixed } = await surfaces('glass');
    outer.style.setProperty('--resting-fill', 'rgb(12 24 36)');
    outer.style.setProperty('--lr-theme-surface-opacity', '0');
    host.setAttribute('data-lr-contrast', 'more');
    expect(backgroundPixel(outer)).to.deep.equal([12, 24, 36, 255]);
    expect(backgroundPixel(inner)).to.deep.equal([12, 24, 36, 255]);
    expect(getComputedStyle(outer, '::before').backdropFilter).to.equal('none');
    expect(getComputedStyle(inner, '::before').backdropFilter).to.equal('none');
    expect(fixed.getBoundingClientRect().top).to.equal(7);
    host.setAttribute('data-lr-contrast', 'system');
    expect(getComputedStyle(outer, '::before').backdropFilter).to.include('blur(');
    expect(getComputedStyle(inner, '::before').backdropFilter).to.equal('none');
    expect(backgroundPixel(inner)).to.deep.equal([250, 250, 250, 255]);
  });

  it('keeps forced-color surfaces opaque even when public opacity is zero', async function () {
    try {
      try { await setForcedColors('active'); } catch { this.skip(); }
      if (!matchMedia('(forced-colors: active)').matches) this.skip();
      const { outer } = await surfaces('glass');
      outer.style.setProperty('--lr-theme-surface-opacity', '0');
      expect(backgroundPixel(outer)[3]).to.equal(255);
      expect(getComputedStyle(outer, '::before').backdropFilter).to.equal('none');
    } finally {
      await setForcedColors('none');
    }
  });
});

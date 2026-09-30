import { expect, fixture, html } from '@open-wc/testing';
import { contrastRatio, resolvedColorToken, toRgba } from '../../test/color-contrast.js';
import '../components/forms/button/button.js';
import type { LyraButton } from '../components/forms/button/button.class.js';

const composite = (paint: string, backdrop: string): string => {
  const foreground = toRgba(paint);
  const background = toRgba(backdrop);
  return `rgb(${foreground.slice(0, 3).map((channel, index) => channel * foreground[3] / 255 + background[index]! * (1 - foreground[3] / 255)).join(' ')})`;
};

describe('native chrome material', () => {
  let previous: CSSStyleSheet[];
  let theme: CSSStyleSheet;
  let sheets: CSSStyleSheet[];
  before(async () => {
    sheets = await Promise.all(['theme.css', 'styles/tokens-root.css', 'surfaces/glass.css', 'preferences.css', 'looks/material.css', 'looks/data.css', 'looks/terminal.css', 'looks/high-contrast.css'].map(async path => {
      const response = await fetch(new URL(`../${path}`, import.meta.url));
      if (!response.ok) throw new Error(`Missing native chrome fixture ${path}`);
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(await response.text());
      return sheet;
    }));
    theme = sheets[0]!;
  });
  beforeEach(() => { previous = document.adoptedStyleSheets; document.adoptedStyleSheets = [...previous, ...sheets]; });
  afterEach(() => { document.adoptedStyleSheets = previous; });

  for (const look of ['lyra', 'shadcn', 'material', 'data', 'terminal', 'high-contrast']) for (const mode of ['light', 'dark']) {
    it(`qualifies native ${look}/${mode} text, necessary edges and focus against both extreme backdrops`, async function () {
      if (!CSS.supports('backdrop-filter', 'blur(1px)')) this.skip();
      const scope = await fixture<HTMLDivElement>(html`<div data-lr-look=${look} data-lr-mode=${mode} data-lr-surface="glass"><div class="lr-surface-chrome" style="padding:1rem">Navigation</div></div>`);
      const surface = scope.firstElementChild!;
      for (const fill of ['--lr-theme-color-surface-overlay', '--lr-theme-color-surface-container-high', '--lr-theme-color-surface-container-highest']) {
        (surface as HTMLElement).style.setProperty('--lr-surface-background', `var(${fill}, var(--lr-theme-color-surface-overlay))`);
        const paint = getComputedStyle(surface).backgroundColor;
        expect(toRgba(paint)[3], `${look}/${mode}/${fill}: opacity`).to.be.within(203, 205);
        for (const backdrop of ['black', 'white']) {
          const background = composite(paint, backdrop);
          for (const token of ['--lr-color-text', '--lr-color-text-quiet']) expect(contrastRatio(resolvedColorToken(surface, token), background), `${look}/${mode}/${fill}/${token}/${backdrop}`).to.be.at.least(4.5);
          const highlighted = composite('rgb(255 255 255 / 0.12)', background);
          for (const token of ['--lr-color-border', '--lr-focus-ring-color']) expect(contrastRatio(resolvedColorToken(surface, token), highlighted), `${look}/${mode}/${fill}/${token}/${backdrop}`).to.be.at.least(3);
        }
      }
    });
  }

  it('resolves native local fills and leaves fixed descendants in viewport coordinates', async function () {
    if (!CSS.supports('backdrop-filter', 'blur(1px)')) this.skip();
    const surface = await fixture<HTMLDivElement>(html`<div class="lr-surface-chrome" style="position:fixed;inset:80px auto auto 90px;--lr-surface-background:rgb(250 240 230);--lr-theme-color-text-normal:rgb(20 30 40);--lr-theme-surface-blur:2px"><span style="position:fixed;top:7px;left:9px">Fixed</span><div style="max-block-size:40px;overflow:auto"><p style="block-size:200px">Scrollable content</p></div></div>`);
    const fixed = surface.firstElementChild!;
    expect(getComputedStyle(surface).position).to.equal('fixed');
    expect(getComputedStyle(surface).color).to.equal('rgb(20, 30, 40)');
    expect(toRgba(getComputedStyle(surface).backgroundColor)).to.deep.equal([250, 240, 230, 204]);
    expect(getComputedStyle(surface, '::before').backdropFilter).to.include('blur(2px)');
    expect(fixed.getBoundingClientRect().top).to.equal(7);
    expect(fixed.getBoundingClientRect().left).to.equal(9);
    const scrollport = surface.lastElementChild as HTMLElement;
    scrollport.scrollTop = 100;
    expect(scrollport.scrollTop).to.equal(100);
    expect(toRgba(getComputedStyle(surface).backgroundColor)[3]).to.equal(204);
  });

  it('suppresses nested material and restores Solid and explicit increased contrast', async () => {
    const outer = await fixture<HTMLDivElement>(html`<div class="lr-surface-chrome" data-lr-surface="glass"><div class="lr-surface-chrome">Nested</div><lr-button>Opaque control</lr-button></div>`);
    const inner = outer.firstElementChild!;
    expect(toRgba(getComputedStyle(inner).backgroundColor)[3]).to.equal(255);
    expect(getComputedStyle(inner, '::before').backdropFilter).to.equal('none');
    outer.setAttribute('data-lr-surface', 'solid');
    expect(toRgba(getComputedStyle(outer).backgroundColor)[3]).to.equal(255);
    expect(getComputedStyle(outer, '::before').content).to.equal('none');
    outer.setAttribute('data-lr-surface', 'glass');
    outer.setAttribute('data-lr-contrast', 'more');
    expect(toRgba(getComputedStyle(outer).backgroundColor)[3]).to.equal(255);
    expect(getComputedStyle(outer, '::before').backdropFilter).to.equal('none');
  });

  it('lets an explicit Glass scope below Solid frost while physically nested Glass stays opaque', async function () {
    if (!CSS.supports('backdrop-filter', 'blur(1px)')) this.skip();
    const solid = await fixture<HTMLDivElement>(html`<div class="lr-surface-chrome" data-lr-surface="solid"><div class="lr-surface-chrome" data-lr-surface="glass">Glass below Solid</div></div>`);
    const child = solid.firstElementChild!;
    expect(toRgba(getComputedStyle(solid).backgroundColor)[3]).to.equal(255);
    expect(toRgba(getComputedStyle(child).backgroundColor)[3]).to.be.within(203, 205);
    expect(getComputedStyle(child, '::before').backdropFilter).to.include('blur(12px)');
    solid.setAttribute('data-lr-surface', 'glass');
    expect(toRgba(getComputedStyle(child).backgroundColor)[3]).to.equal(255);
    expect(getComputedStyle(child, '::before').backdropFilter).to.include('blur(0px)');
  });

  it('theme.css alone paints the same Emerald before and after explicit default attributes', async () => {
    document.adoptedStyleSheets = [...previous, theme];
    const scope = await fixture<HTMLDivElement>(html`<div><lr-button appearance="accent" variant="brand">Action</lr-button><div class="lr-surface-chrome">Chrome</div></div>`);
    const button = scope.firstElementChild as LyraButton;
    await button.updateComplete;
    const base = button.shadowRoot!.querySelector('[part~="base"]')!;
    const before = getComputedStyle(base).backgroundColor;
    scope.setAttribute('data-lr-look', 'shadcn');
    scope.setAttribute('data-lr-surface', 'glass');
    scope.setAttribute('data-lr-accent', 'emerald');
    expect(getComputedStyle(base).backgroundColor).to.equal(before);
    scope.setAttribute('data-lr-accent', 'none');
    expect(getComputedStyle(base).backgroundColor).to.not.equal(before);
    scope.setAttribute('data-lr-surface', 'solid');
    expect(toRgba(getComputedStyle(scope.lastElementChild!).backgroundColor)[3]).to.equal(255);
  });
});

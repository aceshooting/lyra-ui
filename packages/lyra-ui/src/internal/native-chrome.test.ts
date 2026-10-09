import { expect, fixture, html, waitUntil } from '@open-wc/testing';
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

  it('inherits the full public opacity range into explicit and promoted Glass while opaque preferences win', async function () {
    if (!CSS.supports('backdrop-filter', 'blur(1px)')) this.skip();
    const rootStyle = document.documentElement.style;
    const previousOpacity = rootStyle.getPropertyValue('--lr-theme-surface-opacity');
    const previousPriority = rootStyle.getPropertyPriority('--lr-theme-surface-opacity');
    const ancestor = await fixture<HTMLDivElement>(html`<div><div data-lr-surface="glass"><div class="lr-surface-chrome">Chrome</div></div><div class="lr-surface-chrome" data-lr-surface="glass"><div class="lr-surface-chrome" data-lr-surface="glass" popover="manual">Promoted</div></div></div>`);
    const scope = ancestor.firstElementChild!;
    const surface = scope.firstElementChild as HTMLElement;
    const paintedParent = ancestor.lastElementChild as HTMLElement;
    const promoted = paintedParent.firstElementChild as HTMLElement;
    try {
      promoted.showPopover();
      expect(promoted.matches(':popover-open')).to.equal(true);
      for (const opacity of [0, 0.35, 0.7, 1]) {
        rootStyle.setProperty('--lr-theme-surface-opacity', String(opacity));
        for (const target of [surface, promoted]) {
          expect(toRgba(getComputedStyle(target).backgroundColor)[3], `inherited public opacity ${opacity}`).to.be.closeTo(Math.round(opacity * 255), 1);
        }
      }
      rootStyle.setProperty('--lr-theme-surface-opacity', '0');
      ancestor.style.setProperty('--lr-theme-surface-opacity', '0.35');
      expect(toRgba(getComputedStyle(surface).backgroundColor)[3], 'nearer unpainted ancestor override').to.be.within(89, 90);
      surface.style.setProperty('--lr-theme-surface-opacity', '0.7');
      expect(toRgba(getComputedStyle(surface).backgroundColor)[3], 'local surface override').to.be.within(178, 180);
      surface.style.removeProperty('--lr-theme-surface-opacity');
      ancestor.style.removeProperty('--lr-theme-surface-opacity');
      expect(toRgba(getComputedStyle(surface).backgroundColor)[3]).to.equal(0);
      scope.setAttribute('data-lr-surface', 'solid');
      expect(toRgba(getComputedStyle(surface).backgroundColor)[3]).to.equal(255);
      scope.setAttribute('data-lr-surface', 'glass');
      scope.setAttribute('data-lr-contrast', 'more');
      expect(toRgba(getComputedStyle(surface).backgroundColor)[3]).to.equal(255);
      expect(getComputedStyle(surface, '::before').backdropFilter).to.equal('none');
    } finally {
      if (promoted.matches(':popover-open')) promoted.hidePopover();
      if (previousOpacity) rootStyle.setProperty('--lr-theme-surface-opacity', previousOpacity, previousPriority);
      else rootStyle.removeProperty('--lr-theme-surface-opacity');
    }
  });

  for (const look of ['lyra', 'shadcn', 'material', 'data', 'terminal', 'high-contrast']) for (const mode of ['light', 'dark']) {
    it(`qualifies native ${look}/${mode} text, necessary edges and focus against both extreme backdrops`, async function () {
      if (!CSS.supports('backdrop-filter', 'blur(1px)')) this.skip();
      const scope = await fixture<HTMLDivElement>(html`<div data-lr-look=${look} data-lr-mode=${mode} data-lr-surface="glass"><div class="lr-surface-chrome" style="padding:1rem">Navigation</div></div>`);
      const surface = scope.firstElementChild!;
      for (const fill of ['--lr-theme-color-surface-overlay', '--lr-theme-color-surface-container-high', '--lr-theme-color-surface-container-highest']) {
        (surface as HTMLElement).style.setProperty('--lr-surface-background', `var(${fill}, var(--lr-theme-color-surface-overlay))`);
        const paint = getComputedStyle(surface).backgroundColor;
        expect(toRgba(paint)[3], `${look}/${mode}/${fill}: opacity`).to.be.within(152, 154);
        for (const backdrop of ['black', 'white']) {
          const background = composite(paint, backdrop);
          for (const token of ['--lr-color-text', '--lr-color-text-quiet']) expect(contrastRatio(resolvedColorToken(surface, token), background), `${look}/${mode}/${fill}/${token}/${backdrop}`).to.be.at.least(4.5);
          const highlighted = composite('rgb(255 255 255 / 0.12)', background);
          for (const token of ['--lr-color-border', '--lr-color-border-strong', '--lr-focus-ring-color']) expect(contrastRatio(resolvedColorToken(surface, token), highlighted), `${look}/${mode}/${fill}/${token}/${backdrop}`).to.be.at.least(3);
        }
      }
      if (mode === 'dark') {
        scope.style.setProperty('--lr-theme-surface-opacity', '0.7');
        const selected = resolvedColorToken(surface, '--lr-theme-color-surface-overlay');
        (surface as HTMLElement).style.setProperty('--lr-surface-background', selected);
        const painted = toRgba(getComputedStyle(surface).backgroundColor);
        const original = toRgba(selected);
        for (let channel = 0; channel < 3; channel++) expect(painted[channel]).to.be.closeTo(original[channel]!, 1);
        expect(painted[3]).to.be.within(178, 180);
      }
    });
  }

  it('resolves native local fills and leaves fixed descendants in viewport coordinates', async function () {
    if (!CSS.supports('backdrop-filter', 'blur(1px)')) this.skip();
    const surface = await fixture<HTMLDivElement>(html`<div data-lr-theme-scope class="lr-surface-chrome" style="position:fixed;inset:80px auto auto 90px;--lr-surface-background:rgb(250 240 230);--lr-theme-color-text-normal:rgb(20 30 40);--lr-theme-surface-blur:2px"><span style="position:fixed;top:7px;left:9px">Fixed</span><div style="max-block-size:40px;overflow:auto"><p style="block-size:200px">Scrollable content</p></div></div>`);
    const fixed = surface.firstElementChild!;
    expect(getComputedStyle(surface).position).to.equal('fixed');
    expect(getComputedStyle(surface).color).to.equal('rgb(20, 30, 40)');
    expect(toRgba(getComputedStyle(surface).backgroundColor)).to.deep.equal(toRgba('rgb(250 240 230 / 0.6)'));
    expect(getComputedStyle(surface, '::before').backdropFilter).to.include('blur(2px)');
    expect(fixed.getBoundingClientRect().top).to.equal(7);
    expect(fixed.getBoundingClientRect().left).to.equal(9);
    const scrollport = surface.lastElementChild as HTMLElement;
    scrollport.scrollTop = 100;
    expect(scrollport.scrollTop).to.equal(100);
    expect(toRgba(getComputedStyle(surface).backgroundColor)[3]).to.be.within(152, 154);
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
    expect(toRgba(getComputedStyle(child).backgroundColor)[3]).to.be.within(152, 154);
    expect(getComputedStyle(child, '::before').backdropFilter).to.include('blur(12px)');
    solid.setAttribute('data-lr-surface', 'glass');
    expect(toRgba(getComputedStyle(child).backgroundColor)[3]).to.equal(255);
    expect(getComputedStyle(child, '::before').backdropFilter).to.include('blur(0px)');
  });

  const nestingCases = [
    ['direct Solid parent', html`<div class="lr-surface-chrome" data-lr-surface="solid"><div data-probe class="lr-surface-chrome" data-lr-surface="glass"></div></div>`, true],
    ['inherited Solid parent', html`<div data-lr-surface="solid"><div class="lr-surface-chrome"><div data-probe class="lr-surface-chrome" data-lr-surface="glass"></div></div></div>`, true],
    ['Solid parent through a wrapper', html`<div data-lr-surface="solid"><div class="lr-surface-chrome"><div><div data-probe class="lr-surface-chrome" data-lr-surface="glass"></div></div></div></div>`, true],
    ['ordinary nested Glass', html`<div class="lr-surface-chrome" data-lr-surface="glass"><div data-probe class="lr-surface-chrome"></div></div>`, false],
    ['explicit nested Glass', html`<div class="lr-surface-chrome" data-lr-surface="glass"><div data-probe class="lr-surface-chrome" data-lr-surface="glass"></div></div>`, false],
    ['painted Solid island', html`<div class="lr-surface-chrome" data-lr-surface="glass"><div class="lr-surface-chrome" data-lr-surface="solid"><div data-probe class="lr-surface-chrome" data-lr-surface="glass"></div></div></div>`, true],
    ['Solid scope through wrappers', html`<div class="lr-surface-chrome" data-lr-surface="glass"><section data-lr-surface="solid"><div><div data-probe class="lr-surface-chrome" data-lr-surface="glass"></div></div></section></div>`, true],
    ['nested explicit Glass below Solid', html`<div class="lr-surface-chrome" data-lr-surface="solid"><div class="lr-surface-chrome" data-lr-surface="glass"><div data-probe class="lr-surface-chrome" data-lr-surface="glass"></div></div></div>`, false],
  ] as const;
  for (const [name, content, frosted] of nestingCases) {
    it(`captures ancestor material for ${name}`, async function () {
      if (!CSS.supports('backdrop-filter', 'blur(1px)')) this.skip();
      const scope = await fixture<HTMLDivElement>(html`<div>${content}</div>`);
      const probe = scope.querySelector('[data-probe]')!;
      const alpha = toRgba(getComputedStyle(probe).backgroundColor)[3];
      if (frosted) {
        expect(alpha).to.be.within(152, 154);
        expect(getComputedStyle(probe, '::before').backdropFilter).to.include('blur(12px)');
      } else {
        expect(alpha).to.equal(255);
        expect(getComputedStyle(probe, '::before').backdropFilter).to.match(/^(none|blur\(0px\))/);
      }
    });
  }

  for (const carrier of ['popover', 'modal'] as const) {
    it(`keeps promoted native ${carrier} Solid and lets its explicit Glass choice escape nesting`, async function () {
      if (!CSS.supports('backdrop-filter', 'blur(1px)')) this.skip();
      const outer = await fixture<HTMLDivElement>(html`<div class="lr-surface-chrome" data-lr-surface="solid"></div>`);
      const promoted = document.createElement(carrier === 'modal' ? 'dialog' : 'div');
      promoted.className = 'lr-surface-chrome';
      promoted.textContent = 'Details';
      if (carrier === 'popover') promoted.setAttribute('popover', 'manual');
      outer.append(promoted);
      try {
        if (carrier === 'modal') (promoted as HTMLDialogElement).showModal();
        else promoted.showPopover();
        expect(toRgba(getComputedStyle(promoted).backgroundColor)[3]).to.equal(255);
        expect(getComputedStyle(promoted, '::before').content).to.equal('none');
        expect(getComputedStyle(promoted, '::before').backdropFilter).to.equal('none');
        promoted.setAttribute('data-lr-surface', 'glass');
        expect(toRgba(getComputedStyle(promoted).backgroundColor)[3]).to.be.within(152, 154);
        expect(getComputedStyle(promoted, '::before').backdropFilter).to.include('blur(12px)');
        promoted.setAttribute('data-lr-contrast', 'more');
        expect(toRgba(getComputedStyle(promoted).backgroundColor)[3]).to.equal(255);
        expect(getComputedStyle(promoted, '::before').backdropFilter).to.equal('none');
        promoted.removeAttribute('data-lr-contrast');
        expect(toRgba(getComputedStyle(promoted).backgroundColor)[3]).to.be.within(152, 154);
        expect(getComputedStyle(promoted, '::before').backdropFilter).to.include('blur(12px)');
        outer.setAttribute('data-lr-surface', 'glass');
        expect(toRgba(getComputedStyle(promoted).backgroundColor)[3]).to.be.within(152, 154);
        expect(getComputedStyle(promoted, '::before').backdropFilter).to.include('blur(12px)');
        promoted.removeAttribute('data-lr-surface');
        outer.setAttribute('data-lr-surface', 'solid');
        expect(toRgba(getComputedStyle(promoted).backgroundColor)[3]).to.equal(255);
        expect(getComputedStyle(promoted, '::before').backdropFilter).to.equal('none');
      } finally {
        if (carrier === 'modal') (promoted as HTMLDialogElement).close();
        else promoted.hidePopover();
      }
    });
  }

  it('theme.css alone paints the same Emerald before and after explicit default attributes', async () => {
    document.adoptedStyleSheets = [...previous, theme];
    const scope = await fixture<HTMLDivElement>(html`<div><lr-button appearance="accent" variant="brand">Action</lr-button><div class="lr-surface-chrome">Chrome</div></div>`);
    const button = scope.firstElementChild as LyraButton;
    await button.updateComplete;
    const base = button.shadowRoot!.querySelector('[part~="base"]')!;
    const before = getComputedStyle(base).backgroundColor;
    const beforeBrand = resolvedColorToken(button, '--lr-color-brand-fill-loud');
    scope.setAttribute('data-lr-look', 'shadcn');
    scope.setAttribute('data-lr-surface', 'glass');
    scope.setAttribute('data-lr-accent', 'emerald');
    expect(getComputedStyle(base).backgroundColor).to.equal(before);
    scope.setAttribute('data-lr-accent', 'none');
    expect(resolvedColorToken(button, '--lr-color-brand-fill-loud')).to.not.equal(beforeBrand);
    await waitUntil(() => getComputedStyle(base).backgroundColor !== before, 'accent removal should change the rendered button fill');
    expect(getComputedStyle(base).backgroundColor).to.not.equal(before);
    scope.setAttribute('data-lr-surface', 'solid');
    expect(toRgba(getComputedStyle(scope.lastElementChild!).backgroundColor)[3]).to.equal(255);
  });
});

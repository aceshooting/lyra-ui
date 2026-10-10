import { expect, fixture, html } from '@open-wc/testing';
import { resolvedColorToken, toRgba } from '../../test/color-contrast.js';

const LOOKS = ['lyra', 'shadcn', 'material', 'data', 'terminal', 'high-contrast'];
const LIFTED = '#1f2023';

/** The dark glass fill before the anchor followed the theme: the fill token over pure black. */
const legacyFill = (fill: number[], weight: number): number[] => fill.slice(0, 3).map(channel => channel * weight);

describe('dark glass fill follows the theme surface ramp', () => {
  let previous: CSSStyleSheet[];
  let sheets: CSSStyleSheet[];
  before(async () => {
    sheets = await Promise.all(['theme.css', 'styles/tokens-root.css', 'surfaces/glass.css', 'preferences.css', 'looks/shadcn.css', 'looks/material.css', 'looks/data.css', 'looks/terminal.css', 'looks/high-contrast.css'].map(async path => {
      const response = await fetch(new URL(`../${path}`, import.meta.url));
      if (!response.ok) throw new Error(`Missing glass fixture ${path}`);
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(await response.text());
      return sheet;
    }));
  });
  beforeEach(() => { previous = document.adoptedStyleSheets; document.adoptedStyleSheets = [...previous, ...sheets]; });
  afterEach(() => { document.adoptedStyleSheets = previous; });

  const paint = async (look: string, style = '') => {
    const scope = await fixture<HTMLDivElement>(html`<div data-lr-look=${look} data-lr-mode="dark" data-lr-surface="glass" style=${style}><div class="lr-surface-chrome" style="padding:1rem">Navigation</div></div>`);
    const surface = scope.firstElementChild as HTMLElement;
    const background = toRgba(getComputedStyle(surface).backgroundColor);
    const alpha = background[3] / 255;
    // The documented recipe at the painted opacity: 20% floor, 800% slope, 460% offset.
    const weight = Math.min(1, Math.max(0.2, alpha * 8 - 4.6));
    const fill = toRgba(resolvedColorToken(surface, '--lr-color-surface-container-high'));
    const surfaceDefault = toRgba(resolvedColorToken(surface, '--lr-color-surface'));
    return { background, alpha, weight, fill, surfaceDefault };
  };

  for (const look of LOOKS) {
    it(`paints the lifted ${look} palette unchanged once the surface opacity reaches 70%`, async function () {
      if (!CSS.supports('color', 'light-dark(red, blue)')) this.skip();
      const style = ['default', 'raised', 'overlay', 'container-high'].map(name => `--lr-theme-color-surface-${name}: ${LIFTED}`).join(';') + ';--lr-theme-surface-opacity: 0.7';
      const { background, alpha, weight, fill } = await paint(look, style);
      expect(alpha, `${look}: glass alpha`).to.be.within(0.69, 0.71);
      expect(weight, `${look}: full fill weight`).to.equal(1);
      for (let channel = 0; channel < 3; channel++) expect(background[channel], `${look}: channel ${channel} keeps the lifted colour`).to.be.closeTo(fill[channel]!, 2);
    });

    it(`derives the ${look} dark anchor from the theme surface and stays close to the legacy near-black fill`, async function () {
      if (!CSS.supports('color', 'light-dark(red, blue)')) this.skip();
      const { background, alpha, weight, fill, surfaceDefault } = await paint(look);
      expect(alpha, `${look}: glass alpha`).to.be.within(0.59, 0.61);
      for (let channel = 0; channel < 3; channel++) {
        const expected = fill[channel]! * weight + surfaceDefault[channel]! * 0.1 * (1 - weight);
        expect(background[channel], `${look}: channel ${channel} follows the surface-derived anchor`).to.be.closeTo(expected, 3);
        // Compared as the colour under the alpha, before it is blended with the backdrop.
        expect(Math.abs(expected - legacyFill(fill, weight)[channel]!), `${look}: channel ${channel} stays close to the legacy fill`).to.be.at.most(8);
      }
    });

    it(`lifts ${look} glass when the dark surface tokens are lifted to a neutral grey`, async function () {
      if (!CSS.supports('color', 'light-dark(red, blue)')) this.skip();
      const style = ['default', 'raised', 'overlay', 'container-high'].map(name => `--lr-theme-color-surface-${name}: ${LIFTED}`).join(';');
      const { background, weight, fill, surfaceDefault } = await paint(look, style);
      if (look !== 'high-contrast') expect(surfaceDefault.slice(0, 3), `${look}: lifted surface`).to.deep.equal(toRgba(LIFTED).slice(0, 3));
      for (let channel = 0; channel < 3; channel++) {
        const expected = fill[channel]! * weight + surfaceDefault[channel]! * 0.1 * (1 - weight);
        expect(background[channel], `${look}: lifted channel ${channel}`).to.be.closeTo(expected, 3);
        // The legacy fill was 80% pure black: the lifted pane must now sit above that.
        if (fill[channel]! > 8) expect(background[channel], `${look}: lifted channel ${channel} beats the pure-black anchor`).to.be.greaterThan(legacyFill(fill, weight)[channel]! + 1);
      }
    });
  }

  describe('--lr-theme-surface-glass-dark-share', () => {
    const SHARE = '--lr-theme-surface-glass-dark-share';
    const channels = (color: number[]) => color.slice(0, 3);
    const sum = (color: number[]) => color[0]! + color[1]! + color[2]!;

    for (const look of LOOKS) {
      it(`leaves ${look} glass byte-identical when the input is the documented 10% default`, async function () {
        if (!CSS.supports('color', 'light-dark(red, blue)')) this.skip();
        const unset = await paint(look);
        const explicit = await paint(look, `${SHARE}: 10%`);
        expect(channels(explicit.background), `${look}: explicit default`).to.deep.equal(channels(unset.background));
      });
    }

    it('lifts the dark fill when set on :root, and restores it when removed', async function () {
      if (!CSS.supports('color', 'light-dark(red, blue)')) this.skip();
      const lifted = '#1f2023';
      const style = ['default', 'raised', 'overlay', 'container-high'].map(name => `--lr-theme-color-surface-${name}: ${lifted}`).join(';');
      const base = await paint('shadcn', style);
      document.documentElement.style.setProperty(SHARE, '60%');
      try {
        const raised = await paint('shadcn', style);
        expect(sum(raised.background), 'root input lifts the fill').to.be.greaterThan(sum(base.background) + 3);
      } finally {
        document.documentElement.style.removeProperty(SHARE);
      }
      const restored = await paint('shadcn', style);
      expect(channels(restored.background), 'removing the input restores the default').to.deep.equal(channels(base.background));
    });

    it('lifts the dark fill inside a scoped container only', async function () {
      if (!CSS.supports('color', 'light-dark(red, blue)')) this.skip();
      const lifted = '#1f2023';
      const tokens = ['default', 'raised', 'overlay', 'container-high'].map(name => `--lr-theme-color-surface-${name}: ${lifted}`).join(';');
      const host = await fixture<HTMLDivElement>(html`<div data-lr-look="shadcn" data-lr-mode="dark" data-lr-surface="glass" style=${tokens}>
        <div id="plain" class="lr-surface-chrome" style="padding:1rem">Plain</div>
        <div style=${`${SHARE}: 60%`}><div id="scoped" class="lr-surface-chrome" style="padding:1rem">Scoped</div></div>
      </div>`);
      const plain = toRgba(getComputedStyle(host.querySelector('#plain')!).backgroundColor);
      const scoped = toRgba(getComputedStyle(host.querySelector('#scoped')!).backgroundColor);
      expect(sum(scoped), 'scoped container lifts the fill').to.be.greaterThan(sum(plain) + 3);
    });

    it('falls back to the 10% default for an invalid value', async function () {
      if (!CSS.supports('color', 'light-dark(red, blue)')) this.skip();
      const unset = await paint('shadcn');
      for (const bad of ['banana', '1.5', '10', '#fff', '10px']) {
        const painted = await paint('shadcn', `${SHARE}: ${bad}`);
        expect(painted.alpha, `${bad}: stays translucent`).to.be.within(0.59, 0.61);
        expect(channels(painted.background), `${bad}: falls back`).to.deep.equal(channels(unset.background));
      }
    });
  });
});

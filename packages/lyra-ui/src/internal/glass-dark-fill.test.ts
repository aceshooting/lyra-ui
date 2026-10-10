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
    it(`derives the ${look} dark anchor from the theme surface and stays close to the legacy near-black fill`, async function () {
      if (!CSS.supports('color', 'light-dark(red, blue)')) this.skip();
      const { background, alpha, weight, fill, surfaceDefault } = await paint(look);
      expect(alpha, `${look}: glass alpha`).to.be.within(0.59, 0.61);
      for (let channel = 0; channel < 3; channel++) {
        const expected = fill[channel]! * weight + surfaceDefault[channel]! * 0.3 * (1 - weight);
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
        const expected = fill[channel]! * weight + surfaceDefault[channel]! * 0.3 * (1 - weight);
        expect(background[channel], `${look}: lifted channel ${channel}`).to.be.closeTo(expected, 3);
        // The legacy fill was 80% pure black: the lifted pane must be visibly lighter than that.
        if (fill[channel]! > 8) expect(background[channel], `${look}: lifted channel ${channel} beats the pure-black anchor`).to.be.greaterThan(legacyFill(fill, weight)[channel]! + 4);
      }
    });
  }
});

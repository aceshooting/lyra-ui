import { expect, fixture, html } from '@open-wc/testing';
import { css } from 'lit';
import { LyraElement } from './lyra-element.js';
import { glassSurface } from './glass-surface.styles.js';
import { focusByKeyboard } from '../../test/wtr-focus.js';
import { contrastRatio, toRgba } from '../../test/color-contrast.js';
import { GEMSTONE_KEYS } from '../theme/gemstones-data.js';

class GlassFocusFixture extends LyraElement {
  static override styles = [LyraElement.styles, css`
    .surface { position: relative; padding: 16px; }
    button { color: inherit; background: transparent; }
    button:focus-visible { outline: var(--lr-focus-ring); outline-offset: var(--lr-focus-ring-offset); }
    ${glassSurface('.surface', css`var(--lr-color-surface-overlay)`)}
  `];
  override render() { return html`<div class="surface"><button>Action</button></div>`; }
}
customElements.define('test-glass-focus', GlassFocusFixture);

const composite = (foreground: string, background: string): string => {
  const a = toRgba(foreground);
  const b = toRgba(background);
  return `rgb(${a.slice(0, 3).map((value, index) => value * a[3] / 255 + b[index]! * (1 - a[3] / 255)).join(' ')})`;
};

describe('glass surface keyboard focus paint', () => {
  let previous: CSSStyleSheet[];
  let sheets: CSSStyleSheet[];
  before(async () => {
    sheets = await Promise.all(['theme.css', 'looks/shadcn.css', 'looks/material.css', 'looks/data.css', 'looks/terminal.css', 'looks/high-contrast.css', 'accents.css', 'surfaces/glass.css'].map(async path => {
      const response = await fetch(new URL(`../${path}`, import.meta.url));
      if (!response.ok) throw new Error(`Missing fixture ${path}`);
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(await response.text());
      return sheet;
    }));
  });
  beforeEach(() => { previous = document.adoptedStyleSheets; document.adoptedStyleSheets = [...previous, ...sheets]; });
  afterEach(() => { document.adoptedStyleSheets = previous; });

  for (const treatment of ['unset', 'solid', 'glass']) {
    for (const shorthand of [false, true]) {
      it(`preserves authored host ${shorthand ? 'shorthand' : 'color and width aliases'} with ${treatment} treatment`, async () => {
        const host = await fixture<GlassFocusFixture>(html`<test-glass-focus></test-glass-focus>`);
        if (treatment !== 'unset') host.setAttribute('data-lr-surface', treatment);
        if (shorthand) host.style.setProperty('--lr-focus-ring', '5px dashed rgb(1, 2, 3)');
        else {
          host.setAttribute('data-lr-theme-scope', '');
          host.style.setProperty('--lr-focus-ring-color', 'rgb(1, 2, 3)');
          host.style.setProperty('--lr-focus-ring-width', '6px');
        }
        host.style.setProperty('--lr-focus-ring-offset', '4px');
        const target = host.shadowRoot!.querySelector('button')!;
        await focusByKeyboard(target);
        expect(target.matches(':focus-visible')).to.equal(true);
        const paint = getComputedStyle(target);
        expect(paint.outlineStyle).to.equal(shorthand ? 'dashed' : 'solid');
        expect(paint.outlineWidth).to.equal(shorthand ? '5px' : '6px');
        expect(toRgba(paint.outlineColor)).to.deep.equal([1, 2, 3, 255]);
        expect(paint.outlineOffset).to.equal('4px');
      });
    }
  }

  for (const look of ['lyra', 'shadcn', 'material', 'data', 'terminal', 'high-contrast']) for (const mode of ['light', 'dark']) {
    it(`keeps the default ${look}/${mode} glass outline visible over extreme backdrops for every accent`, async () => {
      const host = await fixture<GlassFocusFixture>(html`<test-glass-focus data-lr-look=${look} data-lr-mode=${mode} data-lr-surface="glass"></test-glass-focus>`);
      const target = host.shadowRoot!.querySelector('button')!;
      const surface = host.shadowRoot!.querySelector<HTMLElement>('.surface')!;
      await focusByKeyboard(target);
      expect(target.matches(':focus-visible')).to.equal(true);
      for (const accent of ['', ...GEMSTONE_KEYS]) {
        if (accent) host.setAttribute('data-lr-accent', accent);
        else host.removeAttribute('data-lr-accent');
        for (const backdrop of ['black', 'white']) {
          const paint = getComputedStyle(target);
          const behind = composite(getComputedStyle(surface).backgroundColor, backdrop);
          const highlighted = composite('rgb(255 255 255 / 0.12)', behind);
          expect(paint.outlineStyle, `${accent}: visible outline`).to.equal('solid');
          expect(Number.parseFloat(paint.outlineWidth), `${accent}: outline width`).to.be.greaterThan(0);
          expect(contrastRatio(paint.outlineColor, highlighted), `${accent}/${backdrop}: outline contrast`).to.be.at.least(3);
        }
      }
    });
  }
});

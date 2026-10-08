import { expect, fixture, html } from '@open-wc/testing';
import { toRgba } from '../../test/color-contrast.js';
import '../components/layout/card/card.js';
import type { LyraCard } from '../components/layout/card/card.class.js';

let previousSheets: CSSStyleSheet[];
let themeSheet: CSSStyleSheet;
before(async () => {
  const response = await fetch(new URL('../theme.css', import.meta.url));
  if (!response.ok) throw new Error('Missing optional-border theme fixture');
  themeSheet = new CSSStyleSheet();
  themeSheet.replaceSync(await response.text());
});
beforeEach(() => { previousSheets = [...document.adoptedStyleSheets]; });
afterEach(() => { document.adoptedStyleSheets = previousSheets; });

async function border(card: LyraCard): Promise<[number, number, number, number]> {
  await card.updateComplete;
  const base = card.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  return toRgba(getComputedStyle(base).borderTopColor);
}

describe('optional decorative border fallback', () => {
  for (const mode of ['light', 'dark'] as const) {
    const shadcn = mode === 'light' ? 'rgb(229 229 229)' : 'rgb(255 255 255 / 0.1)';
    const lyra = mode === 'light' ? 'rgb(138 138 144)' : 'rgb(120 120 129)';

    it(`retains the sheetless Shadcn decorative border in ${mode} mode`, async () => {
      document.adoptedStyleSheets = [];
      const card = await fixture<LyraCard>(html`<lr-card data-lr-theme=${mode}>Content</lr-card>`);
      expect(await border(card)).to.deep.equal(toRgba(shadcn));
    });

    it(`retains installed Shadcn and restores the local alias for explicit Lyra in ${mode} mode`, async () => {
      document.adoptedStyleSheets = [...previousSheets, themeSheet];
      const scope = await fixture<HTMLElement>(html`<section data-lr-mode=${mode}><lr-card>Content</lr-card></section>`);
      const card = scope.querySelector<LyraCard>('lr-card')!;
      expect(await border(card)).to.deep.equal(toRgba(shadcn));
      scope.setAttribute('data-lr-look', 'lyra');
      expect(await border(card)).to.deep.equal(toRgba(lyra));
      card.setAttribute('data-lr-theme-scope', '');
      card.style.setProperty('--lr-color-border', 'rgb(12 34 56)');
      expect(await border(card)).to.deep.equal([12, 34, 56, 255]);
      scope.setAttribute('data-lr-theme-scope', '');
      scope.style.setProperty('--lr-theme-color-surface-border-subtle', 'rgb(78 90 123 / 0.6)');
      expect(await border(card)).to.deep.equal(toRgba('rgb(78 90 123 / 0.6)'));
      scope.style.setProperty('--lr-theme-color-surface-border-subtle', 'initial');
      expect(await border(card)).to.deep.equal([12, 34, 56, 255]);
      card.style.removeProperty('--lr-color-border');
      expect(await border(card)).to.deep.equal(toRgba(lyra));
      scope.style.removeProperty('--lr-theme-color-surface-border-subtle');
      scope.setAttribute('data-lr-look', 'shadcn');
      expect(await border(card)).to.deep.equal(toRgba(shadcn));
      scope.style.setProperty('--lr-theme-color-surface-border-subtle', 'initial');
      const control = mode === 'light' ? [145, 145, 145, 255] : [100, 100, 100, 255];
      expect(await border(card)).to.deep.equal(control);
    });
  }
});

import { expect, fixture, html } from '@open-wc/testing';
import '../../components/forms/button/button.js';
import '../../components/forms/input/input.js';
import '../../components/layout/card/card.js';
import type { LyraButton } from '../../components/forms/button/button.class.js';
import type { LyraInput } from '../../components/forms/input/input.class.js';
import type { LyraCard } from '../../components/layout/card/card.class.js';
import { setLyraStyle } from '../theme.js';

let originalSheets: CSSStyleSheet[] = [];
let themeSheets: CSSStyleSheet[] = [];

before(async () => {
  originalSheets = [...document.adoptedStyleSheets];
  themeSheets = await Promise.all(['../../theme.css', '../../looks/shadcn.css'].map(async (path) => {
    const response = await fetch(new URL(path, import.meta.url));
    if (!response.ok) throw new Error(`Missing style fixture: ${path}`);
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(await response.text());
    return sheet;
  }));
});

beforeEach(() => {
  document.adoptedStyleSheets = [...originalSheets, ...themeSheets];
});

afterEach(() => {
  setLyraStyle({ mode: 'unset', look: null, surface: null, density: null, accent: null, accentBackground: null, overrides: null });
  localStorage.removeItem('lyra-theme');
  document.adoptedStyleSheets = originalSheets;
});

describe('shadcn look', () => {
  for (const mode of ['light', 'dark'] as const) {
    it(`paints primary, control, and decorative surfaces in ${mode} mode`, async () => {
      setLyraStyle({ look: 'shadcn', mode });
      const button = await fixture<LyraButton>(html`<lr-button>Save</lr-button>`);
      const input = await fixture<LyraInput>(html`<lr-input label="Name"></lr-input>`);
      const card = await fixture<LyraCard>(html`<lr-card>Details</lr-card>`);
      await Promise.all([button.updateComplete, input.updateComplete, card.updateComplete]);

      const buttonBase = button.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
      const inputWrapper = input.shadowRoot!.querySelector<HTMLElement>('[part~="input-wrapper"]')!;
      const cardBase = card.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
      const expected = mode === 'light'
        ? { primary: 'rgb(26, 106, 77)', control: 'rgb(145, 145, 145)', card: 'rgb(229, 229, 229)' }
        : { primary: 'rgb(52, 211, 153)', control: 'rgb(100, 100, 100)', card: 'rgba(255, 255, 255, 0.1)' };

      expect(getComputedStyle(buttonBase).backgroundColor).to.equal(expected.primary);
      expect(getComputedStyle(inputWrapper).borderTopColor).to.equal(expected.control);
      expect(getComputedStyle(cardBase).borderTopColor).to.equal(expected.card);
      expect(document.documentElement.getAttribute('data-lr-look')).to.equal('shadcn');
      expect(document.documentElement.hasAttribute('data-lr-theme-preset')).to.equal(false);
    });
  }
});

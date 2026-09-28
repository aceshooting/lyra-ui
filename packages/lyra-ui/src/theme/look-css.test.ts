import { expect, fixture, html } from '@open-wc/testing';
import { defineLyraLook } from './theme.js';
import { lyraLookCss } from './look-css.js';

describe('portable look mode aliases', () => {
  let base: CSSStyleSheet;
  before(async () => {
    const response = await fetch(new URL('../theme.css', import.meta.url));
    if (!response.ok) throw new Error('Missing theme resolver fixture');
    base = new CSSStyleSheet();
    base.replaceSync(await response.text());
  });

  for (const order of ['look-first', 'base-first']) {
    it(`resolves aliases and explicit modes independently of load order: ${order}`, async () => {
      const host = await fixture<HTMLDivElement>(html`<div></div>`);
      const shadow = host.attachShadow({ mode: 'open' });
      const look = defineLyraLook({ id: 'sample-alias', tokens: {
        '--lr-theme-color-surface-default': { light: '#fafafa', dark: '#121212' },
      } });
      const lookSheet = new CSSStyleSheet();
      lookSheet.replaceSync(lyraLookCss(look, { modeAliases: true }));
      shadow.adoptedStyleSheets = order === 'look-first' ? [lookSheet, base] : [base, lookSheet];
      const region = document.createElement('section');
      region.setAttribute('data-lr-look', look.id);
      const alias = document.createElement('div');
      alias.className = 'dark';
      alias.style.backgroundColor = 'var(--lr-theme-color-surface-default)';
      region.append(alias);
      shadow.append(region);
      expect(getComputedStyle(alias).backgroundColor).to.equal('rgb(18, 18, 18)');
      alias.setAttribute('data-lr-theme', 'light');
      expect(getComputedStyle(alias).backgroundColor).to.equal('rgb(250, 250, 250)');
      alias.removeAttribute('data-lr-theme');
      alias.setAttribute('data-lr-mode', 'light');
      expect(getComputedStyle(alias).backgroundColor).to.equal('rgb(250, 250, 250)');
    });
  }

  it('does not enable aliases unless requested', async () => {
    const host = await fixture<HTMLDivElement>(html`<div></div>`);
    const shadow = host.attachShadow({ mode: 'open' });
    const lookSheet = new CSSStyleSheet();
    lookSheet.replaceSync(lyraLookCss(defineLyraLook({ id: 'no-alias', tokens: {
      '--lr-theme-color-surface-default': { light: '#fafafa', dark: '#121212' },
    } })));
    shadow.adoptedStyleSheets = [base, lookSheet];
    const region = document.createElement('section');
    region.setAttribute('data-lr-look', 'no-alias');
    region.className = 'dark';
    region.style.backgroundColor = 'var(--lr-theme-color-surface-default)';
    const scope = document.createElement('section');
    scope.setAttribute('data-lr-mode', 'light');
    scope.append(region);
    shadow.append(scope);
    expect(getComputedStyle(region).backgroundColor).to.equal('rgb(250, 250, 250)');
  });
});

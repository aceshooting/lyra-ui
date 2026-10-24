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

describe('look serialization', () => {
  const lines = (css: string): string[] => css.split('\n').map(line => line.trim()).filter(Boolean);

  it('writes an input outside the slotted set verbatim and brands the stylesheet with the look version', () => {
    const css = lyraLookCss(defineLyraLook({ id: 'sample-verbatim', tokens: {
      '--lr-theme-radius-card': '6px',
      '--lr-theme-color-text-normal': '#111111',
    } }));
    const written = lines(css);
    expect(written).to.include('--_lr-look-installed: sample-verbatim-1;');
    expect(written).to.include('--lr-theme-radius-card: 6px;');
    expect(css).to.contain("[data-lr-look='sample-verbatim']");
    expect(written, 'a plain string for a slotted input feeds both mode slots').to.include.members([
      '--_lr-ll-color-text-normal: #111111;',
      '--_lr-ld-color-text-normal: #111111;',
    ]);
  });

  it('omits the slot of a mode whose branch is null', () => {
    const written = lines(lyraLookCss(defineLyraLook({ id: 'sample-one-mode', tokens: {
      '--lr-theme-color-surface-default': { light: '#fafafa', dark: null },
      '--lr-theme-color-surface-raised': { light: '#ffffff', dark: '#202020' },
    } })));
    expect(written).to.include('--_lr-ll-color-surface-default: #fafafa;');
    expect(written.some(line => line.startsWith('--_lr-ld-color-surface-default:'))).to.equal(false);
    expect(written).to.include.members(['--_lr-ll-color-surface-raised: #ffffff;', '--_lr-ld-color-surface-raised: #202020;']);
  });

  it('lets a semantic channel follow the brand channel or own its value, per mode', () => {
    const written = lines(lyraLookCss(defineLyraLook({ id: 'sample-channels', tokens: {
      '--lr-theme-color-success-fill-normal': 'var(--lr-theme-color-brand-fill-normal)',
      '--lr-theme-color-danger-fill-normal': { light: '#cc0000', dark: 'var(--lr-theme-color-brand-fill-normal)' },
      '--lr-theme-color-warning-fill-normal': '#dd9900',
    } })));
    expect(written, 'the success channel hands both modes back to the brand ramp').to.include.members([
      '--_lr-fl-color-success-fill-normal: ;',
      '--_lr-ol-color-success-fill-normal: initial;',
      '--_lr-fd-color-success-fill-normal: ;',
      '--_lr-od-color-success-fill-normal: initial;',
    ]);
    expect(written.some(line => line.startsWith('--_lr-ll-color-success-fill-normal:'))).to.equal(false);
    expect(written, 'the danger channel owns its light value and follows the brand in dark').to.include.members([
      '--_lr-ll-color-danger-fill-normal: #cc0000;',
      '--_lr-fl-color-danger-fill-normal: initial;',
      '--_lr-ol-color-danger-fill-normal: ;',
      '--_lr-fd-color-danger-fill-normal: ;',
      '--_lr-od-color-danger-fill-normal: initial;',
    ]);
    expect(written.some(line => line.startsWith('--_lr-ld-color-danger-fill-normal:'))).to.equal(false);
    expect(written, 'an own value for the warning channel is slotted in both modes').to.include.members([
      '--_lr-ll-color-warning-fill-normal: #dd9900;',
      '--_lr-fl-color-warning-fill-normal: initial;',
      '--_lr-ol-color-warning-fill-normal: ;',
      '--_lr-ld-color-warning-fill-normal: #dd9900;',
      '--_lr-fd-color-warning-fill-normal: initial;',
      '--_lr-od-color-warning-fill-normal: ;',
    ]);
  });
});

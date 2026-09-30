import { expect, fixture, html } from '@open-wc/testing';
import './av-player.js';
import type { LyraAvPlayer } from './av-player.class.js';
import { contrastRatio, resolvedColorToken, toRgba } from '../../../../test/color-contrast.js';
import { setForcedColors } from '../../../../test/wtr-media.js';

const over = (foreground: string, background: string): string => {
  const a = toRgba(foreground);
  const b = toRgba(background);
  return `rgb(${a.slice(0, 3).map((value, i) => value * a[3] / 255 + b[i]! * (1 - a[3] / 255)).join(' ')})`;
};

describe('av-player owned clear controls', () => {
  let previous: CSSStyleSheet[];
  let sheets: CSSStyleSheet[];
  before(async () => {
    sheets = await Promise.all(['surfaces/glass.css', 'preferences.css'].map(async path => {
      const response = await fetch(new URL(`../../../${path}`, import.meta.url));
      if (!response.ok) throw new Error(`Missing fixture ${path}`);
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(await response.text());
      return sheet;
    }));
  });
  beforeEach(() => { previous = document.adoptedStyleSheets; document.adoptedStyleSheets = [...previous, ...sheets]; });
  afterEach(async () => { document.adoptedStyleSheets = previous; await setForcedColors('none'); });

  it('leaves regular Solid controls transparent and native controls intact', async () => {
    const player = await fixture<LyraAvPlayer>(html`<lr-av-player data-lr-surface="solid"></lr-av-player>`);
    expect(player.controlsSurface).to.equal('regular');
    const toolbar = player.shadowRoot!.querySelector('[part="toolbar"]')!;
    expect(toRgba(getComputedStyle(toolbar).backgroundColor)[3]).to.equal(0);
    expect(getComputedStyle(toolbar).backgroundImage).to.equal('none');
    expect(player.shadowRoot!.querySelector('[part="media"]')!.hasAttribute('controls')).to.equal(true);
  });

  it('applies the default Glass material to regular owned controls without changing native controls', async () => {
    const player = await fixture<LyraAvPlayer>(html`<lr-av-player></lr-av-player>`);
    expect(player.controlsSurface).to.equal('regular');
    const toolbar = player.shadowRoot!.querySelector('[part="toolbar"]')!;
    expect(toRgba(getComputedStyle(toolbar).backgroundColor)[3]).to.equal(204);
    expect(getComputedStyle(toolbar).backgroundImage).to.equal('none');
    expect(getComputedStyle(toolbar, '::before').backdropFilter).to.include('blur(12px)');
    expect(player.shadowRoot!.querySelector('[part="media"]')!.hasAttribute('controls')).to.equal(true);
  });

  it('restores regular controls after attribute removal or an unsupported assignment', async () => {
    const player = await fixture<LyraAvPlayer>(html`<lr-av-player controls-surface="clear"></lr-av-player>`);
    player.removeAttribute('controls-surface');
    await player.updateComplete;
    expect(player.controlsSurface).to.equal('regular');
    player.controlsSurface = 'unsupported' as typeof player.controlsSurface;
    await player.updateComplete;
    expect(player.controlsSurface).to.equal('regular');
    expect(player.getAttribute('controls-surface')).to.equal('regular');
  });

  it('paints its own gradient and qualifies control text, boundaries and focus over every backdrop', async () => {
    const player = await fixture<LyraAvPlayer>(html`<lr-av-player controls-surface="clear"></lr-av-player>`);
    const toolbar = player.shadowRoot!.querySelector('[part="toolbar"]')!;
    const select = player.shadowRoot!.querySelector('[part="rate-select"]')!;
    const styles = getComputedStyle(toolbar);
    const stops = styles.backgroundImage.match(/(?:color|rgba?)\([^)]*\)/g)!;
    expect(stops.length).to.equal(2);
    expect(toRgba(stops[0]!)[3]).to.be.within(198, 200);
    for (const backdrop of ['black', 'white']) for (const stop of stops) {
      const background = over(stop, over(styles.backgroundColor, backdrop));
      expect(contrastRatio(getComputedStyle(select).color, background)).to.be.at.least(4.5);
      expect(contrastRatio(getComputedStyle(select).borderTopColor, background)).to.be.at.least(3);
      expect(contrastRatio(resolvedColorToken(toolbar, '--lr-focus-ring-color'), background)).to.be.at.least(3);
    }
    expect(player.shadowRoot!.querySelector('[part="media"]')!.hasAttribute('controls')).to.equal(true);
  });

  it('makes the owned scrim opaque for explicit increased contrast and restores clear on reset', async () => {
    const player = await fixture<LyraAvPlayer>(html`<lr-av-player controls-surface="clear" data-lr-contrast="more"></lr-av-player>`);
    const toolbar = player.shadowRoot!.querySelector('[part="toolbar"]')!;
    const stops = () => getComputedStyle(toolbar).backgroundImage.match(/(?:color|rgba?)\([^)]*\)/g)!;
    expect(stops().every(color => toRgba(color)[3] === 255)).to.equal(true);
    player.setAttribute('data-lr-contrast', 'system');
    expect(toRgba(stops()[0]!)[3]).to.be.lessThan(255);
  });

  it('removes the clear scrim under forced colors', async () => {
    const player = await fixture<LyraAvPlayer>(html`<lr-av-player controls-surface="clear"></lr-av-player>`);
    await setForcedColors('active');
    const toolbar = player.shadowRoot!.querySelector('[part="toolbar"]')!;
    expect(getComputedStyle(toolbar).backgroundImage).to.equal('none');
    expect(toRgba(getComputedStyle(toolbar).backgroundColor)[3]).to.equal(255);
  });
});

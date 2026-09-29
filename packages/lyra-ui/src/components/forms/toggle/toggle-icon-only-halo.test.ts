import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './toggle.js';
import '../toggle-group/toggle-group.js';
import type { LyraToggle } from './toggle.class.js';
import { gemstoneGlyph, gemstoneSelectedGlyphStyles } from '../../../theme/gemstones.js';

const HALO = '0.75rem';

describe('lr-toggle icon-only glyph halo', () => {
  let sheet: HTMLStyleElement;

  before(() => {
    sheet = document.createElement('style');
    sheet.textContent = `${gemstoneSelectedGlyphStyles.cssText}
      [data-glyph] svg { inline-size: 100%; block-size: 100%; }`;
    document.head.append(sheet);
  });

  after(() => {
    sheet.remove();
  });

  const gem = html`<span
    data-glyph
    data-lr-gemstone-selected
    aria-hidden="true"
    style="display: inline-flex; position: relative; inline-size: 1.15rem; block-size: 1.15rem;"
    >${gemstoneGlyph('rgb(37 99 235)')}<i
      data-halo
      style=${`position: absolute; inset: calc(-1 * ${HALO});`}
    ></i
  ></span>`;

  async function glowingToggle(dir: 'ltr' | 'rtl'): Promise<LyraToggle> {
    return (await fixture(html`
      <lr-toggle
        appearance="plain"
        aria-label="Accent: sapphire"
        pressed
        dir=${dir}
        style=${`--lr-gemstone-selected-color: rgb(37 99 235); --lr-gemstone-selected-blur: ${HALO};`}
        >${gem}</lr-toggle
      >
    `)) as LyraToggle;
  }

  const shadowPart = (el: LyraToggle, selector: string): HTMLElement =>
    el.shadowRoot!.querySelector(selector) as HTMLElement;

  for (const dir of ['ltr', 'rtl'] as const) {
    it(`lets an icon-only label paint its glyph's glow past the label box (${dir})`, async () => {
      const el = await glowingToggle(dir);
      await el.updateComplete;
      const button = shadowPart(el, '[part~="button"]');
      const label = shadowPart(el, '[part="label"]');
      const glyph = el.querySelector<HTMLElement>('[data-glyph]')!;

      expect(getComputedStyle(glyph).filter, 'the shared halo is applied').to.contain('drop-shadow');
      expect(getComputedStyle(label).overflowX).to.equal('visible');
      expect(getComputedStyle(label).overflowY).to.equal('visible');

      const labelBox = label.getBoundingClientRect();
      const glyphBox = glyph.getBoundingClientRect();
      const buttonBox = button.getBoundingClientRect();
      const y = glyphBox.top + glyphBox.height / 2;
      for (const [side, x] of [
        ['left', labelBox.left - 3],
        ['right', labelBox.right + 3],
      ] as const) {
        expect(x > buttonBox.left && x < buttonBox.right, `${side} probe inside the control`).to.equal(
          true
        );
        const hit = document.elementFromPoint(x, y);
        expect(
          hit?.hasAttribute('data-halo') ?? false,
          `${side} halo is not clipped (hit ${hit?.localName ?? 'nothing'})`
        ).to.equal(true);
      }
    });
  }

  it('releases the clip inside a toggle group', async () => {
    const group = (await fixture(html`
      <lr-toggle-group aria-label="Accent">
        <lr-toggle appearance="plain" aria-label="Sapphire" value="sapphire" pressed>${gem}</lr-toggle>
      </lr-toggle-group>
    `)) as HTMLElement;
    const el = group.querySelector('lr-toggle') as LyraToggle;
    await el.updateComplete;
    expect(getComputedStyle(shadowPart(el, '[part="label"]')).overflowX).to.equal('visible');
  });

  it('keeps clipping and ellipsizing a text label', async () => {
    const el = (await fixture(html`
      <lr-toggle style="inline-size: 80px;">A considerably long toggle label</lr-toggle>
    `)) as LyraToggle;
    await el.updateComplete;
    const label = shadowPart(el, '[part="label"]');
    expect(getComputedStyle(label).overflowX).to.equal('hidden');
    expect(getComputedStyle(label).textOverflow).to.equal('ellipsis');
  });

  it('tracks the label content as it changes between glyph and text', async () => {
    const el = await glowingToggle('ltr');
    const label = shadowPart(el, '[part="label"]');
    expect(getComputedStyle(label).overflowX).to.equal('visible');
    el.replaceChildren(document.createTextNode('Sapphire'));
    await waitUntil(() => getComputedStyle(label).overflowX === 'hidden', 'clip never returned');
    const glyph = document.createElement('span');
    el.replaceChildren(glyph);
    await waitUntil(() => getComputedStyle(label).overflowX === 'visible', 'clip never released');
  });
});

describe('lr-toggle icon-only halo with CSS-hidden label', () => {
  it('releases the clip when a container query hides an sr-only-style label after mount', async () => {
    const style = document.createElement('style');
    style.textContent = '@container (max-width: 100px) { .tg-live-label { display: none; } }';
    document.head.append(style);
    try {
      const container = document.createElement('div');
      container.style.cssText = 'container-type: inline-size; inline-size: 320px;';
      const el = await fixture<LyraToggle>(
        html`<lr-toggle aria-label="Accent"><span data-glyph style="display:inline-block;inline-size:1rem;block-size:1rem"></span><span class="tg-live-label">Accent</span></lr-toggle>`,
        { parentNode: container }
      );
      const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
      expect(getComputedStyle(label).overflowX).to.equal('hidden');
      container.style.inlineSize = '80px';
      await waitUntil(() => getComputedStyle(label).overflowX === 'visible', 'clip never released');
      container.style.inlineSize = '320px';
      await waitUntil(() => getComputedStyle(label).overflowX === 'hidden', 'clip never returned');
    } finally {
      style.remove();
    }
  });
});

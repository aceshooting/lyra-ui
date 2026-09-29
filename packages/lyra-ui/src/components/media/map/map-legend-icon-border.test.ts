import { expect, fixture, html } from '@open-wc/testing';
import { setForcedColors } from '../../../../test/wtr-media.js';
import './map.js';
import type { LyraMap } from './map.js';

const STROKE_PATH = 'M12 3 L21 20 L3 20 Z';

async function legendSwatches(): Promise<HTMLElement[]> {
  const el = (await fixture(html`<lr-map></lr-map>`)) as LyraMap;
  el.legend = [
    {
      color: '#006b5e',
      label: 'Rail line',
      pattern: 'solid',
      icon: { path: STROKE_PATH, mode: 'stroke', strokeWidth: 2 },
    },
    { color: '#c04a00', label: 'Solid area', pattern: 'solid' },
  ];
  await el.updateComplete;
  return [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="legend-swatch"]')];
}

for (const forcedColors of ['none', 'active'] as const) {
  it(`drops the icon swatch border and keeps the color swatch border with forced colors ${forcedColors}`, async () => {
    await setForcedColors(forcedColors);
    try {
      const [iconSwatch, colorSwatch] = await legendSwatches();
      const iconStyle = getComputedStyle(iconSwatch!);
      const colorStyle = getComputedStyle(colorSwatch!);

      expect(iconSwatch!.dataset['icon']).to.equal('true');
      expect(iconStyle.borderWidth, 'a glyph renders without a framing box').to.equal('0px');
      expect(colorSwatch!.hasAttribute('data-icon')).to.be.false;
      expect(colorStyle.borderTopWidth, 'the ordinary pattern swatch keeps its border').to.not.equal('0px');

      const glyphPath = iconSwatch!.querySelector('path');
      expect(glyphPath?.getAttribute('d'), 'the decorative glyph remains visible').to.equal(STROKE_PATH);
      expect(glyphPath?.getAttribute('fill')).to.equal('none');
      expect(glyphPath?.getAttribute('stroke')).to.equal('currentColor');
    } finally {
      await setForcedColors('none');
    }
  });
}

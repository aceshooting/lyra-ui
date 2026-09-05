import { expect, fixture, html } from '@open-wc/testing';
import './word-cloud.js';
import type { LyraWordCloud } from './word-cloud.js';
import { layoutWordCloud } from './word-cloud-layout.js';

for (const scale of ['linear', 'sqrt'] as const) {
  for (const reversed of [false, true]) {
    it(`keeps extreme ${reversed ? 'reversed' : 'forward'} finite domains bounded through ${scale} layout and SVG rendering`, async () => {
      const domain: [number, number] = reversed ? [1e308, -1e308] : [-1e308, 1e308];
      const words = [{ text: 'low', weight: 0 }, { text: 'high', weight: 1e308 }, { text: 'negative', weight: -1 }];
      const result = layoutWordCloud(words, { domain, scale, minFontSize: 12, maxFontSize: 48, wordRotation: 'none', measureText: (text, size) => text.length * size / 2 });
      expect(result.placed.length).to.equal(3);
      expect(result.skippedCount).to.equal(0);
      const lowSize = 12 + (scale === 'sqrt' ? Math.sqrt(0.5) : 0.5) * 36;
      expect(result.placed.find((word) => word.text === 'low')?.fontSize).to.be.closeTo(lowSize, 0.001);
      expect(result.placed.find((word) => word.text === 'high')?.fontSize).to.equal(48);
      expect(result.placed.find((word) => word.text === 'negative')?.weight).to.equal(0);
      expect([result.width, result.height, ...result.placed.flatMap((word) => [word.x, word.y, word.width, word.height, word.fontSize])].every(Number.isFinite)).to.equal(true);
      const element = await fixture<LyraWordCloud>(html`<lr-word-cloud .domain=${domain} .words=${words} scale=${scale} min-font-size="12" max-font-size="48"></lr-word-cloud>`);
      const rendered = [...element.shadowRoot!.querySelectorAll<SVGTextElement>('[part="word"]')];
      expect(rendered.length).to.equal(3);
      const word = (name: string) => rendered.find((node) => node.textContent === name)!;
      expect(Number(word('low').getAttribute('font-size'))).to.be.closeTo(lowSize, 0.001);
      expect(Number(word('high').getAttribute('font-size'))).to.equal(48);
      expect(rendered.every((node) => Number.isFinite(node.getBBox().width) && node.getBBox().width > 0)).to.equal(true);
      const viewBox = element.shadowRoot!.querySelector('svg')!.viewBox.baseVal;
      expect([viewBox.x, viewBox.y, viewBox.width, viewBox.height].every(Number.isFinite)).to.equal(true);
      expect(viewBox.width).to.be.greaterThan(0);
      expect(viewBox.height).to.be.greaterThan(0);
      expect(element.shadowRoot!.textContent).not.to.contain('NaN');
    });
  }
}

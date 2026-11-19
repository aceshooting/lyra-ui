import { expect } from '@open-wc/testing';
import { contrastRatio, relativeLuminance } from './color-math.js';

describe('color-math', () => {
  it('computes WCAG luminance anchors', () => {
    expect(relativeLuminance([0, 0, 0])).to.equal(0);
    expect(relativeLuminance([255, 255, 255])).to.be.closeTo(1, 1e-9);
    expect(relativeLuminance([255, 0, 0])).to.be.closeTo(0.2126, 1e-4);
  });
  it('matches known contrast pairs', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).to.be.closeTo(21, 1e-9);
    expect(contrastRatio([119, 119, 119], [255, 255, 255])).to.be.closeTo(4.48, 0.01);
    expect(contrastRatio([10, 20, 30], [10, 20, 30])).to.equal(1);
  });
});

import { expect } from '@open-wc/testing';
import { sanitizeSwatchColor } from './safe-css.js';

describe('sanitizeSwatchColor', () => {
  it('allows hex, keyword, function, and custom-property color syntax', () => {
    for (const color of [
      '#fff',
      '#ffffff',
      '#ffffffff',
      'red',
      'transparent',
      'currentColor',
      'rgb(1, 2, 3)',
      'rgba(1, 2, 3, 0.5)',
      'hsl(120, 50%, 50%)',
      'oklch(0.7 0.1 200)',
      'var(--lr-color-brand)',
    ]) {
      expect(sanitizeSwatchColor(color), color).to.equal(color);
    }
  });

  it('trims surrounding whitespace on an otherwise-safe value', () => {
    expect(sanitizeSwatchColor('  red  ')).to.equal('  red  ');
  });

  it('rejects url() and CSS-injection payloads', () => {
    for (const color of [
      'url(javascript:alert(1))',
      'red; background: url(evil)',
      'red}body{background:url(evil)',
      '',
      '   ',
    ]) {
      expect(sanitizeSwatchColor(color), color).to.be.undefined;
    }
  });
});

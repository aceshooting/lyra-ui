import { expect } from '@open-wc/testing';
import {
  sanitizeCssColor,
  sanitizeCssInset,
  sanitizeCssLength,
  sanitizeCssResize,
  sanitizePercentRect,
} from './safe-css.js';

describe('sanitizeCssColor (the swatch guard)', () => {
  it('no longer exports the historical sanitizeSwatchColor alias', async () => {
    const module = (await import('./safe-css.js')) as Record<string, unknown>;
    expect(module.sanitizeSwatchColor).to.equal(undefined);
  });

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
      expect(sanitizeCssColor(color), color).to.equal(color);
    }
  });

  it('trims surrounding whitespace on an otherwise-safe value', () => {
    expect(sanitizeCssColor('  red  ')).to.equal('  red  ');
  });

  it('rejects url() and CSS-injection payloads', () => {
    for (const color of [
      'url(javascript:alert(1))',
      'red; background: url(evil)',
      'red}body{background:url(evil)',
      '',
      '   ',
    ]) {
      expect(sanitizeCssColor(color), color).to.be.undefined;
    }
  });
});

describe('property-safe CSS values', () => {
  it('accepts valid public color, length, inset, and resize values', () => {
    expect(sanitizeCssColor('color-mix(in srgb, red 25%, blue)')).to.equal(
      'color-mix(in srgb, red 25%, blue)',
    );
    expect(sanitizeCssLength('calc(10rem + 2px)', 'max-height')).to.equal(
      'calc(10rem + 2px)',
    );
    expect(sanitizeCssLength('var(--chart-height)', 'height')).to.equal(
      'var(--chart-height)',
    );
    expect(sanitizeCssInset('var(--lr-space-l) 0')).to.equal(
      'var(--lr-space-l) 0',
    );
    expect(sanitizeCssResize('horizontal', 'both')).to.equal('horizontal');
  });

  it('rejects declaration breaks and url paint servers', () => {
    for (const value of [
      'red; position:fixed',
      'red}body{display:none',
      'url("data:image/svg+xml,<svg/>")',
    ]) {
      expect(sanitizeCssColor(value), value).to.be.undefined;
      expect(sanitizeCssLength(value, 'max-height'), value).to.be.undefined;
      expect(sanitizeCssInset(value), value).to.be.undefined;
    }
    expect(sanitizeCssResize('both;position:fixed', 'vertical')).to.equal(
      'vertical',
    );
  });
});

describe('sanitizePercentRect', () => {
  it('accepts finite percentage rectangles', () => {
    expect(sanitizePercentRect({ x: -5, y: 10, width: 25, height: 30 })).to.deep.equal({
      x: -5,
      y: 10,
      width: 25,
      height: 30,
    });
  });

  it('rejects non-finite coordinates, negative sizes, and non-numeric payloads', () => {
    for (const rect of [
      { x: Number.NaN, y: 0, width: 1, height: 1 },
      { x: 0, y: Number.POSITIVE_INFINITY, width: 1, height: 1 },
      { x: 0, y: 0, width: -1, height: 1 },
      { x: '0;position:fixed', y: 0, width: 1, height: 1 },
    ]) {
      expect(sanitizePercentRect(rect), JSON.stringify(rect)).to.be.undefined;
    }
  });
});

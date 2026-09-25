import { expect } from '@open-wc/testing';
import { html, nothing, render } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
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
    expect(module['sanitizeSwatchColor']).to.equal(undefined);
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

  it('reads geometry only through own data descriptors and fails closed on hostile records', () => {
    let getterCalls = 0;
    const accessorBacked = Object.defineProperties(
      { y: 0, width: 10, height: 10 },
      {
        x: {
          enumerable: true,
          get() {
            getterCalls += 1;
            throw new Error('geometry accessor must not run');
          },
        },
      },
    );
    const reflectionFailure = new Proxy(
      { x: 0, y: 0, width: 10, height: 10 },
      {
        getOwnPropertyDescriptor() {
          throw new Error('descriptor reflection failed');
        },
      },
    );

    expect(() => sanitizePercentRect(accessorBacked)).not.to.throw();
    expect(sanitizePercentRect(accessorBacked)).to.equal(undefined);
    expect(sanitizePercentRect(reflectionFailure)).to.equal(undefined);
    expect(getterCalls).to.equal(0);
  });
});

describe('balanced CSS values', () => {
  async function unbalancedVectors(): Promise<string[]> {
    const url = new URL('../../scripts/fixtures/theme-token-grammar.json', import.meta.url).href;
    const vectors = ((await import(url)) as { default: { unbalanced: string[] } }).default.unbalanced;
    expect(vectors.length).to.be.greaterThan(0);
    return vectors;
  }

  it('rejects an unclosed parenthesis or quote, and comment delimiters, before asking the browser', async () => {
    expect(sanitizeCssColor('rgb(0 0 0')).to.equal(undefined);
    expect(sanitizeCssColor('\'red')).to.equal(undefined);
    expect(sanitizeCssLength('calc(10px')).to.equal(undefined);
    expect(sanitizeCssLength('calc(10px) /* x')).to.equal(undefined);
    expect(sanitizeCssInset('calc(1px')).to.equal(undefined);
    expect(sanitizeCssColor('r/**/ed')).to.equal(undefined);
    expect(sanitizeCssColor('[red]')).to.equal(undefined);
    for (const value of await unbalancedVectors()) {
      expect(sanitizeCssColor(value), value).to.equal(undefined);
      expect(sanitizeCssLength(value), value).to.equal(undefined);
      expect(sanitizeCssLength(value, 'height'), value).to.equal(undefined);
      expect(sanitizeCssInset(value), value).to.equal(undefined);
    }
  });

  it('keeps the next declaration intact on a styleMap first commit', () => {
    const container = document.body.appendChild(document.createElement('div'));
    try {
      render(html`<span style=${styleMap({ background: sanitizeCssColor('rgb(0 0 0'), color: 'blue' })}></span>`, container);
      const span = container.querySelector('span')!;
      expect(span.style.getPropertyValue('color')).to.equal('blue');
      const copy = document.createElement('span');
      copy.setAttribute('style', span.getAttribute('style') ?? '');
      expect(copy.style.getPropertyValue('color')).to.equal('blue');
    } finally {
      render(nothing, container);
      container.remove();
    }
  });
});

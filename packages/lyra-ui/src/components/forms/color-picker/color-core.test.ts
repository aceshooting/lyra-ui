import { expect } from '@open-wc/testing';
import {
  cssColor,
  formatColor,
  hslToHsv,
  hsva,
  hsvToHsl,
  hsvToRgb,
  parseColor,
  rgbToHsv,
  sameColor,
  withAlphaFormat,
} from './color-core.js';

describe('color-core conversions', () => {
  it('normalizes and clamps every hsva component', () => {
    expect(hsva(400, 150, -10, 5)).to.deep.equal({ h: 40, s: 100, v: 0, a: 1 });
    expect(hsva(-30, 50, 50)).to.deep.equal({ h: 330, s: 50, v: 50, a: 1 });
    // Every component clamps a non-finite input to the low end of its own domain.
    expect(hsva(Number.NaN, Number.NaN, Number.NaN, Number.NaN)).to.deep.equal({
      h: 0,
      s: 0,
      v: 0,
      a: 0,
    });
  });

  it('walks every hue sextant in both directions', () => {
    const roundTrip = (r: number, g: number, b: number): [number, number, number] => {
      const { h, s, v } = rgbToHsv(r, g, b);
      const back = hsvToRgb(h, s, v);
      return [Math.round(back.r), Math.round(back.g), Math.round(back.b)];
    };
    for (const rgb of [
      [255, 0, 0],
      [255, 255, 0],
      [0, 255, 0],
      [0, 255, 255],
      [0, 0, 255],
      [255, 0, 255],
      [128, 128, 128],
      [0, 0, 0],
      [255, 255, 255],
    ] as const) {
      expect(roundTrip(...rgb), rgb.join(',')).to.deep.equal([...rgb]);
    }
    // A max of zero has no chroma to divide by, so saturation must resolve to zero, not NaN.
    expect(rgbToHsv(0, 0, 0)).to.deep.equal({ h: 0, s: 0, v: 0 });
  });

  it('converts between hsv and hsl including the degenerate ends', () => {
    expect(hsvToHsl(0, 0, 0)).to.deep.equal({ h: 0, s: 0, l: 0 });
    expect(hsvToHsl(0, 0, 100)).to.deep.equal({ h: 0, s: 0, l: 100 });
    expect(hsvToHsl(120, 100, 100)).to.deep.equal({ h: 120, s: 100, l: 50 });
    expect(hslToHsv(0, 50, 0)).to.deep.equal({ h: 0, s: 0, v: 0 });
    expect(hslToHsv(120, 100, 50)).to.deep.equal({ h: 120, s: 100, v: 100 });
    expect(hslToHsv(400, 200, 150).h).to.equal(40);
  });
});

describe('color-core parsing', () => {
  const red = (color: ReturnType<typeof parseColor>): [number, number, number, number] => {
    const { r, g, b } = hsvToRgb(color!.h, color!.s, color!.v);
    return [Math.round(r), Math.round(g), Math.round(b), Number(color!.a.toFixed(2))];
  };

  it('rejects blank and unparsable input', () => {
    expect(parseColor(null as unknown as string)).to.equal(null);
    expect(parseColor('')).to.equal(null);
    expect(parseColor('   ')).to.equal(null);
    expect(parseColor('not-a-color')).to.equal(null);
    expect(parseColor('#12345')).to.equal(null);
    expect(parseColor('rgb(1, 2)')).to.equal(null);
    expect(parseColor('rgb(a, b, c)')).to.equal(null);
    expect(parseColor('hsl(a, 1%, 2%)')).to.equal(null);
    expect(parseColor('lab(50% 20 30)')).to.not.equal(null);
    expect(parseColor('rgb(1 2 3 / bad)')).to.equal(null);
    expect(parseColor('oklab(2 3 4 5 6)')).to.equal(null);
  });

  it('accepts every hex length, with and without alpha', () => {
    expect(red(parseColor('#f00'))).to.deep.equal([255, 0, 0, 1]);
    expect(red(parseColor('#ff0000'))).to.deep.equal([255, 0, 0, 1]);
    expect(red(parseColor('#f00f'))).to.deep.equal([255, 0, 0, 1]);
    expect(red(parseColor('#ff000080'))).to.deep.equal([255, 0, 0, 0.5]);
  });

  it('accepts legacy comma and modern slash function syntax', () => {
    expect(red(parseColor('rgb(255, 0, 0)'))).to.deep.equal([255, 0, 0, 1]);
    expect(red(parseColor('rgb(255 0 0 / 50%)'))).to.deep.equal([255, 0, 0, 0.5]);
    expect(red(parseColor('rgba(255, 0, 0, 0.25)'))).to.deep.equal([255, 0, 0, 0.25]);
    expect(red(parseColor('rgb(100%, 0%, 0%)'))).to.deep.equal([255, 0, 0, 1]);
    expect(red(parseColor('hsl(0, 100%, 50%)'))).to.deep.equal([255, 0, 0, 1]);
    expect(red(parseColor('hsla(0, 100%, 50%, 0.5)'))).to.deep.equal([255, 0, 0, 0.5]);
    expect(red(parseColor('hsv(0, 100%, 100%)'))).to.deep.equal([255, 0, 0, 1]);
    expect(red(parseColor('hsva(0 100% 100% / 0.5)'))).to.deep.equal([255, 0, 0, 0.5]);
  });

  it('reads every angle unit the hue channel accepts', () => {
    const hue = (text: string): number => Math.round(parseColor(text)!.h);
    expect(hue('hsl(120deg, 100%, 50%)')).to.equal(120);
    expect(hue('hsl(0.5turn, 100%, 50%)')).to.equal(180);
    expect(hue('hsl(200grad, 100%, 50%)')).to.equal(180);
    expect(hue('hsl(3.14159rad, 100%, 50%)')).to.equal(180);
    expect(hue('hsl(90, 100%, 50%)')).to.equal(90);
    expect(parseColor('hsl(NaNdeg, 100%, 50%)')).to.equal(null);
  });

  it('resolves named colors through CSSOM and rejects CSS-wide keywords', () => {
    expect(red(parseColor('red'))).to.deep.equal([255, 0, 0, 1]);
    // The second read comes back off the CSSOM cache rather than a fresh canvas probe.
    expect(red(parseColor('red'))).to.deep.equal([255, 0, 0, 1]);
    expect(parseColor('inherit')).to.equal(null);
    expect(parseColor('currentColor')).to.equal(null);
    expect(parseColor('initial')).to.equal(null);
  });

  it('fails closed when a modern CSS color cannot acquire a canvas context', () => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (() => null) as typeof original;
    try {
      expect(parseColor('lab(49% 19 29)')).to.equal(null);
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
    }
  });
});

describe('color-core serialization', () => {
  const scarlet = hsva(0, 100, 100, 0.5);

  it('emits every public output format', () => {
    expect(formatColor(scarlet, 'hex')).to.equal('#ff0000');
    expect(formatColor(scarlet, 'hexa')).to.equal('#ff000080');
    expect(formatColor(scarlet, 'rgb')).to.equal('rgb(255, 0, 0)');
    expect(formatColor(scarlet, 'rgba')).to.equal('rgba(255, 0, 0, 0.50)');
    expect(formatColor(scarlet, 'hsl')).to.equal('hsl(0, 100%, 50%)');
    expect(formatColor(scarlet, 'hsla')).to.equal('hsla(0, 100%, 50%, 0.50)');
    expect(formatColor(scarlet, 'hsv')).to.equal('hsv(0, 100%, 100%)');
    expect(formatColor(scarlet, 'hsva')).to.equal('hsva(0, 100%, 100%, 0.50)');
    expect(formatColor(scarlet, 'hex', true)).to.equal('#FF0000');
    expect(formatColor(scarlet, 'rgb', true)).to.equal('RGB(255, 0, 0)');
  });

  it('upgrades each base format to its alpha-carrying spelling', () => {
    expect(withAlphaFormat('hex', true)).to.equal('hexa');
    expect(withAlphaFormat('rgb', true)).to.equal('rgba');
    expect(withAlphaFormat('hsl', true)).to.equal('hsla');
    expect(withAlphaFormat('hsv', true)).to.equal('hsva');
    expect(withAlphaFormat('hex', false)).to.equal('hex');
    expect(withAlphaFormat('hsl', false)).to.equal('hsl');
  });

  it('renders an opaque and a translucent CSS color', () => {
    expect(cssColor(hsva(0, 100, 100, 1))).to.equal('rgba(255, 0, 0, 1.00)');
    expect(cssColor(scarlet)).to.equal('rgba(255, 0, 0, 0.50)');
  });

  it('compares colors at the 8-bit precision the picker actually emits', () => {
    expect(sameColor(hsva(10, 20, 30, 0.4), hsva(10, 20, 30, 0.4))).to.equal(true);
    // Sub-8-bit differences round to the same emitted color and count as equal.
    expect(sameColor(hsva(10, 20, 30, 0.4), hsva(10.05, 20, 30, 0.4))).to.equal(true);
    expect(sameColor(hsva(0, 100, 100, 1), hsva(120, 100, 100, 1))).to.equal(false);
    expect(sameColor(hsva(0, 100, 100, 1), hsva(0, 0, 100, 1))).to.equal(false);
    expect(sameColor(hsva(0, 100, 100, 1), hsva(0, 100, 0, 1))).to.equal(false);
    expect(sameColor(hsva(0, 100, 100, 1), hsva(0, 100, 100, 0.5))).to.equal(false);
  });
});

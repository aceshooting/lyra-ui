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
    const colors: ReadonlyArray<readonly [number, number, number]> = [
      [255, 0, 0],
      [255, 255, 0],
      [0, 255, 0],
      [0, 255, 255],
      [0, 0, 255],
      [255, 0, 255],
      [128, 128, 128],
      [0, 0, 0],
      [255, 255, 255],
    ];
    for (const rgb of colors) {
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

describe('color-core hsl() parsing matches the browser', () => {
  // Each row is an author colour and the channels Chromium's getComputedStyle(...).color reports for
  // it. Firefox and WebKit resolve some exact-.5 channels differently (and WebKit does not clamp a
  // saturation above 100%); Chromium is the reference, so these rows pin its decisions. The table is
  // checked through the pure parse/format functions, so it holds in every engine.
  type Row = readonly [text: string, channels: readonly [number, number, number]];

  const disagreements = (rows: readonly Row[]): string[] => {
    const failures: string[] = [];
    for (const [text, [r, g, b]] of rows) {
      const wantedRgb = `rgb(${r}, ${g}, ${b})`;
      const wantedHex = `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
      const color = parseColor(text);
      const gotRgb = color === null ? 'null' : formatColor(color, 'rgb');
      const gotHex = color === null ? 'null' : formatColor(color, 'hex');
      if (gotRgb !== wantedRgb || gotHex !== wantedHex) {
        failures.push(`${text}: got ${gotRgb} ${gotHex}, browser ${wantedRgb} ${wantedHex}`);
      }
    }
    return failures;
  };

  it('rounds a channel that is exactly .5 in real arithmetic the way the browser does (mostly up)', () => {
    expect(
      disagreements([
        ['hsl(0, 100%, 95%)', [255, 230, 230]],
        ['hsl(5, 5%, 84%)', [216, 213, 212]],
        ['hsl(0, 25%, 92%)', [240, 230, 230]],
        ['hsl(55, 88%, 25%)', [120, 111, 8]],
        ['hsl(247, 75%, 60%)', [94, 77, 230]],
        ['hsl(335, 75%, 40%)', [179, 26, 89]],
        ['hsl(187, 60%, 25%)', [26, 93, 102]],
        ['hsl(281, 100%, 95%)', [247, 230, 255]],
        ['hsl(90, 78%, 10%)', [26, 45, 6]],
        ['hsl(116, 25%, 76%)', [181, 209, 179]],
        ['hsl(161, 60%, 25%)', [26, 102, 78]],
        ['hsl(210, 54%, 70%)', [137, 179, 220]],
        ['hsl(305, 25%, 76%)', [209, 179, 207]],
      ]),
    ).to.deep.equal([]);
  });

  it('rounds the exact .5 channels the browser rounds down, where its single precision lands just under', () => {
    expect(
      disagreements([
        ['hsl(170, 80%, 50%)', [26, 230, 195]],
        ['hsl(155, 50%, 40%)', [51, 153, 110]],
        ['hsl(235, 70%, 60%)', [82, 93, 224]],
        ['hsl(335, 100%, 44%)', [224, 0, 93]],
        ['hsl(125, 80%, 66%)', [99, 238, 110]],
        ['hsl(205, 80%, 50%)', [26, 144, 230]],
        ['hsl(14, 50%, 50%)', [191, 93, 64]],
        ['hsl(346, 50%, 50%)', [191, 64, 93]],
        ['hsl(10, 60%, 50%)', [204, 76, 51]],
        ['hsl(10, 100%, 50%)', [255, 42, 0]],
      ]),
    ).to.deep.equal([]);
  });

  it('follows the 1e-7 the browser adds before rounding, so a hair under .5 can still round up', () => {
    expect(
      disagreements([
        ['hsl(327, 91%, 39%)', [190, 9, 109]],
        ['hsl(33, 91%, 39%)', [190, 109, 9]],
        ['hsl(273, 91%, 39%)', [109, 9, 190]],
        ['hsl(153, 91%, 39%)', [9, 190, 109]],
        ['hsl(398, 5.24%, 65.2%)', [171, 168, 162]],
        ['hsl(178.72, 1.81%, 74%)', [188, 190, 190]],
        ['hsl(-664.181, 25.5%, 28.46%)', [91, 89, 54]],
        ['hsl(49.34, 78.7%, 16%)', [73, 62, 9]],
      ]),
    ).to.deep.equal([]);
  });

  it('matches fractional, negative and over-turn hues, including their exact .5 channels', () => {
    expect(
      disagreements([
        ['hsl(550, 100%, 50%)', [0, 212, 255]],
        ['hsl(-529.312, 100%, 95%)', [230, 250, 255]],
        ['hsl(131.9, 100%, 95%)', [230, 255, 235]],
        ['hsl(6.754, 100%, 95%)', [255, 232, 230]],
        ['hsl(-1040, 100%, 75%)', [255, 213, 128]],
        ['hsl(1170, 22.97%, 90%)', [230, 235, 224]],
        ['hsl(-120, 100%, 50%)', [0, 0, 255]],
        ['hsl(480, 100%, 50%)', [0, 255, 0]],
        ['hsl(360, 100%, 50%)', [255, 0, 0]],
        ['hsl(-360, 100%, 50%)', [255, 0, 0]],
        ['hsl(1080, 100%, 50%)', [255, 0, 0]],
        ['hsl(725, 40%, 60%)', [194, 119, 112]],
        ['hsl(-45.5, 40%, 60%)', [194, 112, 174]],
      ]),
    ).to.deep.equal([]);
  });

  it('matches the primaries, grays and the saturation and lightness edges', () => {
    expect(
      disagreements([
        ['hsl(0, 100%, 50%)', [255, 0, 0]],
        ['hsl(60, 100%, 50%)', [255, 255, 0]],
        ['hsl(120, 100%, 50%)', [0, 255, 0]],
        ['hsl(180, 100%, 50%)', [0, 255, 255]],
        ['hsl(240, 100%, 50%)', [0, 0, 255]],
        ['hsl(300, 100%, 50%)', [255, 0, 255]],
        ['hsl(0, 0%, 0%)', [0, 0, 0]],
        ['hsl(0, 0%, 10%)', [26, 26, 26]],
        ['hsl(200, 0%, 30%)', [77, 77, 77]],
        ['hsl(0, 0%, 50%)', [128, 128, 128]],
        ['hsl(120, 0%, 70%)', [179, 179, 179]],
        ['hsl(0, 0%, 90%)', [230, 230, 230]],
        ['hsl(0, 0%, 100%)', [255, 255, 255]],
        ['hsl(300, 100%, 0%)', [0, 0, 0]],
        ['hsl(300, 100%, 100%)', [255, 255, 255]],
        ['hsl(30, 100%, 1%)', [5, 3, 0]],
        ['hsl(30, 100%, 99%)', [255, 252, 250]],
        ['hsl(200, 1%, 50%)', [126, 128, 129]],
        ['hsl(200, 100%, 25%)', [0, 85, 128]],
        ['hsl(200, 100%, 75%)', [128, 213, 255]],
      ]),
    ).to.deep.equal([]);
  });

  it('clamps saturation and lightness before converting, as the browser does', () => {
    expect(
      disagreements([
        ['hsl(0, 150%, 50%)', [255, 0, 0]],
        ['hsl(0, 50%, 150%)', [255, 255, 255]],
        ['hsl(0, -10%, 50%)', [128, 128, 128]],
        ['hsl(0, 50%, -20%)', [0, 0, 0]],
        ['hsl(0, 120.184%, 90%)', [255, 204, 204]],
      ]),
    ).to.deep.equal([]);
  });

  it('gives the same channels for every hsl() and hsla() spelling of one colour', () => {
    expect(
      disagreements([
        ['hsla(0, 100%, 95%, 0.5)', [255, 230, 230]],
        ['hsl(0 100% 95%)', [255, 230, 230]],
        ['hsl(0deg 100% 95%)', [255, 230, 230]],
        ['hsl(0 100% 95% / 50%)', [255, 230, 230]],
        ['hsl(400grad 100% 95%)', [255, 230, 230]],
        ['hsl(1turn 100% 95%)', [255, 230, 230]],
        ['hsl(0.5turn 25% 92%)', [230, 240, 240]],
        ['hsl(3.141592653589793rad 25% 92%)', [230, 240, 240]],
      ]),
    ).to.deep.equal([]);
    expect(formatColor(parseColor('hsla(0, 100%, 95%, 0.5)')!, 'hexa')).to.equal('#ffe6e680');
  });

  it('divides the percentages in double precision before narrowing them, as the browser does', () => {
    // Narrowing 68.1 to single precision first and dividing by 100 afterwards lands one step off here.
    expect(
      disagreements([
        ['hsl(-266, 68.1%, 53.9%)', [127, 217, 57]],
        ['hsl(336, 32.1%, 31.22%)', [105, 54, 75]],
      ]),
    ).to.deep.equal([]);
  });

  it('keeps the hue, the percentages and a 360 hue in the hsl text when it settles a colour on the browser bytes', () => {
    // Deriving the colour from the browser's 8-bit channels would move the hue of the first colour from
    // 5 to 15 and the 360 of the third to 0; the correction only nudges the exact hsv state.
    expect(formatColor(parseColor('hsl(5, 5%, 84%)')!, 'hsl')).to.equal('hsl(5, 5%, 84%)');
    expect(formatColor(parseColor('hsl(0, 100%, 95%)')!, 'hsl')).to.equal('hsl(0, 100%, 95%)');
    const turned = parseColor('hsl(360, 100%, 95%)')!;
    expect(turned.h).to.equal(360);
    expect(formatColor(turned, 'rgb')).to.equal('rgb(255, 230, 230)');
    expect(formatColor(turned, 'hsl')).to.equal('hsl(360, 100%, 95%)');
  });

  it('agrees with the host browser on a deterministic spread of colours that every engine resolves alike', () => {
    // Engines disagree on exact-.5 channels (and WebKit on an out-of-range saturation), so this
    // sweep keeps to in-range colours whose channels are not within 0.001 of a .5 in real
    // arithmetic; there Chromium, Firefox and WebKit all return the exactly rounded channels.
    const channelsOf = (hue: number, saturation: number, lightness: number): number[] => {
      const l = lightness / 100;
      const a = (saturation / 100) * Math.min(l, 1 - l);
      const wrapped = ((hue % 360) + 360) % 360;
      return [0, 8, 4].map((n) => {
        const k = (n + wrapped / 30) % 12;
        return (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255;
      });
    };
    const nearHalf = (value: number): boolean => Math.abs(value - Math.floor(value) - 0.5) < 0.001;
    let state = 0x2545f491;
    const next = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const texts: string[] = [];
    while (texts.length < 400) {
      const scale = next() < 0.5 ? 1 : 10;
      const hue = Math.round((next() * 1440 - 720) * scale) / scale;
      const saturation = Math.round(next() * 100 * scale) / scale;
      const lightness = Math.round(next() * 100 * scale) / scale;
      if (channelsOf(hue, saturation, lightness).some(nearHalf)) continue;
      texts.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
    }
    const probe = document.createElement('span');
    document.body.append(probe);
    const failures: string[] = [];
    try {
      for (const text of texts) {
        probe.style.color = '';
        probe.style.color = text;
        const browser = getComputedStyle(probe).color;
        const color = parseColor(text);
        const ours = color === null ? 'null' : formatColor(color, 'rgb');
        if (ours !== browser) failures.push(`${text}: got ${ours}, browser ${browser}`);
      }
    } finally {
      probe.remove();
    }
    expect(failures).to.deep.equal([]);
  });
});

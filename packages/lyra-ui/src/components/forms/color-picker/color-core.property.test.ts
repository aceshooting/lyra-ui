import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
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
  type LyraColorHsva,
} from './color-core.js';

const byte = fc.integer({ min: 0, max: 255 });
const hex2 = (value: number): string => value.toString(16).padStart(2, '0');

function parsed(text: string): LyraColorHsva {
  const color = parseColor(text);
  if (color === null) throw new Error(`parseColor rejected ${text}`);
  return color;
}

const channelsOf = (rgbText: string): number[] => (rgbText.match(/\d+/g) ?? []).map(Number);

describe('color-core properties', () => {
  it('round-trips every #rrggbb and #rrggbbaa colour exactly, in either letter case', () => {
    fc.assert(
      fc.property(byte, byte, byte, byte, (r, g, b, a) => {
        const hex = `#${hex2(r)}${hex2(g)}${hex2(b)}`;
        const hexa = `${hex}${hex2(a)}`;
        expect(formatColor(parsed(hex), 'hex')).to.equal(hex);
        expect(formatColor(parsed(hexa), 'hexa')).to.equal(hexa);
        expect(formatColor(parsed(hex.toUpperCase()), 'hex')).to.equal(hex);
      }),
      propertyRuns(),
    );
  });

  it('expands #rgb and #rgba shorthand by doubling each digit', () => {
    const nibble = fc.integer({ min: 0, max: 15 }).map((value) => value.toString(16));
    fc.assert(
      fc.property(nibble, nibble, nibble, nibble, (r, g, b, a) => {
        expect(formatColor(parsed(`#${r}${g}${b}`), 'hex')).to.equal(`#${r}${r}${g}${g}${b}${b}`);
        expect(formatColor(parsed(`#${r}${g}${b}${a}`), 'hexa')).to.equal(
          `#${r}${r}${g}${g}${b}${b}${a}${a}`,
        );
      }),
      propertyRuns(),
    );
  });

  it('round-trips rgb() and rgba() text for every 8-bit colour and two-decimal alpha, in both syntaxes', () => {
    fc.assert(
      fc.property(byte, byte, byte, fc.integer({ min: 0, max: 100 }), (r, g, b, percent) => {
        const alpha = (percent / 100).toFixed(2);
        expect(formatColor(parsed(`rgb(${r}, ${g}, ${b})`), 'rgb')).to.equal(`rgb(${r}, ${g}, ${b})`);
        expect(formatColor(parsed(`rgb(${r} ${g} ${b})`), 'rgb')).to.equal(`rgb(${r}, ${g}, ${b})`);
        expect(formatColor(parsed(`rgba(${r}, ${g}, ${b}, ${alpha})`), 'rgba')).to.equal(
          `rgba(${r}, ${g}, ${b}, ${alpha})`,
        );
        expect(formatColor(parsed(`rgb(${r} ${g} ${b} / ${percent}%)`), 'rgba')).to.equal(
          `rgba(${r}, ${g}, ${b}, ${alpha})`,
        );
      }),
      propertyRuns(),
    );
  });

  it('keeps the alpha byte within one step and the channels exact when a colour passes through rgba text', () => {
    // alphaText keeps two decimals, so hexa -> rgba -> hexa can move the alpha byte (by design). Text
    // rounding errs by at most 0.005, which is 1.275 of 255 and rounds to at most one byte.
    fc.assert(
      fc.property(byte, byte, byte, byte, (r, g, b, a) => {
        const hexa = `#${hex2(r)}${hex2(g)}${hex2(b)}${hex2(a)}`;
        const through = formatColor(parsed(formatColor(parsed(hexa), 'rgba')), 'hexa');
        expect(through.slice(0, 7)).to.equal(hexa.slice(0, 7));
        expect(Math.abs(Number.parseInt(through.slice(7), 16) - a)).to.be.at.most(1);
      }),
      propertyRuns(),
    );
  });

  it('reproduces the channels through rgb -> hsv -> rgb to within 1e-9', () => {
    fc.assert(
      fc.property(byte, byte, byte, (r, g, b) => {
        const { h, s, v } = rgbToHsv(r, g, b);
        const back = hsvToRgb(h, s, v);
        expect(Math.abs(back.r - r)).to.be.below(1e-9);
        expect(Math.abs(back.g - g)).to.be.below(1e-9);
        expect(Math.abs(back.b - b)).to.be.below(1e-9);
      }),
      propertyRuns(),
    );
  });

  it('inverts hsv <-> hsl on the valid domain', () => {
    const hue = fc.double({ min: 0, max: 360, noNaN: true });
    const percent = fc.double({ min: 0, max: 100, noNaN: true });
    fc.assert(
      fc.property(hue, percent, percent, (h, s, v) => {
        const hsl = hsvToHsl(h, s, v);
        const back = hslToHsv(hsl.h, hsl.s, hsl.l);
        expect(Math.abs(back.v - v)).to.be.below(1e-6);
        // Saturation is undefined at v = 0 (black); hue is undefined at s = 0 (gray).
        if (v > 1e-6) expect(Math.abs(back.s - s)).to.be.below(1e-4);
      }),
      propertyRuns(),
    );
  });

  it('survives a switch through hexa text without drift and keeps every component normalized', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e4, max: 1e4, noNaN: true }),
        fc.double({ min: -50, max: 150, noNaN: true }),
        fc.double({ min: -50, max: 150, noNaN: true }),
        fc.double({ min: -1, max: 2, noNaN: true }),
        (h, s, v, a) => {
          const color = hsva(h, s, v, a);
          expect(sameColor(color, parsed(formatColor(color, 'hexa')))).to.equal(true);
          expect(color.h).to.be.within(0, 360);
          expect(color.s).to.be.within(0, 100);
          expect(color.v).to.be.within(0, 100);
          expect(color.a).to.be.within(0, 1);
          expect(cssColor(color)).to.match(/^rgba\(\d{1,3}, \d{1,3}, \d{1,3}, [01]\.\d\d\)$/);
        },
      ),
      propertyRuns(),
    );
  });

  it('never throws, and returns null or a fully normalized finite colour, for arbitrary text', () => {
    const tokenish = fc.oneof(
      fc.string({ maxLength: 40 }),
      fc.stringMatching(/^[a-z]{0,6}\([-+0-9.%a-z,\s/]{0,40}\)$/),
      fc.stringMatching(/^#[0-9a-fA-F]{0,10}$/),
    );
    fc.assert(
      fc.property(tokenish, (text) => {
        const color = parseColor(text);
        if (color === null) return;
        for (const component of [color.h, color.s, color.v, color.a]) {
          expect(Number.isFinite(component), JSON.stringify(text)).to.equal(true);
        }
        expect(color.h).to.be.within(0, 360);
        expect(color.s).to.be.within(0, 100);
        expect(color.v).to.be.within(0, 100);
        expect(color.a).to.be.within(0, 1);
      }),
      propertyRuns(),
    );
  });

  it('parses or rejects very long adversarial text in linear time', () => {
    // The digit/space/dot runs below are the shapes that made the number and angle patterns
    // backtrack polynomially; a regression takes seconds here, a linear scan about a millisecond.
    const piece = fc.constantFrom('1', '1 ', '1.', '1,', '.1', ' ', '1%', '1/', '+', '-');
    const head = fc.constantFrom('rgb(', 'hsl(', 'hsva(', 'rgba(', '#', '');
    const tail = fc.constantFrom('', 'x', '.', '%', ')', ' )');
    fc.assert(
      fc.property(head, piece, fc.integer({ min: 4000, max: 30000 }), tail, (prefix, unit, copies, suffix) => {
        const input = `${prefix}${unit.repeat(copies)}${suffix}`;
        const started = performance.now();
        parseColor(input);
        expect(performance.now() - started).to.be.below(1000);
      }),
      propertyRuns(40),
    );
  });
});

// ---------------------------------------------------------------------------------------------
// hsl() against an independent reference.
//
// The reference below shares no arithmetic with color-core.ts: it works in exact rational numbers
// on BigInt, and models the browser's single precision by rounding the exact result of each
// binary32 operation once (round to nearest, ties to even) instead of using Math.fround.
// ---------------------------------------------------------------------------------------------

/** An exact rational `n / d` with `d > 0n`. */
interface Ratio {
  readonly n: bigint;
  readonly d: bigint;
}

const ratio = (n: bigint, d = 1n): Ratio => (d < 0n ? { n: -n, d: -d } : { n, d });
const ZERO = ratio(0n);
const ONE = ratio(1n);
const HALF = ratio(1n, 2n);

const add = (a: Ratio, b: Ratio): Ratio => ratio(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Ratio, b: Ratio): Ratio => ratio(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Ratio, b: Ratio): Ratio => ratio(a.n * b.n, a.d * b.d);
const div = (a: Ratio, b: Ratio): Ratio => ratio(a.n * b.d, a.d * b.n);
const compare = (a: Ratio, b: Ratio): number => {
  const left = a.n * b.d;
  const right = b.n * a.d;
  return left < right ? -1 : left > right ? 1 : 0;
};
const abs = (a: Ratio): Ratio => ratio(a.n < 0n ? -a.n : a.n, a.d);
const smaller = (a: Ratio, b: Ratio): Ratio => (compare(a, b) <= 0 ? a : b);
const larger = (a: Ratio, b: Ratio): Ratio => (compare(a, b) >= 0 ? a : b);
const floorOf = (a: Ratio): bigint => (a.n >= 0n ? a.n / a.d : -((-a.n + a.d - 1n) / a.d));
const bitLength = (value: bigint): number => value.toString(2).length;

/** Every finite double is a dyadic rational; this recovers it exactly. */
function fromDouble(value: number): Ratio {
  let scaled = value;
  let shift = 0n;
  while (!Number.isInteger(scaled)) {
    scaled *= 2;
    shift += 1n;
  }
  return ratio(BigInt(scaled), 1n << shift);
}

/** Correct round-to-nearest-even of an exact rational to the 24-bit significand of IEEE binary32. */
function binary32(value: Ratio): Ratio {
  if (value.n === 0n) return ZERO;
  const negative = value.n < 0n;
  const numerator = negative ? -value.n : value.n;
  let exponent = bitLength(numerator) - bitLength(value.d) - 24;
  let scaledN = exponent >= 0 ? numerator : numerator << BigInt(-exponent);
  let scaledD = exponent >= 0 ? value.d << BigInt(exponent) : value.d;
  if (scaledN >= scaledD << 24n) {
    exponent += 1;
    scaledD <<= 1n;
  } else if (scaledN < scaledD << 23n) {
    exponent -= 1;
    scaledN <<= 1n;
  }
  let significand = scaledN / scaledD;
  const twiceRemainder = 2n * (scaledN % scaledD);
  if (twiceRemainder > scaledD || (twiceRemainder === scaledD && (significand & 1n) === 1n)) {
    significand += 1n;
  }
  const rounded =
    exponent >= 0 ? ratio(significand << BigInt(exponent)) : ratio(significand, 1n << BigInt(-exponent));
  return negative ? ratio(-rounded.n, rounded.d) : rounded;
}

/**
 * The channels (0-255, exact, unrounded) CSS Color 4 gives an hsl() colour, in rational arithmetic
 * with no binary32 rounding anywhere. Saturation and lightness are clamped to 0-100%.
 */
function exactChannels(hue: number, saturation: number, lightness: number): Ratio[] {
  const hundred = ratio(100n);
  const turn = ratio(360n);
  const clamp01 = (value: Ratio): Ratio => larger(ZERO, smaller(ONE, value));
  const hueRatio = fromDouble(hue);
  const wrapped = sub(hueRatio, mul(turn, ratio(floorOf(div(hueRatio, turn)))));
  const s = clamp01(div(fromDouble(saturation), hundred));
  const l = clamp01(div(fromDouble(lightness), hundred));
  const a = mul(s, smaller(l, sub(ONE, l)));
  const hueOver30 = div(wrapped, ratio(30n));
  return [0n, 8n, 4n].map((n) => {
    const x = add(ratio(n), hueOver30);
    const k = sub(x, mul(ratio(12n), ratio(floorOf(div(x, ratio(12n))))));
    const t = larger(ratio(-1n), smaller(smaller(sub(k, ratio(3n)), sub(ratio(9n), k)), ONE));
    return mul(sub(l, mul(a, t)), ratio(255n));
  });
}

/**
 * The 8-bit channels Chromium reports for the same colour. gfx::HSLToSRGB runs every step in
 * binary32; the legacy serializer then adds a binary32 1e-7, multiplies by 255 and rounds half up.
 * The hue is wrapped in double precision before it becomes a float, and saturation and lightness are
 * percent / 100 in double precision, clamped to 0-1.
 */
function chromiumChannels(hue: number, saturation: number, lightness: number): number[] {
  const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
  const h = binary32(fromDouble(((hue % 360) + 360) % 360));
  const s = binary32(fromDouble(clamp01(saturation / 100)));
  const l = binary32(fromDouble(clamp01(lightness / 100)));
  const epsilon = binary32(fromDouble(1e-7));
  const twelve = ratio(12n);
  return [0n, 8n, 4n].map((n) => {
    let value = l;
    if (s.n !== 0n) {
      const x = binary32(add(ratio(n), binary32(div(h, ratio(30n)))));
      const k = compare(x, twelve) >= 0 ? sub(x, twelve) : x;
      const a = binary32(mul(s, smaller(l, binary32(sub(ONE, l)))));
      const t = larger(
        ratio(-1n),
        smaller(smaller(binary32(sub(k, ratio(3n))), binary32(sub(ratio(9n), k))), ONE),
      );
      value = binary32(sub(l, binary32(mul(a, t))));
    }
    const scaled = binary32(mul(binary32(add(value, epsilon)), ratio(255n)));
    const clamped = larger(ZERO, smaller(ratio(255n), scaled));
    return Number(floorOf(add(clamped, HALF)));
  });
}

describe('color-core hsl() conversion against an independent reference', () => {
  const degrees = fc.integer({ min: -720, max: 720 });
  const percent = fc.integer({ min: 0, max: 100 });
  // A channel is exactly .5 only for round percentages (255 * x / 100 needs lightness and saturation
  // in fives, most often quarters and fifths), and a uniform draw from the fixed seed almost never
  // lands on one. Weighting those families keeps the property able to see the ties it exists for.
  const fives = fc.constantFrom(...Array.from({ length: 21 }, (_, step) => step * 5));
  const quarters = fc.constantFrom(0, 25, 50, 75, 100);
  const fifths = fc.constantFrom(0, 20, 40, 60, 80, 100);
  const hueInFives = fc.integer({ min: -144, max: 144 }).map((step) => step * 5);
  const wholeColour = fc.oneof(
    { weight: 1, arbitrary: fc.tuple(degrees, percent, percent) },
    { weight: 1, arbitrary: fc.tuple(hueInFives, fives, fives) },
    { weight: 2, arbitrary: fc.tuple(hueInFives, quarters, fifths) },
  );
  // Fractional hues and percentages, including saturation and lightness a little outside 0-100%.
  // Round percentages with a fractional hue still tie, because a channel on a flat stretch of the hue
  // wheel does not depend on the hue.
  const tenths = (min: number, max: number): fc.Arbitrary<number> =>
    fc.integer({ min: min * 10, max: max * 10 }).map((value) => value / 10);
  const fractionalColour = fc.oneof(
    { weight: 1, arbitrary: fc.tuple(tenths(-1080, 1080), tenths(-5, 105), tenths(-5, 105)) },
    { weight: 2, arbitrary: fc.tuple(tenths(-1080, 1080), quarters, fifths) },
  );

  function bytesOfParsed(text: string): number[] {
    return channelsOf(formatColor(parsed(text), 'rgb'));
  }

  function agreesWithReference(hue: number, saturation: number, lightness: number): void {
    const text = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    const got = bytesOfParsed(text);
    expect(got, text).to.deep.equal(chromiumChannels(hue, saturation, lightness));
    // Cross-check the reference itself against plain exact arithmetic: away from a tie there is
    // only one correct byte, so the single-precision model must agree with the exactly rounded one.
    exactChannels(hue, saturation, lightness).forEach((exact, index) => {
      const distanceFromTie = abs(sub(sub(exact, ratio(floorOf(exact))), HALF));
      if (compare(distanceFromTie, ratio(1n, 1000n)) < 0) return;
      expect(got[index], `${text} channel ${index}`).to.equal(Number(floorOf(add(exact, HALF))));
    });
  }

  it('gives the channels the browser shows for whole-number hsl() colours', () => {
    fc.assert(
      fc.property(wholeColour, ([hue, saturation, lightness]) => {
        agreesWithReference(hue, saturation, lightness);
      }),
      propertyRuns(),
    );
  });

  it('gives the channels the browser shows for fractional, negative and over-turn hsl() colours', () => {
    fc.assert(
      fc.property(fractionalColour, ([hue, saturation, lightness]) => {
        agreesWithReference(hue, saturation, lightness);
      }),
      propertyRuns(),
    );
  });

  it('writes a whole-number hsl() colour back unchanged when the format is hsl', () => {
    const wrapped = (hue: number): number => (hue === 360 ? 360 : ((hue % 360) + 360) % 360);
    fc.assert(
      fc.property(
        wholeColour.filter(([, saturation, lightness]) => saturation > 0 && lightness > 0 && lightness < 100),
        ([hue, saturation, lightness]) => {
          const text = formatColor(parsed(`hsl(${hue}, ${saturation}%, ${lightness}%)`), 'hsl');
          expect(text).to.equal(`hsl(${wrapped(hue)}, ${saturation}%, ${lightness}%)`);
        },
      ),
      propertyRuns(),
    );
  });

  it('keeps the parsed hsv state within a hair of the plain conversion', () => {
    // The browser-matching correction moves a color by a billionth of a percent, far less than one
    // 8-bit step, so the precision the picker drags from is the plain hsl -> hsv conversion. The
    // bounds are about a thousand times what a correction needs and far below what a step would.
    fc.assert(
      fc.property(wholeColour, ([hue, saturation, lightness]) => {
        const text = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        const state = parsed(text);
        const plain = hslToHsv(hue, saturation, lightness);
        expect(Math.abs(state.s - plain.s), `s of ${text}`).to.be.below(1e-6);
        expect(Math.abs(state.v - plain.v), `v of ${text}`).to.be.below(1e-6);
        const hueGap = Math.abs(state.h - plain.h);
        // Hue is only defined with some chroma; below one percent of full scale it is not compared.
        if ((plain.s * plain.v) / 100 > 1) {
          expect(Math.min(hueGap, 360 - hueGap), `h of ${text}`).to.be.below(1e-5);
        }
      }),
      propertyRuns(),
    );
  });
});

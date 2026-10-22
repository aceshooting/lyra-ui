import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { createAnsiParser, type AnsiSegment } from './ansi.js';

// Terminal output is assembled from plain-data fragments: text (multi-byte and right-to-left
// included), well-formed SGR, CSI, string and nF escapes, and deliberately truncated or stray
// escape pieces that a killed process or an interleaved stream can leave behind.
const text = fc.constantFrom('hello', ' ', 'wörld', 'عربي', '日本', '😀', 'x\ny', '\r\n', '\t', '\b');
const sgr = fc.constantFrom(
  '\x1b[0m', '\x1b[m', '\x1b[1m', '\x1b[2m', '\x1b[3m', '\x1b[4m', '\x1b[7m', '\x1b[22m', '\x1b[31m',
  '\x1b[1;32m', '\x1b[91m', '\x1b[38;5;196m', '\x1b[38;5;5m', '\x1b[48;5;232m', '\x1b[38;2;10;20;30m',
  '\x1b[48;2;255;255;255m', '\x1b[39m', '\x1b[49m', '\x1b[;m', '\x1b[1;;31m', '\x1b[38;5m',
  '\x1b[38;2;1;2m', '\x1b[999m',
);
const csi = fc.constantFrom(
  '\x1b[K', '\x1b[0K', '\x1b[1K', '\x1b[2K', '\x1b[3K', '\x1b[2J', '\x1b[H', '\x1b[10;20H', '\x1b[?25l',
  '\x1b[?25h', '\x1b[1A',
);
const terminatedStrings = fc.constantFrom(
  '\x1b]0;title\x07', '\x1b]8;;http://example.com\x1b\\', '\x1b]8;;\x1b\\', '\x1bP1$r\x1b\\', '\x1b_apc\x1b\\',
  '\x1b^pm\x1b\\', '\x1bX sos\x1b\\',
);
const shortEscapes = fc.constantFrom('\x1b(B', '\x1b)0', '\x1b7', '\x1b8', '\x1b=', '\x1b>', '\x1bc', '\x1b#8');
const strayFragments = fc.constantFrom(
  '\x1b', '\x1b[', '\x1b[3', '\x1b[38;5', '\x1b]', '\x1b]0;unterminated', '\x1bP', '\x1b_', '\x1b^', '\x1bX',
  '\x1b[?', '\x9b31m', '\x18', '\x1a', '\x07', '\\',
);
const piece = fc.oneof(
  { weight: 6, arbitrary: text },
  { weight: 6, arbitrary: sgr },
  { weight: 2, arbitrary: csi },
  { weight: 2, arbitrary: terminatedStrings },
  { weight: 2, arbitrary: shortEscapes },
  { weight: 2, arbitrary: strayFragments },
  { weight: 1, arbitrary: fc.string({ maxLength: 6 }) },
);
const output = fc.array(piece, { maxLength: 30 }).map((pieces) => pieces.join(''));

/** One entry per rendered character (and per erase-in-line) so segment boundaries do not matter. */
function flatten(segments: readonly AnsiSegment[]): string[] {
  const entries: string[] = [];
  for (const { text: segmentText, styles, eraseLine } of segments) {
    const style = JSON.stringify([
      styles.bold,
      styles.dim,
      styles.italic,
      styles.underline,
      styles.inverse,
      styles.fg ?? null,
      styles.bg ?? null,
    ]);
    if (eraseLine !== undefined) entries.push(`erase${eraseLine}|${style}`);
    for (const character of segmentText) entries.push(`${character}|${style}`);
  }
  return entries;
}

function streamed(chunks: readonly string[]): string[] {
  const parser = createAnsiParser();
  return chunks.flatMap((chunk) => flatten(parser.push(chunk)));
}

/** Splits at code-point boundaries only: a stream decoder never hands over half a surrogate pair. */
function splitAtCodePoints(input: string, cuts: readonly number[]): string[] {
  const boundaries: number[] = [];
  let offset = 0;
  for (const character of input) {
    boundaries.push(offset);
    offset += character.length;
  }
  boundaries.push(offset);
  const points = [...new Set(cuts.map((cut) => boundaries[cut % boundaries.length] ?? 0))].sort((a, b) => a - b);
  const chunks: string[] = [];
  let start = 0;
  for (const point of points) {
    chunks.push(input.slice(start, point));
    start = point;
  }
  chunks.push(input.slice(start));
  return chunks;
}

const visibleText = (segments: readonly AnsiSegment[]) => segments.map((segment) => segment.text).join('');

function isSubsequence(candidate: string, input: string): boolean {
  let from = 0;
  for (const character of candidate) {
    from = input.indexOf(character, from);
    if (from < 0) return false;
    from += character.length;
  }
  return true;
}

describe('createAnsiParser properties', () => {
  it('yields the same styled characters and erase events for every chunk split', () => {
    fc.assert(
      fc.property(output, fc.array(fc.nat(), { maxLength: 8 }), (input, cuts) => {
        const chunks = splitAtCodePoints(input, cuts);
        expect(streamed(chunks), `chunks ${JSON.stringify(chunks)}`).to.deep.equal(flatten(createAnsiParser().push(input)));
      }),
      propertyRuns(),
    );
  });

  it('streams one character at a time exactly like a single push', () => {
    fc.assert(
      fc.property(output, (input) => {
        expect(streamed([...input]), JSON.stringify(input)).to.deep.equal(flatten(createAnsiParser().push(input)));
      }),
      propertyRuns(),
    );
  });

  it('never leaks an ESC and renders only characters that were in the input, in order', () => {
    fc.assert(
      fc.property(output, (input) => {
        const visible = visibleText(createAnsiParser().push(input));
        const label = `${JSON.stringify(visible)} from ${JSON.stringify(input)}`;
        expect(visible.includes('\x1b'), `ESC leaked: ${label}`).to.equal(false);
        expect(isSubsequence(visible, input), `not a subsequence of the input: ${label}`).to.equal(true);
      }),
      propertyRuns(),
    );
  });

  it('passes text without an ESC through unchanged with default styles', () => {
    const plain = fc
      .array(fc.oneof(fc.string({ maxLength: 8 }), text, fc.constantFrom('é', 'ß', '中', '🙂')), { maxLength: 12 })
      .map((parts) => parts.join(''));
    fc.assert(
      fc.property(plain, (input) => {
        const segments = createAnsiParser().push(input);
        expect(visibleText(segments)).to.equal(input);
        for (const { styles, eraseLine } of segments) {
          expect(
            [
              styles.bold,
              styles.dim,
              styles.italic,
              styles.underline,
              styles.inverse,
              styles.fg,
              styles.bg,
              eraseLine,
            ],
            JSON.stringify(input),
          ).to.deep.equal([false, false, false, false, false, undefined, undefined, undefined]);
        }
      }),
      propertyRuns(),
    );
  });

  it('returns to its pristine state on reset()', () => {
    fc.assert(
      fc.property(output, output, (first, second) => {
        const parser = createAnsiParser();
        parser.push(first);
        parser.reset();
        expect(flatten(parser.push(second)), `${JSON.stringify(first)} then ${JSON.stringify(second)}`).to.deep.equal(
          flatten(createAnsiParser().push(second)),
        );
      }),
      propertyRuns(),
    );
  });

  it('also forgets a discarded overlong sequence on reset()', () => {
    const overlong = fc.constantFrom('\x1b]0;', '\x1bP', '\x1b_', '\x1b^', '\x1bX', '\x1b[1;');
    fc.assert(
      fc.property(overlong, fc.integer({ min: 4_100, max: 6_000 }), output, (opener, length, after) => {
        const parser = createAnsiParser();
        parser.push(opener + '1'.repeat(length));
        parser.reset();
        const label = `${JSON.stringify(opener)} x ${length} then ${JSON.stringify(after)}`;
        expect(flatten(parser.push(after)), label).to.deep.equal(flatten(createAnsiParser().push(after)));
      }),
      propertyRuns(),
    );
  });

  it('cannot be silenced by an unterminated string sequence: later independent output survives', () => {
    const opening = fc.constantFrom('\x1b]0;t', '\x1bP', '\x1b_', '\x1b^', '\x1bX');
    // Payload lengths sit on both sides of the 4,096-unit carry ceiling, so the string is held in the
    // carry for some inputs and discarded for others. Every unit is one UTF-16 code unit.
    const payloadLength = fc.oneof(
      { withCrossShrink: true },
      fc.integer({ min: 0, max: 64 }),
      fc.integer({ min: 4_085, max: 4_105 }),
    );
    const payloadUnit = fc.constantFrom('x', '0;1;2', '日本', '\\', '[');
    // What ends the string. A fresh escape starts a sequence that must still take effect; ST, BEL, CAN
    // and SUB are consumed together with the string.
    const ending = fc.constantFrom(
      { bytes: '\x1b[0m', consumed: false },
      { bytes: '\x1b[31m', consumed: false },
      { bytes: '\x1b(B', consumed: false },
      { bytes: '\x1b7', consumed: false },
      { bytes: '\x1b\\', consumed: true },
      { bytes: '\x07', consumed: true },
      { bytes: '\x18', consumed: true },
      { bytes: '\x1a', consumed: true },
    );
    const remainder = fc.constantFrom('after', 'ok', 'tail text');
    fc.assert(
      fc.property(opening, payloadUnit, payloadLength, ending, remainder, (open, unit, length, end, rest) => {
        const unterminated = open + unit.repeat(Math.ceil(length / unit.length));
        const input = unterminated + end.bytes + rest;
        // The unterminated string must leave no trace: the output is that of the independent tail alone.
        const expected = flatten(createAnsiParser().push((end.consumed ? '' : end.bytes) + rest));
        const windowStart = unterminated.length - 2;
        const windowEnd = unterminated.length + end.bytes.length + 2;
        // The unsplit input, every two-chunk split from inside the payload to past the ending (which
        // tears an ESC from its partner), and that window streamed one character at a time.
        const chunkings = [[input]];
        for (let cut = windowStart; cut < windowEnd; cut++) chunkings.push([input.slice(0, cut), input.slice(cut)]);
        chunkings.push([input.slice(0, windowStart), ...input.slice(windowStart, windowEnd), input.slice(windowEnd)]);
        for (const chunks of chunkings) {
          expect(
            streamed(chunks),
            `${JSON.stringify(rest)} changed by ${length} payload units of ${JSON.stringify(open)} ended by ` +
              `${JSON.stringify(end.bytes)}, chunk lengths ${chunks.map((chunk) => chunk.length).join('+')}`,
          ).to.deep.equal(expected);
        }
      }),
      propertyRuns(),
    );
  });
});

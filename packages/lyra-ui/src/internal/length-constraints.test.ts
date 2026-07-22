import { expect } from '@open-wc/testing';
import { lengthViolations } from './length-constraints.js';

it('reports no violation when neither limit is set, however long the value', () => {
  const long = 'x'.repeat(5000);
  expect(lengthViolations(long, undefined, undefined)).to.deep.equal({ tooShort: false, tooLong: false });
  expect(lengthViolations('', undefined, undefined)).to.deep.equal({ tooShort: false, tooLong: false });
});

it('flags a value longer than maxlength, and treats exactly maxlength as valid', () => {
  expect(lengthViolations('abcd', undefined, 3).tooLong).to.equal(true);
  expect(lengthViolations('abc', undefined, 3).tooLong).to.equal(false);
  expect(lengthViolations('ab', undefined, 3).tooLong).to.equal(false);
});

it('flags a value shorter than minlength, and treats exactly minlength as valid', () => {
  expect(lengthViolations('ab', 3, undefined).tooShort).to.equal(true);
  expect(lengthViolations('abc', 3, undefined).tooShort).to.equal(false);
  expect(lengthViolations('abcd', 3, undefined).tooShort).to.equal(false);
});

it('never reports an empty value as tooShort, matching native minlength', () => {
  // The platform applies minlength only to a non-empty value -- an optional field left blank
  // stays valid, and `required` is what rejects empty. A naive `length < minlength` would
  // wrongly flag '' here.
  expect(lengthViolations('', 5, undefined).tooShort).to.equal(false);
  expect(lengthViolations('', 5, 10)).to.deep.equal({ tooShort: false, tooLong: false });
});

it('counts UTF-16 code units, so one astral character counts twice — as the platform counts it', () => {
  // The HTML spec measures minlength/maxlength in "code-unit length", NOT code points, so a
  // surrogate pair counts as 2. Verified empirically in Chromium: `<input maxlength="3">` given
  // two thumbs-up keeps only one (4 code units > 3); `<input maxlength="2">` holding one
  // thumbs-up refuses a following 'x' (2 + 1 > 2); and `<input minlength="2">` holding one
  // thumbs-up reports tooShort === false. Code-point counting contradicts all three, and the
  // OR-with-native bridge in input/textarea depends on this helper agreeing with the control.
  const thumb = '👍';
  expect(thumb.length).to.equal(2);
  // One emoji already satisfies minlength=2 (2 code units), and overflows maxlength=1.
  expect(lengthViolations(thumb, 2, undefined).tooShort).to.equal(false);
  expect(lengthViolations(thumb, undefined, 1).tooLong).to.equal(true);
  expect(lengthViolations(thumb, undefined, 2).tooLong).to.equal(false);
  // Two emoji are 4 code units: over maxlength=3, and comfortably over minlength=2.
  expect(lengthViolations(`${thumb}${thumb}`, undefined, 3).tooLong).to.equal(true);
  expect(lengthViolations(`${thumb}${thumb}`, undefined, 4).tooLong).to.equal(false);
  expect(lengthViolations(`${thumb}${thumb}`, 2, undefined).tooShort).to.equal(false);
  // Below minlength=3 a single emoji is fine (2 < 3 -> tooShort), matching native.
  expect(lengthViolations(thumb, 3, undefined).tooShort).to.equal(true);
});

it('counts an unpaired surrogate as one code unit rather than dropping it', () => {
  // A lone high surrogate (no low surrogate follows) is a single code unit, so a truncated or
  // pasted fragment still counts toward maxlength and cannot slip past it.
  const lone = '\ud83d';
  expect(lone.length).to.equal(1);
  expect(lengthViolations(lone, undefined, 0).tooLong).to.equal(true);
  expect(lengthViolations(lone, undefined, 1).tooLong).to.equal(false);
  expect(lengthViolations(`a${lone}`, undefined, 1).tooLong).to.equal(true);
});

it('ignores a limit that is not a non-negative integer, matching the platform parsing rules', () => {
  // Native minlength/maxlength use the "rules for parsing non-negative integers"; anything else
  // is ignored outright rather than constraining (or throwing).
  for (const bad of [NaN, -1, -5, 1.5, Number.POSITIVE_INFINITY]) {
    expect(lengthViolations('abcdef', undefined, bad), `maxlength ${bad}`).to.deep.equal({
      tooShort: false,
      tooLong: false,
    });
    expect(lengthViolations('a', bad, undefined), `minlength ${bad}`).to.deep.equal({
      tooShort: false,
      tooLong: false,
    });
  }
});

it('honors a zero maxlength and a zero minlength', () => {
  // 0 is a legal non-negative integer: maxlength="0" admits only the empty value, while
  // minlength="0" can never be violated.
  expect(lengthViolations('a', undefined, 0).tooLong).to.equal(true);
  expect(lengthViolations('', undefined, 0).tooLong).to.equal(false);
  expect(lengthViolations('', 0, undefined).tooShort).to.equal(false);
  expect(lengthViolations('a', 0, undefined).tooShort).to.equal(false);
});

it('evaluates both bounds independently when they are set together', () => {
  expect(lengthViolations('ab', 3, 6)).to.deep.equal({ tooShort: true, tooLong: false });
  expect(lengthViolations('abcd', 3, 6)).to.deep.equal({ tooShort: false, tooLong: false });
  expect(lengthViolations('abcdefg', 3, 6)).to.deep.equal({ tooShort: false, tooLong: true });
});

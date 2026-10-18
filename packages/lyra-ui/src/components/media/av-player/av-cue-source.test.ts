import { expect } from '@open-wc/testing';
import { captureActiveCue, captureCueLocation, captureCueSource, captureSourceCue } from './av-cue-source.js';

const cue = { cueId: 'a', start: 2, end: 5, text: 'Text', speaker: 'Speaker' };
const source = { revision: 1, count: 10, getCue: () => cue, findCue: () => null,
  activeAt: () => ({ index: 0, cue, validFrom: 2, validUntil: 5 }), search: () => ({ count: 0, getMatch: () => ({ index: 0, cue }) }) };

it('captures own provider methods and immutable bounded cue records', () => {
  const accepted = captureSourceCue(cue);
  expect(accepted).to.deep.equal(cue);
  expect(Object.isFrozen(accepted)).to.equal(true);
  const bound = captureCueSource(source);
  source.getCue = () => ({ ...cue, text: 'changed' });
  expect(bound.getCue(0, { signal: new AbortController().signal })).to.deep.equal(cue);
});

it('rejects accessors, inherited fields, malformed metadata and oversized records without coercion', () => {
  let reads = 0;
  const accessor = { ...cue, get text() { reads++; return 'text'; } };
  expect(() => captureSourceCue(accessor)).to.throw();
  expect(reads).to.equal(0);
  for (const value of [Object.create(cue), null, { ...cue, cueId: ' a ' }, { ...cue, cueId: '' },
    { ...cue, cueId: 'a'.repeat(257) }, { ...cue, start: NaN }, { ...cue, start: -1 },
    { ...cue, end: 1 }, { ...cue, end: Infinity }, { ...cue, text: 'a'.repeat(100001) },
    { ...cue, speaker: 'a'.repeat(4097) }]) expect(() => captureSourceCue(value)).to.throw();
  for (const value of [{ ...source, count: 0.1 }, { ...source, revision: '' }, { ...source, getCue: null },
    { ...source, get count() { reads++; return 10; } }]) expect(() => captureCueSource(value)).to.throw();
  expect(reads).to.equal(0);
});

it('validates explicit no-active intervals and absolute source timestamps', () => {
  expect(captureActiveCue({ index: null, cue: null, validFrom: -Infinity, validUntil: Infinity }, 10, 100).index).to.equal(null);
  expect(captureActiveCue({ index: 9, cue, validFrom: 2, validUntil: 5 }, 10, 3).index).to.equal(9);
  for (const value of [
    { index: null, cue, validFrom: 2, validUntil: 5 },
    { index: 10, cue, validFrom: 2, validUntil: 5 },
    { index: 0, cue, validFrom: NaN, validUntil: 5 },
    { index: 0, cue, validFrom: 5, validUntil: 2 },
    { index: 0, cue, validFrom: 4, validUntil: 5 },
    { index: 0, cue: { ...cue, start: 4 }, validFrom: 2, validUntil: 5 },
  ]) expect(() => captureActiveCue(value, 10, 3)).to.throw();
  expect(() => captureCueLocation({ index: -1, cue }, 10)).to.throw();
});

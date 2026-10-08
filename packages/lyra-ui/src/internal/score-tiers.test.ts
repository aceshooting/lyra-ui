import { expect } from '@open-wc/testing';
import { resolveScoreTiers } from './score-tiers.js';

describe('resolveScoreTiers', () => {
  const defaults = { high: 0.75, medium: 0.5 };

  it('falls back to the defaults for a missing or partial input', () => {
    expect(resolveScoreTiers(defaults, undefined)).to.deep.equal(defaults);
    expect(resolveScoreTiers(defaults, { high: 0.9 })).to.deep.equal({ high: 0.9, medium: 0.5 });
  });

  it('ignores non-finite values', () => {
    expect(resolveScoreTiers(defaults, { high: Number.NaN, medium: Infinity })).to.deep.equal(defaults);
  });

  it('reorders an inverted pair so the high tier stays the larger bound', () => {
    expect(resolveScoreTiers(defaults, { high: 0.5, medium: 0.8 })).to.deep.equal({ high: 0.8, medium: 0.5 });
  });
});

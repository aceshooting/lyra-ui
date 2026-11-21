import { expect } from '@open-wc/testing';
import { maxPairedAnimationEndMs } from './highlight-layer-timing.js';

describe('maxPairedAnimationEndMs', () => {
  it('pairs names with cycling durations and delays and skips none', () => {
    expect(maxPairedAnimationEndMs('a, none, b', '1s, 500ms', '0s, 0s, 250ms')).to.equal(1250);
    expect(maxPairedAnimationEndMs('none', '5s', '5s')).to.equal(0);
    expect(maxPairedAnimationEndMs('NONE, a', '2s', '-1s')).to.equal(1000);
  });

  it('clamps negative durations and tolerates empty lists', () => {
    expect(maxPairedAnimationEndMs('a', '-2s', '0s')).to.equal(0);
    expect(maxPairedAnimationEndMs('', '', '')).to.equal(0);
    expect(maxPairedAnimationEndMs('a', '', '')).to.equal(0);
  });
});

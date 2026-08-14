import { expect } from '@open-wc/testing';
import { durationMessageValue } from './duration.js';

it('normalizes every duration boundary through one side-effect-free value model', () => {
  expect(durationMessageValue(820)).to.deep.equal({ key: 'durationMilliseconds', value: 820 });
  expect(durationMessageValue(1500)).to.deep.equal({ key: 'durationSeconds', value: 1.5 });
  expect(durationMessageValue(2000)).to.deep.equal({ key: 'durationSeconds', value: 2 });
  expect(durationMessageValue(-20)).to.deep.equal({ key: 'durationMilliseconds', value: 0 });
  expect(durationMessageValue(Number.NaN)).to.deep.equal({ key: 'durationMilliseconds', value: 0 });
});

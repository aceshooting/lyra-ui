import { expect } from '@open-wc/testing';
import { maxCssTime, parseCssTime, parseCssTimeToken } from './css-motion-time.js';

it('parses computed CSS times with the existing permissive unit rule', () => {
  for (const [input, expected] of [
    ['0ms', 0],
    [' 1.5ms ', 1.5],
    ['.25s', 250],
    [' -0.02s ', -20],
    ['', 0],
    ['invalid', 0],
    ['Infinitys', 0],
    ['12px', 0],
  ] as const) {
    expect(parseCssTime(input)).to.equal(expected);
  }
});

it('takes independent zero-floored maxima from duration and delay lists', () => {
  expect(maxCssTime('0ms, .2s, 17ms')).to.equal(200);
  expect(maxCssTime('invalid, -12ms, -0.2s')).to.equal(0);
  expect(maxCssTime('.1s, .3s') + maxCssTime('.4s, 0ms')).to.equal(700);
  expect(maxCssTime('')).to.equal(0);
});

it('parses a leading authored time token with sign, exponent and either unit case', () => {
  expect(parseCssTimeToken('.2S')).to.deep.equal({ ms: 200, rest: '' });
  expect(parseCssTimeToken(' +1.5E1ms ease-out ')).to.deep.equal({ ms: 15, rest: 'ease-out' });
  expect(parseCssTimeToken('-20ms')).to.deep.equal({ ms: -20, rest: '' });
  for (const bad of ['', 'ms', '1', '1px', '1e999s', 'ease 1s', '1sx']) expect(parseCssTimeToken(bad), bad).to.equal(undefined);
});

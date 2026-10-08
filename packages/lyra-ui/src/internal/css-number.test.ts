import { expect } from '@open-wc/testing';
import { CSS_NUMBER_SOURCE } from './css-number.js';

it('matches exactly the signed CSS numbers other grammars embed it for', () => {
  const number = new RegExp(`^${CSS_NUMBER_SOURCE}$`);
  for (const valid of ['1', '-1.5', '+.5', '0.25', '12']) expect(number.test(valid), valid).to.equal(true);
  for (const invalid of ['', '.', '1.', '1e3', '--1', '1px']) expect(number.test(invalid), invalid).to.equal(false);
});

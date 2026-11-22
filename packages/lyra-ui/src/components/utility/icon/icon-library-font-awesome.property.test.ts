import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { createFontAwesomeIconResolver } from './icon-library-font-awesome.js';

const resolvers = [
  createFontAwesomeIconResolver(),
  createFontAwesomeIconResolver({ kitCode: 'kit1' }),
  createFontAwesomeIconResolver({ basePath: '/fa' }),
];
const SAFE_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

it('either refuses or yields one icon file under a fixed folder, with no injected path or query', () => {
  fc.assert(fc.property(
    fc.nat(2),
    fc.oneof(fc.string(), fc.constantFrom('house', 'fa-house', 'arrow-up-1-9', 'github')),
    fc.oneof(fc.string(), fc.constantFrom('', 'classic', 'brands', 'duotone', 'sharp-duotone', 'jelly-duo', 'utility')),
    fc.oneof(fc.string(), fc.constantFrom('', 'solid', 'regular', 'light', 'thin', 'semibold')),
    (index, name, family, variant) => {
    let url: string;
    try {
      url = resolvers[index]!(name, family, variant) as string;
    } catch (error) {
      expect(error instanceof RangeError).to.equal(true);
      return;
    }
    const parsed = new URL(url, 'https://app.test/');
    const segments = parsed.pathname.split('/');
    const file = segments.at(-1)!;
    expect(file.endsWith('.svg')).to.equal(true);
    expect(SAFE_SEGMENT.test(file.slice(0, -4))).to.equal(true);
    expect(SAFE_SEGMENT.test(segments.at(-2)!)).to.equal(true);
    expect(parsed.hash).to.equal('');
    expect(parsed.search === '' || parsed.search === '?token=kit1').to.equal(true);
  }), propertyRuns());
});

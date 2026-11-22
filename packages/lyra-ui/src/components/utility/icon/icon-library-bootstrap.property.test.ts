import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { createBootstrapIconResolver } from './icon-library-bootstrap.js';

const resolvers = [createBootstrapIconResolver(), createBootstrapIconResolver({ basePath: '/bi' })];
const SAFE_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

it('either refuses or yields one icon file under a fixed folder, with no injected path or query', () => {
  fc.assert(fc.property(
    fc.nat(1),
    fc.oneof(fc.string(), fc.constantFrom('gear', 'bi-gear', '0-circle-fill', 'x-lg', 'bi-')),
    fc.string(),
    fc.string(),
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
    expect(segments.at(-2)).to.equal(index === 0 ? 'icons' : 'bi');
    expect(parsed.hash).to.equal('');
    expect(parsed.search).to.equal('');
  }), propertyRuns());
});

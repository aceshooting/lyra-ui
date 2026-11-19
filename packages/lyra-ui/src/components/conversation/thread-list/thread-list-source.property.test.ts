import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { canonicalThreads, sourceThread } from './thread-list-source.js';

it('preserves original thread identity through projection and repeated resolution', () => {
  fc.assert(fc.property(fc.string(), title => {
    const original = { id: 'thread', title };
    const [projected] = canonicalThreads([original]);
    expect(projected?.title).to.equal(title);
    expect(sourceThread(projected!) === original).to.equal(true);
    expect(sourceThread(original) === original).to.equal(true);
  }), propertyRuns());
});

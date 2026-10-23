import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { projectMapLocalImageUrl } from './map-local-image-url.js';

const base = 'https://example.test/';
describe('local map URL admission properties', () => {
  it('never throws on bounded plain data', () => {
    fc.assert(fc.property(fc.jsonValue(), value => {
      const result = projectMapLocalImageUrl(value, base);
      expect(result === undefined || result.kind === 'blob' || result.kind === 'data').to.equal(true);
    }), propertyRuns());
  });
  it('rejects every cross-origin blob path', () => {
    fc.assert(fc.property(fc.uuid(), id => {
      expect(projectMapLocalImageUrl(`blob:https://other.test/${id}`, base)).to.equal(undefined);
    }), propertyRuns());
  });
});

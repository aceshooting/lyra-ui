import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { localDate } from '../../../internal/calendar-date.js';
import { bucketFor, dateForBucket } from './thread-list-buckets.js';

it('recovers the local month of older threads, including years before 100', () => {
  fc.assert(fc.property(fc.integer({ min: -1000, max: 2400 }), fc.integer({ min: 0, max: 11 }), (year, month) => {
    const timestamp = localDate(year, month, 28);
    const key = bucketFor({ id: 'a', title: 'Thread', timestamp }, localDate(2500).getTime());
    expect(dateForBucket(key)?.getTime()).to.equal(localDate(year, month).getTime());
  }), propertyRuns());
  expect(bucketFor({ id: 'a', title: 'Thread', timestamp: localDate(2025, 1, 1) }, localDate(2025, 2, 3).getTime())).to.equal('previous30');
  expect(dateForBucket('today')).to.equal(undefined);
});

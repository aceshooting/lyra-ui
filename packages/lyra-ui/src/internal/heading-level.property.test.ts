import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { resolveHeadingLevel, resolveTitleHeadingLevel } from './heading-level.js';

const LEVELS = ['1', '2', '3', '4', '5', '6'];

it('only ever yields an ARIA heading level from 1 to 6, or none', () => {
  fc.assert(fc.property(fc.option(fc.string(), { nil: undefined }), fc.option(fc.string(), { nil: null }), (token, aria) => {
    const level = resolveTitleHeadingLevel(token, aria);
    if (level !== undefined) expect(LEVELS).to.include(level);
  }), propertyRuns());
});

it('lets a set heading-level token win and otherwise validates the host aria-level', () => {
  fc.assert(fc.property(fc.string({ minLength: 1 }), fc.option(fc.string(), { nil: null }), (token, aria) => {
    expect(resolveTitleHeadingLevel(token, aria)).to.equal(resolveHeadingLevel(token));
    const fallback = resolveTitleHeadingLevel(undefined, aria);
    expect(fallback).to.equal(aria !== null && LEVELS.includes(aria) ? aria : '3');
  }), propertyRuns());
});

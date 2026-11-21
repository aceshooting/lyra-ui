import { expect } from '@open-wc/testing';
import { normalizeMimeType, usesFileNameFallback } from './mime-type.js';

describe('mime type normalization', () => {
  it('normalizes case, parameters and rejects malformed values', () => {
    expect(normalizeMimeType(' Text/HTML; charset=utf-8 ')).to.equal('text/html');
    expect(normalizeMimeType(42)).to.equal(undefined);
    expect(normalizeMimeType('')).to.equal(undefined);
    expect(normalizeMimeType('plain')).to.equal(undefined);
    expect(normalizeMimeType('a/' + 'b'.repeat(300))).to.equal(undefined);
  });

  it('falls back to the file name for missing or generic types', () => {
    expect(usesFileNameFallback(undefined)).to.equal(true);
    expect(usesFileNameFallback('application/octet-stream; x=1')).to.equal(true);
    expect(usesFileNameFallback('image/png')).to.equal(false);
  });
});

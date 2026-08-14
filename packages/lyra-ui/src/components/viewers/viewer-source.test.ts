import { expect } from '@open-wc/testing';
import { resolveViewerSource } from './viewer-source.js';

describe('viewer source authority', () => {
  it('uses inline presence, including an empty string, ahead of a configured URL', () => {
    expect(resolveViewerSource('/remote', '')).to.deep.equal({ kind: 'inline', value: '' });
    expect(resolveViewerSource('/remote', undefined)).to.deep.equal({ kind: 'url', url: '/remote' });
    expect(resolveViewerSource('', undefined)).to.equal(null);
  });

  it('returns immutable snapshots', () => {
    expect(Object.isFrozen(resolveViewerSource('/remote', undefined))).to.be.true;
    expect(Object.isFrozen(resolveViewerSource('', { value: 1 }))).to.be.true;
  });
});

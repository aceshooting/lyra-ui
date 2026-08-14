import { expect } from '@open-wc/testing';
import { viewerSemanticLabel, viewerSemanticRole } from './viewer-semantic-owner.js';

describe('viewer semantic ownership', () => {
  it('uses the fallback and shadow role when the host label is absent', () => {
    const host = document.createElement('div');
    expect(viewerSemanticLabel(host, 'Viewer')).to.equal('Viewer');
    expect(viewerSemanticRole(host, 'region')).to.equal('region');
  });

  it('preserves an explicitly empty label on the shadow owner', () => {
    const host = document.createElement('div');
    host.setAttribute('aria-label', '');
    expect(viewerSemanticLabel(host, 'Viewer')).to.equal('');
    expect(viewerSemanticRole(host, 'region')).to.equal('region');
  });

  it('does not duplicate a non-empty host name or its overall role in shadow DOM', () => {
    const host = document.createElement('div');
    host.setAttribute('aria-label', 'Report');
    expect(viewerSemanticLabel(host, 'Viewer')).to.be.null;
    expect(viewerSemanticRole(host, 'region')).to.be.null;
  });
});

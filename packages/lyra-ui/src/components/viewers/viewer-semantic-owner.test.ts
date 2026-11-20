import { expect } from '@open-wc/testing';
import {
  viewerHostRole,
  viewerSemanticLabel,
  viewerSemanticRole,
} from './viewer-semantic-owner.js';

describe('viewer semantic ownership', () => {
  it('uses the fallback and shadow role when the host label is absent', () => {
    const host = document.createElement('div');
    expect(viewerSemanticLabel(host, 'Viewer')).to.equal('Viewer');
    expect(viewerSemanticRole(host, 'region')).to.equal('region');
    expect(viewerHostRole(host)).to.equal(null);
  });

  it('treats a whitespace-only fallback as absent but keeps an explicitly empty one', () => {
    const host = document.createElement('div');
    expect(viewerSemanticLabel(host, '   ')).to.equal(null);
    expect(viewerSemanticLabel(host, '')).to.equal('');
  });

  it('preserves an explicitly empty label on the shadow owner', () => {
    const host = document.createElement('div');
    host.setAttribute('aria-label', '');
    expect(viewerSemanticLabel(host, 'Viewer')).to.equal('');
    expect(viewerSemanticRole(host, 'region')).to.equal('region');
    expect(viewerHostRole(host)).to.equal(null);
  });

  it('moves the role to a host named by a non-empty aria-label, leaving one owner', () => {
    const host = document.createElement('div');
    host.setAttribute('aria-label', 'Report');
    expect(viewerSemanticLabel(host, 'Viewer')).to.be.null;
    expect(viewerSemanticRole(host, 'region')).to.be.null;
    expect(viewerHostRole(host)).to.equal('region');

    expect(viewerSemanticRole(host, null), 'a state without an overall owner').to.be.null;
    expect(viewerHostRole(host)).to.equal(null);

    host.setAttribute('aria-label', '   ');
    expect(viewerSemanticRole(host, 'region'), 'whitespace is not a host name').to.equal('region');
    expect(viewerHostRole(host)).to.equal(null);
  });
});

import { expect } from '@open-wc/testing';
import { isUnsafeSvgCloneAttribute } from './safe-svg.js';

describe('isUnsafeSvgCloneAttribute', () => {
  it('rejects event-handler attributes regardless of case', () => {
    for (const name of ['onload', 'onclick', 'ONLOAD', 'onmouseover', 'onerror']) {
      expect(isUnsafeSvgCloneAttribute(name), name).to.be.true;
    }
  });

  it('rejects href and xlink:href regardless of case', () => {
    for (const name of ['href', 'HREF', 'xlink:href', 'XLink:Href']) {
      expect(isUnsafeSvgCloneAttribute(name), name).to.be.true;
    }
  });

  it('allows ordinary SVG presentation and structural attributes', () => {
    for (const name of [
      'd', 'fill', 'stroke', 'stroke-width', 'viewBox', 'transform', 'cx', 'cy', 'r',
      'points', 'clip-path', 'offset', 'stop-color', 'id', 'class', 'width', 'height',
    ]) {
      expect(isUnsafeSvgCloneAttribute(name), name).to.be.false;
    }
  });
});

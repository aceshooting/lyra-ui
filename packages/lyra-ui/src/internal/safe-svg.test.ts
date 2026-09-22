import { expect } from '@open-wc/testing';
import { isUnsafeSvgCloneAttribute, isUnsafeSvgCloneElement } from './safe-svg.js';

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

  it('rejects style and secondary resource attributes', () => {
    for (const name of ['style', 'src', 'srcset', 'poster']) {
      expect(isUnsafeSvgCloneAttribute(name), name).to.be.true;
    }
  });

  it('rejects external URL presentation values but retains local fragments', () => {
    expect(isUnsafeSvgCloneAttribute('fill', 'url(https://tracker.test/paint.svg#x)')).to.be.true;
    expect(isUnsafeSvgCloneAttribute('filter', 'url(#local-filter)')).to.be.false;
    expect(isUnsafeSvgCloneAttribute('fill', 'u\\72l(https://tracker.test/paint.svg#x)')).to.be.true;
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

describe('isUnsafeSvgCloneElement', () => {
  it('rejects executable, embedded, and resource-loading elements regardless of case', () => {
    for (const name of [
      'script', 'STYLE', 'foreignObject', 'animate', 'animateMotion', 'animateTransform', 'set',
      'discard', 'mpath', 'feImage', 'image', 'iframe', 'object', 'embed',
    ]) {
      expect(isUnsafeSvgCloneElement(name), name).to.be.true;
    }
  });

  it('retains legitimate icon primitives and local resource containers', () => {
    for (const name of [
      'svg', 'g', 'path', 'circle', 'rect', 'line', 'polygon', 'polyline', 'ellipse', 'use',
      'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'title', 'desc',
    ]) {
      expect(isUnsafeSvgCloneElement(name), name).to.be.false;
    }
  });
});

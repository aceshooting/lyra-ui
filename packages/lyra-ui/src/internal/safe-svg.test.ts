import { expect } from '@open-wc/testing';
import { isLocalSvgFragment, isUnsafeSvgCloneAttribute, isUnsafeSvgCloneElement, isUnsafeSvgPresentationValue } from './safe-svg.js';

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

  it('keeps a same-document fragment href only on use', () => {
    expect(isUnsafeSvgCloneAttribute('href', '#glyph', 'use')).to.be.false;
    expect(isUnsafeSvgCloneAttribute('XLink:Href', '#glyph', 'USE')).to.be.false;
    expect(isUnsafeSvgCloneAttribute('href', '#glyph', 'a')).to.be.true;
    for (const value of ['https://tracker.test/a.svg#x', 'javascript:alert(1)', '#a b', '']) {
      expect(isUnsafeSvgCloneAttribute('href', value, 'use'), value).to.be.true;
    }
  });

  it('exposes the shared fragment and presentation guards', () => {
    expect(isLocalSvgFragment(' #local ')).to.be.true;
    expect(isLocalSvgFragment('https://tracker.test/#x')).to.be.false;
    expect(isUnsafeSvgPresentationValue('FILL', 'url(https://tracker.test/p.svg#x)')).to.be.true;
    expect(isUnsafeSvgPresentationValue('fill', 'url(#local)')).to.be.false;
    expect(isUnsafeSvgPresentationValue('d', 'url(https://tracker.test/p.svg#x)')).to.be.false;
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

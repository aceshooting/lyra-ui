import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { normalizeMapControlOptions } from './map-control-options.js';

describe('linked attribution properties', () => {
  it('keeps every bounded plain label as text inside one guarded anchor', () => {
    fc.assert(fc.property(fc.string({ maxLength: 200 }), label => {
      const result = normalizeMapControlOptions({ attribution: { customAttribution: { label, url: 'https://example.com/credits' } } });
      const template = document.createElement('template');
      template.innerHTML = result.controls.get('attribution')!.options['customAttribution'] as string;
      expect(template.content.querySelectorAll('a').length).to.equal(1);
      const anchor = template.content.querySelector('a')!;
      expect(anchor.textContent).to.equal(label.replaceAll('\r\n', '\n').replaceAll('\r', '\n').replaceAll('\0', '\ufffd'));
      expect(anchor.children.length).to.equal(0); expect(anchor.rel).to.equal('noopener noreferrer');
    }), propertyRuns());
  });
});


describe('control order properties', () => {
  it('snapshots finite order values separately from native constructor options', () => {
    fc.assert(fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), order => {
      for (const kind of ['navigation', 'scale', 'geolocate', 'attribution'] as const) {
        const result = normalizeMapControlOptions({ [kind]: { order } });
        expect(result.controls.get(kind)?.order).to.equal(order);
        expect(result.controls.get(kind)?.options).not.to.have.property('order');
      }
    }), propertyRuns());
  });
  it('rejects malformed order without invoking accessors', () => {
    for (const order of [NaN, Infinity, -Infinity, '1', null, {}, true]) {
      for (const kind of ['navigation', 'scale', 'geolocate', 'attribution'] as const) {
        const result = normalizeMapControlOptions({ [kind]: { order } });
        expect(result.controls.size).to.equal(0);
        expect(result.diagnostics).to.deep.equal([{ kind, code: 'invalid-options' }]);
      }
    }
    let reads = 0;
    const entry = { get order() { reads++; return 1; } };
    expect(normalizeMapControlOptions({ navigation: entry }).controls.size).to.equal(0);
    expect(reads).to.equal(0);
  });
});

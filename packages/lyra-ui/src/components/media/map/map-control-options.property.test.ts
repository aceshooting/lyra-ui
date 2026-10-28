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

describe('initial attribution expansion properties', () => {
  it('keeps the seed out of native constructor options for any admitted attribution shape', () => {
    fc.assert(fc.property(fc.boolean(), fc.option(fc.boolean(), { nil: undefined }), fc.constantFrom('top-left', 'top-right', 'bottom-left', 'bottom-right'),
      (initialExpanded, compact, position) => {
        const result = normalizeMapControlOptions({ attribution: { initialExpanded, position, ...(compact === undefined ? {} : { compact }) } });
        const entry = result.controls.get('attribution')!;
        expect(result.diagnostics).to.deep.equal([]);
        expect(Reflect.get(entry, 'initialExpanded')).to.equal(initialExpanded);
        expect(entry.options).not.to.have.property('initialExpanded');
        expect(entry.position).to.equal(position);
      }), propertyRuns());
  });
});

describe('scene control option properties', () => {
  it('admits every finite nonnegative terrain scale and finite order without forwarding layout options', () => {
    fc.assert(fc.property(fc.double({ min: 0, noNaN: true, noDefaultInfinity: true }), fc.double({ noNaN: true, noDefaultInfinity: true }),
      (exaggeration, order) => {
        const result = normalizeMapControlOptions({ terrain: { source: 'dem', exaggeration, order } });
        const entry = [...result.controls.values()].find(value => String(value.kind) === 'terrain');
        expect(result.diagnostics).to.deep.equal([]);
        expect(entry?.order).to.equal(order);
        expect(entry?.options).to.deep.equal({ source: 'dem', exaggeration });
      }), propertyRuns());
  });

  it('retains arbitrary bounded nonblank source identifiers without source discovery', () => {
    fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 200 }).filter(value => value.trim().length > 0), source => {
      const result = normalizeMapControlOptions({ terrain: { source } });
      const entry = [...result.controls.values()].find(value => String(value.kind) === 'terrain');
      expect(entry?.options).to.deep.equal({ source, exaggeration: 1 });
    }), propertyRuns());
  });
});

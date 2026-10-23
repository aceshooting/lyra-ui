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

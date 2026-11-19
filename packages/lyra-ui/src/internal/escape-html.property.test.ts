import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { escapeHtml } from './escape-html.js';

describe('escape-html properties', () => {
  it('output has no raw markup characters and decodes back via the DOM', () => {
    fc.assert(
      fc.property(fc.string().filter((t) => !t.includes('\r')), (text) => {
        const escaped = escapeHtml(text);
        expect(/[<>"']/.test(escaped)).to.equal(false);
        const host = document.createElement('div');
        host.innerHTML = escaped;
        expect(host.textContent).to.equal(text);
      }),
      propertyRuns(),
    );
  });
  it('svg mode leaves no raw CR', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        expect(escapeHtml(text, { svgText: true }).includes('\r')).to.equal(false);
      }),
      propertyRuns(),
    );
  });
});

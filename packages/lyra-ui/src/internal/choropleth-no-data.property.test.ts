import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { projectChoroplethNoData } from './choropleth-no-data.js';

describe('choropleth missing-data options', () => {
  it('trims and bounds legend text while preserving safe paint values', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 550 }), size => {
      const text = 'a'.repeat(size);
      const source = { color: 'red', strokeColor: 'blue', label: `  ${text}  ` };
      const style = projectChoroplethNoData(source);
      source.color = 'green';
      expect(style?.label).to.equal(size > 256 ? `${text.slice(0, 255)}…` : text || undefined);
      expect(style?.color).to.equal('red');
      expect(style?.strokeColor).to.equal('blue');
    }), propertyRuns());
  });

  it('ignores inherited values, accessors, and unsafe paint', () => {
    let reads = 0;
    const source: object = Object.create({ strokeColor: 'blue' }) as object;
    Object.defineProperties(source, {
      color: { value: 'url(example.svg)' },
      label: { get() { reads++; return 'Missing'; } },
    });
    expect(projectChoroplethNoData(source)).to.deep.equal({ color: undefined, strokeColor: undefined, label: undefined });
    expect(reads).to.equal(0);
    expect(projectChoroplethNoData([])).to.equal(undefined);
  });
});

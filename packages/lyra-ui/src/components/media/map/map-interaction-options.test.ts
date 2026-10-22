import { expect } from '@open-wc/testing';
import { projectMapInteractionOptions, projectMapBasemapInteractions } from './map-interaction-options.js';

describe('map interaction options', () => {
  it('keeps existing layers interactive by default and accepts bounded explicit priority', () => {
    expect(projectMapInteractionOptions({})).to.deep.equal({ interactive: true, priority: 0 });
    expect(projectMapInteractionOptions({ interactive: false, priority: -100 })).to.deep.equal({ interactive: false, priority: -100 });
  });
  it('fails closed for unsafe explicit options without invoking getters', () => {
    let reads = 0; const input = Object.defineProperty({}, 'interactive', { get() { reads++; return true; } });
    expect(projectMapInteractionOptions(input)).to.deep.equal({ interactive: false, priority: 0 }); expect(reads).to.equal(0);
    for (const priority of [NaN, Infinity, 1000001, '2']) expect(projectMapInteractionOptions({ priority }).interactive).to.equal(false);
    expect(projectMapInteractionOptions({ interactive: 'true' }).interactive).to.equal(false);
  });
  it('admits only explicit unique basemap layer IDs and snapshots caller options', () => {
    const input = [{ layerId: 'roads', priority: 2 }]; const value = projectMapBasemapInteractions(input);
    expect(value).to.deep.equal([{ layerId: 'roads', interactive: true, priority: 2 }]); input[0]!.priority = 8;
    expect(value?.[0]?.priority).to.equal(2); expect(Object.isFrozen(value?.[0])).to.equal(true);
    expect(projectMapBasemapInteractions([{ layerId: 'roads' }, { layerId: 'roads' }])).to.equal(undefined);
    expect(projectMapBasemapInteractions(Array(4097))).to.equal(undefined); expect(projectMapBasemapInteractions(undefined)).to.deep.equal([]);
  });
});

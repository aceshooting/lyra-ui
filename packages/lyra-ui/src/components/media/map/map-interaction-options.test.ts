import { expect } from '@open-wc/testing';
import { projectMapInteractionOptions, projectMapBasemapInteractions, projectMapStyleLayerSelector } from './map-interaction-options.js';

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
  it('rejects malformed basemap interaction lists and entries', () => {
    const accessor = (member: string) => Object.defineProperty({}, member, { enumerable: true, get() { return 'tiles'; } });
    const revoked = Proxy.revocable<unknown[]>([], {}); revoked.revoke();
    const invalid: Record<string, unknown> = {
      'a string list': 'roads', 'a record list': {}, 'a sparse list': Array(1), 'a primitive entry': [null],
      'an entry without an id or selector': [{ interactive: true }], 'an accessor selector field': [accessor('source')], 'an accessor id': [accessor('layerId')],
      'a non-string selector field': [{ source: 7 }], 'a blank selector field': [{ layerType: ' ' }], 'a selector beside an id': [{ layerId: 'roads', layerType: 'fill' }],
      'a revoked list': revoked.proxy,
    };
    for (const [name, input] of Object.entries(invalid)) expect(projectMapBasemapInteractions(input), name).to.equal(undefined);
    expect(projectMapBasemapInteractions([{ layerType: 'symbol', priority: 4 }, { layerId: 'roads' }])).to.deep.equal([
      { selector: { source: undefined, sourceLayer: undefined, layerType: 'symbol' }, interactive: true, priority: 4 },
      { layerId: 'roads', interactive: true, priority: 0 },
    ]);
    expect(projectMapStyleLayerSelector(accessor('source'))).to.equal(undefined);
    expect(projectMapStyleLayerSelector({ source: 'tiles' })).to.deep.equal({ source: 'tiles', sourceLayer: undefined, layerType: undefined });
    expect(projectMapStyleLayerSelector({})).to.equal(null);
  });
});

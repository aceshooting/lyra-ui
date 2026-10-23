import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { snapshotLyraHighlights } from './highlight-collection.js';

it('retains first normalized ids in order without copying or freezing caller anchors', () => {
  fc.assert(fc.property(fc.array(fc.string({ maxLength: 32 }), { maxLength: 64 }), ids => {
    const rows = ids.map((id, index) => ({ id, anchor: { kind: 'page' as const, page: index + 1 } }));
    const before = structuredClone(rows);
    const normalizedIds = ids.map(id => id.trim());
    const indices = normalizedIds.map((id, index) => id.length > 0 && normalizedIds.indexOf(id) === index ? index : -1).filter(index => index >= 0);
    const snapshot = snapshotLyraHighlights(rows);
    expect(snapshot.map(highlight => highlight.id)).to.deep.equal(indices.map(index => normalizedIds[index]));
    for (let index = 0; index < snapshot.length; index++) {
      expect(snapshot[index]!.anchor === rows[indices[index]!]!.anchor).to.equal(true);
      expect(Object.isFrozen(snapshot[index])).to.equal(true);
      expect(Object.isFrozen(rows[indices[index]!]!.anchor)).to.equal(false);
    }
    expect(Object.isFrozen(snapshot)).to.equal(true);
    expect(rows).to.deep.equal(before);
  }), propertyRuns());
});

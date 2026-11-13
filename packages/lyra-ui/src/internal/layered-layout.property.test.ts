import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { layeredLayout } from './layered-layout.js';

const identifier = fc.oneof(
  fc.constantFrom('__waypoint_0__', '__waypoint_1__', 'a\u0000b', 'b\u0000c', 'a', 'c'),
  fc.array(fc.constantFrom('a', 'b', 'c', '_', '\u0000', '0'), { minLength: 1, maxLength: 12 })
    .map(characters => characters.join('')),
);

describe('layered layout identity properties', () => {
  it('preserves graph geometry when unique caller IDs are renamed', () => {
    fc.assert(fc.property(
      fc.uniqueArray(identifier, { minLength: 3, maxLength: 8 }),
      fc.array(fc.tuple(fc.nat(7), fc.nat(7)), { maxLength: 24 }),
      (names, pairs) => {
        const nodes = names.map((_, index) => ({ id: `node-${index}`, width: 20 + index, height: 10 + index }));
        const indices = pairs.map(([a, b]) => [a % names.length, b % names.length] as const)
          .filter(([a, b]) => a !== b).map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as const);
        const edges = indices.map(([source, target]) => ({ source: nodes[source]!.id, target: nodes[target]!.id }));
        const original = layeredLayout({ nodes, edges });
        const renamed = layeredLayout({
          nodes: nodes.map((node, index) => ({ ...node, id: names[index]! })),
          edges: indices.map(([source, target]) => ({ source: names[source]!, target: names[target]! })),
        });
        expect(renamed.positions.size).to.equal(nodes.length);
        expect(renamed.virtualWaypointCount).to.equal(original.virtualWaypointCount);
        expect(renamed.truncated).to.equal(original.truncated);
        expect(names.map(name => renamed.positions.get(name)))
          .to.deep.equal(nodes.map(node => original.positions.get(node.id)));
        for (const [source, target] of indices) {
          expect(renamed.positions.get(names[target]!)!.y).to.be.greaterThan(renamed.positions.get(names[source]!)!.y);
        }
      },
    ), propertyRuns());
  });
});

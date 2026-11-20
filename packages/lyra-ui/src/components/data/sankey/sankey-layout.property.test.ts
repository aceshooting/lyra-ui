import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { layoutSankey } from './sankey-layout.js';

const nodes = ['a', 'b', 'c', 'd'].map(id => ({ id, label: id }));
const flow = (source: string, target: string, value = 1) => ({ source, target, value });

describe('Sankey layout', () => {
  it('conserves ribbon thickness, orders stages, and keeps each stage disjoint', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 2, maxLength: 16 }), values => {
      const links = values.map((value, i) => flow(i % 2 ? 'b' : 'a', 'c', value));
      links.push(flow('c', 'd', values.reduce((sum, n) => sum + n, 0)));
      const result = layoutSankey(nodes, links, 600, 400);
      expect(result.status).to.equal('ready');
      expect(layoutSankey(nodes, links, 600, 400)).to.deep.equal(result);
      expect(result.links.length).to.equal(links.length);
      const byId = new Map(result.nodes.map(node => [node.id, node]));
      const hub = byId.get('c')!;
      const incoming = result.links.filter(link => link.target === 'c');
      expect(incoming.reduce((sum, link) => sum + link.thickness, 0)).to.be.closeTo(hub.height, 1e-8);
      expect(result.links.find(link => link.source === 'c')!.thickness).to.be.closeTo(hub.height, 1e-8);
      for (const link of result.links) {
        expect(byId.get(link.source)!.stage).to.be.lessThan(byId.get(link.target)!.stage);
        expect(link.y1 - link.thickness / 2).to.be.at.least(byId.get(link.source)!.y - 1e-8);
        expect(link.y2 + link.thickness / 2).to.be.at.most(byId.get(link.target)!.y + byId.get(link.target)!.height + 1e-8);
      }
      const first = result.nodes.filter(node => node.stage === 0).sort((a, b) => a.y - b.y);
      expect(first[0]!.y + first[0]!.height).to.be.at.most(first[1]!.y + 1e-8);
    }), propertyRuns());
  });

  it('untangles independent crossed pairs and retains isolated nodes', () => {
    const result = layoutSankey([...nodes, { id: 'e', label: '' }], [flow('a', 'd'), flow('b', 'c')]);
    expect(result.nodes.length).to.equal(5);
    const [a, b] = result.links;
    expect((a!.y1 - b!.y1) * (a!.y2 - b!.y2)).to.be.greaterThan(0);
  });

  it('rejects cycles including self-loops, ignores dangling flows and invalid bounds', () => {
    for (const links of [[flow('a', 'a')], [flow('a', 'b'), flow('b', 'a')]]) {
      const cycle = layoutSankey(nodes, links);
      expect(cycle.status).to.equal('cycle');
      expect(cycle.links.length).to.equal(0);
    }
    expect(layoutSankey(nodes, [flow('missing', 'a')]).links.length).to.equal(0);
    expect(layoutSankey(nodes, [], Infinity, 1).status).to.equal('empty');
  });

  it('handles overflowing totals without invalid geometry or invoking getters', () => {
    const unsafe = { get id(): string { throw Error(); }, label: '' };
    const result = layoutSankey([...nodes, unsafe], [flow('a', 'b', Number.MAX_VALUE), flow('a', 'b', Number.MAX_VALUE)]);
    expect(result.links.length).to.equal(2);
    for (const item of [...result.nodes, ...result.links]) {
      expect(Object.values(item).filter(v => typeof v === 'number').every(Number.isFinite)).to.equal(true);
    }
  });

  it('keeps explicit and implicit parallel flow identities distinct', () => {
    const edge = flow('a', 'b');
    const result = layoutSankey(nodes, [edge, { ...edge, id: 'flow-0' }, edge, { ...edge, id: 'flow-0' }]);
    expect(result.links.length).to.equal(3);
    expect(new Set(result.links.map(link => link.id)).size).to.equal(3);
    expect(result.links[1]!.id).to.equal('flow-0');
  });

  it('reports finite weights too small for representable ribbons', () => {
    const result = layoutSankey(nodes, [flow('a', 'b', Number.MAX_VALUE), flow('a', 'b', Number.MIN_VALUE)]);
    expect(result.truncated).to.equal(true);
    expect(result.links.map(link => link.value)).to.deep.equal([Number.MAX_VALUE]);
  });

  it('caps scanned entries and preserves the admitted prefix', () => {
    const many = Array.from({ length: 1001 }, (_, i) => ({ id: String(i), label: '' }));
    const result = layoutSankey(many, []);
    expect(result.truncated).to.equal(true);
    expect(result.nodes.length).to.equal(1000);
    expect(result.nodes.at(-1)!.id).to.equal('999');
  });
});

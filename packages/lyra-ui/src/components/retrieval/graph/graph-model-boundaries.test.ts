import { expect } from '@open-wc/testing';
import {
  copyGraphLinkIdentity,
  graphLengthConverter,
  graphLinkIdentity,
  normalizeGraphModel,
} from './graph-model.js';

describe('graph length attributes', () => {
  const parse = (value: string | null): unknown => graphLengthConverter.fromAttribute!(value, undefined);

  it('keeps a unit-bearing length as trimmed text, parses a bare number, and reports a removed attribute as null', () => {
    expect(parse(' 12rem ')).to.equal('12rem');
    expect(parse('50vh')).to.equal('50vh');
    expect(parse('300')).to.equal(300);
    expect(Number.isNaN(parse('wide'))).to.equal(true);
    expect(parse(null)).to.equal(null);
  });
});

describe('implicit link identity', () => {
  const nodes = [{ id: 'a' }, { id: 'b' }];

  it('numbers an implicit link past every explicit id it would otherwise collide with', () => {
    const model = normalizeGraphModel(
      nodes,
      [
        { source: 'a', target: 'b' },
        { id: 'a->b', source: 'a', target: 'b' },
        { id: 'implicit:a->b', source: 'a', target: 'b' },
      ],
      [],
      []
    );

    expect(model.links.map((link) => graphLinkIdentity(link))).to.deep.equal([
      'implicit:a->b#2',
      'a->b',
      'implicit:a->b',
    ]);
  });

  it('carries a disambiguated identity onto a simulation copy whose endpoints are node objects', () => {
    const model = normalizeGraphModel(
      nodes,
      [
        { source: 'a', target: 'b' },
        { id: 'a->b', source: 'a', target: 'b' },
      ],
      [],
      []
    );
    const implicit = model.links[0]!;
    const plain = model.links[1]!;
    const copy = copyGraphLinkIdentity(implicit, { ...implicit, source: nodes[0], target: nodes[1] });
    const untouched = copyGraphLinkIdentity(plain, { ...plain, source: nodes[0], target: nodes[1] });

    expect(graphLinkIdentity(implicit)).to.equal('implicit:a->b');
    expect(graphLinkIdentity(copy)).to.equal('implicit:a->b');
    expect(graphLinkIdentity(untouched)).to.equal('a->b');
  });
});

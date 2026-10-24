import { expect } from '@open-wc/testing';
import { readWidgetPointer } from './widget-resolver.js';

describe('readWidgetPointer', () => {
  const root = {
    title: 'Report',
    'a/b': 1,
    'm~n': 2,
    '': 'empty key',
    items: [{ name: 'first' }, { name: 'second' }],
    nothing: null,
  };

  it('resolves the document root, object members and array elements', () => {
    expect(readWidgetPointer(root, '') === root).to.equal(true);
    expect(readWidgetPointer(root, '/title')).to.equal('Report');
    expect(readWidgetPointer(root, '/items/1/name')).to.equal('second');
    expect(readWidgetPointer(root, '/')).to.equal('empty key');
    expect(readWidgetPointer(root, '/items/0')).to.deep.equal({ name: 'first' });
  });

  it('decodes ~0 and ~1 escapes and rejects any other escape', () => {
    expect(readWidgetPointer(root, '/a~1b')).to.equal(1);
    expect(readWidgetPointer(root, '/m~0n')).to.equal(2);
    expect(readWidgetPointer(root, '/m~2n')).to.equal(undefined);
    expect(readWidgetPointer(root, '/m~')).to.equal(undefined);
  });

  it('requires a leading slash for every non-empty pointer', () => {
    expect(readWidgetPointer(root, 'title')).to.equal(undefined);
    expect(readWidgetPointer(root, 'items/0')).to.equal(undefined);
    expect(readWidgetPointer(root, '/title')).to.equal('Report');
  });

  it('accepts only canonical, safe array indices inside the array', () => {
    for (const path of ['/items/01', '/items/-1', '/items/+1', '/items/1.5', '/items/1e0', '/items/ 1', '/items/2', '/items/9007199254740993']) {
      expect(readWidgetPointer(root, path), path).to.equal(undefined);
    }
    expect(readWidgetPointer(root, '/items/0/name')).to.equal('first');
  });

  it('never reaches through prototypes, inherited members, primitives or null', () => {
    const own = { constructor: 'own', prototype: 'own', safe: 'kept' };
    for (const path of ['/__proto__', '/prototype', '/constructor', '/toString', '/items/constructor', '/title/length', '/nothing/x', '/missing/deeper']) {
      expect(readWidgetPointer(root, path), path).to.equal(undefined);
    }
    expect(readWidgetPointer(own, '/constructor')).to.equal(undefined);
    expect(readWidgetPointer(own, '/prototype')).to.equal(undefined);
    expect(readWidgetPointer(own, '/safe')).to.equal('kept');
  });
});

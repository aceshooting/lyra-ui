import { expect } from '@open-wc/testing';
import { hasRealContent, nextId } from './a11y.js';
import { tag } from './prefix.js';

it('generates a distinct id on every call for the same scope', () => {
  const a = nextId('listbox');
  const b = nextId('listbox');
  expect(a).to.not.equal(b);
});

it('prefixes the id through the shared tag() helper, not a hard-coded literal', () => {
  const id = nextId('listbox');
  expect(id.startsWith(`${tag('listbox')}-`)).to.be.true;
});

describe('hasRealContent', () => {
  it('treats an empty node list as having no real content', () => {
    expect(hasRealContent([])).to.be.false;
  });

  it('treats whitespace-only text nodes as having no real content', () => {
    expect(hasRealContent([document.createTextNode('   \n\t ')])).to.be.false;
  });

  it('treats a text node with non-whitespace content as real content', () => {
    expect(hasRealContent([document.createTextNode('  hello  ')])).to.be.true;
  });

  it('treats any element node as real content, even with no text of its own', () => {
    expect(hasRealContent([document.createElement('span')])).to.be.true;
  });

  it('accepts any Iterable<Node>, not just an array', () => {
    const nodes = new Set<Node>([document.createTextNode('x')]);
    expect(hasRealContent(nodes)).to.be.true;
  });
});

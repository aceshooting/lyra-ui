import { expect } from '@open-wc/testing';
import { nextId } from './a11y.js';
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

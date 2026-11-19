import { expect, fixture, html } from '@open-wc/testing';
import { containsSlot, isElementNode, isShadowRoot, someNode } from './dom-guards.js';
import { isObjectLike, isSafeNonArrayObject } from './object-guards.js';

describe('shared DOM and object guards', () => {
  it('accepts cross-realm elements and shadow roots, rejects lookalikes', async () => {
    const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
    const doc = frame.contentDocument!;
    const foreign = doc.createElement('div');
    const root = foreign.attachShadow({ mode: 'open' });
    expect(foreign instanceof Element).to.equal(false);
    expect(isElementNode(foreign)).to.equal(true);
    expect(isElementNode(doc.createElementNS('http://www.w3.org/2000/svg', 'g'))).to.equal(true);
    expect(isShadowRoot(root)).to.equal(true);
    expect(isShadowRoot(doc.createDocumentFragment())).to.equal(false);
    expect(isElementNode({ nodeType: 1, ownerDocument: document })).to.equal(false);
    expect(isElementNode(document.createTextNode('x'))).to.equal(false);
    expect(isShadowRoot({ nodeType: 11, host: document.body })).to.equal(false);
    expect(isElementNode(null)).to.equal(false);
  });

  it('finds nodes and slots without recursion and ignores throwing predicates', () => {
    const root = document.createElement('div');
    let leaf: HTMLElement = root;
    for (let depth = 0; depth < 5_000; depth += 1) {
      const child = document.createElement('span');
      leaf.append(child);
      leaf = child;
    }
    expect(containsSlot(root)).to.equal(false);
    leaf.append(document.createElement('slot'));
    expect(containsSlot(root)).to.equal(true);
    expect(someNode(root, () => { throw new Error('boom'); })).to.equal(false);
    expect(someNode(root, (node) => node === leaf)).to.equal(true);
    expect(someNode(root, (node) => node === leaf, 10)).to.equal(false);
  });

  it('treats Proxy and throwing getters safely', () => {
    const { proxy, revoke } = Proxy.revocable({}, {});
    expect(isSafeNonArrayObject(proxy)).to.equal(true);
    revoke();
    expect(isSafeNonArrayObject(proxy)).to.equal(false);
    expect(isSafeNonArrayObject([])).to.equal(false);
    expect(isSafeNonArrayObject(null)).to.equal(false);
    expect(isSafeNonArrayObject(new (class Sample { get boom() { throw new Error('x'); } })())).to.equal(true);
    expect(isObjectLike(() => 1)).to.equal(true);
    expect(isObjectLike(null)).to.equal(false);
    expect(isObjectLike('s')).to.equal(false);
  });
});

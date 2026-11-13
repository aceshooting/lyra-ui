import { expect, fixture, html } from '@open-wc/testing';
import {
  establishesFixedContainingBlock, findFixedContainingBlockAncestor,
  fixedContainingBlockParentNode, isLastTraversableFixedContainingBlockNode, isNativeTopLayerElement,
} from './fixed-containing-block.js';

describe('fixed containing block traversal boundaries', () => {
  it('terminates at document and html roots, including a document without an element', () => {
    const owner = document.implementation.createHTMLDocument();
    expect(fixedContainingBlockParentNode(owner) === owner).to.equal(true);
    expect(fixedContainingBlockParentNode(owner.documentElement) === owner.documentElement).to.equal(true);
    expect(isLastTraversableFixedContainingBlockNode(owner)).to.equal(true);
    expect(isLastTraversableFixedContainingBlockNode(owner.documentElement)).to.equal(true);
    expect(isLastTraversableFixedContainingBlockNode(owner.body)).to.equal(true);
    const empty = document.implementation.createDocument(null, null);
    const detached = empty.createElement('surface');
    expect(empty.documentElement === null).to.equal(true);
    expect(fixedContainingBlockParentNode(detached) === detached).to.equal(true);
    expect(findFixedContainingBlockAncestor(detached, true) === null).to.equal(true);
  });

  it('crosses detached text, fragment and shadow roots without losing the owner document or host', async () => {
    const owner = document.implementation.createHTMLDocument();
    const text = owner.createTextNode('Detached');
    const fragment = owner.createDocumentFragment();
    expect(fixedContainingBlockParentNode(text) === owner.documentElement).to.equal(true);
    expect(fixedContainingBlockParentNode(fragment) === owner.documentElement).to.equal(true);
    fragment.append(text);
    expect(fixedContainingBlockParentNode(text) === fragment).to.equal(true);
    expect(isLastTraversableFixedContainingBlockNode(text)).to.equal(false);
    const host = await fixture<HTMLDivElement>(html`<div></div>`);
    const root = host.attachShadow({ mode: 'open' });
    const child = document.createElement('span'); root.append(child);
    expect(fixedContainingBlockParentNode(root) === host).to.equal(true);
    expect(fixedContainingBlockParentNode(child) === host).to.equal(true);
  });

  it('follows a slotted surface through its composed containing block instead of its light DOM parent', async () => {
    const host = await fixture<HTMLDivElement>(html`<div><span>Popup content</span></div>`);
    const root = host.attachShadow({ mode: 'open' });
    const fence = document.createElement('section'); fence.style.transform = 'translateX(0px)';
    const slot = document.createElement('slot'); fence.append(slot); root.append(fence);
    const child = host.querySelector('span')!;
    expect(fixedContainingBlockParentNode(child) === slot).to.equal(true);
    expect(findFixedContainingBlockAncestor(child) === fence).to.equal(true);
    fence.style.transform = 'none';
    expect(findFixedContainingBlockAncestor(child) === null).to.equal(true);
  });

  it('ignores stale CSS declarations in a windowless document and resolves them after adoption', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
    const owner = document.implementation.createHTMLDocument();
    const parent = owner.createElement('section'); parent.style.transform = 'translateX(0px)';
    const child = owner.createElement('div'); parent.append(child); owner.body.append(parent);
    expect(establishesFixedContainingBlock(parent)).to.equal(false);
    expect(findFixedContainingBlockAncestor(child) === null).to.equal(true);
    wrapper.append(document.adoptNode(parent));
    expect(establishesFixedContainingBlock(parent)).to.equal(true);
    expect(findFixedContainingBlockAncestor(child) === parent).to.equal(true);
  });

  it('recognizes a native modal when the popover selector is unavailable', async () => {
    const dialog = await fixture<HTMLDialogElement>(html`<dialog>Modal content</dialog>`);
    const nativeMatches = dialog.matches;
    const original = Object.getOwnPropertyDescriptor(dialog, 'matches');
    let rejected = 0;
    dialog.showModal();
    Object.defineProperty(dialog, 'matches', { configurable: true, value: (selector: string) => {
      if (selector === ':popover-open') { rejected++; throw new DOMException('Unsupported selector', 'SyntaxError'); }
      return nativeMatches.call(dialog, selector);
    } });
    try {
      expect(isNativeTopLayerElement(dialog)).to.equal(true);
      expect(rejected).to.equal(1);
      dialog.close(); expect(isNativeTopLayerElement(dialog)).to.equal(false);
    } finally {
      dialog.close();
      if (original) Object.defineProperty(dialog, 'matches', original);
      else Reflect.deleteProperty(dialog, 'matches');
    }
  });

  it('returns no top-layer authority when both native selectors are unavailable', async () => {
    const element = await fixture<HTMLDivElement>(html`<div></div>`);
    const original = Object.getOwnPropertyDescriptor(element, 'matches');
    const selectors: string[] = [];
    Object.defineProperty(element, 'matches', { configurable: true, value: (selector: string) => {
      selectors.push(selector); throw new DOMException('Unsupported selector', 'SyntaxError');
    } });
    try {
      expect(isNativeTopLayerElement(element)).to.equal(false);
      expect(selectors).to.deep.equal([':popover-open', ':modal']);
    } finally {
      if (original) Object.defineProperty(element, 'matches', original);
      else Reflect.deleteProperty(element, 'matches');
    }
  });
});

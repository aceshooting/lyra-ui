import { expect } from '@open-wc/testing';
import { assignedSlotOf, domParentElement, flattenedParentElement, ownerView } from './composed-tree.js';

describe('composed-tree walkers', () => {
  it('distinguishes the DOM parent chain from the flattened (slot-first) chain', () => {
    const shell = document.body.appendChild(document.createElement('div'));
    try {
      const root = shell.attachShadow({ mode: 'open' });
      const wrapper = root.appendChild(document.createElement('section'));
      const slot = wrapper.appendChild(document.createElement('slot'));
      const child = shell.appendChild(document.createElement('span'));
      const inner = root.appendChild(document.createElement('em'));

      expect(assignedSlotOf(child) === slot).to.equal(true);
      expect(flattenedParentElement(child) === slot).to.equal(true);
      expect(domParentElement(child) === shell).to.equal(true);
      expect(flattenedParentElement(slot) === wrapper).to.equal(true);
      expect(domParentElement(wrapper) === shell, 'a shadow root child continues at its host').to.equal(true);
      expect(flattenedParentElement(inner) === shell).to.equal(true);
      expect(domParentElement(document.documentElement) === null).to.equal(true);
    } finally {
      shell.remove();
    }
  });

  it('recognizes shadow roots and slots from another realm by shape', () => {
    const frame = document.body.appendChild(document.createElement('iframe'));
    try {
      const foreign = frame.contentDocument!;
      const shell = foreign.body.appendChild(foreign.createElement('div'));
      const root = shell.attachShadow({ mode: 'open' });
      const slot = root.appendChild(foreign.createElement('slot'));
      const child = shell.appendChild(foreign.createElement('span'));
      expect(flattenedParentElement(child) === slot).to.equal(true);
      expect(domParentElement(slot) === shell).to.equal(true);
      expect(ownerView(child) === frame.contentWindow).to.equal(true);
    } finally {
      frame.remove();
    }
  });

  it('reports a document without a browsing context, and contains a throwing owner', () => {
    const detached = document.implementation.createHTMLDocument('detached');
    expect(ownerView(detached.body) === null).to.equal(true);
    const hostile = {
      get ownerDocument(): Document {
        throw new Error('discarded');
      },
    } as unknown as Element;
    expect(ownerView(hostile) === undefined).to.equal(true);
  });
});

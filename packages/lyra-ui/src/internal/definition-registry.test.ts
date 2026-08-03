import { expect, fixture, html } from '@open-wc/testing';
import { registryForRoot, type LyraDefinitionRoot } from './definition-registry.js';

/** Overrides an element's `getRootNode()` for one test: an own, configurable property shadows
 *  the native prototype method, exactly as active-element.test.ts's `breakActiveElement` shadows
 *  a getter. The returned restore function deletes it again. */
function stubGetRootNode(root: Element, value: unknown): () => void {
  Object.defineProperty(root, 'getRootNode', {
    configurable: true,
    value: () => value,
  });
  return () => {
    delete (root as unknown as Record<string, unknown>)['getRootNode'];
  };
}

describe('registryForRoot', () => {
  it('resolves a plain element via its owner document\'s window registry', async () => {
    const el = (await fixture(html`<div></div>`)) as HTMLElement;
    expect(registryForRoot(el)).to.equal(customElements);
  });

  it('resolves a Document node passed directly via its own window registry', () => {
    expect(registryForRoot(document)).to.equal(customElements);
  });

  it('resolves a scoped registry exposed as customElementRegistry on the getRootNode() result', () => {
    const el = document.createElement('div');
    const scopedRegistry = {} as unknown as CustomElementRegistry;
    const restore = stubGetRootNode(el, { customElementRegistry: scopedRegistry });
    try {
      expect(registryForRoot(el)).to.equal(scopedRegistry);
    } finally {
      restore();
    }
  });

  it('resolves a scoped registry exposed as customElements on the getRootNode() result', () => {
    const el = document.createElement('div');
    const scopedRegistry = {} as unknown as CustomElementRegistry;
    const restore = stubGetRootNode(el, { customElements: scopedRegistry });
    try {
      expect(registryForRoot(el)).to.equal(scopedRegistry);
    } finally {
      restore();
    }
  });

  it('resolves via the direct branch when a getRootNode-less root exposes customElements', () => {
    const scopedRegistry = {} as unknown as CustomElementRegistry;
    const root = { customElements: scopedRegistry } as unknown as LyraDefinitionRoot;
    expect(registryForRoot(root)).to.equal(scopedRegistry);
  });

  it('resolves via the direct branch when a getRootNode-less root exposes customElementRegistry', () => {
    const scopedRegistry = {} as unknown as CustomElementRegistry;
    const root = { customElementRegistry: scopedRegistry } as unknown as LyraDefinitionRoot;
    expect(registryForRoot(root)).to.equal(scopedRegistry);
  });

  it('falls through without throwing when getRootNode() returns null, then falls back to the owner document', async () => {
    const el = (await fixture(html`<div></div>`)) as HTMLElement;
    const restore = stubGetRootNode(el, null);
    try {
      expect(() => registryForRoot(el)).to.not.throw();
      expect(registryForRoot(el)).to.equal(customElements);
    } finally {
      restore();
    }
  });

  it('falls through without throwing when getRootNode() returns a primitive, then falls back to the owner document', async () => {
    const el = (await fixture(html`<div></div>`)) as HTMLElement;
    const restore = stubGetRootNode(el, 42);
    try {
      expect(() => registryForRoot(el)).to.not.throw();
      expect(registryForRoot(el)).to.equal(customElements);
    } finally {
      restore();
    }
  });

  it('returns undefined when the owner document has no defaultView', () => {
    const detachedDocument = document.implementation.createHTMLDocument('detached');
    const el = detachedDocument.createElement('div');
    expect(detachedDocument.defaultView).to.equal(null);
    expect(registryForRoot(el)).to.equal(undefined);
  });
});

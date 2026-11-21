import { expect } from '@open-wc/testing';
import { registryForRoot, type LyraDefinitionRoot } from './definition-registry.js';

describe('registryForRoot edges', () => {
  it('uses the window registry for a document and an element', () => {
    expect(registryForRoot(document)).to.equal(window.customElements);
    expect(registryForRoot(document.createElement('div'))).to.equal(window.customElements);
  });

  it('prefers an explicit scoped registry on the root', () => {
    const registry = {} as CustomElementRegistry;
    expect(registryForRoot({ customElementRegistry: registry, nodeType: 1 } as unknown as LyraDefinitionRoot)).to.equal(registry);
    expect(registryForRoot({ customElements: registry, nodeType: 1 } as unknown as LyraDefinitionRoot)).to.equal(registry);
  });

  it('finds nothing for a detached root without an owner document', () => {
    expect(registryForRoot({ nodeType: 11, ownerDocument: null } as unknown as LyraDefinitionRoot)).to.equal(undefined);
    expect(registryForRoot({ nodeType: 1, ownerDocument: { defaultView: null } } as unknown as LyraDefinitionRoot)).to.equal(undefined);
  });
});

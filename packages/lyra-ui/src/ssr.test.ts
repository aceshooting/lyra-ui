import { expect } from '@open-wc/testing';
import { diagnoseLyraHydration } from './ssr.js';

describe('diagnoseLyraHydration', () => {
  it('includes a foreign element root and consults its owner custom-element registry', async () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    try {
      const foreignWindow = iframe.contentWindow!;
      const foreignDocument = iframe.contentDocument!;
      const ForeignHTMLElement = (
        foreignWindow as unknown as { HTMLElement: typeof HTMLElement }
      ).HTMLElement;
      class ForeignLyraButton extends ForeignHTMLElement {
        readonly updateComplete = Promise.resolve();

        constructor() {
          super();
          this.attachShadow({ mode: 'open' });
        }
      }
      foreignWindow.customElements.define('lr-button', ForeignLyraButton);
      const root = foreignDocument.createElement('lr-button');
      foreignDocument.body.append(root);

      const diagnostics = await diagnoseLyraHydration(root);

      expect(diagnostics.length).to.equal(1);
      expect(diagnostics[0]?.tag).to.equal('lr-button');
      expect(diagnostics[0]?.status).to.equal('hydrated');
      expect(diagnostics[0]?.element === root).to.equal(true);
    } finally {
      iframe.remove();
    }
  });

  it('does not borrow the ambient registry for an inert foreign owner document', async () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const inertDocument = iframe.contentDocument!.implementation.createHTMLDocument('inert');
    const root = inertDocument.createElement('lr-button');
    const descriptor = Object.getOwnPropertyDescriptor(customElements, 'get');
    const nativeGet = customElements.get;
    Object.defineProperty(customElements, 'get', {
      configurable: true,
      value(name: string) {
        if (name === 'lr-button') return class AmbientOnlyDefinition extends HTMLElement {};
        return nativeGet.call(customElements, name);
      },
    });

    try {
      const diagnostics = await diagnoseLyraHydration(root);
      expect(inertDocument.defaultView).to.equal(null);
      expect(diagnostics.length).to.equal(1);
      expect(diagnostics[0]?.status).to.equal('unregistered');
    } finally {
      if (descriptor) Object.defineProperty(customElements, 'get', descriptor);
      else delete (customElements as CustomElementRegistry & { get?: CustomElementRegistry['get'] }).get;
      iframe.remove();
    }
  });
});

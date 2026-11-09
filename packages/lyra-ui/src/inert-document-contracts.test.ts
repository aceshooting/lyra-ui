import { expect } from '@open-wc/testing';
import './all.js';
import { LyraElement } from './internal/lyra-element.js';
import { ROOT_BARREL_TAGS } from './internal/root-registration-allowlist.js';
import { expectDevWarning } from '../test/expected-dev-warnings.js';

expectDevWarning('lyra-data-grid-missing-accessible-name');
expectDevWarning('lyra-tree-missing-accessible-name');

// DOM staging documents have no browsing context. Adoption must retain the component's
// identity and allow it to render again when a consumer moves the staged DOM back into a page.
describe('adoption through an inert HTML document', () => {
  for (const name of ROOT_BARREL_TAGS) {
    it(`${name} preserves authored state and resumes updates after document staging`, async () => {
      const staging = document.implementation.createHTMLDocument('Staging');
      expect(staging.defaultView === null).to.equal(true);
      const element = document.createElement(name) as LyraElement;
      element.setAttribute('data-staged-record', 'kept');
      if (name === 'lr-table') element.setAttribute('aria-label', 'Staged records');
      if (name === 'lr-emoji-picker') Reflect.set(element, 'loadGroups', () => Promise.resolve(null));
      if (name === 'lr-locale-picker') Reflect.set(element, 'withoutFlags', true);
      document.body.append(element);
      try {
        await element.updateComplete;
        const shadow = element.shadowRoot;
        const populated = (shadow?.childElementCount ?? 0) > 0;
        staging.body.append(staging.adoptNode(element));
        await element.updateComplete;
        expect(element.ownerDocument === staging).to.equal(true);
        expect(element.getAttribute('data-staged-record')).to.equal('kept');
        expect(element.shadowRoot === shadow).to.equal(true);

        document.body.append(document.adoptNode(element));
        await element.updateComplete;
        expect(element.ownerDocument === document).to.equal(true);
        expect(element.getAttribute('data-staged-record')).to.equal('kept');
        expect(element.shadowRoot === shadow).to.equal(true);
        if (populated) expect(element.shadowRoot!.childElementCount).to.be.greaterThan(0);
        element.requestUpdate();
        expect(element.isUpdatePending).to.equal(true);
        await element.updateComplete;
        expect(element.isUpdatePending).to.equal(false);
      } finally { element.remove(); }
    });
  }
});

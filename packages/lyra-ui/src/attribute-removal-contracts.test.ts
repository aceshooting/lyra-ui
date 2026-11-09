import { expect, waitUntil } from '@open-wc/testing';
import { nextFrame } from '../test/frames.js';
import './all.js';
import './components/media/flag/flag-peer.js';
import { LyraElement } from './internal/lyra-element.js';
import { ROOT_BARREL_TAGS } from './internal/root-registration-allowlist.js';
import { expectDevWarning } from '../test/expected-dev-warnings.js';

expectDevWarning('lyra-data-grid-missing-accessible-name');
expectDevWarning('lyra-tree-missing-accessible-name');

describe('removing authored text attributes from connected components', () => {
  for (const name of ROOT_BARREL_TAGS) {
    const constructor = customElements.get(name) as typeof LyraElement;
    const defaults = document.createElement(name);
    for (const [property, declaration] of constructor.elementProperties) {
      if (typeof property !== 'string' || declaration.attribute === false || declaration.state ||
        declaration.type && declaration.type !== String) continue;
      if (typeof Reflect.get(defaults, property) !== 'string') continue;
      const attribute = typeof declaration.attribute === 'string' ? declaration.attribute : property.toLowerCase();
      it(`${name}.${attribute} can be removed and restored after rendering`, async () => {
        const element = document.createElement(name) as LyraElement;
        if (name === 'lr-table') element.setAttribute('aria-label', 'Records');
        if (name === 'lr-emoji-picker') Reflect.set(element, 'loadGroups', () => Promise.resolve(null));
        if (name === 'lr-locale-picker') Reflect.set(element, 'withoutFlags', true);
        // An explicit locale exercises override removal; an empty locale already means inherit.
        const initial = property === 'locale' ? 'en' : Reflect.get(element, property) as string;
        document.body.append(element);
        try {
          await element.updateComplete;
          element.setAttribute(attribute, initial);
          await element.updateComplete;
          await waitUntil(() => !element.isUpdatePending, 'authored attributes must settle');
          const authoredValue: unknown = Reflect.get(element, property);
          const authoredAttribute = element.getAttribute(attribute);
          element.removeAttribute(attribute);
          await element.updateComplete;
          await waitUntil(() => !element.isUpdatePending, 'attribute removal must settle');
          // Deferred loads must observe the removed attribute before it is restored.
          await nextFrame();
          await element.updateComplete;
          expect(element.isConnected).to.equal(true);
          expect(element.isUpdatePending).to.equal(false);
          element.setAttribute(attribute, initial);
          await element.updateComplete;
          await waitUntil(() => !element.isUpdatePending, 'restoring the authored attribute must settle');
          expect(Reflect.get(element, property), 'restored public value').to.equal(authoredValue);
          expect(element.getAttribute(attribute), 'restored attribute normalization').to.equal(authoredAttribute);
        } finally { element.remove(); }
      });
    }
  }
});

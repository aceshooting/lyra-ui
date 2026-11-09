import { expect, waitUntil } from '@open-wc/testing';
import './all.js';
import './components/media/flag/flag-peer.js';
import { LyraElement } from './internal/lyra-element.js';
import { ROOT_BARREL_TAGS } from './internal/root-registration-allowlist.js';
import { expectDevWarning } from '../test/expected-dev-warnings.js';

expectDevWarning('lyra-data-grid-missing-accessible-name');
expectDevWarning('lyra-tree-missing-accessible-name');

// Empty menus/tours have no content to open; export menus need a live window to position.
const unpresentableOpenStates = new Set([
  'lr-dropdown-item.submenuOpen', 'lr-navigation-menu-item.open', 'lr-tour.open', 'lr-export-button.open',
]);

describe('authored boolean states while staging an element in an inert document', () => {
  for (const name of ROOT_BARREL_TAGS) {
    const constructor = customElements.get(name) as typeof LyraElement;
    for (const [property, declaration] of constructor.elementProperties) {
      if (typeof property !== 'string' || declaration.type !== Boolean || declaration.attribute === false || declaration.state) continue;
      // This reflected table field reports measured overflow and is documented as read-only.
      if (name === 'lr-table' && property === 'hasHiddenPriorityColumns') continue;
      it(`${name}.${property} settles while staged and remains usable after adoption`, async () => {
        const staging = document.implementation.createHTMLDocument('State staging');
        const element = document.createElement(name) as LyraElement;
        if (name === 'lr-table') element.setAttribute('aria-label', 'Staged records');
        if (name === 'lr-emoji-picker') Reflect.set(element, 'loadGroups', () => Promise.resolve(null));
        if (name === 'lr-locale-picker') Reflect.set(element, 'withoutFlags', true);
        document.body.append(element);
        try {
          await element.updateComplete;
          const original: unknown = Reflect.get(element, property);
          const requested = !original;
          staging.body.append(staging.adoptNode(element));
          Reflect.set(element, property, requested);
          await element.updateComplete;
          await waitUntil(() => !element.isUpdatePending, 'staged updates did not settle');
          expect(element.ownerDocument === staging).to.equal(true);
          expect(element.isUpdatePending).to.equal(false);
          expect(Reflect.get(element, property), 'staged authored state')
            .to.equal(unpresentableOpenStates.has(`${name}.${property}`) ? false : requested);

          document.body.append(document.adoptNode(element));
          await element.updateComplete;
          Reflect.set(element, property, original);
          await element.updateComplete;
          await waitUntil(() => !element.isUpdatePending, 'adopted updates did not settle');
          expect(element.ownerDocument === document).to.equal(true);
          expect(Reflect.get(element, property), 'restored authored state').to.equal(original);
          element.requestUpdate();
          await element.updateComplete;
          await waitUntil(() => !element.isUpdatePending, 'subsequent updates did not settle');
          expect(element.isUpdatePending).to.equal(false);
        } finally { element.remove(); }
      });
    }
  }
});

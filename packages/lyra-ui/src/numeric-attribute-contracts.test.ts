import { expect, waitUntil } from '@open-wc/testing';
import './all.js';
import './components/media/flag/flag-peer.js';
import { LyraElement } from './internal/lyra-element.js';
import { ROOT_BARREL_TAGS } from './internal/root-registration-allowlist.js';
import { expectDevWarning } from '../test/expected-dev-warnings.js';

expectDevWarning('lyra-data-grid-missing-accessible-name');
expectDevWarning('lyra-tree-missing-accessible-name');

const numericOutput = ['aria-valuenow', 'aria-valuemin', 'aria-valuemax', 'aria-posinset', 'aria-setsize', 'width', 'height', 'r', 'cx', 'cy', 'x', 'y', 'viewBox'];
function assertFiniteOutput(root: ShadowRoot | Element): void {
  for (const node of root.querySelectorAll('*')) {
    for (const attribute of numericOutput) {
      const value = node.getAttribute(attribute);
      if (value !== null) expect(value, `${node.localName}.${attribute}`).not.to.match(/(?:NaN|Infinity)/);
    }
    if (node.shadowRoot) assertFiniteOutput(node.shadowRoot);
  }
}

describe('numeric attributes recover from non-finite input', () => {
  for (const name of ROOT_BARREL_TAGS) {
    const constructor = customElements.get(name) as typeof LyraElement;
    for (const [property, declaration] of constructor.elementProperties) {
      if (typeof property !== 'string' || declaration.type !== Number || declaration.attribute === false || declaration.state) continue;
      const attribute = typeof declaration.attribute === 'string' ? declaration.attribute : property.toLowerCase();
      for (const value of ['NaN', 'Infinity', '-Infinity']) {
        it(`${name}.${attribute} renders safe geometry and recovers after ${value}`, async () => {
          const element = document.createElement(name) as LyraElement;
          if (name === 'lr-table') element.setAttribute('aria-label', 'Records');
          if (name === 'lr-emoji-picker') Reflect.set(element, 'loadGroups', () => Promise.resolve(null));
          if (name === 'lr-locale-picker') Reflect.set(element, 'withoutFlags', true);
          document.body.append(element);
          try {
            await element.updateComplete;
            const initial: unknown = Reflect.get(element, property);
            element.setAttribute(attribute, value);
            await element.updateComplete;
            await waitUntil(() => !element.isUpdatePending);
            assertFiniteOutput(element.shadowRoot ?? element);
            expect(Number.isFinite(element.getBoundingClientRect().width)).to.equal(true);
            Reflect.set(element, property, initial);
            await element.updateComplete;
            await waitUntil(() => !element.isUpdatePending);
            expect(Object.is(Reflect.get(element, property), initial)).to.equal(true);
            assertFiniteOutput(element.shadowRoot ?? element);
          } finally { element.remove(); }
        });
      }
    }
  }
});

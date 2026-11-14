import { expect, fixture, html } from '@open-wc/testing';
import type { LyraDocumentLibrary } from './document-library.js';
import { tag } from '../../../internal/prefix.js';
import type { LyraTable } from '../table/table.js';
import './document-library.js';

for (const property of ['selectedDocumentIds', 'tagFilter'] as const) {
  for (const invalid of [null, 'one', {}]) {
    it(`clears ${property} for ${JSON.stringify(invalid)} without a selection event and recovers`, async () => {
      const element = await fixture<LyraDocumentLibrary>(html`<lr-document-library .documents=${[
        { id: 'one', name: 'First', tags: ['one'] }, { id: 'two', name: 'Second', tags: ['two'] },
      ]}></lr-document-library>`);
      const table = element.shadowRoot!.querySelector<LyraTable>(tag('table'))!;
      let selectionEvents = 0;
      element.addEventListener('lr-selection-change', () => { selectionEvents++; });
      element[property] = ['one'];
      await element.updateComplete;
      await table.updateComplete;
      expect(element[property]).to.deep.equal(['one']);
      Reflect.set(element, property, invalid);
      await element.updateComplete;
      await table.updateComplete;
      expect(element[property]).to.deep.equal([]);
      expect(Object.isFrozen(element[property])).to.equal(true);
      expect(table.shadowRoot!.querySelectorAll('[part="document-name"]').length).to.equal(2);
      expect(selectionEvents).to.equal(0);
      element[property] = ['two'];
      await element.updateComplete;
      await table.updateComplete;
      expect(element[property]).to.deep.equal(['two']);
      if (property === 'tagFilter') {
        expect(Array.from(table.shadowRoot!.querySelectorAll('[part="document-name"]'), node => node.textContent?.trim()))
          .to.deep.equal(['Second']);
      }
      expect(selectionEvents).to.equal(0);
    });
  }
}

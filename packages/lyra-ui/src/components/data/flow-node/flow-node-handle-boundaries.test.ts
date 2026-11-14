import { expect, fixture, html } from '@open-wc/testing';
import type { LyraFlowNode } from './flow-node.js';
import './flow-node.js';

for (const property of ['inputs', 'outputs'] as const) {
  for (const invalid of [null, 'invalid', {}]) {
    it(`clears ${property} for ${JSON.stringify(invalid)} and accepts a later valid handle collection`, async () => {
      const element = await fixture<LyraFlowNode>(html`<lr-flow-node></lr-flow-node>`);
      const other = property === 'inputs' ? 'outputs' : 'inputs';
      const retained = element[other];
      Reflect.set(element, property, invalid);
      await element.updateComplete;
      expect(element[property]).to.deep.equal([]);
      expect(Object.isFrozen(element[property])).to.equal(true);
      expect(element[other] === retained).to.equal(true);
      expect(element.shadowRoot!.querySelectorAll('[part~="handle"]').length).to.equal(1);
      const handles = [{ id: 'restored', label: 'Restored handle' }];
      element[property] = handles;
      handles[0]!.label = 'Changed outside component';
      await element.updateComplete;
      expect(element[property]).to.deep.equal([{ id: 'restored', label: 'Restored handle' }]);
      expect(element.shadowRoot!.querySelectorAll('[part~="handle"]').length).to.equal(2);
      expect(element.shadowRoot!.querySelector('[data-handle-id="restored"]')?.getAttribute('title'))
        .to.equal('Restored handle');
    });
  }
}

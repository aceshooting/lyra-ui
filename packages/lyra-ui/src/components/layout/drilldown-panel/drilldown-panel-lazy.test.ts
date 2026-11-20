import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-drilldown-panel.js';
import type { LyraDrilldownPanel } from '../../lr-drilldown-panel.js';

const children = ['lr-source-card', 'lr-document-preview', 'lr-entity-card'];

it('registers each data-gated child only when its category first renders', async () => {
  const el = await fixture<LyraDrilldownPanel>(html`<lr-drilldown-panel></lr-drilldown-panel>`);
  expect(children.map((tag) => customElements.get(tag) !== undefined)).to.deep.equal([false, false, false]);

  el.path = [{ nodeId: 'a', label: 'A', evidence: [{ evidenceId: 'e1', title: 'Report' }] }];
  await el.updateComplete;
  expect(children.map((tag) => customElements.get(tag) !== undefined)).to.deep.equal([true, false, false]);
  expect(el.shadowRoot!.querySelector('lr-source-card')!.shadowRoot?.textContent, 'updateComplete covers the card render')
    .to.include('Report');

  el.path = [{ nodeId: 'b', label: 'B', entities: [{ entityId: 'n1', label: 'Marie Curie' }] }];
  await el.updateComplete;
  expect(customElements.get('lr-entity-card')).to.not.equal(undefined);
  expect(customElements.get('lr-document-preview')).to.equal(undefined);
});

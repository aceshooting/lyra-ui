import { expect, fixture, html } from '@open-wc/testing';
import './drilldown-panel.js';
import type { LyraDrilldownPanel } from './drilldown-panel.js';

const children = ['lr-source-card', 'lr-document-preview', 'lr-entity-card'];

it('registers each data-gated child only when its category first renders', async () => {
  const el = await fixture<LyraDrilldownPanel>(html`<lr-drilldown-panel></lr-drilldown-panel>`);
  expect(children.map((tag) => customElements.get(tag) !== undefined)).to.deep.equal([false, false, false]);

  el.path = [{ nodeId: 'a', label: 'A', evidence: [{ evidenceId: 'e1', title: 'Report' }] }];
  await el.updateComplete;
  await customElements.whenDefined('lr-source-card');
  expect(children.map((tag) => customElements.get(tag) !== undefined)).to.deep.equal([true, false, false]);

  el.path = [{ nodeId: 'b', label: 'B', entities: [{ entityId: 'n1', label: 'Marie Curie' }] }];
  await el.updateComplete;
  await customElements.whenDefined('lr-entity-card');
  expect(customElements.get('lr-document-preview')).to.equal(undefined);
});

import { expect, fixture, html } from '@open-wc/testing';
import './provenance-panel.js';
import type { LyraProvenancePanel } from './provenance-panel.js';
import type { LyraEntityChip } from '../entity-chip/entity-chip.js';

it('keeps valid later type metadata available after malformed rows', async () => {
  const el = await fixture<LyraProvenancePanel>(html`<lr-provenance-panel></lr-provenance-panel>`);
  const types = [null, false, 42, {}, { id: 'other', label: 'Other' }, { id: 'person', label: 'Person' }];
  (el as unknown as { types: unknown }).types = types;
  el.provenance = { entities: [{ id: 'a', label: 'Alpha', type: 'person' }] };
  await el.updateComplete;
  const chip = el.shadowRoot!.querySelector<LyraEntityChip>('lr-entity-chip')!;
  await chip.updateComplete;
  expect(chip.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Alpha, Person');
  expect(types.length).to.equal(6);
  expect(el.types === types).to.equal(false);
  expect(Object.isFrozen(el.types)).to.equal(true);
  el.types = [{ id: 'person', label: 'Individual' }];
  await el.updateComplete;
  await chip.updateComplete;
  expect(chip.typeLabel).to.equal('Individual');
});

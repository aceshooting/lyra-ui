import { expect, fixture, html } from '@open-wc/testing';
import './provenance-panel.js';
import type { LyraProvenancePanel } from './provenance-panel.js';
import type { LyraEntityChip } from '../entity-chip/entity-chip.js';
import type { LyraChunkInspector } from '../chunk-inspector/chunk-inspector.js';

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

const grounded = {
  entities: [{ id: 'e1', label: 'Marie Curie', type: 'person' }],
  relationships: [
    {
      path: [
        { kind: 'node' as const, node: { id: 'e1', label: 'Marie Curie' } },
        { kind: 'edge' as const, relation: 'discovered' },
        { kind: 'node' as const, node: { id: 'e2', label: 'Polonium' } },
      ],
    },
  ],
  chunks: [{ id: 'ch1', text: 'chunk text', score: 0.8, sourceId: 's1' }],
};

it('keeps the chunk inspector input when an unrelated section toggles', async () => {
  const el = await fixture<LyraProvenancePanel>(html`<lr-provenance-panel .provenance=${grounded}></lr-provenance-panel>`);
  const inspector = el.shadowRoot!.querySelector<LyraChunkInspector>('lr-chunk-inspector')!;
  const before = inspector.chunks;
  el.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!.click();
  await el.updateComplete;
  expect(inspector.chunks === before).to.equal(true);
});

it('surfaces lr-entity-select from an entity chip and a path strip node, then the deprecated lr-entity-activate for the strip', async () => {
  const el = await fixture<LyraProvenancePanel>(html`<lr-provenance-panel .provenance=${grounded}></lr-provenance-panel>`);
  const seen: string[] = [];
  for (const type of ['lr-entity-select', 'lr-entity-activate'])
    el.addEventListener(type, (event) => seen.push(`${type}:${JSON.stringify((event as CustomEvent).detail)}`));
  const chip = el.shadowRoot!.querySelector<LyraEntityChip>('lr-entity-chip')!;
  await chip.updateComplete;
  chip.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!.click();
  const strip = el.shadowRoot!.querySelector('lr-path-strip')! as HTMLElement & { updateComplete: Promise<unknown> };
  await strip.updateComplete;
  strip.shadowRoot!.querySelector<HTMLElement>('[part="node"]')!.click();
  expect(seen).to.deep.equal([
    'lr-entity-select:{"entityId":"e1"}',
    'lr-entity-select:{"entityId":"e1","occurrenceIndex":0}',
    'lr-entity-activate:{"entityId":"e1","occurrenceIndex":0}',
  ]);
});

import { expect, fixture, html } from '@open-wc/testing';
import './eval-dataset.js';
import type { LyraEvalDataset } from './eval-dataset.js';
import type { LyraChip } from '../../overlays/chip/chip.class.js';
import type { LyraTable } from '../../data/table/table.class.js';

it('prunes removed active tags after mutable data refresh coalesces with a named update', async () => {
  const examples = [{ id: 'a', input: 'Alpha', tags: ['old'] }];
  const el = await fixture<LyraEvalDataset>(html`<lr-eval-dataset .examples=${examples}></lr-eval-dataset>`);
  const chip = el.shadowRoot!.querySelector<LyraChip>('lr-chip')!;
  await chip.updateComplete;
  chip.click();
  await el.updateComplete;
  const table = el.shadowRoot!.querySelector<LyraTable>('lr-table')!;
  expect(chip.selected).to.equal(true);
  const selections: (string | null)[] = [];
  el.addEventListener('lr-example-select', event => selections.push(event.detail.exampleId));
  table.dispatchEvent(new CustomEvent('lr-row-activate', { detail: { row: examples[0] } }));
  await el.updateComplete;
  selections.length = 0;
  examples[0]!.id = 'replacement';
  examples[0]!.tags = ['new'];
  el.disabled = true;
  el.requestUpdate();
  await el.updateComplete;
  await table.updateComplete;
  expect(table.rows.length).to.equal(1);
  expect(table.shadowRoot!.textContent).to.include('Alpha');
  const replacement = el.shadowRoot!.querySelector<LyraChip>('lr-chip')!;
  expect(replacement.value).to.equal('new');
  expect(replacement.selected).to.equal(false);
  expect(selections).to.deep.equal([null]);
});

it('keeps a selected tag individually removable when earlier tags fill the facet window', async function () {
  this.timeout(30000); // Budget for a heavily loaded multi-browser host; the asserted bounds are unchanged.
  const el = await fixture<LyraEvalDataset>(html`<lr-eval-dataset
    .strings=${{ tagFacetLimit: '+{count} more tags' }}
    .examples=${[{ id: 'z', input: 'Last example', tags: ['z'] }]}
  ></lr-eval-dataset>`);
  const chip = el.shadowRoot!.querySelector<LyraChip>('lr-chip')!;
  await chip.updateComplete;
  chip.click();
  await el.updateComplete;
  el.examples = [
    ...Array.from({ length: 500 }, (_, i) => ({ id: `a${i}`, input: `Example ${i}`, tags: [`a${String(i).padStart(3, '0')}`] })),
    { id: 'z', input: 'Last example', tags: ['z'] },
  ];
  await el.updateComplete;
  const table = el.shadowRoot!.querySelector<LyraTable>('lr-table')!;
  expect(table.rows.length).to.equal(1);
  const facets = [...el.shadowRoot!.querySelectorAll<LyraChip>('lr-chip')];
  expect(facets.length).to.equal(500);
  const retained = facets.find(facet => facet.value === 'z');
  expect(retained !== undefined).to.equal(true);
  expect(retained!.selected).to.equal(true);
  expect(facets[499]!.value).to.equal('z');
  expect(el.shadowRoot!.querySelector('[part="limit"]')!.textContent).to.equal('+1 more tags');
  el.disabled = true;
  await el.updateComplete;
  await retained!.updateComplete;
  retained!.click();
  await el.updateComplete;
  expect(table.rows.length).to.equal(1);
  expect(retained!.disabled).to.equal(true);
  el.disabled = false;
  await el.updateComplete;
  await retained!.updateComplete;
  let leaked = 0;
  el.addEventListener('lr-chip-select', () => leaked++);
  el.addEventListener('lr-chip-toggle-request', () => leaked++);
  retained!.click();
  await el.updateComplete;
  await table.updateComplete;
  expect(leaked).to.equal(0);
  expect(table.rows.length).to.equal(501);
  expect(el.shadowRoot!.querySelectorAll('lr-chip').length).to.equal(500);
  expect([...el.shadowRoot!.querySelectorAll<LyraChip>('lr-chip')].some(facet => facet.value === 'z')).to.equal(false);
});

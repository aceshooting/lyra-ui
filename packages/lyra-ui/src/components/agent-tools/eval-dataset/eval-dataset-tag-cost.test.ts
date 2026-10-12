import { expect, fixture, html } from '@open-wc/testing';
import type { PropertyValues } from 'lit';
import './eval-dataset.js';
import type { LyraEvalDataset } from './eval-dataset.js';
import type { LyraChip } from '../../overlays/chip/chip.class.js';
import { measureArrayProbeReads } from '../../../../test/array-probe-reads.js';

it('prunes active tags with linear membership work and preserves populated OR-filter results', async () => {
  const tags = Array.from({ length: 128 }, (_, index) => `tag-cost-${String(index).padStart(3, '0')}`);
  const dataset = await fixture<LyraEvalDataset>(html`<lr-eval-dataset .examples=${[
    { id: 'example', input: 'Tagged example', tags },
  ]}></lr-eval-dataset>`);
  const chips = [...dataset.shadowRoot!.querySelectorAll<LyraChip>('lr-chip')];
  await Promise.all(chips.map((chip) => chip.updateComplete));
  expect(chips.length).to.equal(tags.length);
  for (const chip of [...chips].reverse()) chip.click();
  await dataset.updateComplete;
  expect(chips.every((chip) => chip.selected)).to.equal(true);

  const seam = dataset as unknown as { willUpdate(changed: PropertyValues): void };
  const original = seam.willUpdate;
  const descriptor = Object.getOwnPropertyDescriptor(dataset, 'willUpdate');
  let reads = 0;
  let replacements = 0;
  Object.defineProperty(dataset, 'willUpdate', {
    configurable: true,
    value: (changed: PropertyValues): void => {
      if (!changed.has('examples')) { original.call(dataset, changed); return; }
      replacements += 1;
      const measured = measureArrayProbeReads(
        (array, value) => typeof value === 'string' && value.startsWith('tag-cost-')
          && typeof array[0] === 'string' && array[0].startsWith('tag-cost-'),
        () => original.call(dataset, changed),
      );
      reads += measured.reads;
    },
  });
  try {
    dataset.examples = [{ id: 'example', input: 'Replaced tagged example', tags: [...tags] }];
    await dataset.updateComplete;
  } finally {
    if (descriptor) Object.defineProperty(dataset, 'willUpdate', descriptor);
    else Reflect.deleteProperty(dataset, 'willUpdate');
  }
  expect(replacements).to.equal(1);
  const retained = [...dataset.shadowRoot!.querySelectorAll<LyraChip>('lr-chip')];
  await Promise.all(retained.map((chip) => chip.updateComplete));
  expect(retained.every((chip) => chip.selected)).to.equal(true);
  dataset.examples = [
    { id: 'example', input: 'Still matches', tags: [tags[7]!, tags[2]!, tags[7]!] },
    { id: 'other', input: 'Does not match', tags: ['unselected'] },
  ];
  await dataset.updateComplete;
  const survivors = [...dataset.shadowRoot!.querySelectorAll<LyraChip>('lr-chip')];
  await Promise.all(survivors.map((chip) => chip.updateComplete));
  expect(survivors.filter((chip) => chip.selected).map((chip) => chip.value)).to.deep.equal([tags[2], tags[7]]);
  const table = dataset.shadowRoot!.querySelector('lr-table')!;
  await table.updateComplete;
  expect(table.shadowRoot!.querySelectorAll('tbody tr[data-row-key]').length).to.equal(1);
  expect(table.shadowRoot!.textContent).to.include('Still matches');
  expect(table.shadowRoot!.textContent).not.to.include('Does not match');
  expect(reads).to.be.at.most(tags.length * 4);
});

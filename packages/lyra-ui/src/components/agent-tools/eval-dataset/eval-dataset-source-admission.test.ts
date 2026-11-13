import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraEvalDataset, EvalDatasetSource, EvalExample } from './eval-dataset.class.js';
import type { LyraTable } from '../../data/table/table.class.js';
import './eval-dataset.js';

const example = (): EvalExample => ({ id: 'e0', input: 'Question', expectedOutput: 'Answer', tags: ['topic'] });
const facets = { total: 1, values: [{ key: 'topic', label: 'Topic' }], unavailableSelected: [] };
async function rejectedExample(value: unknown): Promise<void> {
  let invalid = true;
  const provider: EvalDatasetSource = { revision: 1,
    query: async () => ({ total: 1, rows: [{ key: 'e0', order: 0, value: (invalid ? value : example()) as EvalExample }], tags: facets }),
    lookup: async () => [], locate: async () => null };
  const viewer = await fixture<LyraEvalDataset>(html`<lr-eval-dataset .dataSource=${provider}></lr-eval-dataset>`);
  const grid = viewer.shadowRoot!.querySelector<LyraTable<EvalExample>>('lr-table')!;
  await waitUntil(() => grid.error);
  await grid.updateComplete;
  expect(viewer.sourceTotal).to.equal(null);
  expect(grid.rows.length).to.equal(0);
  expect(grid.shadowRoot!.textContent).not.to.contain('Private provider detail');
  invalid = false;
  grid.shadowRoot!.querySelector<HTMLElement>('[part="retry-button"]')!.click();
  await waitUntil(() => grid.rows[0]?.id === 'e0' && !grid.error);
  expect(viewer.sourceTotal).to.equal(1);
  expect(grid.rows[0]?.input).to.equal('Question');
  expect(viewer.examples.length).to.equal(0);
}

for (const [name, value] of [
  ['null record', null], ['primitive record', 7], ['missing identity', { input: 'Question' }],
  ['missing input', { id: 'e0' }], ['blank identity', { ...example(), id: ' ' }],
  ['mismatched identity', { ...example(), id: 'e1' }], ['non-text input', { ...example(), input: 3 }],
  ['non-text expected output', { ...example(), expectedOutput: false }],
  ['non-array tags', { ...example(), tags: 'topic' }],
  ['excessive tag count', { ...example(), tags: Array.from({ length: 501 }, () => 'tag') }],
  ['sparse tags', { ...example(), tags: new Array(1) }],
  ['non-text tag', { ...example(), tags: [1] }],
  ['oversized input', { id: 'e0', input: 'x'.repeat(65_535) }],
  ['oversized combined text', { id: 'e0', input: 'x'.repeat(32_767), expectedOutput: 'y'.repeat(32_767), tags: ['z'] }],
] as const) {
  it(`rejects a provider example with ${name} and recovers from the visible retry`, async () => {
    await rejectedExample(value);
  });
}

for (const field of ['id', 'input', 'expectedOutput', 'tags'] as const) {
  it(`rejects a provider ${field} accessor without reading it`, async () => {
    let reads = 0;
    const value = Object.defineProperty(example(), field, { get() { reads++; throw new Error('Private provider detail'); } });
    await rejectedExample(value);
    expect(reads).to.equal(0);
  });
}

it('rejects an accessor tag entry without evaluating it', async () => {
  let reads = 0;
  const tags = Object.defineProperty(['topic'], '0', { get() { reads++; throw new Error('Private provider detail'); } });
  await rejectedExample({ ...example(), tags });
  expect(reads).to.equal(0);
});

it('contains a provider revision getter failure and recovers after reassignment', async () => {
  let unavailable = true;
  const provider: EvalDatasetSource = {
    get revision() { if (unavailable) throw new Error('Private provider detail'); return 1; },
    query: async () => ({ total: 1, rows: [{ key: 'e0', order: 0, value: example() }], tags: facets }),
    lookup: async () => [], locate: async () => null,
  };
  const viewer = await fixture<LyraEvalDataset>(html`<lr-eval-dataset .dataSource=${provider}></lr-eval-dataset>`);
  const grid = viewer.shadowRoot!.querySelector<LyraTable<EvalExample>>('lr-table')!;
  await waitUntil(() => grid.error);
  expect(viewer.sourceTotal).to.equal(null);
  unavailable = false; viewer.dataSource = provider;
  await waitUntil(() => grid.rows[0]?.id === 'e0' && !grid.error);
  expect(viewer.sourceTotal).to.equal(1);
});

it('accepts the exact combined text budget with absent optional output and tags', async () => {
  const input = 'x'.repeat(65_534);
  const provider: EvalDatasetSource = { revision: 1,
    query: async () => ({ total: 1, rows: [{ key: 'e0', order: 0, value: { id: 'e0', input } }], tags: facets }),
    lookup: async () => [], locate: async () => null };
  const viewer = await fixture<LyraEvalDataset>(html`<lr-eval-dataset .dataSource=${provider}></lr-eval-dataset>`);
  const grid = viewer.shadowRoot!.querySelector<LyraTable<EvalExample>>('lr-table')!;
  await waitUntil(() => grid.rows[0]?.id === 'e0');
  expect(grid.rows[0]?.input).to.equal(input);
  expect(grid.rows[0]?.expectedOutput).to.equal(undefined);
  expect(grid.rows[0]?.tags).to.deep.equal([]);
  expect(grid.error).to.equal(false);
});

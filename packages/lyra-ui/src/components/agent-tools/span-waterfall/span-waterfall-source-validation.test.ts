import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraHierarchyRow } from '../../../data-sources.js';
import type { TraceTreeSource } from '../trace-tree/trace-tree.class.js';
import type { LyraSpan } from '../trace-tree/span.js';
import type { LyraSpanWaterfall } from './span-waterfall.class.js';
import './span-waterfall.js';

const span = (key: string, value: Partial<LyraSpan> & Record<string, unknown> = {}): LyraHierarchyRow<LyraSpan> => ({ key,
  value: { id: key, name: `Span ${key}`, kind: 'tool', status: 'success', startMs: 0, endMs: 5, ...value } as LyraSpan,
  parentKey: null, level: 1, position: 1, setSize: 1, childCount: 0, expanded: false, selected: false });
function provider(rows: LyraHierarchyRow<LyraSpan>[]): TraceTreeSource {
  return { revision: 1, async project() {
    return { state: 'rows', total: rows.length, summary: { startMs: 0, endMs: 10 },
      rows: { count: rows.length, keyAt: (index) => rows[index]!.key, itemAt: (index) => rows[index]!,
        indexOfKey: (key: string | number) => rows.findIndex((candidate) => candidate.key === key) } };
  } };
}
const sourceError = (el: LyraSpanWaterfall) => Boolean(el.shadowRoot!.querySelector('[part~="source-error"]'));

for (const [name, row] of [
  ['an id that disagrees with its row key', span('claimed', { id: 'other' })],
  ['a negative start', span('early', { startMs: -1 })],
  ['an end before its start', span('reversed', { startMs: 6, endMs: 2 })],
  ['a non-numeric end', span('text-end', { endMs: '9' as unknown as number })],
] as const) {
  it(`fails a provider span with ${name}`, async () => {
    const el = await fixture<LyraSpanWaterfall>(html`<lr-span-waterfall .treeSource=${provider([row])}></lr-span-waterfall>`);
    await waitUntil(() => sourceError(el), 'the invalid span fails closed');
    expect(el.shadowRoot!.textContent).not.to.include(`Span ${row.key}`);
  });
}

it('fits axis labels only once a hidden waterfall gains width', async () => {
  const host = await fixture<HTMLDivElement>(html`<div hidden><lr-span-waterfall .spans=${[
    { id: 'a', name: 'A', kind: 'tool', status: 'success', startMs: 0, endMs: 1000 },
  ]}></lr-span-waterfall></div>`);
  const el = host.querySelector('lr-span-waterfall')!;
  await el.updateComplete;
  const ticks = () => [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="tick"]')];
  expect(ticks().length).to.be.greaterThan(1);
  expect(ticks().some((tick) => tick.hasAttribute('data-fit'))).to.equal(false);
  host.hidden = false;
  await waitUntil(() => el.shadowRoot!.querySelector('[part="axis"]')!.getBoundingClientRect().width > 0);
  expect(ticks().length).to.be.greaterThan(1);
});

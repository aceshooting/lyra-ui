import { expect, fixture, html } from '@open-wc/testing';
import './reorder-list.js';
import './reorder-item.js';
import type { LyraReorderList } from './reorder-list.js';
import type { LyraReorderItem } from './reorder-item.js';
import { twoFrames } from '../../../../test/frames.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';

it('does not observe label content when the author supplies an accessible name', async () => {
  const el = await fixture<LyraReorderItem>(html`<lr-reorder-item value="a" aria-label="Named">Content</lr-reorder-item>`);
  const probe = el as unknown as { contentObserver?: MutationObserver };
  expect(probe.contentObserver === undefined).to.equal(true);
});
it('coalesces a structural move to one boundary reconciliation', async () => {
  const el = await fixture<LyraReorderList>(html`<lr-reorder-list><lr-reorder-item value="a">A</lr-reorder-item><lr-reorder-item value="b">B</lr-reorder-item></lr-reorder-list>`);
  await twoFrames();
  const probe = el as unknown as { syncBoundaryState(): void; moveItem(item: LyraReorderItem, direction: 'up' | 'down'): void };
  const original = probe.syncBoundaryState;
  let passes = 0;
  probe.syncBoundaryState = () => { passes++; original.call(el); };
  try {
    probe.moveItem(el.children[0] as LyraReorderItem, 'down');
    await twoFrames(); await el.updateComplete;
    expect(passes).to.equal(1);
    recordScaleMeasurement('lr-reorder-list', '2 items structural move reconciliation', { boundaryPasses: passes });
  } finally { probe.syncBoundaryState = original; }
});
it('reuses the content-derived name across boundary-only renders and refreshes mutations', async () => {
  const el = await fixture<LyraReorderItem>(html`<lr-reorder-item value="a">${Array.from({ length: 1000 }, (_, index) => html`<span>Label ${index}</span>`)}</lr-reorder-item>`);
  await twoFrames();
  expect(el.childElementCount).to.equal(1000);
  const childNodes = Object.getOwnPropertyDescriptor(Node.prototype, 'childNodes')!;
  let reads = 0;
  Object.defineProperty(el, 'childNodes', { configurable: true, get: () => { reads++; return childNodes.get!.call(el); } });
  try {
    el.disabled = true; await el.updateComplete;
    expect(reads).to.equal(0);
    recordScaleMeasurement('lr-reorder-item', '1000 label nodes boundary-only update', { childNodeReads: reads });
    el.textContent = 'Beta'; await twoFrames(); await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.textContent).to.contain('Beta');
  } finally { Reflect.deleteProperty(el, 'childNodes'); }
});
it('updates a 10000-item boundary model once for an internal move', () => {
  const el = document.createElement('lr-reorder-list') as LyraReorderList;
  const items = Array.from({ length: 10_000 }, (_, index) => {
    const item = document.createElement('lr-reorder-item') as LyraReorderItem;
    item.value = String(index); return item;
  });
  el.append(...items);
  const probe = el as unknown as { syncBoundaryState(): void; moveItem(item: LyraReorderItem, direction: 'up' | 'down'): void };
  probe.syncBoundaryState();
  const original = probe.syncBoundaryState;
  let passes = 0;
  probe.syncBoundaryState = () => { passes++; original.call(el); };
  try {
    probe.moveItem(items[0]!, 'down');
    expect(passes).to.equal(1);
    expect(el.children[1] === items[0]).to.equal(true);
    recordScaleMeasurement('lr-reorder-list', '10000 items internal move', { boundaryPasses: passes });
  } finally { probe.syncBoundaryState = original; }
});

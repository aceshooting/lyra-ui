import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './notebook-viewer.js';
import type { LyraNotebookViewer } from './notebook-viewer.js';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.js';
import type { LyraAnchor } from '../document-viewer/anchors.js';

async function notebook() {
  const el = await fixture<LyraNotebookViewer>(html`<lr-notebook-viewer max-height="160px"
    style="inline-size: 400px; --lr-notebook-viewer-active-bg: rgb(12, 34, 56)"
    .notebook=${{ nbformat: 4, nbformat_minor: 5, cells: Array.from({ length: 100 }, (_, index) => ({
      cell_type: 'raw', id: `cell-${index}`, source: `Cell ${index}`, metadata: {},
    })) }}></lr-notebook-viewer>`);
  const list = el.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')!;
  await waitUntil(() => (list.shadowRoot?.querySelectorAll('[part~="cell"]').length ?? 0) > 0);
  return { el, list };
}

function visibleTarget(el: LyraNotebookViewer, list: LyraVirtualList, text: string): boolean {
  const row = [...list.shadowRoot!.querySelectorAll<HTMLElement>('[part~="cell"]')].find((cell) => cell.textContent?.includes(text));
  if (!row) return false;
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!.getBoundingClientRect();
  const rect = row.getBoundingClientRect();
  return rect.top >= base.top && rect.bottom <= base.bottom;
}

for (const anchor of [{ kind: 'node-path', path: [90] }, { kind: 'fragment', id: 'cell-90' }] satisfies LyraAnchor[]) {
  it(`reveals a far identified virtual cell through public ${anchor.kind} navigation and repeats the same target`, async () => {
    const { el, list } = await notebook();
    expect(visibleTarget(el, list, 'Cell 90')).to.equal(false);
    expect(await el.scrollToAnchor(anchor)).to.equal(true);
    await waitUntil(() => visibleTarget(el, list, 'Cell 90'), 'successful anchor did not reveal its virtual cell inside the notebook allocation');
    expect(list.activeItemId).to.equal('cell-90');
    const active = list.shadowRoot!.querySelector<HTMLElement>('[part~="cell-active"]')!;
    expect(active.textContent).to.include('Cell 90');
    expect(getComputedStyle(active).backgroundColor).to.equal('rgb(12, 34, 56)');
    list.scrollToIndex(0, { align: 'start', behavior: 'auto' });
    await waitUntil(() => visibleTarget(el, list, 'Cell 0'));
    expect(await el.scrollToAnchor(anchor)).to.equal(true);
    await waitUntil(() => visibleTarget(el, list, 'Cell 90'), 'repeating the same anchor did not return to the target');
    expect(list.activeItemId).to.equal('cell-90');
  });
}

it('preserves search navigation and declarative anchors with identified virtual rows', async () => {
  const { el, list } = await notebook();
  expect(await el.search('Cell 90')).to.equal(1);
  await waitUntil(() => visibleTarget(el, list, 'Cell 90'), 'search did not reveal its identified row');
  el.anchor = { kind: 'fragment', id: 'cell-20' };
  await waitUntil(() => visibleTarget(el, list, 'Cell 20'), 'declarative anchor did not reveal its identified row');
  expect(list.activeItemId).to.equal('cell-20');
  expect(await el.scrollToAnchor({ kind: 'fragment', id: 'missing' })).to.equal(false);
});

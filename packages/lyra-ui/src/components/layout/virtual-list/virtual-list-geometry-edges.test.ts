import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import type { LyraVirtualList } from './virtual-list.class.js';
import '../../lr-virtual-list.js';

const TARGET = 100;
const ROW_HEIGHT = 40;
const numberKey = (item: unknown) => item as number;

async function settle(list: LyraVirtualList): Promise<void> {
  await list.updateComplete;
  await nextFrame();
  await nextFrame();
  await list.updateComplete;
}

/** An Element scroller whose list sits inside a wrapper carrying `wrapperStyle`. */
async function wrappedList(wrapperStyle: string) {
  const scroller = await fixture<HTMLElement>(html`
    <div style="block-size:200px;overflow:auto">
      <div style="block-size:100px"></div>
      <div style=${wrapperStyle}>
        <lr-virtual-list
          overscan="2"
          row-height=${String(ROW_HEIGHT)}
          .items=${Array.from({ length: 200 }, (_, index) => index)}
          .renderItem=${(item: unknown) => html`<div style="block-size:40px">Row ${item}</div>`}
        ></lr-virtual-list>
      </div>
    </div>
  `);
  const list = scroller.querySelector('lr-virtual-list') as LyraVirtualList;
  list.scrollElement = scroller;
  await settle(list);
  return { scroller, list };
}

describe('lr-virtual-list external scroller geometry fallbacks', () => {
  // A rotation or a shear between the list and its scroller has no single block-axis scale, so
  // the list falls back to the scroller's own rendered scale (1 here, the scroller is untransformed).
  for (const [name, wrapperStyle] of [
    ['a rotated', 'rotate:0.25deg'],
    ['a skewed', 'transform:skewX(6deg)'],
  ] as const) {
    it(`scrolls an index into place through ${name} wrapper`, async () => {
      const { scroller, list } = await wrappedList(wrapperStyle);
      list.scrollToIndex(TARGET, { align: 'start', behavior: 'auto' });
      await waitUntil(
        () => list.renderedRows.some((row) => row.dataset['rowIndex'] === String(TARGET)),
        'the target row never rendered',
      );
      await settle(list);
      expect(scroller.scrollTop).to.be.closeTo(100 + list.offsetForIndex(TARGET), 3);
      const row = list.renderedRows.find((candidate) => candidate.dataset['rowIndex'] === String(TARGET))!;
      expect(row.getBoundingClientRect().top).to.be.closeTo(scroller.getBoundingClientRect().top, 4);
    });
  }
});

describe('lr-virtual-list identical writes', () => {
  it('treats reassigning the same groups array as no change', async () => {
    const groups = [{ key: 'g', label: 'Group', startIndex: 0 }];
    const el = await fixture<LyraVirtualList>(html`<lr-virtual-list
      style="--lr-virtual-list-height:120px"
      row-height="40"
      .items=${[0, 1, 2, 3]}
      .groups=${groups}
      .keyFunction=${numberKey}
      .renderItem=${(item: unknown) => html`Row ${item}`}
    ></lr-virtual-list>`);
    await settle(el);
    await waitUntil(() => !el.isUpdatePending, 'the list never settled');
    el.groups = groups;
    expect(el.isUpdatePending, 'an identical groups write scheduled an update').to.equal(false);
    el.groups = [{ key: 'g', label: 'Renamed', startIndex: 0 }];
    expect(el.isUpdatePending, 'a changed groups write did not schedule an update').to.equal(true);
  });

  it('leaves the scroll position alone when activeItemId names no item', async () => {
    const el = await fixture<LyraVirtualList>(html`<lr-virtual-list
      style="--lr-virtual-list-height:120px"
      row-height="40"
      .items=${Array.from({ length: 50 }, (_, index) => index)}
      .keyFunction=${numberKey}
      .renderItem=${(item: unknown) => html`Row ${item}`}
    ></lr-virtual-list>`);
    await settle(el);
    const base = el.scrollContainer!;
    base.scrollTop = 400;
    base.dispatchEvent(new Event('scroll'));
    await settle(el);
    el.activeItemId = 'missing';
    await settle(el);
    expect(base.scrollTop).to.equal(400);
    el.activeItemId = 30;
    await settle(el);
    await waitUntil(
      () => el.renderedRows.some((row) => row.dataset['rowIndex'] === '30'),
      'a real active item still scrolls into view',
    );
  });
});

describe('lr-virtual-list light projection recovery', () => {
  it('re-projects rows after a consumer clears every light child, anchor included', async () => {
    const el = await fixture<LyraVirtualList>(html`<lr-virtual-list
      row-projection="light"
      style="--lr-virtual-list-height:120px"
      row-height="40"
      .items=${[0, 1, 2]}
      .keyFunction=${numberKey}
      .renderItem=${(item: unknown) => html`<span class="cell">Row ${item}</span>`}
    ></lr-virtual-list>`);
    await settle(el);
    expect(el.projectedRows.length).to.equal(3);
    el.replaceChildren();
    expect(el.projectedRows.length).to.equal(0);
    el.items = [0, 1, 2, 3];
    await settle(el);
    await waitUntil(() => el.projectedRows.length === 4, 'rows were not projected again');
    expect(el.projectedRows.map((row) => row.textContent?.trim())).to.deep.equal([
      'Row 0',
      'Row 1',
      'Row 2',
      'Row 3',
    ]);
    const comments = [...el.childNodes].filter((node) => node.nodeType === Node.COMMENT_NODE && /projection/.test(node.textContent ?? ''));
    expect(comments.length, 'exactly one projection anchor remains').to.equal(1);
  });
});

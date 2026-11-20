import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { twoFrames } from '../../../../test/frames.js';
import type { LyraVirtualList, LyraVirtualListGroup } from '../../lr-virtual-list.js';
import '../../lr-virtual-list.js';

const targetIndex = 100;
const group = (): LyraVirtualListGroup => ({ key: 'section', label: '', startIndex: 0 });
const stickyRenderer = (height: number) => (value: LyraVirtualListGroup) => html`<div
  style=${`block-size:${height}px;box-sizing:border-box`}
>Section ${value.key}</div>`;

async function settle(list: LyraVirtualList): Promise<void> {
  await list.updateComplete;
  await twoFrames();
  await list.updateComplete;
}

function overlay(list: LyraVirtualList): HTMLElement | null {
  return list.shadowRoot!.querySelector<HTMLElement>('[part~="sticky-group"]');
}

function scrollInset(list: LyraVirtualList): number {
  return Number.parseFloat(getComputedStyle(list.scrollContainer!).scrollPaddingBlockStart) || 0;
}

async function expectMeasuredBand(list: LyraVirtualList, height: number): Promise<void> {
  await waitUntil(() => {
    const band = overlay(list);
    return band !== null && Math.abs(band.getBoundingClientRect().height - height) < 0.5 && Math.abs(scrollInset(list) - height) < 0.5;
  }, 'the sticky band is rendered and its measured height reaches viewport scroll padding');
  expect(overlay(list)!.getBoundingClientRect().height).to.be.closeTo(height, 0.5);
  expect(scrollInset(list)).to.be.closeTo(height, 0.5);
}

async function expectStartAlignment(list: LyraVirtualList, inset: number): Promise<void> {
  list.scrollToIndex(targetIndex, { align: 'start', behavior: 'auto' });
  await waitUntil(() => list.renderedRows.some(row => row.dataset['rowIndex'] === String(targetIndex)),
    'the public scroll call mounts the requested row');
  await settle(list);
  const viewport = list.scrollContainer!;
  const target = list.renderedRows.find(row => row.dataset['rowIndex'] === String(targetIndex))!;
  const contentTop = viewport.getBoundingClientRect().top + viewport.clientTop;
  expect(target.getBoundingClientRect().height, 'the target is a real rendered row').to.be.greaterThan(0);
  expect(target.getBoundingClientRect().top - contentTop, 'start alignment leaves only the current sticky band').to.be.closeTo(inset, 1);
  expect(viewport.scrollTop).to.be.closeTo(list.offsetForIndex(targetIndex) - inset, 1);
}

async function mount(): Promise<LyraVirtualList> {
  const list = await fixture<LyraVirtualList>(html`<lr-virtual-list
    aria-label="Records"
    style="--lr-virtual-list-height:200px;inline-size:320px"
    row-height="40"
    overscan="1"
    .items=${Array.from({ length: 200 }, (_, index) => index)}
    .groups=${[group()]}
    .renderItem=${(value: unknown) => html`<div style="block-size:40px">Record ${value}</div>`}
    .renderStickyGroup=${stickyRenderer(48)}
  ></lr-virtual-list>`);
  await settle(list);
  await expectMeasuredBand(list, 48);
  await expectStartAlignment(list, 48);
  return list;
}

it('drops the measured sticky inset when the last group is removed and measures a restored band', async () => {
  const list = await mount();
  list.groups = [];
  await settle(list);
  expect(overlay(list) === null, 'no group remains for the sticky renderer').to.equal(true);
  expect(scrollInset(list), 'an absent sticky layer leaves no measured scroll band').to.equal(0);
  await expectStartAlignment(list, 0);

  list.renderStickyGroup = stickyRenderer(64);
  list.groups = [group()];
  await settle(list);
  await expectMeasuredBand(list, 64);
  await expectStartAlignment(list, 64);
});

it('removes and restores a live sticky renderer without retaining its scroll inset', async () => {
  const list = await mount();
  list.renderStickyGroup = undefined;
  await settle(list);
  expect(overlay(list) === null, 'unsetting the renderer removes its old overlay').to.equal(true);
  expect(scrollInset(list)).to.equal(0);
  await expectStartAlignment(list, 0);

  list.renderStickyGroup = stickyRenderer(64);
  await settle(list);
  await expectMeasuredBand(list, 64);
  await expectStartAlignment(list, 64);
});

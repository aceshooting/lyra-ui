import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { twoFrames as nextFrame } from '../../../../test/frames.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import { setVirtualListCompositionProfile } from '../../../internal/virtual-list-composition.js';
import './virtual-list.js';
import type { LyraVirtualList } from './virtual-list.js';

const numberKey = (item: unknown): number => item as number;
const text = (item: unknown) => html`<div style="block-size:40px">${item}</div>`;
const base = (el: LyraVirtualList): HTMLElement => el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;

describe('virtual-list screen-reader-only row text', () => {
  it('clips a .sr-only span rendered by a shadow row', async () => {
    const el = await fixture<LyraVirtualList>(html`<lr-virtual-list style="--lr-virtual-list-height:200px"
      row-height="40" .items=${[1, 2, 3]} .keyFunction=${numberKey}
      .renderItem=${(item: unknown) => html`<span class="sr-only">File ${item}</span>`}></lr-virtual-list>`);
    await nextFrame();
    const span = el.shadowRoot!.querySelector<HTMLElement>('.sr-only')!;
    const rect = span.getBoundingClientRect();
    expect(rect.width <= 1 && rect.height <= 1).to.equal(true);
  });
});

describe('virtual-list hover and focus outline', () => {
  it('keeps the focus ring width while the pointer rests on a keyboard-focused list', async () => {
    const el = await fixture<LyraVirtualList>(html`<lr-virtual-list style="--lr-virtual-list-height:200px"
      row-height="40" .items=${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]} .keyFunction=${numberKey}
      .renderItem=${text}></lr-virtual-list>`);
    await nextFrame();
    const scroller = base(el);
    try {
      await focusByKeyboard(scroller);
      const focused = getComputedStyle(scroller).outlineWidth;
      await hoverUntilMatched(scroller, 'pointer did not reach the list');
      await nextFrame();
      expect(scroller.matches(':focus-visible')).to.equal(true);
      expect(getComputedStyle(scroller).outlineWidth).to.equal(focused);
    } finally {
      await resetMouse();
    }
  });
});

describe('virtual-list load-more', () => {
  it('asks again when a loaded page still does not fill the viewport', async () => {
    let requests = 0;
    const el = await fixture<LyraVirtualList>(html`<lr-virtual-list style="--lr-virtual-list-height:400px"
      row-height="40" has-more .items=${[1, 2]} .keyFunction=${numberKey}
      @lr-load-more=${() => { requests += 1; }}
      .renderItem=${text}></lr-virtual-list>`);
    await nextFrame();
    expect(requests).to.equal(1);
    el.items = [1, 2, 3];
    await el.updateComplete;
    await nextFrame();
    expect(requests).to.equal(2);
  });
});

describe('virtual-list group markers and sticky group', () => {
  const groups = [{ key: 'a', label: 'Group A', startIndex: 0 }, { key: 'b', label: 'Group B', startIndex: 5 }];
  it('marks group labels presentational so they are not bare children of the list', async () => {
    const el = await fixture<LyraVirtualList>(html`<lr-virtual-list style="--lr-virtual-list-height:200px"
      row-height="40" .items=${Array.from({ length: 10 }, (_, i) => i)} .groups=${groups}
      .keyFunction=${numberKey} .renderItem=${text}></lr-virtual-list>`);
    await nextFrame();
    const marker = el.shadowRoot!.querySelector('[part="group"]')!;
    expect(marker.getAttribute('role')).to.equal('presentation');
  });

  it('paints an opaque sticky group overlay by default', async () => {
    const el = await fixture<LyraVirtualList>(html`<lr-virtual-list style="--lr-virtual-list-height:200px"
      row-height="40" .items=${Array.from({ length: 10 }, (_, i) => i)} .groups=${groups}
      .keyFunction=${numberKey} .renderItem=${text}
      .renderStickyGroup=${() => html`<div>pinned</div>`}></lr-virtual-list>`);
    await nextFrame();
    const sticky = el.shadowRoot!.querySelector<HTMLElement>('[part="sticky-group"]')!;
    expect(getComputedStyle(sticky).backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
    el.style.setProperty('--lr-virtual-list-sticky-group-bg', 'rgb(7, 11, 13)');
    expect(getComputedStyle(sticky).backgroundColor).to.equal('rgb(7, 11, 13)');
  });
});

describe('virtual-list host label', () => {
  it('ignores a whitespace-only host aria-label', async () => {
    const el = await fixture<LyraVirtualList>(html`<lr-virtual-list aria-label="   " .items=${[1]}
      .keyFunction=${numberKey} .renderItem=${text}></lr-virtual-list>`);
    expect(base(el).hasAttribute('aria-label')).to.equal(false);
  });
});

it('exposes the group description on each row while the group marker is outside the window', async () => {
  const el = await fixture<LyraVirtualList>(html`<lr-virtual-list style="--lr-virtual-list-height:120px" row-height="40"
    .items=${Array.from({ length: 100 }, (_, i) => i)} .keyFunction=${numberKey} .renderItem=${text}
    .groups=${[{ key: 'one', label: 'First', startIndex: 1 }, { key: 'two', label: 'Second', startIndex: 50 }]}></lr-virtual-list>`);
  await nextFrame();
  const row = (index: number) => el.shadowRoot!.querySelector(`[part="row"][data-row-index="${index}"]`)!;
  expect(row(0).hasAttribute('aria-description')).to.equal(false);
  expect(row(2).getAttribute('aria-description')).to.equal('First');
  el.scrollToIndex(80, { align: 'start', behavior: 'auto' });
  await waitUntil(() => row(80) !== null, 'the distant row is rendered');
  expect(el.shadowRoot!.querySelectorAll('[part="group"]').length).to.equal(0);
  expect(row(80).getAttribute('aria-description')).to.equal('Second');
  await expect(el).to.be.accessible();
});

it('keeps a keyboard tab stop on the overflowing local scrollport', async () => {
  const el = await fixture<LyraVirtualList>(html`<lr-virtual-list style="--lr-virtual-list-height:80px"
    row-height="40" .items=${[1, 2, 3, 4]} .keyFunction=${numberKey} .renderItem=${text}></lr-virtual-list>`);
  const scroller = base(el);
  expect(scroller.scrollHeight).to.be.greaterThan(scroller.clientHeight);
  expect(scroller.tabIndex).to.equal(0);
  await focusByKeyboard(scroller);
  expect(el.shadowRoot!.activeElement === scroller).to.equal(true);
});

it('keeps a capped embedded list to one scrollport and shrinks it around short content', async () => {
  const wrapper = await fixture<HTMLElement>(html`<section style="max-block-size:160px;overflow:auto">
    <style>lr-virtual-list.capped::part(base) { block-size:auto; max-block-size:160px }</style>
    <lr-virtual-list class="capped" row-height="40" .items=${Array.from({ length: 100 }, (_, i) => i)}
      .keyFunction=${numberKey} .renderItem=${text}></lr-virtual-list>
  </section>`);
  const list = wrapper.querySelector('lr-virtual-list')!;
  const port = base(list);
  expect(port.clientHeight).to.equal(160);
  expect(port.scrollHeight).to.equal(4000);
  expect(wrapper.scrollHeight).to.equal(wrapper.clientHeight);
  list.items = [0, 1, 2];
  await list.updateComplete;
  expect(port.clientHeight).to.equal(120);
  expect(port.scrollHeight).to.equal(120);
  expect(wrapper.clientHeight).to.equal(120);
});

it('exposes group text to a composing owner when its row wrappers have no semantics', async () => {
  const el = await fixture<LyraVirtualList>(html`<lr-virtual-list .items=${[1, 2]} row-height="40"
    .groups=${[{ key: 'a', label: 'Alpha', startIndex: 0 }]} .renderItem=${text}></lr-virtual-list>`);
  await nextFrame();
  const marker = () => el.shadowRoot!.querySelector('[part="group"]')!;
  expect(marker().getAttribute('aria-hidden')).to.equal('true');
  setVirtualListCompositionProfile(el, { maxRows: 4 });
  await el.updateComplete;
  expect(marker().hasAttribute('aria-hidden')).to.equal(false);
  expect(marker().textContent?.trim()).to.equal('Alpha');
  expect(el.renderedRows[0]!.hasAttribute('aria-description')).to.equal(false);
});

it('keeps subpixel dense-row offsets exact after appending and measuring rows', async () => {
  const el = await fixture<LyraVirtualList>(html`<lr-virtual-list row-height="0.25" .items=${[1, 2]}
    .renderItem=${() => html`<div style="height:0.75px"></div>`}></lr-virtual-list>`);
  expect(el.offsetForIndex(2)).to.equal(0.5);
  el.items = [1, 2, 3];
  await el.updateComplete;
  expect(el.offsetForIndex(3)).to.equal(0.75);
  expect(el.indexAtOffset(0.5)).to.equal(2);
  el.rowHeight = 'auto';
  await waitUntil(() => el.offsetForIndex(3) === 2.25, 'three measured rows occupy 2.25 pixels');
  expect(el.indexAtOffset(1.5)).to.equal(2);
});

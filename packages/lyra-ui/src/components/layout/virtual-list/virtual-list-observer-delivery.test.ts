import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import type { LyraVirtualList } from './virtual-list.class.js';
import './virtual-list.js';

class ControlledObserver implements ResizeObserver {
  readonly targets = new Set<Element>();
  disconnected = false;
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(target: Element): void { this.targets.add(target); }
  unobserve(target: Element): void { this.targets.delete(target); }
  disconnect(): void { this.disconnected = true; }
  deliver(target?: Element, height?: number, borderBox = true): void {
    const entries: ResizeObserverEntry[] = [];
    if (target) {
      const rect = target.getBoundingClientRect();
      const box = { inlineSize: rect.width, blockSize: height ?? rect.height };
      entries.push({ target, borderBoxSize: borderBox ? [box] : [], contentBoxSize: [box], devicePixelContentBoxSize: [box],
        contentRect: new DOMRectReadOnly(0, 0, rect.width, box.blockSize) });
    }
    this.callback(entries, this);
  }
}
async function withObservers(run: (list: LyraVirtualList, observers: ControlledObserver[]) => Promise<void>): Promise<void> {
  const original = Object.getOwnPropertyDescriptor(window, 'ResizeObserver');
  const observers: ControlledObserver[] = [];
  class Observer extends ControlledObserver {
    constructor(callback: ResizeObserverCallback) { super(callback); observers.push(this); }
  }
  Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: Observer });
  let list: LyraVirtualList | undefined;
  try {
    list = await fixture<LyraVirtualList>(html`<lr-virtual-list style="--lr-virtual-list-height:160px" overscan="0"
      .items=${Array.from({ length: 100 }, (_, index) => index)} .keyFunction=${(value: unknown) => Number(value)}
      .renderItem=${(value: unknown) => html`<div style="height:40px">Row ${value}</div>`}></lr-virtual-list>`);
    await nextFrame(); await list.updateComplete;
    await run(list, observers);
  } finally {
    list?.remove();
    if (original) Object.defineProperty(window, 'ResizeObserver', original);
    else Reflect.deleteProperty(window, 'ResizeObserver');
  }
}

it('uses content-box viewport deliveries and ignores empty batches without losing its rendered window', async () => withObservers(async (list, observers) => {
  list.rowHeight = 40; await list.updateComplete;
  const base = list.scrollContainer!;
  const observer = observers.find(value => value.targets.has(base) && !value.disconnected)!;
  expect(observer !== undefined).to.equal(true);
  observer.deliver(base, 80, false); await list.updateComplete;
  const short = list.renderedRows.map(row => row.dataset['rowIndex']);
  expect(short).to.deep.equal(['0', '1']);
  observer.deliver(); await nextFrame(); await list.updateComplete;
  expect(list.renderedRows.map(row => row.dataset['rowIndex'])).to.deep.equal(short);
  observer.deliver(base, 160, false); await list.updateComplete;
  expect(list.renderedRows.map(row => row.dataset['rowIndex'])).to.deep.equal(['0', '1', '2', '3']);
}));

it('measures real row boxes when border-box metadata is missing and ignores unknown targets', async () => withObservers(async (list, observers) => {
  const row = list.renderedRows[0]!;
  const observer = observers.find(value => value.targets.has(row) && !value.disconnected)!;
  expect(observer !== undefined).to.equal(true);
  const content = row.querySelector<HTMLElement>('div')!;
  content.style.height = '73px';
  observer.deliver(row, undefined, false);
  await waitUntil(() => list.offsetForIndex(1) === 73);
  const offset = list.offsetForIndex(2);
  const unrelated = document.createElement('div');
  observer.deliver(unrelated, 500);
  await nextFrame(); await list.updateComplete;
  expect(list.offsetForIndex(1)).to.equal(73);
  expect(list.offsetForIndex(2)).to.equal(offset);
  expect(row.getBoundingClientRect().height).to.equal(73);
}));

it('retires automatic measurements when a fixed row height replaces a queued delivery', async () => withObservers(async (list, observers) => {
  const row = list.renderedRows[0]!;
  const observer = observers.find(value => value.targets.has(row) && !value.disconnected)!;
  expect(observer !== undefined).to.equal(true);
  observer.deliver(row, 95);
  list.rowHeight = 32; await list.updateComplete;
  observer.deliver(row, 140);
  await nextFrame(); await list.updateComplete;
  expect(list.offsetForIndex(1)).to.equal(32);
  expect(list.offsetForIndex(10)).to.equal(320);
  list.scrollToIndex(50, { align: 'start', behavior: 'auto' });
  await waitUntil(() => list.renderedRows.some(value => value.dataset['rowIndex'] === '50'));
  expect(list.scrollContainer!.scrollTop).to.equal(1600);
}));

it('coalesces local row measurements outside the observer delivery before changing offsets', async () => withObservers(async (list, observers) => {
  const row = list.renderedRows[0]!;
  const observer = observers.find(value => value.targets.has(row) && !value.disconnected)!;
  const originalOffset = list.offsetForIndex(1);
  observer.deliver(row, 73);
  observer.deliver(row, 91);
  await list.updateComplete;
  expect(list.offsetForIndex(1)).to.equal(originalOffset);
  await waitUntil(() => list.offsetForIndex(1) === 91);
  expect(list.offsetForIndex(2) - list.offsetForIndex(1)).to.equal(originalOffset);
}));

for (const property of ['items', 'source'] as const) {
  it(`discards a removed ${property} row's queued measurement before consulting its key`, async () => withObservers(async (list, observers) => {
    let invalidKeyReads = 0;
    list.keyFunction = value => {
      if (typeof value !== 'number') invalidKeyReads++;
      return Number(value);
    };
    list[property] = [0, 1, 2];
    await list.updateComplete;
    const estimate = list.offsetForIndex(1);
    const row = list.renderedRows.find(value => value.dataset['rowIndex'] === '2')!;
    const observer = observers.find(value => value.targets.has(row) && !value.disconnected)!;
    expect(observer !== undefined).to.equal(true);
    observer.deliver(row, 95);
    list[property] = [0];
    await list.updateComplete;
    await nextFrame(); await list.updateComplete;
    expect(invalidKeyReads, 'removed rows must never reach the caller key function').to.equal(0);
    expect(list.offsetForIndex(1)).to.equal(estimate);
    list[property] = [0, 1, 2];
    await list.updateComplete;
    expect(list.offsetForIndex(3), 'reinserted rows cannot inherit a retired observation').to.equal(estimate * 3);
  }));

  it(`applies a queued ${property} measurement at the surviving row's new position`, async () => withObservers(async (list, observers) => {
    list[property] = [0, 1, 2];
    await list.updateComplete;
    const estimate = list.offsetForIndex(1);
    const row = list.renderedRows.find(value => value.dataset['rowIndex'] === '2')!;
    const observer = observers.find(value => value.targets.has(row) && !value.disconnected)!;
    expect(observer !== undefined).to.equal(true);
    row.querySelector<HTMLElement>('div')!.style.height = '95px';
    observer.deliver(row, 95);
    list[property] = [2, 0, 1];
    await list.updateComplete;
    await nextFrame(); await list.updateComplete;
    expect(list.offsetForIndex(1)).to.equal(95);
    expect(list.offsetForIndex(2)).to.equal(95 + estimate);
    expect(list.offsetForIndex(3)).to.equal(95 + estimate * 2);
    expect(list.renderedRows[0]?.textContent).to.include('Row 2');
  }));
}

for (const height of ['auto', '100%']) {
  it(`stabilizes a content-sized local viewport with ${height} height as its rows resize`, async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><lr-virtual-list
      style=${`--lr-virtual-list-height:${height}`}
      .items=${[0, 1, 2]}
      .renderItem=${(value: unknown) => html`<div style="height:24px">Row ${value}</div>`}
    ></lr-virtual-list></div>`);
    const list = wrapper.querySelector<LyraVirtualList>('lr-virtual-list')!;
    await waitUntil(() => list.offsetForIndex(2) === 48 && list.scrollContainer!.getBoundingClientRect().height === 72,
      'the local viewport follows its measured rows without an observer loop');
    expect(list.renderedRows.map(row => row.dataset['rowIndex'])).to.deep.equal(['0', '1', '2']);
    list.renderedRows[0]!.querySelector<HTMLElement>('div')!.style.height = '73px';
    await waitUntil(() => list.offsetForIndex(1) === 73 && list.scrollContainer!.getBoundingClientRect().height === 121,
      'a resized row updates both offsets and the local viewport');
    expect(list.offsetForIndex(2)).to.equal(97);
    expect(list.renderedRows.map(row => row.dataset['rowIndex'])).to.deep.equal(['0', '1', '2']);
  });
}

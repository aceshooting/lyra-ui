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

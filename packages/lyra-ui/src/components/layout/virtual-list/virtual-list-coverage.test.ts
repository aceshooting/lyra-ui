import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { twoFrames as nextFrame } from '../../../../test/frames.js';
import './virtual-list.js';
import type { LyraVirtualList } from './virtual-list.class.js';

const renderText = (item: unknown, index: number) => html`item ${item}#${index}`;
const numberKey = (item: unknown) => item as number;

describe('lr-virtual-list coverage', () => {
  it('windows correctly under an external scroller once an initially empty list receives rows', async () => {
    const scroller = await fixture<HTMLElement>(html`
      <div style="block-size:200px;overflow:auto">
        <div style="block-size:40px"></div>
        <lr-virtual-list row-height="40" overscan="0" .items=${[] as number[]}
          .renderItem=${renderText} .keyFunction=${numberKey}></lr-virtual-list>
      </div>
    `);
    const el = scroller.querySelector<LyraVirtualList>('lr-virtual-list')!;
    el.scrollElement = scroller;
    await el.updateComplete;
    await nextFrame();
    expect(el.renderedRows.length).to.equal(0);

    el.items = Array.from({ length: 500 }, (_, index) => index);
    await el.updateComplete;
    await waitUntil(() => el.renderedRows.length > 0);
    scroller.scrollTop = 40 + 40 * 100;
    await waitUntil(() => el.renderedRows.some((row) => row.dataset['rowIndex'] === '100'));
    expect(el.renderedRows.length < 50).to.equal(true);
  });

  it('keeps indexed offsets finite when the per-row estimate would overflow', async () => {
    const warningKey = 'virtual-list-scroll-scaling';
    const store = (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings;
    const wasIssued = store?.has(warningKey);
    store?.delete(warningKey);
    const previousWarn = console.warn;
    console.warn = () => undefined;
    let el: LyraVirtualList | undefined;
    try {
      el = await fixture<LyraVirtualList>(html`
        <lr-virtual-list style="--lr-virtual-list-height:200px" row-height="1e300"
          .source=${{ count: 1_000_000_000, itemAt: (index: number) => index }}
          .renderItem=${renderText}></lr-virtual-list>
      `);
      await el.updateComplete;
      expect(Number.isFinite(el.offsetForIndex(1_000_000_000))).to.equal(true);
      expect(el.offsetForIndex(1_000_000_000)).to.equal(Number.MAX_VALUE);
      expect(el.offsetForIndex(1)).to.equal(1e300);
    } finally {
      el?.remove();
      console.warn = previousWarn;
      if (wasIssued) store?.add(warningKey);
      else store?.delete(warningKey);
    }
  });

  it('applies a measurement inline when its realm lost its window before the delivery', async () => {
    const iframe = await fixture<HTMLIFrameElement>(html`<iframe title="List realm" style="width:320px;height:240px"></iframe>`);
    const view = iframe.contentWindow!;
    const doc = iframe.contentDocument!;
    const records: Array<{ callback: ResizeObserverCallback; observed: Element[] }> = [];
    class CapturingObserver {
      readonly record: { callback: ResizeObserverCallback; observed: Element[] };
      constructor(callback: ResizeObserverCallback) {
        this.record = { callback, observed: [] };
        records.push(this.record);
      }
      observe(target: Element): void { this.record.observed.push(target); }
      unobserve(): void {}
      disconnect(): void {}
    }
    Object.defineProperty(view, 'ResizeObserver', { configurable: true, value: CapturingObserver });
    const el = document.createElement('lr-virtual-list') as LyraVirtualList;
    el.style.setProperty('--lr-virtual-list-height', '200px');
    el.rowHeight = 'auto';
    el.items = Array.from({ length: 20 }, (_, index) => index);
    el.keyFunction = numberKey;
    el.renderItem = renderText;
    doc.body.append(el);
    await el.updateComplete;
    await waitUntil(() => el.renderedRows.length > 0);
    const row = el.renderedRows[0]!;
    const rowRecord = records.find((record) => record.observed.includes(row));
    expect(rowRecord === undefined).to.equal(false);
    const before = el.offsetForIndex(1);

    iframe.remove();
    expect(iframe.contentWindow === null).to.equal(true);
    rowRecord!.callback(
      [{ target: row, borderBoxSize: [{ blockSize: before + 77, inlineSize: 100 }] } as unknown as ResizeObserverEntry],
      {} as ResizeObserver,
    );
    await el.updateComplete;

    expect(el.offsetForIndex(1)).to.equal(before + 77);
    el.remove();
  });
});

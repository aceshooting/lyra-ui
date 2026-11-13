import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import { LyraDataGrid } from './data-grid.js';

interface Row { id: number; name: string }
class ControlledResizeObserver implements ResizeObserver {
  readonly targets = new Set<Element>();
  disconnected = false;
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(target: Element): void { this.targets.add(target); this.disconnected = false; }
  unobserve(target: Element): void { this.targets.delete(target); }
  disconnect(): void { this.disconnected = true; }
  deliver(target: Element, width: number, borderBox = true): void {
    const box = { inlineSize: width, blockSize: target.getBoundingClientRect().height };
    this.callback([{
      target, borderBoxSize: borderBox ? [box] : [], contentBoxSize: [box], devicePixelContentBoxSize: [box],
      contentRect: new DOMRectReadOnly(0, 0, width, box.blockSize),
    }], this);
  }
}

async function settle(grid: LyraDataGrid<Row>): Promise<void> {
  await grid.updateComplete;
  await nextFrame();
  await grid.updateComplete;
  await nextFrame();
}

it('ignores queued measurements from a retired observer while the replacement still measures and navigates', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'ResizeObserver');
  const observers: ControlledResizeObserver[] = [];
  class Observer extends ControlledResizeObserver {
    constructor(callback: ResizeObserverCallback) { super(callback); observers.push(this); }
  }
  Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: Observer });
  let grid: LyraDataGrid<Row> | undefined;
  const originals = new Map<HTMLElement, PropertyDescriptor | undefined>();
  const readHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')!.get!;
  const restoreHeights = (): void => {
    for (const [row, original] of originals) {
      if (original) Object.defineProperty(row, 'offsetHeight', original);
      else Reflect.deleteProperty(row, 'offsetHeight');
    }
    originals.clear();
  };
  try {
    const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
    grid = new LyraDataGrid<Row>();
    grid.label = 'Records'; grid.rowKey = 'id';
    grid.style.cssText = 'block-size:240px;inline-size:300px';
    grid.columns = [{ field: 'name', label: 'Name' }];
    grid.data = Array.from({ length: 200 }, (_, id) => ({ id, name: `Row ${id}` }));
    wrapper.append(grid); await settle(grid);
    const body = grid.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
    const retired = observers.find(observer => observer.targets.has(body) && [...observer.targets].some(target => target.hasAttribute('data-virtual-item-key')))!;
    expect(retired !== undefined).to.equal(true);
    grid.remove(); expect(retired.disconnected).to.equal(true);
    wrapper.append(grid); await settle(grid);
    const current = [...observers].reverse().find(observer => observer.targets.has(body) && !observer.disconnected && [...observer.targets].some(target => target.hasAttribute('data-virtual-item-key')))!;
    expect(current !== undefined && current !== retired).to.equal(true);
    let reads = 0;
    for (const row of grid.shadowRoot!.querySelectorAll<HTMLElement>('[data-virtual-item-key]')) {
      originals.set(row, Object.getOwnPropertyDescriptor(row, 'offsetHeight'));
      Object.defineProperty(row, 'offsetHeight', { configurable: true, get() { reads++; return readHeight.call(row); } });
    }
    expect(originals.size).to.be.greaterThan(0);
    const scroll = body.scrollTop;
    retired.deliver(body, 120);
    await settle(grid);
    expect(reads).to.equal(0);
    expect(body.scrollTop).to.equal(scroll);
    expect(grid.getVisibleRows().length).to.equal(200);

    current.deliver(body, body.clientWidth, false);
    await settle(grid);
    expect(reads).to.be.greaterThan(0);
    restoreHeights();
    grid.scrollToIndex(120, { align: 'start' });
    await waitUntil(() => grid!.shadowRoot!.querySelector('[data-virtual-item-key="row:number:120"]') !== null);
    expect(Number.isFinite(body.scrollTop) && body.scrollTop > 0).to.equal(true);
    expect(grid.getVisibleRows()[120]?.name).to.equal('Row 120');
  } finally {
    restoreHeights();
    grid?.remove();
    if (descriptor) Object.defineProperty(window, 'ResizeObserver', descriptor);
    else Reflect.deleteProperty(window, 'ResizeObserver');
  }
});

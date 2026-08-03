import { expect, fixture, html } from '@open-wc/testing';
import '../components/layout/segmented/segmented.js';
import '../components/layout/tab-group/tab-group.js';
import '../components/layout/stepper/stepper.js';
import '../components/layout/virtual-list/virtual-list.js';
import '../components/data/timeline/timeline.js';

interface ResizeRecord {
  observed: Element[];
  disconnectCalls: number;
}

function installResizeObserverStub(owner: Window): { records: ResizeRecord[]; restore(): void } {
  const original = owner.ResizeObserver;
  const records: ResizeRecord[] = [];
  class StubResizeObserver implements ResizeObserver {
    private readonly record: ResizeRecord = { observed: [], disconnectCalls: 0 };

    constructor(_callback: ResizeObserverCallback) {
      records.push(this.record);
    }

    observe(target: Element): void {
      this.record.observed.push(target);
    }

    unobserve(): void {}

    disconnect(): void {
      this.record.disconnectCalls += 1;
    }
  }
  (owner as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = StubResizeObserver;
  return {
    records,
    restore(): void {
      (owner as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = original;
    },
  };
}

it('rebinds each scroll-overflow consumer to its destination owner after adoption', async () => {
  const frame = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (!frameDocument || !frameWindow) throw new Error('The iframe realm was unavailable.');
  const ambient = installResizeObserverStub(window);
  const destination = installResizeObserverStub(frameWindow);
  const tags = ['lr-segmented', 'lr-tab-group', 'lr-stepper', 'lr-timeline'] as const;
  const elements: Array<HTMLElement & { updateComplete: Promise<unknown> }> = [];

  try {
    for (const tagName of tags) {
      const element = document.createElement(tagName) as HTMLElement & {
        updateComplete: Promise<unknown>;
      };
      elements.push(element);
      document.body.append(element);
      await element.updateComplete;
    }
    expect(ambient.records.length).to.equal(tags.length);
    expect(ambient.records.every(({ observed }) => observed.length === 1)).to.be.true;

    for (const element of elements) {
      frameDocument.adoptNode(element);
      frameDocument.body.append(element);
      await element.updateComplete;
    }
    expect(ambient.records.every(({ disconnectCalls }) => disconnectCalls > 0)).to.be.true;
    expect(destination.records.length).to.equal(tags.length);
    expect(
      destination.records.every(({ observed }) =>
        observed.every((target) => target.ownerDocument === frameDocument),
      ),
    ).to.be.true;
  } finally {
    for (const element of elements) element.remove();
    destination.restore();
    ambient.restore();
    frame.remove();
  }
});

function installMotionStub(owner: Window, reduced: boolean): { restore(): void } {
  const original = owner.matchMedia;
  owner.matchMedia = ((query: string) =>
    ({
      media: query,
      matches: reduced && query === '(prefers-reduced-motion: reduce)',
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList) as typeof owner.matchMedia;
  return {
    restore(): void {
      owner.matchMedia = original;
    },
  };
}

it('reads reduced-motion preference from each adopted component owner window', async () => {
  const frame = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (!frameDocument || !frameWindow) throw new Error('The iframe realm was unavailable.');
  const ambient = installMotionStub(window, false);
  const destination = installMotionStub(frameWindow, true);
  const elements: Array<HTMLElement & { updateComplete: Promise<unknown> }> = [];

  try {
    const segmented = document.createElement('lr-segmented') as HTMLElement & {
      items: Array<{ value: string; label: string }>;
      scrollToValue(value: string): void;
      updateComplete: Promise<unknown>;
    };
    segmented.items = [{ value: 'one', label: 'One' }];
    elements.push(segmented);
    document.body.append(segmented);
    await segmented.updateComplete;
    frameDocument.adoptNode(segmented);
    frameDocument.body.append(segmented);
    await segmented.updateComplete;
    let segmentedBehavior: ScrollBehavior | undefined;
    const segment = segmented.shadowRoot!.querySelector('[part="segment"]') as HTMLElement;
    segment.scrollIntoView = (options?: boolean | ScrollIntoViewOptions) => {
      if (typeof options === 'object') segmentedBehavior = options.behavior;
    };
    segmented.scrollToValue('one');
    expect(segmentedBehavior).to.equal('auto');

    const tabGroup = document.createElement('lr-tab-group') as HTMLElement & {
      updateComplete: Promise<unknown>;
    };
    elements.push(tabGroup);
    document.body.append(tabGroup);
    await tabGroup.updateComplete;
    frameDocument.adoptNode(tabGroup);
    frameDocument.body.append(tabGroup);
    await tabGroup.updateComplete;
    let tabBehavior: ScrollBehavior | undefined;
    const tablist = tabGroup.shadowRoot!.querySelector('[part~="tablist"]') as HTMLElement;
    tablist.scrollBy = (options?: ScrollToOptions | number) => {
      if (typeof options === 'object') tabBehavior = options.behavior;
    };
    (tabGroup as unknown as { scrollTabs(edge: 'start' | 'end'): void }).scrollTabs('end');
    expect(tabBehavior).to.equal('instant');

    const virtualList = document.createElement('lr-virtual-list') as HTMLElement & {
      items: number[];
      rowHeight: number;
      renderItem(item: number): string;
      keyFunction(item: number): number;
      scrollToIndex(index: number, options?: { align?: 'start'; behavior?: 'smooth' }): void;
      updateComplete: Promise<unknown>;
    };
    virtualList.items = [1];
    virtualList.rowHeight = 40;
    virtualList.renderItem = (item) => String(item);
    virtualList.keyFunction = (item) => item;
    elements.push(virtualList);
    document.body.append(virtualList);
    await virtualList.updateComplete;
    frameDocument.adoptNode(virtualList);
    frameDocument.body.append(virtualList);
    await virtualList.updateComplete;
    let listBehavior: ScrollBehavior | undefined;
    const listBase = virtualList.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    listBase.scrollTo = (options?: ScrollToOptions | number) => {
      if (typeof options === 'object') listBehavior = options.behavior;
    };
    virtualList.scrollToIndex(0, { align: 'start', behavior: 'smooth' });
    expect(listBehavior).to.equal('auto');
  } finally {
    for (const element of elements) element.remove();
    destination.restore();
    ambient.restore();
    frame.remove();
  }
});

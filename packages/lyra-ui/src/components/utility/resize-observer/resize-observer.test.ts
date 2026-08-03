import { aTimeout, expect, fixture, html } from '@open-wc/testing';
import './resize-observer.js';
import type { LyraResizeObserver } from './resize-observer.class.js';

describe('<lr-resize-observer>', () => {
  it('observes slotted elements without adding layout', async () => {
    const el = await fixture<LyraResizeObserver>(html`<lr-resize-observer><button>Resize me</button></lr-resize-observer>`);
    expect(el.shadowRoot!.querySelector('[part="base"]')).to.exist;
    expect(getComputedStyle(el).display).to.equal('contents');
  });

  it('supports disabling observation', async () => {
    const el = await fixture<LyraResizeObserver>(html`<lr-resize-observer disabled><button>Resize me</button></lr-resize-observer>`);
    expect(el.disabled).to.equal(true);
  });

  it('is accessible', async () => {
    const el = await fixture<LyraResizeObserver>(html`<lr-resize-observer><button>Resize me</button></lr-resize-observer>`);
    await expect(el).to.be.accessible();
  });

  it('does not create a dangling observer when a property change re-observe is still queued at disconnect', async () => {
    const el = await fixture<LyraResizeObserver>(html`<lr-resize-observer><button>Resize me</button></lr-resize-observer>`);
    const parent = el.parentElement!;

    // Property change queues a re-observe via scheduleAfterUpdate; removing
    // the element right away races that queued microtask against disconnect.
    el.box = 'border-box';
    el.remove();
    await aTimeout(0);

    expect((el as unknown as { observer?: ResizeObserver }).observer, 'no observer should have been created post-disconnect').to.be.undefined;

    parent.append(el);
  });

  it('resumes observation after a bare reconnect with no property change (e.g. a reparent)', async () => {
    const el = await fixture<LyraResizeObserver>(html`<lr-resize-observer><button>Resize me</button></lr-resize-observer>`);
    const parent = el.parentElement!;
    await aTimeout(0);
    expect((el as unknown as { observer?: ResizeObserver }).observer, 'observer should exist after the initial connect').to.exist;

    // A pure reparent -- no property change, and the slot's assigned-node set
    // is unchanged, so slotchange never fires either.
    el.remove();
    expect((el as unknown as { observer?: ResizeObserver }).observer, 'observer should be torn down on disconnect').to.be.undefined;

    parent.append(el);
    await aTimeout(0);
    expect((el as unknown as { observer?: ResizeObserver }).observer, 'observer should be re-armed on reconnect').to.exist;
  });

  it('uses the adopted owner constructor and rejects stale callbacks across disconnect/reconnect', async () => {
    interface ObserverRecord {
      callback: ResizeObserverCallback;
      observed: Element[];
      disconnects: number;
    }
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow!;
    const originalObserver = frameWindow.ResizeObserver;
    const records: ObserverRecord[] = [];
    class OwnerResizeObserver implements ResizeObserver {
      private readonly record: ObserverRecord;
      constructor(callback: ResizeObserverCallback) {
        this.record = { callback, observed: [], disconnects: 0 };
        records.push(this.record);
      }
      observe(target: Element): void { this.record.observed.push(target); }
      unobserve(): void {}
      disconnect(): void { this.record.disconnects += 1; }
    }
    frameWindow.ResizeObserver = OwnerResizeObserver;
    const el = await fixture<LyraResizeObserver>(
      html`<lr-resize-observer><div></div></lr-resize-observer>`,
    );
    await aTimeout(0);
    const target = el.querySelector('div')!;
    el.remove();
    let events = 0;
    el.addEventListener('lr-resize', () => { events += 1; });

    try {
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      await aTimeout(0);
      expect(records.length, 'adoption constructs through the destination window').to.be.greaterThan(0);
      const adoptedCount = records.length;
      const adoptedObserver = records.at(-1)!;
      expect(adoptedObserver.observed.length).to.equal(1);
      expect(adoptedObserver.observed[0] === target).to.equal(true);

      el.remove();
      expect(adoptedObserver.disconnects, 'disconnect tears down the exact owner observer').to.equal(1);
      adoptedObserver.callback([], {} as ResizeObserver);
      expect(events, 'a retired callback cannot emit while detached').to.equal(0);

      frameDocument.body.append(el);
      await aTimeout(0);
      expect(records.length, 'reconnect constructs a fresh destination observer').to.be.greaterThan(adoptedCount);
      const reconnectedObserver = records.at(-1)!;
      adoptedObserver.callback([], {} as ResizeObserver);
      expect(events, 'the first lifecycle remains stale after reconnect').to.equal(0);
      reconnectedObserver.callback([], {} as ResizeObserver);
      expect(events, 'the current lifecycle still forwards entries').to.equal(1);
    } finally {
      el.remove();
      frameWindow.ResizeObserver = originalObserver;
      if (el.ownerDocument !== document) document.adoptNode(el);
      iframe.remove();
    }
  });

  it('fails closed when the owner window has no ResizeObserver capability', async () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow!;
    const originalObserver = frameWindow.ResizeObserver;
    const el = await fixture<LyraResizeObserver>(
      html`<lr-resize-observer><div></div></lr-resize-observer>`,
    );
    await aTimeout(0);
    el.remove();
    Object.defineProperty(frameWindow, 'ResizeObserver', { configurable: true, value: undefined });
    try {
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      await aTimeout(0);
      expect((el as unknown as { observer?: ResizeObserver }).observer === undefined).to.be.true;
    } finally {
      el.remove();
      Object.defineProperty(frameWindow, 'ResizeObserver', {
        configurable: true,
        writable: true,
        value: originalObserver,
      });
      if (el.ownerDocument !== document) document.adoptNode(el);
      iframe.remove();
    }
  });
});

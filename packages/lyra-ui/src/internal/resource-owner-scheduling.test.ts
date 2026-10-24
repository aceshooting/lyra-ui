import { expect, fixture, html } from '@open-wc/testing';
import { resolveOwnerFetchTarget, yieldViewerTask } from './resource-loader.js';

function restore(target: object, name: string, descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) Object.defineProperty(target, name, descriptor); else Reflect.deleteProperty(target, name);
}

describe('resource owner admission and scheduling', () => {
  it('rejects a connected element whose document has no active browsing context', () => {
    const doc = document.implementation.createHTMLDocument('Resource source');
    const element = doc.createElement('div');
    doc.body.append(element);
    expect(element.isConnected).to.equal(true);
    expect(doc.defaultView).to.equal(null);
    expect(resolveOwnerFetchTarget(element, 'data.json')).to.equal(null);
  });

  it('rejects a resolved unsafe base scheme and recovers when the owner base becomes fetchable', async () => {
    const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
    const doc = frame.contentDocument!;
    const view = frame.contentWindow!;
    const base = doc.createElement('base');
    base.href = 'ftp://example.invalid/files/';
    doc.head.append(base);
    const element = doc.createElement('div');
    doc.body.append(element);
    expect(doc.baseURI).to.equal('ftp://example.invalid/files/');
    expect(resolveOwnerFetchTarget(element, 'records.json')).to.equal(null);
    base.href = 'https://example.invalid/files/';
    const target = resolveOwnerFetchTarget(element, 'records.json');
    expect(target?.url).to.equal('https://example.invalid/files/records.json');
    expect(target?.view === view).to.equal(true);
  });

  it('awaits the owner scheduler and checks source authority only after it yields', async () => {
    const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
    const view = frame.contentWindow!;
    const previous = Object.getOwnPropertyDescriptor(view, 'scheduler');
    let resume!: () => void;
    const yielded = new Promise<void>(resolve => { resume = resolve; });
    let calls = 0, checks = 0, current = true;
    const scheduler = { yield() { calls++; expect(this === scheduler).to.equal(true); return yielded; } };
    Object.defineProperty(view, 'scheduler', { configurable: true, value: scheduler });
    try {
      const result = yieldViewerTask(view, () => { checks++; return current; });
      expect(calls).to.equal(1);
      expect(checks).to.equal(0);
      current = false;
      resume();
      let caught: unknown;
      try { await result; } catch (error) { caught = error; }
      expect(caught).to.be.instanceOf(DOMException);
      expect((caught as DOMException).name).to.equal('AbortError');
      expect(checks).to.equal(1);
    } finally { restore(view, 'scheduler', previous); }
  });

  it('uses the owner idle callback with a bounded timeout when scheduler yielding is absent', async () => {
    const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
    const view = frame.contentWindow!;
    const previousScheduler = Object.getOwnPropertyDescriptor(view, 'scheduler');
    const previousIdle = Object.getOwnPropertyDescriptor(view, 'requestIdleCallback');
    const idle: { callback?: IdleRequestCallback; timeout?: number; correctOwner: boolean } = { correctOwner: false };
    Object.defineProperty(view, 'scheduler', { configurable: true, value: undefined });
    Object.defineProperty(view, 'requestIdleCallback', { configurable: true, value: function (this: Window, next: IdleRequestCallback, options?: IdleRequestOptions) {
      idle.correctOwner = this === view;
      idle.callback = next;
      idle.timeout = options?.timeout;
      return 1;
    } });
    try {
      let checks = 0;
      const result = yieldViewerTask(view, () => { checks++; return true; });
      expect(idle.correctOwner).to.equal(true);
      expect(idle.timeout).to.equal(50);
      expect(checks).to.equal(0);
      if (!idle.callback) throw new Error('Expected the owner idle callback');
      idle.callback({ didTimeout: false, timeRemaining: () => 10 });
      await result;
      expect(checks).to.equal(1);
    } finally {
      restore(view, 'scheduler', previousScheduler);
      restore(view, 'requestIdleCallback', previousIdle);
    }
  });
});

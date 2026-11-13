import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './mutation-observer.js';
import type { LyraMutationObserver } from './mutation-observer.js';

describe('mutation observer delivery boundaries', () => {
  it('drops an unreadable observer batch and resumes delivery with the original native records', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'MutationObserver');
    const NativeObserver = window.MutationObserver;
    const observers: Observer[] = [];
    class Observer implements MutationObserver {
      readonly targets = new Set<Node>();
      private readonly native: MutationObserver;
      constructor(private readonly callback: MutationCallback) {
        this.native = new NativeObserver(records => callback(records, this)); observers.push(this);
      }
      observe(target: Node, options?: MutationObserverInit): void { this.targets.add(target); this.native.observe(target, options); }
      disconnect(): void { this.targets.clear(); this.native.disconnect(); }
      takeRecords(): MutationRecord[] { return this.native.takeRecords(); }
      deliver(records: MutationRecord[]): void { this.callback(records, this); }
    }
    let element: LyraMutationObserver | undefined;
    Object.defineProperty(window, 'MutationObserver', { configurable: true, value: Observer });
    try {
      element = await fixture<LyraMutationObserver>(html`<lr-mutation-observer attr="data-state"><div></div></lr-mutation-observer>`);
      const target = element.querySelector('div')!;
      await waitUntil(() => observers.some(observer => observer.targets.has(target)));
      const observer = observers.find(candidate => candidate.targets.has(target))!;
      let events = 0;
      element.addEventListener('lr-mutation', () => events++);
      const revoked = Proxy.revocable<MutationRecord[]>([], {}); revoked.revoke();
      observer.deliver(revoked.proxy);
      expect(events).to.equal(0);
      target.setAttribute('data-state', 'ready');
      const records = observer.takeRecords();
      expect(records.length).to.equal(1);
      const eventPromise = oneEvent(element, 'lr-mutation'); observer.deliver(records);
      const event = await eventPromise;
      expect(events).to.equal(1);
      expect(event.detail.records[0] === records[0]).to.equal(true);
      expect(event.detail.records === event.detail.mutationList).to.equal(true);
      expect(Object.isFrozen(event.detail.records)).to.equal(true);
      expect(Object.isFrozen(records)).to.equal(false);
    } finally {
      try { element?.remove(); observers.forEach(observer => observer.disconnect()); }
      finally {
        if (original) Object.defineProperty(window, 'MutationObserver', original);
        else Reflect.deleteProperty(window, 'MutationObserver');
      }
    }
  });

  it('drains queued native records under their original options before installing a replacement filter', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'MutationObserver');
    const NativeObserver = window.MutationObserver;
    const observers: Observer[] = [];
    class Observer implements MutationObserver {
      readonly targets = new Set<Node>();
      pending: MutationRecord[] = [];
      private readonly native: MutationObserver;
      constructor(callback: MutationCallback) {
        this.native = new NativeObserver(records => callback(records, this)); observers.push(this);
      }
      observe(target: Node, options?: MutationObserverInit): void { this.targets.add(target); this.native.observe(target, options); }
      disconnect(): void { this.targets.clear(); this.native.disconnect(); }
      takeRecords(): MutationRecord[] { const records = [...this.pending, ...this.native.takeRecords()]; this.pending = []; return records; }
      queueCurrentRecords(): void { this.pending.push(...this.native.takeRecords()); }
    }
    let element: LyraMutationObserver | undefined;
    Object.defineProperty(window, 'MutationObserver', { configurable: true, value: Observer });
    try {
      element = await fixture<LyraMutationObserver>(html`<lr-mutation-observer attr="data-before" attr-old-value><div data-before="old"></div></lr-mutation-observer>`);
      const target = element.querySelector('div')!;
      await waitUntil(() => observers.some(observer => observer.targets.has(target)));
      const observer = observers.find(candidate => candidate.targets.has(target))!;
      const delivered: (readonly MutationRecord[])[] = [];
      element.addEventListener('lr-mutation', event => delivered.push(event.detail.records));
      target.setAttribute('data-before', 'new'); observer.queueCurrentRecords();
      const pending = observer.pending[0];
      expect(pending?.oldValue).to.equal('old'); expect(delivered.length).to.equal(0);
      element.attr = 'data-after'; await element.updateComplete;
      await waitUntil(() => delivered.length === 1);
      expect(delivered[0]?.[0] === pending).to.equal(true);
      expect(delivered[0]?.map(record => record.attributeName)).to.deep.equal(['data-before']);
      expect(Object.isFrozen(delivered[0])).to.equal(true);
      expect(observer.targets.size).to.equal(0);
      const eventPromise = oneEvent(element, 'lr-mutation');
      target.setAttribute('data-before', 'ignored'); target.setAttribute('data-after', 'accepted');
      await eventPromise;
      expect(delivered.length).to.equal(2);
      expect(delivered[1]?.map(record => record.attributeName)).to.deep.equal(['data-after']);
    } finally {
      try { element?.remove(); observers.forEach(observer => observer.disconnect()); }
      finally {
        if (original) Object.defineProperty(window, 'MutationObserver', original);
        else Reflect.deleteProperty(window, 'MutationObserver');
      }
    }
  });

  it('retains only own string filter entries and recovers after an unreadable filter assignment', async () => {
    const element = await fixture<LyraMutationObserver>(html`<lr-mutation-observer child-list><div data-state="old"></div></lr-mutation-observer>`);
    const target = element.querySelector('div')!;
    let accessorReads = 0;
    const filter: unknown[] = ['data-state', 3, , null];
    Object.defineProperty(filter, '4', { configurable: true, get() { accessorReads++; throw new Error('Accessor is not data'); } });
    Reflect.set(element, 'attributeFilter', filter); await element.updateComplete;
    const firstPromise = oneEvent(element, 'lr-mutation');
    target.setAttribute('data-ignored', 'no'); target.setAttribute('data-state', 'new');
    const first = await firstPromise;
    expect(first.detail.records.map((record: MutationRecord) => record.attributeName)).to.deep.equal(['data-state']);
    expect(accessorReads).to.equal(0);
    const revoked = Proxy.revocable<string[]>([], {}); revoked.revoke();
    let failedLengths = 0;
    const unreadableLength = new Proxy(['data-ignored'], {
      getOwnPropertyDescriptor(value, key) {
        if (key === 'length') { failedLengths++; throw new Error('Filter length is unavailable'); }
        return Reflect.getOwnPropertyDescriptor(value, key);
      },
    });
    for (const unusable of [revoked.proxy, unreadableLength]) {
      Reflect.set(element, 'attributeFilter', unusable); await element.updateComplete;
      const childPromise = oneEvent(element, 'lr-mutation'); target.append(document.createElement('span'));
      const child = await childPromise;
      expect(child.detail.records.map((record: MutationRecord) => record.type)).to.deep.equal(['childList']);
    }
    expect(failedLengths).to.be.greaterThan(0);
    element.attributeFilter = ['data-recovered']; await element.updateComplete;
    const recoveredPromise = oneEvent(element, 'lr-mutation'); target.setAttribute('data-recovered', 'yes');
    const recovered = await recoveredPromise;
    expect(recovered.detail.records.map((record: MutationRecord) => record.attributeName)).to.deep.equal(['data-recovered']);
  });

  it('survives a failed slot assignment lookup and observes the next valid slot configuration', async () => {
    const element = await fixture<LyraMutationObserver>(html`<lr-mutation-observer child-list><div></div></lr-mutation-observer>`);
    const slot = element.shadowRoot!.querySelector('slot')!;
    const original = Object.getOwnPropertyDescriptor(slot, 'assignedElements');
    let failedReads = 0;
    Object.defineProperty(slot, 'assignedElements', { configurable: true, value: () => { failedReads++; throw new Error('Slot is unavailable'); } });
    try {
      element.withoutSubtree = true; await element.updateComplete;
      expect(failedReads).to.be.greaterThan(0);
    } finally {
      if (original) Object.defineProperty(slot, 'assignedElements', original);
      else Reflect.deleteProperty(slot, 'assignedElements');
    }
    element.withoutSubtree = false; await element.updateComplete;
    const pending = oneEvent(element, 'lr-mutation'); element.querySelector('div')!.append(document.createElement('span'));
    const event = await pending;
    expect(event.detail.records.map((record: MutationRecord) => record.type)).to.deep.equal(['childList']);
  });
});

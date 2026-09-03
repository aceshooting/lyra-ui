import { aTimeout, expect, fixture, html, oneEvent } from '@open-wc/testing';
import './mutation-observer.js';
import type { LyraMutationObserver } from './mutation-observer.class.js';

describe('<lr-mutation-observer>', () => {
  it('reflects the mapped observer attributes after property assignment', async () => {
    const el = await fixture<LyraMutationObserver>(html`<lr-mutation-observer></lr-mutation-observer>`);
    el.childList = true;
    el.attr = 'data-state';
    el.attrOldValue = true;
    el.charData = true;
    el.charDataOldValue = true;
    await el.updateComplete;
    expect(el.getAttribute('child-list')).to.equal('');
    expect(el.getAttribute('attr')).to.equal('data-state');
    expect(el.getAttribute('attr-old-value')).to.equal('');
    expect(el.getAttribute('char-data')).to.equal('');
    expect(el.getAttribute('char-data-old-value')).to.equal('');
  });
  it('forwards mutations from slotted content', async () => {
    const el = await fixture<LyraMutationObserver>(html`<lr-mutation-observer child-list><div></div></lr-mutation-observer>`);
    await el.updateComplete;
    const target = el.querySelector('div')!;
    const event = oneEvent(el, 'lr-mutation');
    target.append(document.createElement('span'));
    const result = await event as CustomEvent<{
      readonly records: readonly MutationRecord[];
      readonly mutationList: readonly MutationRecord[];
    }>;
    expect(result.detail.records.length).to.be.greaterThan(0);
    expect(result.detail.mutationList).to.equal(result.detail.records);
    expect(Object.isFrozen(result.detail)).to.equal(true);
    expect(Object.isFrozen(result.detail.records)).to.equal(true);
  });

  it('coalesces synchronous mutations across multiple slotted targets into one shared-observer event', async () => {
    const el = await fixture<LyraMutationObserver>(
      html`<lr-mutation-observer child-list><div id="a"></div><div id="b"></div></lr-mutation-observer>`,
    );
    await el.updateComplete;
    const a = el.querySelector('#a')!;
    const b = el.querySelector('#b')!;

    let eventCount = 0;
    let lastRecordCount = 0;
    el.addEventListener('lr-mutation', ((e: CustomEvent<{ readonly records: readonly MutationRecord[] }>) => {
      eventCount++;
      lastRecordCount = e.detail.records.length;
    }) as EventListener);

    const event = oneEvent(el, 'lr-mutation');
    // Two different observed targets mutated synchronously in the same script -- a single shared
    // MutationObserver instance batches both into one microtask callback (one event, two records);
    // one MutationObserver per target would instead fire one event per target.
    a.textContent = 'x';
    b.textContent = 'y';
    await event;
    await new Promise((r) => setTimeout(r, 0));

    expect(eventCount).to.equal(1);
    expect(lastRecordCount).to.equal(2);
  });

  it('drives observation solely through the internal <slot>, not a host-level slotchange listener', async () => {
    const el = await fixture<LyraMutationObserver>(html`<lr-mutation-observer child-list><div></div></lr-mutation-observer>`);
    await el.updateComplete;

    let hostSlotchangeFired = false;
    el.addEventListener('slotchange', () => {
      hostSlotchangeFired = true;
    });

    const target = el.querySelector('div')!;
    const event = oneEvent(el, 'lr-mutation');
    target.append(document.createElement('span'));
    await event;

    // slotchange bubbles only within the shadow tree (composed: false), so a listener added
    // directly on the host element never observes it -- mutation forwarding must therefore be
    // driven entirely by the internal <slot>'s own @slotchange template binding, confirming
    // there is no host-level slotchange wiring left to maintain.
    expect(hostSlotchangeFired).to.equal(false);
  });

  it('still reports mutations after a bare reconnect with no property change (e.g. a reparent)', async () => {
    const el = await fixture<LyraMutationObserver>(html`<lr-mutation-observer child-list><div></div></lr-mutation-observer>`);
    await el.updateComplete;
    const parent = el.parentElement!;

    // A pure reparent -- no property change, and the slot's assigned-node set
    // is unchanged, so neither updated() nor slotchange re-arms observation;
    // only connectedCallback's own re-arm covers this path.
    el.remove();
    parent.append(el);
    await aTimeout(0);

    const target = el.querySelector('div')!;
    const event = oneEvent(el, 'lr-mutation');
    target.append(document.createElement('span'));
    const result = (await event) as CustomEvent<{ records: MutationRecord[] }>;
    expect(result.detail.records.length).to.be.greaterThan(0);
  });

  it('uses the adopted owner constructor and rejects stale callbacks across disconnect/reconnect', async () => {
    interface ObserverRecord {
      callback: MutationCallback;
      observed: Node[];
      disconnects: number;
    }
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow!;
    const originalObserver = frameWindow.MutationObserver;
    const records: ObserverRecord[] = [];
    class OwnerMutationObserver implements MutationObserver {
      private readonly record: ObserverRecord;
      constructor(callback: MutationCallback) {
        this.record = { callback, observed: [], disconnects: 0 };
        records.push(this.record);
      }
      observe(target: Node): void { this.record.observed.push(target); }
      disconnect(): void { this.record.disconnects += 1; }
      takeRecords(): MutationRecord[] { return []; }
    }
    frameWindow.MutationObserver = OwnerMutationObserver;
    const el = await fixture<LyraMutationObserver>(
      html`<lr-mutation-observer child-list><div></div></lr-mutation-observer>`,
    );
    await aTimeout(0);
    const target = el.querySelector('div')!;
    el.remove();
    let events = 0;
    el.addEventListener('lr-mutation', () => { events += 1; });

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
      adoptedObserver.callback([], {} as MutationObserver);
      expect(events, 'a retired callback cannot emit while detached').to.equal(0);

      frameDocument.body.append(el);
      await aTimeout(0);
      expect(records.length, 'reconnect constructs a fresh destination observer').to.be.greaterThan(adoptedCount);
      const reconnectedObserver = records.at(-1)!;
      adoptedObserver.callback([], {} as MutationObserver);
      expect(events, 'the first lifecycle remains stale after reconnect').to.equal(0);
      reconnectedObserver.callback([], {} as MutationObserver);
      expect(events, 'the current lifecycle still forwards records').to.equal(1);
    } finally {
      el.remove();
      frameWindow.MutationObserver = originalObserver;
      if (el.ownerDocument !== document) document.adoptNode(el);
      iframe.remove();
    }
  });

  it('fails closed when the owner window has no MutationObserver capability', async () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow!;
    const originalObserver = frameWindow.MutationObserver;
    const el = await fixture<LyraMutationObserver>(
      html`<lr-mutation-observer child-list><div></div></lr-mutation-observer>`,
    );
    await aTimeout(0);
    el.remove();
    Object.defineProperty(frameWindow, 'MutationObserver', { configurable: true, value: undefined });
    try {
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      await aTimeout(0);
      expect((el as unknown as { observer?: MutationObserver }).observer === undefined).to.be.true;
    } finally {
      el.remove();
      Object.defineProperty(frameWindow, 'MutationObserver', {
        configurable: true,
        writable: true,
        value: originalObserver,
      });
      if (el.ownerDocument !== document) document.adoptNode(el);
      iframe.remove();
    }
  });

  it('supports disabled observation', async () => {
    const el = await fixture<LyraMutationObserver>(html`<lr-mutation-observer disabled><div></div></lr-mutation-observer>`);
    expect(el.disabled).to.equal(true);
  });

  describe('mapped observer defaults and compatibility aliases', () => {
    it('defaults child-list to false while retaining Lyra\'s subtree default', async () => {
      const el = await fixture<LyraMutationObserver>(
        html`<lr-mutation-observer><div></div></lr-mutation-observer>`,
      );
      expect(el.childList).to.equal(false);
      expect(el.subtree).to.equal(true);
    });

    it('enables child-list from its plain HTML boolean attribute', async () => {
      const el = await fixture<LyraMutationObserver>(html`<lr-mutation-observer child-list><div></div></lr-mutation-observer>`);
      expect(el.childList).to.equal(true);
    });

    it('an observer with child-list="false" ignores child mutations but still reports attribute mutations', async () => {
      const el = await fixture<LyraMutationObserver>(
        html`<lr-mutation-observer attributes><div></div></lr-mutation-observer>`,
      );
      await el.updateComplete;
      const target = el.querySelector('div')!;

      let fired = false;
      el.addEventListener('lr-mutation', () => {
        fired = true;
      });

      target.append(document.createElement('span'));
      await aTimeout(20);
      expect(fired, 'child-list mutation must NOT be reported').to.equal(false);

      const event = oneEvent(el, 'lr-mutation');
      target.setAttribute('data-x', '1');
      const result = (await event) as CustomEvent<{ records: MutationRecord[] }>;
      expect(result.detail.records.length).to.be.greaterThan(0);
    });

    it('enables attribute observation from the observeAttributes alias set as a property, not just its attributes HTML attribute', async () => {
      const el = await fixture<LyraMutationObserver>(
        html`<lr-mutation-observer><div></div></lr-mutation-observer>`,
      );
      el.observeAttributes = true;
      await el.updateComplete;
      await aTimeout(0);
      const target = el.querySelector('div')!;

      const event = oneEvent(el, 'lr-mutation');
      target.setAttribute('data-x', '1');
      const result = (await event) as CustomEvent<{ records: MutationRecord[] }>;
      expect(result.detail.records.length).to.be.greaterThan(0);
    });

    it('enables character-data observation from the characterData alias set as a property', async () => {
      const el = await fixture<LyraMutationObserver>(
        html`<lr-mutation-observer><div>Before</div></lr-mutation-observer>`,
      );
      el.characterData = true;
      await el.updateComplete;
      await aTimeout(0);
      const target = el.querySelector('div')!;

      const event = oneEvent(el, 'lr-mutation');
      target.firstChild!.textContent = 'After';
      const result = (await event) as CustomEvent<{ records: MutationRecord[] }>;
      expect(result.detail.records.length).to.be.greaterThan(0);
    });

    it('reflects the observeAttributes and characterData aliases to their attributes, like every other mapped observer attribute on this element', async () => {
      const el = await fixture<LyraMutationObserver>(
        html`<lr-mutation-observer><div></div></lr-mutation-observer>`,
      );
      el.observeAttributes = true;
      el.characterData = true;
      await el.updateComplete;
      expect(el.getAttribute('attributes')).to.equal('');
      expect(el.getAttribute('character-data')).to.equal('');

      el.observeAttributes = false;
      el.characterData = false;
      await el.updateComplete;
      expect(el.hasAttribute('attributes')).to.equal(false);
      expect(el.hasAttribute('character-data')).to.equal(false);
    });
  });

  it('supports attr/attr-old-value and char-data/char-data-old-value mapped aliases', async () => {
    const el = await fixture<LyraMutationObserver>(html`
      <lr-mutation-observer attr="data-state" attr-old-value char-data char-data-old-value>
        <div data-state="before">Before</div>
      </lr-mutation-observer>
    `);
    await el.updateComplete;
    await aTimeout(0);
    const target = el.querySelector('div')!;

    const attributeEvent = oneEvent(el, 'lr-mutation');
    target.setAttribute('data-state', 'after');
    const attributeResult = (await attributeEvent) as CustomEvent<{ mutationList: MutationRecord[] }>;
    expect(attributeResult.detail.mutationList[0]?.oldValue).to.equal('before');

    const textEvent = oneEvent(el, 'lr-mutation');
    target.firstChild!.textContent = 'After';
    const textResult = (await textEvent) as CustomEvent<{ mutationList: MutationRecord[] }>;
    expect(textResult.detail.mutationList[0]?.oldValue).to.equal('Before');
  });

  it('treats a non-empty attributeFilter as enabling attribute observation', async () => {
    const el = await fixture<LyraMutationObserver>(
      html`<lr-mutation-observer><div></div></lr-mutation-observer>`,
    );
    el.attributeFilter = ['data-state'];
    await el.updateComplete;
    await aTimeout(0);

    const target = el.querySelector('div')!;
    const event = oneEvent(el, 'lr-mutation');
    target.setAttribute('data-state', 'ready');
    const result = (await event) as CustomEvent<{ records: MutationRecord[] }>;
    expect(result.detail.records.length).to.equal(1);
  });

  it('is accessible', async () => {
    const el = await fixture<LyraMutationObserver>(html`<lr-mutation-observer><button>Observed</button></lr-mutation-observer>`);
    await expect(el).to.be.accessible();
  });
});

it('contains a hostile attributeFilter option and keeps a valid observation alive', async () => {
  const OriginalMutationObserver = window.MutationObserver;
  let observed = 0;
  class TestMutationObserver {
    constructor(_callback: MutationCallback) {}
    observe(): void { observed += 1; }
    disconnect(): void {}
    takeRecords(): MutationRecord[] { return []; }
  }
  window.MutationObserver = TestMutationObserver as unknown as typeof MutationObserver;
  const hostileFilter = new Proxy([], {
    get() {
      throw new Error('filter trap must not run');
    },
  });
  let el: LyraMutationObserver | undefined;
  try {
    el = await fixture<LyraMutationObserver>(html`
      <lr-mutation-observer child-list><div>Observed</div></lr-mutation-observer>
    `);
    (el as unknown as { attributeFilter: unknown }).attributeFilter = hostileFilter;
    let rejected = false;
    try {
      await el.updateComplete;
      await aTimeout(0);
    } catch {
      rejected = true;
    }
    expect(rejected).to.equal(false);
    expect(observed).to.be.greaterThan(0);
  } finally {
    el?.remove();
    window.MutationObserver = OriginalMutationObserver;
  }
});

it('contains failed MutationObserver construction and one failed target while admitting a later target', async () => {
  const OriginalMutationObserver = window.MutationObserver;
  const observed: Element[] = [];
  let failConstruction = false;
  class TestMutationObserver {
    constructor(_callback: MutationCallback) {
      if (failConstruction) throw new Error('constructor failure');
    }
    observe(target: Node): void {
      if ((target as HTMLElement).id === 'bad') throw new Error('target failure');
      observed.push(target as Element);
    }
    disconnect(): void {}
    takeRecords(): MutationRecord[] { return []; }
  }
  window.MutationObserver = TestMutationObserver as unknown as typeof MutationObserver;
  let el: LyraMutationObserver | undefined;
  try {
    el = document.createElement('lr-mutation-observer') as LyraMutationObserver;
    el.childList = true;
    const bad = document.createElement('div');
    bad.id = 'bad';
    const good = document.createElement('div');
    good.id = 'good';
    el.append(bad, good);
    document.body.append(el);
    let rejected = false;
    try {
      await el.updateComplete;
      await aTimeout(0);
    } catch {
      rejected = true;
    }
    expect(rejected).to.equal(false);
    expect(observed.includes(good)).to.equal(true);

    failConstruction = true;
    el.attr = 'data-state';
    rejected = false;
    try {
      await el.updateComplete;
      await aTimeout(0);
    } catch {
      rejected = true;
    }
    expect(rejected).to.equal(false);
    expect((el as unknown as { observer?: MutationObserver }).observer).to.equal(undefined);
  } finally {
    el?.remove();
    window.MutationObserver = OriginalMutationObserver;
  }
});

it('contains a throwing owner capability lookup and resumes after it is restored', async () => {
  const originalCapability = Object.getOwnPropertyDescriptor(window, 'MutationObserver');
  const observed: Node[] = [];
  class TestMutationObserver {
    constructor(_callback: MutationCallback) {}
    observe(target: Node): void { observed.push(target); }
    disconnect(): void {}
    takeRecords(): MutationRecord[] { return []; }
  }
  Object.defineProperty(window, 'MutationObserver', {
    configurable: true,
    writable: true,
    value: TestMutationObserver,
  });
  let el: LyraMutationObserver | undefined;
  try {
    el = await fixture<LyraMutationObserver>(html`
      <lr-mutation-observer child-list><div>Observed</div></lr-mutation-observer>
    `);
    await aTimeout(0);
    const target = el.querySelector('div')!;
    expect(observed.includes(target)).to.equal(true);

    Object.defineProperty(window, 'MutationObserver', {
      configurable: true,
      get() {
        throw new Error('capability lookup must stay contained');
      },
    });
    let threw = false;
    try {
      (el as unknown as { observeTargets(): void }).observeTargets();
    } catch {
      threw = true;
    }
    expect(threw).to.equal(false);
    expect((el as unknown as { observer?: MutationObserver }).observer).to.equal(undefined);

    Object.defineProperty(window, 'MutationObserver', {
      configurable: true,
      writable: true,
      value: TestMutationObserver,
    });
    (el as unknown as { observeTargets(): void }).observeTargets();
    expect(observed.filter((entry) => entry === target).length).to.be.greaterThan(1);
  } finally {
    el?.remove();
    if (originalCapability) Object.defineProperty(window, 'MutationObserver', originalCapability);
    else Reflect.deleteProperty(window, 'MutationObserver');
  }
});

it('contains a throwing disconnect hook across rebuild and reconnect', async () => {
  const originalCapability = Object.getOwnPropertyDescriptor(window, 'MutationObserver');
  const observed: Node[] = [];
  let throwDisconnect = false;
  class TestMutationObserver {
    constructor(_callback: MutationCallback) {
      return new Proxy(
        {
          observe(target: Node): void { observed.push(target); },
          disconnect(): void {},
          takeRecords(): MutationRecord[] { return []; },
        },
        {
          get(target, key, receiver) {
            if (throwDisconnect && key === 'disconnect') {
              throw new Error('disconnect hook must stay contained');
            }
            return Reflect.get(target, key, receiver);
          },
        },
      ) as unknown as TestMutationObserver;
    }
  }
  Object.defineProperty(window, 'MutationObserver', {
    configurable: true,
    writable: true,
    value: TestMutationObserver,
  });
  let el: LyraMutationObserver | undefined;
  try {
    el = await fixture<LyraMutationObserver>(html`
      <lr-mutation-observer child-list><div>Observed</div></lr-mutation-observer>
    `);
    await aTimeout(0);
    const target = el.querySelector('div')!;
    const initialObservations = observed.filter((entry) => entry === target).length;
    expect(initialObservations).to.be.greaterThan(0);

    throwDisconnect = true;
    let threw = false;
    try {
      (el as unknown as { observeTargets(): void }).observeTargets();
    } catch {
      threw = true;
    }
    expect(threw).to.equal(false);
    const rebuiltObservations = observed.filter((entry) => entry === target).length;
    expect(rebuiltObservations).to.be.greaterThan(initialObservations);

    throwDisconnect = false;
    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await aTimeout(0);
    expect(observed.filter((entry) => entry === target).length).to.be.greaterThan(rebuiltObservations);
  } finally {
    throwDisconnect = false;
    el?.remove();
    if (originalCapability) Object.defineProperty(window, 'MutationObserver', originalCapability);
    else Reflect.deleteProperty(window, 'MutationObserver');
  }
});

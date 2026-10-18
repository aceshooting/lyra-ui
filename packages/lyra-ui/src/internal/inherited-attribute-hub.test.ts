import { expect } from '@open-wc/testing';
import { subscribeInheritedAttributes } from './inherited-attribute-hub.js';

describe('shared inherited attribute observation', () => {
  it('uses one observer per root and dispatches only subscribed attributes', async () => {
    const root = document.createElement('div');
    document.body.append(root);
    const first: string[] = [];
    const second: string[] = [];
    let constructions = 0;
    class CountingObserver extends MutationObserver {
      constructor(callback: MutationCallback) {
        super(callback);
        constructions += 1;
      }
    }
    const releaseFirst = subscribeInheritedAttributes(root, CountingObserver, {
      attributes: ['lang'],
      changed: (records) => first.push(...records.map((record) => record.attributeName ?? '')),
    });
    const releaseSecond = subscribeInheritedAttributes(root, CountingObserver, {
      attributes: ['data-lr-motion'],
      changed: (records) => second.push(...records.map((record) => record.attributeName ?? '')),
    });
    try {
      expect(constructions).to.equal(1);
      root.setAttribute('lang', 'fr');
      root.setAttribute('data-lr-motion', 'reduce');
      root.setAttribute('title', 'unrelated');
      await new Promise<void>((resolve) => queueMicrotask(resolve));
      expect(first).to.deep.equal(['lang']);
      expect(second).to.deep.equal(['data-lr-motion']);
    } finally {
      releaseFirst?.();
      releaseSecond?.();
      root.remove();
    }
  });
});

it('flushes pending records once to live subscribers and keeps unsubscribe silent', () => {
  const root = document.createElement('div');
  let first = 0; let second = 0;
  const a = subscribeInheritedAttributes(root, MutationObserver, { attributes: ['hidden'], changed: () => first++ })!;
  const b = subscribeInheritedAttributes(root, MutationObserver, { attributes: ['hidden'], changed: () => second++ })!;
  try {
    root.hidden = true; a.flush(); a.flush();
    expect(first).equal(1); expect(second).equal(1);
    root.hidden = false; a();
    expect(first).equal(1); expect(second).equal(2);
    a.flush(); expect(first).equal(1);
  } finally { a(); b(); }
});
it('does not notify a subscriber removed reentrantly during flush', () => {
  const root = document.createElement('div');
  let first = 0; let second = 0;
  let b: (() => void) | undefined;
  const a = subscribeInheritedAttributes(root, MutationObserver, { attributes: ['hidden'], changed: () => { first++; b?.(); a?.flush(); } })!;
  b = subscribeInheritedAttributes(root, MutationObserver, { attributes: ['hidden'], changed: () => second++ });
  try {
    root.hidden = true; a.flush();
    expect(first).equal(1); expect(second).equal(0);
  } finally { a(); b?.(); }
});

it('keeps identical subscriber churn at one observer configuration and preserves pending delivery', () => {
  const root = document.createElement('div');
  let configurations = 0;
  class CountingObserver extends MutationObserver {
    override observe(target: Node, options?: MutationObserverInit): void {
      configurations++;
      super.observe(target, options);
    }
  }
  const deliveries = Array<number>(500).fill(0);
  let signalReads = 0;
  const subscribe = (index: number) => subscribeInheritedAttributes(root, CountingObserver, {
    get attributes() { signalReads++; return ['hidden', 'class']; },
    changed: (records) => { deliveries[index]! += records.length; },
  })!;
  const releases = deliveries.map((_, index) => subscribe(index));
  try {
    expect(signalReads, 'each subscriber contributes its signals once at admission').to.equal(500);
    expect(configurations, 'shared signals configure the root once').to.equal(1);
    root.hidden = true;
    // Releasing one subscriber still drains the pending batch to every remaining live owner.
    releases[0]!();
    expect(deliveries[0]).to.equal(0);
    expect(deliveries.slice(1).every((count) => count === 1)).to.equal(true);
    releases[0] = subscribe(0);
    for (let index = 1; index < releases.length; index++) {
      releases[index]!();
      releases[index] = subscribe(index);
    }
    expect(configurations, 'unchanged signal union survives every rebind').to.equal(1);
    root.className = 'updated';
    releases[0]!.flush();
    releases[0]!.flush();
    expect(deliveries[0]).to.equal(1);
    expect(deliveries.slice(1).every((count) => count === 2)).to.equal(true);
  } finally {
    for (const release of releases) release();
  }
});

it('updates observer options when the last owner of each signal changes', () => {
  const root = document.createElement('div');
  const configurations: MutationObserverInit[] = [];
  class RecordingObserver extends MutationObserver {
    override observe(target: Node, options?: MutationObserverInit): void {
      configurations.push({ ...options });
      super.observe(target, options);
    }
  }
  const a = subscribeInheritedAttributes(root, RecordingObserver, {
    attributes: ['hidden', 'hidden'], changed: () => {},
  })!;
  const b = subscribeInheritedAttributes(root, RecordingObserver, {
    attributes: ['hidden'], childList: true, changed: () => {},
  })!;
  const c = subscribeInheritedAttributes(root, RecordingObserver, {
    attributes: ['class'], characterData: true, changed: () => {},
  })!;
  try {
    b();
    c();
    expect(configurations.map((options) => ({
      attributes: options.attributeFilter,
      childList: options.childList,
      characterData: options.characterData,
    }))).to.deep.equal([
      { attributes: ['hidden'], childList: false, characterData: false },
      { attributes: ['hidden'], childList: true, characterData: false },
      { attributes: ['hidden', 'class'], childList: true, characterData: true },
      { attributes: ['hidden', 'class'], childList: false, characterData: true },
      { attributes: ['hidden'], childList: false, characterData: false },
    ]);
  } finally { a(); b(); c(); }
});

it('retains a replacement hub created while the old hub drains its final subscribers', () => {
  const root = document.createElement('div');
  let constructions = 0;
  class CountingObserver extends MutationObserver {
    constructor(callback: MutationCallback) {
      super(callback);
      constructions++;
    }
  }
  let first = 0;
  let second = 0;
  let replacement = 0;
  let joined = 0;
  let b: ReturnType<typeof subscribeInheritedAttributes>;
  let c: ReturnType<typeof subscribeInheritedAttributes>;
  let d: ReturnType<typeof subscribeInheritedAttributes>;
  const a = subscribeInheritedAttributes(root, CountingObserver, {
    attributes: ['hidden'], changed: () => { first++; },
  })!;
  b = subscribeInheritedAttributes(root, CountingObserver, {
    attributes: ['hidden'],
    changed: () => {
      second++;
      b?.();
      c = subscribeInheritedAttributes(root, CountingObserver, {
        attributes: ['hidden'], changed: () => { replacement++; },
      });
    },
  });
  try {
    root.hidden = true;
    a();
    expect(first).to.equal(0);
    expect(second).to.equal(1);
    expect(replacement).to.equal(0);
    d = subscribeInheritedAttributes(root, CountingObserver, {
      attributes: ['hidden'], changed: () => { joined++; },
    });
    expect(constructions, 'the later subscriber shares the replacement root observer').to.equal(2);
    root.hidden = false;
    c!.flush();
    expect(replacement).to.equal(1);
    expect(joined).to.equal(1);
  } finally { a(); b?.(); c?.(); d?.(); }
});

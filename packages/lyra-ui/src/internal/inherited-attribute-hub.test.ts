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

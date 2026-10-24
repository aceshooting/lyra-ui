import { expect, waitUntil } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { SequenceStripItem } from './sequence-strip-item.js';
import type { LyraSequenceSource } from './sequence-strip-source.js';
import { SequenceStripSourceController } from './sequence-strip-source-controller.js';

const ranges = [{ startIndex: 0, endIndex: 2, categoryCounts: { a: 2 }, markerCount: 0, enabledCount: 2 }];
function source(): LyraSequenceSource<SequenceStripItem> {
  return { revision: 1, length: 2, summarize: () => ranges,
    getItem: index => ({ id: `item-${index}`, categoryId: 'a' }),
    findIndex: id => Number(id.slice(5)) };
}
function setup(locale: () => string = () => 'en') {
  const controllers = new Set<ReactiveController>();
  const host = Object.assign(document.createElement('div'), {
    addController: (controller: ReactiveController) => controllers.add(controller),
    removeController: (controller: ReactiveController) => controllers.delete(controller),
    requestUpdate: () => {}, updateComplete: Promise.resolve(true),
  }) satisfies HTMLElement & ReactiveControllerHost;
  document.body.append(host);
  const control = new SequenceStripSourceController(host, () => {}, locale);
  return { control, host,
    disconnect: () => { host.remove(); controllers.forEach(controller => controller.hostDisconnected?.()); },
    reconnect: () => { document.body.append(host); controllers.forEach(controller => controller.hostConnected?.()); },
    cleanup: () => { control.detach(); host.remove(); controllers.forEach(controller => controller.hostDisconnected?.()); },
  };
}
const ready = (control: SequenceStripSourceController) => waitUntil(() => control.snapshot !== undefined && !control.pending);

describe('sequence provider controller boundaries', () => {
  it('rejects missing provider methods before starting summary work', () => {
    for (const key of ['summarize', 'getItem', 'findIndex'] as const) {
      const test = setup(); let summaries = 0;
      const input = source(); input.summarize = () => { summaries++; return ranges; };
      Reflect.set(input, key, undefined);
      try {
        test.control.configure(input);
        expect(test.control.error, key).to.equal(true);
        expect(test.control.pending, key).to.equal(false);
        expect(test.control.snapshot === undefined, key).to.equal(true);
        expect(summaries, key).to.equal(0);
      } finally { test.cleanup(); }
    }
  });

  it('keeps a replacement source authoritative when metadata or method access reenters configuration', async () => {
    for (const key of ['revision', 'length', 'summarize', 'getItem', 'findIndex'] as const) {
      const test = setup(); const obsolete = source(); let oldSummaries = 0;
      obsolete.summarize = () => { oldSummaries++; return ranges; };
      const member = obsolete[key];
      const newer = { ...source(), length: 1,
        summarize: () => [{ startIndex: 0, endIndex: 1, categoryCounts: { replacement: 1 }, markerCount: 0, enabledCount: 1 }] };
      Object.defineProperty(obsolete, key, { get: () => { test.control.configure(newer); return member; } });
      try {
        test.control.configure(obsolete); await ready(test.control);
        expect(test.control.length, key).to.equal(1);
        expect([...test.control.snapshot!.counts.keys()], key).to.deep.equal(['replacement']);
        expect(test.control.error, key).to.equal(false); expect(oldSummaries, key).to.equal(0);
      } finally { test.cleanup(); }
    }
  });

  it('does not call a summary method whose deferred getter replaces its source', async () => {
    const test = setup(); const obsolete = source(); let gets = 0; let calls = 0;
    Object.defineProperty(obsolete, 'summarize', { get: () => {
      if (++gets > 1) test.control.configure({ ...source(), length: 0 });
      return () => { calls++; return ranges; };
    } });
    try {
      test.control.configure(obsolete); await ready(test.control);
      expect(test.control.length).to.equal(0);
      expect(test.control.snapshot!.ranges.length).to.equal(0);
      expect(calls).to.equal(0); expect(test.control.error).to.equal(false);
    } finally { test.cleanup(); }
  });

  it('discards a summary whose descriptor capture replaces the provider', async () => {
    const test = setup(); const input = source(); let replaced = false;
    const summaries = new Proxy(ranges, { getOwnPropertyDescriptor: (target, key) => {
      if (!replaced) { replaced = true; test.control.configure({ ...source(), length: 0 }); }
      return Reflect.getOwnPropertyDescriptor(target, key);
    } });
    input.summarize = () => summaries;
    try {
      test.control.configure(input); await ready(test.control);
      expect(test.control.length).to.equal(0);
      expect(test.control.snapshot!.ranges.length).to.equal(0);
      expect(test.control.error).to.equal(false);
    } finally { test.cleanup(); }
  });

  it('treats missing and out-of-range identity replies as unavailable without reading an item', async () => {
    for (const index of [null, -1, 2, 0.5]) {
      const test = setup(); const input = source(); let reads = 0;
      input.findIndex = () => index; input.getItem = () => { reads++; return null; };
      try {
        test.control.configure(input); await ready(test.control);
        expect(await test.control.resolve('item-0')).to.equal(null);
        expect(test.control.exactUnavailable).to.equal(true);
        expect(test.control.exactPending).to.equal(false);
        expect(test.control.error).to.equal(false); expect(reads).to.equal(0);
        expect(test.control.snapshot!.enabledCount).to.equal(2);
      } finally { test.cleanup(); }
    }
  });

  it('does not read an item after a pending identity lookup loses source authority', async () => {
    const test = setup(); const obsolete = source(); let reads = 0;
    let finish!: (index: number | null) => void;
    obsolete.findIndex = () => new Promise(resolve => { finish = resolve; });
    obsolete.getItem = () => { reads++; return { id: 'item-0', categoryId: 'a' }; };
    try {
      test.control.configure(obsolete); await ready(test.control);
      const result = test.control.resolve('item-0'); await waitUntil(() => typeof finish === 'function');
      test.control.configure(source());
      expect(await result).to.equal(null);
      finish(0); await ready(test.control);
      const accepted = await test.control.resolve(1);
      expect(accepted?.item.id).to.equal('item-1');
      expect(reads).to.equal(0); expect(test.control.exactUnavailable).to.equal(false);
    } finally { test.cleanup(); }
  });

  it('does not call an identity method returned after its getter disconnects the host', async () => {
    const test = setup(); const input = source(); let gets = 0; let calls = 0;
    Object.defineProperty(input, 'findIndex', { get: () => {
      if (++gets > 1) test.disconnect();
      return () => { calls++; return 0; };
    } });
    try {
      test.control.configure(input); await ready(test.control);
      expect(await test.control.resolve('item-0')).to.equal(null);
      expect(test.control.snapshot === undefined).to.equal(true);
      expect(test.control.exactPending).to.equal(false); expect(calls).to.equal(0);
    } finally { test.cleanup(); }
  });

  it('revokes an exact record when descriptor capture replaces the source', async () => {
    const test = setup(); const input = source(); let replaced = false;
    input.getItem = () => new Proxy({ id: 'item-0', categoryId: 'a' }, {
      getOwnPropertyDescriptor: (target, key) => {
        if (!replaced) { replaced = true; test.control.configure({ ...source(), length: 0 }); }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    try {
      test.control.configure(input); await ready(test.control);
      expect(await test.control.resolve(0)).to.equal(null); await ready(test.control);
      expect(test.control.length).to.equal(0); expect(test.control.exact === undefined).to.equal(true);
      expect(test.control.exactPending).to.equal(false); expect(test.control.error).to.equal(false);
    } finally { test.cleanup(); }
  });

  it('checks host lifecycle again after locale resolution for summary and exact requests', async () => {
    let disconnect: (() => void) | undefined;
    const test = setup(() => { const action = disconnect; disconnect = undefined; action?.(); return 'en'; });
    let summaries = 0; let reads = 0; const input = source();
    input.summarize = () => { summaries++; return ranges; };
    input.getItem = () => { reads++; return { id: 'item-0', categoryId: 'a' }; };
    try {
      disconnect = test.disconnect;
      test.control.configure(input);
      expect(test.control.pending).to.equal(false); expect(summaries).to.equal(0);
      test.reconnect(); test.control.configure(input); await ready(test.control);
      disconnect = test.disconnect;
      expect(await test.control.resolve(0)).to.equal(null);
      expect(test.control.exactPending).to.equal(false); expect(reads).to.equal(0);
      expect(test.control.snapshot === undefined).to.equal(true);
    } finally { test.cleanup(); }
  });
});

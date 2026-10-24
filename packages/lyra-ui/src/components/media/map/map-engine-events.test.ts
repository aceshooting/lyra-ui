import { expect } from '@open-wc/testing';
import { MapEngineEvents } from './map-engine-events.js';

describe('map peer event subscriptions', () => {
  it('shares one native listener and keeps remaining subscriptions after removal', () => {
    const handlers = new Map<string, (event: unknown) => void>();
    let registrations = 0;
    const peer = { on(type: string, listener: (event: unknown) => void) { registrations++; handlers.set(type, listener); return this; } };
    const events = new MapEngineEvents(); const calls: string[] = [];
    const first = events.subscribe(peer, 'load', () => { calls.push('first'); });
    events.subscribe(peer, 'load', () => { calls.push('second'); });
    expect(registrations).to.equal(1);
    handlers.get('load')?.({}); first(); handlers.get('load')?.({});
    expect(calls).to.deep.equal(['first', 'second', 'second']);
  });
  it('makes no-off old listeners inert and does not dispatch callbacks removed reentrantly', () => {
    const handlers: ((event: unknown) => void)[] = [];
    const peer = { on(_type: string, listener: (event: unknown) => void) { handlers.push(listener); return this; } };
    const events = new MapEngineEvents(); let calls = 0;
    let removeSecond = (): void => {};
    const removeFirst = events.subscribe(peer, 'idle', () => { removeSecond(); });
    removeSecond = events.subscribe(peer, 'idle', () => { calls++; });
    const oldNative = handlers[0];
    if (!oldNative) throw new Error('Expected initial native subscription');
    oldNative({}); expect(calls).to.equal(0); removeFirst();
    events.subscribe(peer, 'idle', () => { calls++; });
    oldNative({}); expect(calls).to.equal(0);
    const nextNative = handlers[1];
    if (!nextNative) throw new Error('Expected replacement native subscription');
    nextNative({}); expect(calls).to.equal(1);
  });
  it('supports synchronous delivery and does not resurrect cleared registration callbacks', () => {
    const events = new MapEngineEvents(); let calls = 0; let captured: ((event: unknown) => void) | undefined;
    const peer = { on(_type: string, listener: (event: unknown) => void) { captured = listener; listener({}); return this; } };
    events.subscribe(peer, 'load', () => { calls++; events.clear(peer); });
    expect(calls).to.equal(1); captured?.({}); expect(calls).to.equal(1);
  });

  it('rotates generation dispatchers while preserving subscriptions and their disposers', () => {
    const handlers: ((event: unknown) => void)[] = [];
    const peer = { on(_type: string, listener: (event: unknown) => void) { handlers.push(listener); return this; } };
    const events = new MapEngineEvents(); let calls = 0;
    const remove = events.subscribe(peer, 'error', () => { calls++; });
    const oldNative = handlers[0];
    if (!oldNative) throw new Error('Expected initial subscription');
    events.rotate(peer);
    oldNative({}); expect(calls).to.equal(0);
    const currentNative = handlers[1];
    if (!currentNative) throw new Error('Expected rotated subscription');
    currentNative({}); expect(calls).to.equal(1);
    remove(); currentNative({}); expect(calls).to.equal(1);
  });

  it('lets a nested rotation during native removal retain its newer dispatcher', () => {
    const events = new MapEngineEvents(); let handler: ((event: unknown) => void) | undefined;
    let nested = false; let calls = 0;
    const peer = {
      on(_type: string, listener: (event: unknown) => void) { handler = listener; return this; },
      off() { if (!nested) { nested = true; events.rotate(peer); } },
    };
    events.subscribe(peer, 'idle', () => { calls++; });
    events.rotate(peer); handler?.({}); expect(calls).to.equal(1);
  });

  it('removes the exact native callback on the final disposer', () => {
    let native: unknown; let removed: unknown;
    const peer = { on(_type: string, listener: unknown) { native = listener; return this; }, off(_type: string, listener: unknown) { removed = listener; } };
    const events = new MapEngineEvents(); const remove = events.subscribe(peer, 'error', () => {});
    remove(); remove(); expect(removed === native).to.equal(true);
  });
});

describe('map peer event subscription boundaries', () => {
  it('ignores a rotation for a peer that has no subscriptions', () => {
    let registrations = 0;
    const peer = { on() { registrations++; return this; } };
    new MapEngineEvents().rotate(peer);
    expect(registrations).to.equal(0);
  });

  it('skips a subscription released by an earlier native removal during rotation', () => {
    const events = new MapEngineEvents(); const registered: string[] = [], removed: string[] = [];
    let release = (): void => {};
    const peer = {
      on(type: string) { registered.push(type); return this; },
      off(type: string) { removed.push(type); if (type === 'load') release(); },
    };
    events.subscribe(peer, 'load', () => {});
    release = events.subscribe(peer, 'idle', () => {});
    events.rotate(peer);
    expect(registered).to.deep.equal(['load', 'idle', 'load']);
    expect(removed).to.deep.equal(['load', 'idle']);
  });

  it('keeps rotating when the previous native dispatcher cannot be removed', () => {
    const events = new MapEngineEvents(); const handlers: ((event: unknown) => void)[] = []; let calls = 0;
    const peer = { on(_type: string, listener: (event: unknown) => void) { handlers.push(listener); return this; }, off() { throw new Error('native detail'); } };
    events.subscribe(peer, 'idle', () => { calls++; });
    events.rotate(peer);
    expect(handlers.length).to.equal(2);
    handlers[0]!({}); expect(calls).to.equal(0);
    handlers[1]!({}); expect(calls).to.equal(1);
  });

  it('releases the remaining native subscriptions when one removal throws on clear', () => {
    const events = new MapEngineEvents(); const removed: string[] = [];
    const peer = { on() { return this; }, off(type: string) { removed.push(type); if (type === 'load') throw new Error('native detail'); } };
    events.subscribe(peer, 'load', () => {});
    events.subscribe(peer, 'idle', () => {});
    expect(() => events.clear(peer)).not.to.throw();
    expect(removed).to.deep.equal(['load', 'idle']);
  });

  it('does not remove a native listener twice when a disposer runs after the peer was cleared', () => {
    const events = new MapEngineEvents(); let removals = 0;
    const peer = { on() { return this; }, off() { removals++; } };
    const dispose = events.subscribe(peer, 'error', () => {});
    events.clear(peer);
    expect(removals).to.equal(1);
    dispose();
    expect(removals).to.equal(1);
  });
});

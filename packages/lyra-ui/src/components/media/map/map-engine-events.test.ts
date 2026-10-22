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

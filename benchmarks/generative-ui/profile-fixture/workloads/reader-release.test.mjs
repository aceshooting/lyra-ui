import test from 'node:test';
import assert from 'node:assert/strict';
import { readerReleaseVisible, armNativeHomeSettlement, createFixture, ascii } from './text.js';

function trace() {
  let time = 0, next = 0;
  const frames = new Map(), timers = new Map();
  const target = () => ({ listeners: new Map(), addEventListener(type, callback) { const callbacks = this.listeners.get(type) ?? new Set(); callbacks.add(callback); this.listeners.set(type, callbacks); },
    removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); },
    emit(type, extra = {}) { for (const callback of [...this.listeners.get(type) ?? []]) callback({ type, isTrusted: true, timeStamp: time, defaultPrevented: false, key: 'Home', ...extra }); } });
  const scroll = Object.assign(target(), { isConnected: true, scrollTop: 1500, scrollHeight: 2000, clientHeight: 500, onscrollend: null });
  const pill = { isConnected: true, style: { visibility: 'visible', display: 'block', opacity: '1' }, getClientRects: () => [1] };
  const win = { performance: { now: () => time }, getComputedStyle: node => node.style,
    requestAnimationFrame: callback => { frames.set(++next, callback); return next; }, cancelAnimationFrame: id => frames.delete(id),
    setTimeout: callback => { timers.set(++next, callback); return next; }, clearTimeout: id => timers.delete(id) };
  const viewport = { isConnected: true, follow: true, bottomThreshold: 24, ownerDocument: { defaultView: win },
    shadowRoot: { querySelector: selector => selector === '[part="scroll"]' ? scroll : pill } };
  const controller = new AbortController(); let current = true, ready = true;
  const armed = () => armNativeHomeSettlement({ viewport, signal: controller.signal, isCurrent: () => current, isReady: () => ready });
  return { scroll, pill, viewport, controller, frames, timers, armed,
    at(value) { time = value; }, setCurrent(value) { current = value; }, setReady(value) { ready = value; },
    frame() { time += 16; const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time)); },
    timeout() { for (const callback of [...timers.values()]) callback(); },
    assertClean() { assert.equal([...scroll.listeners.values()].reduce((sum, callbacks) => sum + callbacks.size, 0), 0); assert.equal(timers.size, 0); assert.equal(frames.size, 0); } };
}

test('visible follow release commits far from top and refuses bottom, stale or hidden controls', () => {
  const t = trace(); t.viewport.follow = false; t.scroll.scrollTop = 1200;
  assert.equal(readerReleaseVisible(t.viewport), true);
  for (const mutate of [() => { t.viewport.follow = true; }, () => { t.scroll.scrollTop = 1476; }, () => { t.pill.isConnected = false; },
    () => { t.pill.style.visibility = 'hidden'; }, () => { t.pill.style.display = 'none'; }, () => { t.pill.style.opacity = '0'; },
    () => { t.viewport.bottomThreshold = NaN; }, () => { t.viewport.isConnected = false; }]) {
    const original = { follow: t.viewport.follow, top: t.scroll.scrollTop, connected: t.viewport.isConnected, threshold: t.viewport.bottomThreshold,
      pillConnected: t.pill.isConnected, style: { ...t.pill.style } };
    mutate(); assert.equal(readerReleaseVisible(t.viewport), false);
    Object.assign(t.viewport, { follow: original.follow, isConnected: original.connected, bottomThreshold: original.threshold }); t.scroll.scrollTop = original.top;
    t.pill.isConnected = original.pillConnected; t.pill.style = original.style;
  }
});

test('early release measurement does not finish native settlement; same-event top and scrollend is accepted', async () => {
  const t = trace(), armed = t.armed(); let complete = false; void armed.wait.then(() => { complete = true; });
  t.at(10); t.scroll.emit('keydown'); t.at(30); t.scroll.scrollTop = 1300; t.viewport.follow = false; t.scroll.emit('scroll');
  assert.equal(readerReleaseVisible(t.viewport), true); await Promise.resolve(); assert.equal(complete, false);
  t.at(180); t.scroll.scrollTop = 0; t.scroll.emit('scrollend');
  assert.equal(armed.diagnose().firstTopAt, 180); assert.equal(armed.diagnose().scrollEndAt, 180);
  t.frame(); await Promise.resolve(); assert.equal(complete, false); t.frame();
  assert.deepEqual(await armed.wait, { schemaVersion: 1, endpoint: 'follow-release-visible-v1', nativeEventStart: 10, firstTopAt: 180,
    scrollEndAt: 180, settledAt: 212, finalTop: 0, finalFollowing: false, eventToTopMs: 170, eventToScrollEndMs: 170, eventToSettledMs: 202 });
  t.assertClean(); armed.dispose(); t.assertClean();
});

test('queued old scrollend and top without a native scrollend cannot settle', async () => {
  const t = trace(), armed = t.armed();
  t.scroll.emit('scrollend'); t.at(10); t.scroll.emit('keydown');
  t.at(20); t.scroll.scrollTop = 1400; t.viewport.follow = false; t.scroll.emit('scrollend');
  assert.equal(armed.diagnose().scrollEndAt, null);
  t.at(100); t.scroll.scrollTop = 0; t.scroll.emit('scroll'); t.frame(); t.frame();
  assert.equal(armed.diagnose().firstTopAt, 100); assert.equal(armed.diagnose().settledAt, null);
  t.timeout(); await assert.rejects(armed.wait, /settlement/u); t.assertClean();
  assert.equal(armed.diagnose().firstTopAt, 100); assert.equal(armed.diagnose().scrollEndAt, null);
});

test('renewed movement requires a fresh top scrollend and two consecutive stable frame checks', async () => {
  const t = trace(), armed = t.armed();
  t.at(10); t.scroll.emit('keydown'); t.viewport.follow = false; t.at(100); t.scroll.scrollTop = 0; t.scroll.emit('scrollend'); t.frame();
  t.scroll.scrollTop = 3; t.scroll.emit('scroll'); assert.equal(t.frames.size, 0);
  t.at(150); t.scroll.scrollTop = 0; t.scroll.emit('scroll'); t.frame(); assert.equal(armed.diagnose().settledAt, null);
  t.at(180); t.scroll.emit('scrollend'); t.frame(); t.frame();
  const result = await armed.wait; assert.equal(result.firstTopAt, 100); assert.equal(result.scrollEndAt, 180); assert.equal(result.settledAt, 212); t.assertClean();
});

for (const reason of ['abort', 'dispose', 'stale', 'disconnect', 'invalid-oracle', 'timeout', 'untrusted', 'prevented']) test(`${reason} rejects and cleans native settlement while retaining partial scalars`, async () => {
  const t = trace(), armed = t.armed(); t.at(10);
  t.scroll.emit('keydown', { isTrusted: reason !== 'untrusted', defaultPrevented: reason === 'prevented' });
  if (reason === 'abort') t.controller.abort();
  else if (reason === 'dispose') armed.dispose();
  else if (reason === 'stale') { t.setCurrent(false); t.scroll.emit('scroll'); }
  else if (reason === 'disconnect') { t.viewport.isConnected = false; t.scroll.emit('scroll'); }
  else if (reason === 'invalid-oracle') { t.viewport.follow = false; t.scroll.scrollTop = 0; t.setReady(false); t.scroll.emit('scrollend'); t.frame(); }
  else if (reason === 'timeout') t.timeout();
  await assert.rejects(armed.wait); assert.equal(armed.diagnose().settledAt, null); t.assertClean();
});

test('missing native scrollend capability fails before arming listeners', () => {
  const t = trace(); delete t.scroll.onscrollend;
  assert.throws(() => t.armed(), /scrollend/u); t.assertClean();
});

for (const finish of ['settle', 'timeout']) test(`T keeps the full oracle and original response measurement while native navigation must ${finish}`, async () => {
  const t = trace(), outer = new AbortController(); let measured, notify;
  const measurementDone = new Promise(resolve => { notify = resolve; });
  class Element {
    children = []; dataset = {}; style = {}; isConnected = true;
    append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
    querySelectorAll(selector) { return selector === 'lr-message-parts' ? this.children.flatMap(child => child.localName === selector ? [child] : child.querySelectorAll(selector)) : []; }
    dispatchEvent() { return true; }
    getClientRects() { return [1]; }
    remove() { this.isConnected = false; if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); }
  }
  class Parts extends Element {
    localName = 'lr-message-parts';
    shadowRoot = { querySelectorAll: () => this.parts.map(part => ({ textContent: part.text, dataset: { state: part.state } })),
      querySelector: () => ({ textContent: this.parts[0].text }) };
  }
  class Viewport extends Element {
    constructor() { super(); Object.assign(this, t.viewport); t.viewport = this; }
    scrollToBottom() { t.scroll.scrollTop = 1500; }
  }
  const host = new Element(), oldStyle = globalThis.getComputedStyle;
  globalThis.getComputedStyle = () => ({ visibility: 'visible' });
  const fixture = createFixture({ workload: 'T', host, signal: outer.signal, measurement: { pendingOperations: 0,
    async measureOperation(options) {
      if (options.trigger) { await options.trigger({ signal: outer.signal }); return { id: options.operation.id }; }
      t.at(10); t.scroll.emit('keydown'); t.at(30); t.viewport.follow = false; t.scroll.scrollTop = 1200; t.scroll.emit('scroll');
      await new Promise(resolve => setTimeout(resolve, 0));
      assert.equal(options.readOracle().status, 'committed');
      measured = { ...options.operation, generation: options.generation, start: 10, listenerReceipt: 10, semanticCommit: 30, renderOpportunity: 60, fingerprint: options.operation.expectedFingerprint, censored: false };
      notify(); return measured;
    } } }, { loadProduction: async () => [{ LyraMessageParts: Parts }, { LyraChatViewport: Viewport }, { LyraChatMessage: Element }] });
  try {
    const prepared = fixture.prepare({ manifest: { workload: 'T', sha256: 'a'.repeat(64) } });
    await fixture.runOperation({ operation: prepared.operations[0], generation: prepared.generation });
    const operation = prepared.operations[1]; let returned = false;
    const pending = fixture.runOperation({ operation, generation: prepared.generation }); void pending.then(() => { returned = true; }, () => {});
    await measurementDone; await Promise.resolve();
    assert.equal(returned, false); assert.equal(t.scroll.scrollTop, 1200);
    await assert.rejects(fixture.runOperation({ operation: prepared.operations[2], generation: prepared.generation }), /settlement is pending/u);
    const bodies = t.viewport.querySelectorAll('lr-message-parts'); bodies[0].parts[0].text = 'Incorrect visible answer';
    assert.equal(fixture.readOracle({ operation, generation: prepared.generation }).status, 'pending'); bodies[0].parts[0].text = ascii(0);
    assert.equal(fixture.readOracle({ operation, generation: prepared.generation }).status, 'committed');
    if (finish === 'settle') {
      t.at(180); t.scroll.scrollTop = 0; t.scroll.emit('scrollend'); t.frame(); t.frame();
      const result = await pending, { extras, ...original } = result;
      assert.deepEqual(original, measured); assert.equal(extras.readerRelease.eventToSettledMs, 202); assert.equal(extras.readerRelease.finalTop, 0);
    } else {
      t.timeout(); await assert.rejects(pending, /settlement/u);
      assert.deepEqual(fixture.diagnose().readerRelease.measurement, measured);
      assert.equal(fixture.diagnose().readerRelease.completion.nativeEventStart, 10);
      assert.equal(fixture.diagnose().readerRelease.completion.settledAt, null);
    }
    t.assertClean();
  } finally { await fixture.dispose(); if (oldStyle === undefined) delete globalThis.getComputedStyle; else globalThis.getComputedStyle = oldStyle; }
});

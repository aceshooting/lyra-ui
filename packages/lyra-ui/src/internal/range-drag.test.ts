import { expect, fixture, html } from '@open-wc/testing';
import type { ReactiveControllerHost } from 'lit';
import { RangeDragController, nearestRangeEnd, rangePointerRatio } from './range-drag.js';

function host(): ReactiveControllerHost & { isConnected: boolean } {
  return {
    isConnected: true,
    addController() {}, removeController() {}, requestUpdate() {},
    updateComplete: Promise.resolve(true),
  };
}

it('keeps concurrent pointers independent and releases every capture on abort', async () => {
  const target = await fixture<HTMLDivElement>(html`<div></div>`);
  const captured = new Set<number>();
  target.setPointerCapture = (id) => { captured.add(id); };
  target.hasPointerCapture = (id) => captured.has(id);
  target.releasePointerCapture = (id) => { captured.delete(id); };
  const moved: number[] = [];
  const controller = new RangeDragController<string>(host(), (event) => moved.push(event.pointerId), () => {});
  for (const id of [1, 2]) {
    controller.begin(new PointerEvent('pointerdown', { pointerId: id }), {
      handle: String(id), changed: false, captureTarget: target,
      rect: new DOMRect(0, 0, 100, 10), rtl: false,
    });
  }
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2 }));
  expect(moved).to.deep.equal([2]);
  expect(controller.end(1)?.handle).to.equal('1');
  expect([...captured]).to.deep.equal([2]);
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2 }));
  expect(moved).to.deep.equal([2, 2]);
  controller.abort();
  expect(captured.size).to.equal(0);
  expect(controller.active.size).to.equal(0);
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2 }));
  expect(moved).to.deep.equal([2, 2]);
});

it('rejects a second realm during a live drag and detaches the original realm on abort', async () => {
  const target = await fixture<HTMLDivElement>(html`<div></div>`);
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const otherTarget = frame.contentDocument!.createElement('div');
  frame.contentDocument!.body.append(otherTarget);
  let moves = 0;
  const controller = new RangeDragController<string>(host(), () => moves++, () => {});
  const state = (captureTarget: HTMLElement) => ({
    captureTarget, handle: 'start', changed: false, rect: null, rtl: false,
  });
  expect(Boolean(controller.begin(new PointerEvent('pointerdown', { pointerId: 1 }), state(target)))).to.equal(true);
  expect(Boolean(controller.begin(new PointerEvent('pointerdown', { pointerId: 2 }), state(otherTarget)))).to.equal(false);
  controller.abort();
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1 }));
  expect(moves).to.equal(0);
  expect(Boolean(controller.begin(new PointerEvent('pointerdown', { pointerId: 2 }), state(otherTarget)))).to.equal(true);
  controller.abort();
});

it('mirrors the inline ratio, keeps vertical increasing upward, and breaks endpoint ties consistently', () => {
  const rect = new DOMRect(20, 30, 100, 200);
  expect(rangePointerRatio(45, 80, rect, false)).to.equal(0.25);
  expect(rangePointerRatio(45, 80, rect, true)).to.equal(0.75);
  expect(rangePointerRatio(45, 80, rect, true, true)).to.equal(0.75);
  expect(rangePointerRatio(-100, 0, rect, false)).to.equal(0);
  expect(nearestRangeEnd(40, 50, 50)).to.equal(0);
  expect(nearestRangeEnd(60, 50, 50)).to.equal(1);
});

import { expect } from '@open-wc/testing';
import { createLyraEvent } from './event-factory.js';

it("matches lr-confirm-bar's own documented contract: lr-approve is cancelable, bubbling, and composed", () => {
  const event = createLyraEvent('lr-confirm-bar', 'lr-approve', undefined);
  expect(event.type).to.equal('lr-approve');
  expect(event.cancelable).to.be.true;
  expect(event.bubbles).to.be.true;
  expect(event.composed).to.be.true;
});

it('reports cancelable: false for a non-cancelable event, and carries the detail it was given', () => {
  const event = createLyraEvent('lr-confirm-bar', 'lr-decision-settled', { decision: 'approved' });
  expect(event.cancelable).to.be.false;
  expect(event.detail).to.deep.equal({ decision: 'approved' });
});

it('normalizes an omitted detail to null, matching LyraElement.emit()', () => {
  const event = createLyraEvent('lr-confirm-bar', 'lr-decision-settled', undefined);
  expect(event.detail).to.equal(null);
});

it('looks the cancelable flag up per tag, not per event name -- lr-switch-toggle-request is a different tag with its own detail shape', () => {
  const event = createLyraEvent('lr-switch', 'lr-switch-toggle-request', { checked: true, value: 'on' });
  expect(event.cancelable).to.be.true;
  expect(event.detail).to.deep.equal({ checked: true, value: 'on' });
});

it('produces a real CustomEvent whose flags let a preventDefault-based handler actually run -- the exact bug the hand-rolled alternative silently missed', () => {
  const target = document.createElement('div');
  let sawEvent = false;
  target.addEventListener('lr-approve', (event) => {
    sawEvent = true;
    event.preventDefault();
  });
  const event = createLyraEvent('lr-confirm-bar', 'lr-approve', { args: null, waitUntil: () => {} });
  target.dispatchEvent(event);
  expect(sawEvent).to.be.true;
  expect(event.defaultPrevented).to.be.true;
});

it('rejects a wrong detail shape, an event name the tag does not document, and an unregistered tag at compile time', () => {
  // Enforced by `tsc --noEmit` (part of `pnpm lint`), not by this test running: the calls below
  // are intentionally never invoked, only type-checked. A stale `@ts-expect-error` (one of these
  // calls stops being a type error) fails the type checker on its own, with no separate gate.
  function typeOnlyMisuse() {
    // @ts-expect-error lr-approve's detail is `{ args, waitUntil }`, not `{ wrong: true }`
    createLyraEvent('lr-confirm-bar', 'lr-approve', { wrong: true });
    // @ts-expect-error lr-confirm-bar documents no `lr-nonexistent-event`
    createLyraEvent('lr-confirm-bar', 'lr-nonexistent-event', undefined);
    // @ts-expect-error `lr-not-a-real-tag` is not a registered tag
    createLyraEvent('lr-not-a-real-tag', 'lr-approve', undefined);
  }
  expect(typeof typeOnlyMisuse).to.equal('function');
});

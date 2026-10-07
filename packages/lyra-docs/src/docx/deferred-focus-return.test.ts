import assert from 'node:assert/strict';
import test from 'node:test';
import { trackDeferredFocusReturn } from './deferred-focus-return.js';

test('a user focus claim cancels deferred return once', () => {
  const doc = new EventTarget() as Document;
  let cancellations = 0;
  const focus = trackDeferredFocusReturn(doc, () => { cancellations++; });
  doc.dispatchEvent(new Event('pointerdown'));
  doc.dispatchEvent(new Event('focusin'));
  focus.cancel();
  assert.equal(focus.cancelled, true);
  assert.equal(cancellations, 1);
});

test('manual completion detaches focus-claim listeners', () => {
  const doc = new EventTarget() as Document;
  let cancellations = 0;
  const focus = trackDeferredFocusReturn(doc, () => { cancellations++; });
  focus.cancel();
  doc.dispatchEvent(new Event('focusin'));
  assert.equal(cancellations, 1);
});

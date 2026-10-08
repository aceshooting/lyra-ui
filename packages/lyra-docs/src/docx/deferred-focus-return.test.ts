import assert from 'node:assert/strict';
import test from 'node:test';
import { returnFocusAfterHide, trackDeferredFocusReturn } from './deferred-focus-return.js';

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

test('focus returns after hide only while nothing has moved on', async () => {
  for (const scenario of ['unchanged', 'user-claimed', 'state-moved', 'hide-rejected'] as const) {
    const doc = new EventTarget() as Document;
    let cancellations = 0;
    let restores = 0;
    const focus = trackDeferredFocusReturn(doc, () => { cancellations++; });
    const hidden = scenario === 'hide-rejected' ? Promise.reject(new Error('hide failed')) : Promise.resolve();
    if (scenario === 'user-claimed') doc.dispatchEvent(new Event('focusin'));
    returnFocusAfterHide(hidden, focus, () => scenario !== 'state-moved', () => { restores++; });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    assert.equal(restores, scenario === 'unchanged' ? 1 : 0, scenario);
    assert.equal(cancellations, 1, `${scenario} releases its focus-claim listeners once`);
    doc.dispatchEvent(new Event('focusin'));
    assert.equal(cancellations, 1, `${scenario} stays detached`);
  }
});

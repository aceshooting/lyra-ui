import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './sequence-playback.js';
import { hoverUntilMatched, resetMouse, sendMouse, settlePointer } from '../../../../test/wtr-mouse.js';

it('keeps an unavailable play button at rest under hover and press, retaining enabled feedback', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-sequence-playback']>(html`<lr-sequence-playback style="--lr-transition-fast: 0s;"></lr-sequence-playback>`);
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="play-button"]')!;
  const read = (): string[] => { const style = getComputedStyle(button); return [style.backgroundColor, style.borderColor]; };
  await resetMouse();
  const resting = read();
  expect(button.disabled).to.equal(true);
  try {
    // The two "must not move" reads get settlePointer() -- an already-dispatched press that the
    // browser has not processed yet is indistinguishable from a correctly inert one, so they
    // cannot poll. The "must move" read polls instead: a fixed two-frame wait can sample before
    // the hover repaint lands and report working feedback as missing.
    await hoverUntilMatched(button, 'disabled play should receive hover');
    await settlePointer();
    expect(read()).to.deep.equal(resting);
    await sendMouse({ type: 'down' });
    await settlePointer();
    expect(read()).to.deep.equal(resting);
    await resetMouse();
    el.itemCount = 3;
    await el.updateComplete;
    expect(button.disabled).to.equal(false);
    const enabledRest = read();
    await hoverUntilMatched(button, 'enabled play should receive hover');
    await waitUntil(
      () => read().join('|') !== enabledRest.join('|'),
      'the enabled play button never repainted under the pointer',
    );
    expect(read()).to.not.deep.equal(enabledRest);
  } finally { await resetMouse(); }
});

import { expect, fixture, html } from '@open-wc/testing';
import './sequence-playback.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

it('keeps an unavailable play button at rest under hover and press, retaining enabled feedback', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-sequence-playback']>(html`<lr-sequence-playback style="--lr-transition-fast: 0s;"></lr-sequence-playback>`);
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="play-button"]')!;
  const read = (): string[] => { const style = getComputedStyle(button); return [style.backgroundColor, style.borderColor]; };
  const settle = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  await resetMouse();
  const resting = read();
  expect(button.disabled).to.equal(true);
  try {
    await hoverUntilMatched(button, 'disabled play should receive hover');
    await settle();
    expect(read()).to.deep.equal(resting);
    await sendMouse({ type: 'down' });
    await settle();
    expect(read()).to.deep.equal(resting);
    await resetMouse();
    el.itemCount = 3;
    await el.updateComplete;
    expect(button.disabled).to.equal(false);
    const enabledRest = read();
    await hoverUntilMatched(button, 'enabled play should receive hover');
    await settle();
    expect(read()).to.not.deep.equal(enabledRest);
  } finally { await resetMouse(); }
});

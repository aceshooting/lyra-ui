import { expect, fixture, html } from '@open-wc/testing';
import './video.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

it('keeps the unavailable progress owner and its rendered track at rest under a native pointer', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-video']>(html`<lr-video style="inline-size: 400px; --lr-transition-fast: 0s;"></lr-video>`);
  const progress = el.shadowRoot!.querySelector<HTMLInputElement>('[part="progress"]')!;
  const track = el.shadowRoot!.querySelector<HTMLElement>('[part="timeline-track"]')!;
  const read = (): string[] => [getComputedStyle(progress).backgroundColor, getComputedStyle(track).backgroundColor];
  const settle = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  await resetMouse();
  const resting = read();
  expect(progress.disabled).to.equal(true);
  try {
    await hoverUntilMatched(progress, 'disabled progress should receive hover');
    await settle();
    expect(read()).to.deep.equal(resting);
    await sendMouse({ type: 'down' });
    await settle();
    expect(read()).to.deep.equal(resting);
    await resetMouse();
    const media = el.shadowRoot!.querySelector('video')!;
    Object.defineProperty(media, 'duration', { configurable: true, value: 100 });
    media.dispatchEvent(new Event('loadedmetadata'));
    await el.updateComplete;
    expect(progress.disabled).to.equal(false);
    const enabledRest = read();
    await hoverUntilMatched(progress, 'enabled progress should receive hover');
    await settle();
    expect(read()).to.not.deep.equal(enabledRest);
  } finally { await resetMouse(); }
});

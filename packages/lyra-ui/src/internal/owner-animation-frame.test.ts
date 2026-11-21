import { expect, fixture, html } from '@open-wc/testing';
import { OwnerAnimationFrameWaiter } from './owner-animation-frame.js';

describe('OwnerAnimationFrameWaiter', () => {
  it('resolves true after a frame while the host stays connected', async () => {
    const host = await fixture<HTMLDivElement>(html`<div></div>`);
    const waiter = new OwnerAnimationFrameWaiter(host);
    expect(await waiter.wait()).to.equal(true);
  });

  it('resolves false when the host is not connected or leaves before the frame', async () => {
    const waiter = new OwnerAnimationFrameWaiter(document.createElement('div'));
    expect(await waiter.wait()).to.equal(false);
    const host = await fixture<HTMLDivElement>(html`<div></div>`);
    const pending = new OwnerAnimationFrameWaiter(host);
    const result = pending.wait();
    host.remove();
    expect(await result).to.equal(false);
  });

  it('settles every pending wait as false on cancel', async () => {
    const host = await fixture<HTMLDivElement>(html`<div></div>`);
    const waiter = new OwnerAnimationFrameWaiter(host);
    const results = [waiter.wait(), waiter.wait()];
    waiter.cancel();
    expect(await Promise.all(results)).to.deep.equal([false, false]);
    waiter.cancel();
  });
});

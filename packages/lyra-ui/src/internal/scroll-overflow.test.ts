import { expect, fixture, html } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { ScrollOverflowController, SCROLL_OVERFLOW_ATTRIBUTE } from './scroll-overflow.js';

/** A minimal `ReactiveControllerHost` that records the controller so a test can drive
 *  `hostUpdated()`/`hostDisconnected()` by hand — the controller measures real layout, so it needs
 *  real elements but not a real LitElement. Mirrors orientation-breakpoint.test.ts's stub host. */
function makeHost(): ReactiveControllerHost & { update(): void; disconnect(): void } {
  const controllers: ReactiveController[] = [];
  return {
    addController(c: ReactiveController) {
      controllers.push(c);
    },
    removeController() {},
    requestUpdate() {},
    updateComplete: Promise.resolve(true),
    update() {
      for (const c of controllers) c.hostUpdated?.();
    },
    disconnect() {
      for (const c of controllers) c.hostDisconnected?.();
    },
  };
}

/** A fixed-width scroll container holding one child of `contentWidth`. */
async function makeTrack(contentWidth: string): Promise<HTMLElement> {
  return (await fixture(html`
    <div style="inline-size: 100px; overflow-x: auto; white-space: nowrap;">
      <div style="inline-size: ${contentWidth}; block-size: 10px;"></div>
    </div>
  `)) as HTMLElement;
}

describe('ScrollOverflowController', () => {
  it('leaves the attribute off when the content fits', async () => {
    const track = await makeTrack('50px');
    const host = makeHost();
    new ScrollOverflowController(host, () => track);
    host.update();
    expect(track.hasAttribute(SCROLL_OVERFLOW_ATTRIBUTE)).to.be.false;
  });

  it('sets the attribute when the content overflows', async () => {
    const track = await makeTrack('400px');
    const host = makeHost();
    new ScrollOverflowController(host, () => track);
    host.update();
    expect(track.hasAttribute(SCROLL_OVERFLOW_ATTRIBUTE)).to.be.true;
  });

  it('clears the attribute when overflowing content shrinks to fit', async () => {
    const track = await makeTrack('400px');
    const host = makeHost();
    new ScrollOverflowController(host, () => track);
    host.update();
    expect(track.hasAttribute(SCROLL_OVERFLOW_ATTRIBUTE)).to.be.true;

    (track.firstElementChild as HTMLElement).style.inlineSize = '20px';
    host.update();
    expect(track.hasAttribute(SCROLL_OVERFLOW_ATTRIBUTE)).to.be.false;
  });

  it('does not treat a one-pixel sub-pixel rounding difference as overflow', async () => {
    const track = await makeTrack('100.4px');
    const host = makeHost();
    new ScrollOverflowController(host, () => track);
    host.update();
    expect(track.hasAttribute(SCROLL_OVERFLOW_ATTRIBUTE)).to.be.false;
  });

  it('re-targets when the resolver starts returning a different element', async () => {
    const first = await makeTrack('400px');
    const second = await makeTrack('10px');
    let current = first;
    const host = makeHost();
    new ScrollOverflowController(host, () => current);
    host.update();
    expect(first.hasAttribute(SCROLL_OVERFLOW_ATTRIBUTE)).to.be.true;

    current = second;
    host.update();
    expect(second.hasAttribute(SCROLL_OVERFLOW_ATTRIBUTE)).to.be.false;
  });

  it('tolerates a missing element', async () => {
    const host = makeHost();
    new ScrollOverflowController(host, () => null);
    expect(() => host.update()).to.not.throw();
  });

  it('stops observing on disconnect', async () => {
    const track = await makeTrack('400px');
    const host = makeHost();
    const controller = new ScrollOverflowController(host, () => track);
    host.update();
    host.disconnect();

    // measure() is now a no-op: the tracked element was released, so a later size change can't
    // flip the attribute back on behind a detached component's back.
    track.removeAttribute(SCROLL_OVERFLOW_ATTRIBUTE);
    controller.measure();
    expect(track.hasAttribute(SCROLL_OVERFLOW_ATTRIBUTE)).to.be.false;
  });
});

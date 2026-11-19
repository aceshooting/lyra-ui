import { expect, waitUntil } from '@open-wc/testing';
import { LitElement } from 'lit';
import { FollowTailController } from './follow-tail-controller.js';

class TailHost extends LitElement {
  protected override createRenderRoot(): HTMLElement { return this; }
  scroller = document.createElement('div');
  follow = true;
  tail = new FollowTailController(this, { scroller: () => this.scroller, shouldFollow: () => this.follow });
}
if (!customElements.get('lr-follow-tail-host')) customElements.define('lr-follow-tail-host', TailHost);

function setup(): TailHost {
  const host = document.createElement('lr-follow-tail-host') as TailHost;
  host.scroller.style.cssText = 'height:50px;overflow:auto';
  const content = document.createElement('div');
  content.style.height = '1000px';
  host.scroller.append(content);
  host.append(host.scroller);
  document.body.append(host);
  return host;
}

describe('FollowTailController', () => {
  it('sticks to the bottom and tracks near-tail state as the user scrolls', async () => {
    const host = setup();
    expect(host.tail.atTail).to.be.false;
    host.tail.scheduleScrollToTail();
    host.tail.scheduleScrollToTail();
    expect(host.tail.pending).to.be.true;
    await waitUntil(() => !host.tail.pending);
    expect(host.tail.atTail).to.be.true;
    host.scroller.scrollTop = 0;
    expect(host.tail.atTail).to.be.false;
    host.remove();
  });

  it('re-checks shouldFollow inside the frame (user scrolled away mid-frame)', async () => {
    const host = setup();
    host.tail.scheduleScrollToTail();
    host.follow = false;
    await waitUntil(() => !host.tail.pending);
    expect(host.scroller.scrollTop).to.equal(0);
    host.remove();
  });

  it('drops a pending jump on disconnect and works again after reconnect', async () => {
    const host = setup();
    host.tail.scheduleScrollToTail();
    host.remove();
    expect(host.tail.pending).to.be.false;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined))));
    expect(host.scroller.scrollTop).to.equal(0);
    document.body.append(host);
    host.tail.scheduleScrollToTail();
    await waitUntil(() => host.tail.atTail);
    host.remove();
  });

  it('treats a missing scroller as at-tail and does nothing', () => {
    const host = document.createElement('lr-follow-tail-host') as TailHost;
    const tail = new FollowTailController(host, { scroller: () => null });
    expect(tail.atTail).to.be.true;
    expect(() => tail.scrollToTail()).to.not.throw();
  });
});
